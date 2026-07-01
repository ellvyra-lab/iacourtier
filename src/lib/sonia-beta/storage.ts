import type { ProspectRecord } from "@/lib/prospecting";
import type { PipelineStatus } from "@/lib/pipeline-intelligence";
import { officialSellerWorkflow } from "@/lib/business-rules";

import type { CallResult, SoniaBattlePlan, SoniaHistoryEvent, SoniaProspect } from "./types";

const STORAGE_KEY = "iacourtier_sonia_beta_prospects";
const sellerStatus = {
  prospect: officialSellerWorkflow[1],
  callQualification: officialSellerWorkflow[2],
  appointmentObtained: officialSellerWorkflow[3],
  marketAnalysisPrep: officialSellerWorkflow[4],
  mandateSigned: officialSellerWorkflow[7],
  sellerDocuments: officialSellerWorkflow[8],
  marketingPrep: officialSellerWorkflow[9],
  listed: officialSellerWorkflow[10],
};

export function getSoniaProspects(): SoniaProspect[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SoniaProspect[]) : seedProspects();
  } catch {
    return seedProspects();
  }
}

export function saveSoniaProspects(prospects: SoniaProspect[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prospects));
}

export function getSoniaProspect(id: string) {
  return getSoniaProspects().find((prospect) => prospect.id === id) || null;
}

export function upsertSoniaProspect(prospect: SoniaProspect) {
  const prospects = getSoniaProspects();
  const next = [prospect, ...prospects.filter((item) => item.id !== prospect.id)];
  saveSoniaProspects(next);
  return prospect;
}

export function createSellerProspectFromRadar(opportunity: ProspectRecord) {
  const existing = getSoniaProspects().find((prospect) => normalizeKey(prospect.address, prospect.city) === normalizeKey(opportunity.address, opportunity.city));
  if (existing) return existing;

  const now = new Date().toISOString();
  const prospect: SoniaProspect = {
    id: `radar-${slugify(`${opportunity.address}-${opportunity.city}`)}-${Date.now()}`,
    name: opportunity.contactName || opportunity.ownerName || "Prospect vendeur",
    phone: opportunity.phone,
    email: opportunity.email,
    address: opportunity.address,
    city: opportunity.city,
    clientType: "seller",
    source: "Radar",
    status: sellerStatus.prospect,
    notes: opportunity.notes || opportunity.reason,
    nextAction: "Appeler",
    nextActionDate: today(),
    createdAt: now,
    updatedAt: now,
    history: [
      {
        id: `history-${Date.now()}`,
        date: now,
        title: "Prospect créé depuis le Radar",
        description: `${opportunity.address}, ${opportunity.city}. Prochaine action : appeler.`,
        type: "status",
      },
    ],
  };

  return upsertSoniaProspect(prospect);
}

export function addProspectHistory(id: string, event: Omit<SoniaHistoryEvent, "id" | "date">) {
  return updateSoniaProspect(id, (prospect) => ({
    ...prospect,
    history: [
      {
        ...event,
        id: `history-${Date.now()}`,
        date: new Date().toISOString(),
      },
      ...prospect.history,
    ],
  }));
}

export function updateSoniaProspect(id: string, updater: (prospect: SoniaProspect) => SoniaProspect) {
  const prospects = getSoniaProspects();
  const current = prospects.find((prospect) => prospect.id === id);
  if (!current) return null;

  const updated = { ...updater(current), updatedAt: new Date().toISOString() };
  saveSoniaProspects(prospects.map((prospect) => (prospect.id === id ? updated : prospect)));
  return updated;
}

export function updateProspectStatus(id: string, status: PipelineStatus, nextAction: string) {
  return updateSoniaProspect(id, (prospect) => ({
    ...prospect,
    status,
    nextAction,
    nextActionDate: today(),
    history: [
      {
        id: `history-${Date.now()}`,
        date: new Date().toISOString(),
        title: `Statut : ${status}`,
        description: nextAction,
        type: "status",
      },
      ...prospect.history,
    ],
  }));
}

export function recordCallResult(id: string, result: CallResult, note: string, callbackDate?: string) {
  return updateSoniaProspect(id, (prospect) => {
    const rule = callResultRules[result];
    const nextDate = result === "a_rappeler" && callbackDate ? callbackDate : addDays(rule.days);
    const status = rule.status || prospect.status;
    const description = note.trim() ? `${rule.description} Note : ${note.trim()}` : rule.description;

    return {
      ...prospect,
      status,
      notes: note.trim() ? [prospect.notes, note.trim()].filter(Boolean).join("\n\n") : prospect.notes,
      nextAction: rule.nextAction,
      nextActionDate: nextDate,
      history: [
        {
          id: `history-${Date.now()}`,
          date: new Date().toISOString(),
          title: `Résultat de l'appel : ${rule.label}`,
          description,
          type: "call",
        },
        ...automaticEventsForStatus(status),
        ...prospect.history,
      ],
    };
  });
}

export function buildSoniaBattlePlan(prospects: SoniaProspect[]): SoniaBattlePlan {
  return {
    radarProspectsToCall: prospects.filter((item) => item.source === "Radar" && item.nextAction.toLowerCase().includes("appeler")).slice(0, 6),
    callsToMake: prospects.filter((item) => item.nextAction.toLowerCase().includes("appel") || item.nextAction.toLowerCase().includes("appeler")).slice(0, 6),
    followupsDue: prospects.filter((item) => isDue(item.nextActionDate) && /relance|rappeler/i.test(item.nextAction)).slice(0, 6),
    sellerAppointmentsToPrepare: prospects.filter((item) => item.status === sellerStatus.appointmentObtained).slice(0, 6),
    marketAnalysesToPrepare: prospects.filter((item) => item.status === sellerStatus.appointmentObtained || item.status === sellerStatus.marketAnalysisPrep).slice(0, 6),
    mandatesWithMissingDocuments: prospects.filter((item) => item.status === sellerStatus.mandateSigned || item.status === sellerStatus.sellerDocuments).slice(0, 6),
    marketingActionsToGenerate: prospects.filter((item) => item.status === sellerStatus.mandateSigned || item.status === sellerStatus.marketingPrep || item.status === sellerStatus.listed).slice(0, 6),
  };
}

const callResultRules: Record<CallResult, { label: string; description: string; nextAction: string; days: number; status?: PipelineStatus }> = {
  pas_repondu: {
    label: "Pas répondu",
    description: "Aucune réponse. IACourtier planifie une relance courte.",
    nextAction: "Relance téléphonique",
    days: 2,
  },
  mauvais_numero: {
    label: "Mauvais numéro",
    description: "Numéro à corriger avant de continuer la prospection.",
    nextAction: "Trouver le bon numéro",
    days: 1,
  },
  interesse: {
    label: "Intéressé",
    description: "Le prospect démontre de l'ouverture. Préparer la suite de la conversation.",
    nextAction: "Préparer rendez-vous vendeur",
    days: 1,
    status: sellerStatus.callQualification,
  },
  rendez_vous_obtenu: {
    label: "Rendez-vous obtenu",
    description: "Rendez-vous vendeur obtenu. L'analyse de marché doit être préparée avant la rencontre.",
    nextAction: "Préparer analyse de marché",
    days: 0,
    status: sellerStatus.appointmentObtained,
  },
  a_rappeler: {
    label: "À rappeler plus tard",
    description: "Le prospect accepte une relance à une date future.",
    nextAction: "Rappeler le prospect",
    days: 7,
  },
  pas_interesse: {
    label: "Pas intéressé",
    description: "Le prospect ne veut pas avancer maintenant. Relance longue ou archivage.",
    nextAction: "Relance 90 jours",
    days: 90,
  },
  deja_avec_courtier: {
    label: "Vendu / déjà avec courtier",
    description: "Prospect à exclure de la prospection active.",
    nextAction: "Exclure de la prospection",
    days: 365,
  },
};

function automaticEventsForStatus(status: PipelineStatus): SoniaHistoryEvent[] {
  const now = new Date().toISOString();
  if (status === sellerStatus.appointmentObtained) {
    return [
      {
        id: `history-${Date.now()}-analysis`,
        date: now,
        title: "Actions déclenchées",
        description: "Préparer analyse de marché, questions de découverte, arguments vendeur et script de rendez-vous.",
        type: "ai",
      },
    ];
  }
  if (status === sellerStatus.mandateSigned) {
    return [
      {
        id: `history-${Date.now()}-mandate`,
        date: now,
        title: "Actions mandat déclenchées",
        description: "Demander certificat, taxes municipales, taxes scolaires, acte de vente, déclaration du vendeur, description et campagne marketing.",
        type: "ai",
      },
    ];
  }
  return [];
}

function seedProspects(): SoniaProspect[] {
  const now = new Date().toISOString();
  return [
    {
      id: "sonia-demo-tremblay",
      name: "M. Tremblay",
      phone: "514-555-0124",
      email: "tremblay@example.com",
      address: "1240 rue Notre-Dame",
      city: "Repentigny",
      clientType: "seller",
      source: "Radar",
      status: sellerStatus.prospect,
      notes: "Prospect prioritaire à appeler aujourd'hui.",
      nextAction: "Appeler",
      nextActionDate: today(),
      createdAt: now,
      updatedAt: now,
      history: [{ id: "demo-history-1", date: now, title: "Ajouté au plan de bataille", description: "Prospect Radar prêt à contacter.", type: "status" }],
    },
    {
      id: "sonia-demo-gagnon",
      name: "Mme Gagnon",
      phone: "450-555-0188",
      address: "2145 boulevard des Laurentides",
      city: "Laval",
      clientType: "seller",
      source: "Pipeline",
      status: sellerStatus.appointmentObtained,
      notes: "Préparer l'évaluation avant la rencontre.",
      nextAction: "Préparer analyse de marché",
      nextActionDate: today(),
      createdAt: now,
      updatedAt: now,
      history: [{ id: "demo-history-2", date: now, title: "Rendez-vous obtenu", description: "Analyse comparative à préparer avant la rencontre.", type: "status" }],
    },
    {
      id: "sonia-demo-bouchard",
      name: "Famille Bouchard",
      address: "4821 rue Wellington",
      city: "Montréal",
      clientType: "seller",
      source: "Pipeline",
      status: sellerStatus.mandateSigned,
      notes: "Documents vendeur à compléter.",
      nextAction: "Demander documents vendeur",
      nextActionDate: today(),
      createdAt: now,
      updatedAt: now,
      history: [{ id: "demo-history-3", date: now, title: "Mandat signé", description: "Demander documents et préparer mise en marché.", type: "status" }],
    },
  ];
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function isDue(date: string) {
  return !date || date <= today();
}

function normalizeKey(address: string, city: string) {
  return `${address}-${city}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
}

function slugify(value: string) {
  return normalizeKey(value, "");
}
