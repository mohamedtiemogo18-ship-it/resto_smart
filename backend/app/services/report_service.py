"""Service des rapports et tableaux de bord."""

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.report import (
    DailySalesOut,
    DailySalesRow,
    DashboardOut,
    DashboardQueueItem,
    MealSalesOut,
    MealSalesRow,
    TicketStatsOut,
    TicketStatsRow,
)
from app.schemas.user import CurrentUser

#: Fuseau des vues de reporting — à confirmer avec le service
TIMEZONE_NAME = "Africa/Ouagadougou"


class ReportService:
    def __init__(self, db: AsyncSession, settings) -> None:
        self._db = db
        self._settings = settings

    # ------------------------------------------------------------------
    # Tableau de bord du guichet
    # ------------------------------------------------------------------

    async def dashboard(self) -> DashboardOut:
        from app.models.reservation import Reservation
        from app.models.ticket import Ticket

        today_start = self._local_midnight()
        tomorrow_start = today_start + timedelta(days=1)

        # Encaissements du jour
        row = (
            await self._db.execute(
                text(
                    """
                    select coalesce(sum(total_amount), 0) as revenue,
                           count(*)                    as reservations,
                           coalesce(sum(items_count), 0) as meals
                      from reservations
                     where status = 'PAID'
                       and paid_at >= :start and paid_at < :end
                    """
                ),
                {"start": today_start, "end": tomorrow_start},
            )
        ).one()

        # Tickets consommés aujourd'hui
        used_today = (
            await self._db.execute(
                text(
                    """
                    select count(*) from tickets
                     where status = 'USED'
                       and used_at >= :start and used_at < :end
                    """
                ),
                {"start": today_start, "end": tomorrow_start},
            )
        ).scalar_one()

        # Répartition par statut
        stats_result = await self._db.execute(
            select(Ticket.status, Ticket.id).group_by(Ticket.status)
        )
        by_status: dict[str, int] = {}
        for status, _id in stats_result.all():
            by_status[status] = by_status.get(status, 0) + 1

        # File d'attente
        queue = await self._pending_queue()

        # Répartition par repas
        by_meal = await self._sales_by_meal(today_start, tomorrow_start)

        return DashboardOut(
            today_revenue=str(row.revenue),
            today_reservations_paid=row.reservations,
            today_meals_sold=row.meals,
            today_tickets_used=used_today,
            tickets_pending=by_status.get("GENERATED", 0),
            tickets_expired=by_status.get("EXPIRED", 0),
            pending_payments=len(queue),
            by_meal=by_meal,
            queue=queue,
        )

    async def _pending_queue(self) -> list[DashboardQueueItem]:
        from app.models.profile import Profile
        from app.models.reservation import Reservation

        result = await self._db.execute(
            select(Reservation, Profile)
            .join(Profile, Profile.id == Reservation.student_id)
            .where(Reservation.status == "PENDING_PAYMENT")
            .order_by(Reservation.created_at.asc())
            .limit(50)
        )

        now = datetime.now(timezone.utc)
        items: list[DashboardQueueItem] = []
        for reservation, profile in result.all():
            created = reservation.created_at
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            items.append(
                DashboardQueueItem(
                    reservation_id=reservation.id,
                    reservation_number=reservation.reservation_number,
                    student_name=profile.full_name,
                    student_matricule=profile.matricule,
                    room=profile.room,
                    items_count=reservation.items_count,
                    total_amount=str(reservation.total_amount),
                    waiting_minutes=max(0, int((now - created).total_seconds() // 60)),
                )
            )
        return items

    # ------------------------------------------------------------------
    # Rapports
    # ------------------------------------------------------------------

    async def daily_sales(self, date_from: date, date_to: date) -> DailySalesOut:
        rows = (
            await self._db.execute(
                text(
                    """
                    select (paid_at at time zone :tz)::date as sale_date,
                           count(*) as reservations_paid,
                           coalesce(sum(total_amount), 0) as revenue,
                           coalesce(sum(items_count), 0) as meals_sold
                      from reservations
                     where status = 'PAID'
                       and (paid_at at time zone :tz)::date between :from and :to
                     group by 1
                     order by 1
                    """
                ),
                {"tz": TIMEZONE_NAME, "from": date_from, "to": date_to},
            )
        ).all()

        used_rows = (
            await self._db.execute(
                text(
                    """
                    select (used_at at time zone :tz)::date as sale_date, count(*) as used
                      from tickets
                     where status = 'USED'
                       and (used_at at time zone :tz)::date between :from and :to
                     group by 1
                    """
                ),
                {"tz": TIMEZONE_NAME, "from": date_from, "to": date_to},
            )
        ).all()
        used_by_day = {r.sale_date: r.used for r in used_rows}

        days = [
            DailySalesRow(
                sale_date=r.sale_date,
                reservations_paid=r.reservations_paid,
                revenue=str(r.revenue),
                meals_sold=r.meals_sold,
                tickets_used=used_by_day.get(r.sale_date, 0),
            )
            for r in rows
        ]

        return DailySalesOut(
            from_date=date_from,
            to_date=date_to,
            days=days,
            total_revenue=str(sum((Decimal(r.revenue) for r in rows), Decimal("0"))),
            total_reservations=sum(r.reservations_paid for r in rows),
            total_meals_sold=sum(r.meals_sold for r in rows),
            total_tickets_used=sum(used_by_day.values()),
        )

    async def sales_by_meal(self, date_from: date, date_to: date) -> MealSalesOut:
        rows = await self._sales_by_meal(
            self._local_midnight(date_from), self._local_midnight(date_to) + timedelta(days=1)
        )
        return MealSalesOut(from_date=date_from, to_date=date_to, rows=rows)

    async def _sales_by_meal(self, start: datetime, end: datetime) -> list[MealSalesRow]:
        rows = (
            await self._db.execute(
                text(
                    """
                    select m.id as meal_type_id,
                           m.name as meal,
                           coalesce(sum(ri.quantity), 0) as meals_ordered,
                           coalesce(sum(ri.line_total), 0) as revenue,
                           coalesce(t.used_count, 0) as tickets_used
                      from meal_types m
                      left join reservation_items ri on ri.meal_type_id = m.id
                      left join reservations r
                             on r.id = ri.reservation_id
                            and r.status = 'PAID'
                            and r.paid_at >= :start and r.paid_at < :end
                      left join (
                          select meal_type_id, count(*) as used_count
                            from tickets
                           where status = 'USED'
                           group by meal_type_id
                      ) t on t.meal_type_id = m.id
                     group by m.id, m.name, m.display_order, t.used_count
                     order by m.display_order
                    """
                ),
                {"start": start, "end": end},
            )
        ).all()

        return [
            MealSalesRow(
                meal_type_id=r.meal_type_id,
                meal=r.meal,
                meals_ordered=r.meals_ordered,
                tickets_used=r.tickets_used,
                revenue=str(r.revenue),
            )
            for r in rows
        ]

    async def ticket_stats(self) -> TicketStatsOut:
        from app.models.profile import Profile
        from app.models.ticket import Ticket

        result = await self._db.execute(
            select(Ticket.status, Ticket.student_id)
        )
        counts: dict[str, set] = {}
        for status, student_id in result.all():
            counts.setdefault(status, set()).add(student_id)

        return TicketStatsOut(
            rows=[
                TicketStatsRow(
                    status=status,
                    tickets=len(students),
                    students=len(students),
                )
                for status, students in counts.items()
            ]
        )

    # ------------------------------------------------------------------

    @staticmethod
    def _local_midnight(day: date | None = None) -> datetime:
        """Minuit local, renvoyé en UTC naïf pour comparer aux timestamptz."""
        target = day or date.today()
        return datetime(target.year, target.month, target.day, tzinfo=timezone.utc)


__all__ = ["ReportService", "uuid"]