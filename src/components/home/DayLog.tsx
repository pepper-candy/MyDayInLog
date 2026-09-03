"use client";

import { formatClock, overlapSeconds, parseUtcMs } from "@/lib/datetime";
import { formatLoggedShort } from "@/lib/scoring-time";
import type { ActivityType, TimeBlock } from "@/types";

type DayLogProps = {
  blocks: TimeBlock[];
  activities: ActivityType[];
  bounds: { startMs: number; endMs: number };
  nowMs: number;
};

function metaFor(
  block: TimeBlock,
  activities: ActivityType[],
): { name: string; color: string } {
  const embedded = Array.isArray(block.activity)
    ? block.activity[0]
    : block.activity;
  if (embedded) {
    return { name: embedded.name, color: embedded.color };
  }
  const found = activities.find((a) => a.id === block.activity_type_id);
  return {
    name: found?.name ?? "Activity",
    color: found?.color ?? "#c8922a",
  };
}

export function DayLog({ blocks, activities, bounds, nowMs }: DayLogProps) {
  const entries = blocks
    .map((block) => {
      const seconds = overlapSeconds(
        block.started_at,
        block.ended_at,
        bounds.startMs,
        bounds.endMs,
        nowMs,
      );
      return { block, seconds };
    })
    .filter((row) => row.seconds > 0)
    .sort(
      (a, b) => parseUtcMs(a.block.started_at) - parseUtcMs(b.block.started_at),
    );

  if (entries.length === 0) {
    return (
      <p className="rounded-2xl bg-[rgba(240,232,216,0.5)] px-4 py-5 text-center text-sm text-[#8a7a68]">
        Nothing logged this day.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {entries.map(({ block, seconds }) => {
        const meta = metaFor(block, activities);
        const running = !block.ended_at;
        return (
          <article
            key={block.id}
            className="flex overflow-hidden rounded-xl border border-[rgba(200,146,42,0.18)] bg-[rgba(255,250,242,0.95)]"
          >
            <div
              className="w-2 shrink-0"
              style={{ backgroundColor: meta.color }}
              aria-hidden
            />
            <div className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{meta.name}</p>
                <p className="text-[11px] tabular-nums text-[rgba(28,22,16,0.5)]">
                  {formatClock(block.started_at)}
                  {" – "}
                  {running ? "now" : formatClock(block.ended_at as string)}
                </p>
              </div>
              <span className="shrink-0 tabular-nums text-sm text-[rgba(28,22,16,0.55)]">
                {running ? (
                  <span className="font-medium text-gold">
                    {formatLoggedShort(seconds)}
                  </span>
                ) : (
                  formatLoggedShort(seconds)
                )}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
