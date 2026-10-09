"""Tests des règles de réservation et de traduction des erreurs PostgreSQL."""

from app.core.errors import pg_error_to_business_error


class FakeAsyncPGError(Exception):
    def __init__(self, message: str, pgcode: str | None = None):
        super().__init__(message)
        self.orig = message
        self.pgcode = pgcode


class TestPgErrorMapping:
    """Les codes métier levés par les fonctions SQL deviennent des statuts HTTP."""

    def test_ticket_deja_consomme(self):
        exc = FakeAsyncPGError(
            "TICKET_ALREADY_USED: TKT-2026-000412 a déjà été consommé", "P0001"
        )
        error = pg_error_to_business_error(exc)
        assert error.code == "TICKET_ALREADY_USED"
        assert error.http_status == 409

    def test_ticket_expire_renvoie_410(self):
        exc = FakeAsyncPGError("TICKET_EXPIRED: ticket périmé", "P0001")
        error = pg_error_to_business_error(exc)
        assert error.code == "TICKET_EXPIRED"
        assert error.http_status == 410

    def test_qr_invalide_est_401(self):
        exc = FakeAsyncPGError("QR_INVALID: signature invalide", "P0001")
        error = pg_error_to_business_error(exc)
        assert error.http_status == 401

    def test_reservation_payee_est_definitive(self):
        exc = FakeAsyncPGError("RESERVATION_PAID_FINAL: retour arrière interdit", "P0001")
        error = pg_error_to_business_error(exc)
        assert error.code == "RESERVATION_PAID_FINAL"
        assert error.http_status == 409

    def test_paiement_interdit_a_letudiant(self):
        exc = FakeAsyncPGError("PAYMENT_CONFIRM_FORBIDDEN: rôle insuffisant", "P0001")
        error = pg_error_to_business_error(exc)
        assert error.code == "PAYMENT_CONFIRM_FORBIDDEN"
        assert error.http_status == 409

    def test_violation_unicite(self):
        exc = FakeAsyncPGError("duplicate key value violates unique constraint", "23505")
        error = pg_error_to_business_error(exc)
        assert error.code == "ALREADY_EXISTS"
        assert error.http_status == 409

    def test_erreur_inconnue_ne_fuite_pas_le_detail(self):
        exc = FakeAsyncPGError("something opaque happened", "XX000")
        error = pg_error_to_business_error(exc)
        assert error.code == "DATABASE_ERROR"
        assert error.http_status == 500
        assert "opaque" not in error.message


class TestReservationValidation:
    """Règle 1 : au moins un repas, quantité entre 1 et 99, un seul ligne par repas."""

    def test_reservation_vide_est_refusee(self):
        from pydantic import ValidationError

        from app.schemas.reservation import ReservationCreate

        try:
            ReservationCreate(items=[])
        except ValidationError:
            return
        raise AssertionError("Une réservation sans repas doit être refusée")

    def test_quantite_hors_bornes_est_refusee(self):
        from pydantic import ValidationError

        from app.schemas.reservation import ReservationItemIn

        for quantity in (0, -1, 100):
            try:
                ReservationItemIn(meal_type_id=2, quantity=quantity)
            except ValidationError:
                continue
            raise AssertionError(f"Quantité {quantity} doit être refusée")

    def test_quantites_valides_sont_acceptees(self):
        from app.schemas.reservation import ReservationItemIn

        for quantity in (1, 17, 99):
            item = ReservationItemIn(meal_type_id=2, quantity=quantity)
            assert item.quantity == quantity

    def test_deux_fois_le_meme_repas_est_refuse(self):
        from pydantic import ValidationError

        from app.schemas.reservation import ReservationCreate

        try:
            ReservationCreate(
                items=[
                    {"meal_type_id": 2, "quantity": 5},
                    {"meal_type_id": 2, "quantity": 3},
                ]
            )
        except ValidationError:
            return
        raise AssertionError("Un repas ne peut apparaître qu'une fois")

    def test_dix_repas_differents_sont_acceptes(self):
        from app.schemas.reservation import ReservationCreate

        payload = ReservationCreate(
            items=[{"meal_type_id": i, "quantity": 1} for i in range(1, 11)]
        )
        assert len(payload.items) == 10

    def test_onze_repas_sont_refuses(self):
        from pydantic import ValidationError

        from app.schemas.reservation import ReservationCreate

        try:
            ReservationCreate(
                items=[{"meal_type_id": i, "quantity": 1} for i in range(1, 12)]
            )
        except ValidationError:
            return
        raise AssertionError("Dix types de repas maximum")