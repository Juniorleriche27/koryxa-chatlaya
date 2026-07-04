"use client";

import Link from "next/link";
import BrandLogo from "@/components/layout/BrandLogo";
import { IS_V1_SIMPLE } from "@/lib/env";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/8 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[var(--marketing-max-w)] flex-col gap-5 px-4 py-7 text-xs text-slate-500 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:text-sm">
        <div className="flex items-center gap-3 text-slate-300">
          <BrandLogo className="h-12 w-12 rounded-2xl" />
          <div className="leading-tight">
            <p className="font-semibold text-white">KORYXA</p>
            <p className="mt-1 text-xs text-slate-400">
              {IS_V1_SIMPLE
                ? "Formation IA, Entreprise et Service IA dans un cadre simple et premium."
                : "KORYXA, plateforme d'orchestration IA pour cadrer, piloter et activer."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400 sm:text-sm">
          <Link href="/services-ia" className="transition hover:text-sky-300">
            Service IA
          </Link>
          <Link href="/about" className="transition hover:text-sky-300">
            A propos
          </Link>
          <Link href="/legal/confidentialite" className="transition hover:text-sky-300">
            Confidentialite
          </Link>
          <Link href="/legal/mentions" className="transition hover:text-sky-300">
            Mentions legales
          </Link>
          <span className="text-slate-600">v1.0.0</span>
        </div>

        <p className="text-xs text-slate-500 sm:text-sm">Copyright {year} KORYXA. Tous droits reserves.</p>
      </div>
    </footer>
  );
}
