"""Rapports et tableau de bord."""

from datetime import date

from fastapi import APIRouter, Query

from app.api.deps import DbSession, StaffDep
from app.config import settings
from app.schemas.report import (
    DailySalesOut,
    DashboardOut,
    MealSalesOut,
    TicketStatsOut,
)
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["Rapports"])


@router.get("/dashboard", response_model=DashboardOut, summary="Tableau de bord du guichet")
async def dashboard(db: DbSession, user: StaffDep) -> DashboardOut:
    """Chiffres du jour, file d'attente et répartition par repas."""
    return await ReportService(db, settings).dashboard()


@router.get("/daily", response_model=DailySalesOut, summary="Ventes par jour")
async def daily_sales(
    db: DbSession,
    user: StaffDep,
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
) -> DailySalesOut:
    """Chiffre d'affaires, réservations payées, repas et tickets consommés."""
    return await ReportService(db, settings).daily_sales(from_date, to_date)


@router.get("/by-meal", response_model=MealSalesOut, summary="Ventes par repas")
async def sales_by_meal(
    db: DbSession,
    user: StaffDep,
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
) -> MealSalesOut:
    """Répartition des ventes et des consommations par type de repas."""
    return await ReportService(db, settings).sales_by_meal(from_date, to_date)


@router.get("/ticket-stats", response_model=TicketStatsOut, summary="Répartition des tickets")
async def ticket_stats(db: DbSession, user: StaffDep) -> TicketStatsOut:
    """Compteurs `GENERATED` / `USED` / `EXPIRED`."""
    return await ReportService(db, settings).ticket_stats()


@router.get("/export", summary="Exporter un rapport")
async def export_report(
    db: DbSession,
    user: StaffDep,
    type: str = Query("daily", description="daily | by_meal"),
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
    format: str = Query("csv", description="csv | pdf"),
):
    """Export CSV des ventes, prêt à être ouvert dans un tableur."""
    import csv
    import io

    service = ReportService(db, settings)

    if type == "by_meal":
        data = await service.sales_by_meal(from_date, to_date)
        header = ["repas", "repas_commandes", "tickets_consommes", "recette"]
        rows = [
            [r.meal, r.meals_ordered, r.tickets_used, r.revenue] for r in data.rows
        ]
    else:
        data = await service.daily_sales(from_date, to_date)
        header = ["date", "reservations_payees", "recette", "repas_vendus", "tickets_consommes"]
        rows = [
            [
                r.sale_date.isoformat(),
                r.reservations_paid,
                r.revenue,
                r.meals_sold,
                r.tickets_used,
            ]
            for r in data.days
        ]

    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";")
    writer.writerow(header)
    writer.writerows(rows)

    from fastapi.responses import StreamingResponse

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": (
                f'attachment; filename="rapport-{type}-{from_date}_{to_date}.csv"'
            )
        },
    )