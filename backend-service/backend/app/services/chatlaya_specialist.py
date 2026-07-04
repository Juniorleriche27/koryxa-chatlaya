from __future__ import annotations

import json
import logging
import re
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.core.ai import embed_texts
from app.core.config import settings
from app.services.postgres_bootstrap import get_pool


logger = logging.getLogger(__name__)

CHATLAYA_MODE_GENERAL = "general"
CHATLAYA_MODE_LAUNCH_STRUCTURE_SELL = "launch_structure_sell"
CHATLAYA_SUPPORTED_MODES = {
    CHATLAYA_MODE_GENERAL,
    CHATLAYA_MODE_LAUNCH_STRUCTURE_SELL,
}

_STOPWORDS = {
    "a",
    "ai",
    "au",
    "aux",
    "avec",
    "ce",
    "ces",
    "cette",
    "comment",
    "dans",
    "de",
    "des",
    "du",
    "elle",
    "en",
    "et",
    "est",
    "for",
    "how",
    "il",
    "ils",
    "je",
    "la",
    "le",
    "les",
    "leur",
    "ma",
    "mais",
    "mes",
    "mon",
    "nous",
    "our",
    "ou",
    "par",
    "pas",
    "plus",
    "pour",
    "que",
    "qui",
    "sa",
    "ses",
    "son",
    "sur",
    "the",
    "their",
    "to",
    "ton",
    "tu",
    "un",
    "une",
    "vos",
    "votre",
    "vous",
    "what",
    "when",
    "where",
    "why",
}

_INTENT_RULES: tuple[dict[str, tuple[str, ...]], ...] = (
    {
        "name": ("launch",),
        "triggers": (
            "lancer",
            "lancement",
            "launch",
            "start",
            "starting",
            "startup",
            "venture",
            "entrepreneur",
            "entrepreneurship",
            "projet",
            "project",
            "business",
            "company",
            "societe",
            "entreprise",
        ),
        "expansions": (
            "start",
            "startup",
            "venture",
            "entrepreneur",
            "entrepreneurship",
            "business",
            "company",
            "idea",
            "opportunity",
            "market",
            "customer",
            "problem",
        ),
        "priority_phrases": (
            "business idea",
            "new venture",
            "startup team",
            "target market",
        ),
    },
    {
        "name": ("business_plan",),
        "triggers": (
            "business",
            "plan",
            "business plan",
            "plan d affaires",
            "plan d affaire",
            "financial",
            "finance",
            "budget",
            "projection",
            "operations",
            "strategy",
        ),
        "expansions": (
            "business",
            "plan",
            "financial",
            "finance",
            "budget",
            "marketing",
            "operations",
            "mission",
            "summary",
            "strategy",
            "revenue",
            "cost",
            "customer",
        ),
        "priority_phrases": (
            "business plan",
            "executive summary",
            "marketing plan",
            "mission statement",
        ),
    },
    {
        "name": ("offer",),
        "triggers": (
            "offre",
            "offer",
            "service",
            "product",
            "pricing",
            "package",
            "packaging",
            "positioning",
            "positionnement",
            "proposition",
            "valeur",
            "value",
            "solution",
        ),
        "expansions": (
            "offer",
            "service",
            "product",
            "pricing",
            "price",
            "value",
            "proposition",
            "solution",
            "customer",
            "market",
            "benefit",
            "mission",
        ),
        "priority_phrases": (
            "value proposition",
            "target market",
            "customer needs",
            "product line",
        ),
    },
    {
        "name": ("sell",),
        "triggers": (
            "vendre",
            "vente",
            "sell",
            "sales",
            "closing",
            "marketing",
            "client",
            "clients",
            "customer",
            "customers",
            "acquisition",
            "prospect",
            "prospects",
            "pitch",
            "argumentaire",
            "revenue",
        ),
        "expansions": (
            "sell",
            "sales",
            "marketing",
            "customer",
            "customers",
            "client",
            "market",
            "promotion",
            "pricing",
            "revenue",
            "value",
            "proposition",
            "brand",
        ),
        "priority_phrases": (
            "sales process",
            "sales strategy",
            "marketing plan",
            "target customer",
        ),
    },
)

_SAFE_IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def coerce_assistant_mode(value: str | None) -> str:
    raw = (value or "").strip().lower()
    if raw in CHATLAYA_SUPPORTED_MODES:
        return raw
    return CHATLAYA_MODE_GENERAL


def is_strict_assistant_mode(value: str | None) -> bool:
    return coerce_assistant_mode(value) == CHATLAYA_MODE_LAUNCH_STRUCTURE_SELL


def _normalize_text(value: str | None) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFD", value.lower().strip())
    normalized = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)
    return " ".join(normalized.split())


def _tokenize(value: str | None) -> tuple[str, ...]:
    normalized = _normalize_text(value)
    if not normalized:
        return ()
    return tuple(token for token in normalized.split() if len(token) >= 3 and token not in _STOPWORDS)


def _build_query_phrases(tokens: tuple[str, ...]) -> tuple[str, ...]:
    phrases: list[str] = []
    for size in (3, 2):
        if len(tokens) < size:
            continue
        for index in range(0, len(tokens) - size + 1):
            phrases.append(" ".join(tokens[index : index + size]))
    return tuple(dict.fromkeys(phrases))


def _matches_rule(query_normalized: str, query_token_set: set[str], values: tuple[str, ...]) -> bool:
    for value in values:
        normalized_value = _normalize_text(value)
        if not normalized_value:
            continue
        if " " in normalized_value:
            if normalized_value in query_normalized:
                return True
            continue
        if normalized_value in query_token_set:
            return True
    return False


def _expand_query(query: str) -> tuple[set[str], tuple[str, ...], tuple[str, ...]]:
    query_normalized = _normalize_text(query)
    query_tokens = _tokenize(query)
    query_token_set = set(query_tokens)
    expansion_tokens: set[str] = set(query_token_set)
    expansion_phrases: list[str] = []
    matched_intents: list[str] = []

    for rule in _INTENT_RULES:
        if not _matches_rule(query_normalized, query_token_set, rule["triggers"]):
            continue
        matched_intents.extend(rule["name"])
        expansion_tokens.update(_tokenize(" ".join(rule["expansions"])))
        expansion_phrases.extend(rule["priority_phrases"])

    return expansion_tokens, tuple(dict.fromkeys(expansion_phrases)), tuple(dict.fromkeys(matched_intents))


def _chunks_path() -> Path:
    return Path(__file__).resolve().parents[5] / "chatlaya" / "prepared" / "supabase_chunks.jsonl"


def _vector_literal(values: list[float]) -> str:
    return "[" + ",".join(f"{float(value):.8f}" for value in values) + "]"


def _normalize_meta(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            return {}
    return {}


def _build_tsquery_expression(query: str) -> str:
    base_tokens = list(_tokenize(query))
    expanded_tokens, _, _ = _expand_query(query)
    ordered_tokens = list(dict.fromkeys([*base_tokens, *sorted(expanded_tokens)]))
    safe_tokens = [token for token in ordered_tokens if token and "'" not in token]
    if not safe_tokens:
        return ""
    return " | ".join(safe_tokens[:24])


def _pick_existing_column(columns: set[str], ordered_names: tuple[str, ...]) -> str | None:
    for name in ordered_names:
        if name in columns:
            return name
    return None


def _identifier_or_none(value: str | None) -> str | None:
    raw = (value or "").strip()
    if not raw:
        return None
    if not _SAFE_IDENTIFIER_RE.match(raw):
        logger.warning("ChatLAYA specialist identifier rejected: %s", raw)
        return None
    return raw


def _db_ready() -> bool:
    return get_pool() is not None


async def _has_match_rag_chunks_function() -> bool:
    pool = get_pool()
    if pool is None:
        return False
    try:
        async with pool.acquire() as conn:
            exists = await conn.fetchval(
                "select to_regprocedure('app.match_rag_chunks(vector,integer,text)') is not null as exists;"
            )
        return bool(exists)
    except Exception as exc:  # noqa: BLE001
        logger.warning("ChatLAYA specialist function discovery failed: %s", exc)
        return False


async def _retrieve_specialist_chunks_via_match_function(query: str, top_k: int) -> list[dict[str, Any]]:
    pool = get_pool()
    if pool is None or not await _has_match_rag_chunks_function():
        return []

    text_query = query.strip()
    if not text_query:
        return []

    try:
        embedding = embed_texts([text_query])[0]
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to embed ChatLAYA specialist query for app.match_rag_chunks: %s", exc)
        return []

    corpus_filter = settings.CHATLAYA_SPECIALIST_FILTER_VALUE or CHATLAYA_MODE_LAUNCH_STRUCTURE_SELL
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                select *
                from app.match_rag_chunks($1::vector, $2, $3);
                """,
                _vector_literal(embedding),
                max(1, min(int(top_k), 10)),
                corpus_filter,
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("app.match_rag_chunks query failed: %s", exc)
        return []

    results: list[dict[str, Any]] = []
    for row in rows:
        row_dict = dict(row)
        text = str(row_dict.get("content") or "").strip()
        if not text:
            continue
        meta = _normalize_meta(row_dict.get("metadata"))
        title = str(row_dict.get("title") or meta.get("title") or row_dict.get("document_id") or "").strip()
        source_file = str(
            row_dict.get("source_file")
            or meta.get("source_file")
            or meta.get("source")
            or meta.get("path")
            or ""
        ).strip()
        results.append(
            {
                "doc_id": row_dict.get("document_id") or meta.get("document_id") or meta.get("doc_id"),
                "score": round(float(row_dict.get("score") or 0.0), 4),
                "text": text,
                "meta": {
                    "title": title,
                    "source_file": source_file,
                    "assistant_mode": CHATLAYA_MODE_LAUNCH_STRUCTURE_SELL,
                    "retrieval_mode": "supabase_vector_function",
                },
            }
        )
    return results


async def _discover_specialist_vector_store() -> dict[str, str] | None:
    pool = get_pool()
    if pool is None:
        return None

    schema_name = _identifier_or_none(settings.CHATLAYA_SPECIALIST_SCHEMA)
    table_name = _identifier_or_none(settings.CHATLAYA_SPECIALIST_TABLE)
    if not schema_name or not table_name:
        return None

    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                select column_name
                from information_schema.columns
                where table_schema = $1 and table_name = $2;
                """,
                schema_name,
                table_name,
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("ChatLAYA specialist override discovery failed: %s", exc)
        return None

    column_set = {str(dict(row).get("column_name") or "") for row in rows}
    if "embedding" not in column_set:
        logger.warning(
            "ChatLAYA specialist table override %s.%s does not expose an embedding column",
            schema_name,
            table_name,
        )
        return None

    text_col = _pick_existing_column(column_set, ("content", "text", "chunk_text", "page_content", "body"))
    if not text_col:
        logger.warning(
            "ChatLAYA specialist table override %s.%s does not expose a usable text column",
            schema_name,
            table_name,
        )
        return None

    return {
        "schema": schema_name,
        "table": table_name,
        "embedding_col": "embedding",
        "text_col": text_col,
        "doc_id_col": _pick_existing_column(column_set, ("document_id", "doc_id", "id")) or "",
        "title_col": _pick_existing_column(column_set, ("title", "document_title", "name")) or "",
        "source_col": _pick_existing_column(column_set, ("source_file", "source_path", "file_path", "path", "source")) or "",
        "meta_col": _pick_existing_column(column_set, ("metadata", "meta")) or "",
        "filter_col": _identifier_or_none(settings.CHATLAYA_SPECIALIST_FILTER_COLUMN) or "",
        "filter_value": (settings.CHATLAYA_SPECIALIST_FILTER_VALUE or "").strip(),
    }


async def _retrieve_specialist_chunks_from_pg(query: str, top_k: int) -> list[dict[str, Any]]:
    pool = get_pool()
    if pool is None:
        return []

    cfg = await _discover_specialist_vector_store()
    if not cfg:
        return []

    text_query = query.strip()
    if not text_query:
        return []

    try:
        embedding = embed_texts([text_query])[0]
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to embed ChatLAYA specialist query for vector retrieval: %s", exc)
        return []

    select_doc_id = f'{cfg["doc_id_col"]}::text as doc_id' if cfg.get("doc_id_col") else "null::text as doc_id"
    select_title = f'{cfg["title_col"]}::text as title' if cfg.get("title_col") else "null::text as title"
    select_source = f'{cfg["source_col"]}::text as source_file' if cfg.get("source_col") else "null::text as source_file"
    select_meta = f'{cfg["meta_col"]} as meta' if cfg.get("meta_col") else "null::jsonb as meta"

    where_clauses = [f"coalesce({cfg['text_col']}::text, '') <> ''"]
    params: list[Any] = []
    if cfg.get("filter_col") and cfg.get("filter_value"):
        where_clauses.append(f"{cfg['filter_col']}::text = ${len(params) + 1}")
        params.append(cfg["filter_value"])

    vector_param_index = len(params) + 1
    limit_param_index = len(params) + 2
    query_sql = f"""
        select
          {select_doc_id},
          {cfg["text_col"]}::text as text,
          {select_title},
          {select_source},
          {select_meta},
          1 - ({cfg["embedding_col"]} <=> ${vector_param_index}::vector) as score
        from {cfg["schema"]}.{cfg["table"]}
        where {' and '.join(where_clauses)}
        order by {cfg["embedding_col"]} <=> ${vector_param_index}::vector asc
        limit ${limit_param_index};
    """
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                query_sql,
                *params,
                _vector_literal(embedding),
                max(1, min(int(top_k), 10)),
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("ChatLAYA specialist vector query failed: %s", exc)
        return []

    results: list[dict[str, Any]] = []
    for row in rows:
        row_dict = dict(row)
        text = str(row_dict.get("text") or "").strip()
        if not text:
            continue
        meta = _normalize_meta(row_dict.get("meta"))
        title = str(row_dict.get("title") or meta.get("title") or row_dict.get("doc_id") or "").strip()
        source_file = str(
            row_dict.get("source_file")
            or meta.get("source_file")
            or meta.get("source")
            or meta.get("path")
            or ""
        ).strip()
        results.append(
            {
                "doc_id": row_dict.get("doc_id") or meta.get("document_id") or meta.get("doc_id"),
                "score": round(float(row_dict.get("score") or 0.0), 4),
                "text": text,
                "meta": {
                    "title": title,
                    "source_file": source_file,
                    "assistant_mode": CHATLAYA_MODE_LAUNCH_STRUCTURE_SELL,
                    "retrieval_mode": "supabase_vector",
                },
            }
        )
    return results


async def _retrieve_specialist_chunks_from_rag_tables(query: str, top_k: int) -> list[dict[str, Any]]:
    pool = get_pool()
    if pool is None:
        return []

    tsquery = _build_tsquery_expression(query)
    if not tsquery:
        return []

    corpus_filter = settings.CHATLAYA_SPECIALIST_FILTER_VALUE or CHATLAYA_MODE_LAUNCH_STRUCTURE_SELL

    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                with q as (
                    select to_tsquery('simple', $1) as tsq
                )
                select
                    c.document_id::text as doc_id,
                    c.content::text as text,
                    c.title::text as title,
                    c.source_file::text as source_file,
                    c.metadata as metadata,
                    ts_rank_cd(setweight(c.content_tsv, 'C'), q.tsq) as score
                from app.rag_chunks c
                join app.rag_documents d on d.id = c.document_id
                cross join q
                where coalesce(d.metadata->>'corpus', '') = $2
                  and c.content_tsv is not null
                  and setweight(c.content_tsv, 'C') @@ q.tsq
                order by score desc, c.chunk_index asc
                limit $3
                """,
                tsquery,
                corpus_filter,
                max(1, min(int(top_k), 10)),
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("ChatLAYA specialist RAG table query failed: %r", exc)
        return []

    results: list[dict[str, Any]] = []
    for row in rows:
        row_dict = dict(row)
        text = str(row_dict.get("text") or "").strip()
        if not text:
            continue

        meta = _normalize_meta(row_dict.get("metadata"))
        title = str(row_dict.get("title") or meta.get("title") or row_dict.get("doc_id") or "").strip()
        source_file = str(
            row_dict.get("source_file")
            or meta.get("source_file")
            or meta.get("source")
            or meta.get("path")
            or ""
        ).strip()

        results.append(
            {
                "doc_id": row_dict.get("doc_id") or meta.get("document_id") or meta.get("doc_id"),
                "score": round(float(row_dict.get("score") or 0.0), 4),
                "text": text,
                "meta": {
                    "title": title,
                    "source_file": source_file,
                    "assistant_mode": CHATLAYA_MODE_LAUNCH_STRUCTURE_SELL,
                    "retrieval_mode": "supabase_text_rag_tables",
                },
            }
        )

    return results


@lru_cache(maxsize=1)
def _load_launch_structure_sell_chunks() -> tuple[dict[str, Any], ...]:
    path = _chunks_path()
    if not path.is_file():
        logger.warning("ChatLAYA specialist corpus not found: %s", path)
        return ()

    records: list[dict[str, Any]] = []
    try:
        with path.open("r", encoding="utf-8") as handle:
            for raw_line in handle:
                line = raw_line.strip()
                if not line:
                    continue
                payload = json.loads(line)
                text = str(payload.get("text") or "").strip()
                if not text:
                    continue
                title = str(payload.get("title") or payload.get("document_id") or "").strip()
                tokens = _tokenize(f"{title} {text}")
                records.append(
                    {
                        "doc_id": payload.get("document_id") or payload.get("doc_id"),
                        "title": title,
                        "source_file": payload.get("source_file"),
                        "text": text,
                        "normalized_text": _normalize_text(text),
                        "title_source_normalized": _normalize_text(f"{title} {payload.get('source_file') or ''}"),
                        "token_set": set(tokens),
                        "title_source_token_set": set(_tokenize(f"{title} {payload.get('source_file') or ''}")),
                    }
                )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to load ChatLAYA specialist corpus: %s", exc)
        return ()

    return tuple(records)


async def retrieve_specialist_chunks(
    query: str,
    assistant_mode: str,
    top_k: int = 3,
) -> list[dict[str, Any]]:
    if coerce_assistant_mode(assistant_mode) != CHATLAYA_MODE_LAUNCH_STRUCTURE_SELL:
        return []

    if _db_ready():
        # Cohere désactivé dans le runtime ChatLAYA.
        # On évite les recherches vectorielles live car elles appellent embed_texts().
        # Le mode LSV utilise donc la recherche textuelle PostgreSQL content_tsv.
        rag_results = await _retrieve_specialist_chunks_from_rag_tables(query, top_k=top_k)
        if rag_results:
            return rag_results

    chunks = _load_launch_structure_sell_chunks()
    if not chunks:
        return []

    query_tokens = _tokenize(query)
    if not query_tokens:
        return []

    query_token_set = set(query_tokens)
    query_phrases = _build_query_phrases(query_tokens)
    query_normalized = _normalize_text(query)
    expanded_query_token_set, priority_phrases, matched_intents = _expand_query(query)
    ranked: list[tuple[float, dict[str, Any]]] = []

    for chunk in chunks:
        original_overlap = query_token_set & chunk["token_set"]
        expanded_overlap = (expanded_query_token_set - query_token_set) & chunk["token_set"]
        score = 0.0

        if original_overlap:
            score += len(original_overlap) * 6.0
            score += (len(original_overlap) / max(1, len(query_token_set))) * 11.0

        if expanded_overlap:
            score += len(expanded_overlap) * 2.5
            score += (len(expanded_overlap) / max(1, len(expanded_query_token_set))) * 5.0

        normalized_text = chunk["normalized_text"]
        if query_normalized and len(query_normalized.split()) >= 4 and query_normalized in normalized_text:
            score += 18.0

        if query_phrases:
            score += sum(4.5 for phrase in query_phrases if phrase in normalized_text)

        if priority_phrases:
            score += sum(4.0 for phrase in priority_phrases if phrase in normalized_text)

        title_source_normalized = chunk["title_source_normalized"]
        title_source_token_set = chunk["title_source_token_set"]
        title_original_overlap = query_token_set & title_source_token_set
        title_expanded_overlap = (expanded_query_token_set - query_token_set) & title_source_token_set
        if title_original_overlap:
            score += len(title_original_overlap) * 3.5
        if title_expanded_overlap:
            score += len(title_expanded_overlap) * 1.5
        if priority_phrases:
            score += sum(2.5 for phrase in priority_phrases if phrase in title_source_normalized)

        if matched_intents:
            for intent in matched_intents:
                if intent == "business_plan" and "business plan" in title_source_normalized:
                    score += 6.0
                elif intent == "offer" and "value proposition" in normalized_text:
                    score += 4.0
                elif intent == "sell" and ("sales" in normalized_text or "marketing" in normalized_text):
                    score += 4.0
                elif intent == "launch" and ("startup" in normalized_text or "new venture" in normalized_text):
                    score += 4.0

        if not score:
            continue

        ranked.append(
            (
                score,
                {
                    "doc_id": chunk.get("doc_id"),
                    "score": round(score, 4),
                    "text": chunk["text"],
                    "meta": {
                        "title": chunk.get("title"),
                        "source_file": chunk.get("source_file"),
                        "assistant_mode": CHATLAYA_MODE_LAUNCH_STRUCTURE_SELL,
                        "retrieval_mode": "local_fallback",
                    },
                },
            )
        )

    ranked.sort(key=lambda item: item[0], reverse=True)
    limit = max(1, min(top_k, 12))
    selected: list[dict[str, Any]] = []
    doc_counts: dict[str, int] = {}
    for _, item in ranked:
        doc_id = str(item.get("doc_id") or "")
        if doc_id and doc_counts.get(doc_id, 0) >= 2:
            continue
        selected.append(item)
        if doc_id:
            doc_counts[doc_id] = doc_counts.get(doc_id, 0) + 1
        if len(selected) >= limit:
            break
    return selected
