# Internal Core API

## Objet

Cette API interne prepare le contrat HTTP entre KORYXA Core et ChatLAYA avant extraction reelle de `chatlaya-service`.

Elle expose des endpoints de lecture uniquement.

## Protection

Toutes les routes exigent le header :

```text
X-Internal-Token: <token>
```

Le token est lu depuis la variable d'environnement :

```text
INTERNAL_API_TOKEN
```

Comportement :
- si `INTERNAL_API_TOKEN` est absent : `503 Internal API token not configured`
- si le header est absent ou invalide : `401 Unauthorized`

## Endpoints

### GET /internal/core/users/{user_id}/summary

Retourne un resume utilisateur non sensible.

Exemple :

```json
{
  "user_id": "uuid",
  "account_type": "organization",
  "workspace_role": "demandeur",
  "plan": "team",
  "roles": ["user"],
  "profile_status": null,
  "auth_status": "authenticated"
}
```

### GET /internal/core/guests/{guest_id}/summary

```json
{
  "guest_id": "guest_123",
  "auth_status": "guest"
}
```

### GET /internal/core/users/{user_id}/trajectory-summary

```json
{
  "objective": "Lancer une activite",
  "recommended_trajectory": "Blueprint Entrepreneur",
  "readiness_score": 72,
  "profile_status": "not_ready",
  "next_actions": ["Clarifier l'offre", "Valider le besoin"]
}
```

### GET /internal/core/guests/{guest_id}/trajectory-summary

Meme format que la variante utilisateur.

### GET /internal/core/users/{user_id}/enterprise-summary

```json
{
  "need_title": "Structurer le besoin commercial",
  "need_status": "qualified",
  "mission_title": "Mission cadrage commercial",
  "mission_status": "draft"
}
```

### GET /internal/core/guests/{guest_id}/enterprise-summary

Meme format que la variante utilisateur.

### GET /internal/core/users/{user_id}/entitlements/chatlaya

```json
{
  "user_id": "uuid",
  "product": "chatlaya",
  "allowed": true,
  "plan": "team",
  "access_mode": "full"
}
```

## Donnees explicitement exclues

Ne doivent jamais etre retournees :
- `password_hash`
- OTP
- tokens de session
- secrets
- tables Core completes

## Usage actuel

Dans le monolithe actuel, ces routes sont une preparation d'interface.  
Elles n'extraient pas encore ChatLAYA, mais elles stabilisent le futur contrat Core ↔ ChatLAYA.

## Client usage for future services

Apres extraction, ChatLAYA ne devra plus lire directement les tables Core.  
Il utilisera un client HTTP interne dedie pour consommer cette API.

Client prepare :

```text
apps/koryxa/backend/app/services/core_api_client.py
```

Principes :
- lit `CORE_INTERNAL_API_BASE_URL`
- lit `INTERNAL_API_TOKEN`
- envoie `X-Internal-Token`
- applique des timeouts courts
- remonte des erreurs HTTP explicites
- retourne des dictionnaires JSON simples

Ce client est volontairement ajoute avant extraction, mais il n'est pas encore branche dans le runtime actif de ChatLAYA.

Ordre prevu :
1. routes internes Core disponibles
2. client Core disponible
3. ChatLAYA service consomme ce client apres extraction
4. suppression des acces SQL directs legacy au Core
