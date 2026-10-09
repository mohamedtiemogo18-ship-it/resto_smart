"""Journalisation structurée.

Aucun montant, numéro de ticket, matricule ni donnée personnelle n'est
journalisé : seuls des identifiants techniques le sont (étape 8.7).
"""

import logging
import sys
import uuid
from contextvars import ContextVar

import structlog

request_id_var: ContextVar[str] = ContextVar("request_id", default="")
actor_id_var: ContextVar[str] = ContextVar("actor_id", default="")
actor_role_var: ContextVar[str] = ContextVar("actor_role", default="")

_SENSITIVE_KEYS = frozenset(
    {
        "password",
        "token",
        "access_token",
        "refresh_token",
        "secret",
        "qr_payload",
        "qr_secret",
        "matricule",
        "full_name",
        "ticket_number",
        "amount",
        "total_amount",
        "cash_received",
        "authorization",
    }
)


def _redact(_logger, _method, event_dict):
    """Masque les champs sensibles avant écriture."""
    for key in list(event_dict):
        if key.lower() in _SENSITIVE_KEYS:
            event_dict[key] = "***"
    if rid := request_id_var.get():
        event_dict.setdefault("request_id", rid)
    if aid := actor_id_var.get():
        event_dict.setdefault("actor_id", aid)
    if role := actor_role_var.get():
        event_dict.setdefault("actor_role", role)
    return event_dict


def configure_logging(environment: str = "development") -> None:
    """Configure structlog. À appeler une seule fois, au démarrage."""
    level = logging.DEBUG if environment == "development" else logging.INFO
    logging.basicConfig(format="%(message)s", stream=sys.stdout, level=level)

    processors: list = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        _redact,
    ]

    if environment == "development":
        processors.append(structlog.dev.ConsoleRenderer(colors=True))
    else:
        processors.append(structlog.processors.JSONRenderer())

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(level),
        cache_logger_on_first_use=True,
    )


def new_request_id() -> str:
    return f"req_{uuid.uuid4().hex[:12]}"


def get_logger(name: str | None = None):
    return structlog.get_logger(name)