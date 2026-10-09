"""Configuration de la base de données et gestion des sessions.

Point d'attention : Supabase expose deux poolers.

- **Session** (port 5432) : une connexion dédiée par client. Comprend les
  requêtes préparées. Recommandé pour un serveur applicatif longue durée.
- **Transaction** (port 6543) : connexions partagées, via PgBouncer en mode
  transaction. Ne comprend **pas** les requêtes préparées — asyncpg échoue
  alors avec « prepared statement already exists ».

`build_engine` détecte le mode et adapte la configuration, pour que les deux
fonctionnent sans intervention manuelle.
"""

from urllib.parse import urlparse

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings

#: Port du pooler Supabase en mode transaction (PgBouncer)
TRANSACTION_POOLER_PORT = 6543

#: Port du pooler Supabase en mode session
SESSION_POOLER_PORT = 5432


def is_transaction_pooler(url: str) -> bool:
    """Vrai si l'URL pointe vers le pooler en mode transaction."""
    port = urlparse(url).port
    return port == TRANSACTION_POOLER_PORT


def build_engine(url: str, echo: bool = False) -> AsyncEngine:
    """Construit l'engine async en tenant compte du mode du pooler."""
    connect_args: dict = {}

    if is_transaction_pooler(url):
        # PgBouncer en mode transaction ne conserve pas les requêtes
        # préparées entre les transactions : on désactive leur cache.
        connect_args["statement_cache_size"] = 0

    return create_async_engine(
        url,
        echo=echo,
        pool_pre_ping=True,
        connect_args=connect_args,
    )


engine: AsyncEngine = build_engine(settings.DATABASE_URL)

async_session = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_session() -> AsyncSession:
    """Session asynchrone par requête."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise