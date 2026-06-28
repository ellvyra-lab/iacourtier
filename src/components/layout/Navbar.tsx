"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Accueil", emoji: "🏠" },
  { href: "/debuter", label: "Débuter", emoji: "🚀" },
  { href: "/assistants-ia", label: "Assistants IA", emoji: "🤖" },
  { href: "/automatisations", label: "Automatisations", emoji: "⚡" },
  { href: "/blog", label: "Académie", emoji: "📚" },
  { href: "/ressources-gratuites", label: "Ressources", emoji: "🛠" },
  { href: "/communaute", label: "Communauté", emoji: "👥" },
  { href: "/contact", label: "Contact", emoji: "📞" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-shadow duration-300",
        "bg-[var(--bg)]/75 backdrop-blur-xl",
        scrolled
          ? "border-subtle shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)]"
          : "border-transparent shadow-none"
      )}
    >
      <Container className="flex h-18 items-center justify-between py-3 xl:px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-electric-500 to-cyan-500 text-white">
            ✦
          </span>
          <span>
            IA<span className="text-gradient">Courtier</span>
            <span className="text-muted">.ca</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 xl:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-2 text-[12.5px] text-muted transition-colors hover:bg-[var(--bg-soft)] hover:text-[var(--fg)]"
            >
              <span aria-hidden>{link.emoji}</span>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-1.5 xl:flex">
          <ThemeToggle />
          <Button href="/connexion" variant="ghost" size="sm" className="whitespace-nowrap !px-2.5 !text-[13px]">
            Connexion
          </Button>
          <Button href="/inscription" size="sm" className="whitespace-nowrap !px-3 !text-[12.5px]">
            Commencer gratuitement
          </Button>
        </div>

        <button
          className="flex items-center justify-center rounded-full border border-subtle p-2 xl:hidden"
          aria-label="Ouvrir le menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </Container>

      {open && (
        <div className="border-t border-subtle bg-[var(--bg)] xl:hidden">
          <Container className="flex flex-col gap-2 py-6">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 text-base text-muted hover:text-[var(--fg)]"
              >
                <span aria-hidden>{link.emoji}</span>
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center gap-3">
              <ThemeToggle />
              <Button href="/connexion" variant="secondary" size="sm" className="flex-1">
                Connexion
              </Button>
            </div>
            <Button href="/inscription" size="md">
              Commencer gratuitement
            </Button>
          </Container>
        </div>
      )}
    </header>
  );
}
