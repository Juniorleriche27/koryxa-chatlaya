from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import Request

from app.core.config import settings


logger = logging.getLogger(__name__)


def _normalize_innova_api_base(value: str | None) -> str:
    base = (value or "http://127.0.0.1:8000/innova/api").strip().rstrip("/")
    base = base.replace("/innova/api/innova/api", "/innova/api")
    if not base.endswith("/innova/api"):
        base = f"{base}/innova/api"
    return base


def _auth_api_base() -> str:
    return _normalize_innova_api_base(
        settings.CORE_AUTH_API_BASE_URL or settings.CORE_INTERNAL_API_BASE_URL,
    )


def _public_user_to_owner(payload: dict[str, Any]) -> dict | None:
    user_id = payload.get("id") or payload.get("_id") or payload.get("user_id")
    if not user_id:
        return None
    return {
        "_id": str(user_id),
        "id": str(user_id),
        "email": payload.get("email"),
        "first_name": payload.get("first_name") or "",
        "last_name": payload.get("last_name") or "",
        "roles": payload.get("roles") if isinstance(payload.get("roles"), list) else ["user"],
        "workspace_role": payload.get("workspace_role"),
        "country": payload.get("country"),
        "account_type": payload.get("account_type"),
        "plan": payload.get("plan") or "free",
    }


async def get_current_user_optional(request: Request) -> dict | None:
    raw_token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    authz = (request.headers.get("authorization") or "").strip()
    if not raw_token and not authz:
        return None

    headers = {"Accept": "application/json"}
    if raw_token:
        headers["Cookie"] = f"{settings.SESSION_COOKIE_NAME}={raw_token}"
    if authz.lower().startswith("bearer "):
        headers["Authorization"] = authz

    url = f"{_auth_api_base()}/auth/me"
    timeout = max(1.0, float(settings.CORE_INTERNAL_API_TIMEOUT_S or 5.0))
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(url, headers=headers)
    except httpx.HTTPError as exc:
        logger.warning("ChatLAYA core auth validation failed: %s", exc)
        return None

    if response.status_code in {401, 403}:
        return None
    if not response.is_success:
        logger.warning("ChatLAYA core auth validation returned %s", response.status_code)
        return None

    try:
        payload = response.json()
    except ValueError:
        logger.warning("ChatLAYA core auth validation returned invalid JSON")
        return None
    if not isinstance(payload, dict):
        return None
    return _public_user_to_owner(payload)
