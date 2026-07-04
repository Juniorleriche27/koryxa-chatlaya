"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  helperTitle: string;
  helperBody: string;
  helperPoints: string[];
  footerText: string;
  footerHref: string;
  footerLabel: string;
  children: ReactNode;
};

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  helperTitle,
  helperBody,
  helperPoints,
  footerText,
  footerHref,
  footerLabel,
  children,
}: AuthShellProps) {
  return (
    <main className="relative min-h-[calc(100vh-88px)] overflow-hidden px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.12),transparent_32%)]" />
      <div className="relative mx-auto grid w-full max-w-6xl overflow-hidden rounded-[24px] border border-slate-200/80 bg-white/92 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur sm:rounded-[32px] xl:grid-cols-[1.05fr_0.95fr]">
        <section className="order-2 min-w-0 relative overflow-hidden bg-[linear-gradient(155deg,#0f172a_0%,#0f3b67_45%,#0284c7_100%)] px-5 py-6 text-white sm:px-10 sm:py-10 xl:order-1">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_30%)]" />
          <div className="relative min-w-0">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100 sm:tracking-[0.26em]">
              <ShieldCheck className="h-3.5 w-3.5" />
              {eyebrow}
            </div>
            <h1 className="mt-5 max-w-xl break-words font-serif text-3xl leading-tight sm:mt-6 sm:text-4xl lg:text-5xl">{title}</h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-sky-50/88 sm:text-base sm:leading-7">{subtitle}</p>

            <div className="mt-8 rounded-[24px] border border-white/15 bg-white/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur sm:mt-10 sm:rounded-[28px] sm:p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-100/80">Pourquoi ce parcours</div>
              <h2 className="mt-3 text-xl font-semibold text-white sm:text-2xl">{helperTitle}</h2>
              <p className="mt-3 text-sm leading-6 text-sky-50/82 sm:leading-7">{helperBody}</p>
              <div className="mt-6 space-y-3">
                {helperPoints.map((point) => (
                  <div
                    key={point}
                    className="flex items-start gap-3 rounded-2xl border border-white/12 bg-slate-950/18 px-4 py-3 text-sm leading-6 text-sky-50/90"
                  >
                    <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-200" />
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="order-1 min-w-0 px-5 py-6 sm:px-10 sm:py-10 xl:order-2">
          <div className="mx-auto min-w-0 max-w-xl">{children}</div>
          <p className="mt-8 text-sm leading-6 text-slate-500">
            <span>{footerText} </span>
            <Link href={footerHref} className="font-semibold text-sky-700 transition hover:text-sky-900 hover:underline">
              {footerLabel}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
