import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_ACTIVITIES = [
  { name: "Work 💼", plain: "Work", color: "#c8922a", sort: 0 },
  { name: "Study 📚", plain: "Study", color: "#5b8fa8", sort: 1 },
  { name: "Lesson 🎓", plain: "Lesson", color: "#4a7c9b", sort: 2 },
  { name: "Revision 📝", plain: "Revision", color: "#6a8c6a", sort: 3 },
  { name: "Reading 📖", plain: "Reading", color: "#8a6b4a", sort: 4 },
  { name: "Sports ⚽", plain: "Sports", color: "#6a9a5a", sort: 5 },
  { name: "Exercise 💪", plain: "Exercise", color: "#4a7c6a", sort: 6 },
  { name: "Commute 🚌", plain: "Commute", color: "#8a7a68", sort: 7 },
  { name: "Meals 🍽️", plain: "Meals", color: "#c45c4a", sort: 8 },
  { name: "Housework 🧹", plain: "Housework", color: "#9b7ec8", sort: 9 },
  { name: "Social 💬", plain: "Social", color: "#d4a0b0", sort: 10 },
  { name: "Music 🎵", plain: "Music", color: "#c8927a", sort: 11 },
  { name: "Rest 😌", plain: "Rest", color: "#9b7ec8", sort: 12 },
  { name: "Sleep 😴", plain: "Sleep", color: "#5b6a8a", sort: 13 },
] as const;

const RETIRED_TEMPLATE_NAMES = new Set(["errands", "screen", "other"]);

export const ACTIVITY_COLOR_PRESETS = [
  "#c8922a",
  "#5b8fa8",
  "#4a7c9b",
  "#6a8c6a",
  "#8a6b4a",
  "#6a9a5a",
  "#4a7c6a",
  "#8a7a68",
  "#c45c4a",
  "#9b7ec8",
  "#7a8a9a",
  "#d4a0b0",
  "#5c6b8a",
  "#c8927a",
  "#5b6a8a",
];

function nameKey(value: string): string {
  return value.trim().toLowerCase();
}

export async function seedDefaultActivities(
  supabase: SupabaseClient,
  userId: string,
) {
  const { count, error: countError } = await supabase
    .from("daylog_activity_types")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countError) throw countError;
  if ((count ?? 0) > 0) {
    await ensureTemplateActivities(supabase, userId);
    return;
  }

  const { error } = await supabase.from("daylog_activity_types").insert(
    DEFAULT_ACTIVITIES.map((row) => ({
      user_id: userId,
      name: row.name,
      color: row.color,
      sort: row.sort,
      archived: false,
    })),
  );

  if (error) throw error;
}

/** Add, rename, and retire template activities for existing users. */
export async function ensureTemplateActivities(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data: existing, error: loadError } = await supabase
    .from("daylog_activity_types")
    .select("id, name, sort, archived")
    .eq("user_id", userId);

  if (loadError) throw loadError;

  const rows = existing ?? [];
  const byPlain = new Map(
    DEFAULT_ACTIVITIES.map((row) => [nameKey(row.plain), row] as const),
  );

  for (const row of rows) {
    const key = nameKey(String(row.name ?? ""));
    if (RETIRED_TEMPLATE_NAMES.has(key) && !row.archived) {
      const { error } = await supabase
        .from("daylog_activity_types")
        .update({ archived: true })
        .eq("id", row.id)
        .eq("user_id", userId);
      if (error) throw error;
      continue;
    }

    const template = byPlain.get(key);
    if (template && String(row.name) !== template.name) {
      const { error } = await supabase
        .from("daylog_activity_types")
        .update({ name: template.name })
        .eq("id", row.id)
        .eq("user_id", userId);
      if (error) throw error;
    }
  }

  const { data: refreshed, error: refreshError } = await supabase
    .from("daylog_activity_types")
    .select("name, sort, archived")
    .eq("user_id", userId);
  if (refreshError) throw refreshError;

  const have = new Set<string>();
  for (const row of refreshed ?? []) {
    if (row.archived) continue;
    const key = nameKey(String(row.name ?? ""));
    have.add(key);
    const template = byPlain.get(key);
    if (template) have.add(nameKey(template.name));
    for (const item of DEFAULT_ACTIVITIES) {
      if (nameKey(item.name) === key) have.add(nameKey(item.plain));
    }
  }

  const missing = DEFAULT_ACTIVITIES.filter(
    (row) => !have.has(nameKey(row.name)) && !have.has(nameKey(row.plain)),
  );
  if (missing.length === 0) return;

  const maxSort = (refreshed ?? []).reduce(
    (max, row) => Math.max(max, Number(row.sort) || 0),
    -1,
  );

  const { error } = await supabase.from("daylog_activity_types").insert(
    missing.map((row, i) => ({
      user_id: userId,
      name: row.name,
      color: row.color,
      sort: maxSort + 1 + i,
      archived: false,
    })),
  );

  if (error) throw error;
}
