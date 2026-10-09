"""Consultation du journal d'audit — réservée à l'administrateur.

Aucune route d'écriture n'existe ici : le journal est immuable par
conception (règle 10). Le trigger `audit_logs_no_update/no_delete` et les
privilèges révoqués l'interdisent en base.
"""

from datetime import datetime

from fastapi import APIRouter, Query

from app.api.deps import AdminDep, DbSession, PaginationDep
from app.schemas.common import Pagination
from app.schemas.report import AuditLogOut
from app.services.audit_service import AuditService

router = APIRouter(prefix="/admin/audit", tags=["Admin — Audit"])


@router.get("", summary="Journal d'audit")
async def list_audit(
    db: DbSession,
    user: AdminDep,
    action: str | None = Query(None, description="ex. payment.confirm"),
    entity_id: str | None = Query(None),
    outcome: str | None = Query(None, description="SUCCESS | FAILURE"),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    page_info: PaginationDep = (1, 50),
):
    """Journal paginé des opérations sensibles.

    Actions tracées : `reservation.create`, `reservation.cancel`,
    `payment.confirm`, `ticket.consume`, `ticket.expire`, `ticket.void`,
    `price.update`, `user.create`, `user.update`, `settings.update`,
    `auth.login_failed`.
    """
    page, page_size = page_info
    service = AuditService(db)
    logs, total = await service.list_logs(
        action=action,
        entity_id=entity_id,
        outcome=outcome,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )
    return {
        "items": [_to_out(log) for log in logs],
        "pagination": Pagination.build(total, page, page_size).model_dump(),
    }


def _to_out(log) -> AuditLogOut:
    return AuditLogOut(
        id=log.id,
        actor_id=log.actor_id,
        actor_label=log.actor_label,
        action=log.action,
        entity_type=log.entity_type,
        entity_id=log.entity_id,
        outcome=log.outcome,
        metadata=log.metadata,
        ip=log.ip,
        created_at=log.created_at,
    )