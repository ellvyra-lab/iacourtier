import Link from "next/link";
import { assistantsConfig } from "@/data/assistantsConfig";

export default function DashboardAssistantsIndexPage() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {assistantsConfig.map((a) => (
        <Link
          key={a.slug}
          href={`/tableau-de-bord/assistants/${a.slug}`}
          className="group flex flex-col gap-3 rounded-2xl border border-subtle bg-surface-soft p-6 transition-shadow hover:shadow-glow"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-electric-500/15 to-cyan-500/15 text-2xl">
            {a.emoji}
          </span>
          <p className="font-semibold">{a.title}</p>
          <p className="text-sm text-muted">{a.result}</p>
        </Link>
      ))}
    </div>
  );
}
