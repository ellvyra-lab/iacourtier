"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Hooked up to a form endpoint or API route at integration time.
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-subtle bg-surface-soft p-10 text-center">
        <p className="text-lg font-semibold">Message envoyé !</p>
        <p className="mt-2 text-sm text-muted">
          Merci de nous avoir écrit. Nous répondons généralement dans un délai
          de 24 à 48 heures.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-sm font-medium">
            Nom complet
          </label>
          <input
            id="name"
            required
            type="text"
            className="rounded-xl border border-subtle bg-surface-soft px-4 py-3 text-sm outline-none focus-visible:border-electric-500"
            placeholder="Votre nom"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-medium">
            Courriel
          </label>
          <input
            id="email"
            required
            type="email"
            className="rounded-xl border border-subtle bg-surface-soft px-4 py-3 text-sm outline-none focus-visible:border-electric-500"
            placeholder="vous@courtier.ca"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="subject" className="text-sm font-medium">
          Sujet
        </label>
        <input
          id="subject"
          type="text"
          className="rounded-xl border border-subtle bg-surface-soft px-4 py-3 text-sm outline-none focus-visible:border-electric-500"
          placeholder="Comment pouvons-nous vous aider ?"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="message" className="text-sm font-medium">
          Message
        </label>
        <textarea
          id="message"
          required
          rows={5}
          className="rounded-xl border border-subtle bg-surface-soft px-4 py-3 text-sm outline-none focus-visible:border-electric-500"
          placeholder="Votre message..."
        />
      </div>

      <Button type="submit" size="lg" className="w-fit">
        Envoyer le message
        <Send size={16} />
      </Button>
    </form>
  );
}
