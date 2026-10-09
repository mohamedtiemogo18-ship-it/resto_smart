"""Tests de sécurité des QR codes.

Un QR falsifié doit être rejeté : c'est la barrière contre la fabrication de
tickets (étape 8.3).
"""

from unittest.mock import MagicMock

from app.services.qr_service import QRService


class TestQRSigner:
    def test_sign_produit_un_payload_structure(self, qr_settings):
        signer = QRService(qr_settings)
        payload = signer.sign("TKT-2026-000412")

        parts = payload.rsplit(".", 2)
        assert len(parts) == 3
        assert parts[0] == "TKT-2026-000412"
        assert parts[1] == "1"
        assert len(parts[2]) == 16

    def test_verify_accepte_un_payload_valide(self, qr_settings):
        signer = QRService(qr_settings)
        payload = signer.sign("TKT-2026-000412")
        assert signer.verify(payload) == "TKT-2026-000412"

    def test_verify_rejette_un_qr_falsifie(self, qr_settings):
        """Le numéro est changé mais la signature ne l'est pas."""
        signer = QRService(qr_settings)
        legitime = signer.sign("TKT-2026-000412")
        number, version, mac = legitime.rsplit(".", 2)

        falsifie = f"TKT-2026-999999.{version}.{mac}"
        assert signer.verify(falsifie) is None

    def test_verify_rejette_une_signature_inventee(self, qr_settings):
        signer = QRService(qr_settings)
        assert signer.verify("TKT-2026-000412.1.0000000000000000") is None

    def test_verify_rejette_un_payload_sans_signature(self, qr_settings):
        signer = QRService(qr_settings)
        assert signer.verify("TKT-2026-000412") is None
        assert signer.verify("") is None
        assert signer.verify("n.importe.quoi") is None

    def test_verify_rejette_une_version_de_cle_inconnue(self, qr_settings):
        signer = QRService(qr_settings)
        payload = signer.sign("TKT-2026-000412")
        number, _version, mac = payload.rsplit(".", 2)
        assert signer.verify(f"{number}.99.{mac}") is None

    def test_secret_trop_court_est_refuse(self, qr_settings):
        qr_settings.QR_SECRET = "court"
        try:
            QRService(qr_settings)
        except ValueError:
            return
        raise AssertionError("Une clé trop courte doit être refusée")

    def test_deux_signers_avec_des_cles_differentes_ne_saccordent_pas(self, qr_settings):
        signer_a = QRService(qr_settings)

        autres = MagicMock()
        autres.QR_SECRET = "une-toute-autre-cle-secrete-32c"
        autres.QR_SECRET_VERSION = 1
        signer_b = QRService(autres)

        payload = signer_a.sign("TKT-2026-000412")
        assert signer_b.verify(payload) is None