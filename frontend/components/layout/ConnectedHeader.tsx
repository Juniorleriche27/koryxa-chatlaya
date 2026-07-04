"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import LogoutButton from "@/components/auth/LogoutButton";
import BrandLogo from "@/components/layout/BrandLogo";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { CONNECTED_ROUTES, PUBLIC_ROUTES } from "@/config/routes";

type ConnectedNavLink = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
};

const CONNECTED_NAV_LINKS: ConnectedNavLink[] = [
  {
    href: PUBLIC_ROUTES.trajectoire,
    label: "Formation IA",
    match: (pathname) => pathname.startsWith(PUBLIC_ROUTES.trajectoire),
  },
  {
    href: PUBLIC_ROUTES.entreprise,
    label: "Entreprise",
    match: (pathname) => pathname.startsWith(PUBLIC_ROUTES.entreprise),
  },
  {
    href: PUBLIC_ROUTES.chatlaya,
    label: "ChatLAYA",
    match: (pathname) => pathname.startsWith(PUBLIC_ROUTES.chatlaya),
  },
  {
    href: PUBLIC_ROUTES.serviceIa,
    label: "Service IA",
    match: (pathname) => pathname.startsWith(PUBLIC_ROUTES.serviceIa),
  },
];

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

export default function ConnectedHeader() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAuthenticated = Boolean(user?.email);
  const displayName = useMemo(() => {
    const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
    return fullName || user?.email || "Compte";
  }, [user]);
  const userInitial = displayName.charAt(0).toUpperCase();
  const loginHref = `${CONNECTED_ROUTES.login}?redirect=${encodeURIComponent(pathname || CONNECTED_ROUTES.home)}`;
  const accountHref = isAuthenticated ? "/account/role" : loginHref;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950 text-white shadow-[0_18px_48px_rgba(2,6,23,0.34)]">
      <div className="mx-auto flex w-full max-w-[var(--app-max-w)] items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 lg:px-8">
        <Link href={CONNECTED_ROUTES.home} className="flex shrink-0 items-center gap-3">
          <BrandLogo className="h-10 w-10 border-white/15 shadow-[0_18px_36px_rgba(2,6,23,0.26)] sm:h-11 sm:w-11" />
          <p className="truncate text-base font-black tracking-wide">KORYXA</p>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 xl:flex">
          {CONNECTED_NAV_LINKS.map((link) => {
            const active = link.match(pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "shrink-0 whitespace-nowrap rounded-full border px-3 py-2.5 text-[0.88rem] font-semibold transition 2xl:text-[0.92rem]",
                  active
                    ? "border-sky-400/60 bg-sky-500/15 text-white"
                    : "border-transparent text-slate-200 hover:border-slate-700 hover:bg-slate-900 hover:text-white",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 xl:flex">
          <Link
            href={accountHref}
            className="inline-flex min-w-[8.75rem] items-center justify-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2.5 text-[0.88rem] font-semibold text-white transition hover:border-sky-400/60 hover:text-sky-100 2xl:min-w-[9.5rem] 2xl:text-sm"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/15 text-xs font-bold text-sky-100">
              {userInitial}
            </span>
            <span>{isAuthenticated ? "Compte" : "Se connecter"}</span>
          </Link>

          {isAuthenticated ? (
            <LogoutButton
              redirectTo={loginHref}
              className="inline-flex min-w-[8.5rem] items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-4 py-2.5 text-[0.88rem] font-semibold text-white transition hover:border-rose-400/60 hover:text-rose-100 2xl:min-w-[9rem] 2xl:text-sm"
            />
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((current) => !current)}
          className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-white xl:hidden"
          aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen ? (
        <div className="border-t border-slate-800 bg-slate-950 px-4 py-4 xl:hidden">
          <div className="mx-auto flex w-full max-w-[var(--app-max-w)] flex-col gap-2">
            <ThemeToggle variant="dark" showLabel={false} className="justify-center" />

            {CONNECTED_NAV_LINKS.map((link) => {
              const active = link.match(pathname);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    "rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                    active
                      ? "border-sky-400/60 bg-sky-500/15 text-white"
                      : "border-slate-800 bg-slate-900 text-slate-200 hover:border-sky-400/60 hover:text-white",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}

            <Link
              href={accountHref}
              onClick={() => setMobileOpen(false)}
              className="mt-2 inline-flex items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200"
            >
              {isAuthenticated ? "Compte" : "Se connecter"}
            </Link>

            {isAuthenticated ? (
              <LogoutButton
                redirectTo={loginHref}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200"
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
