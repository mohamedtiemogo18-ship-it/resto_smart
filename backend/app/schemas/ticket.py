"""Schémas des tickets, du paiement et du scan."""

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.ticket import TicketStatus


class TicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ticket_number: str
    status: TicketStatus
    meal_type_id: int
    meal_name: str
    reservation_number: str
    student_id: uuid.UUID
    student_name: str | None = None
    student_matricule: str | None = None
    valid_until: date | None = None
    used_at: datetime | None = None
    used_by: str | None = None
    qr_payload: str | None = None
    pdf_url: str | None = None


class ConsumeTicketIn(BaseModel):
    """Soit le QR scanné, soit la saisie manuelle du numéro."""

    qr_payload: str | None = Field(default=None, max_length=200)
    ticket_number: str | None = Field(default=None, max_length=20)

    def resolve(self) -> str:
        if self.qr_payload:
            return self.qr_payload.strip()
        if self.ticket_number:
            return self.ticket_number.strip().upper()
        raise ValueError("Fournissez qr_payload ou ticket_number")


class ConsumeTicketOut(BaseModel):
    ticket_number: str
    status: TicketStatus
    used_at: datetime
    meal_name: str
    student_name: str
    student_matricule: str | None = None
    consumed_by: str


class ConfirmPaymentIn(BaseModel):
    """Encaissement en espèces.

    `cash_received` et `change_given` sont informatifs : aucun paiement en
    ligne n'est intégré (étape 1.2).
    """

    cash_received: Decimal = Field(..., ge=0, decimal_places=2)
    change_given: Decimal = Field(default=Decimal("0"), ge=0, decimal_places=2)
    note: str | None = Field(default=None, max_length=255)


class ConfirmPaymentOut(BaseModel):
    reservation_id: uuid.UUID
    reservation_number: str
    status: str
    already_confirmed: bool
    total_amount: Decimal
    currency: str = "XOF"
    paid_at: datetime | None = None
    ticket_count: int
    tickets: list[TicketOut] = []
    sheet_pdf_url: str | None = None
    cash_received: Decimal | None = None
    change_given: Decimal | None = None


class VoidTicketIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)