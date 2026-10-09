"""Accès au Storage Supabase (bucket privé `tickets`).

Les PDF sont déposés à `pdf/{student_id}/{ticket_number}.pdf`. Le bucket est
privé : les fichiers sont servis par des URL signées de courte durée, jamais
par un lien permanent.
"""

import uuid
from datetime import datetime, timezone

from supabase import Client, create_client

from app.models.ticket import Ticket


class StorageService:
    def __init__(self, settings) -> None:
        self._settings = settings
        self._bucket = getattr(settings, "STORAGE_BUCKET", "tickets")
        self._ttl = getattr(settings, "SIGNED_URL_TTL_SECONDS", 300)
        self._client: Client | None = None

    @property
    def client(self) -> Client:
        if self._client is None:
            self._client = create_client(
                self._settings.SUPABASE_URL,
                self._settings.SUPABASE_SERVICE_ROLE_KEY,
            )
        return self._client

    # ------------------------------------------------------------------
    # Écriture
    # ------------------------------------------------------------------

    async def upload_pdf(self, ticket: Ticket, content: bytes) -> str:
        path = self._ticket_path(ticket)
        return await self._upload(path, content, "application/pdf")

    async def upload_sheet(self, reservation_id: uuid.UUID, content: bytes) -> str:
        path = f"sheets/{reservation_id}.pdf"
        return await self._upload(path, content, "application/pdf")

    async def upload_image(self, name: str, content: bytes, mime: str) -> str:
        path = f"images/{name}"
        return await self._upload(path, content, mime, upsert=True)

    async def _upload(
        self, path: str, content: bytes, mime: str, upsert: bool = False
    ) -> str:
        try:
            self.client.storage.from_(self._bucket).upload(
                path,
                content,
                file_options={"content-type": mime, "upsert": str(upsert).lower()},
            )
            return path
        except Exception as exc:
            from app.core.errors import BusinessError

            raise BusinessError(
                "STORAGE_UPLOAD_FAILED",
                f"Échec de l'envoi du fichier {path}",
                502,
            ) from exc

    # ------------------------------------------------------------------
    # Lecture
    # ------------------------------------------------------------------

    async def signed_url(self, path: str) -> str:
        """URL signée de courte durée pour télécharger un PDF."""
        try:
            result = self.client.storage.from_(self._bucket).create_signed_url(
                path, self._ttl
            )
            return result.get("signedURL") or result.get("signed_url", "")
        except Exception as exc:
            from app.core.errors import BusinessError

            raise BusinessError(
                "STORAGE_URL_FAILED", "Impossible de générer le lien de téléchargement", 502
            ) from exc

    async def download(self, path: str) -> bytes:
        try:
            return self.client.storage.from_(self._bucket).download(path)
        except Exception as exc:
            from app.core.errors import BusinessError

            raise BusinessError("STORAGE_DOWNLOAD_FAILED", "Fichier introuvable", 502) from exc

    # ------------------------------------------------------------------

    @staticmethod
    def _ticket_path(ticket: Ticket) -> str:
        return f"pdf/{ticket.student_id}/{ticket.ticket_number}.pdf"


__all__ = ["StorageService", "datetime", "timezone"]