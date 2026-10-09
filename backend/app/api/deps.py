"""Dépendances FastAPI : session, utilisateur courant, gardes de rôle.

Ces dépendances sont la deuxième barrière. La première est le middleware
Next.js, la troisième la RLS PostgreSQL et les triggers SQL.
"""

from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.errors import Forbidden, Unauthorized
from app.database import async_session
from app.models.profile import UserRole
from app.schemas.user import CurrentUser
from app.services.auth_service import AuthService

bearer = HTTPBearer(auto_error=False)


async def get_db() -> AsyncSession:
    """Session asynchrone par requête, avec commit/rollback automatique."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


DbSession = Annotated[AsyncSession, Depends(get_db)]


def request_context(request: Request) -> dict:
    """Contexte transmis aux services pour l'audit."""
    return {
        "ip": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
    }


async def current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    db: DbSession,
) -> CurrentUser:
    """Résout l'utilisateur courant depuis le JWT Supabase."""
    if credentials is None or not credentials.credentials:
        raise Unauthorized("Jeton d'accès manquant")
    return await AuthService(db, settings).resolve_user(credentials.credentials)


def require_role(*roles: UserRole):
    """Fabrique une dépendance n'autorisant que les rôles donnés."""

    async def guard(user: CurrentUserDep) -> CurrentUser:
        if user.role not in roles:
            allowed = ", ".join(r.value for r in roles)
            raise Forbidden(f"Rôle requis : {allowed}")
        return user

    return guard


CurrentUserDep = Annotated[CurrentUser, Depends(current_user)]
StudentDep = Annotated[CurrentUser, Depends(require_role(UserRole.STUDENT))]
StaffDep = Annotated[
    CurrentUser, Depends(require_role(UserRole.LOGISTICIAN, UserRole.ADMIN))
]
AdminDep = Annotated[CurrentUser, Depends(require_role(UserRole.ADMIN))]


async def get_pagination(page: int = 1, page_size: int = 20) -> tuple[int, int]:
    return max(page, 1), min(max(page_size, 1), 100)


PaginationDep = Annotated[tuple[int, int], Depends(get_pagination)]


__all__ = [
    "DbSession",
    "CurrentUserDep",
    "StudentDep",
    "StaffDep",
    "AdminDep",
    "PaginationDep",
    "request_context",
]