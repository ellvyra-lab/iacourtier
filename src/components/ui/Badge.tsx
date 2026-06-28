import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-subtle bg-[var(--bg-soft)] px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-muted",
        className
      )}
    >
      {children}
    </span>
  );
}
