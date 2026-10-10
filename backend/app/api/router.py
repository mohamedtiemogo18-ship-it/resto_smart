"""Agrégateur des routers — monté sous /api/v1."""

from fastapi import APIRouter

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

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(meals.router)
api_router.include_router(reservations.router)
api_router.include_router(tickets.router)
api_router.include_router(settings.router)
api_router.include_router(reports.router)
api_router.include_router(admin.router)
api_router.include_router(audit.router)
