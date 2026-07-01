"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, CalendarCheck, CheckCircle2, Clock3, FileText, Home, Phone, Sparkles, Users } from "lucide-react";

import {
  buyerPipelineStatuses,
  getEmployeeName,
  sellerPipelineStatuses,
  type PipelineClient,
  type PipelineDashboardData,
  type PipelineStatus,
} from "@/lib/pipeline-intelligence";
import { contextFromPipelineStatus, getContextualAiActions } from "@/lib/ai-actions";
import { cn } from "@/lib/utils";

export function IntelligentPipelineDashboard({ data }: { data: PipelineDashboardData }) {
  const [selectedId, setSelectedId] = useState(data.clients[0]?.id || "");
  const selected = data.clients.find((client) => client.id === selectedId) || data.clients[0];
  const sellerClients = data.clients.filter((client) => client.type === "seller");
  const buyerClients = data.clients.filter((client) => client.type === "buyer");
  const activeActions = useMemo(() => data.clients.flatMap((client) => client.actions.map((action) => ({ ...action, client }))).slice(0, 8), [data.clients]);

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:p-7">
          <div>
            <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Pipeline intelligent</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Chaque client avance avec la bonne équipe IA</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
              IACourtier n&apos;est plus organisé par modules. Le logiciel suit le parcours vendeur et acheteur, déclenche les bons employés IA au bon statut et conserve une timeline complète pour chaque client.
            </p>
          </div>

          <TodayCard data={data} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        {data.employees.map((employee) => (
          <div key={employee.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-200">
              <Bot className="h-4 w-4" />
            </div>
            <p className="mt-3 text-base font-semibold">{employee.name}</p>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">{employee.role}</p>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{employee.specialty}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className="space-y-6">
          <PipelineLane title="Parcours vendeur" icon={Home} statuses={sellerPipelineStatuses} clients={sellerClients} selectedId={selected?.id} onSelect={setSelectedId} />
          <PipelineLane title="Parcours acheteur" icon={Users} statuses={buyerPipelineStatuses} clients={buyerClients} selectedId={selected?.id} onSelect={setSelectedId} />
        </section>

        {selected ? <ClientPanel client={selected} activeActions={activeActions.filter((action) => action.client.id === selected.id)} /> : null}
      </div>
    </div>
  );
}

function TodayCard({ data }: { data: PipelineDashboardData }) {
  const metrics = [
    ["Prospects", data.today.prospects],
    ["Évaluations", data.today.evaluations],
    ["Mandats", data.today.mandates],
    ["Notaire", data.today.notary],
    ["Suivis", data.today.followUps],
  ];

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/50">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <CalendarCheck className="h-4 w-4 text-teal-600" />
        Aujourd&apos;hui
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-2">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-3xl font-semibold tracking-tight">{value}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PipelineLane({
  title,
  icon: Icon,
  statuses,
  clients,
  selectedId,
  onSelect,
}: {
  title: string;
  icon: typeof Home;
  statuses: PipelineStatus[];
  clients: PipelineClient[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-teal-700 dark:text-teal-300">
            <Icon className="h-4 w-4" />
            {title}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Statuts et clients actifs</h2>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {statuses.map((status) => {
          const statusClients = clients.filter((client) => client.status === status);
          return (
            <div key={status} className="min-h-36 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold leading-snug">{status}</p>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">{statusClients.length}</span>
              </div>
              <div className="mt-3 space-y-2">
                {statusClients.length ? (
                  statusClients.map((client) => (
                    <button
                      type="button"
                      key={client.id}
                      onClick={() => onSelect(client.id)}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition",
                        selectedId === client.id
                          ? "border-teal-300 bg-teal-50 text-teal-950 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-50"
                          : "border-slate-200 bg-white hover:border-teal-200 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-900",
                      )}
                    >
                      <p className="text-sm font-semibold">{client.name}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{client.address || client.city}</p>
                    </button>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-400 dark:border-slate-800">Aucun client</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ClientPanel({
  client,
  activeActions,
}: {
  client: PipelineClient;
  activeActions: Array<PipelineClient["actions"][number] & { client: PipelineClient }>;
}) {
  const [callStatus, setCallStatus] = useState("");
  const aiContext = contextFromPipelineStatus(client.status, client.type);
  const recommendedActions = getContextualAiActions(aiContext);

  async function startClientCall() {
    setCallStatus("Assurez-vous d'avoir les consentements requis pour enregistrer et analyser cet appel.");
    const response = await fetch("/api/calls/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: "+15145550123", clientId: client.id, recordingEnabled: true, provider: "twilio" }),
    });
    const payload = (await response.json()) as { message?: string; error?: string };
    setCallStatus(payload.error || payload.message || "Appel lancé.");
  }

  return (
    <aside className="space-y-5 xl:sticky xl:top-8 xl:self-start">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Fiche client</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">{client.name}</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{client.address ? `${client.address}, ${client.city}` : client.city}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge>{client.status}</Badge>
          <PriorityBadge priority={client.priority} />
        </div>
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Prochaine étape</p>
          <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{client.nextStep}</p>
        </div>
        <button
          type="button"
          onClick={startClientCall}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
        >
          <Phone className="h-4 w-4" />
          Appeler avec IACourtier
        </button>
        {callStatus ? <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{callStatus}</p> : null}
      </section>

      <section className="rounded-lg border border-teal-200 bg-teal-50/70 p-5 shadow-sm dark:border-teal-900 dark:bg-teal-950/30">
        <p className="flex items-center gap-2 text-sm font-semibold text-teal-900 dark:text-teal-100">
          <Sparkles className="h-4 w-4" />
          Actions IA recommandées
        </p>
        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-teal-700 dark:text-teal-300">{aiContext}</p>
        <div className="mt-4 space-y-3">
          {recommendedActions.map((action) => (
            <div key={action.id} className="rounded-lg border border-teal-200/80 bg-white p-4 dark:border-teal-900 dark:bg-slate-950/45">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">{action.label}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{action.description}</p>
                </div>
                {action.primary ? <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-800 dark:bg-teal-900/60 dark:text-teal-100">Prioritaire</span> : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {action.outputs.slice(0, 4).map((output) => (
                  <span key={output} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    {output}
                  </span>
                ))}
                {action.outputs.length > 4 ? <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-500 dark:border-slate-700">+{action.outputs.length - 4}</span> : null}
              </div>
              {action.href ? (
                <Link
                  href={action.href}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
                >
                  {action.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <p className="flex items-center gap-2 text-sm font-semibold text-teal-700 dark:text-teal-300">
          <Bot className="h-4 w-4" />
          Employés IA déclenchés
        </p>
        <div className="mt-4 space-y-3">
          {activeActions.map((action) => (
            <div key={action.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{getEmployeeName(action.employeeId)} · {action.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{action.description}</p>
                </div>
                <StatusBadge status={action.status} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <p className="flex items-center gap-2 text-sm font-semibold text-teal-700 dark:text-teal-300">
          <Clock3 className="h-4 w-4" />
          Timeline complète
        </p>
        <div className="mt-5 space-y-4">
          {client.timeline.map((event) => (
            <div key={event.id} className="relative border-l border-slate-200 pl-4 dark:border-slate-800">
              <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-teal-600 ring-4 ring-white dark:ring-slate-900" />
              <p className="text-sm font-semibold">{event.title}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{event.date}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{event.description}</p>
              {event.employeeId ? <p className="mt-2 text-xs font-semibold text-teal-700 dark:text-teal-300">{getEmployeeName(event.employeeId)} travaille dessus</p> : null}
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

function Badge({ children }: { children: string }) {
  return <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-200 dark:bg-teal-950 dark:text-teal-200 dark:ring-teal-900">{children}</span>;
}

function PriorityBadge({ priority }: { priority: PipelineClient["priority"] }) {
  const className =
    priority === "Élevée"
      ? "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-900"
      : priority === "Moyenne"
        ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-900"
        : "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";

  return <span className={cn("rounded-full px-3 py-1 text-xs font-semibold ring-1", className)}>{priority}</span>;
}

function StatusBadge({ status }: { status: PipelineClient["actions"][number]["status"] }) {
  const Icon = status === "Terminé" ? CheckCircle2 : status === "En cours" ? ArrowRight : FileText;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800">
      <Icon className="h-3.5 w-3.5" />
      {status}
    </span>
  );
}
