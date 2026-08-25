"use client";

import Link from "next/link";
import { Building2, ExternalLink, FilePlus2, Megaphone, MoreHorizontal, Pencil, Workflow } from "lucide-react";

export type QuickProperty = { id: string; address?: string | null; city?: string | null; postal_code?: string | null; property_type?: string | null; lot_number?: string | null };

export function PropertyQuickCard({ property, caseId, returnHref, returnLabel, specializedHref, compact = false }: { property: QuickProperty; caseId?: string | null; returnHref?: string; returnLabel?: string; specializedHref?: string | null; compact?: boolean }) {
  const query = new URLSearchParams();
  if (returnHref) query.set("from", returnHref);
  if (returnLabel) query.set("fromLabel", returnLabel);
  const fullHref = `/tableau-de-bord/proprietes/${property.id}${query.toString() ? `?${query.toString()}` : ""}`;
  const caseHref = caseId ? `/tableau-de-bord/dossiers/${caseId}` : "/tableau-de-bord/clients";
  return <article className={compact ? "min-w-0" : "rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"}>
    <div className="flex items-start justify-between gap-3"><Link href={fullHref} className="min-w-0 font-semibold text-slate-950 underline-offset-4 hover:text-teal-700 hover:underline dark:text-white">{property.address || "Adresse à confirmer"}</Link><details className="relative shrink-0"><summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:border-teal-500 hover:text-teal-700 dark:border-slate-700 dark:bg-slate-900" aria-label="Actions rapides de la propriété"><MoreHorizontal className="h-5 w-5" /></summary><div className="absolute right-0 z-20 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900">
      <Action href={fullHref} icon={<ExternalLink className="h-4 w-4" />}>Ouvrir la propriété</Action>
      <Action href={`${fullHref}#modifier`} icon={<Pencil className="h-4 w-4" />}>Modifier</Action>
      <Action href={caseId ? `${caseHref}?add=document#ajouter-source` : "/tableau-de-bord/importer"} icon={<FilePlus2 className="h-4 w-4" />}>Ajouter un document</Action>
      <Action href={caseHref} icon={<Building2 className="h-4 w-4" />}>Voir le dossier</Action>
      <Action href={specializedHref ? `${specializedHref}#marketing` : caseHref} icon={<Megaphone className="h-4 w-4" />}>Marketing</Action>
      <Action href={`${caseHref}#pipeline`} icon={<Workflow className="h-4 w-4" />}>Pipeline</Action>
    </div></details></div>
    <p className="mt-2 text-sm text-slate-500">{[property.city, property.postal_code, property.property_type].filter(Boolean).join(" · ") || "Renseignements à compléter"}</p>
    {property.lot_number ? <p className="mt-1 text-xs text-slate-500">Lot {property.lot_number}</p> : null}
  </article>;
}

function Action({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) { return <Link href={href} className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">{icon}{children}</Link>; }
