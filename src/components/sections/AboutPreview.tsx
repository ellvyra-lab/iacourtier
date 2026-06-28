"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Caveat } from "next/font/google";
import { BadgeCheck, Target, Eye, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const caveat = Caveat({ subsets: ["latin"], weight: "600" });

const trustPoints = [
  "800+ heures passées à tester des outils IA en contexte réel de courtage",
  "500+ courtiers accompagnés dans l'adoption de l'IA au Québec",
  "Une seule spécialité : l'IA appliquée au courtage immobilier, pas la technologie en général",
];

export function AboutPreview() {
  return (
    <section className="bg-surface py-24">
      <Container className="grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="relative mx-auto w-full max-w-sm"
        >
          <div className="signature-edge overflow-hidden rounded-3xl">
            <Image
              src="/images/sonia-temp.jpg"
              alt="Sonia Bernier, fondatrice d'IACourtier.ca"
              width={480}
              height={560}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="absolute -bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-subtle bg-surface px-4 py-2 text-xs font-medium shadow-card">
            <BadgeCheck size={14} className="text-electric-500" />
            14+ ans en courtage immobilier
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex flex-col gap-5"
        >
          <Badge>Rencontrez la fondatrice</Badge>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Sonia Bernier
          </h2>
          <p className="text-muted">
            Courtière immobilière depuis plus de 14 ans, dans la région de
            Lanaudière. Experte en intelligence artificielle appliquée au
            courtage immobilier, après des centaines d&apos;heures passées à
            tester ce qui fonctionne vraiment — et ce qui ne fonctionne pas.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-2xl border border-subtle bg-surface-soft p-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-electric-500/10 text-electric-500">
                <Target size={16} />
              </span>
              <div>
                <p className="text-sm font-semibold">Sa mission</p>
                <p className="mt-1 text-sm text-muted">
                  Aider les courtiers québécois à économiser du temps,
                  développer leur entreprise et adopter l&apos;IA de façon
                  concrète.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-subtle bg-surface-soft p-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-500">
                <Eye size={16} />
              </span>
              <div>
                <p className="text-sm font-semibold">Sa vision</p>
                <p className="mt-1 text-sm text-muted">
                  Faire d&apos;IACourtier.ca la référence francophone de
                  l&apos;IA pour les courtiers, partout au Québec.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-subtle bg-surface-soft p-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck size={16} className="text-electric-500" />
              Pourquoi me faire confiance
            </p>
            <ul className="flex flex-col gap-2">
              {trustPoints.map((point) => (
                <li key={point} className="text-sm text-muted">
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <p
            className={`${caveat.className} pt-1 text-3xl text-electric-500`}
          >
            Sonia Bernier
          </p>

          <Button href="/a-propos" variant="secondary" className="w-fit">
            Découvrir son parcours
          </Button>
        </motion.div>
      </Container>
    </section>
  );
}
