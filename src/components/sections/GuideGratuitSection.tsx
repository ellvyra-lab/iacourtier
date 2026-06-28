"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { GuideMockup3D } from "./GuideMockup3D";
import { LeadForm } from "./LeadForm";

const benefits = [
  "56 pages, 13 chapitres, zéro jargon technique",
  "30 modèles prêts à copier-coller dans votre assistant IA préféré",
  "Les 25 erreurs qui font perdre du temps — ou un client",
  "3 études de cas réelles, du premier appel à la signature",
  "Le comparatif des 10 meilleurs outils IA de 2026",
];

export function GuideGratuitSection({
  source = "homepage",
}: {
  source?: string;
}) {
  return (
    <section className="relative overflow-hidden bg-ink-950 py-24 text-white">
      <div className="absolute inset-0 -z-10 grid-pattern opacity-15" />
      <div className="absolute left-1/2 top-0 -z-10 h-80 w-80 -translate-x-1/2 rounded-full bg-electric-500/25 blur-3xl" />

      <Container className="grid items-center gap-14 lg:grid-cols-[0.85fr_1.15fr]">
        <GuideMockup3D />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="flex flex-col gap-5"
        >
          <Badge className="border-white/15 bg-white/5 text-white/80">
            Guide gratuit officiel
          </Badge>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            L&apos;IA expliquée aux courtiers immobiliers.
          </h2>
          <p className="text-white/70">
            Le guide complet pour économiser du temps, vendre plus et
            transformer votre pratique grâce à l&apos;intelligence
            artificielle — écrit par une courtière qui l&apos;utilise chaque
            jour depuis des centaines d&apos;heures.
          </p>

          <ul className="flex flex-col gap-2.5">
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm text-white/80">
                <Check size={16} className="mt-0.5 shrink-0 text-cyan-400" />
                {b}
              </li>
            ))}
          </ul>

          <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-5">
            <LeadForm source={source} size="lg" />
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
