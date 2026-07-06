import type { SoniaBattlePlan } from "@/lib/sonia-beta";

export type CoachTaskPriority = "haute" | "moyenne" | "basse";
export type CoachTaskType = "rendez-vous" | "appel" | "relance" | "analyse" | "document";
export type CoachTaskStatus = "a_faire" | "completee";

export type CoachTask = {
  id: string;
  title: string;
  priority: CoachTaskPriority;
  type: CoachTaskType;
  status: CoachTaskStatus;
  action: string;
  href: string;
  rank: number;
};

const priorityWeight: Record<CoachTaskPriority, number> = {
  haute: 3,
  moyenne: 2,
  basse: 1,
};

export function buildCoachTasks(plan: SoniaBattlePlan): CoachTask[] {
  const tasks: CoachTask[] = [];

  plan.sellerAppointmentsToPrepare.forEach((prospect, index) => {
    tasks.push({
      id: `seller-appointment-${prospect.id}`,
      title: index === 0 ? "Preparer un rendez-vous vendeur" : `Preparer le rendez-vous de ${prospect.name}`,
      priority: "haute",
      type: "rendez-vous",
      status: "a_faire",
      action: "Preparer le rendez-vous",
      href: `/tableau-de-bord/actions/prepare-market-analysis?name=${encodeURIComponent(prospect.name)}&address=${encodeURIComponent(prospect.address)}&city=${encodeURIComponent(prospect.city)}&context=prospect`,
      rank: tasks.length,
    });
  });

  plan.radarProspectsToCall.forEach((prospect, index) => {
    tasks.push({
      id: `call-${prospect.id}`,
      title: index === 0 ? "Appeler Mme Tremblay" : `Appeler ${prospect.name}`,
      priority: "haute",
      type: "appel",
      status: "a_faire",
      action: "Demarrer l'appel",
      href: `/tableau-de-bord/prospects/${prospect.id}?demoCall=1`,
      rank: tasks.length,
    });
  });

  plan.followupsDue.forEach((prospect, index) => {
    tasks.push({
      id: `followup-${prospect.id}`,
      title: index === 0 ? "Relancer M. Gagnon" : `Relancer ${prospect.name}`,
      priority: "moyenne",
      type: "relance",
      status: "a_faire",
      action: "Ouvrir la relance",
      href: `/tableau-de-bord/prospects/${prospect.id}`,
      rank: tasks.length,
    });
  });

  plan.marketAnalysesToPrepare.forEach((prospect, index) => {
    tasks.push({
      id: `market-analysis-${prospect.id}`,
      title: index === 0 ? "Preparer une analyse de marche" : `Preparer l'analyse pour ${prospect.name}`,
      priority: "moyenne",
      type: "analyse",
      status: "a_faire",
      action: "Lancer l'analyse",
      href: `/tableau-de-bord/actions/prepare-market-analysis?name=${encodeURIComponent(prospect.name)}&address=${encodeURIComponent(prospect.address)}&city=${encodeURIComponent(prospect.city)}&context=prospect`,
      rank: tasks.length,
    });
  });

  plan.mandatesWithMissingDocuments.forEach((prospect, index) => {
    tasks.push({
      id: `missing-doc-${prospect.id}`,
      title: index === 0 ? "Il manque un certificat" : `Documents manquants pour ${prospect.name}`,
      priority: "moyenne",
      type: "document",
      status: "a_faire",
      action: "Completer le dossier",
      href: `/tableau-de-bord/prospects/${prospect.id}`,
      rank: tasks.length,
    });
  });

  if (!tasks.length) {
    return buildDemoCoachTasks();
  }

  return sortByPriority(tasks);
}

export function markTaskCompleted(tasks: CoachTask[], taskId: string): CoachTask[] {
  return tasks.map((task) => (task.id === taskId ? { ...task, status: "completee" } : task));
}

export function getNextBestTask(tasks: CoachTask[]): CoachTask | null {
  const pending = tasks.filter((task) => task.status !== "completee");
  if (!pending.length) return null;

  const [next] = sortByPriority(pending);
  return next || null;
}

function buildDemoCoachTasks(): CoachTask[] {
  return sortByPriority([
    {
      id: "demo-appointment",
      title: "Preparer un rendez-vous vendeur",
      priority: "haute",
      type: "rendez-vous",
      status: "a_faire",
      action: "Preparer le rendez-vous",
      href: "/tableau-de-bord/coach",
      rank: 0,
    },
    {
      id: "demo-call",
      title: "Appeler Mme Tremblay",
      priority: "haute",
      type: "appel",
      status: "a_faire",
      action: "Demarrer l'appel",
      href: "/tableau-de-bord/coach",
      rank: 1,
    },
    {
      id: "demo-followup",
      title: "Relancer M. Gagnon",
      priority: "moyenne",
      type: "relance",
      status: "a_faire",
      action: "Ouvrir la relance",
      href: "/tableau-de-bord/coach",
      rank: 2,
    },
    {
      id: "demo-analysis",
      title: "Preparer une analyse de marche",
      priority: "moyenne",
      type: "analyse",
      status: "a_faire",
      action: "Lancer l'analyse",
      href: "/tableau-de-bord/coach",
      rank: 3,
    },
    {
      id: "demo-document",
      title: "Il manque un certificat",
      priority: "moyenne",
      type: "document",
      status: "a_faire",
      action: "Completer le dossier",
      href: "/tableau-de-bord/coach",
      rank: 4,
    },
  ]);
}

function sortByPriority(tasks: CoachTask[]): CoachTask[] {
  return [...tasks].sort((a, b) => {
    const byPriority = priorityWeight[b.priority] - priorityWeight[a.priority];
    if (byPriority !== 0) return byPriority;
    return a.rank - b.rank;
  });
}
