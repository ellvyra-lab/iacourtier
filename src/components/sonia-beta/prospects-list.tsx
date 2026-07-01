"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Phone, UserRound } from "lucide-react";

import { getSoniaProspects, type SoniaProspect } from "@/lib/sonia-beta";

export function ProspectsList() {
  const [prospects, setProspects] = useState<SoniaProspect[]>([]);

  useEffect(() => {
    setProspects(getSoniaProspects());
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Prospects et clients</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Fiches actives</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Tous les prospects créés depuis le Radar et les dossiers de travail bêta.</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {prospects.map((prospect) => (
          <Link key={prospect.id} href={`/tableau-de-bord/prospects/${prospect.id}`} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/72">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-semibold">
                  <UserRound className="h-4 w-4 text-teal-600" />
                  {prospect.name}
                </p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{prospect.address}, {prospect.city}</p>
              </div>
              <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-200 dark:bg-teal-950 dark:text-teal-200 dark:ring-teal-900">{prospect.status}</span>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <Phone className="h-4 w-4" />
              {prospect.nextAction}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
