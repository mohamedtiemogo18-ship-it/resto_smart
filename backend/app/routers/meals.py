"""Repas et tarifs."""

from fastapi import APIRouter, Depends, Query

from app.api.deps import CurrentUserDep, DbSession
from app.schemas.meal import MealWithPrice, PriceHistoryOut, PriceOut, PriceUpdateIn
from app.services.meal_service import MealService

router = APIRouter(prefix="/meals", tags=["Meals"])


@router.get("", response_model=list[MealWithPrice], summary="Repas et prix courants")
async def list_meals(
    db: DbSession,
    user: CurrentUserDep,
    include_inactive: bool = Query(False),
) -> list[MealWithPrice]:
    """Liste les repas avec leur prix en vigueur.

    Règle 2 : le prix vient toujours de la base. Un repas sans prix courant
    renvoie `price: null` et n'est pas réservable.
    """
    return await MealService(db).list_meals(include_inactive=include_inactive)


@router.get(
    "/prices/{meal_type_id}",
    response_model=PriceHistoryOut,
    summary="Historique des prix d'un repas",
)
async def price_history(
    meal_type_id: int,
    db: DbSession,
    user: CurrentUserDep,
) -> PriceHistoryOut:
    """Historique complet des prix, du plus récent au plus ancien."""
    return await MealService(db).price_history(meal_type_id)


@router.put(
    "/prices/{meal_type_id}",
    response_model=PriceOut,
    status_code=200,
    summary="Ouvrir une nouvelle période de prix",
)
async def update_price(
    meal_type_id: int,
    payload: PriceUpdateIn,
    db: DbSession,
    user: CurrentUserDep,
) -> PriceOut:
    """Réservé à l'administrateur.

    Le prix courant n'est jamais modifié : il est clôturé et un nouveau est
    ouvert, ce qui préserve l'historique des ventes (règle 3).

    Erreurs : `409 PRICE_PERIOD_OVERLAP`, `409 PRICE_DATE_PAST`,
    `404 MEAL_NOT_FOUND`.
    """
    return await MealService(db).update_price(meal_type_id, payload, user)


__all__ = ["Depends"]