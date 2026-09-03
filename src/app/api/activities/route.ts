import { NextResponse } from "next/server";
import { ACTIVITY_COLOR_PRESETS, ensureTemplateActivities } from "@/lib/default-activities";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureTemplateActivities(supabase, user.id);
  } catch (err) {
    console.error("Could not ensure template activities", err);
  }

  const { data, error } = await supabase
    .from("daylog_activity_types")
    .select("*")
    .eq("user_id", user.id)
    .order("sort", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ activities: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { name?: string; color?: string };
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const color =
    body.color && /^#[0-9a-fA-F]{6}$/.test(body.color)
      ? body.color
      : ACTIVITY_COLOR_PRESETS[0];

  const { data: last } = await supabase
    .from("daylog_activity_types")
    .select("sort")
    .eq("user_id", user.id)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sort = (last?.sort ?? -1) + 1;

  const { data, error } = await supabase
    .from("daylog_activity_types")
    .insert({
      user_id: user.id,
      name: name.slice(0, 32),
      color,
      sort,
      archived: false,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ activity: data });
}

export async function PATCH(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    id?: string;
    name?: string;
    color?: string;
    archived?: boolean;
    sort?: number;
  };

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    updates.name = name.slice(0, 32);
  }
  if (body.color !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(body.color)) {
      return NextResponse.json({ error: "Invalid color" }, { status: 400 });
    }
    updates.color = body.color;
  }
  if (body.archived !== undefined) {
    updates.archived = Boolean(body.archived);
  }
  if (body.sort !== undefined && Number.isFinite(body.sort)) {
    updates.sort = Math.floor(body.sort);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("daylog_activity_types")
    .update(updates)
    .eq("id", body.id)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  return NextResponse.json({ activity: data });
}
