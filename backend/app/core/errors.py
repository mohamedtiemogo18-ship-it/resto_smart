"""Exceptions métier et traduction des erreurs PostgreSQL.

Le backend propage les erreurs levées par les fonctions SQL telles quelles :
une règle métier vit en un seul endroit (la base), pas en double.
"""

from typing import Any

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class BusinessError(Exception):
    """Erreur métier renvoyée au client dans l'enveloppe standard."""

    def __init__(
        self,
        code: str,
        message: str,
        http_status: int = status.HTTP_400_BAD_REQUEST,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.http_status = http_status
        self.details = details or {}
        super().__init__(message)


class Unauthorized(BusinessError):
    def __init__(self, message: str = "Authentification requise", code: str = "AUTH_REQUIRED"):
        super().__init__(code, message, status.HTTP_401_UNAUTHORIZED)


class Forbidden(BusinessError):
    def __init__(self, message: str = "Accès refusé", code: str = "ROLE_FORBIDDEN"):
        super().__init__(code, message, status.HTTP_403_FORBIDDEN)


class NotFound(BusinessError):
    def __init__(self, message: str = "Ressource introuvable", code: str = "NOT_FOUND"):
        super().__init__(code, message, status.HTTP_404_NOT_FOUND)


class Conflict(BusinessError):
    def __init__(self, code: str, message: str, details: dict | None = None):
        super().__init__(code, message, status.HTTP_409_CONFLICT, details)


# ---------------------------------------------------------------------------
# Traduction des exceptions PostgreSQL
# ---------------------------------------------------------------------------

#: Code d'erreur levé par `raise exception ... using errcode = 'xxxxx'`
PG_ERROR_MAP: dict[str, tuple[int, str]] = {
    # Réservations
    "RESERVATION_NOT_FOUND":     (404, "RESERVATION_NOT_FOUND"),
    "RESERVATION_LOCKED":        (409, "RESERVATION_LOCKED"),
    "RESERVATION_PAID_FINAL":    (409, "RESERVATION_PAID_FINAL"),
    "RESERVATION_CANCELLED":     (409, "RESERVATION_CANCELLED"),
    "RESERVATION_NOT_PENDING":   (409, "RESERVATION_NOT_PENDING"),
    "RESERVATION_FORBIDDEN":     (403, "ROLE_FORBIDDEN"),
    "RESERVATION_STATUS_FORBIDDEN": (403, "ROLE_FORBIDDEN"),
    "RESERVATION_AMOUNT_IMMUTABLE": (409, "RESERVATION_LOCKED"),
    # Paiement
    "PAYMENT_CONFIRM_FORBIDDEN": (409, "PAYMENT_CONFIRM_FORBIDDEN"),
    # Tickets
    "TICKET_NOT_FOUND":          (404, "TICKET_NOT_FOUND"),
    "TICKET_ALREADY_USED":       (409, "TICKET_ALREADY_USED"),
    "TICKET_EXPIRED":            (410, "TICKET_EXPIRED"),
    "TICKET_USED_FINAL":         (409, "TICKET_USED_FINAL"),
    "TICKET_EXPIRED_FINAL":      (409, "TICKET_USED_FINAL"),
    "TICKET_CONSUME_FORBIDDEN":  (403, "ROLE_FORBIDDEN"),
    # QR / anti-fraude
    "QR_INVALID":                (401, "QR_INVALID"),
    "PDF_NOT_GENERATED":         (404, "PDF_NOT_GENERATED"),
    # Stockage
    "STORAGE_UPLOAD_FAILED":     (502, "STORAGE_UPLOAD_FAILED"),
    "STORAGE_URL_FAILED":        (502, "STORAGE_URL_FAILED"),
    # Repas et tarifs
    "MEAL_NOT_FOUND":            (404, "MEAL_NOT_FOUND"),
    # Divers
    "ROLE_CHANGE_FORBIDDEN":     (403, "ROLE_FORBIDDEN"),
    "AUDIT_LOG_IMMUTABLE":       (409, "AUDIT_IMMUTABLE"),
    "SEQUENCE_RESET_DATE":       (409, "SEQUENCE_RESET_DATE"),
}


def pg_error_to_business_error(exc: BaseException) -> BusinessError:
    """Convertit une erreur PostgreSQL levée par une fonction métier."""
    raw = str(getattr(exc, "orig", exc) or exc)
    head = raw.split(":", 1)[0].strip()

    if head in PG_ERROR_MAP:
        http_status, code = PG_ERROR_MAP[head]
        return BusinessError(code, raw, http_status)

    # Violation de contrainte classique
    if hasattr(exc, "pgcode"):
        if exc.pgcode == "23505":  # unique_violation
            return BusinessError("ALREADY_EXISTS", "Cet enregistrement existe déjà", 409)
        if exc.pgcode == "23503":  # foreign_key_violation
            return BusinessError("REFERENCED_RECORD", "Enregistrement référencé ailleurs", 409)
        if exc.pgcode == "23514":  # check_violation
            return BusinessError("BUSINESS_RULE_VIOLATION", "Règle de gestion violée", 409)

    return BusinessError("DATABASE_ERROR", "Erreur de base de données", 500)


# ---------------------------------------------------------------------------
# Enveloppe de réponse
# ---------------------------------------------------------------------------


def error_envelope(code: str, message: str, details: dict | None, request_id: str) -> dict:
    return {
        "success": False,
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
            "request_id": request_id,
        },
    }


def register_exception_handlers(app) -> None:
    """Installe les gestionnaires d'erreurs globaux."""

    @app.exception_handler(BusinessError)
    async def _business(request: Request, exc: BusinessError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.http_status,
            content=error_envelope(exc.code, exc.message, exc.details, getattr(request.state, "request_id", "")),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [
            {
                "field": ".".join(str(p) for p in e["loc"][1:]),
                "message": e["msg"],
                "type": e["type"],
            }
            for e in exc.errors()
        ]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=error_envelope(
                "VALIDATION_ERROR", "Les données envoyées sont invalides", {"fields": errors}, getattr(request.state, "request_id", "")
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = "HTTP_ERROR"
        if exc.status_code == 401:
            code = "AUTH_REQUIRED"
        elif exc.status_code == 403:
            code = "ROLE_FORBIDDEN"
        elif exc.status_code == 404:
            code = "NOT_FOUND"
        elif exc.status_code == 429:
            code = "RATE_LIMITED"
        return JSONResponse(
            status_code=exc.status_code,
            content=error_envelope(code, str(exc.detail), {}, getattr(request.state, "request_id", "")),
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        # Le détail complet part dans les logs, jamais au client
        import structlog

        structlog.get_logger().error(
            "unhandled_error",
            exc_info=exc,
            path=request.url.path,
            request_id=getattr(request.state, "request_id", ""),
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=error_envelope(
                "INTERNAL_ERROR",
                "Une erreur interne est survenue.",
                {},
                getattr(request.state, "request_id", ""),
            ),
        )