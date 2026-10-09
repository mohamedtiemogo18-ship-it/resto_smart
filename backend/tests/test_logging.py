"""Tests de la journalisation : aucun champ sensible ne doit fuiter."""

from app.core.logging import _redact


class TestLogRedaction:
    def test_les_champs_sensibles_sont_masques(self):
        event = {
            "level": "info",
            "matricule": "ETU-2024-0198",
            "ticket_number": "TKT-2026-000412",
            "total_amount": "6300.00",
            "qr_payload": "TKT-2026-000412.1.abc",
        }
        result = _redact(None, "info", dict(event))

        assert result["matricule"] == "***"
        assert result["ticket_number"] == "***"
        assert result["total_amount"] == "***"
        assert result["qr_payload"] == "***"

    def test_les_champs_techniques_sont_conserves(self):
        event = {"level": "info", "method": "POST", "path": "/api/v1/tickets/consume"}
        result = _redact(None, "info", dict(event))

        assert result["method"] == "POST"
        assert result["path"] == "/api/v1/tickets/consume"

    def test_la_casse_des_cles_est_ignoree(self):
        result = _redact(None, "info", {"Password": "secret", "Amount": "100"})
        assert result["Password"] == "***"
        assert result["Amount"] == "***"