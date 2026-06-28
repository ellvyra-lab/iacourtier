import type { Metadata } from "next";
import { Mail, MapPin, Clock } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { ContactForm } from "@/components/sections/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Une question sur les formations, les forfaits ou les assistants IA ? Contactez l'équipe IACourtier.ca.",
};

const infos = [
  { icon: Mail, label: "info@iacourtier.ca" },
  { icon: MapPin, label: "Lanaudière, Québec, Canada" },
  { icon: Clock, label: "Réponse en 24 à 48 heures ouvrables" },
];

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="Une question ? Parlons-en."
        subtitle="Notre équipe répond à toutes vos questions sur les formations, les forfaits et les automatisations."
      />

      <section className="bg-surface py-20">
        <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="flex flex-col gap-6">
            {infos.map((info) => (
              <div key={info.label} className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-electric-500/10 text-electric-500">
                  <info.icon size={18} />
                </span>
                <p className="text-sm text-muted">{info.label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-subtle bg-surface-soft p-8">
            <ContactForm />
          </div>
        </Container>
      </section>
    </>
  );
}
