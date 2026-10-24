/** "Sanket Rao" -> "SR"; one word -> its first two letters; empty -> "?". */
export function initialsOf(name: string | undefined | null): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** "Sanket Rao" -> "Sanket". */
export function firstNameOf(name: string | undefined | null): string {
  return (name ?? "").trim().split(/\s+/)[0] || "there";
}
