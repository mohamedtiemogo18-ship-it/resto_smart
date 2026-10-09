"""Modèles SQLAlchemy — miroir du schéma `sql/`.

Aucune règle métier ici : les modèles décrivent la structure, la vérité
métier est dans les fonctions SQL de `sql/02_functions_triggers.sql`.
"""

from app.models.base import Base
from app.models.profile import Profile, UserRole
from app.models.meal import MealPrice, MealSlot, MealType
from app.models.reservation import Reservation, ReservationItem, ReservationStatus
from app.models.ticket import Ticket, TicketStatus
from app.models.audit import AuditLog
from app.models.settings import AppSetting

__all__ = [
    "Base",
    "Profile",
    "UserRole",
    "MealType",
    "MealPrice",
    "MealSlot",
    "Reservation",
    "ReservationItem",
    "ReservationStatus",
    "Ticket",
    "TicketStatus",
    "AuditLog",
    "AppSetting",
]