"""PenPal+ API — FastAPI application factory.

Run locally:
    uvicorn app.main:app --reload
Interactive docs at http://127.0.0.1:8000/docs
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine
from . import models  # noqa: F401  (ensures models are registered before create_all)
from .routers import (
    auth, profiles, discovery, letters, friends, stamps, achievements,
    subscriptions, communities, notifications, admin, journey,
)

# Create tables on startup. For real migrations you'd use Alembic; create_all
# keeps the project runnable out of the box.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="PenPal+ API",
    version="1.0.0",
    description="Global pen-pal & cultural exchange platform — letters that "
                "take real time to cross the world.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth, profiles, discovery, letters, friends, stamps, achievements,
          subscriptions, communities, notifications, admin, journey):
    app.include_router(r.router)


@app.get("/", tags=["meta"])
def root():
    return {
        "name": "PenPal+ API",
        "version": "1.0.0",
        "docs": "/docs",
        "demo_fast_delivery": settings.demo_fast_delivery,
    }


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
