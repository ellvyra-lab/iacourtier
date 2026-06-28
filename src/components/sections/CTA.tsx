"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/ui/Container";
import { LeadForm } from "./LeadForm";

export function CTA() {
  return (
    <section className="relative overflow-hidden bg-surface py-24">
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          className="signature-edge relative mx-auto max-w-2xl overflow-hidden rounded-3xl bg-gradient-to-br from-ink-950 to-[#0a1a3d] px-8 py-14 text-center text-white sm:px-14"
        >
          <div className="absolute inset-0 -z-10 grid-pattern opacity-10" />
          <p className="mx-auto max-w-xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Prêt à gagner vos premières heures cette semaine ?
          </p>
          <p className="mx-auto mt-4 max-w-md text-balance text-white/70">
            Téléchargez gratuitement le guide complet et découvrez les
            modèles prêts à l&apos;emploi, les 25 erreurs à éviter et les
            outils qui changeront votre pratique.
          </p>
          <div className="mx-auto mt-8 max-w-md">
            <LeadForm source="homepage-final-cta" size="lg" />
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
