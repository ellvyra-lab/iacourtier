import type { Metadata } from "next";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const siteUrl = "https://iacourtier.ca";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "IACourtier.ca — L'IA au service des courtiers immobiliers",
    template: "%s | IACourtier.ca",
  },
  description:
    "La référence francophone de l'intelligence artificielle pour les courtiers immobiliers du Québec. Formations, prompts, automatisations et GPT spécialisés pour vendre plus en travaillant moins.",
  keywords: [
    "IA immobilier",
    "intelligence artificielle courtier",
    "formation IA Québec",
    "ChatGPT immobilier",
    "automatisation courtier immobilier",
    "prospection IA",
  ],
  authors: [{ name: "Sonia Bernier" }],
  openGraph: {
    type: "website",
    locale: "fr_CA",
    url: siteUrl,
    siteName: "IACourtier.ca",
    title: "IACourtier.ca — L'IA au service des courtiers immobiliers",
    description:
      "Gagnez des heures chaque semaine grâce aux meilleures stratégies d'IA adaptées au marché immobilier québécois.",
    images: [{ url: "/images/og-cover.jpg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "IACourtier.ca — L'IA au service des courtiers immobiliers",
    description:
      "Formations, prompts et automatisations IA pensés pour les courtiers immobiliers du Québec.",
  },
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr-CA" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
