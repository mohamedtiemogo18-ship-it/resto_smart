"""Tests de l'enveloppe de réponse.

Le contrat est : toute réponse métier est `{"success": true, "data": ...}`
ou `{"success": false, "error": {...}}`. Ces tests verrouillent ce contrat,
car son absence provoque une boucle de redirections infinie côté frontend
(le client lit `body.data`, qui vaut `undefined` si l'enveloppe manque).
"""

import os

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="Nécessite la configuration de l'application",
)


@pytest.fixture
def client():
    from app.main import app

    return TestClient(app)


@pytest.fixture
def admin_client(client):
    """Client avec un utilisateur admin et une base simulée."""
    from unittest.mock import AsyncMock, MagicMock

    from app.api import deps
    from app.models.profile import UserRole
    from app.schemas.user import CurrentUser

    user = CurrentUser(
        id="11111111-1111-1111-1111-111111111111",
        role=UserRole.ADMIN,
        full_name="Test Admin",
        is_active=True,
    )

    db = AsyncMock()
    db.commit = AsyncMock()
    db.flush = AsyncMock()
    result = MagicMock()
    result.scalar_one = MagicMock(return_value=0)
    result.all = MagicMock(return_value=[])
    db.execute = AsyncMock(return_value=result)

    async def fake_db():
        yield db

    client.app.dependency_overrides[deps.current_user] = lambda: user
    client.app.dependency_overrides[deps.get_db] = fake_db

    yield client

    client.app.dependency_overrides.clear()


class TestEnveloppe:
    def test_succes_est_enveloppe(self, admin_client):
        res = admin_client.get("/api/v1/admin/audit")

        assert res.status_code == 200
        body = res.json()
        assert body["success"] is True
        assert "data" in body

    def test_content_length_est_recalcule(self, admin_client):
        """Envelopper change la taille du corps : l'en-tête doit suivre.

        Un `content-length` d'origine conservé provoque
        `Response content longer than Content-Length` et coupe la réponse.
        """
        res = admin_client.get("/api/v1/admin/audit")

        length = res.headers.get("content-length")
        assert length is not None, "content-length absent"
        assert int(length) == len(res.content), (
            f"content-length={length} mais corps={len(res.content)} octets"
        )

    def test_erreur_est_enveloppee_une_seule_fois(self, client):
        res = client.get("/api/v1/admin/audit")

        assert res.status_code == 401
        body = res.json()
        assert body["success"] is False
        assert "error" in body
        # Le double enveloppement donnerait data.error au lieu de error
        assert "data" not in body

    def test_health_reste_brut(self, client):
        res = client.get("/health")

        body = res.json()
        assert "success" not in body, "/health ne doit pas être enveloppé"
        assert "status" in body
        assert int(res.headers["content-length"]) == len(res.content)

    def test_openapi_reste_brut(self, client):
        res = client.get("/openapi.json")

        body = res.json()
        assert "success" not in body, "/openapi.json ne doit pas être enveloppé"
        assert "paths" in body

    def test_racine_reste_brute(self, client):
        body = client.get("/").json()

        assert "success" not in body
        assert "app" in body

    def test_profil_renvoye_dans_data(self, admin_client):
        """Le frontend lit `body.data` : sans enveloppe, la page boucle."""
        res = admin_client.get("/api/v1/auth/me")

        assert res.status_code == 200
        data = res.json()["data"]
        assert data["role"] == "admin"
        assert data["full_name"] == "Test Admin"
