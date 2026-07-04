"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiNotifications } from "@/lib/api";
import { IS_V1_SIMPLE } from "@/lib/env";
import { CONNECTED_ROUTES, PUBLIC_ROUTES } from "@/config/routes";
import { useAuth } from "@/components/auth/AuthProvider";

const IS_V1 = IS_V1_SIMPLE;

const NAV_LINKS = [
  { href: PUBLIC_ROUTES.home, label: "Accueil" },
  { href: PUBLIC_ROUTES.resources, label: "Ressources & docs" },
  { href: PUBLIC_ROUTES.apropos, label: "À propos" },
  { href: PUBLIC_ROUTES.missionMatch, label: "Matching express" },
];

const NAV_LINKS_V1 = [
  { href: PUBLIC_ROUTES.home, label: "Accueil" },
  { href: PUBLIC_ROUTES.trajectoire, label: "Trajectoire" },
  { href: PUBLIC_ROUTES.entreprise, label: "Entreprise" },
  { href: PUBLIC_ROUTES.produits, label: "Produits" },
  { href: PUBLIC_ROUTES.apropos, label: "À propos" },
];

const PUBLIC_PRODUCT_LINKS = [
  { href: PUBLIC_ROUTES.serviceIa, label: "Service IA", hint: "Studio d'execution IA pour les besoins entreprise" },
];

const PRODUCT_LINKS = [
  { href: PUBLIC_ROUTES.serviceIa, label: "Service IA", hint: "Studio d'execution IA pour les besoins entreprise" },
];

const NAV_PILL_CLASS =
  "relative inline-flex min-w-[116px] justify-center rounded-full border px-4 py-2.5 text-[12px] font-semibold tracking-[-0.01em] transition-all duration-200 shadow-sm backdrop-blur whitespace-nowrap";

const CTA_PILL_CLASS =
  "inline-flex min-w-[132px] items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[12px] font-semibold tracking-[-0.01em] transition-all duration-200 shadow-sm whitespace-nowrap";

const PUBLIC_SEARCH_ACTIONS = [
  {
    href: PUBLIC_ROUTES.home,
    label: "Accueil",
    hint: "Vue d'ensemble KORYXA",
    keywords: ["home", "accueil", "koryxa"],
  },
  {
    href: PUBLIC_ROUTES.trajectoire,
    label: "Trajectoire",
    hint: "Orientation, diagnostic et progression",
    keywords: ["trajectoire", "diagnostic", "progression", "matching"],
  },
  {
    href: `${PUBLIC_ROUTES.trajectoire}/demarrer`,
    label: "Commencer mon diagnostic",
    hint: "Lancer l'onboarding et le diagnostic",
    keywords: ["commencer", "onboarding", "demarrer", "diagnostic"],
  },
  {
    href: PUBLIC_ROUTES.entreprise,
    label: "Entreprise",
    hint: "Besoin et mission",
    keywords: ["entreprise", "need", "mission"],
  },
  {
    href: `${PUBLIC_ROUTES.entreprise}/demarrer`,
    label: "Décrire un besoin entreprise",
    hint: "Lancer la qualification du besoin",
    keywords: ["deposer", "besoin", "brief", "entreprise"],
  },
  {
    href: PUBLIC_ROUTES.produits,
    label: "Produits",
    hint: "Les outils actifs de l'écosystème",
    keywords: ["produits", "tools", "outils"],
  },
  {
    href: PUBLIC_ROUTES.serviceIa,
    label: "Service IA",
    hint: "Execution IA de bout en bout",
    keywords: ["service ia", "services", "execution", "offre"],
  },
  {
    href: PUBLIC_ROUTES.apropos,
    label: "À propos",
    hint: "Mission et principes KORYXA",
    keywords: ["about", "apropos", "mission", "principes"],
  },
];

function IconSearch(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 103.6 3.6a7.5 7.5 0 0013.05 13.05z" />
    </svg>
  );
}
function IconBell(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.172V11a6 6 0 10-12 0v3.172a2 2 0 01-.6 1.428L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}
function IconMenu(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
function IconClose(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
function IconChevronDown(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
    </svg>
  );
}
function IconSparkles(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  );
}

export default function Headbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const { user, initialLoggedIn, loading, clear } = useAuth();
  const productLinks = IS_V1 ? PUBLIC_PRODUCT_LINKS : PRODUCT_LINKS;
  const navLinks = useMemo(() => {
    return IS_V1 ? NAV_LINKS_V1 : NAV_LINKS;
  }, []);
  const displayName = useMemo(() => {
    if (!user) return "";
    const parts = [user.first_name, user.last_name].filter(Boolean);
    if (parts.length) return parts.join(" ");
    return user.email ?? "";
  }, [user]);
  const userInitial = useMemo(() => (displayName ? displayName.charAt(0).toUpperCase() : "I"), [displayName]);
  const showAccount = initialLoggedIn || Boolean(user);
  const accountTitle = displayName || (loading ? "Chargement..." : "Compte");
  const accountEmail = user?.email ?? (loading ? "Connexion en cours..." : "");
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [productMenuOpen, setProductMenuOpen] = useState(false);
  const [notifCount, setNotifCount] = useState<number>(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Array<{ id: string; type: string; payload: Record<string, unknown> | null; created_at: string; read_at?: string }>>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const hideHeadbar =
    pathname.startsWith("/services-ia") ||
    pathname.startsWith("/trajectoire/demarrer") ||
    pathname.startsWith("/entreprise/demarrer") ||
    pathname.startsWith("/entreprise/cadrage");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Keyboard shortcut: '/' opens search (except when typing in inputs)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const editable = (e.target as HTMLElement)?.isContentEditable;
      if (e.key === "/" && !editable && tag !== "input" && tag !== "textarea") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setAccountOpen(false);
        setDrawerOpen(false);
        setNotifOpen(false);
        setProductMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setProductMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!searchOpen) {
      setSearchQuery("");
    }
  }, [searchOpen]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return PUBLIC_SEARCH_ACTIONS.slice(0, 6);
    }
    return PUBLIC_SEARCH_ACTIONS.filter((item) => {
      const haystack = [item.label, item.hint, ...item.keywords].join(" ").toLowerCase();
      return haystack.includes(q);
    }).slice(0, 6);
  }, [searchQuery]);

  function openSearchResult(href: string) {
    setSearchOpen(false);
    setSearchQuery("");
    router.push(href);
  }

  // Try to fetch notifications count if backend exposes it
  useEffect(() => {
    if (!showAccount) return;
    const userId = user?.id ?? "demo-user";
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    const run = () => {
      apiNotifications
        .list(userId, true)
        .then((items) => {
          if (!active) return;
          setNotifs(items);
          setNotifCount(items.length);
        })
        .catch(() => void 0);
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = (window as Window & { requestIdleCallback: (cb: IdleRequestCallback) => number }).requestIdleCallback(() => run());
    } else if (typeof window !== "undefined") {
      timeoutId = setTimeout(run, 250);
    } else {
      run();
    }

    return () => {
      active = false;
      if (typeof window !== "undefined" && idleId !== null && "cancelIdleCallback" in window) {
        (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [showAccount, user]);

  // Mark notifications as read when opening the dropdown
  useEffect(() => {
    if (!notifOpen || !showAccount) return;
    const unreadIds = notifs.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) return;
    const userId = user?.id ?? "demo-user";
    apiNotifications
      .markRead(userId, unreadIds)
      .then(() => {
        setNotifs((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
        setNotifCount(0);
      })
      .catch(() => void 0);
  }, [notifOpen, notifs, showAccount, user]);

  if (hideHeadbar) {
    return null;
  }

  return (
    <header
      className={clsx(
        "sticky top-0 z-40 transition-all duration-300",
        scrolled 
          ? "border-b border-white/80 bg-[rgba(247,250,252,0.88)] backdrop-blur-2xl shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto w-full max-w-[1680px] px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between gap-3 py-3 sm:gap-4 sm:py-4">
          {/* Left: Brand */}
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-gradient-to-br from-slate-950 via-sky-900 to-sky-500 shadow-[0_18px_34px_rgba(2,132,199,0.24)] transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_22px_40px_rgba(2,132,199,0.28)]">
                  <span className="text-white font-semibold text-xs">{IS_V1 ? "K" : "AI"}</span>
                </div>
                <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-400 ring-4 ring-white/80" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-base font-black tracking-[-0.04em] text-slate-950 transition-colors group-hover:text-sky-700 sm:text-lg">
                  KORYXA
                </p>
                <div className="hidden items-center gap-2 rounded-full border border-white/80 bg-white/72 px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur md:inline-flex">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="whitespace-nowrap">
                    {IS_V1 ? "Trajectoires & missions réelles" : "Intelligence Artificielle • Transparence • Équité"}
                  </span>
                </div>
              </div>
            </Link>
          </div>

          {/* Center: Nav */}
          <nav className="ml-4 hidden flex-1 items-center gap-2 whitespace-nowrap md:flex md:overflow-x-auto md:overflow-y-visible lg:ml-6 lg:overflow-visible">
            {navLinks.map((link) => {
              const isProductsLink = link.href === PUBLIC_ROUTES.produits;
              const active = isProductsLink
                ? pathname.startsWith(PUBLIC_ROUTES.produits) || productLinks.some((item) => pathname.startsWith(item.href))
                : link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              if (isProductsLink) {
                return (
                  <div key={link.href} className="relative">
                    <button
                      type="button"
                      onClick={() => setProductMenuOpen((prev) => !prev)}
                      className={clsx(
                        NAV_PILL_CLASS,
                        active || productMenuOpen
                          ? "border-sky-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(224,242,254,0.96))] text-sky-700 shadow-[0_10px_24px_rgba(14,165,233,0.14)]"
                          : "border-white/80 bg-white/62 text-slate-600 hover:-translate-y-0.5 hover:border-sky-200 hover:bg-white/88 hover:text-sky-700"
                      )}
                    >
                      {link.label}
                      <IconChevronDown className={clsx("ml-1 h-3 w-3 transition-transform", productMenuOpen && "rotate-180")} />
                      {(active || productMenuOpen) && (
                        <div className="absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-sky-500" />
                      )}
                    </button>
                    {productMenuOpen && (
                      <div className="absolute left-0 top-full z-50 mt-2 w-[360px] rounded-3xl border border-slate-200/70 bg-white/98 p-4 shadow-2xl shadow-slate-900/10 backdrop-blur-xl">
                        <div className="pb-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Produits KORYXA</p>
                          <p className="text-xs text-slate-500">Les outils visibles de l'écosystème KORYXA.</p>
                        </div>
                        <div className="grid gap-3">
                          {productLinks.map((item) => (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setProductMenuOpen(false)}
                              className="rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-4 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-lg"
                            >
                              <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                              <p className="mt-1 text-[11px] leading-snug text-slate-500">{item.hint}</p>
                              <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700">
                                Ouvrir
                                <IconChevronDown className="h-3 w-3 -rotate-90" />
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    NAV_PILL_CLASS,
                    active 
                      ? "border-sky-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(224,242,254,0.96))] text-sky-700 shadow-[0_10px_24px_rgba(14,165,233,0.14)]"
                      : "border-white/80 bg-white/62 text-slate-600 hover:-translate-y-0.5 hover:border-sky-200 hover:bg-white/88 hover:text-sky-700"
                  )}
                >
                  {link.label}
                  {active && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-sky-500" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Search */}
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Recherche"
              className="group relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-white/68 text-slate-600 shadow-sm backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:bg-white hover:text-sky-600"
            >
              <IconSearch className="h-4 w-4" />
              <div className="absolute -bottom-1 -right-1 text-[10px] text-slate-400 font-mono">/</div>
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                aria-label="Notifications"
                className="group relative hidden h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-white/68 text-slate-600 shadow-sm backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:bg-white hover:text-sky-600 sm:inline-flex"
              >
                <IconBell className="h-4 w-4" />
                {notifCount > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-pink-500 text-[10px] font-bold text-white shadow-lg">
                    {Math.min(notifCount, 9)}
                  </span>
                )}
              </button>
              
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200/60 bg-white/95 backdrop-blur-xl p-4 shadow-xl shadow-slate-900/10">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                    <button
                      onClick={() => setNotifOpen(false)}
                      className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <IconClose className="h-4 w-4 text-slate-400" />
                    </button>
                  </div>
                  
                  {notifs.length === 0 ? (
                    <div className="text-center py-6">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                        <IconBell className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-sm text-slate-500">Aucune notification</p>
                    </div>
	                  ) : (
	                    <div className="max-h-80 overflow-y-auto space-y-2">
	                      {notifs.map((n) => (
	                        <div key={n.id} className="rounded-xl p-3 hover:bg-slate-50 transition-colors">
	                          <div className="flex items-start gap-3">
	                            <div className="w-2 h-2 rounded-full bg-sky-500 mt-2 flex-shrink-0" />
	                            <div className="flex-1 min-w-0">
	                              <p className="text-sm font-medium text-slate-900">{n.type}</p>
	                              <p className="text-xs text-slate-500 mt-1">
	                                {typeof n.payload?.title === "string"
	                                  ? n.payload.title
	                                  : typeof n.payload?.message === "string"
	                                    ? n.payload.message
	                                    : "—"}
	                              </p>
	                              <p className="text-xs text-slate-400 mt-1">
	                                {new Date(n.created_at).toLocaleDateString("fr-FR")}
	                              </p>
	                            </div>
	                          </div>
	                        </div>
	                      ))}
	                    </div>
	                  )}
                </div>
              )}
            </div>

            {/* Auth controls */}
            {showAccount ? (
              <div className="relative">
                <button
                  onClick={() => setAccountOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                  className="group flex items-center gap-2 rounded-full bg-slate-950 px-3.5 py-2 text-xs font-semibold text-white shadow-[0_14px_28px_rgba(15,23,42,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-900"
                >
                  <div className="w-6 h-6 rounded-full bg-sky-500 flex items-center justify-center text-xs font-bold">
                    {userInitial}
                  </div>
                  <span className="hidden sm:block">ME</span>
                  <IconChevronDown className="h-3 w-3 hidden sm:block" />
                </button>
                
                {accountOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200/60 bg-white/95 backdrop-blur-xl p-2 shadow-xl shadow-slate-900/10">
                    <div className="px-3 py-2 border-b border-slate-200/60 mb-2">
                      <p className="text-sm font-medium text-slate-900">
                        {accountTitle}
                      </p>
                      <p className="text-xs text-slate-500">{accountEmail}</p>
                    </div>
                    <Link 
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors" 
                      href="/account/role"
                      onClick={() => setAccountOpen(false)}
                    >
                      <IconSparkles className="h-4 w-4" />
                      Compte
                    </Link>
                    <button 
                      onClick={() => { 
                        setAccountOpen(false); 
                        clear();
                        location.href = "/logout";
                      }} 
                  className="flex items-center gap-2 w-full rounded-xl px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <IconClose className="h-4 w-4" />
                      Déconnexion
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href={CONNECTED_ROUTES.login}
                  prefetch={false}
                    className={clsx(CTA_PILL_CLASS, "hidden sm:inline-flex border border-white/80 bg-white/72 text-slate-700 backdrop-blur hover:-translate-y-0.5 hover:border-sky-200 hover:bg-white hover:text-sky-700")}
                >
                  Se connecter
                </Link>
                <Link
                  href={CONNECTED_ROUTES.signup}
                  prefetch={false}
                    className={clsx(CTA_PILL_CLASS, "bg-[linear-gradient(135deg,#0f172a,#0284c7_58%,#38bdf8)] text-white shadow-[0_16px_30px_rgba(2,132,199,0.24)] hover:-translate-y-0.5 hover:brightness-105")}
                >
                  <IconSparkles className="h-4 w-4" />
                  Créer un compte
                </Link>
              </div>
            )}

            {/* CTA Buttons */}
            {!IS_V1 && (
              <div className="hidden lg:flex items-center gap-2">
                <Link 
                  href="/missions/new" 
                  className={clsx(
                    CTA_PILL_CLASS,
                    "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 hover:border-emerald-300 hover:-translate-y-0.5"
                  )}
                >
                  <IconSparkles className="h-4 w-4" />
                  Poster un besoin
                </Link>
                <div className="relative">
                  <button
                    onClick={() => setProductMenuOpen((v) => !v)}
                    className={clsx(
                      CTA_PILL_CLASS,
                      "text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:-translate-y-0.5"
                    )}
                  >
                    Produits
                    <IconChevronDown className={clsx("h-3 w-3 transition-transform", productMenuOpen && "rotate-180")} />
                  </button>
                  {productMenuOpen && (
                    <div className="absolute right-0 mt-2 w-[440px] rounded-3xl border border-slate-200/70 bg-white/98 backdrop-blur-xl p-4 shadow-2xl shadow-slate-900/10">
                      <div className="flex items-center justify-between pb-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Portefeuille</p>
                          <p className="text-xs text-slate-500">Verticales IA prêtes à déployer</p>
                        </div>
                        <span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700">KORYXA Suite</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {productLinks.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setProductMenuOpen(false)}
                            className="rounded-2xl border border-slate-100 bg-slate-50/60 px-3 py-3 shadow-sm hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-lg transition"
                          >
                            <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                            <p className="text-[11px] text-slate-500 leading-snug">{item.hint}</p>
                            <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700">
                              Découvrir
                              <IconChevronDown className="h-3 w-3 -rotate-90" />
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mobile menu */}
            {/* Mobile compact actions */}
            <div className="flex items-center gap-1.5 md:hidden">
              <button
                onClick={() => setSearchOpen(true)}
                aria-label="Rechercher"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-sky-300 hover:text-sky-600 transition-all duration-200"
              >
                <IconSearch className="h-4 w-4" />
              </button>
              {!IS_V1 && (
                <Link
                  href={PUBLIC_ROUTES.produits}
                  className="rounded-full border border-white/80 bg-white/72 px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur"
                >
                  Produits
                </Link>
              )}
              <Link
                href={CONNECTED_ROUTES.login}
                className="hidden sm:inline-flex rounded-full border border-white/80 bg-white/72 px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur"
              >
                Connexion
              </Link>
              <Link
                href={CONNECTED_ROUTES.signup}
                className="hidden sm:inline-flex rounded-full bg-[linear-gradient(135deg,#0f172a,#0284c7_58%,#38bdf8)] px-3 py-2 text-[11px] font-semibold text-white shadow-[0_14px_24px_rgba(2,132,199,0.22)]"
              >
                Créer
              </Link>
              <button
                onClick={() => setDrawerOpen(true)}
                aria-label="Ouvrir le menu"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-white/68 text-slate-600 shadow-sm backdrop-blur transition-all duration-200 hover:border-sky-300 hover:bg-white hover:text-sky-600"
              >
                <IconMenu className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setSearchOpen(false)}>
          <div
            className="container mx-auto max-w-2xl p-4 pt-20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-2xl border border-slate-200/60 bg-white/95 backdrop-blur-xl p-6 shadow-2xl">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (searchResults[0]) {
                    openSearchResult(searchResults[0].href);
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <IconSearch className="h-5 w-5 text-slate-400" />
                  <input
                    autoFocus
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={IS_V1 ? "Rechercher une page, un produit ou une action" : "Rechercher compétences, pays..."}
                    className="h-11 w-full rounded-xl border-none text-sm text-slate-700 outline-none placeholder:text-slate-400 bg-transparent"
                  />
                  <button
                    onClick={() => setSearchOpen(false)}
                    aria-label="Fermer"
                    type="button"
                    className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <IconClose className="h-5 w-5 text-slate-400" />
                  </button>
                </div>
              </form>
              <div className="mt-4 grid gap-2">
                {searchResults.length ? (
                  searchResults.map((item) => (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => openSearchResult(item.href)}
                      className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-left transition hover:border-sky-200 hover:bg-white"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{item.hint}</p>
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">
                        Ouvrir
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    Aucun résultat pour cette recherche.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" aria-modal="true" role="dialog">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-80 max-w-[85%] bg-white/95 backdrop-blur-xl p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <Link href="/" onClick={() => setDrawerOpen(false)} className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-sm">{IS_V1 ? "K" : "AI"}</span>
                </div>
                <span className="text-lg font-semibold text-slate-900">KORYXA</span>
              </Link>
              <button 
                aria-label="Fermer" 
                onClick={() => setDrawerOpen(false)} 
                className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <IconClose className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            
            <nav className="flex flex-col gap-2 mb-6">
              {navLinks.map((link) => {
                const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
                return (
                  <Link 
                    key={link.href} 
                    href={link.href} 
                    onClick={() => setDrawerOpen(false)} 
                    className={clsx(
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-slate-700 transition-all duration-200",
                      active 
                        ? "bg-sky-50 text-sky-700 border border-sky-200" 
                        : "hover:bg-slate-50"
                    )}
                  >
                    <div className={clsx(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      active ? "bg-sky-100 text-sky-600" : "bg-slate-100 text-slate-500"
                    )}>
                      <IconSparkles className="h-4 w-4" />
                    </div>
                    {link.label}
                  </Link>
                );
              })}
            </nav>

              {IS_V1 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-600">Produits KORYXA</p>
                    <span className="rounded-full bg-sky-100 px-2 py-1 text-[11px] font-semibold text-sky-700">Actifs</span>
                  </div>
                  <div className="space-y-2">
                    {productLinks.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setDrawerOpen(false)}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-sky-200 hover:text-sky-700"
                      >
                        <span>{item.label}</span>
                        <IconChevronDown className="h-3 w-3 -rotate-90" />
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-slate-600">Produits KORYXA</p>
                  <span className="rounded-full bg-sky-100 px-2 py-1 text-[11px] font-semibold text-sky-700">Suite</span>
                </div>
                <div className="space-y-2">
                  {productLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setDrawerOpen(false)}
                      className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm font-medium text-slate-700 border border-slate-200 hover:border-sky-200 hover:text-sky-700"
                    >
                      <span>{item.label}</span>
                      <IconChevronDown className="h-3 w-3 -rotate-90" />
                    </Link>
                  ))}
                </div>
                </div>
              )}
            
            <div className="space-y-3">
              {IS_V1 ? (
                <Link 
                  href={PUBLIC_ROUTES.entreprise} 
                  onClick={() => setDrawerOpen(false)} 
                  className="flex items-center gap-2 w-full rounded-xl px-4 py-3 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 transition-colors"
                >
                  <IconSparkles className="h-4 w-4" />
                  Activer un besoin
                </Link>
              ) : (
                <>
                  <Link 
                    href={PUBLIC_ROUTES.serviceIa} 
                    onClick={() => setDrawerOpen(false)} 
                    className="flex items-center gap-2 w-full rounded-xl px-4 py-3 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <IconSparkles className="h-4 w-4" />
                    SERVICE IA
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </header>
  );
}
