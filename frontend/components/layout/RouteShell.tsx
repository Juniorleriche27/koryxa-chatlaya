"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Footer from "@/components/layout/footer";
import PublicHeader from "@/components/layout/PublicHeader";
import ConnectedHeader from "@/components/layout/ConnectedHeader";
import FloatingNav from "@/components/layout/FloatingNav";
import SignalementButton from "@/components/layout/SignalementButton";

function PublicShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isChatPage = pathname === "/chatlaya";
  const isFunnelStart =
    pathname === "/trajectoire/demarrer" ||
    pathname === "/entreprise/demarrer" ||
    pathname === "/entreprise/cadrage";

  return (
    <div className="public-shell kx-grid-backdrop relative flex min-h-screen flex-col overflow-hidden text-slate-900 transition-colors duration-300 dark:text-slate-100">
      {!isChatPage ? (
        <>
          <div aria-hidden className="kx-animated-grid pointer-events-none absolute inset-0 opacity-[0.14] dark:opacity-[0.18]" />
          <div aria-hidden className="kx-orb kx-orb-a opacity-40 dark:opacity-30" />
          <div aria-hidden className="kx-orb kx-orb-b opacity-35 dark:opacity-25" />
          <div aria-hidden className="kx-orb kx-orb-d opacity-30 dark:opacity-22" />
        </>
      ) : null}
      {!isHome ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[460px] bg-[radial-gradient(circle_at_top,rgba(186,230,253,0.58),transparent_62%)] dark:bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.26),transparent_56%)]" aria-hidden />
          <div className="pointer-events-none absolute left-[-120px] top-24 h-64 w-64 rounded-full bg-sky-200/35 blur-3xl dark:bg-sky-500/12" aria-hidden />
          <div className="pointer-events-none absolute bottom-20 right-[-80px] h-72 w-72 rounded-full bg-cyan-200/25 blur-3xl dark:bg-cyan-400/10" aria-hidden />
        </>
      ) : null}
      <PublicHeader />
      <>
        <main
          id="page-content"
          className={
            isHome
              ? "relative flex-1"
              : isChatPage
                ? "relative h-[calc(100dvh-88px)] overflow-hidden px-4 py-4 sm:px-6 sm:py-5 lg:px-8"
                : isFunnelStart
                  ? "relative flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
                  : "relative flex-1 px-4 py-10 sm:px-6 lg:px-8 lg:py-12"
          }
        >
          <div
            className={
              isHome
                ? "w-full"
                : isChatPage
                  ? "mx-auto h-full w-full max-w-[96vw] xl:max-w-[92vw]"
                  : isFunnelStart
                    ? "mx-auto w-full max-w-[96vw] xl:max-w-[92vw]"
                    : "mx-auto w-full max-w-[var(--marketing-max-w)]"
            }
          >
            {children}
          </div>
        </main>
        {isFunnelStart || isChatPage ? null : <Footer />}
      </>
      <SignalementButton />
      <FloatingNav />
    </div>
  );
}

function ConnectedShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
      <ConnectedHeader />
      <main id="page-content" className="px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[var(--app-max-w)]">{children}</div>
      </main>
      <FloatingNav />
    </div>
  );
}

export default function RouteShell({
  children,
  autonomousChatlayaHost = false,
}: {
  children: ReactNode;
  autonomousChatlayaHost?: boolean;
}) {
  const pathname = usePathname();

  if (pathname.startsWith("/entreprise/setup")) {
    return <>{children}</>;
  }

  if (pathname.startsWith("/chatlaya/auth")) {
    return <>{children}</>;
  }

  if (autonomousChatlayaHost) {
    return <>{children}</>;
  }

  return <PublicShell>{children}</PublicShell>;
}
