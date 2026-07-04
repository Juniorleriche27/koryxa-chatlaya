# chatlaya-service

Status: actif en production pour le trafic ChatLAYA live.

## Role du service

`chatlaya-service` est le service metier dedie a ChatLAYA.

Il portera a terme :
- l'assistant IA ;
- les conversations ;
- les messages ;
- les modes assistant ;
- le RAG ;
- l'orchestration du contexte de reponse ;
- l'historique conversationnel.

## Port live actuel

- `8012`

## Propriete live actuelle

Ce service est actuellement le proprietaire du trafic ChatLAYA expose via :

- `https://api.innovaplus.africa/api/chatlaya/*`
- le trafic web ChatLAYA proxifie depuis `https://innovaplus.africa/chatlaya/*`

Avant toute modification de route ou de comportement ChatLAYA, lire aussi :

- `docs/LIVE_SERVICE_OWNERSHIP.md`

## Endpoints live principaux

Le service ne sert plus seulement un squelette.

Routes ChatLAYA actives :

- `POST /chatlaya/session`
- `GET /chatlaya/conversations`
- `POST /chatlaya/conversations`
- `PATCH /chatlaya/conversations/{conversation_id}`
- `POST /chatlaya/conversations/{conversation_id}/archive`
- `GET /chatlaya/messages`
- `POST /chatlaya/message`
- `GET /chatlaya/problem-report-categories`
- `POST /chatlaya/problem-reports`

## Endpoint health

- `GET /health`

Reponse :

```json
{
  "status": "ok",
  "service": "chatlaya-service"
}
```

## Cible d'architecture plus tard

- `/api/v1/chatlaya/session`
- `/api/v1/chatlaya/conversations`
- `/api/v1/chatlaya/messages`
- `/api/v1/chatlaya/message`

Le prefix final sera routé plus tard par la gateway/API gateway.

Important :

- la cible versionnee est encore future
- mais le service lui-meme est deja branche a la production actuelle

## Historique important

Une partie de la logique ChatLAYA a historiquement existe dans `apps/koryxa/backend`.

Ne pas conclure pour autant que le core backend est le proprietaire live de ChatLAYA.

Pour la production actuelle, le proprietaire live est `services/chatlaya-service/backend`.

## Ce qui pourra encore etre migre ou nettoye plus tard

Sources candidates actuelles :
- `apps/koryxa/backend/app/routers/chatlaya.py`
- `apps/koryxa/backend/app/repositories/chatlaya_pg.py`
- `apps/koryxa/backend/app/schemas/chatlaya.py`
- `apps/koryxa/backend/app/services/chatlaya_context.py`
- `apps/koryxa/backend/app/services/chatlaya_service.py`
- `apps/koryxa/backend/app/services/chatlaya_specialist.py`
- `apps/koryxa/backend/app/core/rag_client.py`
- `apps/koryxa/backend/app/prompts.py`
- `apps/koryxa/training`

## Dependances futures avec koryxa-core-service

Apres extraction, `chatlaya-service` dependra de `koryxa-core-service` pour :
- auth et validation de session ;
- `user_id` canonique ;
- `guest_id` ;
- roles ;
- acces produit ;
- resume utilisateur ;
- resume trajectoire ;
- resume entreprise.

Le contrat d'echange est documente dans :
- `docs/CHATLAYA_CORE_CONTRACT.md`
- `docs/INTERNAL_CORE_API.md`

## Structure actuelle du squelette

```text
services/chatlaya-service/backend/
  app/
    main.py
    core/config.py
    routers/health.py
```

## Execution locale

Ce service peut etre lance localement pour valider le squelette backend, sans aucun branchement a la production.

Port local par defaut du service actuel :
- `8012`

Fichier d'exemple :
- `services/chatlaya-service/backend/.env.example`

Variables de base :
- `SERVICE_NAME=chatlaya-service`
- `SERVICE_PORT=8010`
- `ENVIRONMENT=local`
- `DATABASE_URL=`
- `CORE_INTERNAL_API_BASE_URL=http://127.0.0.1:8000`
- `INTERNAL_API_TOKEN=`
- `CHAT_PROVIDER=`
- `CHAT_MODEL=`
- `COHERE_API_KEY=`
- `RAG_API_URL=`
- `RAG_TOP_K_DEFAULT=5`

Commande de lancement local :

```bash
cd services/chatlaya-service/backend
uvicorn app.main:app --host 127.0.0.1 --port 8012 --reload
```

Healthcheck local :

```bash
curl http://127.0.0.1:8012/health
```

Reponse attendue :

```json
{
  "status": "ok",
  "service": "chatlaya-service"
}
```

## Boot-only test

Ce premier test isole doit verifier uniquement :
- que l'application demarre ;
- que `GET /health` repond ;
- sans tester les routes metier `/chatlaya/*`.

Preparation :

```bash
cd services/chatlaya-service/backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

Lancement :

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8010
```

Verification :

```bash
curl http://127.0.0.1:8010/health
```

Resultat attendu :

```json
{
  "status": "ok",
  "service": "chatlaya-service"
}
```

Limites de ce test :
- ne valide pas encore l'auth ;
- ne valide pas encore la base ;
- ne valide pas encore le RAG ;
- ne valide pas encore les routes `/chatlaya/*` ;
- ne cree aucun service systemd ;
- ne touche pas a la production.

## Limites actuelles du squelette

Le service est actif en production, mais la convergence d'architecture n'est pas terminee.

Dependances encore en TODO :
- auth Core distante ;
- acces Core via `core_api_client` ;
- acces Postgres reel extrait ;
- RAG reel ;
- logique specialist complete ;
- contexte produit reel ;
- bootstrap/migrations executes par un vrai runtime de service.

Stubs actuels :
- `app/deps/auth.py`
- `app/core/public_access.py`
- `app/services/chatlaya_context.py`
- `app/services/postgres_bootstrap.py`
- `app/core/ai.py`
- `app/core/rag_client.py`
- `app/services/chatlaya_specialist.py`

Consequences :
- le service compile et peut demarrer localement ;
- les routes existent dans le squelette ;
- le comportement metier n'est pas encore complet ;
- aucune integration prod n'est faite a ce stade.

## Database migration plan

Le service contient maintenant un brouillon de migration SQL :

- `services/chatlaya-service/migrations/001_create_chatlaya_tables.sql`

Objectif :
- reproduire proprement la structure actuelle de `app.chatlaya_conversations`
- reproduire proprement la structure actuelle de `app.chatlaya_messages`
- preparer le futur passage du bootstrap monolithe vers des migrations explicites

Regles actuelles :
- cette migration n'est pas executee automatiquement
- elle ne modifie pas la base active a ce stade
- `ensure_chatlaya_tables()` reste la source active de creation de tables dans le monolithe
- toute application future doit etre validee avant execution

Ordre cible plus tard :
1. valider la migration SQL
2. comparer avec la base de production
3. brancher les migrations dans `chatlaya-service`
4. seulement ensuite retirer la creation implicite du monolithe

## Deployment templates

Des templates non actifs de deploiement serveur sont prepares dans le repo :

- `infra/systemd/chatlaya-service.example.service`
- `infra/nginx/chatlaya-service.example.conf`

Ces fichiers ne sont PAS actifs.

Ils ne modifient pas :
- le systemd reel ;
- le Nginx reel ;
- la production actuelle.

Usage plus tard :
- copier manuellement le template systemd vers `/etc/systemd/system/`
- copier manuellement le template Nginx vers la configuration serveur cible
- adapter les chemins, l'utilisateur systeme et l'environnement avant toute activation

Le template systemd vise :
- le dossier `services/chatlaya-service/backend`
- une execution Uvicorn sur `127.0.0.1:8010`
- un fichier d'environnement `/etc/innovaplus/chatlaya-service.env`
- des logs separes dans `/var/log/koryxa/`

Le template Nginx vise :
- la route `/api/v1/chatlaya/`
- un proxy vers `http://127.0.0.1:8010/`

## Statut

- service scaffold seulement
- executable localement pour validation non-production
- non branche a Nginx
- non branche a systemd
- non branche aux routes publiques existantes
- non utilise en production actuelle
