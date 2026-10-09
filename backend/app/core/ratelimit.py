"""Limitation de débit.

Le scan au restaurant est la route la plus exposée : elle est limitée par
adresse IP pour freiner les tentatives de balayage de numéros.
"""

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.errors import BusinessError


def rate_limit_key(request: Request) -> str:
    """Clé de limitation : IP seule, pour rester utilisable derrière un proxy."""
    return get_remote_address(request)


limiter = Limiter(key_func=rate_limit_key, default_limits=["200/minute"])

#: Limites spécifiques
SCAN_LIMIT = "30/minute"
RESERVATION_LIMIT = "10/minute"
AUTH_LIMIT = "5/minute"


class RateLimitExceeded(BusinessError):
    def __init__(self, retry_after: int = 60) -> None:
        super().__init__(
            "RATE_LIMITED",
            f"Trop de requêtes. Réessayez dans {retry_after} secondes.",
            429,
            {"retry_after": retry_after},
        )