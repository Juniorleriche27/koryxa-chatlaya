from __future__ import annotations

import logging

from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / '.env.local')
load_dotenv(BASE_DIR / '.env')

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers.chatlaya import router as chatlaya_router
from app.routers.founder import router as founder_router
from app.routers.health import router as health_router
from app.routers.opencloud import router as opencloud_router
from app.services.postgres_bootstrap import close_pool, db_configured, init_pool


logger = logging.getLogger(__name__)


app = FastAPI(
    title="ChatLAYA Service",
    version="0.1.0",
    description="Live ChatLAYA backend service for sessions, conversations, messages and assistant behavior.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://innovaplus.africa",
        "https://www.innovaplus.africa",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

app.include_router(health_router)
app.include_router(chatlaya_router)
app.include_router(founder_router)
app.include_router(opencloud_router)


@app.options("/chatlaya/{path:path}", include_in_schema=False)
async def chatlaya_options(path: str) -> dict[str, bool]:
    return {"ok": True}



@app.on_event("startup")
async def on_startup() -> None:
    if not db_configured():
        logger.info("chatlaya-service startup without DATABASE_URL; DB pool not initialized")
        return
    await init_pool()


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await close_pool()


@app.get("/", include_in_schema=False)
def root() -> dict[str, str]:
    return {
        "service": settings.SERVICE_NAME,
        "status": "ok",
    }
