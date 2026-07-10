import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Shared class merge helper for future UI primitives.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
