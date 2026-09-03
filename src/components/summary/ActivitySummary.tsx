"use client";

import { formatClock, overlapSeconds, parseUtcMs } from "@/lib/datetime";
import { formatLoggedShort, formatSharePercent } from "@/lib/scoring-time";
import type { ActivityType, TimeBlock } from "@/types";
import type { PointerEvent } from "react";
import { useMemo, useState } from "react";

type ActivitySummaryProps = {
  blocks: TimeBlock[];
  activities: ActivityType[];
  bounds: { startMs: number; endMs: number };
  nowMs: number;
};

const SIZE = 196;
const CX = SIZE / 2;
const CY = SIZE / 2;
const RADIUS = 86;
const SLICE_GAP = 1.2;

type Slice = {
  id: string;
  name: string;
  color: string;
  seconds: number;
  startedAt: string;
  endedAt: string | null;
  startAngle: number;
  endAngle: number;
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

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function piePath(startAngle: number, endAngle: number): string {
  const sweep = Math.max(0, Math.min(360, endAngle - startAngle));
  if (sweep >= 359.99) {
    const top = polar(CX, CY, RADIUS, 0);
    return [
      `M ${CX} ${CY}`,
      `L ${top.x} ${top.y}`,
      `A ${RADIUS} ${RADIUS} 0 1 1 ${CX - 0.01} ${top.y}`,
      "Z",
    ].join(" ");
  }
  const start = polar(CX, CY, RADIUS, startAngle);
  const end = polar(CX, CY, RADIUS, endAngle);
  const large = sweep > 180 ? 1 : 0;
  return [
    `M ${CX} ${CY}`,
    `L ${start.x} ${start.y}`,
    `A ${RADIUS} ${RADIUS} 0 ${large} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

export function ActivitySummary({
  blocks,
  activities,
  bounds,
  nowMs,
}: ActivitySummaryProps) {
  const entries = useMemo(() => {
    return blocks
      .map((block) => {
        const seconds = overlapSeconds(
          block.started_at,
          block.ended_at,
          bounds.startMs,
          bounds.endMs,
          nowMs,
        );
        const meta = metaFor(block, activities);
        return {
          id: block.id,
          name: meta.name,
          color: meta.color,
          seconds,
          startedAt: block.started_at,
          endedAt: block.ended_at,
        };
      })
      .filter((row) => row.seconds > 0)
      .sort((a, b) => parseUtcMs(a.startedAt) - parseUtcMs(b.startedAt));
  }, [blocks, activities, bounds, nowMs]);

  const totalSeconds = entries.reduce((sum, row) => sum + row.seconds, 0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const focused = entries.find((row) => row.id === focusId) ?? null;

  const slices: Slice[] = useMemo(() => {
    let angle = 0;
    const gap = entries.length > 1 ? SLICE_GAP : 0;
    const usable = Math.max(0, 360 - gap * entries.length);
    return entries.map((row) => {
      const sweep = totalSeconds > 0 ? (row.seconds / totalSeconds) * usable : 0;
      const startAngle = angle;
      const endAngle = angle + sweep;
      angle = endAngle + gap;
      return { ...row, startAngle, endAngle };
    });
  }, [entries, totalSeconds]);

  return (
    <section>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[1.4px] text-[rgba(28,22,16,0.5)]">
        Activity Summary
      </p>
      {entries.length === 0 ? (
        <p className="rounded-2xl bg-[rgba(240,232,216,0.5)] px-4 py-5 text-center text-sm text-[#8a7a68]">
          Nothing logged this day.
        </p>
      ) : (
        <div className="rounded-2xl border border-[rgba(200,146,42,0.18)] bg-[rgba(253,246,236,0.7)] px-3 py-3">
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="mx-auto block size-[196px]"
            role="img"
            aria-label="Each logged block as a share of today's time"
            onMouseLeave={() => setFocusId(null)}
          >
            {slices.map((slice) => {
              const active = focused?.id === slice.id;
              const dimmed = focused != null && !active;
              const sweep = slice.endAngle - slice.startAngle;
              const common = {
                fill: slice.color,
                opacity: dimmed ? 0.45 : 1,
                className: "cursor-pointer transition-opacity",
                onPointerEnter: () => setFocusId(slice.id),
                onPointerDown: (e: PointerEvent<SVGElement>) => {
                  e.preventDefault();
                  setFocusId(slice.id);
                },
              };
              const label = `${slice.name} ${formatClock(slice.startedAt)} – ${
                slice.endedAt ? formatClock(slice.endedAt) : "now"
              } ${formatLoggedShort(slice.seconds)} ${formatSharePercent(slice.seconds, totalSeconds)}`;
              return sweep >= 359.99 ? (
                <circle
                  key={slice.id}
                  cx={CX}
                  cy={CY}
                  r={RADIUS}
                  {...common}
                >
                  <title>{label}</title>
                </circle>
              ) : (
                <path
                  key={slice.id}
                  d={piePath(slice.startAngle, slice.endAngle)}
                  {...common}
                >
                  <title>{label}</title>
                </path>
              );
            })}
          </svg>
          <p className="mt-2 min-h-5 text-center text-[12px] text-[rgba(28,22,16,0.62)]">
            {focused ? (
              <span className="inline-flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: focused.color }}
                  aria-hidden
                />
                <span className="font-medium text-ink">{focused.name}</span>
                <span className="tabular-nums">
                  {formatClock(focused.startedAt)}
                  {" – "}
                  {focused.endedAt ? formatClock(focused.endedAt) : "now"}
                </span>
                <span className="tabular-nums">
                  {formatLoggedShort(focused.seconds)}
                </span>
                <span className="tabular-nums text-gold">
                  {formatSharePercent(focused.seconds, totalSeconds)}
                </span>
              </span>
            ) : (
              <span className="text-[11px] text-[rgba(28,22,16,0.4)]">
                Press a slice for each block
              </span>
            )}
          </p>
        </div>
      )}
    </section>
  );
}
