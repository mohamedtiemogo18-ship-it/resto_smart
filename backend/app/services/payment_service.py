"""Service de paiement — l'opération la plus sensible du système.

Règle 9 : l'encaissement est atomique et idempotent. Deux clics simultanés
sont sérialisés par `select ... for update` dans `fn_confirm_payment` ; le
second appel renvoie l'état existant sans recréer de ticket.

Règle 4 : seul le personnel encaisse. La vérification de rôle est faite en
amont par la dépendance FastAPI, puis re-vérifiée par le trigger SQL.

Atomicité : la signature QR, la génération du PDF et l'upload Storage ont
lieu dans la MÊME transaction que la bascule de statut. Si l'upload échoue,
le rollback annule aussi le passage à PAID — aucun ticket orphelin.
"""

import json
import uuid
from decimal import Decimal

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BusinessError, Conflict, Forbidden, NotFound, pg_error_to_business_error
from app.models.reservation import Reservation
from app.models.ticket import Ticket
from app.schemas.ticket import ConfirmPaymentIn, ConfirmPaymentOut
from app.schemas.user import CurrentUser
from app.services.audit_service import AuditService
from app.services.pdf_service import PDFService
from app.services.qr_service import QRService
from app.services.storage_service import StorageService


class PaymentService:
    def __init__(self, db: AsyncSession, settings) -> None:
        self._db = db
        self._settings = settings
        self._qr = QRService(settings)
        self._storage = StorageService(settings)
        self._pdf = PDFService(settings, storage=self._storage, db=db)

    async def confirm(
        self,
        reservation_id: uuid.UUID,
        payload: ConfirmPaymentIn,
        actor: CurrentUser,
        request_context: dict | None = None,
    ) -> ConfirmPaymentOut:
        """Encaissement en espèces, génération des tickets, PDF et QR."""
        ctx = request_context or {}

        # Garde de rôle (règle 4) — redondante avec le trigger SQL, assumée
        if not actor.is_staff:
            raise Forbidden(
                "Seul le logisticien ou l'administrateur peut confirmer un paiement",
                code="PAYMENT_CONFIRM_FORBIDDEN",
            )

        # 1. Bascule de statut + création des tickets, en base, atomiquement
        async with self._db.begin():
            try:
                result = await self._db.execute(
                    text(
                        "select public.fn_confirm_payment(:rid, :aid, :days, :ip, :ua)::text"
                    ),
                    {
                        "rid": reservation_id,
                        "aid": actor.id,
                        "days": self._settings.TICKET_VALIDITY_DAYS,
                        "ip": ctx.get("ip"),
                        "ua": ctx.get("user_agent"),
                    },
                )
                data = json.loads(result.scalar_one())
            except Exception as exc:
                raise pg_error_to_business_error(exc) from exc

            # 2. Idempotence : second clic, on ne régénère rien
            if data["already_confirmed"]:
                existing = await self._load_tickets(reservation_id)
                return ConfirmPaymentOut(
                    reservation_id=uuid.UUID(data["reservation_id"]),
                    reservation_number=data["reservation_number"],
                    status=data["status"],
                    already_confirmed=True,
                    total_amount=Decimal(data["total_amount"]),
                    paid_at=data.get("paid_at"),
                    ticket_count=data["ticket_count"],
                    tickets=await self._tickets_out(existing),
                    cash_received=payload.cash_received,
                    change_given=payload.change_given,
                )

            # 3. Même transaction : signature QR + PDF + upload
            tickets = await self._load_generated_tickets(reservation_id)

            for ticket in tickets:
                ticket.qr_payload = self._qr.sign(ticket.ticket_number)

            for ticket in tickets:
                pdf_bytes = await self._pdf.render(ticket)
                ticket.pdf_path = await self._storage.upload_pdf(ticket, pdf_bytes)

            await self._db.flush()

            sheet_url = await self._build_sheet(tickets, reservation_id)

        # 4. Rechargement complet pour la réponse
        final = await self._load_tickets(reservation_id)
        return ConfirmPaymentOut(
            reservation_id=uuid.UUID(data["reservation_id"]),
            reservation_number=data["reservation_number"],
            status=data["status"],
            already_confirmed=False,
            total_amount=Decimal(data["total_amount"]),
            paid_at=data.get("paid_at"),
            ticket_count=data["ticket_count"],
            tickets=await self._tickets_out(final),
            sheet_pdf_url=sheet_url,
            cash_received=payload.cash_received,
            change_given=payload.change_given,
        )

    # ------------------------------------------------------------------

    async def _build_sheet(self, tickets: list[Ticket], reservation_id: uuid.UUID) -> str | None:
        """Feuille récapitulative de tous les tickets d'une réservation."""
        if not tickets:
            return None
        try:
            sheet = await self._pdf.render_sheet(tickets)
            return await self._storage.upload_sheet(reservation_id, sheet)
        except Exception:
            # La feuille est un confort : son échec ne doit pas annuler la vente
            return None

    async def _load_generated_tickets(self, reservation_id: uuid.UUID) -> list[Ticket]:
        result = await self._db.execute(
            select(Ticket)
            .where(Ticket.reservation_id == reservation_id, Ticket.status == "GENERATED")
            .order_by(Ticket.ticket_number)
            .with_for_update()
        )
        return list(result.scalars().all())

    async def _load_tickets(self, reservation_id: uuid.UUID) -> list[Ticket]:
        result = await self._db.execute(
            select(Ticket)
            .where(Ticket.reservation_id == reservation_id)
            .order_by(Ticket.ticket_number)
        )
        return list(result.scalars().all())

    async def _tickets_out(self, tickets: list[Ticket]) -> list:
        from app.schemas.ticket import TicketOut

        out = []
        for t in tickets:
            out.append(
                TicketOut(
                    ticket_number=t.ticket_number,
                    status=t.status,
                    meal_type_id=t.meal_type_id,
                    meal_name=await self._meal_name(t.meal_type_id),
                    reservation_number=await self._reservation_number(t.reservation_id),
                    student_id=t.student_id,
                    valid_until=t.valid_until,
                    used_at=t.used_at,
                    qr_payload=t.qr_payload,
                    pdf_url=None,
                )
            )
        return out

    async def _meal_name(self, meal_type_id: int) -> str:
        from app.models.meal import MealType

        meal = await self._db.get(MealType, meal_type_id)
        return meal.name if meal else ""

    async def _reservation_number(self, reservation_id: uuid.UUID) -> str:
        reservation = await self._db.get(Reservation, reservation_id)
        return reservation.reservation_number if reservation else ""


__all__ = ["PaymentService", "BusinessError", "Conflict"]