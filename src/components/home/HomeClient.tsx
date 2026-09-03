"use client";

import { ActivityChips } from "@/components/home/ActivityChips";
import { DayLog } from "@/components/home/DayLog";
import { ActivitySummary } from "@/components/summary/ActivitySummary";
import { DailyBreakdown } from "@/components/summary/DailyBreakdown";
import { DayTimer } from "@/components/timer/DayTimer";
import { AvatarCircle } from "@/components/ui/AvatarCircle";
import { SpinnerIcon } from "@/components/ui/Icons";
import {
  isSameLocalDay,
  localDateKey,
  localDayBounds,
  overlapSeconds,
  shiftLocalDay,
  startOfLocalDay,
} from "@/lib/datetime";
import type {
  ActiveBlockState,
  ActivityType,
  DaylogProfile,
  DaySummaryRow,
  TimeBlock,
} from "@/types";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type HomeClientProps = {
  profile: DaylogProfile;
  activities: ActivityType[];
  initialActive: ActiveBlockState | null;
};

function activityFromBlock(
  block: TimeBlock,
  activities: ActivityType[],
): { id: string; name: string; color: string } {
  const embedded = Array.isArray(block.activity)
    ? block.activity[0]
    : block.activity;
  if (embedded) {
    return {
      id: embedded.id,
      name: embedded.name,
      color: embedded.color,
    };
  }
  const found = activities.find((a) => a.id === block.activity_type_id);
  return {
    id: block.activity_type_id,
    name: found?.name ?? "Activity",
    color: found?.color ?? "#c8922a",
  };
}

function summarize(
  blocks: TimeBlock[],
  activities: ActivityType[],
  bounds: ReturnType<typeof localDayBounds>,
  nowMs: number,
): DaySummaryRow[] {
  const byId = new Map<string, DaySummaryRow>();
  for (const block of blocks) {
    const seconds = overlapSeconds(
      block.started_at,
      block.ended_at,
      bounds.startMs,
      bounds.endMs,
      nowMs,
    );
    if (seconds <= 0) continue;
    const meta = activityFromBlock(block, activities);
    const prev = byId.get(meta.id);
    if (prev) {
      prev.seconds += seconds;
    } else {
      byId.set(meta.id, {
        activityTypeId: meta.id,
        name: meta.name,
        color: meta.color,
        seconds,
      });
    }
  }
  return [...byId.values()].sort((a, b) => b.seconds - a.seconds);
}

export function HomeClient({
  profile,
  activities: initialActivities,
  initialActive,
}: HomeClientProps) {
  const [activities, setActivities] = useState(initialActivities);
  const [viewDate, setViewDate] = useState(() => startOfLocalDay());
  const [active, setActive] = useState<ActiveBlockState | null>(initialActive);
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialActive?.activityTypeId ??
      initialActivities.find((a) => !a.archived)?.id ??
      null,
  );
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [loadingDay, setLoadingDay] = useState(true);
  const [tick, setTick] = useState(0);
  const cacheRef = useRef(new Map<string, TimeBlock[]>());
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(148);

  const isToday = isSameLocalDay(viewDate);
  const visibleActivities = activities.filter((a) => !a.archived);
  const selected = visibleActivities.find((a) => a.id === selectedId) ?? null;

  const loadDay = useCallback(async (date: Date, useCache: boolean) => {
    const key = localDateKey(date);
    if (useCache) {
      const cached = cacheRef.current.get(key);
      if (cached) setBlocks(cached);
    }

    const bounds = localDayBounds(date);
    const params = new URLSearchParams({
      from: bounds.from,
      to: bounds.to,
    });
    const res = await fetch(`/api/blocks?${params.toString()}`);
    const data = (await res.json()) as {
      blocks?: TimeBlock[];
      active?: ActiveBlockState | null;
    };
    if (!res.ok) return;
    const nextBlocks = data.blocks ?? [];
    cacheRef.current.set(key, nextBlocks);
    setBlocks(nextBlocks);
    if (data.active !== undefined) {
      setActive(data.active);
      if (data.active) setSelectedId(data.active.activityTypeId);
    }
  }, []);

  useEffect(() => {
    setLoadingDay(true);
    void loadDay(viewDate, true).finally(() => setLoadingDay(false));
  }, [viewDate, loadDay]);

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 15000);
    return () => window.clearInterval(id);
  }, [active]);

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const measure = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h > 0) setHeaderHeight(h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rows = useMemo(() => {
    const bounds = localDayBounds(viewDate);
    return summarize(blocks, activities, bounds, Date.now());
  }, [blocks, activities, viewDate, tick, active]);
  const totalSeconds = rows.reduce((sum, row) => sum + row.seconds, 0);
  const dayBounds = localDayBounds(viewDate);

  function onSelect(id: string) {
    if (!isToday) {
      return;
    }
    if (active && id !== active.activityTypeId) {
      setBlockedMessage("End the current block first.");
      window.setTimeout(() => setBlockedMessage(null), 2800);
      return;
    }
    setBlockedMessage(null);
    setSelectedId(id);
  }

  function goToday() {
    setViewDate(startOfLocalDay());
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <header
        ref={headerRef}
        className="fixed inset-x-0 top-0 z-40 mx-auto w-full max-w-[475px] rounded-b-[24px] bg-[rgba(255,250,242,0.97)] shadow-[0px_4px_32px_0px_rgba(200,146,42,0.12)]"
      >
        <div className="flex items-center justify-between px-5 pt-3 pb-0">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[1.4px] text-gold">
              {profile.nickname}
            </p>
            <h1 className="truncate text-lg font-semibold text-ink">
              My Day In Log
            </h1>
          </div>
          <Link
            href="/profile"
            className="size-10 shrink-0 overflow-hidden rounded-full border border-[rgba(200,146,42,0.2)]"
            aria-label="Profile"
          >
            <AvatarCircle
              url={profile.avatar_url}
              alt=""
              className="size-10"
            />
          </Link>
        </div>
        <div className="flex justify-center" aria-hidden>
          <div className="h-px w-1/2 bg-[rgba(200,146,42,0.1)]" />
        </div>
        <DailyBreakdown
          viewDate={viewDate}
          isToday={isToday}
          canGoForward={!isToday}
          rows={rows}
          totalSeconds={totalSeconds}
          onPrev={() => setViewDate((d) => shiftLocalDay(d, -1))}
          onNext={() => {
            if (isToday) return;
            const next = shiftLocalDay(viewDate, 1);
            setViewDate(isSameLocalDay(next) ? startOfLocalDay() : next);
          }}
        />
      </header>

      <div
        className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-40"
        style={{ paddingTop: headerHeight + 12 }}
      >
        {isToday ? (
          <section>
            {editorError ? (
              <p className="mb-2 text-center text-sm text-red-600">
                {editorError}
              </p>
            ) : null}
            <ActivityChips
              activities={visibleActivities}
              selectedId={selectedId}
              runningId={active?.activityTypeId ?? null}
              onSelect={onSelect}
              onAdded={(activity) => {
                setActivities((prev) => [...prev, activity]);
                setSelectedId(activity.id);
                setEditorError(null);
              }}
              onUpdated={(activity) => {
                setActivities((prev) =>
                  prev.map((row) => (row.id === activity.id ? activity : row)),
                );
                setActive((prev) =>
                  prev && prev.activityTypeId === activity.id
                    ? {
                        ...prev,
                        activityName: activity.name,
                        activityColor: activity.color,
                      }
                    : prev,
                );
                setEditorError(null);
              }}
              onDeleted={(id) => {
                setActivities((prev) =>
                  prev.map((row) =>
                    row.id === id ? { ...row, archived: true } : row,
                  ),
                );
                setSelectedId((current) => {
                  if (current !== id) return current;
                  return (
                    visibleActivities.find((row) => row.id !== id)?.id ??
                    null
                  );
                });
                setEditorError(null);
              }}
              onError={setEditorError}
            />
          </section>
        ) : null}

        {loadingDay && blocks.length === 0 ? (
          <div className="flex justify-center py-10">
            <SpinnerIcon size={22} className="text-gold" />
          </div>
        ) : (
          <>
            <ActivitySummary
              blocks={blocks}
              activities={activities}
              bounds={dayBounds}
              nowMs={Date.now()}
            />

            <section>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[1.4px] text-[rgba(28,22,16,0.5)]">
                Log
              </p>
              <DayLog
                blocks={blocks}
                activities={activities}
                bounds={dayBounds}
                nowMs={Date.now()}
              />
            </section>
          </>
        )}
      </div>

      <DayTimer
        selectedActivity={selected}
        active={active}
        canStart={isToday}
        onViewToday={goToday}
        onActiveChange={(next) => {
          setActive(next);
          if (next) setSelectedId(next.activityTypeId);
          setViewDate(startOfLocalDay());
          void loadDay(startOfLocalDay(), false);
        }}
        onBlockSaved={() => {
          cacheRef.current.delete(localDateKey());
          void loadDay(startOfLocalDay(), false);
        }}
        blockedMessage={blockedMessage}
      />
    </div>
  );
}
