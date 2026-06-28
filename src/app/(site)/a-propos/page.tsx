import type { Metadata } from "next";
import Image from "next/image";
import { BadgeCheck, Target, Heart, Eye, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { CredibilityStats } from "@/components/sections/CredibilityStats";

export const metadata: Metadata = {
  title: "À propos",
  description:
    "Découvrez le parcours de Sonia Bernier, courtière immobilière depuis plus de 14 ans et fondatrice d'IACourtier.ca.",
};

const values = [
  {
    icon: Target,
    title: "Concret avant tout",
    text: "Chaque outil est testé dans un vrai contexte de courtage avant d'être publié.",
  },
  {
    icon: BadgeCheck,
    title: "Pensé pour le Québec",
    text: "Du français québécois, des références locales, une compréhension réelle de Centris.",
  },
  {
    icon: Heart,
    title: "Travailler moins, vendre plus",
    text: "L'objectif n'est pas la technologie pour elle-même, mais le temps qu'elle vous rend.",
  },
];

const trustPoints = [
  "800+ heures passées à tester des outils IA en contexte réel de courtage, pas en laboratoire.",
  "500+ courtiers accompagnés personnellement dans l'adoption de l'IA au Québec.",
  "Une seule spécialité : l'IA appliquée au courtage immobilier — pas la technologie en général.",
  "Une courtière active, pas seulement une formatrice : chaque outil est d'abord testé sur ses propres dossiers.",
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="À propos"
        title="Sonia Bernier"
        subtitle="Courtière immobilière depuis plus de 14 ans, experte en IA appliquée au courtage."
      />

      <section className="bg-surface py-20">
        <Container className="grid items-start gap-14 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="relative mx-auto w-full max-w-sm">
            <div className="signature-edge overflow-hidden rounded-3xl">
              <Image
                src="/images/sonia-temp.jpg"
                alt="Sonia Bernier, fondatrice d'IACourtier.ca"
                width={480}
                height={560}
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <p className="text-lg text-muted">
              Sonia Bernier pratique le courtage immobilier résidentiel depuis
              plus de 14 ans dans la région de Lanaudière. Au fil des années,
              elle a vu le métier se transformer&nbsp;: plus de concurrence,
              plus d&apos;exigences, et de moins en moins d&apos;heures dans
              une journée pour tout accomplir.
            </p>
            <p className="text-muted">
              Plutôt que de subir cette transformation, elle a choisi de
              l&apos;utiliser à son avantage. En intégrant l&apos;intelligence
              artificielle dans sa pratique quotidienne, prospection, rédaction
              de fiches, suivi client, contenu, elle a redécouvert ce que
              voulait dire travailler efficacement.
            </p>
            <p className="text-muted">
              IACourtier.ca est né de cette expérience&nbsp;: rendre
              accessible, en français québécois et sans jargon technique, tout
              ce qui lui a permis de reprendre le contrôle de son temps. Sa
              mission est simple&nbsp;: aider les courtiers à travailler
              moins, et à vendre plus.
            </p>
            <Button href="/formations" className="w-fit">
              Découvrir les formations
            </Button>
          </div>
        </Container>
      </section>

      <CredibilityStats />

      <section className="bg-surface py-20">
        <Container>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-subtle bg-surface-soft p-7">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-500/10 text-electric-500">
                <Target size={20} />
              </span>
              <p className="mt-4 font-semibold">Sa mission</p>
              <p className="mt-2 text-sm text-muted">
                Aider les courtiers québécois à économiser du temps,
                développer leur entreprise et adopter l&apos;IA de façon
                concrète, sans jargon technique.
              </p>
            </div>
            <div className="rounded-2xl border border-subtle bg-surface-soft p-7">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-500">
                <Eye size={20} />
              </span>
              <p className="mt-4 font-semibold">Sa vision</p>
              <p className="mt-2 text-sm text-muted">
                Faire d&apos;IACourtier.ca la référence francophone de l&apos;IA
                pour les courtiers immobiliers, partout au Québec.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-subtle bg-surface-soft p-7">
            <p className="mb-4 flex items-center gap-2 font-semibold">
              <ShieldCheck size={18} className="text-electric-500" />
              Pourquoi me faire confiance
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {trustPoints.map((point) => (
                <li key={point} className="flex items-start gap-2 text-sm text-muted">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-electric-500" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <section className="border-t border-subtle bg-surface-soft py-20">
        <Container>
          <div className="grid gap-6 sm:grid-cols-3">
            {values.map((v) => (
              <div
                key={v.title}
                className="rounded-2xl border border-subtle bg-surface p-6"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-500/10 text-electric-500">
                  <v.icon size={20} />
                </span>
                <p className="mt-4 font-semibold">{v.title}</p>
                <p className="mt-2 text-sm text-muted">{v.text}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
