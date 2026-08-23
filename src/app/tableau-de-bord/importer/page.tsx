import Link from "next/link";

import { UniversalDocumentImporter } from "@/components/universal-document-importer";

export const metadata = { title: "Importer un document ou une conversation | IACourtier" };

export default function UniversalImportPage() {
  return <div className="space-y-6"><Link href="/tableau-de-bord" className="text-sm font-semibold text-slate-600 dark:text-slate-300">← Retour à l’accueil</Link><UniversalDocumentImporter /></div>;
}
