"""Modèle Profile : extension de auth.users, porte le rôle applicatif.

Le rôle vit dans `profiles`, jamais dans auth.users : c'est la table que
contrôlent les politiques RLS.
"""

import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Boolean, DateTime, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class UserRole(str, PyEnum):
    STUDENT = "student"
    LOGISTICIAN = "logistician"
    ADMIN = "admin"


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    matricule: Mapped[str | None] = mapped_column(String(30), unique=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30))
    room: Mapped[str | None] = mapped_column(String(30))
    role: Mapped[UserRole] = mapped_column(String, default=UserRole.STUDENT, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relations
    reservations: Mapped[list["Reservation"]] = relationship(  # noqa: F821
        back_populates="student",
        foreign_keys="Reservation.student_id",
    )
    tickets: Mapped[list["Ticket"]] = relationship(  # noqa: F821
        back_populates="student",
        foreign_keys="Ticket.student_id",
    )

    def __repr__(self) -> str:
        return f"<Profile {self.matricule or self.id} role={self.role}>"