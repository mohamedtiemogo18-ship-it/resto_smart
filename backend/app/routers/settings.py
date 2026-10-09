"""Réglages : identité du restaurant, signature, cachet, validité des tickets."""

from fastapi import APIRouter, File, UploadFile

from app.api.deps import AdminDep, CurrentUserDep, DbSession
from app.config import settings
from app.schemas.report import SettingUpdateIn, SettingsOut
from app.services.settings_service import SettingsService

router = APIRouter(prefix="/admin/settings", tags=["Admin — Réglages"])


@router.get("", response_model=list[SettingsOut], summary="Réglages non sensibles")
async def list_settings(db: DbSession, user: CurrentUserDep) -> list[SettingsOut]:
    """Paramètres visibles par tout utilisateur connecté.

    Les chemins de la signature et du cachet ne sont **pas** renvoyés aux
    étudiants : ils sont filtrés par la liste des clés publiques.
    """
    return await SettingsService(db, settings).list_public()


@router.get("/{key}", response_model=SettingsOut, summary="Un réglage précis")
async def get_setting(key: str, db: DbSession, user: CurrentUserDep) -> SettingsOut:
    return await SettingsService(db, settings).get_public(key)


@router.put("/{key}", response_model=SettingsOut, summary="Modifier un réglage")
async def update_setting(
    key: str, payload: SettingUpdateIn, db: DbSession, user: AdminDep
) -> SettingsOut:
    """Réservé à l'administrateur.

    Clés courantes : `resto.identity`, `tickets.validity_days`,
    `tickets.pdf_template`.
    """
    return await SettingsService(db, settings).update(key, payload, user)


@router.post("/signature", summary="Déposer l'image de signature")
async def upload_signature(
    db: DbSession,
    user: AdminDep,
    file: UploadFile = File(..., description="PNG, JPG ou WebP, 2 Mo maximum"),
):
    """L'image alimente l'en-tête des PDF de tickets.

    Erreurs : `422 IMAGE_TOO_LARGE`, `422 UNSUPPORTED_MEDIA_TYPE`.
    """
    return await SettingsService(db, settings).upload_image("signature", file, user)


@router.post("/cachet", summary="Déposer l'image du cachet")
async def upload_cachet(
    db: DbSession,
    user: AdminDep,
    file: UploadFile = File(..., description="PNG, JPG ou WebP, 2 Mo maximum"),
):
    """L'image alimente le bas des PDF de tickets."""
    return await SettingsService(db, settings).upload_image("cachet", file, user)