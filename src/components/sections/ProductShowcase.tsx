"use client";

import { motion } from "framer-motion";
import {
  Facebook,
  FileText,
  Megaphone,
  Mail,
  Users,
  CalendarCheck2,
  Sparkles,
  Bell,
  TrendingUp,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

const metrics = [
  { icon: Facebook, label: "Facebook Leads", value: "+23", note: "aujourd'hui", tone: "electric" },
  { icon: FileText, label: "Descriptions Centris", value: "42", note: "cette semaine", tone: "cyan" },
  { icon: Megaphone, label: "Publications générées", value: "186", note: "ce mois-ci", tone: "electric" },
  { icon: Mail, label: "Courriels créés", value: "98", note: "ce mois-ci", tone: "cyan" },
  { icon: Users, label: "Pipeline vendeur", value: "12", note: "rendez-vous prévus", tone: "electric" },
  { icon: CalendarCheck2, label: "Calendrier IA", value: "Complet", note: "30 prochains jours", tone: "cyan" },
];

const chartBars = [38, 52, 46, 64, 58, 74, 70, 88];

export function ProductShowcase() {
  return (
    <section className="relative overflow-hidden bg-surface-soft py-24">
      <div className="absolute left-1/2 top-0 -z-0 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
      <Container>
        <SectionHeading
          eyebrow="La plateforme"
          title="Un véritable logiciel, pas une simple liste d'outils."
          subtitle="Tout votre courtage en un coup d'œil : prospection, contenu, suivi client et automatisations, dans une seule interface."
        />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="signature-edge relative mt-14 rounded-3xl bg-[var(--bg)] p-3 shadow-card"
        >
          <div className="rounded-2xl border border-subtle bg-surface p-5 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle pb-5">
              <div>
                <p className="text-sm font-semibold">Tableau de bord — Vue d&apos;ensemble</p>
                <p className="text-xs text-muted">Mise à jour il y a quelques secondes</p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-500">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500" />
                Synchronisé
              </span>
            </div>

            <div className="grid gap-4 py-6 sm:grid-cols-2 lg:grid-cols-3">
              {metrics.map((m, i) => (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.45, delay: i * 0.06 }}
                  whileHover={{ y: -4 }}
                  className="rounded-xl border border-subtle bg-surface-soft p-4 transition-shadow hover:shadow-glow"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={
                        m.tone === "electric"
                          ? "flex h-9 w-9 items-center justify-center rounded-lg bg-electric-500/10 text-electric-500"
                          : "flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-500"
                      }
                    >
                      <m.icon size={16} />
                    </span>
                    <TrendingUp size={14} className="text-muted" />
                  </div>
                  <p className="mt-3 text-2xl font-semibold tracking-tight">{m.value}</p>
                  <p className="text-xs text-muted">
                    {m.label} · {m.note}
                  </p>
                </motion.div>
              ))}
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
              <div className="rounded-xl border border-subtle p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-medium">Activité générée par l&apos;IA</p>
                  <span className="text-xs text-muted">7 derniers jours</span>
                </div>
                <div className="flex h-32 items-end gap-2">
                  {chartBars.map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      whileInView={{ height: `${h}%` }}
                      viewport={{ once: true, margin: "-60px" }}
                      transition={{ duration: 0.6, delay: i * 0.06, ease: "easeOut" }}
                      className="flex-1 rounded-t-md bg-gradient-to-t from-electric-500 to-cyan-400"
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 rounded-xl border border-subtle p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-electric-500/20 to-cyan-500/20 text-electric-500">
                    <Sparkles size={16} />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Assistant IA actif</p>
                    <p className="flex items-center gap-1 text-xs text-muted">
                      En train de rédiger
                      <span className="flex gap-0.5">
                        {[0, 1, 2].map((d) => (
                          <motion.span
                            key={d}
                            className="h-1 w-1 rounded-full bg-electric-500"
                            animate={{ opacity: [0.2, 1, 0.2] }}
                            transition={{
                              duration: 1.1,
                              repeat: Infinity,
                              delay: d * 0.18,
                            }}
                          />
                        ))}
                      </span>
                    </p>
                  </div>
                </div>

                <motion.div
                  initial={{ opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="flex items-start gap-3 rounded-xl border border-electric-500/30 bg-electric-500/5 p-4"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-electric-500/10 text-electric-500">
                    <Bell size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-medium">Nouveau lead qualifié</p>
                    <p className="text-xs text-muted">
                      Marc-André T. — intéressé par une propriété à Terrebonne
                    </p>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
