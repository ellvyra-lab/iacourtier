import { FileText, Download } from "lucide-react";

const downloads = [
  { title: "Guide : 10 prompts essentiels pour courtiers", type: "PDF", date: "21 juin 2026" },
  { title: "Calendrier de contenu 30 jours", type: "Gabarit", date: "21 juin 2026" },
  { title: "Gabarit de fiche Centris", type: "Gabarit", date: "10 juin 2026" },
  { title: "Certificat : IA pour débutants", type: "PDF", date: "15 juin 2026" },
];

export default function DashboardTelechargementsPage() {
  return (
    <div className="flex flex-col gap-3">
      {downloads.map((d) => (
        <div
          key={d.title}
          className="flex items-center justify-between gap-4 rounded-2xl border border-subtle bg-surface-soft p-5"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-electric-500/10 text-electric-500">
              <FileText size={16} />
            </span>
            <div>
              <p className="text-sm font-medium">{d.title}</p>
              <p className="text-xs text-muted">{d.type} · téléchargé le {d.date}</p>
            </div>
          </div>
          <button
            aria-label="Télécharger à nouveau"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-subtle text-muted hover:border-electric-500 hover:text-electric-500"
          >
            <Download size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
