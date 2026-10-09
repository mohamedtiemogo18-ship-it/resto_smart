"""Schémas des repas et des tarifs."""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.meal import MealSlot


class MealOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: MealSlot
    name: str
    description: str | None = None
    display_order: int
    is_active: bool


class PriceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    amount: Decimal
    currency: str
    effective_from: date
    effective_to: date | None = None
    is_current: bool = False


class MealWithPrice(MealOut):
    """Repas avec son prix courant (null si non réservable)."""

    price: PriceOut | None = None


class PriceUpdateIn(BaseModel):
    """Ouverture d'une nouvelle période de prix.

    Le prix courant n'est jamais modifié : il est clôturé et un nouveau est
    ouvert, ce qui préserve l'historique (règle 3).
    """

    amount: Decimal = Field(..., gt=0, decimal_places=2)
    effective_from: date
    reason: str | None = Field(default=None, max_length=255)


class PriceHistoryOut(BaseModel):
    meal_type_id: int
    meal_name: str
    prices: list[PriceOut]