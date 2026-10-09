"""Enveloppe de réponse commune et pagination."""

from typing import Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    """Réponse paginée standard."""

    items: list[T]
    pagination: "Pagination"


class Pagination(BaseModel):
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)
    total: int = Field(ge=0)
    pages: int = Field(ge=0)

    @classmethod
    def build(cls, total: int, page: int, page_size: int) -> "Pagination":
        pages = (total + page_size - 1) // page_size if page_size else 0
        return cls(page=page, page_size=page_size, total=total, pages=pages)


Page.model_rebuild()


class Message(BaseModel):
    """Message simple."""

    message: str


class RequestMeta(BaseModel):
    request_id: str