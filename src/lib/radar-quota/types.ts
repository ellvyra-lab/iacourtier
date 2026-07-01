import type { ProspectRecord } from "@/lib/prospecting";

export type RadarPlan = "free" | "pro" | "elite" | "founder";
export type RadarUserRole = "admin" | "sonia_beta" | "broker";

export type RadarSubscription = {
  userId: string;
  role: RadarUserRole;
  plan: RadarPlan;
  weeklyRadarLimit: number;
  radarUsedThisWeek: number;
  radarWeekStart: string;
};

export type RadarUnlock = {
  id: string;
  userId: string;
  opportunityId: string;
  plan: RadarPlan;
  unlockedAt: string;
  weekStart: string;
};

export type ReservedRadarOpportunity = {
  opportunityId: string;
  assignedTo: string;
  reservedAt: string;
  status: "reserved";
  unlockedByPlan: RadarPlan;
};

export type RadarQuotaState = {
  subscription: RadarSubscription;
  radarUnlocks: RadarUnlock[];
  reservations: ReservedRadarOpportunity[];
};

export type MaskedRadarOpportunity = Pick<ProspectRecord, "id" | "city" | "propertyType" | "opportunityScore" | "priority" | "category"> & {
  reasonGeneral: string;
};

export type UnlockResult =
  | { ok: true; opportunity: ProspectRecord; state: RadarQuotaState }
  | { ok: false; reason: string; state: RadarQuotaState };
