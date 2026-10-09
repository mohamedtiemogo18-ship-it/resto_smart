"""Sécurité : vérification du JWT Supabase et signature HMAC des QR.

Le QR encode `TKT-YYYY-NNNNNN.<version>.<mac>`. Sans la clé serveur, il est
impossible de fabriquer un ticket valide (étape 8.3).
"""

import hashlib
import hmac
import time

import httpx
import jwt
from jwt import PyJWKClient

from app.core.errors import BusinessError, Unauthorized
from app.schemas.user import CurrentUser


# ---------------------------------------------------------------------------
# JWT Supabase
# ---------------------------------------------------------------------------

_jwk_clients: dict[str, PyJWKClient] = {}


def _jwk_client(jwks_url: str) -> PyJWKClient:
    if jwks_url not in _jwk_clients:
        _jwk_clients[jwks_url] = PyJWKClient(jwks_url, cache_keys=True)
    return _jwk_clients[jwks_url]


def verify_jwt(token: str, supabase_url: str) -> dict:
    """Vérifie la signature et les revendications du JWT Supabase.

    Lève `Unauthorized` si le jeton est invalide ou expiré.
    """
    try:
        signing_key = _jwk_client(f"{supabase_url}/auth/v1/.well-known/jwks.json").get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256", "HS256"],
            audience="authenticated",
            options={"verify_exp": True, "verify_aud": True},
        )
        return claims
    except jwt.ExpiredSignatureError as exc:
        raise Unauthorized("Session expirée", code="TOKEN_EXPIRED") from exc
    except jwt.InvalidTokenError as exc:
        raise Unauthorized("Jeton invalide", code="AUTH_REQUIRED") from exc
    except Exception as exc:  # JWKS injoignable, etc.
        raise Unauthorized("Impossible de vérifier le jeton", code="AUTH_REQUIRED") from exc


# ---------------------------------------------------------------------------
# HMAC des QR codes
# ---------------------------------------------------------------------------


class QRSigner:
    """Signe et vérifie les charges utiles des QR codes."""

    def __init__(self, secret: str, version: int = 1) -> None:
        if len(secret) < 16:
            raise ValueError("QR_SECRET doit faire au moins 16 caractères")
        self._secret = secret.encode("utf-8")
        self.version = version

    def _mac(self, ticket_number: str) -> str:
        digest = hmac.new(self._secret, ticket_number.encode("utf-8"), hashlib.sha256)
        return digest.hexdigest()[:16]

    def sign(self, ticket_number: str) -> str:
        """Produit `TKT-YYYY-NNNNNN.<version>.<mac>`."""
        return f"{ticket_number}.{self.version}.{self._mac(ticket_number)}"

    def verify(self, payload: str) -> str | None:
        """Renvoie le numéro de ticket si la signature est valide, sinon None.

        La comparaison est à temps constant (`hmac.compare_digest`).
        """
        if not payload:
            return None
        parts = payload.rsplit(".", 2)
        if len(parts) != 3:
            return None
        ticket_number, raw_version, mac = parts
        if not raw_version.isdigit() or int(raw_version) != self.version:
            return None
        expected = self._mac(ticket_number)
        if not hmac.compare_digest(mac, expected):
            return None
        return ticket_number

    def extract(self, payload: str) -> str:
        """Vérifie la signature et renvoie le numéro, ou lève `QR_INVALID`."""
        ticket_number = self.verify(payload)
        if ticket_number is None:
            raise BusinessError(
                "QR_INVALID",
                "La signature du ticket est invalide : QR falsifié ou clé obsolète.",
                401,
            )
        return ticket_number


# ---------------------------------------------------------------------------
# Utilitaires
# ---------------------------------------------------------------------------


def constant_time_equals(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


def now_ts() -> int:
    return int(time.time())


async def fetch_supabase_profile(supabase_url: str, jwt_token: str) -> dict | None:
    """Récupère l'utilisateur Supabase correspondant au jeton."""
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(
                f"{supabase_url}/auth/v1/user",
                headers={"Authorization": f"Bearer {jwt_token}"},
            )
        except httpx.HTTPError:
            return None
    return resp.json() if resp.status_code == 200 else None


__all__ = ["QRSigner", "verify_jwt", "fetch_supabase_profile", "CurrentUser"]