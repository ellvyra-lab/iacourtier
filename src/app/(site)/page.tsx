import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, Bot, Check, FileText, Lock, Phone, Radar, Sparkles, Star, Workflow, Zap } from "lucide-react";

import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Radar,
    title: "Radar de prospection",
    text: "Repérez les propriétaires à contacter, débloquez vos opportunités et transformez-les en fiches prospects prêtes à appeler.",
  },
  {
    icon: Phone,
    title: "Appels et suivis",
    text: "Appelez depuis IACourtier, notez le résultat et laissez le Coach proposer la prochaine meilleure action.",
  },
  {
    icon: BarChart3,
    title: "Analyse de marché",
    text: "Préparez vos rencontres vendeurs avec une analyse comparative structurée avant la signature du mandat.",
  },
  {
    icon: FileText,
    title: "Documents vendeur",
    text: "Centralisez certificats, taxes, actes et déclarations pour garder vos mandats propres et exploitables.",
  },
  {
    icon: Bot,
    title: "Actions IA contextuelles",
    text: "Description, réseaux sociaux, textos, courriels et scripts sont proposés selon le statut réel du client.",
  },
  {
    icon: Workflow,
    title: "Pipeline intelligent",
    text: "Suivez le parcours vendeur et acheteur sans vous demander quel assistant ouvrir ensuite.",
  },
];

const reasons = [
  "Les données sont saisies une seule fois et réutilisées partout.",
  "Le Radar ne montre pas toute la base brute : les opportunités sont distribuées selon le forfait.",
  "Le Coach aide à mieux prospecter, répondre aux objections et obtenir des rendez-vous.",
  "Le workflow respecte le vrai processus immobilier québécois.",
];

const plans = [
  {
    name: "Free",
    price: "0$",
    description: "Pour tester IACourtier et débloquer vos premières opportunités.",
    features: ["3 opportunités Radar / semaine", "Coach IA de prospection", "Assistants libres"],
  },
  {
    name: "Pro",
    price: "97$",
    description: "Pour les courtiers qui veulent prospecter et suivre leurs vendeurs chaque semaine.",
    features: ["10 opportunités Radar / semaine", "Pipeline client", "Actions IA contextuelles"],
    highlighted: true,
  },
  {
    name: "Elite",
    price: "197$",
    description: "Pour une pratique active avec plus de prospection, d’analyses et de mise en marché.",
    features: ["25 opportunités Radar / semaine", "Analyse comparative", "Mise en marché IA"],
  },
  {
    name: "Founder",
    price: "Accès bêta",
    description: "Pour les premiers utilisateurs qui participent à la construction du produit.",
    features: ["25 opportunités / semaine", "Accès prioritaire", "Fonctions bêta"],
  },
];

const testimonials = [
  {
    name: "Courtière résidentielle, Lanaudière",
    quote: "Le gros changement, c’est que je sais quoi faire en ouvrant mon tableau de bord. Je ne pars plus d’une page blanche.",
  },
  {
    name: "Courtier immobilier, Laval",
    quote: "Le Radar et les scripts rendent la prospection plus simple. Je peux appeler avec un angle clair sans sonner robotique.",
  },
  {
    name: "Équipe immobilière, Rive-Sud",
    quote: "On voit le potentiel : prospects, appels, suivis, analyse et mise en marché dans un seul parcours.",
  },
];

const faqs = [
  {
    question: "Est-ce qu’IACourtier remplace mon CRM ?",
    answer: "Non. IACourtier est le copilote IA du courtier : prospection, appels, contenus, analyse et préparation de mandat.",
  },
  {
    question: "Le Radar donne-t-il accès à toutes les données ?",
    answer: "Non. Les opportunités sont limitées par forfait et distribuées de façon exclusive pour éviter qu’un même lead soit remis à plusieurs courtiers.",
  },
  {
    question: "Puis-je utiliser IACourtier sans importer de documents ?",
    answer: "Oui. Vous pouvez travailler manuellement, mais l’import de documents reste privilégié quand il est disponible.",
  },
  {
    question: "Est-ce que les textes sont adaptés au Québec ?",
    answer: "Oui. Les assistants sont conçus pour un français québécois professionnel, naturel et utile en courtage immobilier.",
  },
];

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    redirect("/tableau-de-bord");
  }

  return (
    <div className="bg-surface">
      <HeroSection />
      <FeaturesSection />
      <WhySection />
      <PricingSection />
      <DemoSection />
      <TestimonialsSection />
      <FAQSection />
      <FinalCTA />
    </div>
  );
}

function HeroSection() {
  return (
    <section className="overflow-hidden border-b border-subtle bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_34%),radial-gradient(circle_at_80%_10%,rgba(45,212,191,0.18),transparent_32%)]">
      <Container className="grid min-h-[calc(100vh-72px)] items-center gap-10 py-16 lg:grid-cols-[minmax(0,1fr)_520px]">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-subtle bg-surface-soft px-3 py-1 text-sm font-medium text-muted">
            <Sparkles size={16} className="text-electric-500" />
            Copilote IA pour courtiers immobiliers du Québec
          </div>
          <h1 className="mt-6 text-5xl font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
            Ouvrez IACourtier chaque matin et sachez exactement quoi faire.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            Prospectez, appelez, suivez vos vendeurs, préparez vos évaluations et générez votre mise en marché à partir d’un seul centre de travail.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button href="/inscription" size="lg">
              Commencer gratuitement
              <ArrowRight size={18} />
            </Button>
            <Button href="/connexion" variant="secondary" size="lg">
              Connexion
            </Button>
          </div>
          <div className="mt-8 grid max-w-2xl gap-3 text-sm text-muted sm:grid-cols-3">
            <TrustItem>Radar limité par forfait</TrustItem>
            <TrustItem>Coach de prospection</TrustItem>
            <TrustItem>Workflow vendeur complet</TrustItem>
          </div>
        </div>

        <div className="rounded-[2rem] border border-subtle bg-surface-soft p-4 shadow-2xl shadow-cyan-500/10">
          <div className="rounded-[1.5rem] border border-subtle bg-surface p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-electric-500">Plan de bataille aujourd’hui</p>
                <p className="mt-1 text-2xl font-semibold">7 actions prioritaires</p>
              </div>
              <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-600">Sonia Beta</span>
            </div>
            <div className="mt-6 grid gap-3">
              {[
                ["Appeler 3 prospects Radar", "Prospection", "Élevée"],
                ["Préparer analyse de marché", "Rendez-vous vendeur", "Aujourd’hui"],
                ["Demander documents vendeur", "Mandat signé", "À faire"],
                ["Générer mise en marché", "Description + social", "IA"],
              ].map(([title, label, tag]) => (
                <div key={title} className="rounded-2xl border border-subtle bg-surface-soft p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{title}</p>
                      <p className="mt-1 text-sm text-muted">{label}</p>
                    </div>
                    <span className="rounded-full border border-subtle px-2.5 py-1 text-xs text-muted">{tag}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="py-20">
      <Container>
        <SectionIntro eyebrow="Fonctionnalités" title="Tout le quotidien vendeur dans un seul parcours." text="IACourtier relie les modules déjà essentiels : Radar, appels, Coach, analyse, documents, mandat et marketing." />
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-2xl border border-subtle bg-surface-soft p-6">
              <Icon className="h-5 w-5 text-electric-500" />
              <h3 className="mt-5 text-lg font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{text}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

function WhySection() {
  return (
    <section className="border-y border-subtle bg-surface-soft py-20">
      <Container className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <SectionIntro eyebrow="Pourquoi IACourtier" title="Parce que les assistants isolés ne suffisent pas." text="Le produit est organisé autour du parcours du client, pas autour d’une liste d’outils." />
        <div className="grid gap-3">
          {reasons.map((reason) => (
            <div key={reason} className="flex gap-3 rounded-2xl border border-subtle bg-surface p-4">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-cyan-500" />
              <p className="text-sm leading-6 text-muted">{reason}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function PricingSection() {
  return (
    <section id="tarifs" className="py-20">
      <Container>
        <SectionIntro eyebrow="Tarifs" title="Un Radar contrôlé, utile et exclusif." text="Chaque forfait limite le nombre d’opportunités hebdomadaires pour protéger la valeur des leads." />
        <div className="mt-10 grid gap-5 lg:grid-cols-4">
          {plans.map((plan) => (
            <article key={plan.name} className={cn("rounded-2xl border p-6", plan.highlighted ? "border-electric-500/50 bg-electric-500/[0.06] shadow-glow" : "border-subtle bg-surface-soft")}>
              <p className="font-semibold">{plan.name}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">{plan.price}</p>
              <p className="mt-3 text-sm leading-6 text-muted">{plan.description}</p>
              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2 text-sm text-muted">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button href="/inscription" variant={plan.highlighted ? "primary" : "secondary"} className="mt-6 w-full">
                Commencer
              </Button>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

function DemoSection() {
  return (
    <section className="border-y border-subtle bg-surface-soft py-20">
      <Container className="grid gap-10 lg:grid-cols-2">
        <div>
          <SectionIntro eyebrow="Démo" title="Du Radar au mandat signé." text="Le workflow principal est conçu pour être utilisé dans une vraie journée de courtage." />
          <div className="mt-8 space-y-3">
            {["Débloquer une opportunité Radar", "Créer le prospect vendeur", "Appeler avec IACourtier", "Analyser l’appel avec le Coach", "Préparer l’analyse de marché", "Signer le mandat", "Générer la mise en marché"].map((step, index) => (
              <div key={step} className="flex items-center gap-3 rounded-2xl border border-subtle bg-surface p-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-electric-500 text-sm font-semibold text-white">{index + 1}</span>
                <p className="text-sm font-medium">{step}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[2rem] border border-subtle bg-surface p-6">
          <div className="rounded-2xl bg-slate-950 p-5 text-white">
            <p className="text-sm font-semibold text-cyan-300">Coach IA après appel</p>
            <p className="mt-4 text-2xl font-semibold">Prochaine meilleure question</p>
            <p className="mt-3 leading-7 text-slate-300">
              “Qu’est-ce qui vous ferait considérer une évaluation cette semaine, même si vous n’êtes pas encore prêt à vendre ?”
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <DemoStat label="Questions ouvertes" value="4" />
              <DemoStat label="Objectif" value="RDV" />
              <DemoStat label="Relance" value="48 h" />
              <DemoStat label="Ton" value="Naturel" />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="py-20">
      <Container>
        <SectionIntro eyebrow="Témoignages" title="Pensé pour les courtiers qui veulent exécuter." text="Une plateforme de travail quotidienne, pas une simple bibliothèque de prompts." />
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {testimonials.map((item) => (
            <article key={item.name} className="rounded-2xl border border-subtle bg-surface-soft p-6">
              <div className="flex gap-1 text-cyan-500">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} size={16} fill="currentColor" />
                ))}
              </div>
              <p className="mt-5 leading-7 text-muted">“{item.quote}”</p>
              <p className="mt-5 text-sm font-semibold">{item.name}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

function FAQSection() {
  return (
    <section className="border-y border-subtle bg-surface-soft py-20">
      <Container>
        <SectionIntro eyebrow="FAQ" title="Questions fréquentes" text="Les bases pour comprendre comment IACourtier s’insère dans votre pratique." />
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          {faqs.map((faq) => (
            <article key={faq.question} className="rounded-2xl border border-subtle bg-surface p-6">
              <h3 className="font-semibold">{faq.question}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{faq.answer}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="py-20">
      <Container>
        <div className="rounded-[2rem] border border-subtle bg-slate-950 p-8 text-white sm:p-10">
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 text-sm font-semibold text-cyan-300">
              <Zap size={16} />
              Prêt pour votre prochaine journée de prospection
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">Commencez gratuitement et ouvrez votre premier plan de bataille.</h2>
            <p className="mt-4 text-slate-300">Connexion, Radar, Coach, prospects, appels et mise en marché sont prêts à être testés.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href="/inscription" size="lg">Commencer gratuitement</Button>
              <Button href="/connexion" variant="secondary" size="lg">Connexion</Button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function SectionIntro({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold text-electric-500">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      <p className="mt-4 text-base leading-7 text-muted">{text}</p>
    </div>
  );
}

function TrustItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Lock size={16} className="text-cyan-500" />
      <span>{children}</span>
    </div>
  );
}

function DemoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
