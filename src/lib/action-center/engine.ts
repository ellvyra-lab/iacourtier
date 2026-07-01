import { propertyDossiers } from "@/data/property-dossiers";
import { manualProspects } from "@/lib/prospecting";
import type { ProspectRecord } from "@/lib/prospecting";

import type { ActionCenterData, ActionItem, AssistantActionEvent, FollowUpProspect } from "./types";

const today = "2026-06-30";

const assistantEvents: AssistantActionEvent[] = [
  {
    type: "market_analysis_completed",
    entityId: "boucherville-familiale",
    label: "88 rue des Sorbiers",
    href: "/tableau-de-bord/mandats/boucherville-familiale",
  },
  {
    type: "description_generated",
    entityId: "verdun-wellington",
    label: "1245 rue Wellington",
    href: "/tableau-de-bord/mandats/verdun-wellington",
  },
  {
    type: "radar_prospect_created",
    entityId: "manual-laval-succession",
    label: "2145 boulevard des Laurentides",
    href: "/tableau-de-bord/radar-prospection",
  },
  {
    type: "csv_imported",
    entityId: "csv-import-demo",
    label: "Liste propriétaires Laval",
    href: "/tableau-de-bord/radar-prospection",
  },
];

const followUpProspects: FollowUpProspect[] = [
  {
    id: "suivi-gagnon",
    name: "Mme Gagnon",
    address: "739 rue Saint-Charles Ouest",
    createdAt: "2026-06-14",
    lastContactAt: "2026-06-21",
    nextFollowUpAt: "2026-06-30",
    priority: "Élevée",
    href: "/tableau-de-bord/radar-prospection",
  },
  {
    id: "suivi-tremblay",
    name: "M. Tremblay",
    address: "4821 rue Wellington",
    createdAt: "2026-06-18",
    lastContactAt: "2026-06-24",
    nextFollowUpAt: "2026-06-30",
    priority: "Élevée",
    href: "/tableau-de-bord/radar-prospection",
  },
  {
    id: "suivi-caron",
    name: "Mme Caron",
    address: "905 3e Avenue",
    createdAt: "2026-06-20",
    lastContactAt: "2026-06-28",
    nextFollowUpAt: "2026-07-03",
    priority: "Moyenne",
    href: "/tableau-de-bord/radar-prospection",
  },
];

export function buildActionCenterData(): ActionCenterData {
  const radarProspects = manualProspects;
  const generated = [
    ...actionsFromAssistantEvents(assistantEvents),
    ...actionsFromRadar(radarProspects),
    ...actionsFromMandates(),
    ...actionsFromFollowUps(followUpProspects),
    ...marketingActions(),
    ...documentActions(),
  ];

  const deduped = dedupeActions(generated).sort(sortActions);
  const followUpActions = deduped.filter((action) => action.category === "Suivis");
  const todayActions = deduped.filter((action) => action.category !== "Suivis").slice(0, 8);

  return {
    todayActions,
    followUpActions,
    summary: {
      radar: {
        newProspects: radarProspects.length,
        averageScore: Math.round(radarProspects.reduce((total, prospect) => total + prospect.opportunityScore, 0) / Math.max(radarProspects.length, 1)),
        highPriority: radarProspects.filter((prospect) => prospect.priority === "Élevée").length,
      },
      mandates: {
        active: propertyDossiers.length,
        incomplete: 2,
        missingDocuments: 3,
        descriptionsToGenerate: 2,
        analysesToFinish: 1,
      },
      marketing: {
        posts: 4,
        videos: 2,
        testimonials: 1,
      },
    },
  };
}

function actionsFromAssistantEvents(events: AssistantActionEvent[]): ActionItem[] {
  return events.map((event) => {
    if (event.type === "market_analysis_completed") {
      return createAction({
        title: "Envoyer l'analyse au vendeur",
        description: `Analyse comparative terminée pour ${event.label}. Préparez le courriel de présentation au vendeur.`,
        priority: "Élevée",
        estimatedMinutes: 12,
        href: event.href,
        source: "assistant",
        category: "Aujourd'hui",
        entityId: event.entityId,
        dedupeKey: `send-analysis:${event.entityId}`,
      });
    }

    if (event.type === "description_generated") {
      return createAction({
        title: "Publier le nouveau mandat",
        description: `Description générée pour ${event.label}. Validez le texte et préparez la publication de lancement.`,
        priority: "Moyenne",
        estimatedMinutes: 18,
        href: event.href,
        source: "assistant",
        category: "Aujourd'hui",
        entityId: event.entityId,
        dedupeKey: `publish-listing:${event.entityId}`,
      });
    }

    if (event.type === "csv_imported") {
      return createAction({
        title: "Envoyer le premier courriel",
        description: `Liste CSV importée : ${event.label}. Contactez les prospects les plus prometteurs aujourd'hui.`,
        priority: "Élevée",
        estimatedMinutes: 25,
        href: event.href,
        source: "csv",
        category: "Aujourd'hui",
        entityId: event.entityId,
        dedupeKey: `csv-first-email:${event.entityId}`,
      });
    }

    return createAction({
      title: "Faire le premier appel",
      description: `Nouveau prospect Radar : ${event.label}. Lancez le premier contact pendant que le signal est récent.`,
      priority: "Élevée",
      estimatedMinutes: 10,
      href: event.href,
      source: "radar",
      category: "Aujourd'hui",
      entityId: event.entityId,
      dedupeKey: `radar-first-call:${event.entityId}`,
    });
  });
}

function actionsFromRadar(prospects: ProspectRecord[]): ActionItem[] {
  return prospects
    .filter((prospect) => prospect.priority === "Élevée")
    .slice(0, 3)
    .map((prospect) =>
      createAction({
        title: `Premier appel - ${prospect.address}`,
        description: `${prospect.category}. Score ${prospect.opportunityScore}/100. ${prospect.reason}`,
        priority: prospect.priority,
        estimatedMinutes: 10,
        href: "/tableau-de-bord/radar-prospection",
        source: prospect.source === "csv" ? "csv" : "radar",
        category: "Radar",
        entityId: prospect.id,
        dedupeKey: `radar-first-call:${prospect.id}`,
      }),
    );
}

function actionsFromMandates(): ActionItem[] {
  return [
    createAction({
      title: "Préparer la description immobilière",
      description: "Le mandat de Québec a assez d'informations pour générer une description Centris complète.",
      priority: "Moyenne",
      estimatedMinutes: 8,
      href: "/tableau-de-bord/actions/generate-marketing-launch",
      source: "mandat",
      category: "Mandats",
      entityId: "quebec-investissement",
      dedupeKey: "generate-description:quebec-investissement",
    }),
    createAction({
      title: "Terminer une analyse comparative",
      description: "Le mandat de Boucherville attend la validation des comparables pour préparer la rencontre vendeur.",
      priority: "Élevée",
      estimatedMinutes: 20,
      href: "/tableau-de-bord/mandats/boucherville-familiale/analyse-comparative",
      source: "mandat",
      category: "Mandats",
      entityId: "boucherville-familiale",
      dedupeKey: "finish-analysis:boucherville-familiale",
    }),
  ];
}

function actionsFromFollowUps(prospects: FollowUpProspect[]): ActionItem[] {
  return prospects
    .filter((prospect) => prospect.nextFollowUpAt <= today)
    .map((prospect) =>
      createAction({
        title: `Relancer ${prospect.name}`,
        description: `Dernier contact il y a ${daysBetween(prospect.lastContactAt, today)} jours. Propriété : ${prospect.address}.`,
        priority: prospect.priority,
        estimatedMinutes: 7,
        href: prospect.href,
        source: "suivi",
        category: "Suivis",
        entityId: prospect.id,
        dedupeKey: `follow-up:${prospect.id}:${prospect.nextFollowUpAt}`,
      }),
    );
}

function marketingActions(): ActionItem[] {
  return [
    createAction({
      title: "Préparer une publication Facebook",
      description: "Planifiez une publication locale pour mettre en valeur votre expertise de quartier.",
      priority: "Moyenne",
      estimatedMinutes: 15,
      href: "/tableau-de-bord/actions/generate-marketing-launch",
      source: "marketing",
      category: "Marketing",
      entityId: "facebook-weekly",
      dedupeKey: "marketing:facebook-weekly",
    }),
    createAction({
      title: "Créer une vidéo courte",
      description: "Transformez une analyse de marché en script vidéo de 45 secondes.",
      priority: "Faible",
      estimatedMinutes: 20,
      href: "/tableau-de-bord/actions",
      source: "marketing",
      category: "Marketing",
      entityId: "short-video",
      dedupeKey: "marketing:short-video",
    }),
  ];
}

function documentActions(): ActionItem[] {
  return [
    createAction({
      title: "Vérifier le certificat de localisation",
      description: "Le dossier de Verdun contient une vérification documentaire à compléter avant la mise en marché.",
      priority: "Élevée",
      estimatedMinutes: 15,
      href: "/tableau-de-bord/mandats/verdun-wellington",
      source: "document",
      category: "Mandats",
      entityId: "verdun-wellington",
      dedupeKey: "document:certificate:verdun-wellington",
    }),
  ];
}

function createAction(action: Omit<ActionItem, "id" | "dueAt"> & { dueAt?: string }): ActionItem {
  return {
    ...action,
    id: action.dedupeKey,
    dueAt: action.dueAt || today,
  };
}

function dedupeActions(actions: ActionItem[]) {
  const map = new Map<string, ActionItem>();
  for (const action of actions) {
    const existing = map.get(action.dedupeKey);
    if (!existing || priorityRank(action.priority) > priorityRank(existing.priority)) {
      map.set(action.dedupeKey, action);
    }
  }
  return Array.from(map.values());
}

function sortActions(a: ActionItem, b: ActionItem) {
  return priorityRank(b.priority) - priorityRank(a.priority) || a.estimatedMinutes - b.estimatedMinutes;
}

function priorityRank(priority: ActionItem["priority"]) {
  return priority === "Élevée" ? 3 : priority === "Moyenne" ? 2 : 1;
}

function daysBetween(from: string, to: string) {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}
