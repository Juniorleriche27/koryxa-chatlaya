# ChatLAYA Core Contract

## Objet

Ce document definit le contrat d'interface entre KORYXA Core et ChatLAYA avant l'extraction de ChatLAYA vers un service independant.

Objectif :
- clarifier ce qui appartient a Core ;
- clarifier ce qui appartient a ChatLAYA ;
- eviter les acces directs aux tables Core apres extraction ;
- preparer une interface interne stable avant la separation en microservices.

Ce document ne change pas la production actuelle. Il sert de reference d'architecture et de migration.

## 1. Responsabilites de KORYXA Core

KORYXA Core reste l'autorite principale pour les donnees d'identite, d'acces et de contexte metier transverse.

Core est responsable de :
- auth principale ;
- sessions principales ;
- gestion du `user_id` canonique ;
- gestion du `guest_id` ;
- roles ;
- acces produit et entitlement ;
- profil utilisateur ;
- trajectoires ;
- besoins entreprise ;
- missions entreprise.

Plus precisement, Core conserve la source de verite pour :
- `app.auth_users`
- `app.sessions`
- `app.login_otps`
- `app.password_reset_tokens`
- `app.trajectory_flows`
- `app.enterprise_needs`
- `app.enterprise_missions`

Core est aussi responsable de :
- decider si un utilisateur est connecte ou invite ;
- exposer les resumes utiles aux services metier ;
- centraliser les regles d'acces produit ;
- eviter la duplication de la logique d'identite dans les services satellites.

## 2. Responsabilites de ChatLAYA

ChatLAYA est responsable de la couche conversationnelle et de l'execution IA associee.

ChatLAYA est responsable de :
- conversations ;
- messages ;
- modes assistant ;
- generation de reponse ;
- RAG ;
- contexte de reponse ;
- historique conversationnel ;
- scoring conversationnel ou analytique futur lie au chat.

Dans l'etat cible, ChatLAYA doit posseder sa propre logique pour :
- `chatlaya_conversations`
- `chatlaya_messages`
- orchestration LLM ;
- orchestration RAG ;
- normalisation des modes assistant ;
- sanitation des reponses visibles ;
- fallback conversationnel.

ChatLAYA peut enrichir ses reponses avec un contexte provenant du Core, mais ne doit pas devenir proprietaire des donnees metier Core.

## 3. Donnees que ChatLAYA peut demander au Core

ChatLAYA peut demander au Core uniquement des donnees de lecture, deja filtrees et reduites au besoin minimum.

Jeu de donnees autorise :
- resume utilisateur ;
- resume trajectoire ;
- resume besoin entreprise ;
- resume mission entreprise ;
- statut d'acces produit ;
- statut invite/connecte.

Exemples de contenu acceptable :

### Resume utilisateur
- `user_id`
- `account_type`
- `workspace_role`
- `plan`
- `roles`
- etat general du profil

### Resume trajectoire
- objectif principal
- trajectoire recommandee
- readiness score
- statut du profil
- prochaines actions prioritaires

### Resume entreprise
- titre du besoin
- statut du besoin
- titre de mission
- statut de mission

### Entitlement ChatLAYA
- acces autorise ou non
- type d'acces
- eventuelle limitation de plan

ChatLAYA ne doit recevoir que le minimum utile a la reponse et a la gouvernance d'acces.

## 4. Donnees que ChatLAYA ne doit pas posseder

ChatLAYA ne doit pas posseder, dupliquer ni administrer comme source de verite :
- mot de passe ;
- OTP ;
- sessions principales ;
- abonnements source de verite ;
- tables Core completes.

En pratique, ChatLAYA ne doit pas stocker ni recalculer comme autorite :
- `password_hash`
- `login_otps`
- `sessions`
- politique principale d'auth
- source de verite des abonnements
- source complete des profils utilisateurs
- logique complete de trajectoire
- logique complete des besoins entreprise
- logique complete des missions entreprise

ChatLAYA peut conserver des references minimales utiles a ses propres objets, par exemple :
- `user_id`
- `guest_id`
- `conversation_id`
- indicateurs locaux lies au chat

## 5. Interfaces futures proposees

Les interfaces suivantes sont recommandees pour remplacer les acces directs aux tables Core apres extraction :

### Resumes utilisateur
- `GET /internal/core/users/{user_id}/summary`
- `GET /internal/core/guests/{guest_id}/summary`

### Resumes trajectoire
- `GET /internal/core/users/{user_id}/trajectory-summary`
- `GET /internal/core/guests/{guest_id}/trajectory-summary`

### Resumes entreprise
- `GET /internal/core/users/{user_id}/enterprise-summary`
- `GET /internal/core/guests/{guest_id}/enterprise-summary`

### Entitlements ChatLAYA
- `GET /internal/core/users/{user_id}/entitlements/chatlaya`

### Recommandation de format de reponse

Les endpoints internes doivent renvoyer des objets simples, stables et explicitement versionnables.

Exemple pour `users/{user_id}/summary` :

```json
{
  "user_id": "uuid",
  "account_type": "organization",
  "workspace_role": "demandeur",
  "plan": "team",
  "roles": ["user"],
  "profile_status": "ready"
}
```

Exemple pour `users/{user_id}/trajectory-summary` :

```json
{
  "objective": "Lancer une activite",
  "recommended_trajectory": "Blueprint Entrepreneur",
  "readiness_score": 72,
  "profile_status": "not_ready",
  "next_actions": ["Clarifier l'offre", "Valider le besoin", "Structurer les etapes"]
}
```

Exemple pour `users/{user_id}/enterprise-summary` :

```json
{
  "need_title": "Structurer le besoin commercial",
  "need_status": "qualified",
  "mission_title": "Mission cadrage commercial",
  "mission_status": "draft"
}
```

Exemple pour `users/{user_id}/entitlements/chatlaya` :

```json
{
  "allowed": true,
  "product": "chatlaya",
  "plan": "team",
  "access_mode": "full"
}
```

## 6. Regles de securite

Principes obligatoires :
- ChatLAYA ne valide pas seul l'identite principale ;
- Core reste l'autorite auth ;
- ChatLAYA ne lit pas directement les tables Core apres extraction ;
- la communication future se fait via API interne ou client Core dedie ;
- aucun secret utilisateur n'est transmis inutilement.

Regles de securite operationnelles :
- ChatLAYA ne manipule pas les mots de passe source ;
- ChatLAYA ne devient pas emetteur principal de session utilisateur ;
- ChatLAYA ne recompose pas localement la logique d'entitlement ;
- ChatLAYA consomme des resumes, pas des tables completes ;
- les echanges internes doivent etre authentifies entre services ;
- les journaux ChatLAYA ne doivent pas exposer de secret sensible ;
- les reponses internes doivent etre limitees au principe du moindre privilege.

## 7. Strategie de migration

### Phase 1 : adapter interne dans le monolithe
- introduire un point d'acces unique aux donnees Core ;
- remplacer les lectures directes de tables Core par cet adapter ;
- conserver la production monolithique intacte.

Etat actuel :
- `apps/koryxa/backend/app/services/core_context_adapter.py`

### Phase 2 : endpoints internes Core
- creer des endpoints internes Core pour les resumes utilisateur, trajectoire, entreprise et entitlement ;
- garder les payloads minimaux ;
- ne pas exposer les tables brutes.

### Phase 3 : client Core cote ChatLAYA
- ajouter un client interne Core dans ChatLAYA ;
- remplacer l'adapter SQL local par un client HTTP interne ou un package partage ;
- garder les memes contrats de reponse.

### Phase 4 : extraction `chatlaya-service`
- deplacer le runtime ChatLAYA dans `services/chatlaya-service` ;
- conserver Core comme autorite identite/acces ;
- router ChatLAYA via sa propre API versionnee.

### Phase 5 : suppression des acces directs legacy
- retirer les acces directs restants aux tables Core ;
- supprimer les chemins de compatibilite SQL internes devenus obsoletes ;
- verifier qu'aucune logique metier Core n'est dupliquee dans ChatLAYA.

## 8. Risques a eviter

Risques principaux :
- acces direct aux tables Core ;
- duplication auth ;
- duplication user profile ;
- logique business Core copiee dans ChatLAYA ;
- divergence entre invite et connecte.

Risques detaillees :

### Acces direct aux tables Core
- cree un couplage fort ;
- rend l'extraction fragile ;
- complique les changements de schema.

### Duplication auth
- cree plusieurs autorites d'identite ;
- augmente le risque de session incoherente ;
- fragilise la securite.

### Duplication user profile
- cree des divergences de plan, role ou statut ;
- rend les reponses ChatLAYA incoherentes avec le Core.

### Copie de logique metier Core
- multiplie les endroits a maintenir ;
- augmente le risque de drift produit ;
- ralentit les evolutions.

### Divergence invite / connecte
- cree des comportements differents impossibles a expliquer ;
- complique les migrations de conversation et de contexte ;
- augmente les bugs de transition entre usage public et usage connecte.

## 9. Regle de transition immediate

Avant extraction reelle de `chatlaya-service`, toute nouvelle lecture de donnees Core par ChatLAYA doit passer par :
- un adapter interne unique dans le monolithe ;
- ou une future interface interne Core.

Nouvel acces direct a une table Core depuis une logique ChatLAYA : a eviter.

## 10. Decision d'architecture

Decision retenue :
- Core reste la source de verite identite, acces et contexte metier transverse.
- ChatLAYA devient un service metier consommateur de contexte, pas proprietaire des donnees Core.
- L'extraction de ChatLAYA doit se faire par contrat d'interface, pas par copie brute de logique ou de tables.
