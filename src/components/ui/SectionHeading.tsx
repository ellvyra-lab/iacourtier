import { cn } from "@/lib/utils";
import { Badge } from "./Badge";

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className
      )}
    >
      {eyebrow && <Badge>{eyebrow}</Badge>}
      <h2 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {subtitle && (
        <p className="max-w-2xl text-balance text-base text-muted sm:text-lg">
          {subtitle}
        </p>
      )}
    </div>
  );
}
