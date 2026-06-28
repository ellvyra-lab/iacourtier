"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

const faqs = [
  {
    q: "Est-ce que je dois avoir des connaissances techniques pour utiliser IACourtier.ca ?",
    a: "Non. Toutes nos formations, prompts et automatisations sont conçus pour des courtiers, pas pour des développeurs. Aucune connaissance en programmation n'est requise.",
  },
  {
    q: "Les outils sont-ils adaptés au marché québécois ?",
    a: "Oui, entièrement. Les prompts, modèles de fiches et scripts sont rédigés en français québécois et tiennent compte des réalités du courtage local, dont Centris.",
  },
  {
    q: "Puis-je essayer avant de m'abonner ?",
    a: "Oui. Vous pouvez accéder gratuitement à une sélection de ressources et de prompts pour tester la plateforme avant de choisir un forfait.",
  },
  {
    q: "Est-ce que je peux annuler mon abonnement à tout moment ?",
    a: "Oui, sans aucun engagement à long terme. Vous pouvez modifier ou annuler votre abonnement directement depuis votre tableau de bord membre.",
  },
  {
    q: "Les automatisations fonctionnent-elles avec mon CRM actuel ?",
    a: "La majorité de nos automatisations sont compatibles avec les CRM les plus utilisés par les courtiers québécois. Notre équipe peut vous accompagner pour la configuration.",
  },
  {
    q: "Offrez-vous du soutien si je reste bloqué ?",
    a: "Oui. La communauté et notre équipe de soutien sont disponibles pour répondre à vos questions et vous accompagner dans l'implantation des outils.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="bg-surface py-24">
      <Container className="max-w-3xl">
        <SectionHeading eyebrow="FAQ" title="Questions fréquentes" />

        <div className="mt-12 divide-y divide-[var(--border)] rounded-2xl border border-subtle">
          {faqs.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className="p-6">
                <button
                  className="flex w-full items-center justify-between gap-4 text-left"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <span className="font-medium">{item.q}</span>
                  <motion.span
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-subtle text-electric-500"
                  >
                    <Plus size={14} />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <p className="pt-4 text-sm text-muted">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
