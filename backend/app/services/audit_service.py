"""Service d'audit.

Deux voies : la fonction SQL `fn_audit` (utilisée par les opérations métier,
donc tracée même si le backend plante) et l'insertion directe pour les
événements propres à l'API (connexion refusée, import, etc.).
"""

import json

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.schemas.user import CurrentUser


class AuditService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def record(
        self,
        actor: CurrentUser | None,
        action: str,
        entity_type: str | None = None,
        entity_id: str | None = None,
        metadata: dict | None = None,
        outcome: str = "SUCCESS",
        ip: str | None = None,
        user_agent: str | None = None,
    ) -> None:
        """Écrit une trace dans `audit_logs` via la fonction SQL dédiée."""
        await self._db.execute(
            text("select public.fn_audit(:actor, :action, :etype, :eid, :meta, :outcome, :ip, :ua)"),
            {
                "actor": actor.id if actor else None,
                "action": action,
                "etype": entity_type,
                "eid": entity_id,
                "meta": json.dumps(metadata or {}),
                "outcome": outcome,
                "ip": ip,
                "ua": user_agent,
            },
        )

    async def record_failure(
        self,
        actor: CurrentUser | None,
        action: str,
        entity_type: str | None = None,
        entity_id: str | None = None,
        metadata: dict | None = None,
        ip: str | None = None,
    ) -> None:
        await self.record(
            actor, action, entity_type, entity_id, metadata,
            outcome="FAILURE", ip=ip,
        )

    async def list_logs(
        self,
        action: str | None = None,
        actor_id=None,
        entity_id: str | None = None,
        outcome: str | None = None,
        date_from=None,
        date_to=None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[AuditLog], int]:
        """Liste paginée du journal (lecture seule, réservée à l'admin)."""
        from sqlalchemy import func, select

        stmt = select(AuditLog).order_by(AuditLog.created_at.desc())
        count_stmt = select(func.count()).select_from(AuditLog)

        if action:
            stmt = stmt.where(AuditLog.action == action)
            count_stmt = count_stmt.where(AuditLog.action == action)
        if actor_id:
            stmt = stmt.where(AuditLog.actor_id == actor_id)
            count_stmt = count_stmt.where(AuditLog.actor_id == actor_id)
        if entity_id:
            stmt = stmt.where(AuditLog.entity_id == entity_id)
            count_stmt = count_stmt.where(AuditLog.entity_id == entity_id)
        if outcome:
            stmt = stmt.where(AuditLog.outcome == outcome)
            count_stmt = count_stmt.where(AuditLog.outcome == outcome)
        if date_from:
            stmt = stmt.where(AuditLog.created_at >= date_from)
            count_stmt = count_stmt.where(AuditLog.created_at >= date_from)
        if date_to:
            stmt = stmt.where(AuditLog.created_at <= date_to)
            count_stmt = count_stmt.where(AuditLog.created_at <= date_to)

        total = (await self._db.execute(count_stmt)).scalar_one()
        result = await self._db.execute(stmt.offset((page - 1) * page_size).limit(page_size))
        return list(result.scalars().all()), total