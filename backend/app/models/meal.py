"""Modèles MealType et MealPrice.

`meal_prices` conserve l'historique : le prix courant porte
`effective_to IS NULL`, et une contrainte d'exclusion interdit deux
périodes qui se chevauchent pour un même repas.
"""

from datetime import date
from decimal import Decimal
from enum import Enum as PyEnum
from uuid import UUID

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    SmallInteger,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class MealSlot(str, PyEnum):
    BREAKFAST = "BREAKFAST"
    LUNCH = "LUNCH"
    DINNER = "DINNER"


class MealType(Base):
    __tablename__ = "meal_types"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, autoincrement=True)
    code: Mapped[MealSlot] = mapped_column(String, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))
    display_order: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[date] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<MealType {self.code}>"


class MealPrice(Base):
    __tablename__ = "meal_prices"

    id: Mapped[UUID] = mapped_column(primary_key=True, autoincrement=False)
    meal_type_id: Mapped[int] = mapped_column(
        SmallInteger, ForeignKey("meal_types.id", ondelete="RESTRICT"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="XOF", nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, server_default=func.current_date(), nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date)
    created_by: Mapped[UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[date] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("meal_type_id", "effective_from", name="meal_prices_period_uk"),
    )

    def __repr__(self) -> str:
        return f"<MealPrice {self.amount} from={self.effective_from} to={self.effective_to}>"