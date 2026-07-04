// innova-frontend/lib/api.ts

import { INNOVA_API_BASE } from "@/lib/env";

const API_BASE = INNOVA_API_BASE;

type JsonHeaders = HeadersInit;

async function apiFetch(input: string, init: RequestInit = {}) {
  const headers: JsonHeaders = init.headers instanceof Headers ? init.headers : { ...(init.headers ?? {}) };
  return fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

function extractErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  if (typeof record.detail === "string") return record.detail;
  if (record.detail && typeof record.detail === "object") {
    const nested = (record.detail as Record<string, unknown>).detail;
    if (typeof nested === "string") return nested;
  }
  if (typeof record.message === "string") return record.message;
  try {
    return JSON.stringify(record);
  } catch {
    return "";
  }
}

export async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: "include",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
      cache: init.cache ?? "no-store",
    });
  } catch {
    throw new Error("Impossible de contacter l'API (réseau/CORS).");
  }

  if (!res.ok) {
    let message = "";
    try {
      message = extractErrorMessage(await res.json());
    } catch {
      message = await res.text().catch(() => "");
    }
    throw new Error(message || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export async function requestJsonPath<T>(baseUrl: string, path: string, init: RequestInit = {}): Promise<T> {
  return requestJson<T>(joinUrl(baseUrl, path), init);
}

export function createJsonApi(baseUrl: string) {
  return <T>(path: string, init: RequestInit = {}) => requestJsonPath<T>(baseUrl, path, init);
}

export type Domain = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
};

export type Contributor = {
  id: string;
  project_id: string;
  user_id?: string | null;
  name?: string | null;
  role?: string | null;
  email?: string | null;
  github?: string | null;
};

export type Technology = {
  id: string;
  project_id: string;
  name?: string | null;
  version?: string | null;
};

export type Project = {
  id: string;
  name: string;
  slug: string;
  title?: string | null;
  description?: string | null;
  repo_url?: string | null;
  live_url?: string | null;
  logo_url?: string | null;
  status?: "draft" | "published" | "archived" | string | null;
  created_at?: string | null;
};

export const apiMe = {
  async upsertProfile(payload: { user_id: string; country?: string; skills?: string[]; goal?: string }) {
    const res = await apiFetch(`${API_BASE}/me/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return json<{ ok: boolean }>(res);
  },
  async recommendations(user_id: string) {
    const res = await apiFetch(`${API_BASE}/me/recommendations?user_id=${encodeURIComponent(user_id)}`, {
      cache: "no-store",
    });
    return json<Array<{ id: string; title: string; country?: string; score: number; reasons: string[] }>>(res);
  },
};

export const apiNotifications = {
  async list(user_id: string, unread_only = false) {
    const url = `${API_BASE}/notifications?user_id=${encodeURIComponent(user_id)}${unread_only ? "&unread_only=1" : ""}`;
    const res = await apiFetch(url, { cache: "no-store" });
    return json<Array<{ id: string; type: string; payload: Record<string, unknown> | null; created_at: string; read_at?: string }>>(res);
  },
  async markRead(user_id: string, ids: string[]) {
    const res = await apiFetch(`${API_BASE}/notifications/read?user_id=${encodeURIComponent(user_id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids),
    });
    return json<{ ok: boolean }>(res);
  },
};

export const apiMetrics = {
  async event(name: string, payload?: Record<string, unknown>, user_id?: string) {
    const res = await apiFetch(`${API_BASE}/metrics/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, payload, user_id }),
    });
    return json<{ ok: boolean }>(res);
  },
};

// --- Skills ---
export type SkillItem = {
  slug: string;
  label: string;
  total: number;
  certificates: number;
  users: number;
  offers: number;
};

export const apiSkills = {
  async list(): Promise<{ items: SkillItem[] }> {
    const res = await apiFetch(`${API_BASE}/skills`, { cache: "no-store" });
    return json<{ items: SkillItem[] }>(res);
  },
};

// --- Profiles / talents ---
export type PublicProfile = {
  user_id: string;
  skills: string[];
  country?: string | null;
  remote?: boolean;
  languages?: string[];
  last_active_at?: string | null;
};

export const apiProfiles = {
  async listPublic(params?: { country?: string; skill?: string; remote?: boolean; limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params?.country) query.set("country", params.country);
    if (params?.skill) query.set("skill", params.skill);
    if (params?.remote !== undefined) query.set("remote", params.remote ? "1" : "0");
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));
    const res = await apiFetch(`${API_BASE}/profiles/public?${query.toString()}`, { cache: "no-store" });
    return json<{ items: PublicProfile[]; total: number }>(res);
  },
};

// --- Meet (social feed) ---
export type MeetPost = {
  id: string;
  user_id: string;
  author?: string | null;
  text: string;
  tags: string[];
  country?: string | null;
  created_at: string;
  likes_count?: number;
  comments_count?: number;
};

export const apiMeet = {
  async create(post: { user_id: string; text: string; tags?: string[]; country?: string; author?: string }) {
    const res = await apiFetch(`${API_BASE}/meet/post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(post),
    });
    return json<{ post_id: string }>(res);
  },
  async like(payload: { post_id: string; user_id: string; action: "like" | "unlike" }) {
    const res = await apiFetch(`${API_BASE}/meet/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return json<{ ok: boolean; likes: number }>(res);
  },
  async comment(payload: { post_id: string; user_id: string; text: string; author?: string }) {
    const res = await apiFetch(`${API_BASE}/meet/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return json<{ ok: boolean; comment_id: string; comments: number }>(res);
  },
  async feed(params?: { country?: string; tags?: string[]; limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params?.country) query.set("country", params.country);
    if (params?.tags?.length) query.set("tags", params.tags.join(","));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));
    const res = await apiFetch(`${API_BASE}/meet/feed?${query.toString()}`, { cache: "no-store" });
    return json<{ items: MeetPost[]; total: number }>(res);
  },
  async comments(post_id: string) {
    const res = await apiFetch(`${API_BASE}/meet/comments?post_id=${encodeURIComponent(post_id)}`, { cache: "no-store" });
    return json<{ items: Array<{ comment_id: string; post_id: string; user_id: string; author?: string; text: string; created_at: string }> }>(res);
  },
};
