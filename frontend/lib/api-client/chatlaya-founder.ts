import { getChatlayaApiBase } from "@/lib/env";
import { requestJson } from "@/lib/api";

export type FounderOwner = {
  guestId?: string | null;
  userId?: string | null;
};

export type FounderMaturityScores = {
  global?: number | null;
  client_clarity?: number | null;
  problem_clarity?: number | null;
  offer_strength?: number | null;
  pricing_coherence?: number | null;
  business_model?: number | null;
  validation?: number | null;
  sales_readiness?: number | null;
  execution_readiness?: number | null;
  [key: string]: number | null | undefined;
};

export type FounderNextBestAction = {
  title?: string | null;
  why?: string | null;
  how?: string | null;
  expected_output?: string | null;
};

export type FounderCadrageAnalysis = {
  project_stage?: string | null;
  business_type?: string | null;
  main_goal?: string | null;
  summary?: string | null;
  diagnosis?: Record<string, unknown> | null;
  maturity_scores?: FounderMaturityScores | null;
  strengths?: string[] | null;
  risks?: string[] | null;
  missing_information?: string[] | null;
  recommended_next_step?: string | null;
  next_best_action?: FounderNextBestAction | null;
  suggested_questions?: string[] | null;
  roadmap_7_days?: string[] | null;
};

export type FounderCadrageAgentResponse = {
  ok: boolean;
  project_id: string;
  agent: string;
  analysis: FounderCadrageAnalysis;
  suggested_project_data_patch?: Record<string, unknown> | null;
  project?: unknown | null;
};

export type FounderClientProblemTargetClient = {
  segment?: string | null;
  profile?: string | null;
  context?: string | null;
  ability_to_pay?: string | null;
  access_channel?: string | null;
};

export type FounderClientProblemProblem = {
  main_problem?: string | null;
  pain_level?: number | null;
  frequency?: string | null;
  consequences?: string[] | null;
  current_alternatives?: string[] | null;
};

export type FounderClientProblemValidation = {
  critical_assumptions?: string[] | null;
  field_questions?: string[] | null;
  people_to_contact?: string[] | null;
  validation_method?: string | null;
  success_criteria?: string[] | null;
};

export type FounderClientProblemScores = {
  client_precision?: number | null;
  problem_intensity?: number | null;
  market_accessibility?: number | null;
  validation_readiness?: number | null;
  global?: number | null;
};

export type FounderClientProblemAnalysis = {
  target_client?: FounderClientProblemTargetClient | null;
  problem?: FounderClientProblemProblem | null;
  validation?: FounderClientProblemValidation | null;
  scores?: FounderClientProblemScores | null;
  strengths?: string[] | null;
  risks?: string[] | null;
  missing_information?: string[] | null;
  recommended_next_step?: string | null;
  next_best_action?: FounderNextBestAction | null;
};

export type FounderClientProblemAgentResponse = {
  ok: boolean;
  project_id: string;
  agent: string;
  analysis: FounderClientProblemAnalysis;
  suggested_project_data_patch?: Record<string, unknown> | null;
  project?: unknown | null;
};

type FounderProjectData = Record<string, unknown>;

export type FounderProject = {
  id: string;
  user_id?: string | null;
  guest_id?: string | null;
  conversation_id?: string | null;
  title: string;
  status?: string | null;
  current_step?: string | null;
  project_data: FounderProjectData;
  created_at?: string | null;
  updated_at?: string | null;
  archived?: boolean;
};

type FounderProjectCreatePayload = FounderOwner & {
  conversation_id?: string | null;
  title?: string;
  current_step?: string;
  project_data?: FounderProjectData;
};

type FounderProjectUpdatePayload = {
  title?: string;
  current_step?: string;
  status?: string;
  project_data?: FounderProjectData;
};

function founderApiUrl(path: string): string {
  return `${getChatlayaApiBase().replace(/\/$/, "")}${path}`;
}

function resolveOwner(owner: FounderOwner): URLSearchParams {
  const userId = owner.userId?.trim();
  const guestId = owner.guestId?.trim();
  if (Boolean(userId) === Boolean(guestId)) {
    throw new Error("Exactly one of userId or guestId is required.");
  }
  const params = new URLSearchParams();
  if (userId) params.set("user_id", userId);
  if (guestId) params.set("guest_id", guestId);
  return params;
}

function normalizeProject(value: unknown): FounderProject {
  const record = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const status = typeof record.status === "string" ? record.status : null;
  return {
    id: typeof record.id === "string" ? record.id : typeof record.project_id === "string" ? record.project_id : "",
    user_id: typeof record.user_id === "string" ? record.user_id : null,
    guest_id: typeof record.guest_id === "string" ? record.guest_id : null,
    conversation_id: typeof record.conversation_id === "string" ? record.conversation_id : null,
    title: typeof record.title === "string" && record.title.trim() ? record.title : "Projet Founder",
    status,
    current_step: typeof record.current_step === "string" ? record.current_step : null,
    project_data: record.project_data && typeof record.project_data === "object"
      ? record.project_data as FounderProjectData
      : {},
    created_at: typeof record.created_at === "string" ? record.created_at : null,
    updated_at: typeof record.updated_at === "string" ? record.updated_at : null,
    archived: status === "archived",
  };
}

export async function createFounderProject(payload: FounderProjectCreatePayload): Promise<FounderProject> {
  const response = await requestJson<{ project?: unknown }>(founderApiUrl("/chatlaya/founder-projects"), {
    method: "POST",
    body: JSON.stringify({
      user_id: payload.userId?.trim() || undefined,
      guest_id: payload.guestId?.trim() || undefined,
      conversation_id: payload.conversation_id?.trim() || undefined,
      title: payload.title?.trim() || "Projet Founder",
      current_step: payload.current_step || "point_de_depart",
      project_data: payload.project_data || {},
    }),
  });
  return normalizeProject(response.project);
}

export async function listFounderProjects(owner: FounderOwner): Promise<FounderProject[]> {
  const params = resolveOwner(owner);
  const response = await requestJson<{ items?: unknown[] }>(
    founderApiUrl(`/chatlaya/founder-projects?${params.toString()}`),
    { method: "GET" },
  );
  return Array.isArray(response.items) ? response.items.map(normalizeProject) : [];
}

export async function getFounderProject(projectId: string, owner: FounderOwner): Promise<FounderProject> {
  const params = resolveOwner(owner);
  const response = await requestJson<{ project?: unknown }>(
    founderApiUrl(`/chatlaya/founder-projects/${encodeURIComponent(projectId)}?${params.toString()}`),
    { method: "GET" },
  );
  return normalizeProject(response.project);
}

export async function updateFounderProject(
  projectId: string,
  payload: FounderProjectUpdatePayload,
  owner: FounderOwner,
): Promise<FounderProject> {
  const params = resolveOwner(owner);
  const response = await requestJson<{ project?: unknown }>(
    founderApiUrl(`/chatlaya/founder-projects/${encodeURIComponent(projectId)}?${params.toString()}`),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
  return normalizeProject(response.project);
}

export async function runFounderCadrageAgent(
  projectId: string,
  owner: FounderOwner,
  payload?: {
    instruction?: string | null;
    auto_update?: boolean;
  },
): Promise<FounderCadrageAgentResponse> {
  const params = resolveOwner(owner);
  const response = await requestJson<FounderCadrageAgentResponse>(
    founderApiUrl(`/chatlaya/founder-projects/${encodeURIComponent(projectId)}/agent/cadrage?${params.toString()}`),
    {
      method: "POST",
      body: JSON.stringify({
        instruction: payload?.instruction ?? null,
        auto_update: payload?.auto_update ?? false,
      }),
    },
  );
  return response;
}

export async function runFounderClientProblemAgent(
  projectId: string,
  owner: FounderOwner,
  payload?: {
    instruction?: string | null;
    auto_update?: boolean;
  },
): Promise<FounderClientProblemAgentResponse> {
  const params = resolveOwner(owner);
  const response = await requestJson<FounderClientProblemAgentResponse>(
    founderApiUrl(`/chatlaya/founder-projects/${encodeURIComponent(projectId)}/agent/client-problem?${params.toString()}`),
    {
      method: "POST",
      body: JSON.stringify({
        instruction: payload?.instruction ?? null,
        auto_update: payload?.auto_update ?? false,
      }),
    },
  );
  return response;
}

export type FounderOfferValueValueProposition = {
  promise?: string | null;
  target_result?: string | null;
  main_benefits?: string[] | null;
  differentiation?: string | null;
  proof_needed?: string[] | null;
};

export type FounderOfferValueOffer = {
  main_offer?: string | null;
  entry_offer?: string | null;
  premium_offer?: string | null;
  deliverables?: string[] | null;
  conditions?: string[] | null;
};

export type FounderOfferValueCustomerFit = {
  pains_addressed?: string[] | null;
  gains_created?: string[] | null;
  objections?: string[] | null;
  trust_builders?: string[] | null;
};

export type FounderOfferValueScores = {
  offer_clarity?: number | null;
  value_strength?: number | null;
  differentiation?: number | null;
  trust_readiness?: number | null;
  testability?: number | null;
  global?: number | null;
};

export type FounderOfferValueNextBestAction = {
  title?: string | null;
  why?: string | null;
  how?: string[] | string | null;
  expected_output?: string | null;
};

export type FounderOfferValueAnalysis = {
  value_proposition?: FounderOfferValueValueProposition | null;
  offer?: FounderOfferValueOffer | null;
  customer_fit?: FounderOfferValueCustomerFit | null;
  scores?: FounderOfferValueScores | null;
  strengths?: string[] | null;
  risks?: string[] | null;
  missing_information?: string[] | null;
  recommended_next_step?: string | null;
  next_best_action?: FounderOfferValueNextBestAction | null;
};

export type FounderOfferValueAgentResponse = {
  ok: boolean;
  project_id: string;
  agent: string;
  analysis: FounderOfferValueAnalysis;
  suggested_project_data_patch?: Record<string, unknown> | null;
  project?: unknown | null;
};

export async function runFounderOfferValueAgent(
  projectId: string,
  owner: FounderOwner,
  payload?: {
    instruction?: string | null;
    auto_update?: boolean;
  },
): Promise<FounderOfferValueAgentResponse> {
  const params = resolveOwner(owner);
  const response = await requestJson<FounderOfferValueAgentResponse>(
    founderApiUrl(`/chatlaya/founder-projects/${encodeURIComponent(projectId)}/agent/offer-value?${params.toString()}`),
    {
      method: "POST",
      body: JSON.stringify({
        instruction: payload?.instruction ?? null,
        auto_update: payload?.auto_update ?? false,
      }),
    },
  );
  return response;
}

export type FounderPricingPricing = {
  recommended_price_logic?: string | null;
  entry_price_hypothesis?: string | null;
  main_price_hypothesis?: string | null;
  premium_price_hypothesis?: string | null;
  payment_modes?: string[] | null;
  pricing_risks?: string[] | null;
};

export type FounderPricingBusinessModel = {
  revenue_streams?: string[] | null;
  cost_structure?: string[] | null;
  key_resources?: string[] | null;
  key_partners?: string[] | null;
  distribution_channels?: string[] | null;
  unit_economics_summary?: string | null;
};

export type FounderPricingSimpleFinance = {
  startup_costs_to_estimate?: string[] | null;
  fixed_costs?: string[] | null;
  variable_costs?: string[] | null;
  break_even_logic?: string | null;
  sales_needed_for_goal?: string | null;
};

export type FounderPricingScenarios = {
  pessimistic?: string | null;
  realistic?: string | null;
  ambitious?: string | null;
};

export type FounderPricingScores = {
  pricing_clarity?: number | null;
  payment_fit?: number | null;
  margin_potential?: number | null;
  business_model_clarity?: number | null;
  financial_readiness?: number | null;
  global?: number | null;
};

export type FounderPricingNextBestAction = {
  title?: string | null;
  why?: string | null;
  how?: string[] | string | null;
  expected_output?: string | null;
};

export type FounderPricingBusinessModelAnalysis = {
  pricing?: FounderPricingPricing | null;
  business_model?: FounderPricingBusinessModel | null;
  simple_finance?: FounderPricingSimpleFinance | null;
  scenarios?: FounderPricingScenarios | null;
  scores?: FounderPricingScores | null;
  strengths?: string[] | null;
  risks?: string[] | null;
  missing_information?: string[] | null;
  recommended_next_step?: string | null;
  next_best_action?: FounderPricingNextBestAction | null;
};

export type FounderPricingBusinessModelAgentResponse = {
  ok: boolean;
  project_id: string;
  agent: string;
  analysis: FounderPricingBusinessModelAnalysis;
  suggested_project_data_patch?: Record<string, unknown> | null;
  project?: unknown | null;
};

export async function runFounderPricingBusinessModelAgent(
  projectId: string,
  owner: FounderOwner,
  payload?: {
    instruction?: string | null;
    auto_update?: boolean;
  },
): Promise<FounderPricingBusinessModelAgentResponse> {
  const params = resolveOwner(owner);
  const response = await requestJson<FounderPricingBusinessModelAgentResponse>(
    founderApiUrl(`/chatlaya/founder-projects/${encodeURIComponent(projectId)}/agent/pricing-business-model?${params.toString()}`),
    {
      method: "POST",
      body: JSON.stringify({
        instruction: payload?.instruction ?? null,
        auto_update: payload?.auto_update ?? false,
      }),
    },
  );
  return response;
}

export async function archiveFounderProject(projectId: string, owner: FounderOwner): Promise<FounderProject> {
  const params = resolveOwner(owner);
  const response = await requestJson<{ project?: unknown }>(
    founderApiUrl(`/chatlaya/founder-projects/${encodeURIComponent(projectId)}/archive?${params.toString()}`),
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
  return normalizeProject(response.project);
}
