"""SQLAlchemy engine + session wiring.

SQLite is used by default so the project runs with zero setup. Pointing
DATABASE_URL at PostgreSQL is the only change required for production.
Railway/Heroku hand out URLs like `postgres://` or `postgresql://`; both are
normalized to the psycopg3 driver below (psycopg2-binary was dropped because
it hit `libpq.so.5: cannot open shared object file` on Railway's build image).
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from .config import settings

db_url = settings.database_url
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg://", 1)
elif db_url.startswith("postgresql://") and "+psycopg" not in db_url:
    db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)

connect_args = {}
engine_kwargs = {"future": True}
if db_url.startswith("sqlite"):
    # Needed because FastAPI may touch the connection across threads.
    connect_args = {"check_same_thread": False}
else:
    # Postgres on Railway drops idle connections; recycle + pre-ping avoids
    # "server closed the connection unexpectedly" after the app sits idle.
    engine_kwargs.update(pool_pre_ping=True, pool_recycle=300)

engine = create_engine(db_url, connect_args=connect_args, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a scoped DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
