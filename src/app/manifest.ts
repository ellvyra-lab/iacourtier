import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "IACourtier",
    short_name: "IACourtier",
    description: "Coach immobilier et parcours de prospection mobile.",
    start_url: "/tableau-de-bord",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0f766e",
    lang: "fr-CA",
    orientation: "portrait",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
