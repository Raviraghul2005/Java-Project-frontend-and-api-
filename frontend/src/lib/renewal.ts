export type DueTone = "overdue" | "urgent" | "soon" | "later";

export interface DueInfo {
  label: string;
  tone: DueTone;
}

/** Wording and urgency for "N whole days until renewal" (negative = already overdue); null when there is no date. */
export function describeDue(days: number | null): DueInfo | null {
  if (days === null || !Number.isFinite(days)) return null;
  if (days < 0) return { label: "Overdue", tone: "overdue" };
  if (days === 0) return { label: "Due today", tone: "urgent" };
  if (days === 1) return { label: "Due tomorrow", tone: "urgent" };
  if (days <= 3) return { label: `Due in ${days} days`, tone: "urgent" };
  if (days <= 7) return { label: `Due in ${days} days`, tone: "soon" };
  return { label: `Due in ${days} days`, tone: "later" };
}

/** Pill colours for each urgency, shared by the notification bell, the quick-action list and the cards. */
export const DUE_TONE_CLASSES: Record<DueTone, string> = {
  overdue: "bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-400/25",
  urgent: "bg-rose-500/12 text-rose-300 ring-1 ring-inset ring-rose-400/20",
  soon: "bg-amber-400/12 text-amber-300 ring-1 ring-inset ring-amber-300/20",
  later: "bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-300/20"
};
