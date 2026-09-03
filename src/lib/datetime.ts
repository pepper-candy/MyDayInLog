/**
 * Timestamps are stored as UTC. Postgres TIMESTAMP without time zone (and some
 * Supabase serializations) omit the offset; browsers then treat bare ISO strings
 * as *local* time — in HKT that adds ~8 hours of false elapsed.
 */
export function toUtcIso(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();

  const trimmed = value.trim();
  if (!trimmed) return new Date(NaN).toISOString();

  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    return new Date(trimmed).toISOString();
  }

  const normalized = trimmed.includes("T")
    ? trimmed
    : trimmed.replace(" ", "T");
  return new Date(`${normalized}Z`).toISOString();
}

export function parseUtcMs(value: string | Date): number {
  return new Date(toUtcIso(value)).getTime();
}

/** Local calendar-day window (browser / server local TZ). */
export function localDayBounds(now: Date = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    from: start.toISOString(),
    to: end.toISOString(),
    startMs: start.getTime(),
    endMs: end.getTime(),
  };
}

export function startOfLocalDay(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function shiftLocalDay(date: Date, days: number): Date {
  const next = startOfLocalDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** YYYY-MM-DD in the runtime local timezone. */
export function localDateKey(date: Date = new Date()): string {
  const d = startOfLocalDay(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isSameLocalDay(a: Date, b: Date = new Date()): boolean {
  return localDateKey(a) === localDateKey(b);
}

/** Seconds of a block that overlap [startMs, endMs). Open blocks use nowMs. */
export function overlapSeconds(
  startedAt: string,
  endedAt: string | null,
  startMs: number,
  endMs: number,
  nowMs: number,
): number {
  const start = parseUtcMs(startedAt);
  const end = endedAt ? parseUtcMs(endedAt) : nowMs;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  const overlapStart = Math.max(start, startMs);
  const overlapEnd = Math.min(end, endMs);
  return Math.max(0, Math.floor((overlapEnd - overlapStart) / 1000));
}

/** e.g. "Thursday, 3 September" in the runtime locale. */
export function formatLongDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

/** Local clock time, e.g. "9:14 AM". */
export function formatClock(value: string | Date): string {
  const ms = parseUtcMs(value);
  if (!Number.isFinite(ms)) return "—";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}
