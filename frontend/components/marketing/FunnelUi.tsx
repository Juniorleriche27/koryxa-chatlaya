import type { ReactNode } from "react";

export type FunnelStepItem = {
  number: string;
  title: string;
  caption: string;
};

function StepCheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.3} aria-hidden="true" className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 10.5 3.2 3.2L15.5 6.8" />
    </svg>
  );
}

export function FunnelStepStrip(props: {
  steps: FunnelStepItem[];
  currentStep?: number;
  vertical?: boolean;
}) {
  const { steps, currentStep, vertical = false } = props;

  return (
    <ol className={`grid gap-3 ${vertical ? "grid-cols-1" : "lg:grid-cols-3"}`} aria-label="Étapes du parcours">
      {steps.map((step, index) => {
        const isCurrent = currentStep === index;
        const isDone = currentStep !== undefined && index < currentStep;

        return (
          <li
            key={step.number}
            aria-current={isCurrent ? "step" : undefined}
            className={`rounded-[26px] border px-4 py-4 transition ${
              isCurrent
                ? "border-sky-300 bg-sky-50/90 shadow-[0_16px_36px_rgba(14,165,233,0.12)]"
                : isDone
                  ? "border-emerald-200 bg-emerald-50/80"
                  : "border-slate-200 bg-white/92"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  isCurrent
                    ? "bg-sky-600 text-white"
                    : isDone
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-700"
                }`}
              >
                {step.number}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-950">{step.title}</p>
                <p className="mt-1 text-xs leading-6 text-slate-500">{step.caption}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function FunnelOptionButton(props: {
  label: string;
  hint?: string;
  active: boolean;
  onClick: () => void;
}) {
  const { label, hint, active, onClick } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      role="radio"
      aria-checked={active}
      className={`group relative w-full overflow-hidden rounded-[18px] border px-3.5 py-2.5 text-left transition-all duration-200 ${
        active
          ? "border-sky-400 bg-[linear-gradient(180deg,rgba(239,246,255,1),rgba(255,255,255,1))] shadow-[0_14px_28px_rgba(14,165,233,0.16)] ring-2 ring-sky-200"
          : "border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,1))] shadow-[0_8px_18px_rgba(148,163,184,0.07)] hover:border-sky-200 hover:shadow-[0_12px_24px_rgba(148,163,184,0.12)]"
      }`}
    >
      <span
        className={`absolute right-3 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border transition ${
          active
            ? "border-sky-500 bg-sky-600 text-white shadow-[0_0_0_4px_rgba(186,230,253,0.9)]"
            : "border-slate-200 bg-white text-transparent group-hover:border-sky-200"
        }`}
      >
        {active ? <StepCheckIcon /> : null}
      </span>
      <span className={`block pr-10 text-[14px] font-semibold leading-5 ${active ? "text-sky-900" : "text-slate-950"}`}>
        {label}
      </span>
      {hint ? <span className={`mt-1 block pr-10 text-[11px] leading-[1.125rem] ${active ? "text-sky-700/80" : "text-slate-500"}`}>{hint}</span> : null}
    </button>
  );
}

export function FunnelProgressPanel(props: {
  eyebrow: string;
  title: string;
  description: string;
  steps: FunnelStepItem[];
  currentStep: number;
  questionIndex: number;
  totalQuestions: number;
  actions?: ReactNode;
  highlights?: string[];
}) {
  const { eyebrow, title, description, steps, currentStep, questionIndex, totalQuestions, actions, highlights = [] } =
    props;
  const progress = Math.round(((questionIndex + 1) / totalQuestions) * 100);

  return (
    <aside className="grid gap-4 lg:sticky lg:top-24">
      <section className="overflow-hidden rounded-[32px] border border-slate-900/80 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_34%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] p-6 text-white shadow-[0_28px_70px_rgba(2,6,23,0.36)] sm:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-200">{eyebrow}</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-[2rem]">{title}</h1>
        <p className="mt-3 text-sm leading-7 text-slate-300">{description}</p>

        <div className="mt-6 rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-100/80">
            <span>
              Question {questionIndex + 1} / {totalQuestions}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-white/10">
            <div
              className="h-2 rounded-full bg-[linear-gradient(90deg,#38bdf8,#7dd3fc)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <ol className="mt-6 grid gap-3" aria-label="Étapes">
          {steps.map((step, index) => {
            const isCurrent = currentStep === index;
            const isDone = index < currentStep;
            return (
              <li
                key={step.number}
                className={`rounded-[22px] border px-4 py-4 transition ${
                  isCurrent
                    ? "border-sky-300/40 bg-sky-500/12"
                    : isDone
                      ? "border-emerald-400/30 bg-emerald-500/10"
                      : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      isCurrent
                        ? "bg-sky-400 text-slate-950"
                        : isDone
                          ? "bg-emerald-400 text-slate-950"
                          : "bg-white/10 text-white"
                    }`}
                  >
                    {step.number}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{step.title}</p>
                    <p className="mt-1 text-xs leading-6 text-slate-300">{step.caption}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {actions ? <div className="mt-6 flex flex-wrap gap-3">{actions}</div> : null}
      </section>

      {highlights.length ? (
        <section className="rounded-[28px] border border-slate-200/80 bg-white/94 p-6 shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Ce que KORYXA prépare</p>
          <div className="mt-4 grid gap-3">
            {highlights.map((item, index) => (
              <div key={item} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Livrable {index + 1}</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  );
}

export function FunnelQuestionCard(props: {
  phaseLabel: string;
  title: string;
  description: string;
  optional?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { phaseLabel, title, description, optional = false, children, footer } = props;

  return (
    <section className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/96 shadow-[0_24px_58px_rgba(15,23,42,0.08)]">
      <div className="border-b border-slate-100 px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            {phaseLabel}
          </span>
          <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700">
            {optional ? "Optionnel" : "Essentiel"}
          </span>
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-[2rem]">{title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">{description}</p>
      </div>

      <div className="px-5 py-5 sm:px-7 sm:py-6">{children}</div>

      {footer ? <div className="border-t border-slate-100 px-5 py-5 sm:px-7">{footer}</div> : null}
    </section>
  );
}

export function FunnelSummaryCard(props: {
  title: string;
  items: Array<{ label: string; value: string }>;
  compact?: boolean;
}) {
  const { title, items, compact = false } = props;

  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-white/94 p-6 shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">{title}</p>
      <div className={`mt-4 grid gap-3 ${compact ? "sm:grid-cols-2 xl:grid-cols-3" : ""}`}>
        {items.map((item) => (
          <div key={item.label} className={`rounded-[22px] border border-slate-200 bg-slate-50 ${compact ? "px-4 py-3" : "px-4 py-4"}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
            <p className={`mt-2 text-sm font-semibold text-slate-900 ${compact ? "leading-6" : "leading-7"}`}>{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
