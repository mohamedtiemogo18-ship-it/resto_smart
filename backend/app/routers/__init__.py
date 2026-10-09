"""Routers de l'API."""

from app.routers import (
    admin,
    audit,
    auth,
    meals,
    reports,
    reservations,
    settings,
    tickets,
)

__all__ = [
    "admin",
    "audit",
    "auth",
    "meals",
    "reports",
    "reservations",
    "settings",
    "tickets",
]