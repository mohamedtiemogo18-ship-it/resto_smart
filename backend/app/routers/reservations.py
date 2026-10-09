"""Réservations : cycle de vie complet."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Query, Request, status

from app.api.deps import (
    AdminDep,
    CurrentUserDep,
    DbSession,
    PaginationDep,
    StaffDep,
    request_context,
)
from app.config import settings
from app.schemas.common import Pagination
from app.schemas.reservation import ReservationCancelIn, ReservationCreate, ReservationOut
from app.schemas.ticket import ConfirmPaymentIn
from app.services.payment_service import PaymentService
from app.services.reservation_service import ReservationService

router = APIRouter(prefix="/reservations", tags=["Reservations"])


def _page(items: list, total: int, page: int, page_size: int) -> dict:
    return {
        "items": items,
        "pagination": Pagination.build(total, page, page_size).model_dump(),
    }


def _ctx(request: Request | None) -> dict:
    return request_context(request) if request else {}


# ---------------------------------------------------------------------------
# Lecture
# ---------------------------------------------------------------------------


@router.get("", summary="Lister les réservations")
async def list_reservations(
    db: DbSession,
    user: CurrentUserDep,
    request: Request,
    status: str | None = Query(None, description="PENDING_PAYMENT | PAID | CANCELLED"),
    number: str | None = Query(None, description="Numéro exact, ex. RES-2026-000137"),
    matricule: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    page_info: PaginationDep = (1, 20),
):
    """Personnel : toutes les réservations. Étudiant : les siennes uniquement."""
    page, page_size = page_info
    service = ReservationService(db, settings)

    if user.is_student:
        items, total = await service.list_mine(user, status=status, page=page, page_size=page_size)
        return _page(items, total, page, page_size)

    items, total = await service.list_all(
        user,
        status=status,
        number=number,
        matricule=matricule,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )
    return _page(items, total, page, page_size)


@router.get("/mine", summary="Mes réservations")
async def list_mine(
    db: DbSession,
    user: CurrentUserDep,
    status: str | None = Query(None),
    page_info: PaginationDep = (1, 20),
):
    """Réservations de l'étudiant connecté."""
    page, page_size = page_info
    service = ReservationService(db, settings)
    items, total = await service.list_mine(user, status=status, page=page, page_size=page_size)
    return _page(items, total, page, page_size)


@router.get(
    "/number/{number}",
    response_model=ReservationOut,
    summary="Détail par numéro de réservation",
)
async def get_by_number(number: str, db: DbSession, user: CurrentUserDep) -> ReservationOut:
    """Recherche par numéro — écran d'encaissement du guichet."""
    return await ReservationService(db, settings).get_by_number(number, user)


@router.get(
    "/{reservation_id}",
    response_model=ReservationOut,
    summary="Détail d'une réservation",
)
async def get_reservation(
    reservation_id: uuid.UUID, db: DbSession, user: CurrentUserDep
) -> ReservationOut:
    """Un étudiant ne voit que les siennes."""
    return await ReservationService(db, settings).get(reservation_id, user)


# ---------------------------------------------------------------------------
# Écriture
# ---------------------------------------------------------------------------


@router.post(
    "",
    response_model=ReservationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Créer une réservation",
)
async def create_reservation(
    payload: ReservationCreate,
    db: DbSession,
    user: CurrentUserDep,
    request: Request,
) -> ReservationOut:
    """L'étudiant prépare sa demande ; le montant est calculé par la base.

    Règles 1, 2 et 3 : au moins un repas, quantité entre 1 et 99, prix relu
    en base puis figé sur la ligne, total recalculé par trigger.

    Erreurs : `422 VALIDATION_ERROR`, `404 MEAL_NOT_FOUND`.
    """
    return await ReservationService(db, settings).create(payload, user, _ctx(request))


@router.patch(
    "/{reservation_id}/cancel",
    response_model=ReservationOut,
    summary="Annuler une réservation",
)
async def cancel_reservation(
    reservation_id: uuid.UUID,
    payload: ReservationCancelIn,
    db: DbSession,
    user: CurrentUserDep,
    request: Request,
) -> ReservationOut:
    """Annulation possible uniquement depuis `PENDING_PAYMENT`.

    Erreurs : `409 RESERVATION_PAID_FINAL` (remboursement hors périmètre),
    `409 RESERVATION_NOT_PENDING`.
    """
    return await ReservationService(db, settings).cancel(
        reservation_id, payload, user, _ctx(request)
    )


@router.post(
    "/{reservation_id}/confirm-payment",
    summary="Confirmer le paiement en espèces",
)
async def confirm_payment(
    reservation_id: uuid.UUID,
    db: DbSession,
    user: StaffDep,
    request: Request,
):
    """Réservé au logisticien et à l'admin — jamais à l'étudiant (règle 4).

    Génère les tickets, les QR signés et les PDF dans une transaction unique.

    Erreurs : `403 ROLE_FORBIDDEN`, `404 RESERVATION_NOT_FOUND`,
    `409 RESERVATION_CANCELLED`, `409 RESERVATION_LOCKED`.
    """
    payload = ConfirmPaymentIn(cash_received=0, change_given=0)
    return await PaymentService(db, settings).confirm(
        reservation_id, payload, user, _ctx(request)
    )


__all__ = ["AdminDep"]