from __future__ import annotations

import re
from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import settings


class OpenCloudClientError(RuntimeError):
    pass


_FOUNDER_WORKSPACE_SEGMENTS = [
    "01_Cadrage",
    "02_Validation_et_preuves",
    "03_Livrables",
    "04_Exports",
]


def _base_url() -> str:
    value = (settings.OPENCLOUD_BASE_URL or "").strip().rstrip("/")
    if not value:
        raise OpenCloudClientError("OPENCLOUD_BASE_URL is not configured")
    return value


def get_opencloud_auth() -> tuple[str, str] | None:
    username = (settings.OPENCLOUD_SERVICE_USERNAME or "").strip()
    token = (settings.OPENCLOUD_SERVICE_APP_TOKEN or "").strip()
    if not token:
        token = (settings.OPENCLOUD_SERVICE_PASSWORD or "").strip()
    if not username or not token:
        return None
    return username, token


def _webdav_url(username: str, *segments: str) -> str:
    encoded_username = quote(username.strip(), safe="")
    base = f"{_base_url()}/remote.php/dav/files/{encoded_username}/"
    cleaned_segments = [quote(segment.strip(), safe="") for segment in segments if segment.strip()]
    if not cleaned_segments:
        return base
    return f"{base}{'/'.join(cleaned_segments)}/"


async def check_opencloud_reachability() -> dict[str, Any]:
    enabled = bool(settings.OPENCLOUD_ENABLED)
    configured = bool((settings.OPENCLOUD_BASE_URL or "").strip())
    base_url = (settings.OPENCLOUD_BASE_URL or "").strip().rstrip("/") or None
    timeout = max(1.0, float(settings.OPENCLOUD_TIMEOUT_S or 8.0))
    verify_ssl = bool(settings.OPENCLOUD_VERIFY_SSL)

    result: dict[str, Any] = {
        "configured": configured,
        "enabled": enabled,
        "reachable": False,
        "status_code": None,
        "base_url": base_url,
        "error": None,
    }
    if not configured:
        result["error"] = "OPENCLOUD_BASE_URL is not configured"
        return result

    try:
        url = _base_url()
        async with httpx.AsyncClient(timeout=timeout, verify=verify_ssl) as client:
            response = await client.get(url)
        result["reachable"] = True
        result["status_code"] = response.status_code
        return result
    except OpenCloudClientError as exc:
        result["error"] = str(exc)
        return result
    except httpx.TimeoutException:
        result["error"] = "OpenCloud request timed out"
        return result
    except httpx.HTTPError as exc:
        result["error"] = f"OpenCloud request failed: {exc}"
        return result


async def check_opencloud_webdav_auth() -> dict[str, Any]:
    enabled = bool(settings.OPENCLOUD_ENABLED)
    configured = bool((settings.OPENCLOUD_BASE_URL or "").strip())
    base_url = (settings.OPENCLOUD_BASE_URL or "").strip().rstrip("/") or None
    timeout = max(1.0, float(settings.OPENCLOUD_TIMEOUT_S or 8.0))
    verify_ssl = bool(settings.OPENCLOUD_VERIFY_SSL)
    auth = get_opencloud_auth()

    result: dict[str, Any] = {
        "configured": configured,
        "enabled": enabled,
        "auth_configured": auth is not None,
        "webdav_auth_ok": False,
        "status_code": None,
        "base_url": base_url,
        "username": auth[0] if auth else None,
        "error": None,
    }
    if not configured:
        result["error"] = "OPENCLOUD_BASE_URL is not configured"
        return result
    if auth is None:
        result["error"] = "OpenCloud service auth is not configured"
        return result

    username, token = auth
    url = _webdav_url(username)
    try:
        async with httpx.AsyncClient(timeout=timeout, verify=verify_ssl) as client:
            response = await client.request(
                "PROPFIND",
                url,
                auth=(username, token),
                headers={"Depth": "0"},
            )
        result["status_code"] = response.status_code
        result["webdav_auth_ok"] = response.status_code == 207
        if not result["webdav_auth_ok"]:
            result["error"] = f"OpenCloud WebDAV auth failed [{response.status_code}]"
        return result
    except OpenCloudClientError as exc:
        result["error"] = str(exc)
        return result
    except httpx.TimeoutException:
        result["error"] = "OpenCloud WebDAV request timed out"
        return result
    except httpx.HTTPError as exc:
        result["error"] = f"OpenCloud WebDAV request failed: {exc}"
        return result


async def ensure_opencloud_folder(folder_path: str) -> dict[str, Any]:
    cleaned_path = "/".join(segment.strip() for segment in folder_path.split("/") if segment.strip())
    auth = get_opencloud_auth()
    result: dict[str, Any] = {
        "ok": False,
        "folder_path": cleaned_path,
        "created_segments": [],
        "existing_segments": [],
        "status_by_segment": [],
        "error": None,
    }
    if not (settings.OPENCLOUD_BASE_URL or "").strip():
        result["error"] = "OPENCLOUD_BASE_URL is not configured"
        return result
    if auth is None:
        result["error"] = "OpenCloud service auth is not configured"
        return result
    if not cleaned_path:
        result["error"] = "folder_path is empty"
        return result

    username, token = auth
    timeout = max(1.0, float(settings.OPENCLOUD_TIMEOUT_S or 8.0))
    verify_ssl = bool(settings.OPENCLOUD_VERIFY_SSL)
    current_segments: list[str] = []

    try:
        async with httpx.AsyncClient(timeout=timeout, verify=verify_ssl) as client:
            for segment in cleaned_path.split("/"):
                current_segments.append(segment)
                current_path = "/".join(current_segments)
                response = await client.request(
                    "MKCOL",
                    _webdav_url(username, *current_segments),
                    auth=(username, token),
                )
                result["status_by_segment"].append(
                    {
                        "path": current_path,
                        "status_code": response.status_code,
                    }
                )
                if response.status_code == 201:
                    result["created_segments"].append(current_path)
                    continue
                if response.status_code == 405:
                    result["existing_segments"].append(current_path)
                    continue
                result["error"] = f"OpenCloud folder creation failed [{response.status_code}] for {current_path}"
                return result
    except httpx.TimeoutException:
        result["error"] = "OpenCloud folder creation timed out"
        return result
    except httpx.HTTPError as exc:
        result["error"] = f"OpenCloud folder creation failed: {exc}"
        return result

    result["ok"] = True
    return result


async def ensure_default_founder_root_folder() -> dict[str, Any]:
    return await ensure_opencloud_folder(settings.OPENCLOUD_DEFAULT_ROOT_FOLDER)


def sanitize_opencloud_folder_name(value: str, fallback: str = "Projet Founder") -> str:
    normalized = re.sub(r"\s+", " ", (value or "").strip())
    normalized = re.sub(r"[\\/:*?\"<>|#%&{}$!'@+=`~\[\]();,]+", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip(" .-_")
    if len(normalized) > 80:
        normalized = normalized[:80].rstrip(" .-_")
    if normalized:
        return normalized
    return fallback


def build_founder_project_folder_name(project_id: str, project_title: str | None = None) -> str:
    project_suffix = (project_id or "").strip()[:8] or "unknown"
    if project_title and project_title.strip():
        title = sanitize_opencloud_folder_name(project_title)
    else:
        title = "Projet Founder"
    return sanitize_opencloud_folder_name(f"{title} - {project_suffix}")


async def ensure_founder_project_workspace(project_id: str, project_title: str | None = None) -> dict[str, Any]:
    clean_project_id = (project_id or "").strip()
    root_folder = settings.OPENCLOUD_DEFAULT_ROOT_FOLDER
    project_folder = build_founder_project_folder_name(clean_project_id, project_title)
    folder_paths = [
        f"{root_folder}/{project_folder}",
        *(f"{root_folder}/{project_folder}/{segment}" for segment in _FOUNDER_WORKSPACE_SEGMENTS),
    ]
    result: dict[str, Any] = {
        "ok": False,
        "root_folder": root_folder,
        "project_id": clean_project_id,
        "project_title": project_title,
        "project_folder": project_folder,
        "folders": [],
        "error": None,
    }
    if not clean_project_id:
        result["error"] = "project_id is empty"
        return result

    for path in folder_paths:
        folder_result = await ensure_opencloud_folder(path)
        folder_ok = bool(folder_result.get("ok"))
        result["folders"].append(
            {
                "path": path,
                "ok": folder_ok,
                "result": folder_result,
            }
        )
        if not folder_ok:
            result["error"] = folder_result.get("error") or f"Failed to ensure folder: {path}"
            return result

    result["ok"] = True
    return result
