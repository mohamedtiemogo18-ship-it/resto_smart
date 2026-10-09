"""Génération des PDF de tickets avec ReportLab.

ReportLab est utilisé plutôt que WeasyPrint car il ne nécessite aucune
bibliothèque système : il s'installe et fonctionne sur Windows comme sur
Linux, ce qui rend le démarrage local immédiat.

Chaque PDF porte le QR signé, l'identité du restaurant, la signature et le
cachet déposés par l'administrateur.
"""

import io
import os
from datetime import date

from reportlab.lib import colors
from reportlab.lib.pagesizes import A5, A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from app.models.ticket import Ticket


class PDFService:
    def __init__(self, settings) -> None:
        self._settings = settings
        self._per_page = getattr(settings, "PDF_PER_PAGE", 4)
        self._page_size = A5 if getattr(settings, "PDF_PAGE_SIZE", "A5") == "A5" else A4

    # ------------------------------------------------------------------
    # Ticket unitaire
    # ------------------------------------------------------------------

    async def render(self, ticket: Ticket) -> bytes:
        """Rendu d'un ticket individuel en mémoire."""
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=self._page_size)
        width, height = self._page_size

        self._draw_ticket(c, ticket, width, height)

        c.showPage()
        c.save()
        return buffer.getvalue()

    # ------------------------------------------------------------------
    # Feuille de tickets
    # ------------------------------------------------------------------

    async def render_sheet(self, tickets: list[Ticket]) -> bytes:
        """Feuille A4 réunissant plusieurs tickets à découper."""
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        page_width, page_height = A4

        margin = 10 * mm
        gap = 4 * mm
        cols, rows = 2, 2 if self._per_page == 4 else 1
        cell_w = (page_width - 2 * margin - gap * (cols - 1)) / cols
        cell_h = (page_height - 2 * margin - gap * (rows - 1)) / rows

        for index, ticket in enumerate(tickets):
            if index and index % (cols * rows) == 0:
                c.showPage()

            slot = index % (cols * rows)
            col = slot % cols
            row = slot // cols

            x = margin + col * (cell_w + gap)
            y = page_height - margin - (row + 1) * cell_h - row * gap

            c.saveState()
            c.translate(x, y)
            self._draw_ticket(c, ticket, cell_w, cell_h)
            c.restoreState()

        c.showPage()
        c.save()
        return buffer.getvalue()

    # ------------------------------------------------------------------
    # Dessin
    # ------------------------------------------------------------------

    def _draw_ticket(self, c: canvas.Canvas, ticket: Ticket, width: float, height: float) -> None:
        """Dessine un ticket dans le rectangle courant."""
        identity = self._identity()

        # Fond
        c.setFillColor(colors.HexColor("#FFFFFF"))
        c.rect(0, 0, width, height, stroke=0, fill=1)

        # Bandeau d'en-tête
        c.setFillColor(colors.HexColor("#1D4ED8"))
        c.rect(0, height - 16 * mm, width, 16 * mm, stroke=0, fill=1)

        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(6 * mm, height - 8 * mm, identity.get("name", "Restauration universitaire")[:38])
        c.setFont("Helvetica", 8)
        if identity.get("city"):
            c.drawString(6 * mm, height - 12 * mm, str(identity["city"])[:38])

        # Numéro de ticket
        c.setFillColor(colors.HexColor("#111827"))
        c.setFont("Helvetica-Bold", 15)
        c.drawString(6 * mm, height - 25 * mm, ticket.ticket_number)

        # Repas
        c.setFont("Helvetica", 10)
        c.setFillColor(colors.HexColor("#374151"))
        meal = self._meal_label(ticket)
        c.drawString(6 * mm, height - 31 * mm, f"Repas : {meal}")

        # Validité
        if ticket.valid_until:
            c.setFont("Helvetica", 8)
            c.setFillColor(colors.HexColor("#6B7280"))
            c.drawString(
                6 * mm,
                height - 35 * mm,
                f"Valable jusqu'au {ticket.valid_until.strftime('%d/%m/%Y')}",
            )

        # QR code
        if ticket.qr_payload:
            try:
                self._draw_qr(c, ticket.qr_payload, 6 * mm, 8 * mm, 28 * mm)
            except Exception:
                pass  # un QR illisible ne doit pas faire échouer la vente

        # Signature et cachet
        self._draw_image(c, self._settings, "SIGNATURE_IMAGE_PATH", width - 42 * mm, 8 * mm, 34 * mm, 14 * mm)
        self._draw_image(c, self._settings, "CACHET_IMAGE_PATH", width - 38 * mm, height - 34 * mm, 30 * mm, 12 * mm)

        # Pied
        c.setStrokeColor(colors.HexColor("#E5E7EB"))
        c.setLineWidth(0.5)
        c.line(6 * mm, 6 * mm, width - 6 * mm, 6 * mm)
        c.setFont("Helvetica", 6.5)
        c.setFillColor(colors.HexColor("#9CA3AF"))
        c.drawString(6 * mm, 3 * mm, "Ticket strictement personnel — ne pas céder")
        c.drawRightString(width - 6 * mm, 3 * mm, "Usage unique")

    def _draw_qr(self, c: canvas.Canvas, payload: str, x: float, y: float, size: float) -> None:
        import segno

        qr = segno.make(payload, error="m")
        png_buffer = io.BytesIO()
        qr.save(png_buffer, kind="png", scale=8, border=1)
        png_buffer.seek(0)

        from reportlab.lib.utils import ImageReader

        c.drawImage(ImageReader(png_buffer), x, y, size, size, mask="auto")

    def _draw_image(
        self,
        c: canvas.Canvas,
        settings,
        attr: str,
        x: float,
        y: float,
        max_w: float,
        max_h: float,
    ) -> None:
        path = getattr(settings, attr, None)
        if not path or not os.path.isfile(path):
            return
        try:
            from reportlab.lib.utils import ImageReader

            c.drawImage(ImageReader(path), x, y, max_w, max_h, preserveAspectRatio=True, mask="auto")
        except Exception:
            pass

    def _meal_label(self, ticket: Ticket) -> str:
        labels = {"BREAKFAST": "Petit-déjeuner", "LUNCH": "Déjeuner", "DINNER": "Dîner"}
        code = getattr(ticket, "meal_code", None)
        return labels.get(code, "Repas universitaire")

    def _identity(self) -> dict:
        raw = getattr(self._settings, "RESTO_IDENTITY", None)
        if isinstance(raw, dict):
            return raw
        return {"name": "Restauration universitaire", "city": ""}


__all__ = ["PDFService", "date"]