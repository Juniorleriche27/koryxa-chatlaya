from __future__ import annotations

import logging
from typing import Any

from app.core.config import settings
from app.services.core_api_client import (
    CoreAPIClientError,
    get_guest_enterprise_summary,
    get_guest_summary,
    get_guest_trajectory_summary,
    get_user_enterprise_summary,
    get_user_summary,
    get_user_trajectory_summary,
)


logger = logging.getLogger(__name__)


def _core_api_available() -> bool:
    return bool((settings.CORE_INTERNAL_API_BASE_URL or "").strip()) and bool((settings.INTERNAL_API_TOKEN or "").strip())


def _resolve_owner(current: dict | None, guest_id: str | None) -> dict[str, str]:
    if current and current.get("_id"):
        return {"user_id": str(current["_id"])}
    if guest_id:
        return {"guest_id": guest_id}
    return {}


def _format_user_context(summary: dict[str, Any] | None) -> str:
    if not summary:
        return "- aucun profil utilisateur disponible"

    return (
        f"- statut: {summary.get('status') or 'ND'}\n"
        f"- role workspace: {summary.get('workspace_role') or 'ND'}\n"
        f"- plan: {summary.get('plan') or 'ND'}"
    )


def _format_trajectory_context(summary: dict[str, Any] | None) -> str:
    if not summary:
        return "- aucune trajectoire recente disponible"

    next_actions = list(summary.get("next_actions") or [])[:3]
    actions = ", ".join(next_actions) if next_actions else "aucune action prioritaire disponible"
    recommended = summary.get("recommended_trajectory") or "trajectoire non generee"
    readiness = summary.get("readiness_score")

    return (
        f"- objectif: {summary.get('objective') or 'non precise'}\n"
        f"- trajectoire recommandee: {recommended}\n"
        f"- readiness: {readiness if readiness is not None else 'ND'}/100\n"
        f"- statut profil KORYXA: {summary.get('profile_status') or 'not_ready'}\n"
        f"- prochaines actions: {actions}"
    )


def _format_enterprise_context(summary: dict[str, Any] | None) -> str:
    if not summary:
        return "- aucun besoin entreprise recent disponible"

    return (
        f"- besoin: {summary.get('need_title') or 'sans titre'} ({summary.get('need_status') or 'ND'})\n"
        f"- mission: {summary.get('mission_title') or 'non structuree'} ({summary.get('mission_status') or 'ND'})"
    )


async def build_chatlaya_product_context(current: dict | None, guest_id: str | None) -> str:
    owner = _resolve_owner(current, guest_id)
    if not owner or not _core_api_available():
        return ""

    user_summary: dict[str, Any] | None = None
    trajectory_summary: dict[str, Any] | None = None
    enterprise_summary: dict[str, Any] | None = None

    try:
        if owner.get("user_id"):
            user_id = owner["user_id"]
            user_summary = await get_user_summary(user_id)
            trajectory_summary = await get_user_trajectory_summary(user_id)
            enterprise_summary = await get_user_enterprise_summary(user_id)
        elif owner.get("guest_id"):
            guest = owner["guest_id"]
            user_summary = await get_guest_summary(guest)
            trajectory_summary = await get_guest_trajectory_summary(guest)
            enterprise_summary = await get_guest_enterprise_summary(guest)
    except CoreAPIClientError as exc:
        logger.warning("chatlaya-service core context unavailable: %s", exc)
        return ""
    except Exception as exc:  # noqa: BLE001
        logger.warning("chatlaya-service unexpected core context error: %s", exc)
        return ""

    return (
        "Reperes produit KORYXA :\n"
        "- Blueprint = parcours d'orientation, diagnostic, progression et prochaines etapes.\n"
        "- Entreprise = cadrage d'un besoin, structuration d'une mission et lecture exploitable du contexte entreprise.\n"
        "- Service IA = studio d'execution pour construire et livrer des projets IA de bout en bout.\n"
        "- ChatLAYA = copilote conversationnel pour clarifier, cadrer et orienter l'utilisateur dans KORYXA.\n\n"
        "Profil utilisateur ou invite :\n"
        f"{_format_user_context(user_summary)}\n\n"
        "Contexte Blueprint le plus recent :\n"
        f"{_format_trajectory_context(trajectory_summary)}\n\n"
        "Contexte entreprise le plus recent :\n"
        f"{_format_enterprise_context(enterprise_summary)}"
    )
