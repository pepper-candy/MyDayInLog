import type { SupabaseClient } from "@supabase/supabase-js";

function asUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function fetchMilestoneAvatarUrl(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.warn("Could not read Milestone avatar", error.message);
    return null;
  }
  return asUrl(data?.avatar_url);
}

export async function resolveSharedAvatarUrl(
  supabase: SupabaseClient,
  userId: string,
  daylogAvatarUrl?: string | null,
  metadataAvatarUrl?: string | null,
): Promise<string | null> {
  const milestone = await fetchMilestoneAvatarUrl(supabase, userId);
  return milestone ?? asUrl(daylogAvatarUrl) ?? asUrl(metadataAvatarUrl);
}

export async function persistSharedAvatarUrl(
  supabase: SupabaseClient,
  userId: string,
  avatarUrl: string | null,
): Promise<void> {
  const { error: daylogError } = await supabase
    .from("daylog_profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", userId);
  if (daylogError) {
    console.warn("Could not save daylog avatar", daylogError.message);
  }

  const { data: milestone } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (!milestone) return;

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", userId);
  if (error) {
    console.warn("Could not save Milestone avatar", error.message);
  }
}

/** Copy the photo both ways. Milestone wins if both already have one. */
export async function syncSharedAvatarOnLogin(
  supabase: SupabaseClient,
  userId: string,
  daylogAvatarUrl?: string | null,
  metadataAvatarUrl?: string | null,
): Promise<string | null> {
  const milestone = await fetchMilestoneAvatarUrl(supabase, userId);
  const daylog = asUrl(daylogAvatarUrl);
  const resolved = milestone ?? daylog ?? asUrl(metadataAvatarUrl);
  if (!resolved) return null;

  if (daylog !== resolved) {
    const { error } = await supabase
      .from("daylog_profiles")
      .update({ avatar_url: resolved })
      .eq("id", userId);
    if (error) {
      console.warn("Could not sync daylog avatar", error.message);
    }
  }

  if (!milestone) {
    const { data: row } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (row) {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: resolved })
        .eq("id", userId);
      if (error) {
        console.warn("Could not sync Milestone avatar", error.message);
      }
    }
  }

  return resolved;
}
