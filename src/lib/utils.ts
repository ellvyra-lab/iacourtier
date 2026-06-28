import clsx, { ClassValue } from "clsx";

// Tiny helper to merge conditional class names without pulling in tailwind-merge.
export function cn(...inputs: ClassValue[]) {
  return clsx(...inputs);
}
