"""Modèle Ticket.

Un ticket par unité commandée (règle 7). Les deux clés étrangères composites
garantissent en base qu'un ticket appartient bien à l'étudiant de sa
réservation et au repas de sa ligne de commande.
"""

import uuid
from datetime import date, datetime
from enum import Enum as PyEnum
from uuid import UUID

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class TicketStatus(str, PyEnum):
    GENERATED = "GENERATED"
    USED = "USED"
    EXPIRED = "EXPIRED"


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    ticket_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    reservation_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("reservations.id", ondelete="CASCADE"), nullable=False
    )
    reservation_item_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), nullable=False
    )
    student_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="RESTRICT"), nullable=False
    )
    meal_type_id: Mapped[int] = mapped_column(
        ForeignKey("meal_types.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[TicketStatus] = mapped_column(
        String, default=TicketStatus.GENERATED, nullable=False
    )
    qr_payload: Mapped[str | None] = mapped_column(String(120), unique=True)
    qr_image_path: Mapped[str | None] = mapped_column(String(255))
    pdf_path: Mapped[str | None] = mapped_column(String(255))
    valid_until: Mapped[date | None] = mapped_column(Date)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    used_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL")
    )
    expired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    reservation: Mapped["Reservation"] = relationship(  # noqa: F821
        back_populates="tickets"
    )
    student: Mapped["Profile"] = relationship(  # noqa: F821
        back_populates="tickets", foreign_keys=[student_id]
    )

    __table_args__ = (
        # Le ticket appartient forcément à l'étudiant de sa réservation
        ForeignKeyConstraint(
            ["reservation_id", "student_id"],
            ["reservations.id", "reservations.student_id"],
            ondelete="CASCADE",
            name="tickets_student_fk",
        ),
        # Le repas du ticket correspond à celui de sa ligne de commande
        ForeignKeyConstraint(
            ["reservation_item_id", "meal_type_id"],
            ["reservation_items.id", "reservation_items.meal_type_id"],
            ondelete="CASCADE",
            name="tickets_meal_fk",
        ),
    )

    def __repr__(self) -> str:
        return f"<Ticket {self.ticket_number} {self.status}>"