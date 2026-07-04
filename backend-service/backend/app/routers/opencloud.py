from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel

from app.core.config import settings
from app.services.opencloud_client import (
    check_opencloud_reachability,
    check_opencloud_webdav_auth,
    ensure_default_founder_root_folder,
    ensure_founder_project_workspace,
)


router = APIRouter()


class FounderWorkspaceEnsurePayload(BaseModel):
    project_id: str
    project_title: str | None = None


def _require_internal_token(x_internal_token: str | None) -> None:
    expected = (settings.INTERNAL_API_TOKEN or "").strip()
    provided = (x_internal_token or "").strip()
    if not expected or not provided or provided != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")


@router.get("/chatlaya/internal/opencloud/health")
async def opencloud_health(
    x_internal_token: str | None = Header(default=None, alias="X-Internal-Token"),
) -> dict[str, object]:
    _require_internal_token(x_internal_token)
    reachability = await check_opencloud_reachability()
    webdav = await check_opencloud_webdav_auth()
    return {
        "reachability": reachability,
        "webdav": webdav,
    }


@router.post("/chatlaya/internal/opencloud/founder-root/ensure")
async def ensure_opencloud_founder_root(
    x_internal_token: str | None = Header(default=None, alias="X-Internal-Token"),
) -> dict[str, object]:
    _require_internal_token(x_internal_token)
    return await ensure_default_founder_root_folder()


@router.post("/chatlaya/internal/opencloud/founder-project/ensure")
async def ensure_opencloud_founder_project(
    payload: FounderWorkspaceEnsurePayload,
    x_internal_token: str | None = Header(default=None, alias="X-Internal-Token"),
) -> dict[str, object]:
    _require_internal_token(x_internal_token)
    return await ensure_founder_project_workspace(
        project_id=payload.project_id,
        project_title=payload.project_title,
    )
