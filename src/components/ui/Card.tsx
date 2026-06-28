import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "glass rounded-2xl p-6 shadow-card transition-transform duration-300 hover:-translate-y-1",
        className
      )}
    >
      {children}
    </div>
  );
}
