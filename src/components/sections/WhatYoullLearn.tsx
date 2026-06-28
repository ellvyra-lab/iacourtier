"use client";

import { motion } from "framer-motion";
import {
  FileText,
  Megaphone,
  Video,
  Workflow,
  Mail,
  PhoneCall,
  Users,
  CalendarClock,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

const items = [
  { icon: FileText, title: "Créer des fiches Centris", text: "Des descriptions complètes et vendeuses en moins de 2 minutes, pour tout type de propriété." },
  { icon: Megaphone, title: "Créer des publications", text: "Du contenu Facebook et Instagram cohérent, planifié pour des semaines à l'avance." },
  { icon: Video, title: "Créer des vidéos", text: "Des scripts de visite et de présentation prêts pour TikTok, Reels et YouTube." },
  { icon: Workflow, title: "Automatiser les suivis", text: "Des relances qui partent toutes seules, sans qu'un client ne tombe dans l'oubli." },
  { icon: Mail, title: "Créer des courriels", text: "Des courriels de bienvenue, de suivi et de relance, rédigés en quelques secondes." },
  { icon: PhoneCall, title: "Prospecter efficacement", text: "Des scripts d'appel adaptés à chaque type de propriétaire, pour des appels qui convertissent." },
  { icon: Users, title: "Qualifier vos leads", text: "Des outils pour identifier rapidement vos prospects les plus susceptibles de transiger." },
  { icon: CalendarClock, title: "Gagner du temps chaque semaine", text: "Une combinaison de prompts et d'automatisations qui libère des heures, chaque semaine." },
];

export function WhatYoullLearn() {
  return (
    <section className="bg-surface py-24">
      <Container>
        <SectionHeading
          eyebrow="Ce que vous apprendrez"
          title="Des compétences concrètes, applicables dès aujourd'hui."
          subtitle="Pas de théorie abstraite — seulement des usages directement liés à votre semaine de courtier."
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: (i % 4) * 0.08 }}
              whileHover={{ y: -4 }}
              className="flex flex-col gap-3 rounded-2xl border border-subtle bg-surface-soft p-6 transition-shadow hover:shadow-glow"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-500/10 text-electric-500">
                <item.icon size={20} />
              </span>
              <p className="font-semibold">{item.title}</p>
              <p className="text-sm text-muted">{item.text}</p>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
