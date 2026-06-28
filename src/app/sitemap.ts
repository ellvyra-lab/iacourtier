import type { MetadataRoute } from "next";
import { blogPosts } from "@/data/blog";

const baseUrl = "https://iacourtier.ca";

const staticRoutes = [
  "",
  "/guide-gratuit",
  "/debuter",
  "/assistants-ia",
  "/automatisations",
  "/a-propos",
  "/formations",
  "/bibliotheque-prompts",
  "/ressources-gratuites",
  "/tarifs",
  "/communaute",
  "/blog",
  "/contact",
  "/mentions-legales",
  "/politique-de-confidentialite",
  "/conditions-utilisation",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries = staticRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
  }));

  const blogEntries = blogPosts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.date),
  }));

  return [...staticEntries, ...blogEntries];
}
