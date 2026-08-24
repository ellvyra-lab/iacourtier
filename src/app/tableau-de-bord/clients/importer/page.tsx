import Link from "next/link";

import { ClientListImporter } from "@/components/client-list-importer";

export const metadata = { title: "Importer ma liste de clients | IACourtier" };

export default function ClientListImportPage() {
  return <div className="space-y-6"><Link href="/tableau-de-bord/clients" className="text-sm font-semibold text-slate-600 dark:text-slate-300">← Retour à Clients & dossiers</Link><ClientListImporter /></div>;
}
