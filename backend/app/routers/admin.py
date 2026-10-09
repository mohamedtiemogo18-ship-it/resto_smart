"""Comptes utilisateurs — réservé à l'administrateur.

Pas d'inscription libre : l'admin crée les comptes ou les importe en lot
avec matricule et chambre (hypothèse étape 1.6).
"""

import uuid

from fastapi import APIRouter, Depends, Query, Request, UploadFile, File

from app.api.deps import AdminDep, DbSession, PaginationDep, request_context
from app.config import settings
from app.schemas.common import Pagination
from app.schemas.user import (
    UserCreate,
    UserImportIn,
    UserImportOut,
    UserOut,
    UserUpdate,
)

router = APIRouter(prefix="/admin/users", tags=["Admin — Comptes"])


def _page(items: list, total: int, page: int, page_size: int) -> dict:
    return {
        "items": items,
        "pagination": Pagination.build(total, page, page_size).model_dump(),
    }


@router.post("", response_model=UserOut, status_code=201, summary="Créer un compte")
async def create_user(payload: UserCreate, db: DbSession, user: AdminDep, request: Request):
    """Crée le compte Supabase Auth puis le profil applicatif.

    Erreurs : `422 VALIDATION_ERROR` (étudiant sans matricule ou chambre),
    `409 EMAIL_ALREADY_EXISTS`, `409 MATRICULE_ALREADY_EXISTS`.
    """
    from app.services.user_service import UserService

    return await UserService(db, settings).create(payload, user, request_context(request))


@router.post(
    "/import",
    response_model=UserImportOut,
    summary="Importer des comptes en lot",
)
async def import_users(payload: UserImportIn, db: DbSession, user: AdminDep):
    """Import de comptes pour la rentrée universitaire.

    Les lignes invalides sont ignorées et rapportées : une erreur n'annule
    pas tout le lot.
    """
    from app.services.user_service import UserService

    return await UserService(db, settings).import_rows(payload, user)


@router.get("", summary="Lister les comptes")
async def list_users(
    db: DbSession,
    user: AdminDep,
    role: str | None = Query(None),
    search: str | None = Query(None),
    is_active: bool | None = Query(None),
    page_info: PaginationDep = (1, 20),
):
    """Liste paginée avec recherche sur nom et matricule."""
    page, page_size = page_info
    from app.services.user_service import UserService

    items, total = await UserService(db, settings).list_users(
        role=role, search=search, is_active=is_active, page=page, page_size=page_size
    )
    return _page(items, total, page, page_size)


@router.get("/{user_id}", response_model=UserOut, summary="Détail d'un compte")
async def get_user(user_id: uuid.UUID, db: DbSession, user: AdminDep) -> UserOut:
    from app.services.user_service import UserService

    return await UserService(db, settings).get(user_id)


@router.patch("/{user_id}", response_model=UserOut, summary="Modifier un compte")
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    db: DbSession,
    user: AdminDep,
):
    """Modification du rôle, de l'activation, des informations.

    `422 CANNOT_DEMOTE_SELF` : un admin ne peut pas se retirer lui-même le
    rôle admin. `403 ROLE_CHANGE_FORBIDDEN` est aussi levé par le trigger SQL.
    """
    from app.services.user_service import UserService

    return await UserService(db, settings).update(user_id, payload, user)


@router.delete("/{user_id}", summary="Désactiver un compte")
async def deactivate_user(user_id: uuid.UUID, db: DbSession, user: AdminDep):
    """Désactivation logique, jamais de suppression : l'historique des ventes
    doit rester exploitable."""
    from app.services.user_service import UserService

    return await UserService(db, settings).deactivate(user_id, user)


@router.post("/{user_id}/password", summary="Réinitialiser un mot de passe")
async def reset_password(user_id: uuid.UUID, db: DbSession, user: AdminDep):
    """Envoie un lien de réinitialisation par e-mail."""
    from app.services.user_service import UserService

    return await UserService(db, settings).reset_password(user_id)


__all__ = ["UploadFile", "File", "Depends"]