"use client";

import { motion } from "framer-motion";
import { Sparkles, Clock, TrendingUp } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

const reasons = [
  {
    icon: Sparkles,
    title: "Pourquoi IACourtier existe",
    text: "Parce qu'aucune ressource francophone n'expliquait l'IA aux courtiers québécois sans jargon technique, avec des exemples qui ressemblent vraiment à leur métier — Centris, prospection, succession, multiplex.",
  },
  {
    icon: Clock,
    title: "Pourquoi maintenant",
    text: "L'IA générative est devenue accessible à tous en quelques mois seulement. Les courtiers qui l'adoptent aujourd'hui prennent une avance que les autres devront rattraper pendant des années.",
  },
  {
    icon: TrendingUp,
    title: "Pourquoi les courtiers doivent l'apprendre",
    text: "Le métier reste humain — négociation, confiance, connaissance du marché. Mais tout le reste (fiches, courriels, contenu, suivis) peut être délégué, libérant des heures chaque semaine pour ce qui compte vraiment.",
  },
];

export function WhyIACourtier() {
  return (
    <section className="bg-surface-soft py-24">
      <Container>
        <SectionHeading
          eyebrow="Pourquoi IACourtier"
          title="Une mission simple : vous faire gagner du temps."
          subtitle="Pas de promesses miracles. Une explication honnête de pourquoi cette entreprise existe, et pourquoi l'IA n'a jamais été aussi pertinente pour le courtage."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {reasons.map((r, i) => (
            <motion.div
              key={r.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="flex flex-col gap-4 rounded-2xl border border-subtle bg-surface p-7"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-electric-500/15 to-cyan-500/15 text-electric-500">
                <r.icon size={22} />
              </span>
              <p className="text-lg font-semibold">{r.title}</p>
              <p className="text-sm text-muted">{r.text}</p>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
