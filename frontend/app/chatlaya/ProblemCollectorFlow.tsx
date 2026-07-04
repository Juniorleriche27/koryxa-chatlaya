"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, RefreshCw } from "lucide-react";
import { getChatlayaApiBase } from "@/lib/env";

function apiUrl(path: string): string {
  return `${getChatlayaApiBase().replace(/\/$/, "")}${path}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type CategoryItem = { id: string; label: string };

type Categories = {
  domains: CategoryItem[];
  zone_types: CategoryItem[];
  severities: CategoryItem[];
  frequencies: CategoryItem[];
  evidence_types: CategoryItem[];
};

type Answers = {
  country: string;
  zone_type: string;
  city: string;
  domain: string;
  problem_description: string;
  affected_population: string;
  severity: string;
  frequency: string;
  perceived_cause: string;
  proposed_solution: string;
  evidence_type: string;
  consent_anonymized: boolean | null;
};

type ConvoMessage = {
  id: string;
  role: "bot" | "user";
  text: string;
};

type StepType = "text" | "textarea" | "chips" | "consent";

type StepDef = {
  field: keyof Answers;
  question: string;
  type: StepType;
  chipsKey?: keyof Categories;
  placeholder?: string;
};

// ─── Validation rules ─────────────────────────────────────────────────────────

const FIELD_MIN_LENGTHS: Partial<Record<keyof Answers, number>> = {
  country: 2,
  city: 2,
  problem_description: 120,
  affected_population: 10,
  perceived_cause: 50,
  proposed_solution: 80,
};

const FIELD_HELP: Partial<Record<keyof Answers, string>> = {
  problem_description:
    "Décrivez le problème avec plus de détails : qui est concerné, ce qui se passe, où cela se passe, et pourquoi c'est important. Minimum 120 caractères.",
  perceived_cause:
    "Expliquez la cause selon vous en quelques phrases. Minimum 50 caractères.",
  proposed_solution:
    "Proposez une piste de solution concrète, même simple. Minimum 80 caractères.",
};

// V1 : photo/document exclus (pas d'upload disponible)
const EVIDENCE_TYPES_V1 = ["observation", "community_testimony", "estimate", "none"];

// ─── Fallback categories ──────────────────────────────────────────────────────

const FALLBACK_CATEGORIES: Categories = {
  domains: [
    { id: "employment", label: "Emploi" },
    { id: "training", label: "Formation" },
    { id: "agriculture", label: "Agriculture" },
    { id: "healthcare", label: "Santé" },
    { id: "education", label: "Éducation" },
    { id: "transport", label: "Transport" },
    { id: "water_access", label: "Accès à l'eau" },
    { id: "electricity", label: "Électricité" },
    { id: "commerce", label: "Commerce" },
    { id: "financing", label: "Financement" },
    { id: "entrepreneurship", label: "Entrepreneuriat" },
    { id: "environment", label: "Environnement" },
    { id: "administration", label: "Administration et services publics" },
    { id: "digital_access", label: "Accès numérique" },
    { id: "housing", label: "Logement" },
    { id: "food_security", label: "Sécurité alimentaire" },
    { id: "other", label: "Autre" },
  ],
  zone_types: [
    { id: "urban", label: "Grande ville / zone urbaine" },
    { id: "peri_urban", label: "Zone périurbaine" },
    { id: "rural", label: "Zone rurale" },
    { id: "village", label: "Village" },
    { id: "unknown", label: "Je ne sais pas" },
  ],
  severities: [
    { id: "low", label: "Faible" },
    { id: "medium", label: "Moyen" },
    { id: "high", label: "Grave" },
    { id: "critical", label: "Très urgent" },
  ],
  frequencies: [
    { id: "one_off", label: "Ponctuel" },
    { id: "occasional", label: "Occasionnel" },
    { id: "weekly", label: "Fréquent" },
    { id: "daily", label: "Chaque jour" },
    { id: "constant", label: "Permanent" },
    { id: "seasonal", label: "Saisonnier" },
  ],
  evidence_types: [
    { id: "observation", label: "Observation personnelle" },
    { id: "community_testimony", label: "Témoignage communautaire" },
    { id: "estimate", label: "Estimation personnelle" },
    { id: "none", label: "Aucune preuve pour le moment" },
  ],
};

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS: StepDef[] = [
  {
    field: "country",
    question: "Pour commencer, dans quel pays êtes-vous actuellement ?",
    type: "text",
    placeholder: "Ex : Sénégal, Côte d'Ivoire, Cameroun…",
  },
  {
    field: "zone_type",
    question:
      "Vous êtes plutôt dans une grande ville, une zone périurbaine, une zone rurale, un village, ou vous ne savez pas ?",
    type: "chips",
    chipsKey: "zone_types",
  },
  {
    field: "city",
    question: "Dans quelle ville, commune ou région vivez-vous ?",
    type: "text",
    placeholder: "Ex : Dakar, Abidjan, Douala…",
  },
  {
    field: "domain",
    question: "Quel type de problème observez-vous le plus autour de vous ?",
    type: "chips",
    chipsKey: "domains",
  },
  {
    field: "problem_description",
    question: "Expliquez ce problème avec vos propres mots. Qu'est-ce qui se passe exactement ?",
    type: "textarea",
    placeholder: "Décrivez la situation : qui est concerné, ce qui se passe, où cela se passe…",
  },
  {
    field: "affected_population",
    question: "Qui est le plus touché par ce problème ?",
    type: "text",
    placeholder: "Ex : Les jeunes sans emploi, les femmes du quartier, les agriculteurs…",
  },
  {
    field: "severity",
    question: "Selon vous, ce problème est-il faible, moyen, grave ou très urgent ?",
    type: "chips",
    chipsKey: "severities",
  },
  {
    field: "frequency",
    question:
      "Ce problème arrive ponctuellement, occasionnellement, fréquemment, chaque jour, de façon permanente ou selon les saisons ?",
    type: "chips",
    chipsKey: "frequencies",
  },
  {
    field: "perceived_cause",
    question: "D'après vous, quelle est la principale cause de ce problème ?",
    type: "textarea",
    placeholder: "Expliquez ce qui, selon vous, cause cette situation…",
  },
  {
    field: "proposed_solution",
    question: "Selon vous, comment peut-on commencer à résoudre ce problème, même avec peu de moyens ?",
    type: "textarea",
    placeholder: "Votre idée ou suggestion concrète…",
  },
  {
    field: "evidence_type",
    question:
      "Avez-vous une preuve ou un exemple concret ? Observation personnelle, témoignage communautaire, estimation personnelle, ou aucune preuve pour le moment ?",
    type: "chips",
    chipsKey: "evidence_types",
  },
  {
    field: "consent_anonymized",
    question:
      "Acceptez-vous que votre réponse soit utilisée de manière anonymisée pour aider KORYXA à mieux comprendre les problèmes locaux et construire de meilleures solutions ?",
    type: "consent",
  },
];

const TOTAL_STEPS = STEPS.length;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INITIAL_ANSWERS: Answers = {
  country: "",
  zone_type: "",
  city: "",
  domain: "",
  problem_description: "",
  affected_population: "",
  severity: "",
  frequency: "",
  perceived_cause: "",
  proposed_solution: "",
  evidence_type: "",
  consent_anonymized: null,
};

function minForField(field: keyof Answers): number {
  return FIELD_MIN_LENGTHS[field] ?? 1;
}

function validateTextField(field: keyof Answers, value: string): boolean {
  return value.trim().length >= minForField(field);
}

function findFirstInvalidStep(finalAnswers: Answers): number | null {
  for (let i = 0; i < STEPS.length; i++) {
    const s = STEPS[i];
    if (s.type === "text" || s.type === "textarea") {
      if (!validateTextField(s.field, (finalAnswers[s.field] as string) || "")) return i;
    } else if (s.type === "chips") {
      if (!finalAnswers[s.field]) return i;
    }
  }
  return null;
}

function buildInitialConvo(): ConvoMessage[] {
  return [
    {
      id: "intro",
      role: "bot",
      text: "Bonjour, je suis ChatLAYA, l'assistant de KORYXA.\n\nJ'aimerais mieux comprendre les réalités que vous vivez ou observez autour de vous, afin d'aider KORYXA à construire demain des solutions plus utiles pour les jeunes, les entrepreneurs et les communautés africaines.",
    },
    {
      id: "q0",
      role: "bot",
      text: STEPS[0].question,
    },
  ];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProblemCollectorFlow() {
  const [categories, setCategories] = useState<Categories>(FALLBACK_CATEGORIES);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(INITIAL_ANSWERS);
  const [input, setInput] = useState("");
  const [convo, setConvo] = useState<ConvoMessage[]>(buildInitialConvo);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const finalAnswersRef = useRef<Answers | null>(null);

  useEffect(() => {
    fetch(apiUrl("/chatlaya/problem-report-categories"), {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json() as Promise<Categories>;
      })
      .then(setCategories)
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [convo, submitting, submitted, submitError]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, 180);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > 180 ? "auto" : "hidden";
  }, [input]);

  function getLabelForId(field: keyof Answers, value: string | boolean | null): string {
    if (field === "consent_anonymized") {
      return value === true ? "Oui, j'accepte" : "Non, je refuse";
    }
    const stepDef = STEPS.find((s) => s.field === field);
    if (stepDef?.chipsKey) {
      const items = categories[stepDef.chipsKey] as CategoryItem[];
      return items.find((item) => item.id === value)?.label ?? String(value);
    }
    return String(value ?? "");
  }

  function advanceToNextStep(currentStep: number, answerValue: string | boolean, updatedAnswers: Answers) {
    const displayLabel = getLabelForId(STEPS[currentStep].field, answerValue);
    const userMsg: ConvoMessage = {
      id: `user-${currentStep}`,
      role: "user",
      text: displayLabel,
    };

    const nextStep = currentStep + 1;
    setInput("");

    if (nextStep < TOTAL_STEPS) {
      setConvo((prev) => [
        ...prev,
        userMsg,
        { id: `q${nextStep}`, role: "bot", text: STEPS[nextStep].question },
      ]);
      setStep(nextStep);
    } else {
      setConvo((prev) => [
        ...prev,
        userMsg,
        {
          id: "confirm",
          role: "bot",
          text: "Merci pour toutes vos réponses. J'enregistre votre contribution…",
        },
      ]);
      setStep(TOTAL_STEPS);
      finalAnswersRef.current = updatedAnswers;
      void doSubmit(updatedAnswers);
    }
  }

  async function doSubmit(finalAnswers: Answers) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        conversation_id: null,
        message_id: null,
        country: finalAnswers.country,
        region: null,
        city: finalAnswers.city || null,
        commune: null,
        zone_type: finalAnswers.zone_type || null,
        domain: finalAnswers.domain,
        sector: null,
        problem_title: null,
        problem_description: finalAnswers.problem_description,
        affected_population: finalAnswers.affected_population || null,
        severity: finalAnswers.severity || null,
        frequency: finalAnswers.frequency || null,
        perceived_cause: finalAnswers.perceived_cause || null,
        proposed_solution: finalAnswers.proposed_solution || null,
        evidence_type: finalAnswers.evidence_type || null,
        consent_anonymized: finalAnswers.consent_anonymized === true,
        source_channel: "chatlaya_web",
        raw_payload: {
          ui_version: "chatlaya-problem-collector-v1",
          language: "fr",
          intent: "problem_collector",
        },
      };

      const postUrl = apiUrl("/chatlaya/problem-reports");
      if (process.env.NODE_ENV === "development") {
        console.debug("[ProblemCollectorFlow] POST", postUrl);
      }
      const response = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (process.env.NODE_ENV === "development") {
          const body = await response.clone().text().catch(() => "");
          console.error(
            `[ProblemCollectorFlow] POST /problem-reports failed: status=${response.status}, body=${body}`,
          );
        }
        throw new Error();
      }

      setSubmitted(true);
    } catch {
      setSubmitError(
        "Nous n'avons pas pu enregistrer votre contribution pour le moment. Vérifiez vos réponses ou réessayez dans quelques instants.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleTextSubmit() {
    const value = input.trim();
    const field = STEPS[step].field;
    if (!validateTextField(field, value)) return;
    const updatedAnswers = { ...answers, [field]: value };
    setAnswers(updatedAnswers);
    advanceToNextStep(step, value, updatedAnswers);
  }

  function handleChipSelect(id: string) {
    const field = STEPS[step].field;
    const updatedAnswers = { ...answers, [field]: id };
    setAnswers(updatedAnswers);
    advanceToNextStep(step, id, updatedAnswers);
  }

  function handleConsentSelect(value: boolean) {
    const updatedAnswers = { ...answers, consent_anonymized: value };

    // Garde-fou pré-soumission : revérifier tous les champs texte/textarea
    const invalidIdx = findFirstInvalidStep(updatedAnswers);
    if (invalidIdx !== null) {
      const invalidField = STEPS[invalidIdx].field;
      const min = minForField(invalidField);
      const currentVal = (updatedAnswers[invalidField] as string) || "";
      setConvo((prev) => [
        ...prev,
        {
          id: `prevalidation-${Date.now()}`,
          role: "bot",
          text: `Oups ! Une réponse précédente est trop courte (${currentVal.trim().length}/${min} caractères minimum). Pouvez-vous la compléter ?`,
        },
      ]);
      setStep(invalidIdx);
      setInput(currentVal);
      return;
    }

    setAnswers(updatedAnswers);
    advanceToNextStep(step, value, updatedAnswers);
  }

  function handleReset() {
    setAnswers(INITIAL_ANSWERS);
    setStep(0);
    setInput("");
    setSubmitted(false);
    setSubmitError(null);
    finalAnswersRef.current = null;
    setConvo(buildInitialConvo());
  }

  const currentStepDef = step < TOTAL_STEPS ? STEPS[step] : null;
  const currentField = currentStepDef?.field ?? null;

  // Filtre evidence_types V1 (pas d'upload)
  const chips: CategoryItem[] =
    currentStepDef?.chipsKey
      ? (categories[currentStepDef.chipsKey] as CategoryItem[]).filter(
          (item) =>
            currentStepDef.chipsKey !== "evidence_types" || EVIDENCE_TYPES_V1.includes(item.id),
        )
      : [];

  // Calcul validation pour text / textarea
  const minLength = currentField ? minForField(currentField) : 1;
  const inputLen = input.trim().length;
  const tooShort = inputLen > 0 && inputLen < minLength;
  const canSubmitText = inputLen >= minLength;
  const helpText = currentField ? (FIELD_HELP[currentField] ?? null) : null;
  const showCounter =
    currentStepDef?.type === "textarea" &&
    currentField !== null &&
    FIELD_MIN_LENGTHS[currentField] !== undefined;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Barre de progression */}
      {step < TOTAL_STEPS && (
        <div className="shrink-0 border-b border-slate-100 bg-slate-50/60 px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-sky-500 transition-all duration-500"
                style={{ width: `${Math.round((step / TOTAL_STEPS) * 100)}%` }}
              />
            </div>
            <span className="shrink-0 text-[10px] font-medium text-slate-400">
              {step + 1} / {TOTAL_STEPS}
            </span>
          </div>
        </div>
      )}

      {/* Zone de messages */}
      <div className="sidebar-nav min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-pan-y px-4 py-5 [-webkit-overflow-scrolling:touch] sm:px-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          {convo.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <div className="mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-600 shadow-sm">
                    <span className="text-[9px] font-bold leading-none text-white">L</span>
                  </div>
                )}
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-7 ${
                    isUser
                      ? "rounded-br-sm border border-sky-100 bg-sky-50 text-slate-800"
                      : "rounded-bl-sm border border-slate-100 bg-white shadow-[0_1px_6px_rgba(15,23,42,0.06)] text-slate-700"
                  }`}
                >
                  {msg.text.split("\n\n").map((para, i) => (
                    <p key={i} className={i > 0 ? "mt-3" : ""}>
                      {para}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}

          {submitting && (
            <div className="flex items-end justify-start gap-2">
              <div className="mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-600 shadow-sm">
                <span className="text-[9px] font-bold leading-none text-white">L</span>
              </div>
              <div className="rounded-2xl rounded-bl-sm border border-slate-100 bg-white px-4 py-3 shadow-[0_1px_6px_rgba(15,23,42,0.06)]">
                <span className="inline-flex items-center gap-2 text-xs text-slate-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
                  Enregistrement en cours…
                </span>
              </div>
            </div>
          )}

          {submitted && (
            <div className="flex items-end justify-start gap-2">
              <div className="mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 shadow-sm">
                <span className="text-[9px] font-bold leading-none text-white">L</span>
              </div>
              <div className="max-w-[82%] rounded-2xl rounded-bl-sm border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-7 text-emerald-800">
                <p className="font-semibold">Merci pour votre contribution.</p>
                <p className="mt-1">
                  Votre retour aide KORYXA à mieux comprendre les réalités du terrain africain. Il
                  sera utilisé de manière responsable et anonymisée pour améliorer nos futures
                  solutions.
                </p>
              </div>
            </div>
          )}

          {submitError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {submitError}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Zone de saisie */}
      {!submitted && !submitting && currentStepDef && (
        <div className="shrink-0 border-t border-slate-100 bg-white px-3 py-3 sm:px-4">
          {currentStepDef.type === "chips" && chips.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {chips.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleChipSelect(item.id)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700 active:scale-95"
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : currentStepDef.type === "consent" ? (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleConsentSelect(true)}
                className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 active:scale-95"
              >
                Oui, j'accepte
              </button>
              <button
                type="button"
                onClick={() => handleConsentSelect(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 active:scale-95"
              >
                Non, je refuse
              </button>
            </div>
          ) : currentStepDef.type === "textarea" ? (
            <>
              <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 transition-colors focus-within:border-sky-300 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(14,165,233,0.07)]">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (canSubmitText) handleTextSubmit();
                    }
                  }}
                  placeholder={currentStepDef.placeholder ?? "Votre réponse…"}
                  rows={1}
                  className="min-h-[40px] w-full resize-none bg-transparent text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleTextSubmit}
                  disabled={!canSubmitText}
                  className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-1 flex items-start justify-between gap-3">
                <p
                  className={`text-[10px] leading-4 ${
                    tooShort ? "text-rose-500" : "text-slate-400"
                  }`}
                >
                  {helpText ?? ""}
                </p>
                {showCounter && (
                  <p
                    className={`shrink-0 tabular-nums text-[10px] ${
                      canSubmitText
                        ? "text-emerald-500"
                        : tooShort
                          ? "text-rose-400"
                          : "text-slate-400"
                    }`}
                  >
                    {inputLen} / {minLength} caractères
                  </p>
                )}
              </div>
            </>
          ) : currentStepDef.type === "text" ? (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 transition-colors focus-within:border-sky-300 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(14,165,233,0.07)]">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (canSubmitText) handleTextSubmit();
                    }
                  }}
                  placeholder={currentStepDef.placeholder ?? "Votre réponse…"}
                  className="w-full bg-transparent text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleTextSubmit}
                  disabled={!canSubmitText}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
              </div>
              {tooShort ? (
                <p className="mt-1 text-[10px] text-rose-500">
                  Minimum {minLength} caractères requis ({inputLen}/{minLength}).
                </p>
              ) : (
                <p className="mt-1.5 text-right text-[10px] text-slate-400">Entrée pour envoyer</p>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* Actions post-soumission */}
      {(submitted || submitError) && !submitting && (
        <div className="shrink-0 border-t border-slate-100 bg-white px-3 py-3 sm:px-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            {submitError && (
              <button
                type="button"
                onClick={() => {
                  setSubmitError(null);
                  void doSubmit(finalAnswersRef.current ?? answers);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 active:scale-95"
              >
                <RefreshCw className="h-4 w-4" />
                Réessayer
              </button>
            )}
            {submitted && (
              <>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 active:scale-95"
                >
                  Nouvelle contribution
                </button>
                <Link
                  href="/"
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-600 transition hover:bg-slate-50 active:scale-95"
                >
                  Retour à l'accueil
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
