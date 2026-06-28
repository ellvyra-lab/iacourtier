"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";

export function NewsletterForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Hook this up to your email provider (Mailchimp, Resend, Beehiiv...) at integration time.
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-cyan-500">
        <Check size={16} /> Merci ! Vérifiez votre boîte de réception.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm gap-2">
      <input
        type="email"
        required
        placeholder="Votre courriel"
        className="w-full rounded-full border border-subtle bg-surface px-4 py-2.5 text-sm outline-none focus-visible:border-electric-500"
      />
      <button
        type="submit"
        aria-label="S'abonner à la newsletter"
        className="flex shrink-0 items-center justify-center gap-1 rounded-full bg-gradient-to-r from-electric-500 to-cyan-500 px-4 py-2.5 text-sm font-medium text-white shadow-glow transition-transform active:scale-95"
      >
        <ArrowRight size={15} />
      </button>
    </form>
  );
}
