"use client";

import { useRef } from "react";
import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import {
  ArrowRight,
  PlayCircle,
  TrendingUp,
  Mic,
  FileText,
  Star,
  ShieldCheck,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

const benefits = [
  "Plus de mandats signés",
  "Moins de tâches répétitives",
  "Plus de contenu, sans effort",
  "Automatisation de bout en bout",
];

export function Hero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(50);
  const mouseY = useMotionValue(30);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = heroRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(((e.clientX - rect.left) / rect.width) * 100);
    mouseY.set(((e.clientY - rect.top) / rect.height) * 100);
  }

  const glowBackground = useMotionTemplate`radial-gradient(45% 40% at ${mouseX}% ${mouseY}%, rgba(37,99,235,0.22), transparent 70%)`;

  return (
    <section
      ref={heroRef}
      onMouseMove={handleMouseMove}
      className="relative overflow-hidden bg-surface pt-20 pb-24 sm:pt-28"
    >
      <div className="absolute inset-0 -z-10 grid-pattern opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="absolute inset-x-0 top-0 -z-10 h-[640px] bg-hero-glow" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 hidden lg:block"
        style={{ background: glowBackground }}
      />

      <Container className="grid items-center gap-16 lg:grid-cols-[1.05fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="flex flex-col items-start gap-6"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-subtle bg-[var(--bg-soft)] px-4 py-1.5 text-xs font-medium text-muted">
              <span className="flex items-center gap-0.5 text-amber-400">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={11} fill="currentColor" strokeWidth={0} />
                ))}
              </span>
              Déjà adopté par les courtiers innovants
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-electric-500/30 bg-electric-500/10 px-4 py-1.5 text-xs font-medium text-electric-500">
              <ShieldCheck size={13} />
              Conçu par une courtière immobilière québécoise
            </span>
          </div>

          <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            L&apos;IA qui travaille{" "}
            <span className="text-gradient">pendant que vous concluez</span>{" "}
            vos ventes.
          </h1>

          <p className="max-w-xl text-balance text-lg text-muted">
            Le premier écosystème IA conçu exclusivement pour les courtiers
            immobiliers du Québec&nbsp;: plus de mandats, moins de tâches
            répétitives, plus de contenu, et une productivité décuplée.
          </p>

          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {benefits.map((b) => (
              <li key={b} className="flex items-center gap-2 text-muted">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r from-electric-500 to-cyan-500" />
                {b}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Button href="/assistants-ia" size="lg">
              Découvrir les Assistants IA
              <ArrowRight size={16} />
            </Button>
            <Button href="/guide-gratuit" variant="secondary" size="lg">
              <PlayCircle size={18} />
              Recevoir le guide gratuit
            </Button>
          </div>

          <div className="mt-4 flex items-center gap-6 text-sm text-muted">
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="h-9 w-9 rounded-full border-2 border-[var(--bg)] bg-gradient-to-br from-electric-400 to-cyan-400"
                />
              ))}
            </div>
            <span>500+ courtiers utilisent déjà IACourtier.ca</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
          className="relative"
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            className="signature-edge relative rounded-3xl bg-[var(--bg-soft)] p-3 shadow-card"
          >
            <div className="rounded-2xl border border-subtle bg-surface p-5">
              <div className="flex items-center justify-between border-b border-subtle pb-4">
                <p className="text-sm font-medium">Tableau de bord — Prospection IA</p>
                <span className="flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-500">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500" />
                  En direct
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 py-5">
                <div className="rounded-xl border border-subtle p-4">
                  <div className="flex items-center gap-2 text-muted">
                    <TrendingUp size={14} />
                    <span className="text-xs">Mandats potentiels</span>
                  </div>
                  <p className="mt-2 text-2xl font-semibold">128</p>
                </div>
                <div className="rounded-xl border border-subtle p-4">
                  <div className="flex items-center gap-2 text-muted">
                    <FileText size={14} />
                    <span className="text-xs">Descriptions générées</span>
                  </div>
                  <p className="mt-2 text-2xl font-semibold">42</p>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-subtle p-4">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <Mic size={14} />
                  Assistant IA — script d&apos;appel généré
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
                  <motion.div
                    className="h-full bg-gradient-to-r from-electric-500 to-cyan-500"
                    initial={{ width: "10%" }}
                    animate={{ width: "78%" }}
                    transition={{ duration: 1.4, ease: "easeOut", delay: 0.4 }}
                  />
                </div>
                <p className="text-xs text-muted">
                  &laquo; Bonjour Mme Tremblay, je remarque que votre propriété
                  sur la rue Principale pourrait... &raquo;
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="absolute -left-6 -top-6 hidden rounded-2xl border border-subtle bg-surface p-3 shadow-card sm:flex sm:items-center sm:gap-3"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-electric-500/10 text-electric-500">
              <TrendingUp size={16} />
            </span>
            <div className="text-xs">
              <p className="font-medium">+11h / semaine</p>
              <p className="text-muted">économisées en moyenne</p>
            </div>
          </motion.div>
        </motion.div>
      </Container>
    </section>
  );
}
