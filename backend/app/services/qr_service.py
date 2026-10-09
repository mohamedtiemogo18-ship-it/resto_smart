"""Signature et vérification des QR codes.

Le QR encode `TKT-YYYY-NNNNNN.<version>.<mac HMAC-SHA256 tronqué>`.
Sans la clé serveur, un ticket falsifié est rejeté avec `QR_INVALID` (401).
"""

import hashlib
import hmac


class QRService:
    def __init__(self, settings) -> None:
        secret = getattr(settings, "QR_SECRET", None)
        if not secret or len(secret) < 16:
            raise ValueError("QR_SECRET doit être défini et faire au moins 16 caractères")
        self._secret = secret.encode("utf-8")
        self._version = getattr(settings, "QR_SECRET_VERSION", 1)

    @property
    def version(self) -> int:
        return self._version

    def _mac(self, ticket_number: str) -> str:
        digest = hmac.new(self._secret, ticket_number.encode("utf-8"), hashlib.sha256)
        return digest.hexdigest()[:16]

    def sign(self, ticket_number: str) -> str:
        return f"{ticket_number}.{self._version}.{self._mac(ticket_number)}"

    def verify(self, payload: str) -> str | None:
        """Renvoie le numéro de ticket si la signature est valide."""
        if not payload:
            return None
        parts = payload.strip().rsplit(".", 2)
        if len(parts) != 3:
            return None
        ticket_number, raw_version, mac = parts
        if not raw_version.isdigit() or int(raw_version) != self._version:
            return None
        if not hmac.compare_digest(mac, self._mac(ticket_number)):
            return None
        return ticket_number.strip().upper()