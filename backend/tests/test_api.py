"""Tests d'intégration de l'API.

L'authentification et la base sont remplacées par des doubles : on vérifie
ainsi le cycle complet requête → garde de rôle → validation → réponse, sans
avoir besoin d'une base réelle.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.profile import UserRole
from app.schemas.user import CurrentUser


STUDENT = CurrentUser(
    id="11111111-1111-1111-1111-111111111111",
    role=UserRole.STUDENT,
    matricule="ETU-2024-0198",
    full_name="Awa Traoré",
    room="B12-204",
    is_active=True,
)

LOGISTICIEN = CurrentUser(
    id="22222222-2222-2222-2222-222222222222",
    role=UserRole.LOGISTICIAN,
    full_name="Ibrahim Koné",
    is_active=True,
)

ADMIN = CurrentUser(
    id="33333333-3333-3333-3333-333333333333",
    role=UserRole.ADMIN,
    full_name="Administrateur",
    is_active=True,
)


def make_client(user: CurrentUser) -> TestClient:
    """Client de test avec l'utilisateur et la base simulés."""
    from app.api import deps

    db = AsyncMock()
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    db.execute = AsyncMock()
    db.add = MagicMock()
    db.get = AsyncMock(return_value=None)

    app.dependency_overrides[deps.current_user] = lambda: user
    app.dependency_overrides[deps.get_db] = lambda: db
    return TestClient(app)


@pytest.fixture(autouse=True)
def clean_overrides():
    yield
    app.dependency_overrides.clear()


class TestSante:
    def test_health_repond_ok(self):
        client = TestClient(app)
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

    def test_route_inconnue_renvoie_404(self):
        client = TestClient(app)
        res = client.get("/api/v1/inexistant")
        assert res.status_code == 404


class TestAuthentification:
    def test_sans_jeton_renvoie_401(self):
        client = TestClient(app)
        res = client.get("/api/v1/auth/me")
        assert res.status_code == 401
        body = res.json()
        assert body["success"] is False
        assert body["error"]["code"] == "AUTH_REQUIRED"

    def test_avec_jeton_renvoie_le_profil(self):
        client = make_client(STUDENT)
        res = client.get("/api/v1/auth/me")
        assert res.status_code == 200
        data = res.json()
        assert data["matricule"] == "ETU-2024-0198"
        assert data["role"] == "student"


class TestReglesDeReservation:
    """Règle 1 : au moins un repas, quantité 1 à 99, un seul ligne par repas."""

    def test_reservation_vide_est_refusee(self):
        client = make_client(STUDENT)
        res = client.post("/api/v1/reservations", json={"items": []})
        assert res.status_code == 422
        assert res.json()["error"]["code"] == "VALIDATION_ERROR"

    def test_quantite_nulle_est_refusee(self):
        client = make_client(STUDENT)
        res = client.post(
            "/api/v1/reservations",
            json={"items": [{"meal_type_id": 2, "quantity": 0}]},
        )
        assert res.status_code == 422

    def test_quantite_trop_grande_est_refusee(self):
        client = make_client(STUDENT)
        res = client.post(
            "/api/v1/reservations",
            json={"items": [{"meal_type_id": 2, "quantity": 100}]},
        )
        assert res.status_code == 422

    def test_meme_repas_deux_fois_est_refuse(self):
        client = make_client(STUDENT)
        res = client.post(
            "/api/v1/reservations",
            json={
                "items": [
                    {"meal_type_id": 2, "quantity": 5},
                    {"meal_type_id": 2, "quantity": 3},
                ]
            },
        )
        assert res.status_code == 422
        champs = res.json()["error"]["details"]["fields"]
        assert any("qu'une fois" in f["message"] for f in champs)

    def test_onze_repas_sont_refuses(self):
        client = make_client(STUDENT)
        res = client.post(
            "/api/v1/reservations",
            json={"items": [{"meal_type_id": i, "quantity": 1} for i in range(1, 12)]},
        )
        assert res.status_code == 422


class TestGardesDeRole:
    """Règle 4 : l'étudiant ne confirme jamais son paiement."""

    def test_etudiant_ne_peut_pas_confirmer_un_paiement(self):
        client = make_client(STUDENT)
        res = client.post("/api/v1/reservations/abc/confirm-payment", json={})
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "ROLE_FORBIDDEN"

    def test_logisticien_peut_confirmer_un_paiement(self):
        client = make_client(LOGISTICIEN)
        with patch("app.services.payment_service.PaymentService.confirm", new=AsyncMock()):
            res = client.post("/api/v1/reservations/abc/confirm-payment", json={})
        # 200 ou 404 selon le mock, mais jamais 403
        assert res.status_code != 403

    def test_etudiant_ne_peut_pas_consommer_un_ticket(self):
        client = make_client(STUDENT)
        res = client.post("/api/v1/tickets/consume", json={"ticket_number": "TKT-2026-000001"})
        assert res.status_code == 403

    def test_logisticien_ne_voit_pas_la_liste_des_comptes(self):
        client = make_client(LOGISTICIEN)
        res = client.get("/api/v1/admin/users")
        assert res.status_code == 403

    def test_admin_voit_la_liste_des_comptes(self):
        client = make_client(ADMIN)
        with patch("app.services.user_service.UserService.list_users", new=AsyncMock(return_value=([], 0))):
            res = client.get("/api/v1/admin/users")
        assert res.status_code == 200

    def test_logisticien_ne_voit_pas_laudit(self):
        client = make_client(LOGISTICIEN)
        res = client.get("/api/v1/admin/audit")
        assert res.status_code == 403


class TestAntiFraudeQR:
    """Un QR falsifié est rejeté avant tout accès à la base."""

    def test_qr_falsifie_est_rejete(self):
        client = make_client(LOGISTICIEN)
        res = client.post(
            "/api/v1/tickets/consume",
            json={"qr_payload": "TKT-2026-000999.1.0000000000000000"},
        )
        assert res.status_code == 401
        assert res.json()["error"]["code"] == "QR_INVALID"

    def test_qr_sans_signature_est_rejete(self):
        client = make_client(LOGISTICIEN)
        res = client.post(
            "/api/v1/tickets/consume",
            json={"qr_payload": "TKT-2026-000412"},
        )
        assert res.status_code == 401

    def test_numero_de_ticket_non_falsifie_passe_le_controle_crypto(self):
        """Un numéro saisi à la main passe le contrôle crypto (aucun HMAC à fournir)."""
        from datetime import datetime, timezone

        from app.models.ticket import TicketStatus
        from app.schemas.ticket import ConsumeTicketOut

        client = make_client(LOGISTICIEN)
        attendu = ConsumeTicketOut(
            ticket_number="TKT-2026-000412",
            status=TicketStatus.USED,
            used_at=datetime.now(timezone.utc),
            meal_name="Déjeuner",
            student_name="Awa Traoré",
            consumed_by="Ibrahim Koné",
        )
        with patch(
            "app.services.ticket_service.TicketService.consume",
            new=AsyncMock(return_value=attendu),
        ):
            res = client.post(
                "/api/v1/tickets/consume",
                json={"ticket_number": "TKT-2026-000412"},
            )
        assert res.status_code == 200
        assert res.json()["ticket_number"] == "TKT-2026-000412"