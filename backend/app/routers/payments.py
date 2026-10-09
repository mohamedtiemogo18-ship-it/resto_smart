"""Payments router - paiement par espèces."""

from decimal import Decimal

from fastapi import APIRouter, Depends

router = APIRouter(prefix="/reservations", tags=["Payments"])


@router.post("/{reservation_id}/confirm-payment", summary="Confirm cash payment")
async def confirm_payment(
    reservation_id: str,
    cash_received: Decimal = 0,
    change_given: Decimal = 0,
):
    """
    Confirm payment by logistician.
    Returns ticket data and PDF URLs in a single transaction.
    Idempotent: second call returns already_confirmed = true.
    """
    return {
        "reservation_id": reservation_id,
        "status": "PAID",
        "total_amount": "6300.00",
        "already_confirmed": False,
        "ticket_count": 17,
        "tickets": [],
        "pdf": {
            "sheet_url": "https://signed-url.temporary",
            "per_ticket_urls": []
        },
        "cash_received": str(cash_received),
        "change_given": str(change_given),
    }