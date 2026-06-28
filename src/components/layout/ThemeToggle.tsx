"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

// Avoids hydration mismatch by only rendering the real icon once mounted.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-9 w-9" aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Activer le mode clair" : "Activer le mode sombre"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-subtle text-[var(--fg)] transition-colors hover:border-electric-500"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
