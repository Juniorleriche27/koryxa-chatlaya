"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  type LucideIcon,
  Bot,
  BriefcaseBusiness,
  Compass,
  FileSearch,
  GraduationCap,
  Home,
  Info,
  LayoutDashboard,
  MessageCircleWarning,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";

type NavItem = { label: string; href: string; icon: React.ReactNode; badge?: string };
type GroupId = "entreprise" | "trajectoire" | "activation";
type NavGroup = { id: GroupId; label: string; icon: React.ReactNode; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    id: "entreprise",
    label: "Entreprise",
    icon: <BriefcaseBusiness className="h-4 w-4" />,
    items: [
      { label: "Vue d'ensemble", href: "/entreprise", icon: <LayoutDashboard className="h-4 w-4" /> },
      { label: "Cadrer un besoin", href: "/entreprise/cadrage", icon: <FileSearch className="h-4 w-4" /> },
      { label: "Mes demandes", href: "/entreprise/demandes", icon: <TrendingUp className="h-4 w-4" /> },
    ],
  },
  {
    id: "trajectoire",
    label: "Formation IA",
    icon: <GraduationCap className="h-4 w-4" />,
    items: [
      { label: "Vue d'ensemble", href: "/trajectoire", icon: <LayoutDashboard className="h-4 w-4" /> },
      { label: "Demarrer", href: "/trajectoire/demarrer", icon: <FileSearch className="h-4 w-4" /> },
      { label: "Service IA", href: "/services-ia", icon: <TrendingUp className="h-4 w-4" /> },
    ],
  },
  {
    id: "activation",
    label: "Activation",
    icon: <TrendingUp className="h-4 w-4" />,
    items: [
      { label: "Service IA", href: "/services-ia", icon: <Compass className="h-4 w-4" /> },
    ],
  },
];

const HIDDEN_ON: string[] = ["/login", "/signup", "/reset", "/onboarding"];

function detectGroup(pathname: string): GroupId {
  if (pathname.startsWith("/entreprise") || pathname.includes("koryxa-enterprise")) return "entreprise";
  if (pathname.startsWith("/trajectoire")) return "trajectoire";
  if (pathname.startsWith("/chatlaya")) return "activation";
  return "trajectoire";
}

function getFabContext(pathname: string): { Icon: LucideIcon; closedClass: string; label: string } {
  if (pathname === "/") {
    return {
      Icon: Home,
      closedClass: "bg-[linear-gradient(135deg,#0284c7_0%,#0ea5e9_60%,#38bdf8_100%)] text-white",
      label: "Accueil",
    };
  }
  if (pathname.startsWith("/trajectoire")) {
    return {
      Icon: GraduationCap,
      closedClass: "bg-[linear-gradient(135deg,#4c1d95_0%,#6d28d9_55%,#a855f7_100%)] text-white",
      label: "Formation IA",
    };
  }
  if (pathname.startsWith("/entreprise")) {
    return {
      Icon: BriefcaseBusiness,
      closedClass: "bg-[linear-gradient(135deg,#0f172a_0%,#0f3b67_55%,#0284c7_100%)] text-white",
      label: "Entreprise",
    };
  }
  if (pathname.startsWith("/services-ia")) {
    return {
      Icon: Bot,
      closedClass: "bg-[linear-gradient(135deg,#14532d_0%,#047857_55%,#10b981_100%)] text-white",
      label: "Service IA",
    };
  }
  if (pathname.startsWith("/chatlaya")) {
    return {
      Icon: Sparkles,
      closedClass: "bg-[linear-gradient(135deg,#0f172a_0%,#4338ca_55%,#06b6d4_100%)] text-white",
      label: "ChatLAYA",
    };
  }
  if (pathname.startsWith("/about") || pathname.startsWith("/a-propos")) {
    return {
      Icon: Info,
      closedClass: "bg-[linear-gradient(135deg,#0f172a_0%,#1e3a8a_60%,#0284c7_100%)] text-white",
      label: "A propos",
    };
  }

  return {
    Icon: Compass,
    closedClass: "bg-[linear-gradient(135deg,#0284c7_0%,#0ea5e9_60%,#38bdf8_100%)] text-white",
    label: "Navigation",
  };
}

export default function FloatingNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<GroupId>(() => detectGroup(pathname));
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveGroup(detectGroup(pathname));
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const group = GROUPS.find((g) => g.id === activeGroup) ?? GROUPS[0];
  const fabContext = getFabContext(pathname);

  return (
    <div ref={panelRef} className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <div
        className={clsx(
          "overflow-hidden rounded-[24px] border border-white/70 bg-white/90 shadow-[0_24px_64px_rgba(15,23,42,0.18)] backdrop-blur-2xl transition-all duration-300",
          open
            ? "w-[300px] max-h-[520px] translate-y-0 opacity-100 pointer-events-auto"
            : "w-[300px] max-h-0 translate-y-3 opacity-0 pointer-events-none",
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sky-600">
              <fabContext.Icon className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold text-slate-900">Navigation • {fabContext.label}</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fermer le panneau de navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 px-3 pt-3">
          {GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setActiveGroup(g.id)}
                aria-label={`Afficher ${g.label}`}
                className={clsx(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition",
                  activeGroup === g.id
                  ? "bg-sky-600 text-white shadow-[0_4px_12px_rgba(2,132,199,0.25)]"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
              )}
            >
              {g.icon}
              <span className="hidden sm:inline">{g.label.split(" ")[0]}</span>
            </button>
          ))}
        </div>

        <div className="px-4 pb-1 pt-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{group.label}</p>
        </div>

        <nav className="px-3 pb-3">
          {group.items.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className={clsx(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition",
                  isActive ? "bg-sky-50 text-sky-700" : "text-slate-700 hover:bg-slate-50 hover:text-slate-950",
                )}
              >
                <span
                  className={clsx(
                    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition",
                    isActive
                      ? "bg-sky-100 text-sky-600"
                      : "bg-slate-100 text-slate-500 group-hover:bg-sky-50 group-hover:text-sky-600",
                  )}
                >
                  {item.icon}
                </span>
                <span className="flex-1 text-sm font-medium">{item.label}</span>
                {item.badge ? (
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-600">{item.badge}</span>
                ) : null}
                {isActive ? <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sky-500" /> : null}
              </Link>
            );
          })}
        </nav>
      </div>


      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "flex h-14 w-14 items-center justify-center rounded-full shadow-[0_8px_30px_rgba(2,132,199,0.30)] transition-all duration-200 hover:scale-105 hover:shadow-[0_12px_36px_rgba(2,132,199,0.38)]",
          open ? "rotate-45 bg-slate-900 text-white" : fabContext.closedClass,
        )}
        aria-label={open ? "Fermer la navigation" : "Ouvrir la navigation"}
      >
        {open ? <X className="h-5 w-5" /> : <fabContext.Icon className="h-6 w-6" />}
      </button>
    </div>
  );
}
