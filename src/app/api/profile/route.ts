import { NextResponse } from "next/server";
import { hasNickname } from "@/lib/auth";
import {
  persistSharedAvatarUrl,
  resolveSharedAvatarUrl,
} from "@/lib/shared-avatar";
import { createClient } from "@/lib/supabase/server";
import type { DaylogProfile } from "@/types";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("daylog_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const avatar_url = await resolveSharedAvatarUrl(
    supabase,
    user.id,
    (profile as { avatar_url?: string | null }).avatar_url,
    (user.user_metadata?.avatar_url as string | undefined) ?? null,
  );

  return NextResponse.json({
    profile: { ...profile, avatar_url } as DaylogProfile,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    nickname?: string;
    avatar_url?: string | null;
  };
  const nickname = (body.nickname ?? "").trim();
  if (!nickname) {
    return NextResponse.json({ error: "Nickname is required" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("daylog_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (hasNickname(existing?.nickname)) {
    return NextResponse.json(
      { error: "Nickname cannot be changed" },
      { status: 403 },
    );
  }

  const meta = user.user_metadata ?? {};
  const avatarUrl =
    body.avatar_url !== undefined
      ? body.avatar_url
      : ((existing?.avatar_url as string | null | undefined) ?? null);

  const row = {
    id: user.id,
    invitation_code:
      (meta.invitation_code as string | undefined) ??
      user.email?.split("@")[0]?.toUpperCase() ??
      "UNKNOWN",
    nickname,
  };

  let { error } = await supabase.from("daylog_profiles").upsert({
    ...row,
    avatar_url: avatarUrl,
  });
  if (error && /avatar_url/i.test(error.message)) {
    ({ error } = await supabase.from("daylog_profiles").upsert(row));
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (typeof body.avatar_url === "string" && body.avatar_url.trim()) {
    await persistSharedAvatarUrl(supabase, user.id, body.avatar_url.trim());
  }

  await supabase.auth.updateUser({
    data: { nickname, avatar_url: avatarUrl },
  });

  return NextResponse.json({ ok: true, nickname, avatar_url: avatarUrl });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    avatar_url?: string | null;
    nickname?: string;
  };
  if (body.avatar_url === undefined && body.nickname === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const next: { avatar_url?: string | null; nickname?: string } = {};

  if (body.nickname !== undefined) {
    const nickname = body.nickname.trim().slice(0, 32);
    if (!nickname) {
      return NextResponse.json(
        { error: "Nickname is required" },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("daylog_profiles")
      .update({ nickname })
      .eq("id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: milestone } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (milestone) {
      const { error: milestoneError } = await supabase
        .from("profiles")
        .update({ nickname })
        .eq("id", user.id);
      if (milestoneError) {
        console.warn("Could not save Milestone nickname", milestoneError.message);
      }
    }

    await supabase.auth.updateUser({ data: { nickname } });
    next.nickname = nickname;
  }

  if (body.avatar_url !== undefined) {
    await persistSharedAvatarUrl(supabase, user.id, body.avatar_url);
    await supabase.auth.updateUser({ data: { avatar_url: body.avatar_url } });
    next.avatar_url = body.avatar_url;
  }

  return NextResponse.json({ ok: true, ...next });
}
