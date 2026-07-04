from __future__ import annotations

import logging
import asyncio
import threading
import time
from datetime import datetime, timezone
from typing import Any, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sse_starlette.sse import EventSourceResponse

from app.core.public_access import ensure_guest_id, get_guest_id
from app.deps.auth import get_current_user_optional
from app.repositories.chatlaya_pg import (
    archive_conversation as archive_conversation_pg,
    create_conversation as create_conversation_pg,
    create_message,
    create_problem_report as create_problem_report_pg,
    get_conversation,
    get_latest_active_conversation,
    get_message,
    list_conversations as list_conversations_pg,
    list_messages as list_messages_pg,
    list_recent_messages,
    touch_conversation,
    update_conversation_mode,
)
from app.schemas.chatlaya import (
    ChatMessageItem,
    ChatMessagePayload,
    ConversationUpdatePayload,
    ConversationListResponse,
    ConversationResponse,
    MessagesResponse,
    ProblemReportCategoriesResponse,
    ProblemReportCategoryItem,
    ProblemReportCreatePayload,
    ProblemReportResponse,
    PROBLEM_REPORT_DOMAINS,
    PROBLEM_REPORT_EVIDENCE_TYPES,
    PROBLEM_REPORT_FREQUENCIES,
    PROBLEM_REPORT_SEVERITIES,
    PROBLEM_REPORT_ZONE_TYPES,
)
from app.services.chatlaya_context import build_chatlaya_product_context
from app.services.chatlaya_specialist import CHATLAYA_MODE_GENERAL, coerce_assistant_mode
from app.services.chatlaya_service import generate_chat_reply


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chatlaya", tags=["chatlaya"])

DEFAULT_CONVERSATION_TITLE = "Nouvelle conversation"
GUEST_MESSAGE_LIMIT = 12
GUEST_MESSAGE_WINDOW_S = 60 * 10
_GUEST_CHAT_BUCKETS: dict[str, list[float]] = {}
_GUEST_CHAT_LOCK = threading.Lock()


def _stream_chunks(text: str, size: int = 24) -> list[str]:
    chunks: list[str] = []
    current = ""
    for part in text.split(" "):
        next_value = f"{current} {part}".strip()
        if len(next_value) >= size and current:
            chunks.append(current + " ")
            current = part
        else:
            current = next_value
    if current:
        chunks.append(current)
    return chunks


def _serialize_conversation(doc: dict) -> ConversationResponse:
    return ConversationResponse(
        conversation_id=str(doc["_id"]),
        title=doc.get("title") or DEFAULT_CONVERSATION_TITLE,
        created_at=doc.get("created_at"),
        updated_at=doc.get("updated_at"),
        archived=bool(doc.get("archived", False)),
        assistant_mode=coerce_assistant_mode(doc.get("assistant_mode")),
    )


def _serialize_message(doc: dict) -> ChatMessageItem:
    return ChatMessageItem(
        id=str(doc["_id"]),
        role=doc.get("role", "assistant"),
        content=doc.get("content", ""),
        created_at=doc.get("created_at"),
    )


def _owner_filter(current: dict | None, guest_id: str | None) -> dict[str, Any]:
    if current:
        return {"user_id": current["_id"]}
    if not guest_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session invitée introuvable")
    return {"guest_id": guest_id}


def _apply_guest_rate_limit(guest_id: str) -> None:
    now = time.monotonic()
    with _GUEST_CHAT_LOCK:
        bucket = [ts for ts in _GUEST_CHAT_BUCKETS.get(guest_id, []) if now - ts < GUEST_MESSAGE_WINDOW_S]
        if len(bucket) >= GUEST_MESSAGE_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Limite atteinte pour le mode invité. Réessayez dans quelques minutes.",
            )
        bucket.append(now)
        _GUEST_CHAT_BUCKETS[guest_id] = bucket


def _parse_conversation_id(value: str) -> str:
    try:
        return str(UUID(str(value)))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Conversation invalide") from exc


def _parse_optional_uuid(value: str | None, field_label: str) -> str | None:
    if value is None:
        return None
    try:
        return str(UUID(str(value)))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field_label} invalide") from exc


def _problem_report_categories() -> ProblemReportCategoriesResponse:
    return ProblemReportCategoriesResponse(
        domains=[ProblemReportCategoryItem(**item) for item in PROBLEM_REPORT_DOMAINS],
        zone_types=[ProblemReportCategoryItem(**item) for item in PROBLEM_REPORT_ZONE_TYPES],
        severities=[ProblemReportCategoryItem(**item) for item in PROBLEM_REPORT_SEVERITIES],
        frequencies=[ProblemReportCategoryItem(**item) for item in PROBLEM_REPORT_FREQUENCIES],
        evidence_types=[ProblemReportCategoryItem(**item) for item in PROBLEM_REPORT_EVIDENCE_TYPES],
    )


async def _ensure_conversation(
    current: dict | None,
    guest_id: str | None,
) -> dict:
    owner = _owner_filter(current, guest_id)
    existing = await get_latest_active_conversation(
        user_id=owner.get("user_id"),
        guest_id=owner.get("guest_id"),
    )
    if existing:
        return existing

    now = datetime.now(timezone.utc)
    return await create_conversation_pg(
        user_id=owner.get("user_id"),
        guest_id=owner.get("guest_id"),
        title=DEFAULT_CONVERSATION_TITLE,
        assistant_mode=CHATLAYA_MODE_GENERAL,
        now=now,
    )


@router.post("/session")
async def start_session(
    request: Request,
    response: Response,
    current: dict | None = Depends(get_current_user_optional),
):
    guest_id = get_guest_id(request) if current else ensure_guest_id(request, response)
    conversation = await _ensure_conversation(current, guest_id)
    return {"conversation_id": str(conversation["_id"]), "mode": "user" if current else "guest"}


@router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations(
    request: Request,
    response: Response,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    current: dict | None = Depends(get_current_user_optional),
):
    guest_id = get_guest_id(request) if current else ensure_guest_id(request, response)
    skip = (page - 1) * limit
    owner = _owner_filter(current, guest_id)
    rows = await list_conversations_pg(
        user_id=owner.get("user_id"),
        guest_id=owner.get("guest_id"),
        limit=limit,
        offset=skip,
    )
    items: List[ConversationResponse] = [_serialize_conversation(doc) for doc in rows]
    return ConversationListResponse(items=items, page=page, limit=limit)


@router.post("/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    request: Request,
    response: Response,
    current: dict | None = Depends(get_current_user_optional),
):
    guest_id = get_guest_id(request) if current else ensure_guest_id(request, response)
    now = datetime.now(timezone.utc)
    owner = _owner_filter(current, guest_id)
    doc = await create_conversation_pg(
        user_id=owner.get("user_id"),
        guest_id=owner.get("guest_id"),
        title=DEFAULT_CONVERSATION_TITLE,
        assistant_mode=CHATLAYA_MODE_GENERAL,
        now=now,
    )
    return _serialize_conversation(doc)


@router.patch("/conversations/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: str,
    payload: ConversationUpdatePayload,
    request: Request,
    response: Response,
    current: dict | None = Depends(get_current_user_optional),
):
    guest_id = get_guest_id(request) if current else ensure_guest_id(request, response)
    conv_id = _parse_conversation_id(conversation_id)
    owner = _owner_filter(current, guest_id)
    result = await update_conversation_mode(
        conversation_id=conv_id,
        user_id=owner.get("user_id"),
        guest_id=owner.get("guest_id"),
        assistant_mode=coerce_assistant_mode(payload.assistant_mode),
        updated_at=datetime.now(timezone.utc),
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation introuvable")
    return _serialize_conversation(result)


@router.post("/conversations/{conversation_id}/archive", status_code=status.HTTP_204_NO_CONTENT)
async def archive_conversation(
    conversation_id: str,
    request: Request,
    response: Response,
    current: dict | None = Depends(get_current_user_optional),
):
    guest_id = get_guest_id(request) if current else ensure_guest_id(request, response)
    conv_id = _parse_conversation_id(conversation_id)
    owner = _owner_filter(current, guest_id)
    archived = await archive_conversation_pg(
        conversation_id=conv_id,
        user_id=owner.get("user_id"),
        guest_id=owner.get("guest_id"),
        updated_at=datetime.now(timezone.utc),
    )
    if not archived:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation introuvable")
    return None


@router.get("/messages", response_model=MessagesResponse)
async def list_messages(
    request: Request,
    response: Response,
    conversation_id: str = Query(..., alias="conversation_id"),
    current: dict | None = Depends(get_current_user_optional),
):
    guest_id = get_guest_id(request) if current else ensure_guest_id(request, response)
    conv_id = _parse_conversation_id(conversation_id)
    owner = _owner_filter(current, guest_id)
    conversation = await get_conversation(
        conversation_id=conv_id,
        user_id=owner.get("user_id"),
        guest_id=owner.get("guest_id"),
    )
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation introuvable")

    items: List[ChatMessageItem] = [
        _serialize_message(doc) for doc in await list_messages_pg(conversation_id=conv_id)
    ]
    return MessagesResponse(items=items)


@router.get("/problem-report-categories", response_model=ProblemReportCategoriesResponse)
async def get_problem_report_categories():
    return _problem_report_categories()


@router.post("/problem-reports", response_model=ProblemReportResponse, status_code=status.HTTP_201_CREATED)
async def create_problem_report(
    payload: ProblemReportCreatePayload,
    request: Request,
    response: Response,
    current: dict | None = Depends(get_current_user_optional),
):
    guest_id = get_guest_id(request) if current else ensure_guest_id(request, response)
    owner = _owner_filter(current, guest_id)

    conversation_id = _parse_optional_uuid(payload.conversation_id, "conversation_id")
    message_id = _parse_optional_uuid(payload.message_id, "message_id")

    if conversation_id is not None:
        conversation = await get_conversation(
            conversation_id=conversation_id,
            user_id=owner.get("user_id"),
            guest_id=owner.get("guest_id"),
        )
        if not conversation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation introuvable")

    if message_id is not None:
        message = await get_message(
            message_id=message_id,
            user_id=owner.get("user_id"),
            guest_id=owner.get("guest_id"),
        )
        if not message:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message introuvable")

        if conversation_id is not None and message.get("conversation_id") != conversation_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="message_id n'appartient pas à la conversation fournie",
            )
        if conversation_id is None:
            conversation_id = str(message.get("conversation_id") or "")

    report = await create_problem_report_pg(
        user_id=owner.get("user_id"),
        conversation_id=conversation_id,
        message_id=message_id,
        country=payload.country,
        region=payload.region,
        city=payload.city,
        commune=payload.commune,
        zone_type=payload.zone_type,
        domain=payload.domain,
        sector=payload.sector,
        problem_title=payload.problem_title,
        problem_description=payload.problem_description,
        affected_population=payload.affected_population,
        severity=payload.severity,
        frequency=payload.frequency,
        perceived_cause=payload.perceived_cause,
        proposed_solution=payload.proposed_solution,
        evidence_type=payload.evidence_type,
        consent_anonymized=payload.consent_anonymized,
        source_channel=payload.source_channel,
        raw_payload=payload.raw_payload,
    )
    return ProblemReportResponse(**report)


@router.post("/message")
async def post_message(
    payload: ChatMessagePayload,
    request: Request,
    current: dict | None = Depends(get_current_user_optional),
):
    response = Response()
    guest_id = get_guest_id(request) if current else ensure_guest_id(request, response)
    if not current:
        _apply_guest_rate_limit(guest_id)

    conv_id = _parse_conversation_id(payload.conversation_id)
    owner = _owner_filter(current, guest_id)
    conversation = await get_conversation(
        conversation_id=conv_id,
        user_id=owner.get("user_id"),
        guest_id=owner.get("guest_id"),
    )
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation introuvable")

    now = datetime.now(timezone.utc)
    await create_message(
        conversation_id=conv_id,
        role="user",
        content=payload.message,
        user_id=owner.get("user_id"),
        guest_id=owner.get("guest_id"),
        meta={},
        created_at=now,
    )

    title = conversation.get("title") or DEFAULT_CONVERSATION_TITLE
    if title == DEFAULT_CONVERSATION_TITLE:
        snippet = payload.message.strip().replace("\n", " ")
        if snippet:
            title = snippet[:80]
    await touch_conversation(conversation_id=conv_id, title=title, updated_at=now)

    history_docs = await list_recent_messages(conversation_id=conv_id, limit=12)
    history_docs = history_docs[-8:]
    chat_history = [
        {"role": doc.get("role", "assistant"), "content": doc.get("content", "")}
        for doc in history_docs
    ]

    try:
        product_context = await build_chatlaya_product_context(current, guest_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("ChatLAYA product context build failed: %s", exc)
        product_context = ""
    assistant_mode = coerce_assistant_mode(conversation.get("assistant_mode"))
    async def event_generator():
        queue: asyncio.Queue[tuple[str, str]] = asyncio.Queue()
        loop = asyncio.get_running_loop()
        streamed_any = False

        def on_token(token: str) -> None:
            if not token:
                return
            if len(token) > 160:
                for chunk in _stream_chunks(token):
                    loop.call_soon_threadsafe(queue.put_nowait, ("token", chunk))
                return
            loop.call_soon_threadsafe(queue.put_nowait, ("token", token))

        async def run_generation() -> None:
            try:
                reply, rag_sources = await generate_chat_reply(
                    payload.message,
                    chat_history,
                    product_context=product_context,
                    assistant_mode=assistant_mode,
                    on_token=on_token,
                )
                assistant_now = datetime.now(timezone.utc)
                await create_message(
                    conversation_id=conv_id,
                    role="assistant",
                    content=reply,
                    user_id=owner.get("user_id"),
                    guest_id=owner.get("guest_id"),
                    meta={"rag_sources": rag_sources} if rag_sources else {},
                    created_at=assistant_now,
                )
                await touch_conversation(
                    conversation_id=conv_id,
                    title=title,
                    updated_at=assistant_now,
                )
                await queue.put(("complete", reply))
            except Exception as exc:  # noqa: BLE001
                logger.exception("ChatLAYA streaming generation failed: %s", exc)
                await queue.put(("error", "Erreur de génération. Réessayez dans un instant."))

        task = asyncio.create_task(run_generation())
        try:
            while True:
                event, data = await queue.get()
                if event == "token":
                    streamed_any = True
                    yield {"event": "token", "data": data}
                    continue
                if event == "complete":
                    if not streamed_any:
                        for chunk in _stream_chunks(data):
                            yield {"event": "token", "data": chunk}
                            await asyncio.sleep(0.015)
                    yield {"event": "done", "data": "done"}
                    break
                if event == "error":
                    yield {"event": "error", "data": data}
                    break
        finally:
            if not task.done():
                task.cancel()

    sse_response = EventSourceResponse(
        event_generator(),
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
    )
    if not current and guest_id and not get_guest_id(request):
        sse_response.set_cookie(
            "koryxa_guest",
            guest_id,
            max_age=60 * 60 * 24 * 30,
            httponly=True,
            samesite="lax",
            secure=request.url.scheme == "https",
            path="/",
        )
    return sse_response
