"""Service des repas et des tarifs."""

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Conflict, NotFound
from app.models.meal import MealPrice, MealType
from app.models.profile import Profile
from app.schemas.meal import MealWithPrice, PriceHistoryOut, PriceOut, PriceUpdateIn
from app.schemas.user import CurrentUser


class MealService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def list_meals(self, include_inactive: bool = False) -> list[MealWithPrice]:
        """Repas avec leur prix courant.

        Règle 2 : le prix vient toujours de la base, jamais du client.
        """
        stmt = select(MealType).order_by(MealType.display_order)
        if not include_inactive:
            stmt = stmt.where(MealType.is_active.is_(True))

        result = await self._db.execute(stmt)
        meals = list(result.scalars().all())

        current_prices = await self._current_prices()
        out: list[MealWithPrice] = []
        for meal in meals:
            price = current_prices.get(meal.id)
            out.append(
                MealWithPrice(
                    id=meal.id,
                    code=meal.code,
                    name=meal.name,
                    description=meal.description,
                    display_order=meal.display_order,
                    is_active=meal.is_active,
                    price=PriceOut.model_validate(price) if price else None,
                )
            )
        return out

    async def current_price(self, meal_type_id: int) -> MealPrice | None:
        prices = await self._current_prices()
        return prices.get(meal_type_id)

    async def require_price(self, meal_type_id: int) -> MealPrice:
        price = await self.current_price(meal_type_id)
        if price is None:
            raise NotFound(
                f"Aucun prix en vigueur pour le repas {meal_type_id}",
                code="MEAL_NOT_FOUND",
            )
        return price

    async def price_history(self, meal_type_id: int) -> PriceHistoryOut:
        meal = await self._db.get(MealType, meal_type_id)
        if meal is None:
            raise NotFound("Repas inconnu", code="MEAL_NOT_FOUND")

        result = await self._db.execute(
            select(MealPrice)
            .where(MealPrice.meal_type_id == meal_type_id)
            .order_by(MealPrice.effective_from.desc())
        )
        prices = list(result.scalars().all())
        return PriceHistoryOut(
            meal_type_id=meal.id,
            meal_name=meal.name,
            prices=[self._to_out(p) for p in prices],
        )

    async def update_price(
        self, meal_type_id: int, payload: PriceUpdateIn, actor: CurrentUser
    ) -> PriceOut:
        """Ouvre une nouvelle période de prix.

        Le prix courant est clôturé (`effective_to`), jamais modifié : c'est
        ce qui garantit que l'historique reste intact (règle 3).
        """
        async with self._db.begin_nested():
            meal = await self._db.get(MealType, meal_type_id)
            if meal is None:
                raise NotFound("Repas inconnu", code="MEAL_NOT_FOUND")

            if payload.effective_from < date.today():
                raise Conflict(
                    "PRICE_DATE_PAST",
                    "La date de prise d'effet ne peut pas être dans le passé.",
                )

            # Clôture du prix courant
            current = await self._db.execute(
                select(MealPrice)
                .where(
                    MealPrice.meal_type_id == meal_type_id,
                    MealPrice.effective_to.is_(None),
                )
                .with_for_update()
            )
            current_price = current.scalar_one_or_none()

            if current_price is not None:
                if payload.effective_from <= current_price.effective_from:
                    raise Conflict(
                        "PRICE_PERIOD_OVERLAP",
                        "Ce prix chevauche une période existante.",
                        {"current_from": str(current_price.effective_from)},
                    )
                current_price.effective_to = payload.effective_from

            # Le nouvel id est produit par gen_random_uuid() côté base
            new_price = MealPrice(
                meal_type_id=meal_type_id,
                amount=payload.amount,
                effective_from=payload.effective_from,
                effective_to=None,
                created_by=actor.id,
            )
            self._db.add(new_price)
            await self._db.flush()

            from app.services.audit_service import AuditService

            await AuditService(self._db).record(
                actor,
                "price.update",
                "meal_type",
                str(meal_type_id),
                {
                    "amount": str(payload.amount),
                    "effective_from": str(payload.effective_from),
                    "reason": payload.reason,
                    "previous_price_id": str(current_price.id) if current_price else None,
                },
            )

            await self._db.refresh(new_price)
            return self._to_out(new_price)

    async def _current_prices(self) -> dict[int, MealPrice]:
        result = await self._db.execute(
            select(MealPrice)
            .where(
                MealPrice.effective_to.is_(None),
                MealPrice.effective_from <= date.today(),
            )
            .order_by(MealPrice.effective_from.desc())
        )
        prices: dict[int, MealPrice] = {}
        for price in result.scalars().all():
            prices.setdefault(price.meal_type_id, price)
        return prices

    @staticmethod
    def _to_out(price: MealPrice) -> PriceOut:
        return PriceOut(
            id=str(price.id),
            amount=price.amount,
            currency=price.currency,
            effective_from=price.effective_from,
            effective_to=price.effective_to,
            is_current=price.effective_to is None,
        )


__all__ = ["MealService", "Profile"]