from __future__ import annotations

from typing import Any

import httpx

from app.core.config import settings


class CoreAPIClientError(RuntimeError):
    pass


def _base_url() -> str:
    value = (settings.CORE_INTERNAL_API_BASE_URL or "").strip().rstrip("/")
    if not value:
        raise CoreAPIClientError("CORE_INTERNAL_API_BASE_URL is not configured")
    return value


def _headers() -> dict[str, str]:
    token = (settings.INTERNAL_API_TOKEN or "").strip()
    if not token:
        raise CoreAPIClientError("INTERNAL_API_TOKEN is not configured")
    return {
        "X-Internal-Token": token,
        "Accept": "application/json",
    }


async def _get_json(path: str) -> dict[str, Any]:
    url = f"{_base_url()}{path}"
    timeout = max(1.0, float(settings.CORE_INTERNAL_API_TIMEOUT_S or 5.0))
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(url, headers=_headers())
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text.strip() or exc.response.reason_phrase
        raise CoreAPIClientError(f"Core API request failed [{exc.response.status_code}] for {path}: {detail}") from exc
    except httpx.TimeoutException as exc:
        raise CoreAPIClientError(f"Core API request timed out for {path}") from exc
    except httpx.HTTPError as exc:
        raise CoreAPIClientError(f"Core API request error for {path}: {exc}") from exc

    try:
        payload = response.json()
    except ValueError as exc:
        raise CoreAPIClientError(f"Core API returned invalid JSON for {path}") from exc
    if not isinstance(payload, dict):
        raise CoreAPIClientError(f"Core API returned unexpected payload type for {path}")
    return payload


async def get_user_summary(user_id: str) -> dict[str, Any]:
    return await _get_json(f"/internal/core/users/{user_id}/summary")


async def get_guest_summary(guest_id: str) -> dict[str, Any]:
    return await _get_json(f"/internal/core/guests/{guest_id}/summary")


async def get_user_trajectory_summary(user_id: str) -> dict[str, Any]:
    return await _get_json(f"/internal/core/users/{user_id}/trajectory-summary")


async def get_guest_trajectory_summary(guest_id: str) -> dict[str, Any]:
    return await _get_json(f"/internal/core/guests/{guest_id}/trajectory-summary")


async def get_user_enterprise_summary(user_id: str) -> dict[str, Any]:
    return await _get_json(f"/internal/core/users/{user_id}/enterprise-summary")


async def get_guest_enterprise_summary(guest_id: str) -> dict[str, Any]:
    return await _get_json(f"/internal/core/guests/{guest_id}/enterprise-summary")

