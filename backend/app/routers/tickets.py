"""Tickets : liste, PDF, scan et consommation."""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response

from app.api.deps import AdminDep, CurrentUserDep, DbSession, PaginationDep, StaffDep, request_context
from app.config import settings
from app.schemas.common import Pagination
from app.schemas.ticket import ConsumeTicketIn, ConsumeTicketOut, TicketOut, VoidTicketIn
from app.services.ticket_service import TicketService

router = APIRouter(prefix="/tickets", tags=["Tickets"])


def _page(items: list, total: int, page: int, page_size: int) -> dict:
    return {
        "items": items,
        "pagination": Pagination.build(total, page, page_size).model_dump(),
    }


# ---------------------------------------------------------------------------
# Lecture
# ---------------------------------------------------------------------------


@router.get("/mine", summary="Mes tickets")
async def my_tickets(
    db: DbSession,
    user: CurrentUserDep,
    status: str | None = Query(None, description="GENERATED | USED | EXPIRED"),
    reservation_id: uuid.UUID | None = Query(None),
    page_info: PaginationDep = (1, 20),
):
    """Tickets de l'étudiant connecté, avec QR et lien PDF."""
    page, page_size = page_info
    service = TicketService(db, settings)
    items, total = await service.list_mine(
        user, status=status, reservation_id=reservation_id, page=page, page_size=page_size
    )
    return _page(items, total, page, page_size)


@router.get("", summary="Lister les tickets")
async def list_tickets(
    db: DbSession,
    user: CurrentUserDep,
    status: str | None = Query(None),
    ticket_number: str | None = Query(None),
    meal_type_id: int | None = Query(None),
    student_matricule: str | None = Query(None),
    page_info: PaginationDep = (1, 20),
):
    """Réservé au personnel : recherche et supervision."""
    page, page_size = page_info
    service = TicketService(db, settings)
    items, total = await service.list_all(
        user,
        status=status,
        ticket_number=ticket_number,
        meal_type_id=meal_type_id,
        student_matricule=student_matricule,
        page=page,
        page_size=page_size,
    )
    return _page(items, total, page, page_size)


@router.get(
    "/{ticket_number}",
    response_model=TicketOut,
    summary="Détail d'un ticket",
)
async def get_ticket(ticket_number: str, db: DbSession, user: CurrentUserDep) -> TicketOut:
    """Détail complet, `qr_payload` inclus (nécessaire à l'affichage du QR)."""
    return await TicketService(db, settings).get(ticket_number, user)


@router.get("/{ticket_number}/pdf", summary="Télécharger le PDF d'un ticket")
async def download_pdf(ticket_number: str, db: DbSession, user: CurrentUserDep):
    """Redirige vers une URL signée valable quelques minutes.

    `Cache-Control: no-store` : aucun ticket ne doit finir dans un cache.
    """
    url = await TicketService(db, settings).pdf_url(ticket_number, user)
    return {"url": url, "expires_in_seconds": getattr(settings, "SIGNED_URL_TTL_SECONDS", 300)}


# ---------------------------------------------------------------------------
# Consommation (scan au restaurant)
# ---------------------------------------------------------------------------


@router.post(
    "/consume",
    response_model=ConsumeTicketOut,
    summary="Consommer un ticket (scan QR)",
)
async def consume_ticket(
    payload: ConsumeTicketIn,
    db: DbSession,
    user: StaffDep,
    request: Request,
) -> ConsumeTicketOut:
    """Consomme un ticket à partir du QR scanné ou du numéro saisi.

    La signature HMAC est vérifiée avant tout accès base ; la fonction SQL
    refuse les doubles scans et les tickets expirés.

    Erreurs : `401 QR_INVALID`, `409 TICKET_ALREADY_USED`,
    `410 TICKET_EXPIRED`, `404 TICKET_NOT_FOUND`, `429 RATE_LIMITED`.
    """
    return await TicketService(db, settings).consume(payload, user, request_context(request))


# ---------------------------------------------------------------------------
# Annulation (administrateur)
# ---------------------------------------------------------------------------


@router.post(
    "/{ticket_number}/void",
    response_model=TicketOut,
    summary="Annuler un ticket frauduleux",
)
async def void_ticket(
    ticket_number: str,
    payload: VoidTicketIn,
    db: DbSession,
    user: AdminDep,
) -> TicketOut:
    """Réservé à l'administrateur. Refusé si le ticket est déjà `USED`."""
    return await TicketService(db, settings).void(ticket_number, payload, user)


# ---------------------------------------------------------------------------
# Tâche planifiée
# ---------------------------------------------------------------------------


@router.post(
    "/internal/expire",
    include_in_schema=False,
    summary="Expirer les tickets périmés (tâche planifiée)",
)
async def expire_tickets(db: DbSession, cron_secret: str | None = Query(None, alias="secret")):
    """Appelé par un cron quotidien. Protégé par un secret partagé."""
    expected = getattr(settings, "CRON_SECRET", None)
    if not expected or cron_secret != expected:
        raise HTTPException(status_code=403, detail="Secret cron invalide")

    from sqlalchemy import text

    result = await db.execute(text("select public.fn_expire_tickets('system:cron')"))
    await db.commit()
    return {"expired_count": result.scalar_one()}


__all__ = ["Response", "Depends", "date"]