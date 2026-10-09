"""Service des réservations.

Règles 1, 2 et 3 : les prix sont relus en base à chaque création, le
`unit_price` est figé sur la ligne, et le total est recalculé par trigger.
"""

import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import Conflict, Forbidden, NotFound, pg_error_to_business_error
from app.models.reservation import Reservation, ReservationItem
from app.models.profile import Profile
from app.models.meal import MealType
from app.schemas.reservation import ReservationCancelIn, ReservationCreate, ReservationOut
from app.schemas.user import CurrentUser
from app.services.audit_service import AuditService
from app.services.meal_service import MealService


class ReservationService:
    def __init__(self, db: AsyncSession, settings) -> None:
        self._db = db
        self._settings = settings
        self._meals = MealService(db)

    # ------------------------------------------------------------------
    # Création
    # ------------------------------------------------------------------

    async def create(
        self, payload: ReservationCreate, actor: CurrentUser, request_context: dict | None = None
    ) -> ReservationOut:
        """Crée une réservation en attente de paiement.

        Un étudiant ne réserve que pour lui-même ; le personnel peut réserver
        au guichet pour un étudiant qui n'a pas de téléphone.
        """
        ctx = request_context or {}
        student_id = actor.id
        if not actor.is_student and (student := ctx.get("student_id")):
            student_id = student

        # Vérifie que tous les repas ont un prix courant
        prices: dict[int, Decimal] = {}
        for item in payload.items:
            price = await self._meals.require_price(item.meal_type_id)
            prices[item.meal_type_id] = price.amount

        async with self._db.begin():
            reservation = Reservation(
                student_id=student_id,
                note=payload.note,
                status="PENDING_PAYMENT",
            )
            self._db.add(reservation)
            await self._db.flush()  # attribue l'id et déclenche la numérotation

            for item in payload.items:
                self._db.add(
                    ReservationItem(
                        reservation_id=reservation.id,
                        meal_type_id=item.meal_type_id,
                        quantity=item.quantity,
                        unit_price=prices[item.meal_type_id],  # figé à jamais
                    )
                )

            await self._db.flush()
            await self._db.refresh(reservation)

            await AuditService(self._db).record(
                actor,
                "reservation.create",
                "reservation",
                reservation.reservation_number,
                {
                    "reservation_id": str(reservation.id),
                    "student_id": str(student_id),
                    "items": [
                        {"meal_type_id": i.meal_type_id, "quantity": i.quantity}
                        for i in payload.items
                    ],
                    "total_amount": str(reservation.total_amount),
                },
                ip=ctx.get("ip"),
                user_agent=ctx.get("user_agent"),
            )

        return await self.get(reservation.id, actor)

    # ------------------------------------------------------------------
    # Lecture
    # ------------------------------------------------------------------

    async def get(self, reservation_id: uuid.UUID, actor: CurrentUser) -> ReservationOut:
        reservation = await self._load(reservation_id)
        if reservation is None:
            raise NotFound("Réservation introuvable", code="RESERVATION_NOT_FOUND")
        if actor.is_student and reservation.student_id != actor.id:
            raise Forbidden("Cette réservation ne vous appartient pas")
        return await self._to_out(reservation)

    async def get_by_number(self, number: str, actor: CurrentUser) -> ReservationOut:
        result = await self._db.execute(
            select(Reservation).where(Reservation.reservation_number == number.strip().upper())
        )
        reservation = result.scalar_one_or_none()
        if reservation is None:
            raise NotFound("Réservation introuvable", code="RESERVATION_NOT_FOUND")
        if actor.is_student and reservation.student_id != actor.id:
            raise Forbidden("Cette réservation ne vous appartient pas")
        return await self._to_out(reservation)

    async def list_mine(
        self, actor: CurrentUser, status: str | None = None, page: int = 1, page_size: int = 20
    ) -> tuple[list[ReservationOut], int]:
        return await self._list(student_id=actor.id, status=status, page=page, page_size=page_size)

    async def list_all(
        self,
        actor: CurrentUser,
        status: str | None = None,
        number: str | None = None,
        matricule: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[ReservationOut], int]:
        return await self._list(
            status=status, number=number, matricule=matricule,
            date_from=date_from, date_to=date_to, page=page, page_size=page_size,
        )

    async def _list(
        self,
        student_id: uuid.UUID | None = None,
        status: str | None = None,
        number: str | None = None,
        matricule: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[ReservationOut], int]:
        from sqlalchemy import func

        stmt = (
            select(Reservation)
            .options(
                selectinload(Reservation.items),
                selectinload(Reservation.student),
                selectinload(Reservation.tickets),
            )
            .order_by(Reservation.created_at.desc())
        )
        count_stmt = select(func.count()).select_from(Reservation)

        if student_id:
            stmt = stmt.where(Reservation.student_id == student_id)
            count_stmt = count_stmt.where(Reservation.student_id == student_id)
        if status:
            stmt = stmt.where(Reservation.status == status)
            count_stmt = count_stmt.where(Reservation.status == status)
        if number:
            stmt = stmt.where(Reservation.reservation_number == number.strip().upper())
            count_stmt = count_stmt.where(Reservation.reservation_number == number.strip().upper())
        if matricule:
            stmt = stmt.join(Profile, Profile.id == Reservation.student_id).where(
                Profile.matricule == matricule.strip().upper()
            )
            count_stmt = (
                count_stmt.join(Profile, Profile.id == Reservation.student_id)
                .where(Profile.matricule == matricule.strip().upper())
            )
        if date_from:
            stmt = stmt.where(Reservation.created_at >= date_from)
            count_stmt = count_stmt.where(Reservation.created_at >= date_from)
        if date_to:
            stmt = stmt.where(Reservation.created_at <= date_to)
            count_stmt = count_stmt.where(Reservation.created_at <= date_to)

        total = (await self._db.execute(count_stmt)).scalar_one()
        result = await self._db.execute(
            stmt.offset((page - 1) * page_size).limit(page_size)
        )
        return [await self._to_out(r) for r in result.scalars().unique().all()], total

    # ------------------------------------------------------------------
    # Annulation
    # ------------------------------------------------------------------

    async def cancel(
        self,
        reservation_id: uuid.UUID,
        payload: ReservationCancelIn,
        actor: CurrentUser,
        request_context: dict | None = None,
    ) -> ReservationOut:
        """Annulation possible uniquement depuis PENDING_PAYMENT."""
        ctx = request_context or {}
        try:
            async with self._db.begin():
                await self._db.execute(
                    text(
                        "select public.fn_cancel_reservation(:rid, :aid, :reason, :ip, :ua)"
                    ),
                    {
                        "rid": reservation_id,
                        "aid": actor.id,
                        "reason": payload.reason,
                        "ip": ctx.get("ip"),
                        "ua": ctx.get("user_agent"),
                    },
                )
        except Exception as exc:
            raise pg_error_to_business_error(exc) from exc

        return await self.get(reservation_id, actor)

    # ------------------------------------------------------------------
    # Chargement et sérialisation
    # ------------------------------------------------------------------

    async def _load(self, reservation_id: uuid.UUID) -> Reservation | None:
        result = await self._db.execute(
            select(Reservation)
            .options(
                selectinload(Reservation.items),
                selectinload(Reservation.student),
                selectinload(Reservation.tickets),
            )
            .where(Reservation.id == reservation_id)
        )
        return result.scalar_one_or_none()

    async def _meal_names(self, meal_type_ids: set[int]) -> dict[int, str]:
        """Résout les noms de repas en une seule requête."""
        if not meal_type_ids:
            return {}
        result = await self._db.execute(
            select(MealType.id, MealType.name).where(MealType.id.in_(meal_type_ids))
        )
        return {row[0]: row[1] for row in result.all()}

    async def _to_out(self, r: Reservation) -> ReservationOut:
        meal_names = await self._meal_names({i.meal_type_id for i in r.items})

        tickets = r.tickets or []
        now = datetime.now(timezone.utc)
        waiting = None
        if r.status == "PENDING_PAYMENT" and r.created_at:
            created = r.created_at
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            waiting = int((now - created).total_seconds() // 60)

        return ReservationOut(
            id=r.id,
            reservation_number=r.reservation_number,
            status=r.status,
            student={
                "id": r.student.id,
                "matricule": r.student.matricule,
                "full_name": r.student.full_name,
                "room": r.student.room,
            },
            items_count=r.items_count,
            total_amount=r.total_amount,
            currency="XOF",
            items=[
                {
                    "id": i.id,
                    "meal_type_id": i.meal_type_id,
                    "meal_name": meal_names.get(i.meal_type_id, ""),
                    "quantity": i.quantity,
                    "unit_price": i.unit_price,
                    "line_total": i.line_total,
                }
                for i in r.items
            ],
            note=r.note,
            created_at=r.created_at,
            paid_at=r.paid_at,
            paid_by=str(r.paid_by) if r.paid_by else None,
            cancelled_at=r.cancelled_at,
            cancellation_reason=r.cancellation_reason,
            tickets_generated=len(tickets),
            tickets_used=sum(1 for t in tickets if t.status == "USED"),
            tickets_pending=sum(1 for t in tickets if t.status == "GENERATED"),
            waiting_minutes=waiting,
        )


__all__ = ["ReservationService", "MealType"]