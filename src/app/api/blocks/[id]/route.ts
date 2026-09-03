import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { note?: string | null };
  const raw = body.note;
  const note =
    raw == null || String(raw).trim() === ""
      ? null
      : String(raw).trim().slice(0, 32);

  const { data: existing, error: loadError } = await supabase
    .from("daylog_time_blocks")
    .select("id, ended_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (loadError || !existing) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 });
  }
  if (!existing.ended_at) {
    return NextResponse.json(
      { error: "Block must be ended before adding a note" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("daylog_time_blocks")
    .update({ note })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ block: data });
}
