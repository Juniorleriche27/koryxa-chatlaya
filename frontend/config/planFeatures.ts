export type PlanTier = "free" | "pro" | "team";

export const PLAN_RANK: Record<PlanTier, number> = {
  free: 0,
  pro: 1,
  team: 2,
};

export function hasPlanAccess(currentPlan: PlanTier, requiredPlan: PlanTier): boolean {
  return PLAN_RANK[currentPlan] >= PLAN_RANK[requiredPlan];
}

function normalizeForcedPlan(value: string | undefined): PlanTier | null {
  const plan = String(value || "").trim().toLowerCase();
  if (plan === "free" || plan === "pro" || plan === "team") return plan;
  return null;
}

export const FORCED_PLAN = normalizeForcedPlan(process.env.NEXT_PUBLIC_FORCE_PLAN);

export function inferUserPlan(input?: { plan?: string; roles?: string[] } | null): PlanTier {
  if (FORCED_PLAN) return FORCED_PLAN;

  const plan = String(input?.plan || "").toLowerCase();
  if (plan === "free" || plan === "pro" || plan === "team") return plan;

  const roles = new Set((input?.roles || []).map((role) => String(role).toLowerCase()));
  if (roles.has("admin") || roles.has("team")) return "team";
  if (roles.has("pro")) return "pro";
  return "free";
}

export function lockedBadgeLabel(requiredPlan: PlanTier, isBeta = false): string {
  if (requiredPlan === "team") return "🔒 TEAM";
  if (isBeta) return "🔒 PRO BETA";
  return "🔒 PRO";
}
