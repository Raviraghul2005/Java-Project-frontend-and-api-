import React from "react";
import { buildStrip, StripCell } from "@/lib/cadenceStrip";

interface CadenceStripProps {
  charges: { date: string; grouped: boolean }[];
  firstMonth: string;
  lastMonth: string;
}

const MARK_TEXT: Record<StripCell["mark"], string> = {
  charge: "charged",
  grouped: "charged, part of a grouped debit",
  none: "no charge"
};

/** One dot per month: filled = charged, ringed half-filled = part of a grouped debit, empty = no charge. */
export function CadenceStrip({ charges, firstMonth, lastMonth }: CadenceStripProps) {
  const cells = buildStrip(charges, firstMonth, lastMonth);
  if (cells.length === 0) return null;
  const charged = cells.filter((c) => c.mark !== "none").length;
  const grouped = cells.filter((c) => c.mark === "grouped").length;
  const label = `Charged in ${charged} of ${cells.length} months${grouped > 0 ? `, ${grouped} grouped` : ""}`;

  return (
    <div role="img" aria-label={label} className="flex items-end gap-1.5">
      {cells.map((c) => (
        <div key={c.month} title={`${c.label} ${c.month.slice(0, 4)}: ${MARK_TEXT[c.mark]}`} className="flex flex-col items-center gap-0.5">
          <span
            aria-hidden="true"
            className={
              c.mark === "none"
                ? "size-2.5 rounded-full border border-zinc-700"
                : c.mark === "grouped"
                  ? "size-2.5 rounded-full border-2 border-zinc-300"
                  : "size-2.5 rounded-full bg-zinc-300 border border-zinc-300"
            }
            style={c.mark === "grouped" ? { background: "linear-gradient(90deg, #d4d4d8 50%, transparent 50%)" } : undefined}
          />
          <span aria-hidden="true" className="text-[9px] leading-none text-zinc-600">
            {c.label}
          </span>
        </div>
      ))}
    </div>
  );
}
