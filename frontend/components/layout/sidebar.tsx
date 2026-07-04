"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { IS_V1_SIMPLE } from "@/lib/env";

function DotIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

function GridIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" {...props}>
      <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
    </svg>
  );
}

function UsersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" {...props}>
      <path d="M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2m14-10a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function BriefcaseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" {...props}>
      <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2m4 0H5a2 2 0 00-2 2v8a2 2 0 002 2h14a2 2 0 002-2v-8a2 2 0 00-2-2z" />
    </svg>
  );
}

function BookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" {...props}>
      <path d="M4 5a2 2 0 012-2h9a4 4 0 014 4v10a3 3 0 01-3-3 3 3 0 01-3 3H6a2 2 0 01-2-2V5z" />
    </svg>
  );
}

const DEFAULT_LINKS = [
  { href: "/skills", label: "Compétences", description: "Secteurs et cartographie", icon: GridIcon },
  { href: "/talents", label: "Talents", description: "Profils et disponibilités", icon: UsersIcon },
  { href: "/missions/offers", label: "Mes offres", description: "Suivi et exécution", icon: BriefcaseIcon },
] as const;

const SIMPLE_LINKS = [
  { href: "/trajectoire", label: "Formation IA", description: "Diagnostic et progression", icon: BookIcon },
  { href: "/entreprise", label: "Entreprise", description: "Besoin cadré et mission structurée", icon: BriefcaseIcon },
  { href: "/services-ia", label: "Service IA", description: "10 offres exécutées de bout en bout", icon: GridIcon },
] as const;

export default function Sidebar({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const links = IS_V1_SIMPLE ? SIMPLE_LINKS : DEFAULT_LINKS;

  useEffect(() => {
    const saved = localStorage.getItem("innova.sidebar.collapsed");
    if (saved) setCollapsed(saved === "1");
  }, []);

  if (pathname.startsWith("/trajectoire/demarrer")) {
    return null;
  }

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("innova.sidebar.collapsed", next ? "1" : "0");
  }

  return (
    <aside
      className={clsx(
        "z-30 h-full shrink-0 overflow-hidden border-r border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(244,248,252,0.9))] backdrop-blur-2xl transition-all duration-300",
        collapsed ? "w-[74px]" : "w-[280px]",
        className,
      )}
      style={style}
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-slate-200/70 px-3 py-4">
          <button
            type="button"
            onClick={toggle}
            className="rounded-full border border-white/80 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
            aria-label={collapsed ? "Deplier la barre laterale" : "Replier la barre laterale"}
          >
            {collapsed ? "Ouvrir" : "Reduire"}
          </button>
          {!collapsed ? (
            <div className="mt-3 rounded-[24px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(224,242,254,0.7))] p-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-700">Navigation</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">
                {IS_V1_SIMPLE
                  ? "Formation IA, Entreprise et Service IA dans une expérience simple et premium."
                  : "Navigation unifiée pour piloter les talents et l'exécution."}
              </p>
            </div>
          ) : null}
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          {links.map((link) => {
            const active = pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "group flex items-center gap-3 rounded-[22px] px-3 py-3 transition-all duration-200",
                  active
                    ? "border border-sky-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(224,242,254,0.92))] text-sky-700 shadow-[0_14px_28px_rgba(14,165,233,0.14)]"
                    : "text-slate-600 hover:bg-white/88 hover:text-slate-900 hover:shadow-[0_10px_22px_rgba(148,163,184,0.16)]",
                  collapsed && "justify-center px-2",
                )}
              >
                <div className={clsx("flex h-9 w-9 items-center justify-center rounded-2xl shadow-sm", active ? "bg-sky-100 text-sky-600" : "bg-white text-slate-500")}>
                  <Icon className="h-4 w-4" />
                </div>
                {!collapsed ? (
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-semibold">{link.label}</span>
                      {active ? <span className="h-2 w-2 rounded-full bg-sky-500" /> : null}
                    </div>
                    <p className="truncate text-[11px] text-slate-500">{link.description}</p>
                  </div>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200/70 p-4">
          {!collapsed ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-blue-50 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  <span className="text-[11px] font-medium text-slate-700">Systeme actif</span>
                </div>
                <p className="text-[11px] text-slate-600">Navigation simplifiee et plus orientee produit</p>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span>v2.1.0</span>
                <span>•</span>
                <span>{IS_V1_SIMPLE ? "V1 simple active" : "Derniere mise a jour"}</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
