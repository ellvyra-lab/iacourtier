"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/Button";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr-CA">
      <body>
        <div className="grid min-h-screen place-items-center bg-white px-6 text-center">
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-2xl font-semibold text-[#0B0F1A]">
              Une erreur inattendue est survenue.
            </h1>
            <p className="max-w-md text-[#5A6685]">
              Notre équipe a été notifiée automatiquement. Veuillez
              rafraîchir la page ou réessayer dans quelques instants.
            </p>
            <Button href="/">Retour à l&apos;accueil</Button>
          </div>
        </div>
      </body>
    </html>
  );
}
