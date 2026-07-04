-- ChatLAYA service migration draft
-- --------------------------------
-- This migration is NOT executed automatically.
-- It is intended for the future extraction of chatlaya-service.
-- It must be reviewed and validated before any application on a real database.
-- Current production still relies on ensure_chatlaya_tables() in the monolith.

begin;

create table if not exists app.chatlaya_conversations (
  id uuid primary key,
  guest_id text,
  user_id uuid references app.auth_users(id) on delete cascade,
  title text not null default 'Nouvelle conversation',
  assistant_mode text not null default 'general',
  archived boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint chatlaya_conversations_owner_check
    check (
      (user_id is not null and guest_id is null)
      or (user_id is null and guest_id is not null)
    )
);

create table if not exists app.chatlaya_messages (
  id uuid primary key,
  conversation_id uuid not null references app.chatlaya_conversations(id) on delete cascade,
  guest_id text,
  user_id uuid references app.auth_users(id) on delete cascade,
  role text not null,
  content text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint chatlaya_messages_role_check check (role in ('user', 'assistant'))
);

create index if not exists idx_chatlaya_conversations_user_updated_at
  on app.chatlaya_conversations (user_id, updated_at desc)
  where archived = false;

create index if not exists idx_chatlaya_conversations_guest_updated_at
  on app.chatlaya_conversations (guest_id, updated_at desc)
  where archived = false;

create index if not exists idx_chatlaya_messages_conversation_created_at
  on app.chatlaya_messages (conversation_id, created_at asc);

commit;
