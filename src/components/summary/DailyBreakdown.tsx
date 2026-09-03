"use client";

import { formatLongDate } from "@/lib/datetime";
import { SECONDS_PER_DAY } from "@/lib/scoring-time";
import type { DaySummaryRow } from "@/types";

type DailyBreakdownProps = {
  viewDate: Date;
  isToday: boolean;
  canGoForward: boolean;
  rows: DaySummaryRow[];
  totalSeconds: number;
  onPrev: () => void;
  onNext: () => void;
};

export function DailyBreakdown({
  viewDate,
  isToday,
  canGoForward,
  rows,
  totalSeconds,
  onPrev,
  onNext,
}: DailyBreakdownProps) {
  const logged = rows.filter((row) => row.seconds > 0);
  const unlogged = Math.max(0, SECONDS_PER_DAY - totalSeconds);

  return (
    <section className="px-5 pb-4 pt-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrev}
          className="flex size-9 items-center justify-center rounded-full border border-[rgba(200,146,42,0.2)] bg-surface text-gold"
          aria-label="Previous day"
        >
          <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12.5 15 7.5 10l5-5" />
          </svg>
        </button>
        <div className="min-w-0 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[1.4px] text-[rgba(28,22,16,0.5)]">
            {isToday ? "Today" : "Past day"}
          </p>
          <p className="truncate text-sm font-semibold text-ink">
            {formatLongDate(viewDate)}
          </p>
        </div>
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoForward}
          className="flex size-9 items-center justify-center rounded-full border border-[rgba(200,146,42,0.2)] bg-surface text-gold disabled:opacity-30"
          aria-label="Next day"
        >
          <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M7.5 5 12.5 10l-5 5" />
          </svg>
        </button>
      </div>

      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-[rgba(200,146,42,0.12)]"
        aria-hidden
      >
        {logged.map((row) => (
          <div
            key={row.activityTypeId}
            className="h-full min-w-[2px]"
            style={{
              width: `${(row.seconds / SECONDS_PER_DAY) * 100}%`,
              backgroundColor: row.color,
            }}
          />
        ))}
        {unlogged > 0 ? (
          <div className="h-full flex-1 bg-[rgba(200,146,42,0.08)]" />
        ) : null}
      </div>
    </section>
  );
}
