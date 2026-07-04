// ─── KORYXA Shared Taxonomy — 100% IA ────────────────────────────────────────
// Source unique de vérité.
// KORYXA règle uniquement les besoins IA des entreprises.
// Chaque domaine, type de mission et mode de collab est ancré dans l'IA.

export type TaxonomyItem = {
  id: string;
  label: string;
  emoji?: string;
  hint?: string;
};

// ─── Référentiel 1 : Domaines d'application IA ───────────────────────────────
// "Dans quel domaine de votre activité voulez-vous qu'une solution IA intervienne ?"

export const DOMAINS: TaxonomyItem[] = [
  { id: "ia_data_reporting",    label: "Data & Reporting IA",         emoji: "📊", hint: "Tableaux de bord automatisés, KPIs en temps réel, analyse prédictive." },
  { id: "ia_automatisation",    label: "Automatisation IA",           emoji: "🤖", hint: "Suppression des tâches répétitives, workflows intelligents, scripts." },
  { id: "ia_marketing_content", label: "Marketing & Contenu IA",      emoji: "📣", hint: "Génération de contenu, personnalisation, acquisition assistée par IA." },
  { id: "ia_sales_crm",         label: "Sales & CRM IA",              emoji: "🤝", hint: "Scoring de leads, relances automatiques, pipeline intelligent." },
  { id: "ia_ops_process",       label: "Ops & Process IA",            emoji: "⚙️", hint: "Optimisation des processus, détection d'anomalies, coordination IA." },
  { id: "ia_rh_talent",         label: "RH & Talent IA",              emoji: "🤲", hint: "Recrutement IA, matching RH, analyse des compétences." },
  { id: "ia_finance_pilotage",  label: "Finance & Pilotage IA",       emoji: "💳", hint: "Prévisions financières IA, détection de fraude, contrôle de gestion." },
  { id: "ia_produit_tech",      label: "Produit & Tech IA",           emoji: "💻", hint: "Intégration IA dans un produit, APIs IA, LLMs, no-code IA." },
  { id: "ia_service_client",    label: "Service Client IA",           emoji: "💬", hint: "Chatbots, réponses automatisées, analyse sentiment, tickets IA." },
  { id: "ia_strategie",         label: "Stratégie & Décision IA",     emoji: "🎯", hint: "Aide à la décision, diagnostic IA, veille et intelligence compétitive." },
];

// ─── Référentiel 2 : Types d'intervention IA ─────────────────────────────────
// Ce que le talent IA apporte concrètement

export const MISSION_TYPES: TaxonomyItem[] = [
  { id: "automatisation",         label: "Automatisation IA",             emoji: "🤖", hint: "Construire des workflows IA qui remplacent les tâches manuelles." },
  { id: "analyse_reporting",      label: "Analyse & Reporting IA",        emoji: "📊", hint: "Dashboards, modèles de données, insights actionnables." },
  { id: "llm_prompting",          label: "LLM & Prompting",               emoji: "🧠", hint: "Intégration de modèles de langage, prompt engineering, agents IA." },
  { id: "ml_prediction",          label: "ML & Prédiction",               emoji: "📈", hint: "Modèles prédictifs, scoring, recommandations, détection d'anomalies." },
  { id: "ia_marketing",           label: "IA Marketing & Contenu",        emoji: "📣", hint: "Génération de contenu IA, personnalisation, SEO automatisé." },
  { id: "ia_produit",             label: "IA dans un produit",            emoji: "💻", hint: "Intégrer l'IA dans une application, un service ou une API." },
  { id: "formation_ia",           label: "Formation & Montée en IA",      emoji: "🎓", hint: "Acculturer une équipe, former des collaborateurs, coacher en IA." },
  { id: "audit_strategie_ia",     label: "Audit & Stratégie IA",          emoji: "🔍", hint: "Diagnostiquer la maturité IA, définir une roadmap, choisir les bons outils." },
  { id: "ia_ops",                 label: "IA Ops & Infrastructure",       emoji: "🏗️", hint: "Déploiement de modèles, MLOps, orchestration, monitoring IA." },
];

// ─── Référentiel 3 : Modes de collaboration ──────────────────────────────────

export const COLLAB_MODES: TaxonomyItem[] = [
  { id: "mission_courte",         label: "Mission courte (1-4 semaines)",  hint: "Livrable IA précis, démarrage rapide." },
  { id: "mission_longue",         label: "Mission longue (1-6 mois)",      hint: "Accompagnement IA continu, engagement durable." },
  { id: "retainer",               label: "Récurrent / Retainer",           hint: "Quelques heures par semaine sur la durée." },
  { id: "remote",                 label: "100% Remote",                    hint: "Tout à distance, asynchrone possible." },
  { id: "presentiel",             label: "Présentiel possible",            hint: "Peut se déplacer selon les besoins." },
  { id: "execution_autonome",     label: "Exécution autonome",             hint: "Le talent livres les résultats IA en autonomie." },
  { id: "collaboration_integree", label: "Collaboration avec l'équipe",    hint: "Le talent s'intègre dans l'équipe en place." },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const DOMAIN_BY_ID = Object.fromEntries(DOMAINS.map((d) => [d.id, d]));
export const MISSION_TYPE_BY_ID = Object.fromEntries(MISSION_TYPES.map((m) => [m.id, m]));
export const COLLAB_MODE_BY_ID = Object.fromEntries(COLLAB_MODES.map((c) => [c.id, c]));

export type DomainId = (typeof DOMAINS)[number]["id"];
export type MissionTypeId = (typeof MISSION_TYPES)[number]["id"];
export type CollabModeId = (typeof COLLAB_MODES)[number]["id"];
