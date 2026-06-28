"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { assistantsConfig } from "@/data/assistantsConfig";

export function AssistantsShowcase({
  limit,
  showHeading = true,
  showCta = true,
}: {
  limit?: number;
  showHeading?: boolean;
  showCta?: boolean;
}) {
  const items = limit ? assistantsConfig.slice(0, limit) : assistantsConfig;

  return (
    <section className="bg-surface py-24">
      <Container>
        {showHeading && (
          <SectionHeading
            eyebrow="Assistants IA"
            title="Un assistant pour chaque tâche de votre semaine."
            subtitle="Choisissez un résultat, pas un outil compliqué. Chaque assistant fait une chose précise, très bien."
          />
        )}

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a, i) => (
            <motion.div
              key={a.slug}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
              whileHover={{ y: -6 }}
              className="group flex flex-col gap-4 rounded-2xl border border-subtle bg-surface-soft p-7 transition-shadow hover:shadow-glow"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-electric-500/15 to-cyan-500/15 text-2xl">
                {a.emoji}
              </span>
              <p className="text-lg font-semibold leading-snug">{a.title}</p>
              <p className="text-sm font-medium text-electric-500">{a.result}</p>
              <p className="text-sm text-muted">{a.description}</p>
              <Button
                href={`/tableau-de-bord/assistants/${a.slug}`}
                variant="secondary"
                size="sm"
                className="mt-auto w-fit"
              >
                Essayer
                <ArrowUpRight
                  size={14}
                  className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </Button>
            </motion.div>
          ))}
        </div>

        {showCta && (
          <div className="mt-12 flex justify-center">
            <Button href="/assistants-ia" variant="secondary" size="lg">
              Voir tous les assistants
            </Button>
          </div>
        )}
      </Container>
    </section>
  );
}
