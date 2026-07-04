import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveSafeAuthRedirectTarget } from "@/lib/auth-redirect";

const PROTECTED_PATHS = [
  "/analytics",
];

function isProtectedPath(pathname: string) {
  return PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

const SESSION_COOKIE = "innova_session";
const SITE_BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://innovaplus.africa").replace(/\/+$/, "");
const LEGACY_API_HOST = "https://api.innovaplus.africa";
const DEFAULT_API_BASE = "https://innovaplus.africa";

function normalizeApiBase(base: string): string {
  const raw = base.replace(/\/+$/, "");
  // Keep middleware aligned with frontend env fallback when legacy api host TLS fails.
  if (raw.startsWith(LEGACY_API_HOST)) {
    return raw.replace(LEGACY_API_HOST, DEFAULT_API_BASE);
  }
  return raw;
}

function alignLoopbackHost(base: string, siteBase: string): string {
  try {
    const baseUrl = new URL(base);
    const siteUrl = new URL(siteBase);
    const loopbackHosts = new Set(["localhost", "127.0.0.1"]);
    if (loopbackHosts.has(baseUrl.hostname) && loopbackHosts.has(siteUrl.hostname) && baseUrl.hostname !== siteUrl.hostname) {
      baseUrl.hostname = siteUrl.hostname;
      return baseUrl.toString().replace(/\/+$/, "");
    }
  } catch {
    // Keep invalid URLs unchanged.
  }
  return base;
}

const AUTH_API_BASE = normalizeApiBase(
  alignLoopbackHost(
    (process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || DEFAULT_API_BASE).replace(/\/+$/, ""),
    SITE_BASE_URL,
  ),
);

function normalizeInnovaBase(base: string) {
  let clean = base.replace(/\/+$/, "");
  clean = clean.replace(/(\/innova\/api)+$/, "/innova/api");
  if (!clean.endsWith("/innova/api")) {
    clean = `${clean}/innova/api`;
  }
  return clean;
}

const INNOVA_API_BASE = normalizeInnovaBase(AUTH_API_BASE);

const PLATFORM_REDIRECTS: Array<{ from: string; to: string }> = [
  { from: "/platform/trajectoire", to: "/trajectoire" },
  { from: "/platform/entreprise", to: "/entreprise" },
  { from: "/platform/chatlaya", to: "/services-ia" },
  { from: "/platform/opportunites", to: "/opportunites" },
  { from: "/platform/missions", to: "/opportunites" },
  { from: "/platform/communaute", to: "/opportunites" },
  { from: "/platform/messages", to: "/services-ia" },
  { from: "/platform/formateurs", to: "/" },
  { from: "/platform/profil", to: "/account/role" },
  { from: "/platform/notifications", to: "/" },
  { from: "/platform/parametres", to: "/account/role" },
  { from: "/platform/talents", to: "/opportunites" },
  { from: "/platform", to: "/" },
];

function mapLegacyPlatformPath(pathname: string): string | null {
  for (const entry of PLATFORM_REDIRECTS) {
    if (pathname === entry.from || pathname.startsWith(`${entry.from}/`)) {
      return pathname.replace(entry.from, entry.to);
    }
  }
  return null;
}

function getCookieDomain(siteBase: string): string | null {
  try {
    const host = new URL(siteBase).hostname.replace(/^\./, "");
    if (!host || host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) {
      return null;
    }
    return host.includes(".") ? `.${host}` : null;
  } catch {
    return null;
  }
}

function buildClearSessionCookieHeader(domain?: string | null): string {
  const secure = SITE_BASE_URL.startsWith("https://");
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "SameSite=Lax",
  ];
  if (domain) parts.push(`Domain=${domain}`);
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function appendSessionClearHeaders(response: NextResponse) {
  response.headers.append("Set-Cookie", buildClearSessionCookieHeader(undefined));
  const domain = getCookieDomain(SITE_BASE_URL);
  if (domain) {
    response.headers.append("Set-Cookie", buildClearSessionCookieHeader(domain));
  }
}

const CONNECTED_AUTH_REQUIRED_PREFIXES = [
  "/account",
  "/onboarding",
];

function requiresConnectedAuth(pathname: string) {
  return CONNECTED_AUTH_REQUIRED_PREFIXES.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function getLoginPath(pathname: string): "/login" {
  void pathname;
  return "/login";
}

function getSafeRedirectTarget(value: string | null, fallback: string): string {
  return resolveSafeAuthRedirectTarget(value, fallback);
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const cookieHeader = request.headers.get("cookie") || "";
  if (!cookieHeader) return false;
  try {
    const res = await fetch(`${INNOVA_API_BASE}/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}
const V1_SIMPLE =
  (process.env.NEXT_PUBLIC_V1_SIMPLE || "").toLowerCase() === "true" ||
  (process.env.NEXT_PUBLIC_APP_MODE || "").toUpperCase() === "V1";

const V1_HIDDEN_PREFIXES = [
  "/skills",
  "/talents",
  "/engine",
  "/meet",
  "/missions",
  "/marketplace",
  "/studio",
  "/equity",
  "/analytics",
  "/projects",
  "/notifications",
  "/messages",
  "/post",
  "/posts",
  "/groups",
];

const V1_PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/logout",
  "/trajectoire",
  "/entreprise",
  "/community",
  "/communaute",
  "/formateurs",
  "/talents",
  "/about",
  "/a-propos",
  "/products",
  "/produits",
  "/contact",
  "/services-ia",
  "/chatlaya",
  "/resources",
  "/privacy",
  "/terms",
  "/bientot",
];

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const legacyPlatformTarget = mapLegacyPlatformPath(pathname);
  if (legacyPlatformTarget) {
    const url = request.nextUrl.clone();
    url.pathname = legacyPlatformTarget;
    return NextResponse.redirect(url, 308);
  }
  if (pathname === "/logout" || pathname.startsWith("/logout/")) {
    return NextResponse.next();
  }
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE));
  let sessionChecked = false;
  let sessionValid = false;

  const ensureSessionValid = async () => {
    if (!sessionChecked) {
      sessionValid = await hasValidSession(request);
      sessionChecked = true;
    }
    return sessionValid;
  };

  if (V1_SIMPLE) {
    const isPublic = V1_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    const forceAuth = requiresConnectedAuth(pathname);
    const allowAnonymous = isPublic && !forceAuth;

    if (!hasSession && !allowAnonymous) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = getLoginPath(pathname);
      loginUrl.searchParams.set(
        "redirect",
        pathname + (searchParams.toString() ? `?${searchParams}` : "")
      );
      return NextResponse.redirect(loginUrl);
    }
    if (hasSession && !allowAnonymous) {
      const ok = await ensureSessionValid();
      if (!ok) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = getLoginPath(pathname);
        loginUrl.searchParams.set(
          "redirect",
          pathname + (searchParams.toString() ? `?${searchParams}` : "")
        );
        const res = NextResponse.redirect(loginUrl);
        appendSessionClearHeaders(res);
        return res;
      }
    }
    if (V1_HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
      const url = request.nextUrl.clone();
      url.pathname = "/bientot";
      return NextResponse.redirect(url);
    }
  }

  if (pathname === "/chat-laya" || pathname.startsWith("/chat-laya/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace("/chat-laya", "/services-ia");
    return NextResponse.redirect(url, 308);
  }
  if (
    pathname === "/community/messages" ||
    pathname.startsWith("/community/messages/") ||
    pathname === "/communaute/messages" ||
    pathname.startsWith("/communaute/messages/")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/services-ia";
    return NextResponse.redirect(url, 308);
  }
  if (
    pathname === "/community" ||
    pathname.startsWith("/community/") ||
    pathname === "/communaute" ||
    pathname.startsWith("/communaute/")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/opportunites";
    return NextResponse.redirect(url, 308);
  }
  if (pathname === "/a-propos") {
    const url = request.nextUrl.clone();
    url.pathname = "/about";
    return NextResponse.rewrite(url);
  }
  if (pathname === "/ressources") {
    const url = request.nextUrl.clone();
    url.pathname = "/resources";
    return NextResponse.rewrite(url);
  }

  if (isProtectedPath(pathname) && !hasSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = getLoginPath(pathname);
    loginUrl.searchParams.set(
      "redirect",
      pathname + (searchParams.toString() ? `?${searchParams}` : "")
    );
    return NextResponse.redirect(loginUrl);
  }
  if (isProtectedPath(pathname) && hasSession) {
    const ok = await ensureSessionValid();
    if (!ok) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = getLoginPath(pathname);
      loginUrl.searchParams.set(
        "redirect",
        pathname + (searchParams.toString() ? `?${searchParams}` : "")
      );
      const res = NextResponse.redirect(loginUrl);
      appendSessionClearHeaders(res);
      return res;
    }
  }

  if (requiresConnectedAuth(pathname) && !hasSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = getLoginPath(pathname);
    loginUrl.searchParams.set(
      "redirect",
      pathname + (searchParams.toString() ? `?${searchParams}` : "")
    );
    return NextResponse.redirect(loginUrl);
  }
  if (requiresConnectedAuth(pathname) && hasSession) {
    const ok = await ensureSessionValid();
    if (!ok) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = getLoginPath(pathname);
      loginUrl.searchParams.set(
        "redirect",
        pathname + (searchParams.toString() ? `?${searchParams}` : "")
      );
      const res = NextResponse.redirect(loginUrl);
      appendSessionClearHeaders(res);
      return res;
    }
  }

  if (
    pathname === "/login" ||
    pathname === "/signup"
  ) {
    if (!hasSession) {
      return NextResponse.next();
    }
    const ok = await ensureSessionValid();
    if (ok) {
      const redirectTarget = getSafeRedirectTarget(
        searchParams.get("redirect") || searchParams.get("next"),
        "/",
      );
      const redirectUrl = redirectTarget.startsWith("http://") || redirectTarget.startsWith("https://")
        ? new URL(redirectTarget)
        : request.nextUrl.clone();
      if (!redirectTarget.startsWith("http://") && !redirectTarget.startsWith("https://")) {
        redirectUrl.pathname = redirectTarget;
        redirectUrl.search = "";
      }
      return NextResponse.redirect(redirectUrl);
    }
    const res = NextResponse.next();
    appendSessionClearHeaders(res);
    return res;
  }

  const res = NextResponse.next();
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self' https:; frame-ancestors 'self'; object-src 'none'; base-uri 'self';";
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: [
    "/((?!_next|.*\\..*).*)",
  ],
};
