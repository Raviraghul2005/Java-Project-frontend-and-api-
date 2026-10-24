/** One colour per subscription category, used for dots, the donut and the allocation bars so a category always looks the same. */
const COLORS: Record<string, string> = {
  entertainment: "#c98aef",
  technology: "#9c85ff",
  lifestyle: "#2fd88a",
  news: "#37cde8",
  sports: "#fb923c",
  finance: "#fbbf24",
  politics: "#f55cb4",
  other: "#94a3b8"
};

const FALLBACK = ["#9c85ff", "#37cde8", "#2fd88a", "#c98aef", "#f55cb4", "#fbbf24", "#fb923c", "#94a3b8"];

/** Colour for a category name in any case; unknown names get a stable colour from their position. */
export function categoryColor(category: string | undefined | null, position = 0): string {
  const key = (category ?? "").trim().toLowerCase();
  return COLORS[key] ?? FALLBACK[Math.abs(position) % FALLBACK.length];
}
