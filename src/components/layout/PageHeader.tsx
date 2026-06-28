import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-subtle bg-surface-soft py-20">
      <div className="absolute inset-0 -z-10 grid-pattern opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <Container className="flex flex-col items-center gap-5 text-center">
        {eyebrow && <Badge>{eyebrow}</Badge>}
        <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          {title}
        </h1>
        {subtitle && (
          <p className="max-w-2xl text-balance text-lg text-muted">{subtitle}</p>
        )}
      </Container>
    </section>
  );
}
