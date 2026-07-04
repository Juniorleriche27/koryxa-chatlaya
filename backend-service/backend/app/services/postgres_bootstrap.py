from __future__ import annotations

import logging
import os
from typing import Any

import asyncpg

from app.core.config import settings


logger = logging.getLogger(__name__)

_POOL: asyncpg.Pool | None = None


def _mask_dsn(value: str) -> str:
    if not value:
        return "<empty>"
    if "@" not in value:
        return value[:12] + "***" if len(value) > 12 else "***"
    prefix, suffix = value.split("@", 1)
    masked_prefix = prefix[:12] + "***" if len(prefix) > 12 else "***"
    return f"{masked_prefix}@{suffix}"


def _database_url() -> str:
    return (os.getenv("DATABASE_URL") or settings.DATABASE_URL or "").strip()


def db_configured() -> bool:
    return bool(_database_url())


def get_pool() -> asyncpg.Pool | None:
    return _POOL


async def init_pool() -> asyncpg.Pool | None:
    global _POOL
    if _POOL is not None:
        return _POOL
    dsn = _database_url()
    logger.info("chatlaya-service DATABASE_URL at startup: %s", _mask_dsn(dsn))
    if not dsn:
        print("DATABASE_URL is empty at startup")
        logger.info("chatlaya-service Postgres pool skipped: DATABASE_URL not configured")
        return None
    try:
        _POOL = await asyncpg.create_pool(
            dsn=dsn,
            min_size=1,
            max_size=5,
            command_timeout=10,
            statement_cache_size=0,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("chatlaya-service Postgres pool init failed: %s", exc)
        _POOL = None
    return _POOL


async def close_pool() -> None:
    global _POOL
    if _POOL is None:
        return
    await _POOL.close()
    _POOL = None


async def healthcheck_db() -> bool:
    pool = get_pool()
    if pool is None:
        return False
    try:
        async with pool.acquire() as conn:
            await conn.fetchval("select 1;")
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("chatlaya-service Postgres healthcheck failed: %s", exc)
        return False


def db_execute(sql: str, params: tuple[Any, ...] | None = None) -> None:
    _ = (sql, params)
    raise RuntimeError(
        "chatlaya-service sync db_execute is not implemented yet; "
        "migrate repositories to asyncpg before using chat routes in this service."
    )


def db_fetchone(sql: str, params: tuple[Any, ...] | None = None) -> dict[str, Any] | None:
    _ = (sql, params)
    raise RuntimeError(
        "chatlaya-service sync db_fetchone is not implemented yet; "
        "migrate repositories to asyncpg before using chat routes in this service."
    )


def db_fetchall(sql: str, params: tuple[Any, ...] | None = None) -> list[dict[str, Any]]:
    _ = (sql, params)
    raise RuntimeError(
        "chatlaya-service sync db_fetchall is not implemented yet; "
        "migrate repositories to asyncpg before using chat routes in this service."
    )
