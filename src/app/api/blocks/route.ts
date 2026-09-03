import { NextResponse } from "next/server";
import { parseUtcMs, toUtcIso } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";
import type { ActiveBlockState, TimeBlock } from "@/types";

type ActivityEmbed = { id: string; name: string; color: string };

type BlockRow = {
  id: string;
  user_id: string;
  activity_type_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  note: string | null;
  activity?: ActivityEmbed | ActivityEmbed[] | null;
};

function unwrapActivity(
  activity: BlockRow["activity"],
): ActivityEmbed | null {
  if (!activity) return null;
  return Array.isArray(activity) ? (activity[0] ?? null) : activity;
}

function asBlockRow(row: unknown): BlockRow {
  return row as BlockRow;
}

function toTimeBlock(row: BlockRow): TimeBlock {
  return {
    id: row.id,
    user_id: row.user_id,
    activity_type_id: row.activity_type_id,
    started_at: row.started_at,
    ended_at: row.ended_at,
    duration_seconds: row.duration_seconds,
    note: row.note,
    activity: unwrapActivity(row.activity),
  };
}

function toActive(row: BlockRow, serverNow: string): ActiveBlockState {
  const activity = unwrapActivity(row.activity);
  return {
    blockId: row.id,
    activityTypeId: row.activity_type_id,
    activityName: activity?.name ?? "Activity",
    activityColor: activity?.color ?? "#c8922a",
    startedAt: toUtcIso(row.started_at),
    serverNow,
  };
}

function isUniqueViolation(error: { code?: string; message?: string }) {
  return (
    error.code === "23505" ||
    /duplicate key|unique constraint/i.test(error.message ?? "")
  );
}

const BLOCK_SELECT =
  "id, user_id, activity_type_id, started_at, ended_at, duration_seconds, note, activity:daylog_activity_types(id, name, color)";

async function fetchOpenBlock(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  return supabase
    .from("daylog_time_blocks")
    .select(BLOCK_SELECT)
    .eq("user_id", userId)
    .is("ended_at", null)
    .maybeSingle();
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serverNow = new Date().toISOString();
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const { data: open, error: openError } = await fetchOpenBlock(
    supabase,
    user.id,
  );
  if (openError) {
    return NextResponse.json({ error: openError.message }, { status: 500 });
  }

  const openRow = open ? asBlockRow(open) : null;
  const active = openRow ? toActive(openRow, serverNow) : null;

  let blocks: TimeBlock[] = [];
  if (from && to) {
    const { data, error } = await supabase
      .from("daylog_time_blocks")
      .select(BLOCK_SELECT)
      .eq("user_id", user.id)
      .not("ended_at", "is", null)
      .gte("ended_at", from)
      .lt("started_at", to)
      .order("started_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const ended = (data ?? []).map((row) => toTimeBlock(asBlockRow(row)));
    const openOverlaps =
      openRow != null && Date.parse(toUtcIso(openRow.started_at)) < Date.parse(to);
    blocks = openOverlaps && openRow ? [toTimeBlock(openRow), ...ended] : ended;
  }

  return NextResponse.json({ active, serverNow, blocks });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { action?: "start" | "end"; activity_type_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.action === "start") {
    const activityTypeId = body.activity_type_id?.trim();
    if (!activityTypeId) {
      return NextResponse.json(
        { error: "Pick an activity first" },
        { status: 400 },
      );
    }

    const { data: activity, error: activityError } = await supabase
      .from("daylog_activity_types")
      .select("id, name, color, archived")
      .eq("id", activityTypeId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (activityError) {
      return NextResponse.json({ error: activityError.message }, { status: 500 });
    }
    if (!activity || activity.archived) {
      return NextResponse.json(
        { error: "Activity not found" },
        { status: 400 },
      );
    }

    const { data: existing, error: existingError } = await fetchOpenBlock(
      supabase,
      user.id,
    );
    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 500 },
      );
    }
    if (existing) {
      return NextResponse.json(
        { error: "A block is already running. End it first." },
        { status: 409 },
      );
    }

    const startedAt = new Date().toISOString();
    const { data: inserted, error: insertError } = await supabase
      .from("daylog_time_blocks")
      .insert({
        user_id: user.id,
        activity_type_id: activity.id,
        started_at: startedAt,
      })
      .select(BLOCK_SELECT)
      .single();

    if (insertError) {
      if (isUniqueViolation(insertError)) {
        return NextResponse.json(
          { error: "A block is already running. End it first." },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const insertedRow = asBlockRow(inserted);
    return NextResponse.json({
      active: toActive(insertedRow, startedAt),
      block: toTimeBlock(insertedRow),
    });
  }

  if (body.action === "end") {
    const { data: open, error: openError } = await fetchOpenBlock(
      supabase,
      user.id,
    );
    if (openError) {
      return NextResponse.json({ error: openError.message }, { status: 500 });
    }
    if (!open) {
      return NextResponse.json({ error: "No active block" }, { status: 404 });
    }

    const endedAt = new Date();
    const durationSeconds = Math.max(
      0,
      Math.floor((endedAt.getTime() - parseUtcMs(open.started_at)) / 1000),
    );

    const { data: updated, error: endError } = await supabase
      .from("daylog_time_blocks")
      .update({
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
      })
      .eq("id", open.id)
      .eq("user_id", user.id)
      .select(BLOCK_SELECT)
      .single();

    if (endError) {
      return NextResponse.json({ error: endError.message }, { status: 500 });
    }

    return NextResponse.json({
      block: toTimeBlock(asBlockRow(updated)),
      active: null,
    });
  }

  return NextResponse.json(
    { error: "Unknown action. Allowed: start, end" },
    { status: 400 },
  );
}
