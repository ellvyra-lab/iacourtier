import { BarChart3, BookOpen, DoorOpen, Facebook, FileText, Instagram, Mail, Megaphone, Video, type LucideIcon } from "lucide-react";

export type MandateGenerator = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  status: "Disponible" | "Bientôt disponible";
};

export const mandateGenerators: MandateGenerator[] = [
  {
    id: "description-propriete",
    label: "Description de propriété",
    description: "Générer une description professionnelle à partir du mandat.",
    icon: FileText,
    status: "Disponible",
  },
  {
    id: "analyse-comparative",
    label: "Analyse comparative",
    description: "Importez ou saisissez vos comparables et obtenez une synthèse claire pour votre rencontre vendeur.",
    icon: BarChart3,
    status: "Disponible",
  },
  {
    id: "facebook",
    label: "Publication Facebook",
    description: "Préparer une publication sociale liée au mandat.",
    icon: Facebook,
    status: "Disponible",
  },
  {
    id: "instagram",
    label: "Publication Instagram",
    description: "Créer une légende et un angle visuel.",
    icon: Instagram,
    status: "Bientôt disponible",
  },
  {
    id: "tiktok",
    label: "Script TikTok",
    description: "Préparer un script court pour vidéo verticale.",
    icon: Video,
    status: "Bientôt disponible",
  },
  {
    id: "courriel-acheteurs",
    label: "Courriel aux acheteurs",
    description: "Rédiger un courriel pour acheteurs potentiels.",
    icon: Mail,
    status: "Bientôt disponible",
  },
  {
    id: "brochure",
    label: "Brochure",
    description: "Structurer le contenu d'une brochure de propriété.",
    icon: BookOpen,
    status: "Bientôt disponible",
  },
  {
    id: "plan-marketing",
    label: "Plan marketing",
    description: "Planifier la mise en marché du mandat.",
    icon: Megaphone,
    status: "Disponible",
  },
  {
    id: "open-house",
    label: "Open House",
    description: "Préparer les textes pour une visite libre.",
    icon: DoorOpen,
    status: "Bientôt disponible",
  },
];
