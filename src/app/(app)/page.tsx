import { HomeClient } from "@/components/home/HomeClient";
import { ensureTemplateActivities } from "@/lib/default-activities";
import { toUtcIso } from "@/lib/datetime";
import { resolveSharedAvatarUrl } from "@/lib/shared-avatar";
import { createClient } from "@/lib/supabase/server";
import type { ActiveBlockState, ActivityType, DaylogProfile } from "@/types";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("daylog_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/login");

  const avatar_url = await resolveSharedAvatarUrl(
    supabase,
    user.id,
    (profile as { avatar_url?: string | null }).avatar_url,
    (user.user_metadata?.avatar_url as string | undefined) ?? null,
  );

  try {
    await ensureTemplateActivities(supabase, user.id);
  } catch (err) {
    console.error("Could not ensure template activities", err);
  }

  const { data: activities } = await supabase
    .from("daylog_activity_types")
    .select("*")
    .eq("user_id", user.id)
    .order("sort", { ascending: true });

  const serverNow = new Date().toISOString();
  const { data: open } = await supabase
    .from("daylog_time_blocks")
    .select(
      "id, activity_type_id, started_at, activity:daylog_activity_types(id, name, color)",
    )
    .eq("user_id", user.id)
    .is("ended_at", null)
    .maybeSingle();

  let initialActive: ActiveBlockState | null = null;
  if (open) {
    const activity = Array.isArray(open.activity)
      ? open.activity[0]
      : open.activity;
    initialActive = {
      blockId: open.id as string,
      activityTypeId: open.activity_type_id as string,
      activityName: activity?.name ?? "Activity",
      activityColor: activity?.color ?? "#c8922a",
      startedAt: toUtcIso(open.started_at as string),
      serverNow,
    };
  }

  return (
    <HomeClient
      profile={{ ...(profile as DaylogProfile), avatar_url }}
      activities={(activities ?? []) as ActivityType[]}
      initialActive={initialActive}
    />
  );
}
