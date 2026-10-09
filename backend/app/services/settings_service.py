"""Réglages de l'application : identité, signature, cachet, validité."""

from fastapi import UploadFile

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BusinessError, Conflict, NotFound
from app.models.settings import AppSetting
from app.schemas.report import SettingUpdateIn, SettingsOut
from app.services.audit_service import AuditService
from app.services.storage_service import StorageService

#: Clés visibles par tous les utilisateurs connectés
PUBLIC_KEYS = {
    "resto.identity",
    "tickets.validity_days",
    "tickets.pdf_template",
    "qr.secret_version",
}

#: Clés réservées à l'administrateur (chemins d'images)
PRIVATE_KEYS = {
    "signature.image_path",
    "cachet.image_path",
}

ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp"}
MAX_IMAGE_BYTES = 2 * 1024 * 1024


class SettingsService:
    def __init__(self, db: AsyncSession, settings) -> None:
        self._db = db
        self._settings = settings

    # ------------------------------------------------------------------
    # Lecture
    # ------------------------------------------------------------------

    async def list_public(self) -> list[SettingsOut]:
        result = await self._db.execute(
            select(AppSetting).where(AppSetting.key.in_(PUBLIC_KEYS))
        )
        return [self._to_out(s) for s in result.scalars().all()]

    async def get_public(self, key: str) -> SettingsOut:
        if key in PRIVATE_KEYS:
            raise NotFound("Réglage inconnu", code="SETTING_NOT_FOUND")
        setting = await self._db.get(AppSetting, key)
        if setting is None:
            raise NotFound("Réglage inconnu", code="SETTING_NOT_FOUND")
        return self._to_out(setting)

    async def get_value(self, key: str, default=None):
        """Lecture interne d'une valeur, sans filtrage de visibilité."""
        setting = await self._db.get(AppSetting, key)
        return setting.value if setting else default

    # ------------------------------------------------------------------
    # Écriture
    # ------------------------------------------------------------------

    async def update(self, key: str, payload: SettingUpdateIn, actor) -> SettingsOut:
        if key in PUBLIC_KEYS:
            raise Conflict(
                "SETTING_READONLY",
                "Ce réglage est calculé et ne peut pas être modifié directement.",
            )

        setting = await self._db.get(AppSetting, key)
        if setting is None:
            raise NotFound("Réglage inconnu", code="SETTING_NOT_FOUND")

        setting.value = payload.value
        setting.updated_by = actor.id
        await self._db.flush()

        await AuditService(self._db).record(
            actor, "settings.update", "app_setting", key, {"value": payload.value}
        )
        await self._db.commit()
        await self._db.refresh(setting)
        return self._to_out(setting)

    async def upload_image(self, kind: str, file: UploadFile, actor) -> dict:
        """Dépose la signature ou le cachet dans Storage et mémorise le chemin.

        Erreurs : `422 UNSUPPORTED_MEDIA_TYPE`, `422 IMAGE_TOO_LARGE`.
        """
        if file.content_type not in ALLOWED_IMAGE_TYPES:
            raise BusinessError(
                "UNSUPPORTED_MEDIA_TYPE",
                f"Format non supporté : {file.content_type}. Acceptés : PNG, JPG, WebP.",
                422,
            )

        content = await file.read()
        if len(content) > MAX_IMAGE_BYTES:
            raise BusinessError("IMAGE_TOO_LARGE", "L'image dépasse 2 Mo", 422)

        extension = file.filename.rsplit(".", 1)[-1].lower() if file.filename else "png"
        name = f"{kind}.{extension}"

        storage = StorageService(self._settings)
        path = await storage.upload_image(name, content, file.content_type)

        setting_key = f"{kind}.image_path"
        setting = await self._db.get(AppSetting, setting_key)
        if setting is None:
            setting = AppSetting(key=setting_key, value={"path": path})
            self._db.add(setting)
        else:
            setting.value = {"path": path}
        setting.updated_by = actor.id

        await self._db.flush()
        await AuditService(self._db).record(
            actor, "settings.update", "app_setting", setting_key, {"path": path}
        )
        await self._db.commit()

        return {"status": "uploaded", "kind": kind, "path": path}

    # ------------------------------------------------------------------

    @staticmethod
    def _to_out(setting: AppSetting) -> SettingsOut:
        return SettingsOut(key=setting.key, value=setting.value)


__all__ = ["UploadFile"]