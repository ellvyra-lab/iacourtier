"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function LeadForm({
  source,
  size = "md",
  buttonLabel = "Télécharger le guide gratuit",
  className,
}: {
  source: string;
  size?: "md" | "lg";
  buttonLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, source }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setStatus("error");
        setError(data.error || "Une erreur est survenue. Veuillez réessayer.");
        return;
      }

      // Hand off to the thank-you page, which triggers the actual PDF
      // download — keeps this component simple and gives a real URL
      // people can land on from an email link too.
      router.push(
        `/merci?guide=1&email=${encodeURIComponent(email)}`
      );
    } catch {
      setStatus("error");
      setError("Impossible de contacter le serveur. Veuillez réessayer.");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-3", className)}
    >
      <div className={cn("flex flex-col gap-3", size === "lg" && "sm:flex-row")}>
        <input
          type="text"
          required
          placeholder="Votre prénom"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-full border border-subtle bg-surface px-5 py-3 text-sm outline-none focus-visible:border-electric-500"
        />
        <input
          type="email"
          required
          placeholder="Votre courriel"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-full border border-subtle bg-surface px-5 py-3 text-sm outline-none focus-visible:border-electric-500"
        />
      </div>

      <Button
        type="submit"
        size={size}
        className="w-full justify-center"
      >
        {status === "loading" ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Envoi en cours...
          </>
        ) : (
          <>
            <Download size={16} />
            {buttonLabel}
          </>
        )}
      </Button>

      {status === "error" && (
        <p className="text-center text-xs text-red-500">{error}</p>
      )}

      <p className="text-center text-[11px] text-muted">
        Aucun pourriel. Désabonnement en un clic, à tout moment.
      </p>
    </form>
  );
}
