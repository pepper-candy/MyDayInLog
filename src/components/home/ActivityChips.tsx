"use client";

import { ColorTable } from "@/components/ui/ColorTable";
import { ACTIVITY_COLOR_TABLE_DEFAULT } from "@/lib/color-table";
import type { ActivityType } from "@/types";
import { useEffect, useRef, useState } from "react";

type ActivityChipsProps = {
  activities: ActivityType[];
  selectedId: string | null;
  runningId?: string | null;
  onSelect: (id: string) => void;
  onAdded: (activity: ActivityType) => void;
  onUpdated: (activity: ActivityType) => void;
  onDeleted: (id: string) => void;
  onError: (message: string) => void;
};

const LONG_PRESS_MS = 500;
const GOLD = "#c8922a";

export function ActivityChips({
  activities,
  selectedId,
  runningId,
  onSelect,
  onAdded,
  onUpdated,
  onDeleted,
  onError,
}: ActivityChipsProps) {
  const [managing, setManaging] = useState(false);
  const [editing, setEditing] = useState<ActivityType | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(ACTIVITY_COLOR_TABLE_DEFAULT);
  const [saving, setSaving] = useState(false);
  const ignoreClick = useRef(false);
  const pressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (pressTimer.current) window.clearTimeout(pressTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!adding) return;
    const id = window.requestAnimationFrame(() => addInputRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [adding]);

  function clearPress() {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    pressStart.current = null;
  }

  function resetForm() {
    setName("");
    setColor(ACTIVITY_COLOR_TABLE_DEFAULT);
  }

  function openAdd() {
    if (adding) {
      closeAdd();
      return;
    }
    setEditing(null);
    setAdding(true);
    resetForm();
  }

  function closeAdd() {
    setAdding(false);
    resetForm();
  }

  function openEdit(activity: ActivityType) {
    setAdding(false);
    setManaging(true);
    setEditing(activity);
    setName(activity.name);
    setColor(activity.color);
  }

  function closeEdit() {
    setEditing(null);
  }

  function beginPress(activity: ActivityType, clientX: number, clientY: number) {
    clearPress();
    pressStart.current = { x: clientX, y: clientY };
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null;
      ignoreClick.current = true;
      openEdit(activity);
    }, LONG_PRESS_MS);
  }

  async function saveAdd() {
    const nextName = name.trim();
    if (!nextName) return;
    setSaving(true);
    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName, color }),
      });
      const data = (await res.json()) as {
        activity?: ActivityType;
        error?: string;
      };
      if (!res.ok || !data.activity) {
        throw new Error(data.error || "Could not add activity");
      }
      onAdded(data.activity);
      closeAdd();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not add activity");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const nextName = name.trim();
    if (!nextName) return;
    setSaving(true);
    try {
      const res = await fetch("/api/activities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          name: nextName,
          color,
        }),
      });
      const data = (await res.json()) as {
        activity?: ActivityType;
        error?: string;
      };
      if (!res.ok || !data.activity) {
        throw new Error(data.error || "Could not save activity");
      }
      onUpdated(data.activity);
      closeEdit();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not save activity");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEdit() {
    if (!editing) return;
    if (runningId === editing.id) {
      onError("End this block before deleting the activity.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/activities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, archived: true }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not delete activity");
      }
      onDeleted(editing.id);
      closeEdit();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not delete activity");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <p className="min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-[1.4px] text-[rgba(28,22,16,0.5)]">
          Choose activity to start
        </p>
        <button
          type="button"
          onClick={() => {
            if (managing) closeEdit();
            setManaging((v) => !v);
          }}
          className="text-[11px] font-semibold uppercase tracking-[1.4px] text-gold"
        >
          {managing ? "Done" : "Edit"}
        </button>
      </div>

      <div
        className="flex flex-wrap justify-center gap-1.5"
        role="listbox"
        aria-label="Activity types"
      >
        {activities.map((activity) => {
          const selected = !managing && !adding && selectedId === activity.id;
          const running = runningId === activity.id;
          return (
            <button
              key={activity.id}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => {
                if (ignoreClick.current) {
                  ignoreClick.current = false;
                  return;
                }
                if (managing) {
                  openEdit(activity);
                  return;
                }
                closeAdd();
                onSelect(activity.id);
              }}
              onPointerDown={(e) => {
                if (e.pointerType === "mouse" && e.button !== 0) return;
                beginPress(activity, e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                const start = pressStart.current;
                if (!start) return;
                if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) {
                  clearPress();
                }
              }}
              onPointerUp={clearPress}
              onPointerCancel={clearPress}
              className={`inline-flex select-none items-center rounded-full border px-2 py-0.5 text-[13px] font-medium leading-5 transition active:scale-[0.97] ${
                selected
                  ? "border-transparent text-[#fffaf2] shadow-[0px_2px_8px_rgba(200,146,42,0.28)]"
                  : managing
                    ? "border-dashed bg-[rgba(255,250,242,0.95)] text-[rgba(28,22,16,0.78)]"
                    : "bg-[rgba(255,250,242,0.95)] text-[rgba(28,22,16,0.78)]"
              }`}
              style={{
                borderColor: activity.color,
                backgroundColor: selected ? activity.color : undefined,
                boxShadow: running
                  ? `0 0 0 1.5px #4caf50, 0 0 6px #4caf50`
                  : selected
                    ? "0px 2px 8px rgba(200,146,42,0.28)"
                    : undefined,
              }}
            >
              {activity.name}
            </button>
          );
        })}
        <button
          type="button"
          aria-label="Add new activity"
          aria-pressed={adding}
          onClick={openAdd}
          className={`inline-flex select-none items-center rounded-full border border-dashed px-2 py-0.5 text-[13px] font-medium leading-5 transition active:scale-[0.97] ${
            adding
              ? "border-transparent text-[#fffaf2] shadow-[0px_2px_8px_rgba(200,146,42,0.28)]"
              : "bg-[rgba(255,250,242,0.95)] text-gold"
          }`}
          style={{
            borderColor: GOLD,
            backgroundColor: adding ? GOLD : undefined,
          }}
        >
          + Add
        </button>
      </div>

      {adding ? (
        <div className="mt-3 rounded-2xl border border-[rgba(200,146,42,0.22)] bg-[rgba(255,250,242,0.95)] px-3 py-3 shadow-[0px_2px_8px_0px_rgba(200,146,42,0.08)]">
          <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[1.4px] text-[rgba(28,22,16,0.5)]">
            New activity
          </p>
          <input
            ref={addInputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Activity name"
            maxLength={32}
            aria-label="New activity name"
            className="h-10 w-full rounded-xl border border-[rgba(200,146,42,0.2)] bg-warm-bg px-3 text-sm text-ink outline-none focus:border-gold/50"
          />
          <ColorTable value={color} onChange={setColor} />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={closeAdd}
              className="flex-1 rounded-full border border-[rgba(200,146,42,0.25)] px-4 py-2 text-sm font-semibold text-[rgba(28,22,16,0.55)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !name.trim()}
              onClick={() => void saveAdd()}
              className="flex-1 rounded-full bg-[rgba(252,221,166,0.45)] px-4 py-2 text-sm font-semibold text-gold disabled:opacity-50"
            >
              {saving ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      ) : editing ? (
        <div className="mt-3 rounded-2xl border border-[rgba(200,146,42,0.22)] bg-[rgba(255,250,242,0.95)] px-3 py-3 shadow-[0px_2px_8px_0px_rgba(200,146,42,0.08)]">
          <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[1.4px] text-[rgba(28,22,16,0.5)]">
            Edit activity
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={32}
            aria-label="Activity name"
            className="h-10 w-full rounded-xl border border-[rgba(200,146,42,0.2)] bg-warm-bg px-3 text-sm text-ink outline-none focus:border-gold/50"
          />
          <ColorTable value={color} onChange={setColor} />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void deleteEdit()}
              className="rounded-full border border-[rgba(198,40,40,0.25)] px-4 py-2 text-sm font-semibold text-[#c62828] disabled:opacity-50"
            >
              Delete
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={closeEdit}
              className="flex-1 rounded-full border border-[rgba(200,146,42,0.25)] px-4 py-2 text-sm font-semibold text-[rgba(28,22,16,0.55)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !name.trim()}
              onClick={() => void saveEdit()}
              className="flex-1 rounded-full bg-[rgba(252,221,166,0.45)] px-4 py-2 text-sm font-semibold text-gold disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : managing ? (
        <p className="mt-2 text-center text-[11px] text-[rgba(28,22,16,0.45)]">
          Tap a chip to rename, recolor, or delete.
        </p>
      ) : null}
    </div>
  );
}
