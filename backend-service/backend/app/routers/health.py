from __future__ import annotations

from fastapi import APIRouter

from app.services.postgres_bootstrap import db_configured


router = APIRouter()


@router.get("/health")
def health() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "service": "chatlaya-service",
        "db_configured": db_configured(),
    }
