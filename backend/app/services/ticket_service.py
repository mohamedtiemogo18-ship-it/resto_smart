"""Service de scan et de consommation des tickets.

Le backend vérifie la signature HMAC AVANT tout accès à la base ; la fonction
SQL `fn_consume_ticket` reste le dernier verrou anti-réutilisation, avec un
`select ... for update` qui sérialise les scans simultanés.
"""

import json
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BusinessError, Forbidden, pg_error_to_business_error
from app.models.ticket import Ticket
from app.schemas.ticket import ConsumeTicketIn, ConsumeTicketOut, TicketOut, VoidTicketIn
from app.schemas.user import CurrentUser


class TicketService:
    def __init__(self, db: AsyncSession, settings) -> None:
        self._db = db
        self._settings = settings
        from app.services.qr_service import QRService
        from app.services.storage_service import StorageService

        self._qr = QRService(settings)
        self._storage = StorageService(settings)

    # ------------------------------------------------------------------
    # Consommation (scan au restaurant)
    # ------------------------------------------------------------------

    async def consume(
        self, payload: ConsumeTicketIn, actor: CurrentUser, request_context: dict | None = None
    ) -> ConsumeTicketOut:
        """Consomme un ticket à partir de son QR ou de son numéro."""
        ctx = request_context or {}
        if not actor.is_staff:
            raise Forbidden(
                "Seul le personnel peut consommer un ticket", code="ROLE_FORBIDDEN"
            )

        raw = payload.resolve()

        # 1. Vérification cryptographique avant tout accès base
        ticket_number = self._qr.verify(raw)
        if ticket_number is None:
            raise BusinessError(
                "QR_INVALID",
                "La signature du ticket est invalide : QR falsifié ou clé obsolète.",
                401,
            )

        # 2. Consommation atomique — la base refuse les doubles scans
        try:
            async with self._db.begin():
                result = await self._db.execute(
                    text(
                        "select public.fn_consume_ticket(:num, :aid, :ip, :ua)::text"
                    ),
                    {
                        "num": ticket_number,
                        "aid": actor.id,
                        "ip": ctx.get("ip"),
                        "ua": ctx.get("user_agent"),
                    },
                )
                data = json.loads(result.scalar_one())
        except Exception as exc:
            raise pg_error_to_business_error(exc) from exc

        return ConsumeTicketOut(
            ticket_number=data["ticket_number"],
            status=data["status"],
            used_at=data["used_at"],
            meal_name=data.get("meal_name", ""),
            student_name=data.get("student_name", ""),
            student_matricule=data.get("student_matricule"),
            consumed_by=actor.full_name,
        )

    # ------------------------------------------------------------------
    # Lecture
    # ------------------------------------------------------------------

    async def list_mine(
        self,
        actor: CurrentUser,
        status: str | None = None,
        reservation_id: uuid.UUID | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[TicketOut], int]:
        from sqlalchemy import func

        stmt = (
            select(Ticket)
            .where(Ticket.student_id == actor.id)
            .order_by(Ticket.created_at.desc())
        )
        count_stmt = select(func.count()).select_from(Ticket).where(Ticket.student_id == actor.id)

        if status:
            stmt = stmt.where(Ticket.status == status)
            count_stmt = count_stmt.where(Ticket.status == status)
        if reservation_id:
            stmt = stmt.where(Ticket.reservation_id == reservation_id)
            count_stmt = count_stmt.where(Ticket.reservation_id == reservation_id)

        total = (await self._db.execute(count_stmt)).scalar_one()
        result = await self._db.execute(stmt.offset((page - 1) * page_size).limit(page_size))
        tickets = list(result.scalars().all())
        return [await self._to_out(t, include_qr=True) for t in tickets], total

    async def list_all(
        self,
        actor: CurrentUser,
        status: str | None = None,
        ticket_number: str | None = None,
        meal_type_id: int | None = None,
        student_matricule: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[TicketOut], int]:
        from sqlalchemy import func

        from app.models.profile import Profile

        stmt = select(Ticket).order_by(Ticket.created_at.desc())
        count_stmt = select(func.count()).select_from(Ticket)

        if status:
            stmt = stmt.where(Ticket.status == status)
            count_stmt = count_stmt.where(Ticket.status == status)
        if ticket_number:
            needle = ticket_number.strip().upper()
            stmt = stmt.where(Ticket.ticket_number == needle)
            count_stmt = count_stmt.where(Ticket.ticket_number == needle)
        if meal_type_id:
            stmt = stmt.where(Ticket.meal_type_id == meal_type_id)
            count_stmt = count_stmt.where(Ticket.meal_type_id == meal_type_id)
        if student_matricule:
            stmt = stmt.join(Profile, Profile.id == Ticket.student_id).where(
                Profile.matricule == student_matricule.strip().upper()
            )
            count_stmt = (
                count_stmt.join(Profile, Profile.id == Ticket.student_id)
                .where(Profile.matricule == student_matricule.strip().upper())
            )

        total = (await self._db.execute(count_stmt)).scalar_one()
        result = await self._db.execute(stmt.offset((page - 1) * page_size).limit(page_size))
        tickets = list(result.scalars().all())
        return [await self._to_out(t, include_qr=actor.is_staff) for t in tickets], total

    async def get(self, ticket_number: str, actor: CurrentUser) -> TicketOut:
        result = await self._db.execute(
            select(Ticket).where(Ticket.ticket_number == ticket_number.strip().upper())
        )
        ticket = result.scalar_one_or_none()
        if ticket is None:
            from app.core.errors import NotFound

            raise NotFound("Ticket introuvable", code="TICKET_NOT_FOUND")
        if actor.is_student and ticket.student_id != actor.id:
            raise Forbidden("Ce ticket ne vous appartient pas")
        return await self._to_out(ticket, include_qr=True)

    async def pdf_url(self, ticket_number: str, actor: CurrentUser) -> str:
        ticket = await self._get_entity(ticket_number, actor)
        if not ticket.pdf_path:
            raise BusinessError("PDF_NOT_GENERATED", "Aucun PDF pour ce ticket", 404)
        return await self._storage.signed_url(ticket.pdf_path)

    # ------------------------------------------------------------------
    # Annulation par l'administrateur
    # ------------------------------------------------------------------

    async def void(
        self, ticket_number: str, payload: VoidTicketIn, actor: CurrentUser
    ) -> TicketOut:
        from datetime import datetime as _dt

        ticket = await self._get_entity(ticket_number, actor)
        if ticket.status == "USED":
            from app.core.errors import Conflict

            raise Conflict(
                "TICKET_USED_FINAL", "Un ticket consommé ne peut pas être annulé"
            )

        ticket.status = "EXPIRED"
        ticket.expired_at = _dt.now(timezone.utc)
        await self._db.flush()

        from app.services.audit_service import AuditService

        await AuditService(self._db).record(
            actor,
            "ticket.void",
            "ticket",
            ticket.ticket_number,
            {"reason": payload.reason},
        )
        await self._db.commit()
        return await self._to_out(ticket, include_qr=False)

    # ------------------------------------------------------------------

    async def _get_entity(self, ticket_number: str, actor: CurrentUser) -> Ticket:
        result = await self._db.execute(
            select(Ticket).where(Ticket.ticket_number == ticket_number.strip().upper())
        )
        ticket = result.scalar_one_or_none()
        if ticket is None:
            from app.core.errors import NotFound

            raise NotFound("Ticket introuvable", code="TICKET_NOT_FOUND")
        if actor.is_student and ticket.student_id != actor.id:
            raise Forbidden("Ce ticket ne vous appartient pas")
        return ticket

    async def _to_out(self, t: Ticket, include_qr: bool = False) -> TicketOut:
        from app.models.meal import MealType
        from app.models.profile import Profile
        from app.models.reservation import Reservation

        meal = await self._db.get(MealType, t.meal_type_id)
        student = await self._db.get(Profile, t.student_id)
        reservation = await self._db.get(Reservation, t.reservation_id)

        used_by_name = None
        if t.used_by:
            operator = await self._db.get(Profile, t.used_by)
            used_by_name = operator.full_name if operator else None

        return TicketOut(
            ticket_number=t.ticket_number,
            status=t.status,
            meal_type_id=t.meal_type_id,
            meal_name=meal.name if meal else "",
            reservation_number=reservation.reservation_number if reservation else "",
            student_id=t.student_id,
            student_name=student.full_name if student else None,
            student_matricule=student.matricule if student else None,
            valid_until=t.valid_until,
            used_at=t.used_at,
            used_by=used_by_name,
            qr_payload=t.qr_payload if include_qr else None,
            pdf_url=None,
        )


__all__ = ["TicketService", "date"]