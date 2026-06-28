import Link from "next/link";
import { Mail, MessageCircle, AlertCircle } from "lucide-react";

const faqs = [
  {
    q: "Un assistant affiche « temporairement indisponible », que faire ?",
    a: "Patientez une minute et cliquez sur « Réessayer ». Si le problème persiste plus de quelques minutes, contactez-nous — c'est probablement un enjeu connu de notre côté, pas une erreur de votre part.",
  },
  {
    q: "J'ai atteint ma limite de générations, que se passe-t-il ?",
    a: "Vous pouvez attendre le renouvellement mensuel ou passer à un forfait supérieur immédiatement depuis la page Abonnement — l'accès est rétabli en quelques secondes.",
  },
  {
    q: "Un résultat généré contient une erreur, est-ce normal ?",
    a: "Oui, c'est possible — l'IA peut se tromper sur des détails précis. Relisez toujours le résultat avant de l'utiliser avec un client.",
  },
];

export default function DashboardSupportPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="rounded-2xl border border-subtle bg-surface-soft p-6">
        <p className="mb-4 flex items-center gap-2 font-semibold">
          <MessageCircle size={18} className="text-electric-500" />
          Besoin d&apos;aide ?
        </p>
        <p className="text-sm text-muted">
          Notre équipe répond généralement en moins de 24 heures ouvrables.
        </p>
        <Link
          href="/contact"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-electric-500 to-cyan-500 px-5 py-2.5 text-sm font-medium text-white"
        >
          <Mail size={14} />
          Contacter le support
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {faqs.map((f) => (
          <div key={f.q} className="rounded-2xl border border-subtle bg-surface-soft p-5">
            <p className="flex items-start gap-2 font-medium">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-electric-500" />
              {f.q}
            </p>
            <p className="mt-2 pl-6 text-sm text-muted">{f.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
