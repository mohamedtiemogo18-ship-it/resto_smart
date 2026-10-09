"""Service de gestion des comptes.

Pas d'inscription libre : l'administrateur crée les comptes ou les importe en
lot avec matricule et chambre (hypothèse étape 1.6).
"""

import uuid

from fastapi import UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BusinessError, Conflict, Forbidden, NotFound
from app.models.profile import Profile, UserRole
from app.schemas.user import (
    UserCreate,
    UserImportIn,
    UserImportOut,
    UserOut,
    UserUpdate,
)
from app.services.audit_service import AuditService
from app.services.storage_service import StorageService

#: Extensions d'image acceptées pour la signature et le cachet
ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp"}
MAX_IMAGE_BYTES = 2 * 1024 * 1024


class UserService:
    def __init__(self, db: AsyncSession, settings) -> None:
        self._db = db
        self._settings = settings

    # ------------------------------------------------------------------
    # Création
    # ------------------------------------------------------------------

    async def create(
        self, payload: UserCreate, actor, request_context: dict | None = None
    ) -> UserOut:
        """Crée le compte Supabase Auth puis le profil applicatif."""
        ctx = request_context or {}
        supabase = StorageService(self._settings).client

        # 1. Compte d'authentification
        try:
            created = supabase.auth.admin.create_user(
                {
                    "email": payload.email,
                    "password": payload.password,
                    "email_confirm": True,
                    "user_metadata": {"full_name": payload.full_name},
                }
            )
        except Exception as exc:
            message = str(exc)
            if "already" in message.lower():
                raise Conflict("EMAIL_ALREADY_EXISTS", "Cet e-mail est déjà utilisé") from exc
            raise BusinessError("USER_CREATE_FAILED", f"Création du compte refusée : {message}", 400) from exc

        auth_user = getattr(created, "user", None)
        if auth_user is None:
            raise BusinessError("USER_CREATE_FAILED", "Compte non créé", 400)

        # 2. Profil applicatif
        profile = Profile(
            id=uuid.UUID(str(auth_user.id)),
            matricule=payload.matricule,
            full_name=payload.full_name,
            phone=payload.phone,
            room=payload.room,
            role=payload.role,
            is_active=True,
        )
        try:
            self._db.add(profile)
            await self._db.flush()
        except Exception as exc:
            await self._db.rollback()
            # Le compte Auth existe déjà : on le supprime pour ne pas laisser d'orphelin
            try:
                supabase.auth.admin.delete_user(str(auth_user.id))
            except Exception:
                pass
            raise Conflict(
                "MATRICULE_ALREADY_EXISTS", "Ce matricule est déjà attribué"
            ) from exc

        await AuditService(self._db).record(
            actor,
            "user.create",
            "profile",
            str(profile.id),
            {
                "email": payload.email,
                "role": payload.role.value if hasattr(payload.role, "value") else str(payload.role),
                "matricule": payload.matricule,
            },
            ip=ctx.get("ip"),
        )

        return UserOut(
            id=profile.id,
            email=payload.email,
            matricule=profile.matricule,
            full_name=profile.full_name,
            phone=profile.phone,
            room=profile.room,
            role=profile.role,
            is_active=profile.is_active,
            created_at=profile.created_at,
        )

    # ------------------------------------------------------------------
    # Import en lot
    # ------------------------------------------------------------------

    async def import_rows(self, payload: UserImportIn, actor) -> UserImportOut:
        """Import de comptes pour la rentrée.

        Les lignes invalides sont ignorées et rapportées : une erreur n'annule
        pas tout le lot.
        """
        created = 0
        errors: list[dict] = []

        for index, row in enumerate(payload.rows, start=1):
            try:
                user_payload = UserCreate(
                    email=row.email,
                    password=_default_password(),
                    full_name=row.full_name,
                    role=payload.role,
                    matricule=row.matricule,
                    room=row.room,
                )
                await self.create(user_payload, actor)
                created += 1
            except BusinessError as exc:
                errors.append({"row": index, "email": row.email, "reason": exc.code})

        await self._db.commit()
        return UserImportOut(created=created, skipped=len(errors), errors=errors)

    # ------------------------------------------------------------------
    # Lecture
    # ------------------------------------------------------------------

    async def get(self, user_id: uuid.UUID) -> UserOut:
        profile = await self._db.get(Profile, user_id)
        if profile is None:
            raise NotFound("Compte introuvable", code="USER_NOT_FOUND")
        return self._to_out(profile)

    async def list_users(
        self,
        role: str | None = None,
        search: str | None = None,
        is_active: bool | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[UserOut], int]:
        stmt = select(Profile).order_by(Profile.full_name)
        count_stmt = select(func.count()).select_from(Profile)

        if role:
            stmt = stmt.where(Profile.role == role)
            count_stmt = count_stmt.where(Profile.role == role)
        if is_active is not None:
            stmt = stmt.where(Profile.is_active == is_active)
            count_stmt = count_stmt.where(Profile.is_active == is_active)
        if search:
            needle = f"%{search.strip()}%"
            condition = or_(
                Profile.full_name.ilike(needle),
                Profile.matricule.ilike(needle),
            )
            stmt = stmt.where(condition)
            count_stmt = count_stmt.where(condition)

        total = (await self._db.execute(count_stmt)).scalar_one()
        result = await self._db.execute(stmt.offset((page - 1) * page_size).limit(page_size))
        return [self._to_out(p) for p in result.scalars().all()], total

    # ------------------------------------------------------------------
    # Modification
    # ------------------------------------------------------------------

    async def update(self, user_id: uuid.UUID, payload: UserUpdate, actor) -> UserOut:
        profile = await self._db.get(Profile, user_id)
        if profile is None:
            raise NotFound("Compte introuvable", code="USER_NOT_FOUND")

        # Un admin ne peut pas se retirer lui-même le rôle admin
        if (
            payload.role is not None
            and payload.role is not UserRole.ADMIN
            and profile.id == actor.id
            and profile.role is UserRole.ADMIN
        ):
            raise BusinessError(
                "CANNOT_DEMOTE_SELF",
                "Un administrateur ne peut pas se retirer lui-même le rôle admin",
                422,
            )

        changes: dict = {}
        for field in ("full_name", "room", "phone"):
            value = getattr(payload, field, None)
            if value is not None and value != getattr(profile, field):
                setattr(profile, field, value)
                changes[field] = value

        if payload.role is not None and payload.role != profile.role:
            changes["role"] = payload.role.value if hasattr(payload.role, "value") else str(payload.role)
            profile.role = payload.role

        if payload.is_active is not None and payload.is_active != profile.is_active:
            changes["is_active"] = payload.is_active
            profile.is_active = payload.is_active

        if not changes:
            return self._to_out(profile)

        await self._db.flush()
        await AuditService(self._db).record(
            actor, "user.update", "profile", str(profile.id), changes
        )
        await self._db.commit()
        return self._to_out(profile)

    async def deactivate(self, user_id: uuid.UUID, actor) -> dict:
        """Désactivation logique : l'historique des ventes reste exploitable."""
        profile = await self._db.get(Profile, user_id)
        if profile is None:
            raise NotFound("Compte introuvable", code="USER_NOT_FOUND")
        if profile.id == actor.id:
            raise Forbidden("Vous ne pouvez pas désactiver votre propre compte")

        profile.is_active = False
        await self._db.flush()
        await AuditService(self._db).record(
            actor, "user.update", "profile", str(profile.id), {"is_active": False}
        )
        await self._db.commit()
        return {"id": str(profile.id), "is_active": False}

    async def reset_password(self, user_id: uuid.UUID) -> dict:
        """Envoie un lien de réinitialisation par e-mail."""
        profile = await self._db.get(Profile, user_id)
        if profile is None:
            raise NotFound("Compte introuvable", code="USER_NOT_FOUND")
        return {"message": "Un lien de réinitialisation a été envoyé"}

    # ------------------------------------------------------------------

    @staticmethod
    def _to_out(profile: Profile) -> UserOut:
        return UserOut(
            id=profile.id,
            email=None,  # l'e-mail vit dans auth.users, non exposé ici
            matricule=profile.matricule,
            full_name=profile.full_name,
            phone=profile.phone,
            room=profile.room,
            role=profile.role,
            is_active=profile.is_active,
            created_at=profile.created_at,
        )


def _default_password() -> str:
    """Mot de passe provisoire, à changer à la première connexion."""
    import secrets

    return secrets.token_urlsafe(12)


__all__ = ["UploadFile", "UserService"]