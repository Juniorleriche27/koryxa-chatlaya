from __future__ import annotations

import json
from datetime import datetime
from typing import Any
from uuid import uuid4

import asyncpg

from app.services.postgres_bootstrap import get_pool


def _owner_where_clause(
    *,
    user_id: str | None,
    guest_id: str | None,
    start_index: int = 1,
) -> tuple[str, tuple[Any, ...]]:
    if user_id:
        return f"user_id = ${start_index}::uuid", (user_id,)
    if guest_id:
        return f"guest_id = ${start_index}", (guest_id,)
    raise ValueError("user_id or guest_id is required")


def _get_pool_or_raise() -> asyncpg.Pool:
    pool = get_pool()
    if pool is None:
        raise RuntimeError("chatlaya-service Postgres pool is not initialized")
    return pool


def _record_to_dict(row: asyncpg.Record | dict[str, Any] | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return dict(row)


def _normalize_conversation(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if not row:
        return None
    row["id"] = str(row.get("id") or "")
    row["_id"] = row["id"]
    return row


def _normalize_message(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if not row:
        return None
    row["id"] = str(row.get("id") or "")
    row["_id"] = row["id"]
    meta = row.get("meta")
    if isinstance(meta, str):
        try:
            row["meta"] = json.loads(meta)
        except Exception:
            row["meta"] = {}
    elif meta is None:
        row["meta"] = {}
    return row


def _normalize_problem_report(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if not row:
        return None
    for key in ("id", "conversation_id", "message_id", "user_id"):
        if row.get(key) is not None:
            row[key] = str(row[key])
    raw_payload = row.get("raw_payload")
    if isinstance(raw_payload, str):
        try:
            row["raw_payload"] = json.loads(raw_payload)
        except Exception:
            row["raw_payload"] = {}
    elif raw_payload is None:
        row["raw_payload"] = {}
    return row


def _normalize_founder_project(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if row is None:
        return None
    for key in ("id", "user_id", "conversation_id"):
        if row.get(key) is not None:
            row[key] = str(row[key])
    row["_id"] = row.get("id")
    project_data = row.get("project_data")
    if isinstance(project_data, str):
        try:
            row["project_data"] = json.loads(project_data)
        except Exception:
            row["project_data"] = {}
    elif project_data is None:
        row["project_data"] = {}
    opencloud_workspace = row.get("opencloud_workspace")
    if isinstance(opencloud_workspace, str):
        try:
            row["opencloud_workspace"] = json.loads(opencloud_workspace)
        except Exception:
            row["opencloud_workspace"] = {}
    elif opencloud_workspace is None:
        row["opencloud_workspace"] = {}
    return row


async def get_latest_active_conversation(*, user_id: str | None, guest_id: str | None) -> dict[str, Any] | None:
    pool = _get_pool_or_raise()
    where_sql, params = _owner_where_clause(user_id=user_id, guest_id=guest_id)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"""
        select id::text as id, guest_id, user_id::text as user_id, title, assistant_mode, archived, created_at, updated_at
        from app.chatlaya_conversations
        where {where_sql}
          and archived = false
        order by updated_at desc
        limit 1;
        """,
            *params,
        )
    return _normalize_conversation(_record_to_dict(row))


async def create_conversation(
    *,
    user_id: str | None,
    guest_id: str | None,
    title: str,
    assistant_mode: str,
    now: datetime,
) -> dict[str, Any]:
    pool = _get_pool_or_raise()
    conversation_id = str(uuid4())
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
        insert into app.chatlaya_conversations(
          id, guest_id, user_id, title, assistant_mode, archived, created_at, updated_at
        )
        values ($1::uuid, $2, $3::uuid, $4, $5, false, $6, $7)
        returning id::text as id, guest_id, user_id::text as user_id, title, assistant_mode, archived, created_at, updated_at;
        """,
            conversation_id,
            guest_id,
            user_id,
            title,
            assistant_mode,
            now,
            now,
        )
    return _normalize_conversation(_record_to_dict(row)) or {}


async def list_conversations(
    *,
    user_id: str | None,
    guest_id: str | None,
    limit: int,
    offset: int,
) -> list[dict[str, Any]]:
    pool = _get_pool_or_raise()
    where_sql, params = _owner_where_clause(user_id=user_id, guest_id=guest_id)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
        select id::text as id, guest_id, user_id::text as user_id, title, assistant_mode, archived, created_at, updated_at
        from app.chatlaya_conversations
        where {where_sql}
          and archived = false
        order by updated_at desc
        limit ${len(params) + 1} offset ${len(params) + 2};
        """,
            *params,
            limit,
            offset,
        )
    return [_normalize_conversation(_record_to_dict(row)) for row in rows if row]


async def get_conversation(
    *,
    conversation_id: str,
    user_id: str | None,
    guest_id: str | None,
) -> dict[str, Any] | None:
    pool = _get_pool_or_raise()
    where_sql, params = _owner_where_clause(user_id=user_id, guest_id=guest_id, start_index=2)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"""
        select id::text as id, guest_id, user_id::text as user_id, title, assistant_mode, archived, created_at, updated_at
        from app.chatlaya_conversations
        where id = $1::uuid
          and {where_sql}
        limit 1;
        """,
            conversation_id,
            *params,
        )
    return _normalize_conversation(_record_to_dict(row))


async def get_message(
    *,
    message_id: str,
    user_id: str | None,
    guest_id: str | None,
) -> dict[str, Any] | None:
    pool = _get_pool_or_raise()
    where_sql, params = _owner_where_clause(user_id=user_id, guest_id=guest_id, start_index=2)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"""
        select id::text as id, conversation_id::text as conversation_id, guest_id, user_id::text as user_id, role, content, meta, created_at
        from app.chatlaya_messages
        where id = $1::uuid
          and {where_sql}
        limit 1;
        """,
            message_id,
            *params,
        )
    return _normalize_message(_record_to_dict(row))


async def update_conversation_mode(
    *,
    conversation_id: str,
    user_id: str | None,
    guest_id: str | None,
    assistant_mode: str,
    updated_at: datetime,
) -> dict[str, Any] | None:
    pool = _get_pool_or_raise()
    where_sql, params = _owner_where_clause(user_id=user_id, guest_id=guest_id, start_index=4)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"""
        update app.chatlaya_conversations
        set assistant_mode = $1,
            updated_at = $2
        where id = $3::uuid
          and {where_sql}
        returning id::text as id, guest_id, user_id::text as user_id, title, assistant_mode, archived, created_at, updated_at;
        """,
            assistant_mode,
            updated_at,
            conversation_id,
            *params,
        )
    return _normalize_conversation(_record_to_dict(row))


async def archive_conversation(
    *,
    conversation_id: str,
    user_id: str | None,
    guest_id: str | None,
    updated_at: datetime,
) -> bool:
    pool = _get_pool_or_raise()
    where_sql, params = _owner_where_clause(user_id=user_id, guest_id=guest_id, start_index=3)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"""
        update app.chatlaya_conversations
        set archived = true,
            updated_at = $1
        where id = $2::uuid
          and {where_sql}
        returning id::text as id;
        """,
            updated_at,
            conversation_id,
            *params,
        )
    return bool(row)


async def touch_conversation(
    *,
    conversation_id: str,
    title: str,
    updated_at: datetime,
) -> None:
    pool = _get_pool_or_raise()
    async with pool.acquire() as conn:
        await conn.execute(
            """
        update app.chatlaya_conversations
        set title = $1,
            updated_at = $2
        where id = $3::uuid;
        """,
            title,
            updated_at,
            conversation_id,
        )


async def create_message(
    *,
    conversation_id: str,
    role: str,
    content: str,
    user_id: str | None,
    guest_id: str | None,
    meta: dict[str, Any] | None,
    created_at: datetime,
) -> dict[str, Any]:
    pool = _get_pool_or_raise()
    message_id = str(uuid4())
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
        insert into app.chatlaya_messages(
          id, conversation_id, guest_id, user_id, role, content, meta, created_at
        )
        values ($1::uuid, $2::uuid, $3, $4::uuid, $5, $6, $7::jsonb, $8)
        returning id::text as id, conversation_id::text as conversation_id, guest_id, user_id::text as user_id, role, content, meta, created_at;
        """,
            message_id,
            conversation_id,
            guest_id,
            user_id,
            role,
            content,
            json.dumps(meta or {}, default=str),
            created_at,
        )
    return _normalize_message(_record_to_dict(row)) or {}


async def list_messages(*, conversation_id: str) -> list[dict[str, Any]]:
    pool = _get_pool_or_raise()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
        select id::text as id, conversation_id::text as conversation_id, guest_id, user_id::text as user_id, role, content, meta, created_at
        from app.chatlaya_messages
        where conversation_id = $1::uuid
        order by created_at asc;
        """,
            conversation_id,
        )
    return [_normalize_message(_record_to_dict(row)) for row in rows if row]


async def list_recent_messages(*, conversation_id: str, limit: int) -> list[dict[str, Any]]:
    pool = _get_pool_or_raise()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
        select id::text as id, conversation_id::text as conversation_id, guest_id, user_id::text as user_id, role, content, meta, created_at
        from app.chatlaya_messages
        where conversation_id = $1::uuid
        order by created_at desc
        limit $2;
        """,
            conversation_id,
            limit,
        )
    rows.reverse()
    return [_normalize_message(_record_to_dict(row)) for row in rows if row]


async def create_problem_report(
    *,
    user_id: str | None,
    conversation_id: str | None,
    message_id: str | None,
    country: str,
    region: str | None,
    city: str | None,
    commune: str | None,
    zone_type: str | None,
    domain: str,
    sector: str | None,
    problem_title: str | None,
    problem_description: str,
    affected_population: str | None,
    severity: str | None,
    frequency: str | None,
    perceived_cause: str | None,
    proposed_solution: str | None,
    evidence_type: str | None,
    consent_anonymized: bool,
    source_channel: str,
    raw_payload: dict[str, Any],
) -> dict[str, Any]:
    pool = _get_pool_or_raise()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
        insert into app.problem_reports(
          user_id,
          conversation_id,
          message_id,
          country,
          region,
          city,
          commune,
          zone_type,
          domain,
          sector,
          problem_title,
          problem_description,
          affected_population,
          severity,
          frequency,
          perceived_cause,
          proposed_solution,
          evidence_type,
          consent_anonymized,
          source_channel,
          raw_payload
        )
        values (
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17,
          $18,
          $19,
          $20,
          $21::jsonb
        )
        returning
          id::text as id,
          conversation_id::text as conversation_id,
          message_id::text as message_id,
          user_id::text as user_id,
          country,
          region,
          city,
          commune,
          zone_type,
          domain,
          sector,
          problem_title,
          problem_description,
          affected_population,
          severity,
          frequency,
          perceived_cause,
          proposed_solution,
          evidence_type,
          consent_anonymized,
          source_channel,
          raw_payload,
          status,
          created_at,
          updated_at;
        """,
            user_id,
            conversation_id,
            message_id,
            country,
            region,
            city,
            commune,
            zone_type,
            domain,
            sector,
            problem_title,
            problem_description,
            affected_population,
            severity,
            frequency,
            perceived_cause,
            proposed_solution,
            evidence_type,
            consent_anonymized,
            source_channel,
            json.dumps(raw_payload or {}, default=str),
        )
    return _normalize_problem_report(_record_to_dict(row)) or {}


async def create_founder_project(
    *,
    user_id: str | None,
    guest_id: str | None,
    conversation_id: str | None,
    title: str,
    current_step: str,
    project_data: dict[str, Any] | None,
    now: datetime,
) -> dict[str, Any]:
    pool = _get_pool_or_raise()
    project_id = str(uuid4())
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
        insert into app.chatlaya_founder_projects(
          id, user_id, guest_id, conversation_id, title, status, current_step, project_data, created_at, updated_at
        )
        values ($1::uuid, $2::uuid, $3, $4::uuid, $5, 'draft', $6, $7::jsonb, $8, $9)
        returning
          id::text as id,
          user_id::text as user_id,
          guest_id,
          conversation_id::text as conversation_id,
          title,
          status,
          current_step,
          project_data,
          opencloud_root_folder,
          opencloud_project_folder,
          opencloud_project_path,
          opencloud_workspace,
          last_opencloud_sync_at,
          created_at,
          updated_at;
        """,
            project_id,
            user_id,
            guest_id,
            conversation_id,
            title,
            current_step,
            json.dumps(project_data or {}, default=str),
            now,
            now,
        )
    return _normalize_founder_project(_record_to_dict(row)) or {}


async def get_founder_project(
    *,
    project_id: str,
    user_id: str | None,
    guest_id: str | None,
) -> dict[str, Any] | None:
    pool = _get_pool_or_raise()
    where_sql, params = _owner_where_clause(user_id=user_id, guest_id=guest_id, start_index=2)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"""
        select
          id::text as id,
          user_id::text as user_id,
          guest_id,
          conversation_id::text as conversation_id,
          title,
          status,
          current_step,
          project_data,
          opencloud_root_folder,
          opencloud_project_folder,
          opencloud_project_path,
          opencloud_workspace,
          last_opencloud_sync_at,
          created_at,
          updated_at
        from app.chatlaya_founder_projects
        where id = $1::uuid
          and {where_sql}
        limit 1;
        """,
            project_id,
            *params,
        )
    return _normalize_founder_project(_record_to_dict(row))


async def list_founder_projects(
    *,
    user_id: str | None,
    guest_id: str | None,
    limit: int,
    offset: int,
) -> list[dict[str, Any]]:
    pool = _get_pool_or_raise()
    where_sql, params = _owner_where_clause(user_id=user_id, guest_id=guest_id)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
        select
          id::text as id,
          user_id::text as user_id,
          guest_id,
          conversation_id::text as conversation_id,
          title,
          status,
          current_step,
          project_data,
          opencloud_root_folder,
          opencloud_project_folder,
          opencloud_project_path,
          opencloud_workspace,
          last_opencloud_sync_at,
          created_at,
          updated_at
        from app.chatlaya_founder_projects
        where {where_sql}
          and status <> 'archived'
        order by updated_at desc
        limit ${len(params) + 1} offset ${len(params) + 2};
        """,
            *params,
            limit,
            offset,
        )
    return [_normalize_founder_project(_record_to_dict(row)) for row in rows if row]


async def update_founder_project_opencloud_workspace(
    *,
    project_id: str,
    user_id: str | None,
    guest_id: str | None,
    opencloud_root_folder: str | None,
    opencloud_project_folder: str | None,
    opencloud_project_path: str | None,
    opencloud_workspace: dict[str, Any] | None,
    synced_at: datetime,
) -> dict[str, Any] | None:
    pool = _get_pool_or_raise()
    where_sql, params = _owner_where_clause(user_id=user_id, guest_id=guest_id, start_index=8)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"""
        update app.chatlaya_founder_projects
        set opencloud_root_folder = $1,
            opencloud_project_folder = $2,
            opencloud_project_path = $3,
            opencloud_workspace = $4::jsonb,
            last_opencloud_sync_at = $5,
            updated_at = $6
        where id = $7::uuid
          and {where_sql}
        returning
          id::text as id,
          user_id::text as user_id,
          guest_id,
          conversation_id::text as conversation_id,
          title,
          status,
          current_step,
          project_data,
          opencloud_root_folder,
          opencloud_project_folder,
          opencloud_project_path,
          opencloud_workspace,
          last_opencloud_sync_at,
          created_at,
          updated_at;
        """,
            opencloud_root_folder,
            opencloud_project_folder,
            opencloud_project_path,
            json.dumps(opencloud_workspace or {}, default=str),
            synced_at,
            synced_at,
            project_id,
            *params,
        )
    return _normalize_founder_project(_record_to_dict(row))


async def update_founder_project_data(
    *,
    project_id: str,
    user_id: str | None,
    guest_id: str | None,
    title: str | None,
    current_step: str | None,
    status: str | None,
    project_data: dict[str, Any] | None,
    updated_at: datetime,
) -> dict[str, Any] | None:
    pool = _get_pool_or_raise()
    assignments: list[str] = []
    values: list[Any] = []

    if title is not None:
        values.append(title)
        assignments.append(f"title = ${len(values)}")
    if current_step is not None:
        values.append(current_step)
        assignments.append(f"current_step = ${len(values)}")
    if status is not None:
        values.append(status)
        assignments.append(f"status = ${len(values)}")
    if project_data is not None:
        values.append(json.dumps(project_data or {}, default=str))
        assignments.append(f"project_data = ${len(values)}::jsonb")

    values.append(updated_at)
    assignments.append(f"updated_at = ${len(values)}")

    project_id_index = len(values) + 1
    where_sql, params = _owner_where_clause(user_id=user_id, guest_id=guest_id, start_index=project_id_index + 1)
    values.append(project_id)
    values.extend(params)

    pool = _get_pool_or_raise()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"""
        update app.chatlaya_founder_projects
        set {", ".join(assignments)}
        where id = ${project_id_index}::uuid
          and {where_sql}
        returning
          id::text as id,
          user_id::text as user_id,
          guest_id,
          conversation_id::text as conversation_id,
          title,
          status,
          current_step,
          project_data,
          opencloud_root_folder,
          opencloud_project_folder,
          opencloud_project_path,
          opencloud_workspace,
          last_opencloud_sync_at,
          created_at,
          updated_at;
        """,
            *values,
        )
    return _normalize_founder_project(_record_to_dict(row))
