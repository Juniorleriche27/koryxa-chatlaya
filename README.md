# koryxa-chatlaya

Standalone ChatLAYA product repository extracted from `Juniorleriche27/KORYXA`.

## Contents

- `backend-service/` — ChatLAYA FastAPI service, migrations, OpenCloud founder workspace docs, backend logic.
- `frontend/` — ChatLAYA Next.js frontend extracted from the KORYXA web app.
- `.github/workflows/deploy-chatlaya-service.yml` — deployment workflow copied from KORYXA.
- `docs/` — live route/service ownership notes copied for transition context.

## Backend

```bash
cd backend-service/backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8012
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

This repo is now the canonical home for ChatLAYA code.
