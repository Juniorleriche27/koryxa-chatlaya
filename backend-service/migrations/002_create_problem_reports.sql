-- ChatLAYA structured problem reports migration draft
-- ---------------------------------------------------
-- This migration is NOT executed automatically.
-- It is intended for the future evolution of ChatLAYA data collection.
-- Current production still relies on the monolith bootstrap for active tables.

begin;

-- create extension if not exists pgcrypto; -- skipped: gen_random_uuid() already available
create schema if not exists app;

create table if not exists app.problem_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references app.auth_users(id) on delete set null,
  conversation_id uuid null references app.chatlaya_conversations(id) on delete set null,
  message_id uuid null references app.chatlaya_messages(id) on delete set null,
  country text not null,
  region text null,
  city text null,
  commune text null,
  zone_type text null,
  domain text not null,
  sector text null,
  problem_title text null,
  problem_description text not null,
  affected_population text null,
  severity text null,
  frequency text null,
  perceived_cause text null,
  proposed_solution text null,
  evidence_type text null,
  consent_anonymized boolean not null default false,
  source_channel text not null default 'chatlaya_web',
  classification_confidence numeric null,
  raw_payload jsonb not null default '{}'::jsonb,
  status text not null default 'received',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint problem_reports_country_not_blank check (length(btrim(country)) > 0),
  constraint problem_reports_domain_not_blank check (length(btrim(domain)) > 0),
  constraint problem_reports_description_not_blank check (length(btrim(problem_description)) > 0),
  constraint problem_reports_confidence_range check (
    classification_confidence is null
    or (classification_confidence >= 0 and classification_confidence <= 1)
  )
);

create index if not exists idx_problem_reports_country
  on app.problem_reports (country);

create index if not exists idx_problem_reports_domain
  on app.problem_reports (domain);

create index if not exists idx_problem_reports_city
  on app.problem_reports (city);

create index if not exists idx_problem_reports_severity
  on app.problem_reports (severity);

create index if not exists idx_problem_reports_status
  on app.problem_reports (status);

create index if not exists idx_problem_reports_created_at
  on app.problem_reports (created_at desc);

create index if not exists idx_problem_reports_source_channel
  on app.problem_reports (source_channel);

create index if not exists idx_problem_reports_raw_payload_gin
  on app.problem_reports using gin (raw_payload);

create index if not exists idx_problem_reports_conversation_id
  on app.problem_reports (conversation_id)
  where conversation_id is not null;

create index if not exists idx_problem_reports_message_id
  on app.problem_reports (message_id)
  where message_id is not null;

create index if not exists idx_problem_reports_user_id_created_at
  on app.problem_reports (user_id, created_at desc)
  where user_id is not null;

drop trigger if exists trg_problem_reports_updated_at on app.problem_reports;
create trigger trg_problem_reports_updated_at
before update on app.problem_reports
for each row execute function app.set_updated_at();

commit;
