import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";

import { PropertyDescriptionAssistant } from "@/components/property-description-assistant";

export const metadata = {
  title: "Assistant Description de propriété | IACourtier",
};

export default function DescriptionProprietePage() {
  return (
    <div className="space-y-7">
      <Link
        href="/tableau-de-bord/assistants"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-[var(--fg)]"
      >
        <ChevronLeft className="h-4 w-4" />
        Retour aux assistants
      </Link>

      <div>
        <p className="text-sm font-medium text-electric-500">Assistant IA</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Assistant Description de propriété
        </h1>
        <p className="mt-3 max-w-3xl text-muted">
          Créez une description immobilière professionnelle optimisée pour le marché québécois.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="rounded-2xl border border-subtle bg-surface-soft p-6 text-sm text-muted">
            Chargement de l&apos;assistant...
          </div>
        }
      >
        <PropertyDescriptionAssistant />
      </Suspense>
    </div>
  );
}
