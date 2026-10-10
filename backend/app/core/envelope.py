"""Middleware ASGI qui enveloppe les réponses JSON.

Pourquoi un middleware plutôt qu'une classe de route : FastAPI 0.115 inclut
les routers paresseusement et reprend sa propre classe de route, ce qui rend
la substitution peu fiable. Un middleware ASGI est indépendant de ces
détails d'implémentation.

Il ne touche qu'aux réponses JSON :
- les fichiers (PDF, CSV) et les redirections passent tels quels
- les chemins d'infrastructure (`/health`, `/docs`) restent bruts
- les erreurs sont déjà enveloppées par les gestionnaires d'exception
"""

import json
from typing import MutableMapping

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.response import EXEMPT_PATHS


class EnvelopeMiddleware:
    """Enveloppe chaque réponse JSON dans {"success": true, "data": ...}."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        if scope.get("path", "") in EXEMPT_PATHS:
            await self.app(scope, receive, send)
            return

        # On n'enveloppe que si la réponse finale est du JSON. Comme le
        # content-type n'est connu qu'après response.start, on suit l'état.
        started = False
        wrap = False
        chunks: list[bytes] = []

        async def send_wrapper(message: Message) -> None:
            nonlocal started, wrap

            if message["type"] == "http.response.start":
                headers: MutableMapping[bytes, bytes] = message.setdefault("headers", [])
                content_type = _header_value(headers, b"content-type")

                wrap = content_type.startswith("application/json")

                if not wrap:
                    # Pas du JSON : on transmet immédiatement, sans bufferiser
                    started = True
                    await send(message)
                    return

                # JSON : on retient le start pour recalculer content-length
                started = True
                await send(message)
                return

            if message["type"] == "http.response.body":
                if not wrap:
                    await send(message)
                    return

                body = message.get("body", b"")
                if body:
                    chunks.append(body)

                # Dernier fragment : on reconstitue et on enveloppe
                if not message.get("more_body", False):
                    raw = b"".join(chunks)
                    try:
                        payload = json.loads(raw)
                    except (ValueError, TypeError):
                        await send({"type": "http.response.body", "body": raw})
                        return

                    # Déjà enveloppé (erreur produite par un gestionnaire
                    # d'exception) : on ne double-enveloppe pas.
                    if isinstance(payload, dict) and "success" in payload:
                        await send(
                            {
                                "type": "http.response.body",
                                "body": raw,
                                "more_body": False,
                            }
                        )
                        return

                    wrapped = json.dumps(
                        {"success": True, "data": payload}
                    ).encode("utf-8")
                    await send(
                        {
                            "type": "http.response.body",
                            "body": wrapped,
                            "more_body": False,
                        }
                    )
                return

            await send(message)

        await self.app(scope, receive, send_wrapper)


def _header_value(headers, name: bytes) -> str:
    for key, value in headers:
        if key.lower() == name:
            return value.decode("latin-1")
    return ""
