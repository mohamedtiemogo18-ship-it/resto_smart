"""Middleware ASGI qui enveloppe les réponses JSON.

Pourquoi un middleware plutôt qu'une classe de route : FastAPI 0.115 inclut
les routers paresseusement et reprend sa propre classe de route, ce qui rend
la substitution peu fiable. Un middleware ASGI est indépendant de ces détails
d'implémentation.

Ne s'applique qu'aux réponses JSON :
- les fichiers (PDF, CSV) et les redirections passent tels quels
- les chemins d'infrastructure (`/health`, `/docs`) restent bruts
- les erreurs sont déjà enveloppées par les gestionnaires d'exception

La réponse JSON est mise en tampon dans son intégralité, puis réémise avec
un `content-length` recalculé : envelopper change la taille du corps, et
conserver l'en-tête d'origine provoque un décalage fatale
(`Response content longer than Content-Length`).
"""

import json

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

        state: dict = {"wrap": False, "chunks": [], "start": None}

        async def send_wrapper(message: Message) -> None:
            kind = message["type"]

            if kind == "http.response.start":
                headers = message.setdefault("headers", [])
                content_type = _header_value(headers, b"content-type")

                # On ne met en tampon que si la réponse est du JSON.
                # Tout le reste (fichiers, redirections) transite direct.
                state["wrap"] = content_type.startswith("application/json")

                if state["wrap"]:
                    state["start"] = message
                    return

                await send(message)
                return

            if kind == "http.response.body":
                if not state["wrap"]:
                    await send(message)
                    return

                body = message.get("body", b"")
                if body:
                    state["chunks"].append(body)

                if message.get("more_body", False):
                    return

                raw = b"".join(state["chunks"])
                payload = _decode(raw)

                # Déjà enveloppé (erreur) : on réémet tel quel
                if isinstance(payload, dict) and "success" in payload:
                    wrapped = raw
                else:
                    wrapped = json.dumps(
                        {"success": True, "data": payload}
                    ).encode("utf-8")

                start = dict(state["start"])
                start["headers"] = _with_content_length(
                    start.get("headers", []), len(wrapped)
                )
                await send(start)
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


def _decode(raw: bytes):
    """Décode un corps JSON ; renvoie None si ce n'est pas du JSON."""
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (ValueError, TypeError):
        return None


def _with_content_length(headers: list, length: int) -> list:
    """Remplace (ou ajoute) l'en-tête content-length."""
    filtered = [h for h in headers if h[0].lower() != b"content-length"]
    filtered.append((b"content-length", str(length).encode("latin-1")))
    return filtered


def _header_value(headers, name: bytes) -> str:
    for key, value in headers:
        if key.lower() == name:
            return value.decode("latin-1")
    return ""
