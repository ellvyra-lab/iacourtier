import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { blogPosts } from "@/data/blog";

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const post = blogPosts.find((p) => p.slug === params.slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
  };
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = blogPosts.find((p) => p.slug === params.slug);

  if (!post) {
    notFound();
  }

  return (
    <article className="bg-surface py-16">
      <Container className="max-w-2xl">
        <Link
          href="/blog"
          className="mb-8 flex items-center gap-2 text-sm text-muted hover:text-electric-500"
        >
          <ArrowLeft size={14} /> Retour au blogue
        </Link>

        <span className="text-xs font-medium uppercase tracking-wider text-electric-500">
          {post.category}
        </span>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          {post.title}
        </h1>

        <div className="mt-4 flex items-center gap-5 text-sm text-muted">
          <span className="flex items-center gap-1.5">
            <CalendarDays size={14} />
            {new Date(post.date).toLocaleDateString("fr-CA", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={14} />
            {post.readTime} de lecture
          </span>
        </div>

        <div className="mt-10 flex flex-col gap-5 text-base leading-relaxed text-muted">
          {post.content.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      </Container>
    </article>
  );
}
