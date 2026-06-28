import Link from "next/link";
import { Sparkles, Facebook, Instagram, Linkedin, Youtube } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { NewsletterForm } from "@/components/sections/NewsletterForm";

const columns = [
  {
    title: "Produit",
    links: [
      { href: "/guide-gratuit", label: "Guide gratuit" },
      { href: "/assistants-ia", label: "Assistants IA" },
      { href: "/automatisations", label: "Automatisations" },
      { href: "/formations", label: "Formations" },
      { href: "/tarifs", label: "Tarifs" },
    ],
  },
  {
    title: "Ressources",
    links: [
      { href: "/debuter", label: "Débuter" },
      { href: "/ressources-gratuites", label: "Ressources gratuites" },
      { href: "/blog", label: "Académie" },
      { href: "/communaute", label: "Communauté" },
      { href: "/a-propos", label: "À propos" },
    ],
  },
  {
    title: "Entreprise",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/mentions-legales", label: "Mentions légales" },
      { href: "/politique-de-confidentialite", label: "Politique de confidentialité" },
      { href: "/conditions-utilisation", label: "Conditions d'utilisation" },
      { href: "/sitemap.xml", label: "Plan du site" },
    ],
  },
];

const socials = [
  { href: "https://facebook.com", label: "Facebook", icon: Facebook },
  { href: "https://instagram.com", label: "Instagram", icon: Instagram },
  { href: "https://tiktok.com", label: "TikTok", icon: Sparkles },
  { href: "https://linkedin.com", label: "LinkedIn", icon: Linkedin },
  { href: "https://youtube.com", label: "YouTube", icon: Youtube },
];

export function Footer() {
  return (
    <footer className="border-t border-subtle bg-surface-soft">
      <Container className="flex flex-col items-start gap-5 border-b border-subtle py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Restez à jour sur l&apos;IA pour courtiers</p>
          <p className="text-sm text-muted">
            Un courriel par mois, zéro pourriel.
          </p>
        </div>
        <NewsletterForm />
      </Container>

      <Container className="grid gap-12 py-16 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-4">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-electric-500 to-cyan-500 text-white">
              <Sparkles size={16} />
            </span>
            <span>
              IA<span className="text-gradient">Courtier</span>
              <span className="text-muted">.ca</span>
            </span>
          </Link>
          <p className="max-w-xs text-sm text-muted">
            La référence francophone de l&apos;intelligence artificielle pour
            les courtiers immobiliers du Québec.
          </p>
          <div className="flex items-center gap-3">
            {socials.map(({ href, label, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                aria-label={label}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-subtle text-muted transition-colors hover:border-electric-500 hover:text-electric-500"
              >
                <Icon size={16} />
              </Link>
            ))}
          </div>
        </div>

        {columns.map((col) => (
          <div key={col.title} className="flex flex-col gap-3">
            <p className="text-sm font-semibold">{col.title}</p>
            {col.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted transition-colors hover:text-[var(--fg)]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        ))}
      </Container>

      <Container className="flex flex-col items-center justify-between gap-4 border-t border-subtle py-6 text-xs text-muted sm:flex-row">
        <p>© {new Date().getFullYear()} IACourtier.ca — Tous droits réservés.</p>
        <p>Conçu et codé au Québec 🍁</p>
      </Container>
    </footer>
  );
}
