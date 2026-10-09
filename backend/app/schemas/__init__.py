"""Schémas exportés par le module schemas."""

from app.schemas.common import Message, Page, Pagination
from app.schemas.money import Money
from app.schemas.meal import (
    MealOut,
    MealWithPrice,
    PriceHistoryOut,
    PriceOut,
    PriceUpdateIn,
)
from app.schemas.reservation import (
    ReservationCancelIn,
    ReservationCreate,
    ReservationItemIn,
    ReservationItemOut,
    ReservationOut,
)
from app.schemas.ticket import (
    ConfirmPaymentIn,
    ConfirmPaymentOut,
    ConsumeTicketIn,
    ConsumeTicketOut,
    TicketOut,
    VoidTicketIn,
)
from app.schemas.user import (
    CurrentUser,
    UserCreate,
    UserImportIn,
    UserImportOut,
    UserOut,
    UserUpdate,
)
from app.schemas.report import (
    AuditLogOut,
    DailySalesOut,
    DashboardOut,
    MealSalesOut,
    SettingUpdateIn,
    SettingsOut,
    TicketStatsOut,
)

__all__ = [
    "Message",
    "Page",
    "Pagination",
    "Money",
    "MealOut",
    "MealWithPrice",
    "PriceOut",
    "PriceUpdateIn",
    "PriceHistoryOut",
    "ReservationCreate",
    "ReservationItemIn",
    "ReservationItemOut",
    "ReservationOut",
    "ReservationCancelIn",
    "TicketOut",
    "ConsumeTicketIn",
    "ConsumeTicketOut",
    "ConfirmPaymentIn",
    "ConfirmPaymentOut",
    "VoidTicketIn",
    "CurrentUser",
    "UserOut",
    "UserCreate",
    "UserUpdate",
    "UserImportIn",
    "UserImportOut",
    "DailySalesOut",
    "MealSalesOut",
    "TicketStatsOut",
    "DashboardOut",
    "SettingsOut",
    "SettingUpdateIn",
    "AuditLogOut",
]