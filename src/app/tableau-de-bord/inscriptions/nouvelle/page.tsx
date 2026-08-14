import Link from "next/link";

import { NewSellerListing } from "@/components/new-seller-listing";

export const metadata = { title: "Nouvelle inscription vendeur | IACourtier" };

export default function NewSellerListingPage() {
  return <div className="space-y-6"><Link href="/tableau-de-bord" className="text-sm font-semibold text-slate-600 dark:text-slate-300">← Retour au Coach IA</Link><NewSellerListing /></div>;
}
