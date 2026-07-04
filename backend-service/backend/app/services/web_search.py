"""Web search for ChatLAYA Mode Fondateur — Tavily only."""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_TAVILY_URL = "https://api.tavily.com/search"
_TIMEOUT = 8.0


async def search_web(query: str, max_results: int | None = None) -> list[dict[str, Any]]:
    """Search via Tavily. Returns [] if disabled, not configured, or on any failure."""
    if not settings.WEB_SEARCH_ENABLED or not settings.TAVILY_API_KEY:
        return []
    n = max_results or settings.WEB_SEARCH_MAX_RESULTS
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                _TAVILY_URL,
                json={
                    "api_key": settings.TAVILY_API_KEY,
                    "query": query,
                    "search_depth": "basic",
                    "max_results": n,
                    "include_answer": False,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            results = [
                {
                    "title": r.get("title", "").strip(),
                    "url": r.get("url", ""),
                    "snippet": r.get("content", "").strip(),
                }
                for r in data.get("results", [])
                if r.get("content") or r.get("title")
            ]
            logger.debug("Tavily: %d results for %r", len(results), query[:60])
            return results
    except Exception as exc:  # noqa: BLE001
        logger.warning("Tavily web search failed: %s", exc)
        return []


def format_web_context(results: list[dict[str, Any]]) -> str:
    """Format search results as a compact numbered block for LLM injection."""
    if not results:
        return ""
    lines = []
    for i, r in enumerate(results, 1):
        title = r.get("title", "")
        snippet = r.get("snippet", "")
        if snippet:
            lines.append(f"{i}. {title} : {snippet}" if title else f"{i}. {snippet}")
    return "\n".join(lines)
