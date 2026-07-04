from __future__ import annotations

import asyncio
import json
import re
from datetime import datetime, timezone
from typing import Any

from app.core.ai import generate_answer

_JSON_BLOCK_RE = re.compile(r"```(?:json)?\s*(\{.*\})\s*```", re.DOTALL)
_SPLIT_RE = re.compile(r"[^\w]+", re.UNICODE)

_PROJECT_STAGES = {"idea", "validation", "launch", "first_sales", "structuring"}
_BUSINESS_TYPES = {
    "service",
    "saas",
    "agency",
    "commerce",
    "digital_product",
    "training",
    "marketplace",
    "coaching",
    "import_export",
    "fintech",
    "edtech",
    "other",
}
_MAIN_GOALS = {
    "clarify_idea",
    "build_offer",
    "validate_problem",
    "set_price",
    "find_clients",
    "prepare_business_plan",
    "pitch",
    "action_plan",
    "funding",
}
_SCORE_KEYS = (
    "client_clarity",
    "problem_clarity",
    "offer_strength",
    "pricing_coherence",
    "business_model",
    "validation",
    "sales_readiness",
    "execution_readiness",
)
_DIAGNOSIS_KEYS = (
    "client",
    "problem",
    "offer",
    "pricing",
    "business_model",
    "validation",
    "sales",
    "execution",
)
_DEFAULT_DIAGNOSIS = {
    "client": "Le client cible n'est pas encore formule avec assez de precision pour guider l'execution.",
    "problem": "Le probleme central doit etre decrit avec plus de concret, de frequence et de consequence client.",
    "offer": "L'offre reste a clarifier en termes de promesse, livrable et transformation attendue.",
    "pricing": "La logique de prix doit encore etre reliee a la valeur percue et au mode de paiement reel du client.",
    "business_model": "Le modele economique doit preciser revenus, couts cles et mecanique de marge.",
    "validation": "Les preuves terrain et signaux de validation sont encore insuffisants.",
    "sales": "Le canal d'acquisition et le message de vente doivent etre rendus plus operationnels.",
    "execution": "Le projet a besoin d'un plan d'action court terme avec priorites et sorties attendues.",
}
_CLIENT_PROBLEM_SCORE_KEYS = (
    "client_precision",
    "problem_intensity",
    "market_accessibility",
    "validation_readiness",
)
_OFFER_VALUE_SCORE_KEYS = (
    "offer_clarity",
    "value_strength",
    "differentiation",
    "trust_readiness",
    "testability",
)
_PRICING_BUSINESS_MODEL_SCORE_KEYS = (
    "pricing_clarity",
    "payment_fit",
    "margin_potential",
    "business_model_clarity",
    "financial_readiness",
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).strip().split())


def _truncate(value: str, limit: int = 320) -> str:
    cleaned = _clean_text(value)
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 3].rstrip() + "..."


def _clamp_score(value: Any) -> int:
    try:
        score = int(round(float(value)))
    except Exception:
        score = 0
    return max(0, min(100, score))


def _coerce_string_list(value: Any, limit: int = 7) -> list[str]:
    if not isinstance(value, list):
        return []
    items = [_truncate(item, 180) for item in value if _clean_text(item)]
    return items[:limit]


def _tokenize(*values: str) -> set[str]:
    tokens: set[str] = set()
    for value in values:
        for token in _SPLIT_RE.split(_clean_text(value).lower()):
            if token:
                tokens.add(token)
    return tokens


def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    normalized = _clean_text(text).lower()
    return any(keyword in normalized for keyword in keywords)


def _extract_workspace_signals(project_data: dict[str, Any]) -> dict[str, str]:
    workspace = _as_dict(project_data.get("workspace"))
    signals: dict[str, str] = {}
    for module_id, module_state in workspace.items():
        state = _as_dict(module_state)
        inputs = _as_dict(state.get("inputs"))
        values = [_clean_text(raw) for raw in inputs.values() if _clean_text(raw)]
        output = _clean_text(state.get("output"))
        retention = _clean_text(state.get("retention"))
        combined = values[:3]
        if retention:
            combined.append(retention)
        elif output:
            combined.append(output)
        if combined:
            signals[str(module_id)] = " | ".join(_truncate(item, 140) for item in combined[:3])
    return signals


def _infer_business_type(tokens: set[str], joined_text: str) -> str:
    rules = (
        ("saas", ("saas", "software", "logiciel", "app", "application", "plateforme")),
        ("agency", ("agency", "agence")),
        ("marketplace", ("marketplace", "marcheplace", "market-place")),
        ("training", ("training", "formation", "cours", "academy", "academie")),
        ("coaching", ("coaching", "coach", "mentorat", "mentoring")),
        ("digital_product", ("ebook", "template", "digital", "numerique", "guide")),
        ("commerce", ("boutique", "shop", "store", "vente", "produits", "retail", "ecommerce")),
        ("import_export", ("import", "export", "douane", "container", "grossiste")),
        ("fintech", ("fintech", "mobile money", "paiement", "payment", "wallet", "credit")),
        ("edtech", ("edtech", "school", "ecole", "learning", "education")),
        ("service", ("service", "consulting", "prestation", "freelance")),
    )
    for value, keywords in rules:
        if any(keyword in joined_text for keyword in keywords):
            return value
        if any(keyword in tokens for keyword in keywords):
            return value
    return "other"


def _infer_main_goal(current_step: str, joined_text: str, instruction: str) -> str:
    current = _clean_text(current_step).lower()
    text = f"{joined_text} {instruction}".lower()
    if "fund" in text or "financement" in text or "invest" in text or "subvention" in text:
        return "funding"
    if "pitch" in text or current == "pitch_vente":
        return "pitch"
    if "business plan" in text or current == "business_plan":
        return "prepare_business_plan"
    if "prix" in text or "pricing" in text or current == "prix":
        return "set_price"
    if "client" in text or "vente" in text or "whatsapp" in text or "acquisition" in text:
        return "find_clients"
    if current == "probleme" or "probleme" in text or "problem" in text:
        return "validate_problem"
    if current == "offre_valeur" or "offre" in text or "value proposition" in text:
        return "build_offer"
    if "plan d'action" in text or "action plan" in text or "execution" in text:
        return "action_plan"
    return "clarify_idea"


def _infer_project_stage(
    status: str,
    current_step: str,
    project_data: dict[str, Any],
    scores: dict[str, int],
    joined_text: str,
) -> str:
    if status in {"completed", "validated"} or scores["global"] >= 75:
        return "structuring"
    if "vente" in joined_text and ("client" in joined_text or "commande" in joined_text or "sales" in joined_text):
        return "first_sales"
    if current_step in {"pitch_vente", "business_plan"} or scores["sales_readiness"] >= 60:
        return "launch"
    if current_step in {"prix", "business_model", "validation_preuves"} or scores["validation"] >= 45:
        return "validation"
    if _as_dict(project_data.get("agent_cadrage_v1")):
        return "validation"
    return "idea"


def _score_from_signal(signal: str, weights: tuple[int, int, int]) -> int:
    if not signal:
        return weights[0]
    length = len(signal)
    if length < 45:
        return weights[1]
    return weights[2]


def _build_scores(workspace_signals: dict[str, str], joined_text: str) -> dict[str, int]:
    scores = {
        "client_clarity": _score_from_signal(workspace_signals.get("client", ""), (15, 38, 68)),
        "problem_clarity": _score_from_signal(workspace_signals.get("probleme", ""), (10, 35, 66)),
        "offer_strength": _score_from_signal(workspace_signals.get("offre", ""), (12, 40, 70)),
        "pricing_coherence": _score_from_signal(workspace_signals.get("prix", ""), (8, 32, 62)),
        "business_model": _score_from_signal(workspace_signals.get("business_model", ""), (10, 36, 64)),
        "validation": 18,
        "sales_readiness": _score_from_signal(workspace_signals.get("vente", ""), (10, 34, 63)),
        "execution_readiness": _score_from_signal(workspace_signals.get("business_plan", ""), (12, 38, 67)),
    }
    validation_bonus = 0
    if _contains_any(joined_text, ("test", "pilote", "preuve", "preuve terrain", "client payant", "commande", "feedback")):
        validation_bonus += 20
    if _contains_any(joined_text, ("whatsapp", "facebook", "instagram", "terrain", "distribution", "mobile money", "cash")):
        scores["sales_readiness"] = _clamp_score(scores["sales_readiness"] + 8)
        scores["execution_readiness"] = _clamp_score(scores["execution_readiness"] + 5)
    scores["validation"] = _clamp_score(scores["validation"] + validation_bonus)
    scores["global"] = round(sum(scores[key] for key in _SCORE_KEYS) / len(_SCORE_KEYS))
    return scores


def _build_diagnosis(workspace_signals: dict[str, str], scores: dict[str, int], project_stage: str, business_type: str) -> dict[str, str]:
    diagnosis = dict(_DEFAULT_DIAGNOSIS)
    if workspace_signals.get("client"):
        diagnosis["client"] = f"Le projet cible deja un segment identifiable : {workspace_signals['client']}."
    if workspace_signals.get("probleme"):
        diagnosis["problem"] = f"Le probleme commence a etre formule de maniere exploitable : {workspace_signals['probleme']}."
    if workspace_signals.get("offre"):
        diagnosis["offer"] = f"L'offre de valeur est partiellement definie : {workspace_signals['offre']}."
    if workspace_signals.get("prix"):
        diagnosis["pricing"] = f"Une hypothese de prix existe deja : {workspace_signals['prix']}."
    if workspace_signals.get("business_model"):
        diagnosis["business_model"] = f"Le modele economique montre deja quelques hypotheses : {workspace_signals['business_model']}."
    if workspace_signals.get("vente"):
        diagnosis["sales"] = f"Le canal de vente ou le pitch sont amorces : {workspace_signals['vente']}."
    if workspace_signals.get("business_plan"):
        diagnosis["execution"] = f"Une base d'execution ou de plan d'action existe deja : {workspace_signals['business_plan']}."
    if project_stage in {"launch", "first_sales", "structuring"}:
        diagnosis["validation"] = "Le projet peut aller au-dela du cadrage pur et doit renforcer les preuves terrain, le paiement et la repetition commerciale."
    if business_type in {"commerce", "import_export"}:
        diagnosis["pricing"] += " Pour ce type d'activite, il faut integrer logistique, stock, cash et rotation."
    if business_type in {"training", "coaching", "service", "agency"}:
        diagnosis["sales"] += " La confiance, le bouche-a-oreille, WhatsApp et les preuves de resultat seront critiques."
    return diagnosis


def _build_strengths(project: dict[str, Any], workspace_signals: dict[str, str], scores: dict[str, int]) -> list[str]:
    strengths: list[str] = []
    title = _clean_text(project.get("title"))
    if title and title != "Projet Founder":
        strengths.append(f"Le projet dispose deja d'un intitule de travail identifiable : {title}.")
    if project.get("opencloud_project_path"):
        strengths.append("Le projet est deja rattache a un workspace documentaire OpenCloud.")
    if workspace_signals.get("client"):
        strengths.append("Le client cible commence a etre decrit, ce qui aide a orienter l'offre.")
    if workspace_signals.get("offre"):
        strengths.append("Une base d'offre existe deja, utile pour construire le dossier vivant.")
    if workspace_signals.get("vente"):
        strengths.append("Le projet mentionne deja un canal de vente ou de distribution.")
    if scores["global"] >= 60:
        strengths.append("Le niveau de maturite global permet de passer vers un plan d'action plus concret.")
    return strengths[:6]


def _build_risks(workspace_signals: dict[str, str], scores: dict[str, int], business_type: str) -> list[str]:
    risks: list[str] = []
    if not workspace_signals.get("probleme"):
        risks.append("Le probleme client n'est pas encore assez concret pour soutenir une vraie validation terrain.")
    if scores["pricing_coherence"] < 40:
        risks.append("Le prix n'est pas encore relie a la valeur percue, au budget client et au mode de paiement reel.")
    if scores["validation"] < 40:
        risks.append("Le projet manque encore de preuves, retours terrain ou premiers signaux de traction.")
    if scores["sales_readiness"] < 45:
        risks.append("Le dispositif d'acquisition client reste trop flou pour generer des ventes rapidement.")
    if business_type in {"commerce", "import_export"}:
        risks.append("La gestion du cash, de la logistique et de la confiance fournisseur peut devenir un point de blocage.")
    elif business_type in {"service", "agency", "coaching", "training"}:
        risks.append("La conversion dependra fortement de la confiance client, des preuves et de la repetition commerciale.")
    return risks[:6]


def _build_missing_information(workspace_signals: dict[str, str], business_type: str) -> list[str]:
    missing: list[str] = []
    if not workspace_signals.get("client"):
        missing.append("Le profil client prioritaire, son contexte et son pouvoir d'achat.")
    if not workspace_signals.get("probleme"):
        missing.append("Le probleme principal, sa frequence et le cout de l'inaction.")
    if not workspace_signals.get("offre"):
        missing.append("Le livrable exact, la promesse et la transformation attendue.")
    if not workspace_signals.get("prix"):
        missing.append("Le prix cible, le mode de paiement et la justification de valeur.")
    if not workspace_signals.get("business_model"):
        missing.append("Les sources de revenus, couts cles et hypothese de marge.")
    if not workspace_signals.get("vente"):
        missing.append("Le canal principal d'acquisition, le message et le premier tunnel de conversion.")
    if business_type in {"commerce", "import_export"}:
        missing.append("Les hypotheses de stock, livraison, approvisionnement et rotation de tresorerie.")
    return missing[:7]


def _build_recommended_next_step(main_goal: str, project_stage: str) -> str:
    mapping = {
        "clarify_idea": "Transformer l'idee en offre ciblee autour d'un client prioritaire et d'un probleme urgent.",
        "build_offer": "Structurer une offre simple, vendable et testable rapidement sur le terrain.",
        "validate_problem": "Verifier que le probleme est reel, frequent et suffisamment couteux pour declencher un achat.",
        "set_price": "Definir un prix testable, compatible avec la valeur percue et les moyens de paiement locaux.",
        "find_clients": "Passer en acquisition active avec un canal prioritaire et un message de conversion simple.",
        "prepare_business_plan": "Consolider le dossier vivant en hypotheses, actions et indicateurs clairs.",
        "pitch": "Transformer le cadrage en pitch court, concret et orienté decision.",
        "action_plan": "Prioriser un plan d'action 7 jours focalise sur les sorties utiles.",
        "funding": "Stabiliser l'offre, les preuves et le modele avant toute demarche de financement.",
    }
    sentence = mapping.get(main_goal, "Clarifier l'etape la plus critique pour faire avancer le projet.")
    if project_stage == "first_sales":
        return sentence + " L'objectif est maintenant de transformer les premiers signaux en ventes repetables."
    return sentence


def _build_next_best_action(main_goal: str, project_stage: str, business_type: str, workspace_signals: dict[str, str]) -> dict[str, Any]:
    title = "Mener un sprint terrain de clarification client-probleme"
    why = "Le projet a besoin d'un point d'ancrage concret avant d'investir davantage dans le dossier ou le business plan."
    how = [
        "Choisir un segment client prioritaire unique pour les 7 prochains jours.",
        "Lister 5 prospects reels a contacter via WhatsApp, appel ou rencontre directe.",
        "Tester une formulation courte du probleme et noter les reactions.",
        "Identifier ce que le client paie deja, comment il paie et ce qui bloque la confiance.",
    ]
    expected_output = "Une cible prioritaire, un probleme valide ou invalide, et un angle d'offre plus net."

    if main_goal == "set_price":
        title = "Tester un prix simple avec un mode de paiement realiste"
        why = "Le projet doit relier la valeur percue au budget client, au cash disponible et aux usages mobile money ou cash."
        how = [
            "Formuler 2 options de prix maximum.",
            "Tester ces options aupres de 5 prospects reels.",
            "Verifier si le paiement se fait plutot en cash, mobile money, acompte ou echelonne.",
            "Noter les objections et la perception de valeur.",
        ]
        expected_output = "Une premiere fourchette de prix defendable et un mode de paiement prioritaire."
    elif main_goal in {"find_clients", "pitch"} or project_stage in {"launch", "first_sales"}:
        title = "Lancer une boucle de prospection courte et mesurable"
        why = "Le projet doit passer du cadrage a la confrontation commerciale concrete."
        how = [
            "Rediger un message de vente court adapte a WhatsApp ou appel.",
            "Contacter 10 prospects cibles sur un seul canal prioritaire.",
            "Mesurer reponses, objections et conversions vers un rendez-vous ou un paiement.",
            "Ajuster le pitch selon les retours obtenus.",
        ]
        expected_output = "Un canal prioritaire valide, un pitch plus net et des objections reelles documentees."
    elif main_goal == "prepare_business_plan":
        title = "Transformer le cadrage en dossier vivant actionnable"
        why = "Le Founder Builder OS doit servir d'outil de pilotage, pas seulement de document de presentation."
        how = [
            "Consolider le client, le probleme, l'offre et le prix dans une version simple.",
            "Formuler les hypotheses critiques et les actions de validation.",
            "Relier le dossier aux prochaines sorties attendues sur 7 jours.",
            "Documenter les preuves et decisions dans le workspace.",
        ]
        expected_output = "Un dossier vivant exploitable pour agir, pitcher et suivre les prochaines validations."
    if business_type in {"commerce", "import_export"}:
        how.append("Ajouter une verification logistique simple: approvisionnement, stock, livraison et marge nette.")
    return {"title": title, "why": why, "how": how[:5], "expected_output": expected_output}


def _build_suggested_questions(main_goal: str, business_type: str, workspace_signals: dict[str, str]) -> list[str]:
    questions: list[str] = []
    if not workspace_signals.get("client"):
        questions.append("Qui est votre client prioritaire exact, et dans quelle situation achete-t-il ?")
    if not workspace_signals.get("probleme"):
        questions.append("Quel probleme urgent resout le projet, et qu'est-ce que le client perd si rien ne change ?")
    if not workspace_signals.get("offre"):
        questions.append("Quel resultat concret promettez-vous au client en une phrase simple ?")
    if main_goal == "set_price" or not workspace_signals.get("prix"):
        questions.append("Quel prix votre client pourrait-il payer aujourd'hui, par quel mode de paiement reel ?")
    if main_goal in {"find_clients", "pitch"} or not workspace_signals.get("vente"):
        questions.append("Par quel canal allez-vous chercher les 10 prochains prospects: WhatsApp, terrain, reseau, appel ou autre ?")
    if business_type in {"commerce", "import_export"}:
        questions.append("Quel est votre risque principal sur le stock, la livraison ou la tresorerie ?")
    elif business_type in {"service", "training", "coaching", "agency"}:
        questions.append("Quelles preuves de confiance pouvez-vous montrer des maintenant: temoignage, resultat, demo, essai ?")
    return questions[:7]


def _build_roadmap_7_days(main_goal: str, next_best_action: dict[str, Any]) -> list[str]:
    action_title = _clean_text(next_best_action.get("title")) or "Action prioritaire"
    steps = [
        "Jour 1: clarifier l'objectif de la semaine et choisir un seul segment client prioritaire.",
        "Jour 2: preparer le message, le pitch ou l'offre test a confronter au terrain.",
        "Jour 3: contacter ou rencontrer des prospects reels et collecter des retours.",
        "Jour 4: ajuster l'offre, le prix ou le message selon les objections observees.",
        "Jour 5: refaire une deuxieme boucle de test avec la version ajustee.",
        "Jour 6: documenter les apprentissages utiles dans le dossier vivant Founder.",
        f"Jour 7: prendre une decision claire a partir de l'action '{action_title}' et definir la prochaine priorite.",
    ]
    if main_goal == "prepare_business_plan":
        steps[5] = "Jour 6: consolider hypotheses, preuves, actions et chiffres utiles dans le dossier vivant."
    return steps


def build_deterministic_cadrage_analysis(project: dict[str, Any], instruction: str | None = None) -> dict[str, Any]:
    title = _clean_text(project.get("title")) or "Projet Founder"
    status = _clean_text(project.get("status")) or "draft"
    current_step = _clean_text(project.get("current_step")) or "point_de_depart"
    project_data = _as_dict(project.get("project_data"))
    workspace_signals = _extract_workspace_signals(project_data)
    opencloud_project_path = _clean_text(project.get("opencloud_project_path"))
    instruction_text = _clean_text(instruction)
    joined_text = " ".join(
        part
        for part in [
            title,
            status,
            current_step,
            instruction_text,
            opencloud_project_path,
            " ".join(workspace_signals.values()),
            json.dumps(project_data, ensure_ascii=True, default=str),
        ]
        if part
    ).lower()
    tokens = _tokenize(joined_text)

    business_type = _infer_business_type(tokens, joined_text)
    scores = _build_scores(workspace_signals, joined_text)
    main_goal = _infer_main_goal(current_step, joined_text, instruction_text)
    project_stage = _infer_project_stage(status, current_step, project_data, scores, joined_text)
    diagnosis = _build_diagnosis(workspace_signals, scores, project_stage, business_type)
    strengths = _build_strengths(project, workspace_signals, scores)
    risks = _build_risks(workspace_signals, scores, business_type)
    missing_information = _build_missing_information(workspace_signals, business_type)
    recommended_next_step = _build_recommended_next_step(main_goal, project_stage)
    next_best_action = _build_next_best_action(main_goal, project_stage, business_type, workspace_signals)
    suggested_questions = _build_suggested_questions(main_goal, business_type, workspace_signals)
    roadmap_7_days = _build_roadmap_7_days(main_goal, next_best_action)

    summary_parts = [
        f"{title} est analyse comme un projet de stade '{project_stage}' avec une orientation business '{business_type}'.",
        f"Le score global de maturite est estime a {scores['global']}/100.",
        "Le projet doit etre pilote comme un Founder Builder OS: clarifier, documenter, scorer puis executer."
    ]
    if opencloud_project_path:
        summary_parts.append(f"Le workspace OpenCloud est deja en place via {opencloud_project_path}.")
    if instruction_text:
        summary_parts.append(f"Instruction prise en compte: {_truncate(instruction_text, 160)}.")

    return {
        "project_stage": project_stage,
        "business_type": business_type,
        "main_goal": main_goal,
        "summary": " ".join(summary_parts),
        "diagnosis": diagnosis,
        "maturity_scores": scores,
        "strengths": strengths,
        "risks": risks,
        "missing_information": missing_information,
        "recommended_next_step": recommended_next_step,
        "next_best_action": next_best_action,
        "suggested_questions": suggested_questions,
        "roadmap_7_days": roadmap_7_days,
    }


def _normalize_diagnosis(value: Any, fallback: dict[str, str]) -> dict[str, str]:
    payload = _as_dict(value)
    return {
        key: _truncate(payload.get(key) or fallback[key], 320)
        for key in _DIAGNOSIS_KEYS
    }


def _normalize_scores(value: Any, fallback: dict[str, int]) -> dict[str, int]:
    payload = _as_dict(value)
    scores = {key: _clamp_score(payload.get(key, fallback[key])) for key in _SCORE_KEYS}
    scores["global"] = round(sum(scores[key] for key in _SCORE_KEYS) / len(_SCORE_KEYS))
    return scores


def _normalize_next_best_action(value: Any, fallback: dict[str, Any]) -> dict[str, Any]:
    payload = _as_dict(value)
    return {
        "title": _truncate(payload.get("title") or fallback["title"], 140),
        "why": _truncate(payload.get("why") or fallback["why"], 260),
        "how": _coerce_string_list(payload.get("how"), limit=6) or fallback["how"],
        "expected_output": _truncate(payload.get("expected_output") or fallback["expected_output"], 220),
    }


def _normalize_enum(value: Any, allowed: set[str], fallback: str) -> str:
    candidate = _clean_text(value).lower()
    return candidate if candidate in allowed else fallback


def _normalize_analysis(value: Any, fallback: dict[str, Any]) -> dict[str, Any]:
    payload = _as_dict(value)
    normalized = {
        "project_stage": _normalize_enum(payload.get("project_stage"), _PROJECT_STAGES, fallback["project_stage"]),
        "business_type": _normalize_enum(payload.get("business_type"), _BUSINESS_TYPES, fallback["business_type"]),
        "main_goal": _normalize_enum(payload.get("main_goal"), _MAIN_GOALS, fallback["main_goal"]),
        "summary": _truncate(payload.get("summary") or fallback["summary"], 500),
        "diagnosis": _normalize_diagnosis(payload.get("diagnosis"), fallback["diagnosis"]),
        "maturity_scores": _normalize_scores(payload.get("maturity_scores"), fallback["maturity_scores"]),
        "strengths": _coerce_string_list(payload.get("strengths"), limit=6) or fallback["strengths"],
        "risks": _coerce_string_list(payload.get("risks"), limit=6) or fallback["risks"],
        "missing_information": _coerce_string_list(payload.get("missing_information"), limit=7) or fallback["missing_information"],
        "recommended_next_step": _truncate(payload.get("recommended_next_step") or fallback["recommended_next_step"], 260),
        "next_best_action": _normalize_next_best_action(payload.get("next_best_action"), fallback["next_best_action"]),
        "suggested_questions": _coerce_string_list(payload.get("suggested_questions"), limit=7) or fallback["suggested_questions"],
        "roadmap_7_days": _coerce_string_list(payload.get("roadmap_7_days"), limit=7) or fallback["roadmap_7_days"],
    }
    normalized["maturity_scores"]["global"] = round(
        sum(normalized["maturity_scores"][key] for key in _SCORE_KEYS) / len(_SCORE_KEYS)
    )
    return normalized


def _extract_json_payload(raw_text: str) -> dict[str, Any]:
    text = raw_text.strip()
    if not text:
        return {}
    fenced = _JSON_BLOCK_RE.search(text)
    if fenced:
        text = fenced.group(1)
    return _as_dict(json.loads(text))


def _build_llm_prompt(project: dict[str, Any], instruction: str | None, fallback: dict[str, Any]) -> str:
    title = _clean_text(project.get("title")) or "Projet Founder"
    status = _clean_text(project.get("status")) or "draft"
    current_step = _clean_text(project.get("current_step")) or "point_de_depart"
    project_data = json.dumps(_as_dict(project.get("project_data")), ensure_ascii=True, default=str)
    opencloud_project_path = _clean_text(project.get("opencloud_project_path")) or "N/A"
    instruction_block = _clean_text(instruction) or "Aucune instruction additionnelle."
    fallback_json = json.dumps(fallback, ensure_ascii=True, default=str)
    return (
        "Tu es founder_cadrage_v1, mais ton positionnement produit est: Founder Diagnostic & Orientation Agent V1.\n"
        "Tu n'es pas un chatbot. Tu n'es pas un simple generateur de business plan.\n"
        "Tu agis comme un moteur de diagnostic produit structure pour un Founder Builder OS: workspace guide, dossier vivant, scores, actions, exports et execution.\n"
        "Tu dois retourner UNIQUEMENT un JSON valide, sans markdown, sans commentaire et sans texte avant ou apres.\n"
        "Le diagnostic doit orienter vers l'action, pas vers une conversation.\n"
        "Integre si pertinent les realites africaines/locales: WhatsApp, mobile money, cash, confiance client, petits budgets, distribution locale.\n"
        "Schema JSON attendu:\n"
        "{"
        "\"project_stage\": \"idea|validation|launch|first_sales|structuring\","
        "\"business_type\": \"service|saas|agency|commerce|digital_product|training|marketplace|coaching|import_export|fintech|edtech|other\","
        "\"main_goal\": \"clarify_idea|build_offer|validate_problem|set_price|find_clients|prepare_business_plan|pitch|action_plan|funding\","
        "\"summary\": string,"
        "\"diagnosis\": {"
        "\"client\": string,"
        "\"problem\": string,"
        "\"offer\": string,"
        "\"pricing\": string,"
        "\"business_model\": string,"
        "\"validation\": string,"
        "\"sales\": string,"
        "\"execution\": string"
        "},"
        "\"maturity_scores\": {"
        "\"client_clarity\": 0,"
        "\"problem_clarity\": 0,"
        "\"offer_strength\": 0,"
        "\"pricing_coherence\": 0,"
        "\"business_model\": 0,"
        "\"validation\": 0,"
        "\"sales_readiness\": 0,"
        "\"execution_readiness\": 0,"
        "\"global\": 0"
        "},"
        "\"strengths\": [string],"
        "\"risks\": [string],"
        "\"missing_information\": [string],"
        "\"recommended_next_step\": string,"
        "\"next_best_action\": {"
        "\"title\": string,"
        "\"why\": string,"
        "\"how\": [string],"
        "\"expected_output\": string"
        "},"
        "\"suggested_questions\": [string],"
        "\"roadmap_7_days\": [string]"
        "}\n"
        "Contraintes:\n"
        "- scores entre 0 et 100\n"
        "- le score global doit etre coherent avec les autres\n"
        "- style direct, professionnel, actionnable\n"
        "- ne revele aucun secret, token ou detail interne\n"
        "- n'ecris pas comme un assistant conversationnel\n"
        f"Instruction additionnelle: {instruction_block}\n"
        f"Titre: {title}\n"
        f"Statut: {status}\n"
        f"Etape courante: {current_step}\n"
        f"OpenCloud path: {opencloud_project_path}\n"
        f"Project data JSON: {project_data}\n"
        f"Fallback deterministic reference: {fallback_json}\n"
    )


async def run_founder_cadrage_v1(
    project: dict[str, Any],
    instruction: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    fallback = build_deterministic_cadrage_analysis(project, instruction=instruction)
    analysis = fallback
    source = "deterministic"
    try:
        prompt = _build_llm_prompt(project, instruction, fallback)
        raw_response = await asyncio.to_thread(
            generate_answer,
            prompt,
            None,
            None,
            90,
            1500,
        )
        candidate = _extract_json_payload(raw_response)
        if candidate:
            analysis = _normalize_analysis(candidate, fallback)
            source = "llm"
    except Exception:
        analysis = fallback
        source = "deterministic"

    patch = {
        "agent_cadrage_v1": {
            "agent": "founder_cadrage_v1",
            "label": "Founder Diagnostic & Orientation Agent V1",
            "version": 1,
            "source": source,
            "generated_at": _now_iso(),
            "instruction": _clean_text(instruction) or None,
            "analysis": analysis,
        }
    }
    return analysis, patch


def _infer_target_segment(workspace_signals: dict[str, str], joined_text: str) -> str:
    if workspace_signals.get("client"):
        return _truncate(workspace_signals["client"], 180)
    if _contains_any(joined_text, ("pme", "tpe", "entreprise", "business")):
        return "PME/TPE locales avec besoin concret et budget limite."
    if _contains_any(joined_text, ("jeune", "women", "femme", "mother", "etudiant", "student")):
        return "Segment individuel local, accessible via reseaux de proximite et mobile."
    return "Segment prioritaire encore a confirmer sur le terrain."


def _infer_ability_to_pay(joined_text: str, business_type: str) -> str:
    if _contains_any(joined_text, ("mobile money", "cash", "petit budget", "budget limite", "versement", "acompte")):
        return "Pouvoir d'achat contraint, avec preference probable pour cash, mobile money ou paiement fractionne."
    if business_type in {"service", "training", "coaching"}:
        return "Capacite de paiement a valider via offres simples, acompte ou format d'entree de gamme."
    if business_type in {"commerce", "import_export"}:
        return "Capacite de paiement sensible au cash disponible, a la rotation et a la confiance commerciale."
    return "Capacite de paiement encore floue et a tester rapidement."


def _infer_access_channel(workspace_signals: dict[str, str], joined_text: str) -> str:
    vente_signal = workspace_signals.get("vente", "")
    if vente_signal:
        return _truncate(vente_signal, 180)
    if _contains_any(joined_text, ("whatsapp", "facebook", "instagram", "bouche a oreille", "terrain", "marche", "diaspora")):
        return "WhatsApp, bouche-a-oreille, groupes locaux ou marche physique semblent etre les canaux les plus accessibles."
    return "Canal d'acces client encore a prioriser entre digital leger et terrain."


def _infer_pain_level(problem_signal: str, joined_text: str) -> int:
    if not problem_signal:
        return 30
    level = 55 if len(problem_signal) >= 40 else 40
    if _contains_any(joined_text, ("urgent", "perte", "douleur", "bloque", "frustration", "revenus", "manque de confiance")):
        level += 20
    if _contains_any(joined_text, ("quotidien", "chaque semaine", "frequent", "souvent")):
        level += 10
    return _clamp_score(level)


def _infer_frequency(problem_signal: str, joined_text: str) -> str:
    if _contains_any(problem_signal + " " + joined_text, ("quotidien", "daily", "chaque jour")):
        return "quotidienne"
    if _contains_any(problem_signal + " " + joined_text, ("chaque semaine", "hebdo", "weekly", "souvent", "frequent")):
        return "frequente"
    if problem_signal:
        return "reguliere mais encore a quantifier"
    return "non documentee"


def _build_problem_consequences(problem_signal: str, joined_text: str) -> list[str]:
    consequences: list[str] = []
    if _contains_any(problem_signal + " " + joined_text, ("revenus", "vente", "commandes")):
        consequences.append("Perte de revenus ou difficulte a convertir les premiers clients.")
    if _contains_any(problem_signal + " " + joined_text, ("confiance", "credibilite", "preuve")):
        consequences.append("Faible confiance client et cycle de vente rallonge.")
    if _contains_any(problem_signal + " " + joined_text, ("materiel", "stock", "logistique", "livraison")):
        consequences.append("Execution ralentie par les contraintes de materiel ou de distribution.")
    if not consequences:
        consequences.append("Le client risque de continuer avec des solutions imparfaites ou informelles.")
    return consequences[:4]


def _build_current_alternatives(joined_text: str, business_type: str) -> list[str]:
    alternatives: list[str] = []
    if _contains_any(joined_text, ("whatsapp", "facebook", "groupe", "bouche a oreille")):
        alternatives.append("Solutions informelles via WhatsApp, groupes Facebook ou bouche-a-oreille.")
    if business_type in {"training", "coaching", "service"}:
        alternatives.append("Prestataires ou formateurs locaux deja connus par le reseau de proximite.")
    if business_type in {"commerce", "import_export"}:
        alternatives.append("Approvisionnement traditionnel via marche physique ou grossiste habituel.")
    if business_type == "digital_product":
        alternatives.append("Contenus gratuits, tutoriels ou ressources partagees localement.")
    if not alternatives:
        alternatives.append("Le client se debrouille probablement avec des alternatives manuelles ou peu structurees.")
    return alternatives[:4]


def _build_client_problem_scores(
    workspace_signals: dict[str, str],
    joined_text: str,
    pain_level: int,
) -> dict[str, int]:
    client_precision = _score_from_signal(workspace_signals.get("client", ""), (18, 45, 72))
    problem_clarity = _score_from_signal(workspace_signals.get("probleme", ""), (16, 42, 70))
    market_accessibility = 35
    if _contains_any(joined_text, ("whatsapp", "bouche a oreille", "facebook", "instagram", "terrain", "marche", "diaspora")):
        market_accessibility += 25
    if _contains_any(joined_text, ("mobile money", "cash", "petit budget", "petits budgets")):
        market_accessibility += 10
    validation_readiness = 22
    if _contains_any(joined_text, ("test", "pilote", "feedback", "preuve", "interview", "prospect", "commande")):
        validation_readiness += 28
    scores = {
        "client_precision": _clamp_score(client_precision),
        "problem_intensity": _clamp_score(pain_level),
        "market_accessibility": _clamp_score(market_accessibility),
        "validation_readiness": _clamp_score(validation_readiness),
    }
    scores["global"] = round(sum(scores[key] for key in _CLIENT_PROBLEM_SCORE_KEYS) / len(_CLIENT_PROBLEM_SCORE_KEYS))
    return scores


def _build_critical_assumptions(
    workspace_signals: dict[str, str],
    joined_text: str,
) -> list[str]:
    assumptions: list[str] = []
    if not workspace_signals.get("client"):
        assumptions.append("Le segment cible choisi est vraiment prioritaire et accessible rapidement.")
    else:
        assumptions.append("Le segment client decrit ressent bien le probleme avec assez d'urgence pour agir.")
    assumptions.append("Le client est pret a payer pour une solution meilleure que ses alternatives actuelles.")
    if _contains_any(joined_text, ("mobile money", "cash")):
        assumptions.append("Le mode de paiement disponible ne bloquera pas la conversion initiale.")
    else:
        assumptions.append("Le mode de paiement reel du client reste compatible avec l'offre proposee.")
    if _contains_any(joined_text, ("whatsapp", "bouche a oreille", "terrain")):
        assumptions.append("Le canal d'acces choisi permet d'obtenir rapidement des conversations terrain utiles.")
    else:
        assumptions.append("Le projet saura atteindre 5 a 10 prospects reels sans cout d'acquisition trop eleve.")
    return assumptions[:5]


def _build_field_questions(
    target_segment: str,
    problem_signal: str,
) -> list[str]:
    questions = [
        f"Dans votre quotidien, quel est aujourd'hui le probleme le plus couteux ou frustrant lie a: {target_segment} ?",
        "Comment gerez-vous ce probleme aujourd'hui, avec quelles limites concretes ?",
        "Qu'est-ce que ce probleme vous coute en argent, temps, energie ou opportunites ratees ?",
        "A quel moment seriez-vous pret a payer pour une solution plus fiable ou plus simple ?",
        "Quel canal vous met le plus en confiance pour acheter ou tester une nouvelle offre ?",
    ]
    if problem_signal:
        questions.append(f"Quand ce probleme apparait-il le plus souvent: { _truncate(problem_signal, 120) } ?")
    return questions[:6]


def _build_people_to_contact(joined_text: str, business_type: str) -> list[str]:
    people = [
        "5 prospects reels du segment prioritaire contactés via WhatsApp ou appel.",
        "2 personnes ayant deja achete une alternative actuelle ou un service voisin.",
        "1 relai de confiance local: vendeur, coach, leader de groupe, association ou animateur communautaire.",
    ]
    if _contains_any(joined_text, ("diaspora",)):
        people.append("2 membres de diaspora lies au besoin ou au pouvoir d'achat cible.")
    if business_type in {"commerce", "import_export"}:
        people.append("2 vendeurs ou grossistes du marche physique pour comprendre prix, rotation et blocages.")
    return people[:5]


def _build_validation_method(joined_text: str) -> str:
    if _contains_any(joined_text, ("whatsapp", "bouche a oreille", "terrain")):
        return "Entretiens terrain courts plus tests WhatsApp de message, offre et prix sur 5 a 10 prospects reels."
    return "Entretiens semi-structures avec prospects reels, puis test rapide d'offre et de prix sur un canal prioritaire."


def _build_success_criteria() -> list[str]:
    return [
        "Au moins 5 prospects du meme segment confirment ressentir le probleme.",
        "Au moins 3 prospects decrivent des consequences fortes ou un cout clair de l'inaction.",
        "Au moins 2 prospects acceptent un prochain pas concret: essai, rendez-vous, precommande ou paiement test.",
        "Un canal d'acces ressort comme prioritaire avec un message qui declenche des reponses.",
    ]


def build_deterministic_client_problem_analysis(
    project: dict[str, Any],
    instruction: str | None = None,
) -> dict[str, Any]:
    title = _clean_text(project.get("title")) or "Projet Founder"
    project_data = _as_dict(project.get("project_data"))
    workspace_signals = _extract_workspace_signals(project_data)
    instruction_text = _clean_text(instruction)
    business_type = _infer_business_type(_tokenize(title, instruction_text, " ".join(workspace_signals.values())), " ".join([title, instruction_text, *workspace_signals.values()]).lower())
    joined_text = " ".join(
        part for part in [
            title,
            instruction_text,
            json.dumps(project_data, ensure_ascii=True, default=str),
            " ".join(workspace_signals.values()),
        ] if part
    ).lower()
    target_segment = _infer_target_segment(workspace_signals, joined_text)
    problem_signal = workspace_signals.get("probleme", "")
    pain_level = _infer_pain_level(problem_signal, joined_text)
    scores = _build_client_problem_scores(workspace_signals, joined_text, pain_level)
    profile = (
        "Profil encore a preciser en termes d'activite, niveau de revenu, habitudes d'achat et contraintes quotidiennes."
        if not workspace_signals.get("client")
        else "Prospect cible decrit avec des indices de contexte local, budget sensible et besoin d'une solution pratique."
    )
    context = (
        "Contexte d'achat probablement influence par confiance, petits budgets, bouche-a-oreille et paiement flexible."
        if _contains_any(joined_text, ("whatsapp", "mobile money", "cash", "petit budget", "bouche a oreille", "marche"))
        else "Contexte d'usage a documenter sur le terrain avant de figer l'offre."
    )
    analysis = {
        "target_client": {
            "segment": target_segment,
            "profile": profile,
            "context": context,
            "ability_to_pay": _infer_ability_to_pay(joined_text, business_type),
            "access_channel": _infer_access_channel(workspace_signals, joined_text),
        },
        "problem": {
            "main_problem": _truncate(problem_signal or "Le probleme principal n'est pas encore formule avec assez de precision pour etre teste.", 220),
            "pain_level": pain_level,
            "frequency": _infer_frequency(problem_signal, joined_text),
            "consequences": _build_problem_consequences(problem_signal, joined_text),
            "current_alternatives": _build_current_alternatives(joined_text, business_type),
        },
        "validation": {
            "critical_assumptions": _build_critical_assumptions(workspace_signals, joined_text),
            "field_questions": _build_field_questions(target_segment, problem_signal),
            "people_to_contact": _build_people_to_contact(joined_text, business_type),
            "validation_method": _build_validation_method(joined_text),
            "success_criteria": _build_success_criteria(),
        },
        "scores": scores,
        "strengths": [
            "Le projet dispose deja d'une base client/probleme exploitable pour aller sur le terrain." if workspace_signals.get("client") or workspace_signals.get("probleme") else "Le projet peut encore pivoter facilement avant d'investir lourdement.",
            "Les canaux legers comme WhatsApp ou bouche-a-oreille peuvent accelerer la collecte de retours terrain." if _contains_any(joined_text, ("whatsapp", "bouche a oreille", "terrain")) else "Le projet peut encore choisir un canal de validation simple et peu couteux.",
        ][:2],
        "risks": [
            "Le segment prioritaire reste trop large ou melange plusieurs profils differents." if not workspace_signals.get("client") else "La cible existe mais doit etre encore resserree autour d'un cas d'usage prioritaire.",
            "Le probleme risque d'etre jugé interessant mais pas assez urgent pour declencher un achat test.",
            "Les alternatives actuelles du client peuvent sembler 'suffisamment bonnes' si la valeur n'est pas mieux articulee.",
        ][:3],
        "missing_information": [
            "Le moment exact ou le probleme devient urgent pour le client.",
            "Le budget reel disponible et le mode de paiement prefere.",
            "La preuve qu'au moins un segment repond positivement a un message concret.",
        ][:3],
        "recommended_next_step": "Reserrer le segment client et valider sur le terrain si le probleme est assez frequent, douloureux et solvable commercialement.",
        "next_best_action": {
            "title": "Mener 5 entretiens terrain client-probleme sur un segment unique",
            "why": "Avant d'optimiser l'offre, il faut verifier que le bon client ressent un probleme urgent et qu'il est accessible via un canal simple.",
            "how": [
                "Choisir un seul segment prioritaire pour 7 jours.",
                "Contacter 5 prospects reels via WhatsApp, appel ou rencontre directe.",
                "Poser les questions terrain sans pitcher trop tot la solution.",
                "Noter mot pour mot les douleurs, alternatives et objections de paiement.",
                "Comparer les reponses pour voir si un motif recurrent emerge.",
            ],
            "expected_output": "Un segment plus net, un probleme principal confirme ou invalide, et une priorite claire pour l'offre.",
        },
    }
    return analysis


def _normalize_target_client(value: Any, fallback: dict[str, Any]) -> dict[str, str]:
    payload = _as_dict(value)
    return {
        "segment": _truncate(payload.get("segment") or fallback["segment"], 180),
        "profile": _truncate(payload.get("profile") or fallback["profile"], 220),
        "context": _truncate(payload.get("context") or fallback["context"], 220),
        "ability_to_pay": _truncate(payload.get("ability_to_pay") or fallback["ability_to_pay"], 220),
        "access_channel": _truncate(payload.get("access_channel") or fallback["access_channel"], 180),
    }


def _normalize_problem_block(value: Any, fallback: dict[str, Any]) -> dict[str, Any]:
    payload = _as_dict(value)
    return {
        "main_problem": _truncate(payload.get("main_problem") or fallback["main_problem"], 220),
        "pain_level": _clamp_score(payload.get("pain_level", fallback["pain_level"])),
        "frequency": _truncate(payload.get("frequency") or fallback["frequency"], 80),
        "consequences": _coerce_string_list(payload.get("consequences"), limit=5) or fallback["consequences"],
        "current_alternatives": _coerce_string_list(payload.get("current_alternatives"), limit=5) or fallback["current_alternatives"],
    }


def _normalize_validation_block(value: Any, fallback: dict[str, Any]) -> dict[str, Any]:
    payload = _as_dict(value)
    return {
        "critical_assumptions": _coerce_string_list(payload.get("critical_assumptions"), limit=6) or fallback["critical_assumptions"],
        "field_questions": _coerce_string_list(payload.get("field_questions"), limit=7) or fallback["field_questions"],
        "people_to_contact": _coerce_string_list(payload.get("people_to_contact"), limit=6) or fallback["people_to_contact"],
        "validation_method": _truncate(payload.get("validation_method") or fallback["validation_method"], 220),
        "success_criteria": _coerce_string_list(payload.get("success_criteria"), limit=6) or fallback["success_criteria"],
    }


def _normalize_client_problem_scores(value: Any, fallback: dict[str, Any]) -> dict[str, int]:
    payload = _as_dict(value)
    scores = {key: _clamp_score(payload.get(key, fallback[key])) for key in _CLIENT_PROBLEM_SCORE_KEYS}
    scores["global"] = round(sum(scores[key] for key in _CLIENT_PROBLEM_SCORE_KEYS) / len(_CLIENT_PROBLEM_SCORE_KEYS))
    return scores


def _normalize_client_problem_analysis(value: Any, fallback: dict[str, Any]) -> dict[str, Any]:
    payload = _as_dict(value)
    normalized = {
        "target_client": _normalize_target_client(payload.get("target_client"), fallback["target_client"]),
        "problem": _normalize_problem_block(payload.get("problem"), fallback["problem"]),
        "validation": _normalize_validation_block(payload.get("validation"), fallback["validation"]),
        "scores": _normalize_client_problem_scores(payload.get("scores"), fallback["scores"]),
        "strengths": _coerce_string_list(payload.get("strengths"), limit=6) or fallback["strengths"],
        "risks": _coerce_string_list(payload.get("risks"), limit=6) or fallback["risks"],
        "missing_information": _coerce_string_list(payload.get("missing_information"), limit=6) or fallback["missing_information"],
        "recommended_next_step": _truncate(payload.get("recommended_next_step") or fallback["recommended_next_step"], 260),
        "next_best_action": _normalize_next_best_action(payload.get("next_best_action"), fallback["next_best_action"]),
    }
    normalized["scores"]["global"] = round(
        sum(normalized["scores"][key] for key in _CLIENT_PROBLEM_SCORE_KEYS) / len(_CLIENT_PROBLEM_SCORE_KEYS)
    )
    return normalized


def _build_client_problem_llm_prompt(project: dict[str, Any], instruction: str | None, fallback: dict[str, Any]) -> str:
    title = _clean_text(project.get("title")) or "Projet Founder"
    project_data = json.dumps(_as_dict(project.get("project_data")), ensure_ascii=True, default=str)
    opencloud_project_path = _clean_text(project.get("opencloud_project_path")) or "N/A"
    instruction_block = _clean_text(instruction) or "Aucune instruction additionnelle."
    fallback_json = json.dumps(fallback, ensure_ascii=True, default=str)
    return (
        "Tu es founder_client_problem_v1 pour ChatLAYA Founder.\n"
        "Tu n'es pas un chatbot. Tu produis un diagnostic structuré client/probleme pour un Founder Builder OS.\n"
        "Retourne UNIQUEMENT un JSON valide, sans markdown ni texte autour.\n"
        "Integre si pertinent les realites africaines/locales: WhatsApp, mobile money, cash, confiance client, petits budgets, distribution locale, marches physiques, bouche-a-oreille, diaspora, informalite.\n"
        "Schema JSON attendu:\n"
        "{"
        "\"target_client\": {\"segment\": string, \"profile\": string, \"context\": string, \"ability_to_pay\": string, \"access_channel\": string},"
        "\"problem\": {\"main_problem\": string, \"pain_level\": 0, \"frequency\": string, \"consequences\": [string], \"current_alternatives\": [string]},"
        "\"validation\": {\"critical_assumptions\": [string], \"field_questions\": [string], \"people_to_contact\": [string], \"validation_method\": string, \"success_criteria\": [string]},"
        "\"scores\": {\"client_precision\": 0, \"problem_intensity\": 0, \"market_accessibility\": 0, \"validation_readiness\": 0, \"global\": 0},"
        "\"strengths\": [string],"
        "\"risks\": [string],"
        "\"missing_information\": [string],"
        "\"recommended_next_step\": string,"
        "\"next_best_action\": {\"title\": string, \"why\": string, \"how\": [string], \"expected_output\": string}"
        "}\n"
        "Contraintes:\n"
        "- scores entre 0 et 100\n"
        "- diagnostic concret, terrain, orienté validation client\n"
        "- pas de secret ni detail interne\n"
        f"Instruction additionnelle: {instruction_block}\n"
        f"Titre: {title}\n"
        f"OpenCloud path: {opencloud_project_path}\n"
        f"Project data JSON: {project_data}\n"
        f"Fallback deterministic reference: {fallback_json}\n"
    )


async def run_founder_client_problem_v1(
    project: dict[str, Any],
    instruction: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    fallback = build_deterministic_client_problem_analysis(project, instruction=instruction)
    analysis = fallback
    source = "deterministic"
    try:
        prompt = _build_client_problem_llm_prompt(project, instruction, fallback)
        raw_response = await asyncio.to_thread(
            generate_answer,
            prompt,
            None,
            None,
            90,
            1200,
        )
        candidate = _extract_json_payload(raw_response)
        if candidate:
            analysis = _normalize_client_problem_analysis(candidate, fallback)
            source = "llm"
    except Exception:
        analysis = fallback
        source = "deterministic"

    patch = {
        "agent_client_problem_v1": {
            "agent": "founder_client_problem_v1",
            "label": "Founder Client & Problem Agent V1",
            "version": 1,
            "source": source,
            "generated_at": _now_iso(),
            "instruction": _clean_text(instruction) or None,
            "analysis": analysis,
        }
    }
    return analysis, patch


def _build_offer_promise(workspace_signals: dict[str, str], joined_text: str) -> str:
    offer_signal = workspace_signals.get("offre", "")
    problem_signal = workspace_signals.get("probleme", "")
    if offer_signal:
        return _truncate(offer_signal, 220)
    if problem_signal:
        return _truncate(
            f"Aider le client a resoudre plus simplement ce probleme: {problem_signal}",
            220,
        )
    if _contains_any(joined_text, ("whatsapp", "mobile money", "cash")):
        return "Offrir une solution simple, rassurante et facile a adopter dans un contexte local et mobile."
    return "Promesse commerciale encore a clarifier autour d'un resultat client concret."


def _build_target_result(workspace_signals: dict[str, str], joined_text: str) -> str:
    if workspace_signals.get("probleme"):
        return "Faire gagner du temps, reduire la friction et ameliorer le resultat concret du client."
    if _contains_any(joined_text, ("vente", "revenus", "commande")):
        return "Aider le client a vendre plus facilement et avec plus de confiance."
    return "Transformer un besoin flou en resultat concret, visible et mesurable."


def _build_main_benefits(joined_text: str, workspace_signals: dict[str, str]) -> list[str]:
    benefits: list[str] = []
    if _contains_any(joined_text, ("temps", "rapide", "simple", "automatique")):
        benefits.append("Gain de temps et reduction des taches manuelles.")
    if _contains_any(joined_text, ("vente", "revenus", "commande", "conversion")):
        benefits.append("Meilleure conversion ou augmentation du chiffre d'affaires.")
    if _contains_any(joined_text, ("confiance", "preuve", "fiable")):
        benefits.append("Renforcement de la confiance client au moment de l'achat.")
    if _contains_any(joined_text, ("cash", "mobile money", "petit budget")):
        benefits.append("Adoption plus facile grace a une offre compatible avec les budgets locaux.")
    if not benefits and workspace_signals.get("offre"):
        benefits.append("Resultat client plus clair et plus simple a expliquer.")
    if not benefits:
        benefits.append("Valeur percue encore a rendre plus concrete pour le client.")
    return benefits[:4]


def _build_differentiation(workspace_signals: dict[str, str], joined_text: str, business_type: str) -> str:
    if _contains_any(joined_text, ("whatsapp", "bouche a oreille", "distribution locale", "marche")):
        return "La difference potentielle vient d'une execution locale, legere et adaptee aux habitudes reelles du client."
    if business_type in {"service", "coaching", "training"}:
        return "La differenciation doit combiner accompagnement concret, simplicite d'acces et resultat rapidement visible."
    if workspace_signals.get("offre"):
        return "L'offre est amorcee mais sa differenciation doit encore etre comparee aux alternatives actuelles."
    return "La differenciation n'est pas encore assez explicite pour justifier un choix clair du client."


def _build_proof_needed(joined_text: str) -> list[str]:
    proof = [
        "Temoignages ou retours terrain de premiers utilisateurs.",
        "Cas concret montrant le avant/apres pour le client.",
    ]
    if _contains_any(joined_text, ("whatsapp", "facebook", "instagram")):
        proof.append("Captures ou messages WhatsApp montrant l'interet reel du segment cible.")
    if _contains_any(joined_text, ("cash", "mobile money", "paiement")):
        proof.append("Preuve qu'un client accepte un paiement test ou un acompte.")
    return proof[:4]


def _build_main_offer(workspace_signals: dict[str, str], promise: str) -> str:
    offer_signal = workspace_signals.get("offre", "")
    if offer_signal:
        return _truncate(offer_signal, 180)
    return _truncate(f"Offre principale centree sur cette promesse: {promise}", 180)


def _build_entry_offer(joined_text: str) -> str:
    if _contains_any(joined_text, ("petit budget", "budget limite", "cash", "mobile money")):
        return "Offre d'appel simple, a faible risque, payable en cash ou mobile money."
    return "Offre d'appel courte et simple pour faciliter le premier test client."


def _build_premium_offer(business_type: str) -> str:
    if business_type in {"service", "agency", "coaching", "training"}:
        return "Version premium avec accompagnement renforce, personnalisation et suivi plus pousse."
    return "Version premium avec plus de personnalisation, rapidite et garantie de resultat."


def _build_deliverables(workspace_signals: dict[str, str], joined_text: str) -> list[str]:
    deliverables: list[str] = []
    if workspace_signals.get("offre"):
        deliverables.append("Livrable principal clairement relie a la promesse de valeur.")
    if _contains_any(joined_text, ("whatsapp", "support", "suivi")):
        deliverables.append("Suivi client leger via WhatsApp ou canal direct.")
    if _contains_any(joined_text, ("formation", "coaching", "service")):
        deliverables.append("Guide, session ou prestation orientee resultat.")
    if _contains_any(joined_text, ("produit", "commerce", "livraison")):
        deliverables.append("Produit ou service livre avec conditions simples et lisibles.")
    if not deliverables:
        deliverables.append("Livrables encore a preciser en termes de format, delai et resultat.")
    return deliverables[:4]


def _build_offer_conditions(joined_text: str) -> list[str]:
    conditions: list[str] = []
    if _contains_any(joined_text, ("cash", "mobile money")):
        conditions.append("Paiement possible en cash ou mobile money selon le contexte client.")
    if _contains_any(joined_text, ("whatsapp", "appel", "terrain")):
        conditions.append("Activation et suivi possibles via WhatsApp, appel ou contact direct.")
    conditions.append("Conditions d'execution et delais doivent rester simples a expliquer.")
    return conditions[:4]


def _build_pains_addressed(problem_signal: str, joined_text: str) -> list[str]:
    pains: list[str] = []
    if problem_signal:
        pains.append(_truncate(problem_signal, 160))
    if _contains_any(joined_text, ("perte", "vente", "commande", "revenus")):
        pains.append("Perte de revenus ou opportunites commerciales.")
    if _contains_any(joined_text, ("temps", "suivi", "manuel", "desordre")):
        pains.append("Friction operationnelle et perte de temps dans l'execution.")
    if not pains:
        pains.append("Douleur client encore a relier plus clairement a une consequence concrete.")
    return pains[:4]


def _build_gains_created(joined_text: str) -> list[str]:
    gains: list[str] = []
    if _contains_any(joined_text, ("vente", "revenus", "commande")):
        gains.append("Plus de ventes ou meilleure conversion.")
    if _contains_any(joined_text, ("confiance", "preuve")):
        gains.append("Plus de confiance au moment de l'achat.")
    if _contains_any(joined_text, ("temps", "simple", "rapide")):
        gains.append("Execution plus simple et plus rapide.")
    if _contains_any(joined_text, ("cash", "mobile money", "petit budget")):
        gains.append("Adoption plus facile grace a un format compatible avec le terrain.")
    if not gains:
        gains.append("Resultat percu encore a rendre plus visible et plus desirables.")
    return gains[:4]


def _build_offer_objections(joined_text: str, business_type: str) -> list[str]:
    objections = [
        "Le client peut douter que le resultat promis soit vraiment atteignable.",
        "Le prix peut sembler eleve si la preuve et la confiance restent faibles.",
    ]
    if _contains_any(joined_text, ("cash", "mobile money", "petit budget")):
        objections.append("Le client peut vouloir commencer par une offre d'appel tres faible risque.")
    if business_type in {"digital_product", "saas"}:
        objections.append("Le client peut craindre une solution trop complexe ou pas assez locale.")
    return objections[:4]


def _build_trust_builders(joined_text: str) -> list[str]:
    trust = [
        "Temoignages courts ou preuve sociale issue du meme segment.",
        "Demonstration simple du resultat attendu avant achat complet.",
    ]
    if _contains_any(joined_text, ("whatsapp", "bouche a oreille")):
        trust.append("Recommandation par un relai de confiance ou via bouche-a-oreille.")
    if _contains_any(joined_text, ("cash", "mobile money")):
        trust.append("Paiement flexible ou acompte pour reduire le risque percu.")
    return trust[:4]


def _build_offer_value_scores(
    workspace_signals: dict[str, str],
    joined_text: str,
) -> dict[str, int]:
    offer_clarity = _score_from_signal(workspace_signals.get("offre", ""), (16, 42, 72))
    value_strength = 30
    if workspace_signals.get("probleme"):
        value_strength += 18
    if _contains_any(joined_text, ("resultat", "benefice", "gain", "revenus", "temps")):
        value_strength += 18
    differentiation = 22
    if _contains_any(joined_text, ("whatsapp", "mobile money", "cash", "local", "distribution", "bouche a oreille")):
        differentiation += 24
    trust_readiness = 20
    if _contains_any(joined_text, ("temoignage", "preuve", "confiance", "garantie", "essai")):
        trust_readiness += 24
    testability = 24
    if _contains_any(joined_text, ("offre d'appel", "pilote", "test", "essai", "precommande", "whatsapp")):
        testability += 26
    scores = {
        "offer_clarity": _clamp_score(offer_clarity),
        "value_strength": _clamp_score(value_strength),
        "differentiation": _clamp_score(differentiation),
        "trust_readiness": _clamp_score(trust_readiness),
        "testability": _clamp_score(testability),
    }
    scores["global"] = round(sum(scores[key] for key in _OFFER_VALUE_SCORE_KEYS) / len(_OFFER_VALUE_SCORE_KEYS))
    return scores


def build_deterministic_offer_value_analysis(
    project: dict[str, Any],
    instruction: str | None = None,
) -> dict[str, Any]:
    title = _clean_text(project.get("title")) or "Projet Founder"
    project_data = _as_dict(project.get("project_data"))
    workspace_signals = _extract_workspace_signals(project_data)
    instruction_text = _clean_text(instruction)
    joined_text = " ".join(
        part for part in [
            title,
            instruction_text,
            json.dumps(project_data, ensure_ascii=True, default=str),
            " ".join(workspace_signals.values()),
        ] if part
    ).lower()
    business_type = _infer_business_type(
        _tokenize(title, instruction_text, " ".join(workspace_signals.values())),
        joined_text,
    )
    promise = _build_offer_promise(workspace_signals, joined_text)
    problem_signal = workspace_signals.get("probleme", "")
    scores = _build_offer_value_scores(workspace_signals, joined_text)
    analysis = {
        "value_proposition": {
            "promise": promise,
            "target_result": _build_target_result(workspace_signals, joined_text),
            "main_benefits": _build_main_benefits(joined_text, workspace_signals),
            "differentiation": _build_differentiation(workspace_signals, joined_text, business_type),
            "proof_needed": _build_proof_needed(joined_text),
        },
        "offer": {
            "main_offer": _build_main_offer(workspace_signals, promise),
            "entry_offer": _build_entry_offer(joined_text),
            "premium_offer": _build_premium_offer(business_type),
            "deliverables": _build_deliverables(workspace_signals, joined_text),
            "conditions": _build_offer_conditions(joined_text),
        },
        "customer_fit": {
            "pains_addressed": _build_pains_addressed(problem_signal, joined_text),
            "gains_created": _build_gains_created(joined_text),
            "objections": _build_offer_objections(joined_text, business_type),
            "trust_builders": _build_trust_builders(joined_text),
        },
        "scores": scores,
        "strengths": [
            "L'offre peut s'appuyer sur un angle local et concret pour etre plus credible." if _contains_any(joined_text, ("whatsapp", "mobile money", "cash", "local")) else "Le projet peut encore construire une offre tres simple avant de la complexifier.",
            "Une offre d'appel peut reduire fortement la friction de premier achat." if _contains_any(joined_text, ("petit budget", "cash", "mobile money")) else "Le projet peut structurer une offre d'appel pour tester la traction rapidement.",
        ][:2],
        "risks": [
            "La promesse reste peut-etre trop generale pour declencher un achat rapide.",
            "Sans preuve sociale ou demonstration, la confiance client peut rester insuffisante.",
            "L'offre risque de manquer de differenciation si elle ressemble trop aux alternatives informelles.",
        ][:3],
        "missing_information": [
            "Le format d'offre exact qui convertit le mieux en premier achat.",
            "La preuve concrete qui rassure le plus le segment cible.",
            "Les objections prioritaires qui bloquent vraiment la decision de paiement.",
        ][:3],
        "recommended_next_step": "Transformer la promesse en offre testable, simple a expliquer et facile a essayer avec un premier segment client.",
        "next_best_action": {
            "title": "Designer une offre d'appel testable sur 7 jours",
            "why": "Le projet doit verifier si sa promesse cree assez de desir, de confiance et d'intention de paiement dans des conditions reelles.",
            "how": [
                "Resumer l'offre en une promesse simple, un resultat et un format de livraison.",
                "Creer une offre d'appel a faible risque adaptee au budget du segment.",
                "Ajouter une preuve ou demonstration tres concrete.",
                "Presenter l'offre a 5 prospects reels via WhatsApp, appel ou terrain.",
                "Mesurer les objections, les reponses positives et les demandes de precision.",
            ],
            "expected_output": "Une version d'offre plus claire, ses objections principales et un signal reel d'interet ou de paiement.",
        },
    }
    return analysis


def _normalize_value_proposition(value: Any, fallback: dict[str, Any]) -> dict[str, Any]:
    payload = _as_dict(value)
    return {
        "promise": _truncate(payload.get("promise") or fallback["promise"], 220),
        "target_result": _truncate(payload.get("target_result") or fallback["target_result"], 220),
        "main_benefits": _coerce_string_list(payload.get("main_benefits"), limit=5) or fallback["main_benefits"],
        "differentiation": _truncate(payload.get("differentiation") or fallback["differentiation"], 220),
        "proof_needed": _coerce_string_list(payload.get("proof_needed"), limit=5) or fallback["proof_needed"],
    }


def _normalize_offer_block(value: Any, fallback: dict[str, Any]) -> dict[str, Any]:
    payload = _as_dict(value)
    return {
        "main_offer": _truncate(payload.get("main_offer") or fallback["main_offer"], 200),
        "entry_offer": _truncate(payload.get("entry_offer") or fallback["entry_offer"], 200),
        "premium_offer": _truncate(payload.get("premium_offer") or fallback["premium_offer"], 200),
        "deliverables": _coerce_string_list(payload.get("deliverables"), limit=5) or fallback["deliverables"],
        "conditions": _coerce_string_list(payload.get("conditions"), limit=5) or fallback["conditions"],
    }


def _normalize_customer_fit(value: Any, fallback: dict[str, Any]) -> dict[str, Any]:
    payload = _as_dict(value)
    return {
        "pains_addressed": _coerce_string_list(payload.get("pains_addressed"), limit=5) or fallback["pains_addressed"],
        "gains_created": _coerce_string_list(payload.get("gains_created"), limit=5) or fallback["gains_created"],
        "objections": _coerce_string_list(payload.get("objections"), limit=5) or fallback["objections"],
        "trust_builders": _coerce_string_list(payload.get("trust_builders"), limit=5) or fallback["trust_builders"],
    }


def _normalize_offer_value_scores(value: Any, fallback: dict[str, Any]) -> dict[str, int]:
    payload = _as_dict(value)
    scores = {key: _clamp_score(payload.get(key, fallback[key])) for key in _OFFER_VALUE_SCORE_KEYS}
    scores["global"] = round(sum(scores[key] for key in _OFFER_VALUE_SCORE_KEYS) / len(_OFFER_VALUE_SCORE_KEYS))
    return scores


def _normalize_offer_value_analysis(value: Any, fallback: dict[str, Any]) -> dict[str, Any]:
    payload = _as_dict(value)
    normalized = {
        "value_proposition": _normalize_value_proposition(payload.get("value_proposition"), fallback["value_proposition"]),
        "offer": _normalize_offer_block(payload.get("offer"), fallback["offer"]),
        "customer_fit": _normalize_customer_fit(payload.get("customer_fit"), fallback["customer_fit"]),
        "scores": _normalize_offer_value_scores(payload.get("scores"), fallback["scores"]),
        "strengths": _coerce_string_list(payload.get("strengths"), limit=6) or fallback["strengths"],
        "risks": _coerce_string_list(payload.get("risks"), limit=6) or fallback["risks"],
        "missing_information": _coerce_string_list(payload.get("missing_information"), limit=6) or fallback["missing_information"],
        "recommended_next_step": _truncate(payload.get("recommended_next_step") or fallback["recommended_next_step"], 260),
        "next_best_action": _normalize_next_best_action(payload.get("next_best_action"), fallback["next_best_action"]),
    }
    normalized["scores"]["global"] = round(
        sum(normalized["scores"][key] for key in _OFFER_VALUE_SCORE_KEYS) / len(_OFFER_VALUE_SCORE_KEYS)
    )
    return normalized


def _build_offer_value_llm_prompt(project: dict[str, Any], instruction: str | None, fallback: dict[str, Any]) -> str:
    title = _clean_text(project.get("title")) or "Projet Founder"
    project_data = json.dumps(_as_dict(project.get("project_data")), ensure_ascii=True, default=str)
    opencloud_project_path = _clean_text(project.get("opencloud_project_path")) or "N/A"
    instruction_block = _clean_text(instruction) or "Aucune instruction additionnelle."
    fallback_json = json.dumps(fallback, ensure_ascii=True, default=str)
    return (
        "Tu es founder_offer_value_v1 pour ChatLAYA Founder.\n"
        "Tu n'es pas un chatbot. Tu produis un diagnostic structuré sur l'offre et la proposition de valeur pour un Founder Builder OS.\n"
        "Retourne UNIQUEMENT un JSON valide, sans markdown ni texte autour.\n"
        "Integre si pertinent les realites africaines/locales: confiance client, preuve sociale, WhatsApp, petits budgets, cash, mobile money, offre d'appel, bouche-a-oreille, distribution locale.\n"
        "Schema JSON attendu:\n"
        "{"
        "\"value_proposition\": {\"promise\": string, \"target_result\": string, \"main_benefits\": [string], \"differentiation\": string, \"proof_needed\": [string]},"
        "\"offer\": {\"main_offer\": string, \"entry_offer\": string, \"premium_offer\": string, \"deliverables\": [string], \"conditions\": [string]},"
        "\"customer_fit\": {\"pains_addressed\": [string], \"gains_created\": [string], \"objections\": [string], \"trust_builders\": [string]},"
        "\"scores\": {\"offer_clarity\": 0, \"value_strength\": 0, \"differentiation\": 0, \"trust_readiness\": 0, \"testability\": 0, \"global\": 0},"
        "\"strengths\": [string],"
        "\"risks\": [string],"
        "\"missing_information\": [string],"
        "\"recommended_next_step\": string,"
        "\"next_best_action\": {\"title\": string, \"why\": string, \"how\": [string], \"expected_output\": string}"
        "}\n"
        "Contraintes:\n"
        "- scores entre 0 et 100\n"
        "- diagnostic concret, commercial et testable\n"
        "- pas de secret ni detail interne\n"
        f"Instruction additionnelle: {instruction_block}\n"
        f"Titre: {title}\n"
        f"OpenCloud path: {opencloud_project_path}\n"
        f"Project data JSON: {project_data}\n"
        f"Fallback deterministic reference: {fallback_json}\n"
    )


async def run_founder_offer_value_v1(
    project: dict[str, Any],
    instruction: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    fallback = build_deterministic_offer_value_analysis(project, instruction=instruction)
    analysis = fallback
    source = "deterministic"
    try:
        prompt = _build_offer_value_llm_prompt(project, instruction, fallback)
        raw_response = await asyncio.to_thread(
            generate_answer,
            prompt,
            None,
            None,
            90,
            1200,
        )
        candidate = _extract_json_payload(raw_response)
        if candidate:
            analysis = _normalize_offer_value_analysis(candidate, fallback)
            source = "llm"
    except Exception:
        analysis = fallback
        source = "deterministic"

    patch = {
        "agent_offer_value_v1": {
            "agent": "founder_offer_value_v1",
            "label": "Founder Offer & Value Agent V1",
            "version": 1,
            "source": source,
            "generated_at": _now_iso(),
            "instruction": _clean_text(instruction) or None,
            "analysis": analysis,
        }
    }
    return analysis, patch


def _build_recommended_price_logic(joined_text: str, business_type: str) -> str:
    if _contains_any(joined_text, ("petit budget", "cash", "mobile money", "fractionne", "acompte")):
        return "Prix simple, lisible et progressif: offre d'appel accessible, paiement flexible et montee en gamme selon la confiance."
    if business_type in {"service", "agency", "coaching", "training"}:
        return "Prix base sur la valeur livree, avec offre d'appel pour reduire le risque puis offre principale et premium."
    if business_type in {"commerce", "import_export"}:
        return "Prix construit autour de la marge reelle apres transport, logistique et rotation du stock."
    return "Logique de prix a valider avec une offre d'appel claire puis une offre principale rentable."


def _build_entry_price_hypothesis(joined_text: str) -> str:
    if _contains_any(joined_text, ("petit budget", "budget limite", "cash", "mobile money")):
        return "Hypothese d'entree: ticket faible, payable immediatement en cash, mobile money ou acompte."
    return "Hypothese d'entree: prix bas risque pour declencher un premier test client."


def _build_main_price_hypothesis(joined_text: str, business_type: str) -> str:
    if business_type in {"service", "agency", "coaching", "training"}:
        return "Hypothese principale: prix lie au resultat et au niveau d'accompagnement, avec options de paiement simples."
    if business_type in {"commerce", "import_export"}:
        return "Hypothese principale: prix couvrant cout d'achat, transport, pertes possibles et marge cible minimale."
    return "Hypothese principale: prix au centre de la proposition de valeur, a tester sur quelques prospects reels."


def _build_premium_price_hypothesis(business_type: str) -> str:
    if business_type in {"service", "agency", "coaching", "training"}:
        return "Hypothese premium: version plus personnalisee avec accompagnement, priorite et suivi renforce."
    return "Hypothese premium: version enrichie avec plus de rapidite, fiabilite ou personnalisation."


def _build_payment_modes(joined_text: str) -> list[str]:
    modes = ["Cash", "Mobile money"]
    if _contains_any(joined_text, ("acompte", "fractionne", "versement")):
        modes.append("Paiement fractionne ou acompte")
    if _contains_any(joined_text, ("virement", "bank", "banque")):
        modes.append("Virement bancaire")
    return modes[:4]


def _build_pricing_risks(joined_text: str) -> list[str]:
    risks = [
        "Le prix peut etre percu comme trop eleve si la preuve de valeur reste faible.",
        "Une grille trop complexe peut freiner des clients qui veulent comprendre vite et payer simplement.",
    ]
    if _contains_any(joined_text, ("transport", "livraison", "logistique", "stock")):
        risks.append("La marge peut etre surestimee si transport, logistique ou pertes terrain sont mal comptes.")
    if _contains_any(joined_text, ("cash", "mobile money", "petit budget")):
        risks.append("Le pouvoir d'achat reel du client peut obliger a decouper l'offre ou a proposer un acompte.")
    return risks[:4]


def _build_revenue_streams(business_type: str, joined_text: str) -> list[str]:
    streams: list[str] = []
    if business_type in {"service", "agency", "coaching", "training"}:
        streams.append("Vente directe de la prestation ou de l'accompagnement principal.")
    if business_type in {"commerce", "import_export"}:
        streams.append("Marge sur chaque vente ou transaction realisee.")
    if business_type in {"saas", "digital_product"}:
        streams.append("Abonnement ou paiement recurrent selon l'usage.")
    streams.append("Offre d'appel ou test payant pour reduire la friction de premier achat.")
    if _contains_any(joined_text, ("premium", "upsell", "suivi")):
        streams.append("Upsell premium avec suivi, personnalisation ou priorite.")
    return streams[:5]


def _build_cost_structure(joined_text: str, business_type: str) -> list[str]:
    costs = ["Temps de production ou de service"]
    if _contains_any(joined_text, ("transport", "livraison", "logistique")) or business_type in {"commerce", "import_export"}:
        costs.append("Transport, logistique ou livraison")
    if _contains_any(joined_text, ("whatsapp", "marketing", "acquisition", "publicite")):
        costs.append("Acquisition client faible cout via WhatsApp, terrain ou bouche-a-oreille")
    if _contains_any(joined_text, ("stock", "materiel", "produit")):
        costs.append("Stock, matieres ou approvisionnement")
    costs.append("Support, suivi et execution terrain")
    return costs[:5]


def _build_key_resources(business_type: str, joined_text: str) -> list[str]:
    resources = ["Canal direct vers le segment cible"]
    if _contains_any(joined_text, ("whatsapp",)):
        resources.append("WhatsApp ou telephone pour acquisition et suivi")
    if business_type in {"service", "agency", "coaching", "training"}:
        resources.append("Competence metier et capacite d'execution")
    if business_type in {"commerce", "import_export"}:
        resources.append("Source d'approvisionnement fiable")
    resources.append("Preuves client et script commercial simple")
    return resources[:5]


def _build_key_partners(business_type: str, joined_text: str) -> list[str]:
    partners = ["Relais de confiance ou prescripteurs locaux"]
    if business_type in {"commerce", "import_export"}:
        partners.append("Fournisseurs, grossistes ou transporteurs")
    if _contains_any(joined_text, ("mobile money", "paiement")):
        partners.append("Operateurs de paiement ou relais de collecte")
    if _contains_any(joined_text, ("distribution", "marche", "boutique")):
        partners.append("Points de distribution ou revendeurs terrain")
    return partners[:5]


def _build_distribution_channels(joined_text: str) -> list[str]:
    channels = []
    if _contains_any(joined_text, ("whatsapp",)):
        channels.append("WhatsApp")
    if _contains_any(joined_text, ("bouche a oreille", "recommandation")):
        channels.append("Bouche-a-oreille")
    if _contains_any(joined_text, ("marche", "terrain", "boutique")):
        channels.append("Terrain ou marche physique")
    if _contains_any(joined_text, ("facebook", "instagram")):
        channels.append("Reseaux sociaux legers")
    if not channels:
        channels.append("Canal direct a faible cout encore a valider")
    return channels[:5]


def _build_unit_economics_summary(joined_text: str, business_type: str) -> str:
    if business_type in {"commerce", "import_export"}:
        return "Verifier que la marge nette reste positive apres achat, transport, pertes eventuelles et cout de vente."
    if _contains_any(joined_text, ("service", "coaching", "formation")):
        return "Comparer prix vendu, temps reel livre et cout d'acquisition pour eviter une offre chronophage et peu rentable."
    return "Le modele doit montrer qu'un premier client payant couvre au minimum execution, acquisition et marge cible simple."


def _build_startup_costs_to_estimate(joined_text: str, business_type: str) -> list[str]:
    costs = ["Communication de lancement et premiers supports commerciaux"]
    if business_type in {"commerce", "import_export"}:
        costs.append("Premier stock ou premier approvisionnement")
    if _contains_any(joined_text, ("transport", "livraison")):
        costs.append("Budget transport ou logistique initial")
    if _contains_any(joined_text, ("whatsapp", "telephone")):
        costs.append("Credit communication, internet ou equipement mobile")
    return costs[:5]


def _build_fixed_costs(joined_text: str) -> list[str]:
    costs = ["Communication recurrente", "Outils ou abonnements minimums"]
    if _contains_any(joined_text, ("boutique", "local", "loyer")):
        costs.append("Loyer ou frais de point de vente")
    return costs[:5]


def _build_variable_costs(joined_text: str, business_type: str) -> list[str]:
    costs = ["Temps d'execution par vente"]
    if business_type in {"commerce", "import_export"}:
        costs.append("Cout unitaire d'achat ou de production")
    if _contains_any(joined_text, ("transport", "livraison")):
        costs.append("Transport ou livraison par commande")
    if _contains_any(joined_text, ("mobile money", "paiement")):
        costs.append("Frais de transaction ou d'encaissement")
    return costs[:5]


def _build_break_even_logic(joined_text: str, business_type: str) -> str:
    if business_type in {"commerce", "import_export"}:
        return "Atteindre le seuil quand la marge par vente couvre transport, achat, pertes et charges fixes du mois."
    return "Atteindre le seuil quand le nombre de ventes couvre le temps livre, l'acquisition et les couts fixes simples."


def _build_sales_needed_for_goal(joined_text: str) -> str:
    if _contains_any(joined_text, ("petit budget", "cash", "mobile money")):
        return "Definir un objectif simple: combien de petites ventes ou acomptes faut-il pour couvrir le mois."
    return "Calculer combien de ventes principales ou clients actifs sont necessaires pour couvrir les couts et la marge cible."


def _build_scenarios(joined_text: str) -> dict[str, str]:
    return {
        "pessimistic": "Peu de prospects paient, le ticket moyen reste faible et la marge est comprimee par les couts terrain.",
        "realistic": "Une offre d'appel convertit quelques clients, puis une partie passe sur l'offre principale avec marge moderee.",
        "ambitious": "Le canal direct fonctionne bien, la preuve sociale augmente la confiance et les upsells ameliorent rapidement la marge.",
    }


def _build_pricing_business_model_scores(
    workspace_signals: dict[str, str],
    joined_text: str,
) -> dict[str, int]:
    pricing_clarity = _score_from_signal(workspace_signals.get("prix", ""), (18, 42, 72))
    payment_fit = 30
    if _contains_any(joined_text, ("cash", "mobile money", "fractionne", "acompte", "petit budget")):
        payment_fit += 28
    margin_potential = 24
    if _contains_any(joined_text, ("marge", "revenus", "upsell", "premium", "logistique")):
        margin_potential += 24
    business_model_clarity = _score_from_signal(workspace_signals.get("business_model", ""), (16, 40, 70))
    financial_readiness = 20
    if _contains_any(joined_text, ("cout", "coût", "break even", "seuil", "rentabilite", "rentabilité", "prix")):
        financial_readiness += 26
    scores = {
        "pricing_clarity": _clamp_score(pricing_clarity),
        "payment_fit": _clamp_score(payment_fit),
        "margin_potential": _clamp_score(margin_potential),
        "business_model_clarity": _clamp_score(business_model_clarity),
        "financial_readiness": _clamp_score(financial_readiness),
    }
    scores["global"] = round(
        sum(scores[key] for key in _PRICING_BUSINESS_MODEL_SCORE_KEYS) / len(_PRICING_BUSINESS_MODEL_SCORE_KEYS)
    )
    return scores


def build_deterministic_pricing_business_model_analysis(
    project: dict[str, Any],
    instruction: str | None = None,
) -> dict[str, Any]:
    title = _clean_text(project.get("title")) or "Projet Founder"
    project_data = _as_dict(project.get("project_data"))
    workspace_signals = _extract_workspace_signals(project_data)
    instruction_text = _clean_text(instruction)
    joined_text = " ".join(
        part for part in [
            title,
            instruction_text,
            json.dumps(project_data, ensure_ascii=True, default=str),
            " ".join(workspace_signals.values()),
        ] if part
    ).lower()
    business_type = _infer_business_type(
        _tokenize(title, instruction_text, " ".join(workspace_signals.values())),
        joined_text,
    )
    scores = _build_pricing_business_model_scores(workspace_signals, joined_text)
    analysis = {
        "pricing": {
            "recommended_price_logic": _build_recommended_price_logic(joined_text, business_type),
            "entry_price_hypothesis": _build_entry_price_hypothesis(joined_text),
            "main_price_hypothesis": _build_main_price_hypothesis(joined_text, business_type),
            "premium_price_hypothesis": _build_premium_price_hypothesis(business_type),
            "payment_modes": _build_payment_modes(joined_text),
            "pricing_risks": _build_pricing_risks(joined_text),
        },
        "business_model": {
            "revenue_streams": _build_revenue_streams(business_type, joined_text),
            "cost_structure": _build_cost_structure(joined_text, business_type),
            "key_resources": _build_key_resources(business_type, joined_text),
            "key_partners": _build_key_partners(business_type, joined_text),
            "distribution_channels": _build_distribution_channels(joined_text),
            "unit_economics_summary": _build_unit_economics_summary(joined_text, business_type),
        },
        "simple_finance": {
            "startup_costs_to_estimate": _build_startup_costs_to_estimate(joined_text, business_type),
            "fixed_costs": _build_fixed_costs(joined_text),
            "variable_costs": _build_variable_costs(joined_text, business_type),
            "break_even_logic": _build_break_even_logic(joined_text, business_type),
            "sales_needed_for_goal": _build_sales_needed_for_goal(joined_text),
        },
        "scenarios": _build_scenarios(joined_text),
        "scores": scores,
        "strengths": [
            "Le projet peut structurer une logique de prix simple adaptee au terrain." if _contains_any(joined_text, ("cash", "mobile money", "petit budget")) else "Le projet peut encore definir un prix testable sans complexite inutile.",
            "Le canal direct faible cout peut proteger la marge s'il est bien execute." if _contains_any(joined_text, ("whatsapp", "bouche a oreille", "terrain")) else "Le projet peut garder un cout d'acquisition bas avec un canal simple et direct.",
        ][:2],
        "risks": [
            "Le prix risque d'etre defini sans preuve suffisante de capacite de paiement.",
            "La marge reelle peut etre surestimee si les couts terrain et la logistique sont sous-estimes.",
            "Le modele economique peut rester trop flou sans scenario minimal de rentabilite.",
        ][:3],
        "missing_information": [
            "Le prix reel que le segment accepte sans blocage fort.",
            "Les couts exacts a integrer avant de parler de marge nette.",
            "Le volume de ventes minimal pour atteindre un equilibre simple.",
        ][:3],
        "recommended_next_step": "Tester une hypothese de prix simple et verifier si le modele couvre vraiment couts, execution et marge minimale.",
        "next_best_action": {
            "title": "Tester une grille prix et marge sur 5 prospects reels",
            "why": "Le projet doit verifier si le niveau de prix, le mode de paiement et la marge restent coherents avec la realite terrain.",
            "how": [
                "Definir une offre d'appel, une offre principale et une offre premium.",
                "Associer a chaque offre un mode de paiement simple: cash, mobile money ou acompte.",
                "Lister les couts fixes, variables et logistiques les plus probables.",
                "Presenter les hypothese de prix a 5 prospects ou relais terrain.",
                "Noter objections, niveau d'acceptation et ajustements necessaires.",
            ],
            "expected_output": "Une hypothese de prix plus credible, une meilleure lecture de la marge et un modele economique plus concret.",
        },
    }
    return analysis


def _normalize_pricing_block(value: Any, fallback: dict[str, Any]) -> dict[str, Any]:
    payload = _as_dict(value)
    return {
        "recommended_price_logic": _truncate(payload.get("recommended_price_logic") or fallback["recommended_price_logic"], 220),
        "entry_price_hypothesis": _truncate(payload.get("entry_price_hypothesis") or fallback["entry_price_hypothesis"], 200),
        "main_price_hypothesis": _truncate(payload.get("main_price_hypothesis") or fallback["main_price_hypothesis"], 220),
        "premium_price_hypothesis": _truncate(payload.get("premium_price_hypothesis") or fallback["premium_price_hypothesis"], 220),
        "payment_modes": _coerce_string_list(payload.get("payment_modes"), limit=5) or fallback["payment_modes"],
        "pricing_risks": _coerce_string_list(payload.get("pricing_risks"), limit=5) or fallback["pricing_risks"],
    }


def _normalize_business_model_block(value: Any, fallback: dict[str, Any]) -> dict[str, Any]:
    payload = _as_dict(value)
    return {
        "revenue_streams": _coerce_string_list(payload.get("revenue_streams"), limit=6) or fallback["revenue_streams"],
        "cost_structure": _coerce_string_list(payload.get("cost_structure"), limit=6) or fallback["cost_structure"],
        "key_resources": _coerce_string_list(payload.get("key_resources"), limit=6) or fallback["key_resources"],
        "key_partners": _coerce_string_list(payload.get("key_partners"), limit=6) or fallback["key_partners"],
        "distribution_channels": _coerce_string_list(payload.get("distribution_channels"), limit=6) or fallback["distribution_channels"],
        "unit_economics_summary": _truncate(payload.get("unit_economics_summary") or fallback["unit_economics_summary"], 220),
    }


def _normalize_simple_finance_block(value: Any, fallback: dict[str, Any]) -> dict[str, Any]:
    payload = _as_dict(value)
    return {
        "startup_costs_to_estimate": _coerce_string_list(payload.get("startup_costs_to_estimate"), limit=6) or fallback["startup_costs_to_estimate"],
        "fixed_costs": _coerce_string_list(payload.get("fixed_costs"), limit=6) or fallback["fixed_costs"],
        "variable_costs": _coerce_string_list(payload.get("variable_costs"), limit=6) or fallback["variable_costs"],
        "break_even_logic": _truncate(payload.get("break_even_logic") or fallback["break_even_logic"], 220),
        "sales_needed_for_goal": _truncate(payload.get("sales_needed_for_goal") or fallback["sales_needed_for_goal"], 220),
    }


def _normalize_scenarios_block(value: Any, fallback: dict[str, Any]) -> dict[str, str]:
    payload = _as_dict(value)
    return {
        "pessimistic": _truncate(payload.get("pessimistic") or fallback["pessimistic"], 220),
        "realistic": _truncate(payload.get("realistic") or fallback["realistic"], 220),
        "ambitious": _truncate(payload.get("ambitious") or fallback["ambitious"], 220),
    }


def _normalize_pricing_business_model_scores(value: Any, fallback: dict[str, Any]) -> dict[str, int]:
    payload = _as_dict(value)
    scores = {key: _clamp_score(payload.get(key, fallback[key])) for key in _PRICING_BUSINESS_MODEL_SCORE_KEYS}
    scores["global"] = round(
        sum(scores[key] for key in _PRICING_BUSINESS_MODEL_SCORE_KEYS) / len(_PRICING_BUSINESS_MODEL_SCORE_KEYS)
    )
    return scores


def _normalize_pricing_business_model_analysis(value: Any, fallback: dict[str, Any]) -> dict[str, Any]:
    payload = _as_dict(value)
    normalized = {
        "pricing": _normalize_pricing_block(payload.get("pricing"), fallback["pricing"]),
        "business_model": _normalize_business_model_block(payload.get("business_model"), fallback["business_model"]),
        "simple_finance": _normalize_simple_finance_block(payload.get("simple_finance"), fallback["simple_finance"]),
        "scenarios": _normalize_scenarios_block(payload.get("scenarios"), fallback["scenarios"]),
        "scores": _normalize_pricing_business_model_scores(payload.get("scores"), fallback["scores"]),
        "strengths": _coerce_string_list(payload.get("strengths"), limit=6) or fallback["strengths"],
        "risks": _coerce_string_list(payload.get("risks"), limit=6) or fallback["risks"],
        "missing_information": _coerce_string_list(payload.get("missing_information"), limit=6) or fallback["missing_information"],
        "recommended_next_step": _truncate(payload.get("recommended_next_step") or fallback["recommended_next_step"], 260),
        "next_best_action": _normalize_next_best_action(payload.get("next_best_action"), fallback["next_best_action"]),
    }
    normalized["scores"]["global"] = round(
        sum(normalized["scores"][key] for key in _PRICING_BUSINESS_MODEL_SCORE_KEYS)
        / len(_PRICING_BUSINESS_MODEL_SCORE_KEYS)
    )
    return normalized


def _build_pricing_business_model_llm_prompt(
    project: dict[str, Any],
    instruction: str | None,
    fallback: dict[str, Any],
) -> str:
    title = _clean_text(project.get("title")) or "Projet Founder"
    project_data = json.dumps(_as_dict(project.get("project_data")), ensure_ascii=True, default=str)
    opencloud_project_path = _clean_text(project.get("opencloud_project_path")) or "N/A"
    instruction_block = _clean_text(instruction) or "Aucune instruction additionnelle."
    fallback_json = json.dumps(fallback, ensure_ascii=True, default=str)
    return (
        "Tu es founder_pricing_business_model_v1 pour ChatLAYA Founder.\n"
        "Tu n'es pas un chatbot. Tu produis un diagnostic structure prix et modele economique pour un Founder Builder OS.\n"
        "Retourne UNIQUEMENT un JSON valide, sans markdown ni texte autour.\n"
        "Integre si pertinent les realites africaines/locales: mobile money, cash, paiement fractionne, acompte, petits budgets, confiance client, informalite, distribution locale, marches physiques, WhatsApp, bouche-a-oreille, cout d'acquisition faible, marge reelle apres transport/logistique.\n"
        "Schema JSON attendu:\n"
        "{"
        "\"pricing\": {\"recommended_price_logic\": string, \"entry_price_hypothesis\": string, \"main_price_hypothesis\": string, \"premium_price_hypothesis\": string, \"payment_modes\": [string], \"pricing_risks\": [string]},"
        "\"business_model\": {\"revenue_streams\": [string], \"cost_structure\": [string], \"key_resources\": [string], \"key_partners\": [string], \"distribution_channels\": [string], \"unit_economics_summary\": string},"
        "\"simple_finance\": {\"startup_costs_to_estimate\": [string], \"fixed_costs\": [string], \"variable_costs\": [string], \"break_even_logic\": string, \"sales_needed_for_goal\": string},"
        "\"scenarios\": {\"pessimistic\": string, \"realistic\": string, \"ambitious\": string},"
        "\"scores\": {\"pricing_clarity\": 0, \"payment_fit\": 0, \"margin_potential\": 0, \"business_model_clarity\": 0, \"financial_readiness\": 0, \"global\": 0},"
        "\"strengths\": [string],"
        "\"risks\": [string],"
        "\"missing_information\": [string],"
        "\"recommended_next_step\": string,"
        "\"next_best_action\": {\"title\": string, \"why\": string, \"how\": [string], \"expected_output\": string}"
        "}\n"
        "Contraintes:\n"
        "- scores entre 0 et 100\n"
        "- diagnostic concret, financier, terrain et actionnable\n"
        "- pas de secret ni detail interne\n"
        f"Instruction additionnelle: {instruction_block}\n"
        f"Titre: {title}\n"
        f"OpenCloud path: {opencloud_project_path}\n"
        f"Project data JSON: {project_data}\n"
        f"Fallback deterministic reference: {fallback_json}\n"
    )


async def run_founder_pricing_business_model_v1(
    project: dict[str, Any],
    instruction: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    fallback = build_deterministic_pricing_business_model_analysis(project, instruction=instruction)
    analysis = fallback
    source = "deterministic"
    try:
        prompt = _build_pricing_business_model_llm_prompt(project, instruction, fallback)
        raw_response = await asyncio.to_thread(
            generate_answer,
            prompt,
            None,
            None,
            90,
            1200,
        )
        candidate = _extract_json_payload(raw_response)
        if candidate:
            analysis = _normalize_pricing_business_model_analysis(candidate, fallback)
            source = "llm"
    except Exception:
        analysis = fallback
        source = "deterministic"

    patch = {
        "agent_pricing_business_model_v1": {
            "agent": "founder_pricing_business_model_v1",
            "label": "Founder Pricing & Business Model Agent V1",
            "version": 1,
            "source": source,
            "generated_at": _now_iso(),
            "instruction": _clean_text(instruction) or None,
            "analysis": analysis,
        }
    }
    return analysis, patch
