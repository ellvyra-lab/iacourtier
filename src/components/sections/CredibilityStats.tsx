"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/ui/Container";
import { CountUp } from "@/components/ui/CountUp";
import { credibilityStats } from "@/data/stats";

export function CredibilityStats() {
  return (
    <section className="border-y border-subtle bg-surface py-16">
      <Container>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {credibilityStats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="text-center"
            >
              <p className="text-3xl font-semibold tracking-tight text-gradient sm:text-4xl">
                <CountUp value={stat.value} suffix={stat.suffix} />
              </p>
              <p className="mt-1 text-xs text-muted sm:text-sm">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
