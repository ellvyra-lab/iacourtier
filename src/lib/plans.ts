// Single source of truth for what each plan allows. Used by /api/generate
// to enforce limits, and by the dashboard UI to show "X / Y used this month".

export const PLAN_LIMITS: Record<string, number | null> = {
  gratuit: 10,
  essentiel: 200,
  pro: null, // null = unlimited
};

export function getMonthlyLimit(plan: string): number | null {
  return plan in PLAN_LIMITS ? PLAN_LIMITS[plan] : PLAN_LIMITS.gratuit;
}
