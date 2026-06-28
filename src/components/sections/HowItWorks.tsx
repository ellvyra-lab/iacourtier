"use client";

import { motion } from "framer-motion";
import { MousePointerClick, MessageCircleQuestion, Sparkles, PenLine } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

const steps = [
  {
    icon: MousePointerClick,
    title: "Choisissez votre Assistant IA",
    text: "Une description, un courriel, une publication — un assistant pour chaque besoin.",
  },
  {
    icon: MessageCircleQuestion,
    title: "Répondez à quelques questions simples",
    text: "Pas de jargon, pas de configuration — juste les détails de votre situation.",
  },
  {
    icon: Sparkles,
    title: "L'Assistant génère le contenu",
    text: "En quelques secondes, un résultat complet, adapté à votre besoin.",
  },
  {
    icon: PenLine,
    title: "Révisez, personnalisez et utilisez",
    text: "Ajoutez votre touche, puis publiez, envoyez ou présentez — c'est prêt.",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-surface-soft py-24">
      <Container>
        <SectionHeading
          eyebrow="Comment ça fonctionne"
          title="Comment IACourtier vous fait gagner du temps"
          subtitle="Quatre étapes simples, du premier clic jusqu'au résultat prêt à utiliser."
        />

        <div className="relative mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="absolute left-0 right-0 top-7 hidden h-px bg-[var(--border)] lg:block" />
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="relative flex flex-col items-center gap-4 text-center"
            >
              <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-electric-500 to-cyan-500 text-white shadow-glow">
                <step.icon size={24} />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-electric-500">
                Étape {i + 1}
              </span>
              <p className="font-semibold">{step.title}</p>
              <p className="text-sm text-muted">{step.text}</p>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
