import type { ProspectRecord } from "@/lib/prospecting";

import type { MaskedRadarOpportunity, RadarPlan, RadarQuotaState, RadarSubscription, RadarUnlock, RadarUserRole, ReservedRadarOpportunity, UnlockResult } from "./types";

const STORAGE_KEY = "iacourtier_radar_quota_state";
const DEFAULT_USER_ID = "sonia-beta-user";
const DEFAULT_USER_ROLE: RadarUserRole = "sonia_beta";

const planLimits: Record<RadarPlan, number> = {
  free: 3,
  pro: 10,
  elite: 25,
  founder: 25,
};

export function getWeeklyRadarLimit(plan: RadarPlan) {
  return planLimits[plan];
}

export function getCurrentRadarUserId() {
  return DEFAULT_USER_ID;
}

export function getCurrentRadarUserRole(): RadarUserRole {
  return DEFAULT_USER_ROLE;
}

export function isUnlimitedRadarRole(role: RadarUserRole) {
  return role === "admin" || role === "sonia_beta";
}

export function isUnlimitedRadarUser(subscription: Pick<RadarSubscription, "role">) {
  return isUnlimitedRadarRole(subscription.role);
}

export function getWeekStart(date = new Date()) {
  const current = new Date(date);
  const day = current.getDay();
  const diff = current.getDate() - day + (day === 0 ? -6 : 1);
  current.setDate(diff);
  current.setHours(0, 0, 0, 0);
  return current.toISOString().slice(0, 10);
}

export function getRadarQuotaState(userId = DEFAULT_USER_ID): RadarQuotaState {
  const weekStart = getWeekStart();
  const stored = readStoredState();
  const subscription = normalizeSubscription(stored?.subscription, userId, weekStart);
  const radarUnlocks = (stored?.radarUnlocks || []).filter((unlock) => unlock.weekStart === weekStart);
  const reservations = stored?.reservations || [];

  const state = {
    subscription: {
      ...subscription,
      radarUsedThisWeek: radarUnlocks.filter((unlock) => unlock.userId === userId).length,
    },
    radarUnlocks,
    reservations,
  };

  saveRadarQuotaState(state);
  return state;
}

export function saveRadarQuotaState(state: RadarQuotaState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function canUnlockRadarOpportunity(userId = DEFAULT_USER_ID) {
  const state = getRadarQuotaState(userId);
  if (isUnlimitedRadarUser(state.subscription)) {
    return {
      canUnlock: true,
      remaining: Number.POSITIVE_INFINITY,
      unlimited: true,
      subscription: state.subscription,
    };
  }

  return {
    canUnlock: state.subscription.radarUsedThisWeek < state.subscription.weeklyRadarLimit,
    remaining: Math.max(state.subscription.weeklyRadarLimit - state.subscription.radarUsedThisWeek, 0),
    unlimited: false,
    subscription: state.subscription,
  };
}

export function unlockBestRadarOpportunity(userId: string, opportunities: ProspectRecord[], city?: string): UnlockResult {
  const state = getRadarQuotaState(userId);
  const quota = canUnlockRadarOpportunity(userId);
  if (!quota.canUnlock) {
    return { ok: false, reason: "Quota Radar hebdomadaire atteint.", state };
  }

  const unlimited = isUnlimitedRadarUser(state.subscription);
  const alreadyUnlockedIds = new Set(state.radarUnlocks.filter((unlock) => unlock.userId === userId).map((unlock) => unlock.opportunityId));
  const reservedByOthers = new Set(state.reservations.filter((reservation) => reservation.assignedTo !== userId).map((reservation) => reservation.opportunityId));
  const normalizedCity = city && city !== "Toutes" ? city.trim().toLowerCase() : "";

  const best = opportunities
    .filter((opportunity) => unlimited || !alreadyUnlockedIds.has(opportunity.id))
    .filter((opportunity) => unlimited || !reservedByOthers.has(opportunity.id))
    .filter((opportunity) => !normalizedCity || opportunity.city.toLowerCase() === normalizedCity)
    .sort((a, b) => b.opportunityScore - a.opportunityScore)[0];

  if (!best) {
    return { ok: false, reason: "Aucune opportunité disponible à débloquer pour ce secteur.", state };
  }

  const now = new Date().toISOString();
  const weekStart = getWeekStart();
  const unlock: RadarUnlock = {
    id: `unlock-${userId}-${best.id}-${Date.now()}`,
    userId,
    opportunityId: best.id,
    plan: state.subscription.plan,
    unlockedAt: now,
    weekStart,
  };
  const reservation: ReservedRadarOpportunity = {
    opportunityId: best.id,
    assignedTo: userId,
    reservedAt: now,
    status: "reserved",
    unlockedByPlan: state.subscription.plan,
  };

  const nextState: RadarQuotaState = {
    subscription: {
      ...state.subscription,
      radarUsedThisWeek: unlimited ? state.subscription.radarUsedThisWeek : state.subscription.radarUsedThisWeek + 1,
      radarWeekStart: weekStart,
    },
    radarUnlocks: [...state.radarUnlocks, unlock],
    reservations: [...state.reservations.filter((item) => item.opportunityId !== best.id), reservation],
  };

  saveRadarQuotaState(nextState);
  return {
    ok: true,
    opportunity: {
      ...best,
      assignedTo: userId,
      reservedAt: now,
      status: "reserved",
      unlockedByPlan: state.subscription.plan,
    },
    state: nextState,
  };
}

export function getUnlockedOpportunities(userId: string, opportunities: ProspectRecord[], state = getRadarQuotaState(userId)) {
  if (isUnlimitedRadarUser(state.subscription)) {
    return opportunities.map((opportunity) => ({
      ...opportunity,
      assignedTo: userId,
      status: "reserved" as const,
      unlockedByPlan: state.subscription.plan,
    }));
  }

  const unlockedIds = new Set(state.radarUnlocks.filter((unlock) => unlock.userId === userId).map((unlock) => unlock.opportunityId));
  return opportunities.filter((opportunity) => unlockedIds.has(opportunity.id)).map((opportunity) => {
    const reservation = state.reservations.find((item) => item.opportunityId === opportunity.id);
    return reservation
      ? {
          ...opportunity,
          assignedTo: reservation.assignedTo,
          reservedAt: reservation.reservedAt,
          status: reservation.status,
          unlockedByPlan: reservation.unlockedByPlan,
        }
      : opportunity;
  });
}

export function getMaskedAvailableOpportunities(userId: string, opportunities: ProspectRecord[], state = getRadarQuotaState(userId)) {
  if (isUnlimitedRadarUser(state.subscription)) return [];

  const unlockedIds = new Set(state.radarUnlocks.filter((unlock) => unlock.userId === userId).map((unlock) => unlock.opportunityId));
  const reservedByOthers = new Set(state.reservations.filter((reservation) => reservation.assignedTo !== userId).map((reservation) => reservation.opportunityId));

  return opportunities
    .filter((opportunity) => !unlockedIds.has(opportunity.id))
    .filter((opportunity) => !reservedByOthers.has(opportunity.id))
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .map(maskRadarOpportunity);
}

export function maskRadarOpportunity(opportunity: ProspectRecord): MaskedRadarOpportunity {
  return {
    id: opportunity.id,
    city: opportunity.city,
    propertyType: opportunity.propertyType,
    opportunityScore: opportunity.opportunityScore,
    priority: opportunity.priority,
    category: opportunity.category,
    reasonGeneral: generalizeReason(opportunity.reason),
  };
}

export const radarUnlocksTableDefinition = {
  table: "radar_unlocks",
  fields: ["id", "userId", "opportunityId", "plan", "unlockedAt", "weekStart"],
};

function normalizeSubscription(subscription: RadarSubscription | undefined, userId: string, weekStart: string): RadarSubscription {
  const role = subscription?.role || getCurrentRadarUserRole();
  const plan = subscription?.plan || "founder";
  const weeklyRadarLimit = subscription?.weeklyRadarLimit || getWeeklyRadarLimit(plan);
  const sameWeek = subscription?.radarWeekStart === weekStart;

  return {
    userId,
    role,
    plan,
    weeklyRadarLimit,
    radarUsedThisWeek: sameWeek ? subscription?.radarUsedThisWeek || 0 : 0,
    radarWeekStart: weekStart,
  };
}

function readStoredState(): RadarQuotaState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RadarQuotaState) : null;
  } catch {
    return null;
  }
}

function generalizeReason(reason: string) {
  const clean = reason.replace(/\b\d{2,}\b/g, "données disponibles").replace(/\$ ?[\d\s,.]+/g, "valeur détectée");
  if (clean.length <= 130) return clean;
  return `${clean.slice(0, 127).trim()}...`;
}
