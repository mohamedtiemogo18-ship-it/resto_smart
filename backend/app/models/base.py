"""Base déclarative partagée par tous les modèles.

IMPORTANT : tous les modèles doivent hériter de CETTE Base, sinon Alembic
ne les détecte pas et les relations entre tables ne fonctionnent pas.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base déclarative unique de l'application."""
    pass