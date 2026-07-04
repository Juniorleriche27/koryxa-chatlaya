// Default to the same domain as the app unless explicitly overridden in env.
// This avoids prod breakage when api.* is not configured.
const DEFAULT_API_BASE = "https://innovaplus.africa";
const LEGACY_API_HOST = "https://api.innovaplus.africa";
export const CHATLAYA_AUTONOMOUS_HOST = "chatlaya.innovaplus.africa";

function normalize(base: string | undefined, fallback: string): string {
  const raw = (base && base.trim() ? base : fallback).replace(/\/+$/, "");
  // Safety fallback: if legacy api host has TLS issues, route through main domain.
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
    // Keep relative paths or invalid URLs unchanged.
  }
  return base;
}

export const SITE_BASE_URL = normalize(
  process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL,
  "https://innovaplus.africa",
);

export const AUTH_API_BASE = alignLoopbackHost(
  normalize(process.env.NEXT_PUBLIC_API_URL || process.env.API_URL, DEFAULT_API_BASE),
  SITE_BASE_URL,
);

export const DIRECT_AUTH_API_BASE = alignLoopbackHost(
  ((process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "https://api.innovaplus.africa").trim() || "https://api.innovaplus.africa").replace(/\/+$/, ""),
  SITE_BASE_URL,
);

function normalizeInnovaBase(authBase: string): string {
  let base = authBase.replace(/\/+$/, "");
  // If the env already contains multiple /innova/api segments, reduce to a single occurrence.
  base = base.replace(/(\/innova\/api)+$/, "/innova/api");
  if (!base.endsWith("/innova/api")) {
    base = `${base}/innova/api`;
  }
  return base;
}

export const INNOVA_API_BASE = normalizeInnovaBase(AUTH_API_BASE);
export const DIRECT_INNOVA_API_BASE = normalizeInnovaBase(DIRECT_AUTH_API_BASE);
export const CLIENT_INNOVA_API_BASE = "/innova/api";

const CHATLAYA_SOURCE_BASE = alignLoopbackHost(
  normalizeChatlayaBase(
    process.env.NEXT_PUBLIC_CHATLAYA_URL ||
      process.env.NEXT_PUBLIC_CHATLAYA_API_URL ||
      "https://api.innovaplus.africa/api",
    "https://api.innovaplus.africa/api",
  ),
  SITE_BASE_URL,
);

export const CHATLAYA_API_BASE = CHATLAYA_SOURCE_BASE.replace(/\/+$/, "");

function normalizeChatlayaBase(base: string | undefined, fallback: string): string {
  const normalized = normalize(base, fallback);
  // If Vercel is configured with only the legacy API origin, keep the live
  // ChatLAYA ownership under /api/chatlaya/* instead of falling back to /chatlaya/*.
  if (normalized === DEFAULT_API_BASE) {
    return `${DEFAULT_API_BASE}/api`;
  }
  return normalized;
}

export function getChatlayaApiBase(): string {
  if (typeof window !== "undefined" && window.location.hostname === CHATLAYA_AUTONOMOUS_HOST) {
    return "/api";
  }
  return CHATLAYA_API_BASE;
}

export const FORMATION_DATA_ANALYST_URL =
  (process.env.NEXT_PUBLIC_FORMATION_DATA_ANALYST_URL || "").trim() ||
  "https://formation.innovaplus.africa";

export const DEV_AUTO_LOGIN_ENABLED =
  (process.env.NEXT_PUBLIC_DEV_AUTO_LOGIN || "").toLowerCase() === "true";

export const IS_V1_SIMPLE =
  (process.env.NEXT_PUBLIC_V1_SIMPLE || "").toLowerCase() === "true" ||
  (process.env.NEXT_PUBLIC_APP_MODE || "").toUpperCase() === "V1";
