import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces } from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});
import { headers } from "next/headers";

import { AuthProvider } from "@/components/auth/AuthProvider";
import RouteShell from "@/components/layout/RouteShell";
import { ThemeProvider, themeInitScript } from "@/components/theme/ThemeProvider";
import PWARegister from "@/components/util/PWARegister";

const pwaResetScript = `
(() => {
  if (typeof window === "undefined") return;
  const unregister = async () => {
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.startsWith("innova-pwa")).map((key) => caches.delete(key)));
      }
    } catch {}
  };
  void unregister();
})();
`;

export const metadata: Metadata = {
  title: "KORYXA",
  description: "Plateforme d’orchestration IA. Transparence • Équité • Impact.",
  applicationName: "KORYXA",
  manifest: "/manifest.webmanifest",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://innovaplus.africa"),
  openGraph: {
    title: "KORYXA",
    description: "Plateforme d’orchestration IA. Transparence • Équité • Impact.",
    url: "/",
    siteName: "KORYXA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "KORYXA",
    description: "Plateforme d’orchestration IA. Transparence • Équité • Impact.",
  },
};

export default async function RootLayout(props: { children: ReactNode }) {
  const { children } = props;
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-koryxa-host") ||
    requestHeaders.get("x-forwarded-host") ||
    requestHeaders.get("host") ||
    "";
  const normalizedHost = host.split(":")[0];
  const autonomousChatlayaHost = normalizedHost === "chatlaya.innovaplus.africa";

  return (
    <html lang="fr" data-app-host={normalizedHost} className={fraunces.variable}>
      <head>
        <meta charSet="utf-8" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: pwaResetScript }} />
      </head>
      <body className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900 antialiased transition-colors duration-300">
        <a
          href="#page-content"
          className="sr-only z-50 rounded bg-slate-900 px-3 py-2 text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-16"
        >
          Aller au contenu
        </a>
        <ThemeProvider>
          <AuthProvider>
            <PWARegister />
            <RouteShell autonomousChatlayaHost={autonomousChatlayaHost}>{children}</RouteShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
