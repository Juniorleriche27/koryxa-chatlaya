-- ChatLAYA Founder projects migration draft
-- -----------------------------------------
-- This migration is NOT executed automatically.
-- It is intended for the future persistence of ChatLAYA Founder projects.
-- It must be reviewed and validated before any application on a real database.
-- Current production still relies on the monolith/bootstrap for active tables.

begin;

-- create extension if not exists pgcrypto; -- skipped: gen_random_uuid() already available
create schema if not exists app;

create table if not exists app.chatlaya_founder_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references app.auth_users(id) on delete cascade,
  guest_id text null,
  conversation_id uuid null references app.chatlaya_conversations(id) on delete set null,
  title text not null default 'Projet Founder',
  status text not null default 'draft',
  current_step text not null default 'point_de_depart',
  project_data jsonb not null default '{}'::jsonb,
  opencloud_root_folder text null,
  opencloud_project_folder text null,
  opencloud_project_path text null,
  opencloud_workspace jsonb not null default '{}'::jsonb,
  last_opencloud_sync_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint chatlaya_founder_projects_owner_check
    check (
      (user_id is not null and guest_id is null)
      or (user_id is null and guest_id is not null)
    ),
  constraint chatlaya_founder_projects_title_not_blank
    check (length(btrim(title)) > 0),
  constraint chatlaya_founder_projects_status_check
    check (status in ('draft', 'in_progress', 'validated', 'completed', 'archived')),
  constraint chatlaya_founder_projects_current_step_check
    check (
      current_step in (
        'point_de_depart',
        'client_cible',
        'probleme',
        'offre_valeur',
        'prix',
        'business_model',
        'validation_preuves',
        'pitch_vente',
        'business_plan',
        'completed'
      )
    )
);

create index if not exists idx_chatlaya_founder_projects_user_updated_at
  on app.chatlaya_founder_projects (user_id, updated_at desc)
  where user_id is not null and status <> 'archived';

create index if not exists idx_chatlaya_founder_projects_guest_updated_at
  on app.chatlaya_founder_projects (guest_id, updated_at desc)
  where guest_id is not null and status <> 'archived';

create index if not exists idx_chatlaya_founder_projects_conversation_id
  on app.chatlaya_founder_projects (conversation_id)
  where conversation_id is not null;

create index if not exists idx_chatlaya_founder_projects_status
  on app.chatlaya_founder_projects (status);

create index if not exists idx_chatlaya_founder_projects_current_step
  on app.chatlaya_founder_projects (current_step);

create unique index if not exists idx_chatlaya_founder_projects_opencloud_project_path
  on app.chatlaya_founder_projects (opencloud_project_path)
  where opencloud_project_path is not null;

create index if not exists idx_chatlaya_founder_projects_project_data_gin
  on app.chatlaya_founder_projects using gin (project_data);

create index if not exists idx_chatlaya_founder_projects_opencloud_workspace_gin
  on app.chatlaya_founder_projects using gin (opencloud_workspace);

drop trigger if exists trg_chatlaya_founder_projects_updated_at on app.chatlaya_founder_projects;
create trigger trg_chatlaya_founder_projects_updated_at
before update on app.chatlaya_founder_projects
for each row execute function app.set_updated_at();

commit;
