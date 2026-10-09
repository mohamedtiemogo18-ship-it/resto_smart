"""Configuration des tests.

Les variables d'environnement sont définies AVANT l'import de `app` : la
configuration est un singleton évalué à l'import du module.

Les tests métier critiques vérifient que les règles sont appliquées :
idempotence du paiement, refus du double scan, QR falsifié rejeté.
"""

import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("QR_SECRET", "cle-secrete-de-test-32-caracteres")
os.environ.setdefault("QR_SECRET_VERSION", "1")
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("BACKEND_CORS_ORIGINS", "http://localhost:3000")

from unittest.mock import MagicMock  # noqa: E402

import pytest  # noqa: E402


@pytest.fixture
def qr_settings():
    """Réglages minimaux pour tester le service QR."""
    settings = MagicMock()
    settings.QR_SECRET = "cle-secrete-de-test-32-caracteres"
    settings.QR_SECRET_VERSION = 1
    return settings


@pytest.fixture
def pdf_settings():
    """Réglages minimaux pour tester le service PDF."""
    settings = MagicMock()
    settings.PDF_PER_PAGE = 4
    settings.PDF_PAGE_SIZE = "A5"
    settings.SIGNATURE_IMAGE_PATH = None
    settings.CACHET_IMAGE_PATH = None
    settings.RESTO_IDENTITY = {"name": "Test Resto", "city": "Testville"}
    return settings