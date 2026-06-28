"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { CheckCircle2, Download } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

const GUIDE_PATH = "/downloads/guide-ia-courtiers-immobiliers.pdf";

export default function MerciPage() {
  const downloadRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    // Auto-trigger the download once, right when the page lands.
    downloadRef.current?.click();
  }, []);

  return (
    <section className="grid min-h-[calc(100vh-72px)] place-items-center bg-surface-soft py-16">
      <Container className="max-w-lg">
        <div className="flex flex-col items-center gap-5 rounded-3xl border border-subtle bg-surface p-10 text-center shadow-card">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-500">
            <CheckCircle2 size={28} />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">
            Merci ! Votre guide est en route.
          </h1>
          <p className="text-muted">
            Le téléchargement devrait démarrer automatiquement dans quelques
            secondes. Si rien ne se passe, cliquez simplement sur le bouton
            ci-dessous.
          </p>

          <a
            ref={downloadRef}
            href={GUIDE_PATH}
            download
            className="hidden"
            aria-hidden
          >
            télécharger
          </a>

          <Button href={GUIDE_PATH} size="lg" className="w-full justify-center">
            <Download size={16} />
            Télécharger le guide maintenant
          </Button>

          <div className="mt-2 flex flex-col gap-2 text-sm text-muted">
            <p>En attendant, jetez un œil à :</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/formations" className="text-electric-500 hover:underline">
                Nos formations
              </Link>
              <span>·</span>
              <Link href="/assistants-ia" className="text-electric-500 hover:underline">
                Nos Assistants IA
              </Link>
              <span>·</span>
              <Link href="/ressources-gratuites" className="text-electric-500 hover:underline">
                Plus de ressources
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
