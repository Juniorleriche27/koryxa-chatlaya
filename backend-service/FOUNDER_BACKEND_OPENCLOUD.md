# ChatLAYA Founder — Socle backend + OpenCloud

## Positionnement

ChatLAYA Founder est un produit de KORYXA.

Ce n’est pas un cabinet.

Ce n’est pas seulement un chatbot.

Le backend gère maintenant un vrai objet Founder persistant en base de données, ainsi qu’un workspace documentaire OpenCloud associé à chaque projet Founder.

Ce socle sert de base avant le branchement frontend et avant l’arrivée des agents IA Founder.

---

## Infrastructure OpenCloud

OpenCloud est installé sur un serveur séparé de celui du projet ChatLAYA/KORYXA.

- URL publique : `https://cloud.innovaplus.africa`
- Compte technique dédié : `chatlaya_service`
- Authentification : token applicatif OpenCloud
- Le token applicatif est stocké côté ChatLAYA dans `OPENCLOUD_SERVICE_APP_TOKEN`
- Le compte admin OpenCloud ne doit pas être utilisé par ChatLAYA
- Le token ne doit jamais être affiché, collé dans une conversation, envoyé par message ou commité dans Git
- Rotation recommandée du token actuel : avant le `2027-05-19`

---

## Variables d’environnement OpenCloud

Variables utilisées côté ChatLAYA Service :

- `OPENCLOUD_ENABLED`
- `OPENCLOUD_BASE_URL`
- `OPENCLOUD_TIMEOUT_S`
- `OPENCLOUD_VERIFY_SSL`
- `OPENCLOUD_SERVICE_USERNAME`
- `OPENCLOUD_SERVICE_APP_TOKEN`
- `OPENCLOUD_SERVICE_PASSWORD`
- `OPENCLOUD_DEFAULT_ROOT_FOLDER`

Note importante :

- `OPENCLOUD_SERVICE_APP_TOKEN` est le champ propre pour le token applicatif.
- `OPENCLOUD_SERVICE_PASSWORD` existe seulement comme fallback temporaire historique.
- À terme, `OPENCLOUD_SERVICE_PASSWORD` doit rester vide.

---

## Table DB Founder

La table persistante Founder est :

```sql
app.chatlaya_founder_projects