"""Tests de génération des PDF.

Le PDF doit contenir le numéro de ticket, le repas, la date de validité et
le QR code. Un ticket imprimé sans QR serait inutilisable au restaurant.
"""

import io

import pytest

pypdf = pytest.importorskip("pypdf", reason="pypdf est nécessaire pour lire les PDF générés")


def make_ticket(number: str = "TKT-2026-000412", meal: str = "LUNCH"):
    from datetime import date

    from app.models.ticket import Ticket

    ticket = Ticket()
    ticket.ticket_number = number
    ticket.qr_payload = f"{number}.1.9f2c8ab41d03e7a5"
    ticket.meal_code = meal
    ticket.valid_until = date(2026, 11, 8)
    return ticket


def read_text(data: bytes) -> tuple[str, int]:
    """Extrait le texte et compte les images d'un PDF."""
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    page = reader.pages[0]
    return page.extract_text(), len(page.images)


class TestPDFGeneration:
    @pytest.mark.asyncio
    async def test_genere_un_pdf_valide(self, pdf_settings):
        from app.services.pdf_service import PDFService

        data = await PDFService(pdf_settings).render(make_ticket())

        assert data[:5] == b"%PDF-", "le fichier n'est pas un PDF"
        assert len(data) > 1000, "PDF anormalement petit"

    @pytest.mark.asyncio
    async def test_contient_les_informations_du_ticket(self, pdf_settings):
        """Numéro, repas, validité et mentions légales doivent être lisibles."""
        from app.services.pdf_service import PDFService

        data = await PDFService(pdf_settings).render(make_ticket())
        texte, _ = read_text(data)

        assert "TKT-2026-000412" in texte, "numéro de ticket absent"
        assert "Repas" in texte, "libellé du repas absent"
        assert "08/11/2026" in texte, "date de validité absente"
        assert "personnel" in texte, "mention « strictement personnel » absente"
        assert "Usage unique" in texte, "mention « usage unique » absente"

    @pytest.mark.asyncio
    async def test_integre_le_qr_code_en_image(self, pdf_settings):
        """Sans image embarquée, le ticket ne peut pas être scanné."""
        from app.services.pdf_service import PDFService

        data = await PDFService(pdf_settings).render(make_ticket())
        _, images = read_text(data)

        assert images >= 1, "aucune image embarquée : le QR est absent"

    @pytest.mark.asyncio
    async def test_qr_absent_ne_fait_pas_echouer_la_generation(self, pdf_settings):
        """Un QR ou une image cassée ne doit jamais bloquer l'encaissement."""
        from app.services.pdf_service import PDFService

        ticket = make_ticket()
        ticket.qr_payload = None  # pas de QR

        data = await PDFService(pdf_settings).render(ticket)

        assert data[:5] == b"%PDF-"
        texte, _ = read_text(data)
        assert "TKT-2026-000412" in texte

    @pytest.mark.asyncio
    async def test_feuille_de_plusieurs_tickets(self, pdf_settings):
        from app.services.pdf_service import PDFService

        tickets = [
            make_ticket(f"TKT-2026-00041{i}", meal)
            for i, meal in enumerate(("LUNCH", "DINNER", "LUNCH", "BREAKFAST"))
        ]

        data = await PDFService(pdf_settings).render_sheet(tickets)

        assert data[:5] == b"%PDF-"
        texte, images = read_text(data)
        # Chaque ticket de la feuille porte son QR
        assert images >= len(tickets), f"{images} images pour {len(tickets)} tickets"
        for ticket in tickets:
            assert ticket.ticket_number in texte, f"{ticket.ticket_number} absent de la feuille"

    @pytest.mark.asyncio
    async def test_identite_du_restaurant_apparait(self, pdf_settings):
        from app.services.pdf_service import PDFService

        pdf_settings.RESTO_IDENTITY = {
            "name": "Restauration universitaire",
            "city": "Ouagadougou",
        }

        data = await PDFService(pdf_settings).render(make_ticket())
        texte, _ = read_text(data)

        assert "Restauration universitaire" in texte
        assert "Ouagadougou" in texte

    @pytest.mark.asyncio
    async def test_repas_nomme_correctement(self, pdf_settings):
        from app.services.pdf_service import PDFService

        for code, attendu in (
            ("BREAKFAST", "Petit-déjeuner"),
            ("LUNCH", "Déjeuner"),
            ("DINNER", "Dîner"),
        ):
            data = await PDFService(pdf_settings).render(make_ticket(meal=code))
            texte, _ = read_text(data)
            assert attendu in texte, f"{code} devrait afficher « {attendu} »"
