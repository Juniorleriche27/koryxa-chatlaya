import { FORMATION_DATA_ANALYST_URL, SITE_BASE_URL } from "@/lib/env";

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function normalizeRelativeTarget(value: string): string | null {
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function normalizeAbsoluteTarget(value: string): string | null {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function baseDomain(hostname: string): string | null {
  const clean = hostname.trim().replace(/^\./, "").toLowerCase();
  if (!clean) return null;
  const parts = clean.split(".");
  if (parts.length < 2) return clean;
  return parts.slice(-2).join(".");
}

function isAllowedAbsoluteTarget(target: URL, allowedOrigins: Set<string>): boolean {
  if (allowedOrigins.has(target.origin)) return true;
  const siteOrigin = normalizeOrigin(SITE_BASE_URL);
  if (!siteOrigin) return false;
  try {
    const siteUrl = new URL(siteOrigin);
    const siteBaseDomain = baseDomain(siteUrl.hostname);
    const targetBaseDomain = baseDomain(target.hostname);
    if (!siteBaseDomain || !targetBaseDomain) return false;
    return siteBaseDomain === targetBaseDomain;
  } catch {
    return false;
  }
}

export function getAllowedAuthRedirectOrigins(): Set<string> {
  const envOrigins = (process.env.NEXT_PUBLIC_ALLOWED_AUTH_REDIRECT_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const candidates = [SITE_BASE_URL, FORMATION_DATA_ANALYST_URL, ...envOrigins];
  const origins = new Set<string>();
  for (const candidate of candidates) {
    const origin = normalizeOrigin(candidate);
    if (origin) origins.add(origin);
  }
  return origins;
}

export function resolveSafeAuthRedirectTarget(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;

  const relative = normalizeRelativeTarget(value);
  if (relative) return relative;

  const absolute = normalizeAbsoluteTarget(value);
  if (!absolute) return fallback;

  try {
    const url = new URL(absolute);
    if (!isAllowedAbsoluteTarget(url, getAllowedAuthRedirectOrigins())) {
      return fallback;
    }
    return absolute;
  } catch {
    return fallback;
  }
}

export function isAbsoluteRedirectTarget(value: string): boolean {
  return /^https?:\/\//i.test(value);
}
