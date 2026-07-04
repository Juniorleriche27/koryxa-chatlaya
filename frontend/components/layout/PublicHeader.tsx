"use client";

import type { SVGProps } from "react";
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { UserCircle } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import LogoutButton from "@/components/auth/LogoutButton";
import BrandLogo from "@/components/layout/BrandLogo";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { CONNECTED_ROUTES, PUBLIC_ROUTES } from "@/config/routes";

type PublicNavLink = {
  href: string;
  label: string;
};

const PUBLIC_NAV_LINKS: PublicNavLink[] = [
  { href: PUBLIC_ROUTES.home, label: "Accueil" },
  { href: PUBLIC_ROUTES.trajectoire, label: "Formation IA" },
  { href: PUBLIC_ROUTES.entreprise, label: "Entreprise" },
  { href: PUBLIC_ROUTES.chatlaya, label: "ChatLAYA" },
  { href: PUBLIC_ROUTES.serviceIa, label: "Service IA" },
  { href: PUBLIC_ROUTES.apropos, label: "A propos" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === PUBLIC_ROUTES.home) return pathname === PUBLIC_ROUTES.home;
  if (href === PUBLIC_ROUTES.entreprise) return pathname.startsWith(PUBLIC_ROUTES.entreprise);
  return pathname === href || pathname.startsWith(`${href}/`);
}

function IconMenu(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function IconClose(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export default function PublicHeader() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isHome = pathname === PUBLIC_ROUTES.home;
  const isAuthenticated = Boolean(user?.email);
  const isStartChooser = pathname === PUBLIC_ROUTES.demarrer;
  const isFunnelStart =
    pathname === `${PUBLIC_ROUTES.trajectoire}/demarrer` || pathname === `${PUBLIC_ROUTES.entreprise}/demarrer`;
  const nextPublicStep = pathname.startsWith(PUBLIC_ROUTES.entreprise)
    ? `${PUBLIC_ROUTES.entreprise}/demarrer`
    : `${PUBLIC_ROUTES.trajectoire}/demarrer`;
  const signupTarget = isFunnelStart ? pathname || nextPublicStep : nextPublicStep;
  const loginHref = `${CONNECTED_ROUTES.login}?redirect=${encodeURIComponent(pathname || PUBLIC_ROUTES.home)}`;
  const primaryHref =
    isStartChooser
      ? PUBLIC_ROUTES.demarrer
      : pathname.startsWith(PUBLIC_ROUTES.trajectoire) || pathname.startsWith(PUBLIC_ROUTES.entreprise)
        ? `${CONNECTED_ROUTES.signup}?redirect=${encodeURIComponent(signupTarget)}`
        : PUBLIC_ROUTES.demarrer;
  const primaryLabel = isFunnelStart ? "Creer mon acces" : "Demarrer";
  const showPrimaryCta = !isAuthenticated && !isFunnelStart && !isStartChooser;

  return (
    <header
      className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl transition-colors"
    >
      <div className="mx-auto flex w-full max-w-[var(--marketing-max-w)] items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
        <Link href={PUBLIC_ROUTES.home} className="flex shrink-0 items-center gap-3">
          <BrandLogo className="h-10 w-10 rounded-2xl sm:h-12 sm:w-12" />
          <p className="kx-display text-[1.3rem] font-semibold leading-none tracking-[-0.06em] text-slate-900 sm:text-[1.55rem]">
            KORYXA
          </p>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 xl:flex">
          {PUBLIC_NAV_LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "relative shrink-0 whitespace-nowrap px-3 py-2.5 text-[0.95rem] font-semibold tracking-[-0.02em] transition-colors 2xl:px-4 2xl:text-[1.05rem]",
                  active
                    ? "text-sky-600"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                {link.label}
                {active && (
                  <span className="absolute bottom-0 left-4 right-4 h-[2.5px] rounded-full bg-gradient-to-r from-sky-500 to-sky-400" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 xl:flex 2xl:gap-3">
          {!isAuthenticated ? (
            <Link
              href={loginHref}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-[0.9rem] font-semibold text-slate-700 transition hover:border-sky-400 hover:text-sky-600 2xl:px-5 2xl:text-[0.95rem]"
            >
              <UserCircle className="h-4 w-4" />
              Se connecter
            </Link>
          ) : (
            <>
              <Link
                href="/account/role"
                className="inline-flex items-center gap-2.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-[0.88rem] font-semibold text-slate-700 shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition hover:border-sky-200 hover:shadow-[0_4px_14px_rgba(2,132,199,0.12)] hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 2xl:text-[0.92rem]"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-[0.7rem] font-bold text-white shadow-sm">
                  {user?.email?.[0]?.toUpperCase() ?? "?"}
                </span>
                Compte
              </Link>
              <LogoutButton
                redirectTo={pathname}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[0.88rem] font-medium text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:text-slate-500 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
              />
            </>
          )}

          {showPrimaryCta ? (
            <Link
              href={primaryHref}
                className="inline-flex min-w-[8.5rem] shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#082f49_0%,#0284c7_52%,#38bdf8_100%)] px-4 py-3 text-[0.88rem] font-semibold text-white shadow-[0_18px_40px_rgba(2,132,199,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_48px_rgba(2,132,199,0.3)] 2xl:min-w-[9rem] 2xl:px-5 2xl:text-[0.92rem]"
            >
              {primaryLabel}
            </Link>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((current) => !current)}
          className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/92 text-slate-700 xl:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen ? (
        <div className="border-t border-slate-200/80 bg-white/98 px-4 py-4 xl:hidden">
          <div className="mx-auto flex w-full max-w-[var(--marketing-max-w)] flex-col gap-2">
            <ThemeToggle showLabel={false} className="justify-center" />

            {PUBLIC_NAV_LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    "rounded-2xl border px-5 py-3.5 text-[1rem] font-semibold tracking-[-0.02em] transition",
                    active
                      ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/50 dark:bg-sky-500/15 dark:text-sky-100"
                      : "border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-sky-400/60 dark:hover:text-sky-100",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}

            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {!isAuthenticated ? (
                <Link
                  href={loginHref}
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[0.95rem] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <UserCircle className="h-4 w-4" />
                  Se connecter
                </Link>
              ) : (
                <>
                  <Link
                    href="/account/role"
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[0.95rem] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-[0.7rem] font-bold text-white">
                      {user?.email?.[0]?.toUpperCase() ?? "?"}
                    </span>
                    Compte
                  </Link>
                  <LogoutButton
                    redirectTo={pathname}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-[0.95rem] font-semibold text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300"
                  />
                </>
              )}

              {showPrimaryCta ? (
                <Link
                  href={primaryHref}
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#082f49_0%,#0284c7_52%,#38bdf8_100%)] px-4 py-3 text-sm font-semibold text-white sm:col-span-2"
                >
                  {primaryLabel}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

