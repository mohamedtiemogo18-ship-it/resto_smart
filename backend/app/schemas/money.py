"""Schémas monétaires : les montants circulent en Decimal, jamais en float."""

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class Money(BaseModel):
    """Montant en décimal à deux places (ex. « 6300.00 »)."""

    model_config = ConfigDict(ser_json_bytes="base64")

    amount: Decimal = Field(..., ge=0, decimal_places=2)
    currency: str = "XOF"

    def __str__(self) -> str:
        return f"{self.amount:.2f} {self.currency}"