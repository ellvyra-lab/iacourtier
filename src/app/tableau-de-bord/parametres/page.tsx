import { AccountSettingsForm } from "@/components/dashboard/AccountSettingsForm";
import Link from "next/link";

export default function DashboardParametresPage() {
  return <><div className="px-4 py-4"><Link href="/tableau-de-bord/reglages/connexions" className="inline-block rounded-xl border px-4 py-3 text-blue-700">Connexions — Google, Microsoft et Centris</Link></div><AccountSettingsForm /></>;
}
