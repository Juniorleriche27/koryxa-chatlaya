import { createJsonApi } from "@/lib/api";
import { INNOVA_API_BASE } from "@/lib/env";

const request = createJsonApi(`${INNOVA_API_BASE}/missions`);

export type MissionPayload = {
  title: string;
  description: string;
  deliverables: string;
  deadline?: string;
  duration_days?: number;
  budget: { minimum?: number | null; maximum?: number | null; currency?: string };
  language: string;
  work_mode: "remote" | "local" | "hybrid";
  allow_expansion: boolean;
  collect_multiple_quotes: boolean;
  location_hint?: string | null;
};

export type MissionDetail = {
  mission_id: string;
  title: string;
  status: string;
  ai?: { summary?: string; keywords?: string[]; deliverables?: string[] };
  deliverables: string;
  deadline?: string;
  budget?: { minimum?: number; maximum?: number; currency?: string };
  offers?: Array<{ offer_id: string; prestataire_id: string; status: string; wave: number; message: string; expires_at?: string; scores?: Record<string, number> }>;
  messages?: Array<{ id: string; author_id: string; role: string; text: string; created_at: string }>;
  milestones?: Array<{ id: string; title: string; status: "todo" | "in_progress" | "delivered" | "validated"; due_date?: string; notes?: string }>;
  events?: Array<{ type: string; ts: string; payload?: Record<string, unknown> }>;
};

type MissionMilestonePayload = {
  title: string;
  due_date?: string;
  notes?: string;
};

type MilestoneUpdatePayload = {
  status: "todo" | "in_progress" | "delivered" | "validated";
  notes?: string;
};

type MissionClosePayload = {
  rating_demandeur?: number;
  rating_prestataire?: number;
  feedback?: string;
};

export const missionsApi = {
  preview(payload: MissionPayload) {
    return request<{ summary: Record<string, unknown>; tags: string[] }>("?simulate=1", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  create(payload: MissionPayload) {
    return request<{ mission_id: string; status: string; summary: Record<string, unknown>; tags: string[] }>("", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  list(role: "demandeur" | "prestataire" | "admin" = "demandeur") {
    return request<Array<Record<string, unknown>>>(`?role=${role}`);
  },
  detail(mission_id: string) {
    return request<MissionDetail>(`/${mission_id}`);
  },
  dispatch(mission_id: string, body: { wave_size?: number; top_n?: number; timeout_minutes?: number; channel?: string }) {
    return request<{ dispatched: number; offers: Array<Record<string, unknown>> }>(`/${mission_id}/waves`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  respond(mission_id: string, offer_id: string, action: "accept" | "refuse", comment?: string) {
    return request<{ status: string }>(`/${mission_id}/offers/${offer_id}/respond`, {
      method: "POST",
      body: JSON.stringify({ action, comment }),
    });
  },
  confirm(mission_id: string, offer_id: string, notes?: string) {
    return request<{ ok: boolean }>(`/${mission_id}/confirm`, {
      method: "POST",
      body: JSON.stringify({ offer_id, notes }),
    });
  },
  messages(mission_id: string) {
    return request<Array<{ id: string; role: string; text: string; created_at: string }>>(`/${mission_id}/messages`);
  },
  sendMessage(mission_id: string, text: string) {
    return request<{ ok: boolean }>(`/${mission_id}/messages`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  },
  createMilestone(mission_id: string, payload: MissionMilestonePayload) {
    return request<{ ok: boolean }>(`/${mission_id}/milestones`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateMilestone(mission_id: string, milestone_id: string, payload: MilestoneUpdatePayload) {
    return request<{ ok: boolean }>(`/${mission_id}/milestones/${milestone_id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  close(mission_id: string, payload: MissionClosePayload) {
    return request<{ ok: boolean }>(`/${mission_id}/close`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  export(mission_id: string) {
    return request<Record<string, unknown>>(`/${mission_id}/export`);
  },
  journal(mission_id: string) {
    return request<Array<{ ts: string; payload?: Record<string, unknown> }>>(`/${mission_id}/journal`);
  },
  dashboard(params?: { window_days?: number }) {
    const search = params?.window_days ? `?window_days=${params.window_days}` : "";
    return request<Record<string, unknown>>(`/dashboard${search}`);
  },
};
