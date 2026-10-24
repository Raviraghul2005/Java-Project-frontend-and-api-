/** Joins class names, skipping falsy parts: cn("a", cond && "b") -> "a b" or "a". */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
