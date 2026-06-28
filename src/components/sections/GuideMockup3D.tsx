"use client";

import Image from "next/image";
import { motion } from "framer-motion";

// A lightweight CSS-only "3D book" effect: the cover image tilted in
// perspective with a soft spine shadow and a couple of stacked pages
// peeking out behind it. No 3D library needed.
export function GuideMockup3D() {
  return (
    <div className="relative mx-auto w-full max-w-sm [perspective:1200px]">
      <motion.div
        initial={{ opacity: 0, rotateY: 25, y: 20 }}
        whileInView={{ opacity: 1, rotateY: 18, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        whileHover={{ rotateY: 8 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{ transformStyle: "preserve-3d" }}
        className="relative"
      >
        {/* Stacked pages behind the cover */}
        <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-r-xl bg-[var(--bg-soft)] shadow-card" />
        <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-r-xl bg-surface shadow-card" />

        {/* Cover */}
        <div className="signature-edge relative overflow-hidden rounded-r-xl rounded-l-md shadow-card">
          <Image
            src="/images/guide-cover.jpg"
            alt="Couverture du guide L'IA expliquée aux courtiers immobiliers"
            width={900}
            height={1165}
            className="h-full w-full object-cover"
            priority
          />
          {/* Spine shadow */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-black/40 to-transparent" />
        </div>
      </motion.div>

      <motion.div
        className="absolute -right-6 -top-6 hidden rounded-2xl border border-subtle bg-surface px-4 py-3 shadow-card sm:block"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <p className="text-xs font-semibold text-electric-500">56 pages</p>
        <p className="text-[10px] text-muted">100% gratuit</p>
      </motion.div>
    </div>
  );
}
