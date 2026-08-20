import Link from "next/link";
import {
  Bot,
  BriefcaseBusiness,
  FileText,
  Home,
  Settings,
  ShieldCheck,
  UsersRound,
  Workflow,
} from "lucide-react";

import { LogoutButton } from "@/components/dashboard/LogoutButton";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const destinations = [
  { href: "/tableau-de-bord", label: "Tester comme courtier", description: "Ouvrir l’accueil courtier normal.", icon: Home },
  { href: "/tableau-de-bord/clients", label: "Clients et dossiers", description: "Gérer les clients, dossiers vendeurs et acheteurs.", icon: UsersRound },
  { href: "/tableau-de-bord/inscriptions/nouvelle", label: "Nouvelle inscription", description: "Créer un parcours vendeur avec ou sans documents.", icon: BriefcaseBusiness },
  { href: "/tableau-de-bord/coach", label: "Coach IA", description: "Accéder au coach et aux outils d’accompagnement.", icon: Bot },
  { href: "/tableau-de-bord/telechargements", label: "Documents", description: "Retrouver les documents et téléchargements.", icon: FileText },
  { href: "/tableau-de-bord/automatisations", label: "Automatisations", description: "Configurer et vérifier les automatisations.", icon: Workflow },
  { href: "/tableau-de-bord/parametres", label: "Paramètres", description: "Gérer le compte et les réglages professionnels.", icon: Settings },
] as const;

export default async function AdminPage() {
  // The layout already fails closed. This second server read supplies only the
  // verified account identity shown in the administration console.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-surface-soft px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-5 rounded-3xl border border-subtle bg-surface p-6 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-electric-500 to-cyan-500 text-white">
              <ShieldCheck size={24} />
            </span>
            <div>
              <p className="text-sm font-semibold text-electric-500">Accès vérifié côté serveur</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">Administration IACourtier</h1>
              <p className="mt-2 text-sm text-muted">
                Compte propriétaire : <strong>{user?.email}</strong> · rôle <strong>super_admin</strong>
              </p>
            </div>
          </div>
          <LogoutButton className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-subtle px-4 text-sm font-semibold hover:border-electric-500 hover:text-electric-500" />
        </header>

        <section aria-labelledby="admin-destinations">
          <div className="mb-4">
            <h2 id="admin-destinations" className="text-xl font-semibold">Fonctions de la plateforme</h2>
            <p className="mt-1 text-sm text-muted">Passe de l’administration au parcours courtier sans changer de compte.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {destinations.map(({ href, label, description, icon: Icon }) => (
              <Link key={href} href={href} className="group rounded-2xl border border-subtle bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-electric-500 hover:shadow-card">
                <Icon size={20} className="text-electric-500" />
                <h3 className="mt-4 font-semibold group-hover:text-electric-500">{label}</h3>
                <p className="mt-2 text-sm text-muted">{description}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

