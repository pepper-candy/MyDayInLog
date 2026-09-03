export const SECONDS_PER_DAY = 24 * 60 * 60;

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(" : ");
}

/** Compact logged-time label, e.g. `2h 14m`. */
export function formatLoggedShort(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0 && m === 0) return s > 0 ? `${s}s` : "—";
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Share of a 24-hour day. */
export function formatDayPercent(seconds: number): string {
  const pct = (Math.max(0, seconds) / SECONDS_PER_DAY) * 100;
  if (seconds > 0 && pct < 0.1) return "<0.1%";
  return `${pct.toFixed(1)}%`;
}

/** Share of a total, e.g. today's logged time. */
export function formatSharePercent(seconds: number, total: number): string {
  if (total <= 0 || seconds <= 0) return "0%";
  const pct = (seconds / total) * 100;
  if (pct < 0.1) return "<0.1%";
  return `${pct.toFixed(1)}%`;
}
