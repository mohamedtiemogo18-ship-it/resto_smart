"""Enveloppe de réponse standard.

Toutes les réponses métier de l'API suivent la même forme :

    { "success": true,  "data": {...} }
    { "success": false, "error": { "code": ..., "message": ..., "details": ... } }

C'est le contrat documenté à l'étape 5.13. Les erreurs sont produites par
`register_exception_handlers` ; le cas succès est traité par
`core.envelope.EnvelopeMiddleware`.
"""

from typing import Any

#: Chemins dont la réponse reste brute (infrastructure, pas métier)
EXEMPT_PATHS = frozenset(
    {
        "/health",
        "/",
        "/openapi.json",
        "/docs",
        "/docs/oauth2-redirect",
        "/redoc",
    }
)


def envelope(data: Any) -> dict:
    """Enveloppe une charge utile dans le format standard."""
    return {"success": True, "data": data}
