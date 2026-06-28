"use client";

import { motion } from "framer-motion";
import { X, Check } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

const rows = [
  { without: "2 heures pour rédiger une annonce", with: "3 minutes" },
  { without: "4 heures pour créer du contenu", with: "20 minutes" },
  { without: "Courriels écrits à la main", with: "Automatisés" },
  { without: "Aucun système de suivi", with: "IA disponible 24/7" },
];

export function Comparison() {
  return (
    <section className="bg-surface py-24">
      <Container>
        <SectionHeading
          eyebrow="Pourquoi IACourtier"
          title="Sans IA, avec IA Courtier."
          subtitle="La même semaine de travail. Deux résultats complètement différents."
        />

        <div className="mx-auto mt-14 grid max-w-4xl gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-4">
            <p className="text-center text-sm font-semibold text-muted">Sans IA</p>
            {rows.map((row, i) => (
              <motion.div
                key={row.without}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
                className="flex items-center gap-3 rounded-2xl border border-subtle bg-surface-soft p-5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-400">
                  <X size={16} />
                </span>
                <p className="text-sm text-muted">{row.without}</p>
              </motion.div>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            <p className="text-center text-sm font-semibold text-electric-500">
              Avec IA Courtier
            </p>
            {rows.map((row, i) => (
              <motion.div
                key={row.with}
                initial={{ opacity: 0, x: 16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.07 + 0.1 }}
                className="flex items-center gap-3 rounded-2xl border border-electric-500/30 bg-gradient-to-br from-electric-500/[0.06] to-cyan-500/[0.06] p-5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-500">
                  <Check size={16} />
                </span>
                <p className="text-sm font-medium">{row.with}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
