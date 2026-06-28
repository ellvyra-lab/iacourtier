"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { testimonials } from "@/data/testimonials";

export function Testimonials() {
  return (
    <section className="bg-surface-soft py-24">
      <Container>
        <SectionHeading
          eyebrow="Témoignages"
          title="Des courtiers, pas des théoriciens."
          subtitle="Ce que vivent les membres qui ont intégré l'IA dans leur pratique quotidienne."
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
            >
              <Card className="flex h-full flex-col gap-4">
                <div className="flex gap-1 text-cyan-500">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star key={idx} size={14} fill="currentColor" strokeWidth={0} />
                  ))}
                </div>
                <p className="text-sm leading-relaxed">&laquo; {t.quote} &raquo;</p>
                <div className="mt-auto flex items-center gap-3 pt-2">
                  <span className="h-9 w-9 rounded-full bg-gradient-to-br from-electric-400 to-cyan-400" />
                  <div className="text-sm">
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted">{t.role}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
