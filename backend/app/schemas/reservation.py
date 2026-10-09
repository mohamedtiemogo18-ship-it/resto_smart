"""Schémas des réservations."""

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.reservation import ReservationStatus


class ReservationItemIn(BaseModel):
    meal_type_id: int = Field(gt=0)
    quantity: int = Field(ge=1, le=99)


class ReservationCreate(BaseModel):
    """Règle 1 : au moins un repas, quantité ≥ 1, un seul ligne par repas."""

    items: list[ReservationItemIn] = Field(min_length=1, max_length=10)
    note: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def unique_meals(self) -> "ReservationCreate":
        ids = [i.meal_type_id for i in self.items]
        if len(set(ids)) != len(ids):
            raise ValueError("Un même repas ne peut apparaître qu'une fois dans une réservation")
        return self


class ReservationItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    meal_type_id: int
    meal_name: str
    quantity: int
    unit_price: Decimal
    line_total: Decimal


class ReservationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    reservation_number: str
    status: ReservationStatus
    student: "ReservationStudentOut"
    items_count: int
    total_amount: Decimal
    currency: str = "XOF"
    items: list[ReservationItemOut] = []
    note: str | None = None
    created_at: datetime
    paid_at: datetime | None = None
    paid_by: str | None = None
    cancelled_at: datetime | None = None
    cancellation_reason: str | None = None
    tickets_generated: int = 0
    tickets_used: int = 0
    tickets_pending: int = 0
    waiting_minutes: int | None = None


class ReservationStudentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    matricule: str | None = None
    full_name: str
    room: str | None = None


ReservationOut.model_rebuild()


class ReservationCancelIn(BaseModel):
    reason: str | None = Field(default=None, max_length=500)