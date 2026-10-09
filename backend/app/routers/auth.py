"""Authentification — le profil de l'utilisateur connecté.

La connexion elle-même est déléguée à Supabase Auth : le backend ne fait que
vérifier le jeton et exposer le profil applicatif (rôle, matricule, chambre).
"""

from fastapi import APIRouter

from app.api.deps import CurrentUserDep
from app.schemas.user import CurrentUser

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.get("/me", response_model=CurrentUser, summary="Profil de l'utilisateur connecté")
async def me(user: CurrentUserDep) -> CurrentUser:
    """Renvoie le profil applicatif correspondant au jeton fourni.

    Erreurs : `401 AUTH_REQUIRED`, `401 TOKEN_EXPIRED`, `403 ACCOUNT_DISABLED`.
    """
    return user