# Live Service Ownership

This document describes the current live ownership of KORYXA backend traffic.

It is intentionally about the current production runtime, not only the future target architecture.

## Why this file exists

KORYXA is moving toward a microservice architecture.

The main recurring risk is:

- editing the wrong backend;
- fixing a route in the monolith while production is served by a dedicated service;
- reintroducing service boundary confusion for future developers or coding agents.

This file is the first place to read before touching backend routing or API behavior.

Detailed route-family matrix:

- `docs/LIVE_ROUTE_OWNERSHIP_MATRIX.md`

## Current live services

### 1. koryxa core backend

- systemd unit: `innovaplus-backend.service`
- codebase: `apps/koryxa/backend`
- bind: `127.0.0.1:8000`
- role: core KORYXA backend

Live ownership:

- `/health`
- `/innova/*`
- `/innova/api/*`
- the default traffic behind `https://api.innovaplus.africa/` except the ChatLAYA-specific prefix

Typical responsibilities:

- auth
- core product APIs
- enterprise and mission-related APIs
- other non-ChatLAYA platform APIs

### 2. chatlaya dedicated service

- systemd unit: `chatlaya.service`
- codebase: `services/chatlaya-service/backend`
- bind: `127.0.0.1:8012`
- role: live ChatLAYA backend

Live ownership:

- `https://api.innovaplus.africa/api/chatlaya/*`
- website ChatLAYA traffic proxied from `https://innovaplus.africa/chatlaya/*`

Typical responsibilities:

- ChatLAYA sessions
- conversations
- messages
- assistant modes
- ChatLAYA reply generation
- ChatLAYA-specific product guidance

## Current live routing references

Primary references observed in the repo and server config:

- `infra/nginx/innovaplus.active.conf`
- `infra/nginx/innovaplus-api.active.conf`
- `/etc/nginx/sites-available/innovaplus.conf`
- `/etc/nginx/sites-available/innovaplus-api`

Current effective split:

- `/innova/` -> `127.0.0.1:8000`
- `/api/chatlaya/` -> `127.0.0.1:8012`
- site `/chatlaya/...` requests are also proxied to `127.0.0.1:8012`

## Important rule for contributors and coding agents

Before changing a backend route:

1. identify the public route;
2. identify the Nginx target;
3. identify the systemd service;
4. edit only the owning backend.

## Do not make these mistakes

- Do not assume `apps/koryxa/backend` owns all backend traffic.
- Do not implement a ChatLAYA production fix in the core backend if the live route is served by `chatlaya.service`.
- Do not merge service responsibilities back into the monolith by accident.
- Do not create duplicate route ownership across two services without an explicit migration plan.

## Current decision

KORYXA is following a progressive microservice direction.

That means:

- ChatLAYA should remain a dedicated service boundary.
- The core backend should remain the owner of core platform APIs.
- Future cleanup should clarify ownership, not blur it.

## When adding a new endpoint

Use this rule of thumb:

- if the endpoint belongs to ChatLAYA conversations, modes, assistant behavior, or ChatLAYA-specific collection flows, add it to `services/chatlaya-service/backend`;
- if the endpoint belongs to core platform identity, enterprise APIs, or shared KORYXA core product logic, add it to `apps/koryxa/backend`.

If the ownership is unclear, document the decision before implementing the route.
