"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

type HeroAction = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
};

export function PublishedHero(props: {
  title: ReactNode;
  description: string;
  actions?: HeroAction[];
}) {
  const { title, description, actions = [] } = props;

  return (
    <section className="relative w-full overflow-hidden bg-[linear-gradient(135deg,#111f35_0%,#132846_55%,#16395d_100%)] text-white">
      <div
        aria-hidden
        className="absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.18) 1.1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />
      <div aria-hidden className="absolute inset-y-0 right-[-8%] w-48 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.16),transparent_65%)] sm:w-[40%]" />
      <div className="relative mx-auto w-full max-w-[var(--marketing-max-w)] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="max-w-4xl">
          <h1 className="kx-display text-[2.35rem] font-semibold leading-[1.02] tracking-[-0.07em] sm:text-5xl lg:text-6xl">{title}</h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300 sm:text-xl sm:leading-9">{description}</p>
          {actions.length ? (
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              {actions.map((action) => (
                <Link
                  key={`${action.href}-${action.label}`}
                  href={action.href}
                  className={
                    action.variant === "secondary"
                      ? "inline-flex w-full items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-6 py-3.5 text-base font-semibold text-white backdrop-blur transition hover:bg-white/16 sm:w-auto sm:px-7 sm:py-4 sm:text-lg"
                      : "inline-flex w-full items-center justify-center rounded-2xl bg-sky-600 px-6 py-3.5 text-base font-semibold text-white shadow-[0_20px_52px_rgba(2,132,199,0.24)] transition hover:bg-sky-700 sm:w-auto sm:px-7 sm:py-4 sm:text-lg"
                  }
                >
                  {action.label}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function PublishedSectionHeading(props: { title: string; description?: string }) {
  const { title, description } = props;
  return (
    <div className="mb-10 text-center sm:mb-16">
      <h2 className="text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">{title}</h2>
      {description ? <p className="mx-auto mt-4 max-w-3xl text-base text-slate-500 sm:text-xl">{description}</p> : null}
    </div>
  );
}

export function PublishedCard(props: { icon?: ReactNode; title: string; description: string; footer?: ReactNode; className?: string }) {
  const { icon, title, description, footer, className = "" } = props;
  return (
    <article className={`rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_46px_rgba(15,23,42,0.06)] ${className}`}>
      {icon ? <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 text-sky-600">{icon}</div> : null}
      <h3 className="text-xl font-semibold text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
      {footer ? <div className="mt-6">{footer}</div> : null}
    </article>
  );
}

export function PublishedGradientBand(props: { title: string; description: string; actionHref: string; actionLabel: string }) {
  const { title, description, actionHref, actionLabel } = props;
  return (
    <section className="relative w-full bg-[linear-gradient(135deg,#0d8fda_0%,#0d6aa8_100%)] py-16 text-white sm:py-20">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-[-0.04em] sm:text-4xl">{title}</h2>
        <p className="mt-6 text-base text-sky-100 sm:text-xl">{description}</p>
        <Link href={actionHref} className="mt-10 inline-flex w-full items-center justify-center rounded-2xl bg-white px-6 py-3.5 text-base font-semibold text-slate-900 transition hover:bg-slate-50 sm:w-auto sm:px-7 sm:py-4 sm:text-lg">
          {actionLabel}
          <ArrowRight className="ml-2 h-5 w-5" />
        </Link>
      </div>
    </section>
  );
}

export function PublishedCheckList(props: { items: string[] }) {
  return (
    <div className="space-y-4">
      {props.items.map((item) => (
        <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
          <p className="text-sm leading-7 text-slate-700">{item}</p>
        </div>
      ))}
    </div>
  );
}

export function PublishedFormShell(props: { children: ReactNode }) {
  return <div className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_46px_rgba(15,23,42,0.06)]">{props.children}</div>;
}
