"""Service d'authentification : résout le profil applicatif depuis le JWT."""

import time
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Forbidden, Unauthorized
from app.core.security import verify_jwt
from app.models.profile import Profile
from app.schemas.user import CurrentUser

#: Profils résolus récemment : user_id -> (expiration_unix, CurrentUser)
#: Les pages du frontend peuvent déclencher plusieurs appels coup sur coup ;
#: sans ce cache, chacun coûte une requête SQL.
_PROFILE_CACHE: dict[uuid.UUID, tuple[float, CurrentUser]] = {}
_PROFILE_CACHE_TTL = 60


class AuthService:
    def __init__(self, db: AsyncSession, settings) -> None:
        self._db = db
        self._settings = settings

    async def resolve_user(self, token: str) -> CurrentUser:
        """Vérifie le JWT puis charge le profil correspondant."""
        claims = verify_jwt(token, self._settings.SUPABASE_URL)
        sub = claims.get("sub")
        if not sub:
            raise Unauthorized("Jeton sans identifiant d'utilisateur")

        try:
            user_id = uuid.UUID(sub)
        except ValueError as exc:
            raise Unauthorized("Identifiant d'utilisateur invalide") from exc

        cached = _PROFILE_CACHE.get(user_id)
        if cached and cached[0] > time.time():
            return cached[1]

        profile = await self._load_profile(user_id)
        if profile is None:
            raise Unauthorized("Compte inconnu", code="ACCOUNT_UNKNOWN")
        if not profile.is_active:
            raise Forbidden("Compte désactivé par l'administrateur", code="ACCOUNT_DISABLED")

        current = CurrentUser(
            id=profile.id,
            role=profile.role,
            matricule=profile.matricule,
            full_name=profile.full_name,
            room=profile.room,
            is_active=profile.is_active,
        )

        exp = claims.get("exp")
        ttl = (
            min(_PROFILE_CACHE_TTL, (exp - int(time.time())))
            if isinstance(exp, (int, float))
            else _PROFILE_CACHE_TTL
        )
        if ttl > 0:
            _PROFILE_CACHE[user_id] = (time.time() + ttl, current)

        return current

    async def _load_profile(self, user_id: uuid.UUID) -> Profile | None:
        result = await self._db.execute(select(Profile).where(Profile.id == user_id))
        return result.scalar_one_or_none()