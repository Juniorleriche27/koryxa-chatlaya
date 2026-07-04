from __future__ import annotations

import logging
from typing import Any, Dict, List

import httpx

from app.core.config import settings


logger = logging.getLogger(__name__)


def _build_rag_url() -> str | None:
    base = (settings.RAG_API_URL or "").strip()
    if not base:
        return None
    return base.rstrip("/") + "/query"


async def retrieve_rag_results(query: str, top_k: int | None = None) -> List[Dict[str, Any]]:
    endpoint = _build_rag_url()
    if not endpoint:
        logger.debug("RAG API URL not configured; skipping retrieval.")
        return []
    if not query.strip():
        return []

    requested_top_k = top_k if top_k is not None else settings.RAG_TOP_K_DEFAULT
    payload = {
        "query": query.strip(),
        "top_k": max(1, min(int(requested_top_k), 10)),
    }

    timeout = max(1.0, float(settings.RAG_API_TIMEOUT or 8.0))
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(endpoint, json=payload)
            response.raise_for_status()
            data = response.json()
    except httpx.TimeoutException as exc:
        logger.warning("RAG query timed out: %s", exc)
        return []
    except httpx.HTTPStatusError as exc:
        logger.warning("RAG query failed [%s]: %s", exc.response.status_code, exc.response.text.strip())
        return []
    except httpx.HTTPError as exc:
        logger.warning("RAG query HTTP error: %s", exc)
        return []
    except ValueError as exc:
        logger.warning("RAG query returned invalid JSON: %s", exc)
        return []
    except Exception as exc:  # noqa: BLE001
        logger.warning("RAG query failed: %s", exc)
        return []

    results = data.get("results") if isinstance(data, dict) else None
    if not isinstance(results, list):
        logger.debug("Unexpected RAG response format: %s", data)
        return []

    cleaned: List[Dict[str, Any]] = []
    for item in results:
        if not isinstance(item, dict):
            continue
        text = (item.get("text") or "").strip()
        if not text:
            continue
        cleaned.append(
            {
                "doc_id": item.get("doc_id"),
                "score": item.get("score"),
                "text": text,
                "meta": item.get("meta") or {},
            }
        )
    return cleaned
