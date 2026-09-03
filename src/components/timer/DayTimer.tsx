"use client";

import { DurationClock } from "@/components/ui/DurationClock";
import { SwipeToEnter } from "@/components/ui/SwipeToEnter";
import { useSessionClock } from "@/hooks/useSessionClock";
import type { ActiveBlockState } from "@/types";
import { useEffect, useRef, useState } from "react";

type DayTimerProps = {
  selectedActivity: { id: string; name: string } | null;
  active: ActiveBlockState | null;
  onActiveChange: (next: ActiveBlockState | null) => void;
  onBlockSaved: () => void;
  blockedMessage?: string | null;
  canStart?: boolean;
  onViewToday?: () => void;
};

const DRAG_THRESHOLD = 40;

const sheetShellClass =
  "fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[475px] rounded-t-[24px] bg-[rgba(255,250,242,0.97)] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-[0px_-4px_32px_0px_rgba(200,146,42,0.12)]";

export function DayTimer({
  selectedActivity,
  active,
  onActiveChange,
  onBlockSaved,
  blockedMessage,
  canStart = true,
  onViewToday,
}: DayTimerProps) {
  const [error, setError] = useState<string | null>(null);
  const [swipeKey, setSwipeKey] = useState(0);
  const [claimPending, setClaimPending] = useState(false);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [dragDelta, setDragDelta] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [activeBodyNaturalHeight, setActiveBodyNaturalHeight] = useState(220);

  const dragging = useRef(false);
  const didDrag = useRef(false);
  const startY = useRef(0);
  const dragDeltaRef = useRef(0);
  const sheetCollapsedRef = useRef(sheetCollapsed);
  const activeBodyInnerRef = useRef<HTMLDivElement>(null);

  const elapsed = useSessionClock(
    active?.startedAt ?? null,
    active?.serverNow ?? null,
  );

  useEffect(() => {
    sheetCollapsedRef.current = sheetCollapsed;
  }, [sheetCollapsed]);

  useEffect(() => {
    const inner = activeBodyInnerRef.current;
    if (!inner) return;
    const measure = () =>
      setActiveBodyNaturalHeight(
        Math.max(inner.scrollHeight, inner.getBoundingClientRect().height),
      );
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [sheetCollapsed, active, swipeKey]);

  async function startBlock() {
    if (!canStart) {
      onViewToday?.();
      throw new Error("not today");
    }
    if (!selectedActivity) {
      setError("Pick an activity first");
      throw new Error("no activity");
    }
    setError(null);
    const res = await fetch("/api/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "start",
        activity_type_id: selectedActivity.id,
      }),
    });
    const data = (await res.json()) as {
      active?: ActiveBlockState;
      error?: string;
    };
    if (!res.ok || !data.active) {
      throw new Error(data.error || "Start failed");
    }
    onActiveChange(data.active);
    setSheetCollapsed(false);
  }

  async function endBlock() {
    setClaimPending(true);
    const res = await fetch("/api/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "end" }),
    });
    const data = (await res.json()) as { block?: { id: string }; error?: string };
    if (!res.ok || !data.block) {
      setClaimPending(false);
      throw new Error(data.error || "End failed");
    }
    setSheetCollapsed(false);
    setDragDelta(0);
    setIsDragging(false);
    setSwipeKey((k) => k + 1);
    setClaimPending(false);
    onActiveChange(null);
    setError(null);
    onBlockSaved();
  }

  async function onSwipeComplete() {
    setError(null);
    if (!active) {
      try {
        await startBlock();
        setSwipeKey((k) => k + 1);
      } catch (e) {
        if (e instanceof Error) setError(e.message);
        throw e;
      }
      return;
    }
    try {
      await endBlock();
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      throw e;
    }
  }

  function beginDrag(clientY: number) {
    dragging.current = true;
    didDrag.current = false;
    startY.current = clientY;
    dragDeltaRef.current = 0;
    setDragDelta(0);
    setIsDragging(true);
  }

  function moveDrag(clientY: number) {
    if (!dragging.current) return;
    const delta = clientY - startY.current;
    if (Math.abs(delta) > 6) didDrag.current = true;

    if (sheetCollapsedRef.current) {
      const next = Math.min(0, Math.max(-120, delta));
      dragDeltaRef.current = next;
      setDragDelta(next);
      return;
    }

    if (active && delta > 0) {
      const next = Math.max(0, Math.min(activeBodyNaturalHeight, delta));
      dragDeltaRef.current = next;
      setDragDelta(next);
    }
  }

  function endDrag() {
    if (!dragging.current) return;
    dragging.current = false;
    setIsDragging(false);
    const offset = dragDeltaRef.current;

    if (sheetCollapsedRef.current) {
      if (offset <= -DRAG_THRESHOLD) setSheetCollapsed(false);
      dragDeltaRef.current = 0;
      setDragDelta(0);
      return;
    }

    if (active && offset >= DRAG_THRESHOLD) {
      setSheetCollapsed(true);
    }
    dragDeltaRef.current = 0;
    setDragDelta(0);
  }

  const activeBodyHeight = (() => {
    if (!active) return undefined;
    if (sheetCollapsed) return Math.max(0, -dragDelta);
    if (dragDelta > 0) {
      return Math.max(0, activeBodyNaturalHeight - dragDelta);
    }
    return activeBodyNaturalHeight;
  })();

  const activeBodyOpacity = (() => {
    if (!active) return 1;
    if (sheetCollapsed) {
      return Math.min(1, Math.max(0, -dragDelta / 80));
    }
    if (dragDelta > 0) {
      return Math.max(0, 1 - dragDelta / Math.max(activeBodyNaturalHeight, 1));
    }
    return 1;
  })();

  const compactOpacity = (() => {
    if (!active) return 0;
    if (sheetCollapsed) {
      return Math.max(0, 1 - Math.min(1, -dragDelta / 80));
    }
    if (dragDelta > 0) {
      return Math.min(1, dragDelta / Math.max(activeBodyNaturalHeight * 0.5, 1));
    }
    return 0;
  })();

  const sheetTransition = isDragging
    ? "none"
    : "height 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease";

  function onChromeActivate() {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    if (!active) return;
    setSheetCollapsed((v) => !v);
  }

  function renderHandle() {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={
          sheetCollapsed
            ? "Drag up or tap to expand"
            : "Drag down or tap to collapse"
        }
        className="mb-2 flex cursor-grab touch-none justify-center active:cursor-grabbing"
        onClick={(e) => {
          e.stopPropagation();
          onChromeActivate();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onChromeActivate();
          }
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          beginDrag(e.clientY);
        }}
        onPointerMove={(e) => moveDrag(e.clientY)}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="h-1 w-8 rounded-full bg-[rgba(200,146,42,0.25)]" />
      </div>
    );
  }

  if (claimPending) {
    return (
      <div className={sheetShellClass}>
        <p className="py-4 text-center text-sm text-[#8a7a68]">Wrapping up…</p>
      </div>
    );
  }

  if (!active) {
    if (!canStart) {
      return (
        <div className={sheetShellClass}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[1.68px] text-[#8a7a68]">
            Viewing a past day
          </p>
          <button
            type="button"
            onClick={() => onViewToday?.()}
            className="w-full rounded-full bg-[rgba(252,221,166,0.45)] px-4 py-3 text-sm font-semibold text-gold"
          >
            Back to today
          </button>
        </div>
      );
    }
    const startLabel = selectedActivity
      ? `Start ${selectedActivity.name}`
      : "Pick an activity";
    return (
      <div className={sheetShellClass}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[1.68px] text-[#8a7a68]">
          What are you doing now?
        </p>
        <SwipeToEnter
          key={swipeKey}
          label={startLabel}
          disabled={!selectedActivity}
          onComplete={onSwipeComplete}
        />
        {blockedMessage ? (
          <p className="mt-2 text-center text-sm text-gold">{blockedMessage}</p>
        ) : null}
        {error ? (
          <p className="mt-2 text-center text-sm text-red-600">{error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={sheetShellClass}
      onClick={onChromeActivate}
      role="presentation"
    >
      {renderHandle()}

      <button
        type="button"
        className="mb-1 flex w-full cursor-pointer items-center justify-between pl-1 text-left"
        onClick={(e) => {
          e.stopPropagation();
          onChromeActivate();
        }}
        aria-label={sheetCollapsed ? "Expand timer" : "Collapse timer"}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="size-2 shrink-0 rounded-full bg-[#4caf50] shadow-[0_0_6px_#4caf50]" />
          <span className="truncate text-sm font-semibold uppercase tracking-[1.68px] text-[rgba(28,22,16,0.7)]">
            {active.activityName}
          </span>
        </div>
        <span
          className="shrink-0"
          style={{
            opacity: compactOpacity,
            transition: isDragging ? "none" : "opacity 0.35s ease",
          }}
          aria-hidden={compactOpacity < 0.05}
        >
          <DurationClock
            totalSeconds={elapsed}
            className="font-serif text-lg leading-none tracking-[2.88px] text-gold"
          />
        </span>
      </button>

      <div
        className="overflow-hidden"
        style={{
          height: activeBodyHeight,
          opacity: activeBodyOpacity,
          transition: sheetTransition,
        }}
      >
        <div ref={activeBodyInnerRef}>
          <p
            className="mb-1 text-center text-[11px] font-semibold uppercase tracking-[1.76px] text-[#8a7a68]"
            style={{ color: active.activityColor }}
          >
            {active.activityName}
          </p>
          <p
            className="mb-3 flex items-center justify-center py-2 font-serif text-[48px] leading-none tracking-[2.88px] text-ink"
            aria-live="polite"
          >
            <DurationClock totalSeconds={elapsed} />
          </p>
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <SwipeToEnter
              key={swipeKey}
              label="Swipe to End"
              onComplete={onSwipeComplete}
            />
          </div>
          {error ? (
            <p className="mt-2 text-center text-sm text-red-600">{error}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
