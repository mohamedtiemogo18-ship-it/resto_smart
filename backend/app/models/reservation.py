"""Modèles Reservation et ReservationItem.

Règles appliquées ici ou par trigger SQL :
- `unit_price` est figé à la création (règle 3) ;
- `line_total` est une colonne générée côté PostgreSQL ;
- `total_amount` / `items_count` sont recalculés par trigger depuis les lignes (règle 2) ;
- `PENDING_PAYMENT → PAID | CANCELLED`, sans retour arrière (règle 5).
"""

import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum as PyEnum
from uuid import UUID

from sqlalchemy import (
    Computed,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ReservationStatus(str, PyEnum):
    PENDING_PAYMENT = "PENDING_PAYMENT"
    PAID = "PAID"
    CANCELLED = "CANCELLED"


class Reservation(Base):
    __tablename__ = "reservations"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    reservation_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    student_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[ReservationStatus] = mapped_column(
        String, default=ReservationStatus.PENDING_PAYMENT, nullable=False
    )
    items_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0"), nullable=False
    )
    note: Mapped[str | None] = mapped_column(Text)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    paid_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL")
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL")
    )
    cancellation_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    student: Mapped["Profile"] = relationship(  # noqa: F821
        back_populates="reservations", foreign_keys=[student_id]
    )
    items: Mapped[list["ReservationItem"]] = relationship(
        back_populates="reservation",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    # `foreign_keys` explicite : tickets pointe vers reservations par DEUX
    # chemins (reservation_id seul, et la clé composite (reservation_id,
    # student_id)). Sans cette précision, SQLAlchemy lève
    # AmbiguousForeignKeysError à la première requête.
    tickets: Mapped[list["Ticket"]] = relationship(  # noqa: F821
        back_populates="reservation",
        cascade="all, delete-orphan",
        foreign_keys="Ticket.reservation_id",
    )

    __table_args__ = (UniqueConstraint("id", "student_id", name="reservations_id_student_uk"),)

    def __repr__(self) -> str:
        return f"<Reservation {self.reservation_number} {self.status}>"


class ReservationItem(Base):
    __tablename__ = "reservation_items"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    reservation_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("reservations.id", ondelete="CASCADE"),
        nullable=False,
    )
    meal_type_id: Mapped[int] = mapped_column(
        ForeignKey("meal_types.id", ondelete="RESTRICT"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    # Colonne générée par PostgreSQL : en lecture seule depuis Python
    line_total: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), Computed("quantity * unit_price"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    reservation: Mapped[Reservation] = relationship(back_populates="items")

    __table_args__ = (
        UniqueConstraint("reservation_id", "meal_type_id", name="reservation_items_meal_uk"),
        UniqueConstraint("id", "meal_type_id", name="reservation_items_id_meal_uk"),
    )

    def __repr__(self) -> str:
        return f"<ReservationItem meal={self.meal_type_id} x{self.quantity}>"