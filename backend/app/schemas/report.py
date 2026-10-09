"""Schémas des rapports, réglages et audit."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.audit import AuditLog


class DailySalesRow(BaseModel):
    sale_date: date
    reservations_paid: int
    revenue: str
    meals_sold: int
    tickets_used: int


class DailySalesOut(BaseModel):
    from_date: date
    to_date: date
    days: list[DailySalesRow]
    total_revenue: str
    total_reservations: int
    total_meals_sold: int
    total_tickets_used: int


class MealSalesRow(BaseModel):
    meal_type_id: int
    meal: str
    meals_ordered: int
    tickets_used: int
    revenue: str


class MealSalesOut(BaseModel):
    from_date: date
    to_date: date
    rows: list[MealSalesRow]


class TicketStatsRow(BaseModel):
    status: str
    tickets: int
    students: int


class TicketStatsOut(BaseModel):
    rows: list[TicketStatsRow]


class DashboardQueueItem(BaseModel):
    reservation_id: uuid.UUID
    reservation_number: str
    student_name: str
    student_matricule: str | None = None
    room: str | None = None
    items_count: int
    total_amount: str
    waiting_minutes: int


class DashboardOut(BaseModel):
    today_revenue: str
    today_reservations_paid: int
    today_meals_sold: int
    today_tickets_used: int
    tickets_pending: int
    tickets_expired: int
    pending_payments: int
    by_meal: list[MealSalesRow]
    queue: list[DashboardQueueItem]


class SettingsOut(BaseModel):
    """Réglages non sensibles."""

    model_config = ConfigDict(from_attributes=True)

    key: str
    value: dict


class SettingUpdateIn(BaseModel):
    value: dict


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    actor_id: uuid.UUID | None = None
    actor_label: str | None = None
    actor_name: str | None = None
    action: str
    entity_type: str | None = None
    entity_id: str | None = None
    outcome: str
    metadata: dict | None = None
    ip: str | None = None
    created_at: datetime