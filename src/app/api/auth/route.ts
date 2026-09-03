import { NextResponse } from "next/server";
import { hasNickname, invitationToEmail, normalizeInvitationCode } from "@/lib/auth";
import { seedDefaultActivities } from "@/lib/default-activities";
import {
  isInviteCodeAvailable,
  isInviteCodeFormatValid,
  normalizeInviteCodeInput,
} from "@/lib/invitation-code";
import { syncSharedAvatarOnLogin } from "@/lib/shared-avatar";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      code?: string;
      createAccount?: boolean;
    };
    const code = normalizeInviteCodeInput(
      normalizeInvitationCode(body.code ?? ""),
    );
    if (!code) {
      return NextResponse.json(
        { error: "Please enter your passcode first." },
        { status: 400 },
      );
    }

    if (!isInviteCodeFormatValid(code)) {
      return NextResponse.json(
        { error: "Use 5 letters or numbers" },
        { status: 400 },
      );
    }

    const email = invitationToEmail(code);
    const password = code;
    const supabase = await createClient();

    if (body.createAccount === true) {
      let admin;
      try {
        admin = createAdminClient();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Signup unavailable";
        return NextResponse.json({ error: message }, { status: 503 });
      }

      const available = await isInviteCodeAvailable(admin, code);
      if (!available) {
        return NextResponse.json(
          {
            error: "This code is already used. Try Start MyDayInLog again.",
          },
          { status: 409 },
        );
      }

      const { data: created, error: createError } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            invitation_code: code,
            app: "mydayinlog",
            nickname: "",
          },
        });

      if (createError || !created.user) {
        const msg = createError?.message?.toLowerCase() ?? "";
        if (msg.includes("already") || msg.includes("registered")) {
          return NextResponse.json(
            {
              error: "This code is already used. Try Start MyDayInLog again.",
            },
            { status: 409 },
          );
        }
        return NextResponse.json(
          { error: createError?.message || "Could not create account" },
          { status: 500 },
        );
      }

      let { error: profileError } = await admin.from("daylog_profiles").insert({
        id: created.user.id,
        invitation_code: code,
        nickname: null,
        avatar_url: null,
      });
      if (profileError && /avatar_url/i.test(profileError.message)) {
        ({ error: profileError } = await admin.from("daylog_profiles").insert({
          id: created.user.id,
          invitation_code: code,
          nickname: null,
        }));
      }

      if (profileError) {
        await admin.auth.admin.deleteUser(created.user.id);
        const hint = /daylog_profiles|schema cache|does not exist/i.test(
          profileError.message,
        )
          ? " Run scripts/migrate_mydayinlog.sql in the Supabase SQL Editor."
          : "";
        return NextResponse.json(
          { error: `${profileError.message}${hint}` },
          { status: 500 },
        );
      }

      try {
        await seedDefaultActivities(admin, created.user.id);
      } catch (seedErr) {
        console.error("Could not seed activity types", seedErr);
      }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      const message = error?.message?.toLowerCase() ?? "";
      if (
        message.includes("already logged") ||
        message.includes("session") ||
        message.includes("another device")
      ) {
        return NextResponse.json(
          { error: "Already logged in on another device" },
          { status: 403 },
        );
      }
      return NextResponse.json({ error: "Invalid code" }, { status: 401 });
    }

    const user = data.user;
    const meta = user.user_metadata ?? {};

    const { data: existing } = await supabase
      .from("daylog_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    let nickname = existing?.nickname as string | null | undefined;
    if (nickname == null || nickname === "") {
      nickname = (meta.nickname as string | undefined) || null;
    }

    if (!existing) {
      let { error: upsertError } = await supabase.from("daylog_profiles").upsert({
        id: user.id,
        invitation_code: code,
        nickname: hasNickname(nickname) ? nickname : null,
        avatar_url: null,
      });
      if (upsertError && /avatar_url/i.test(upsertError.message)) {
        ({ error: upsertError } = await supabase.from("daylog_profiles").upsert({
          id: user.id,
          invitation_code: code,
          nickname: hasNickname(nickname) ? nickname : null,
        }));
      }
      if (upsertError) {
        const hint = /daylog_profiles|schema cache|does not exist/i.test(
          upsertError.message,
        )
          ? " Run scripts/migrate_mydayinlog.sql in the Supabase SQL Editor."
          : "";
        return NextResponse.json(
          { error: `${upsertError.message}${hint}` },
          { status: 500 },
        );
      }
    }

    try {
      let admin;
      try {
        admin = createAdminClient();
      } catch {
        admin = supabase;
      }
      await seedDefaultActivities(admin, user.id);
    } catch (seedErr) {
      console.error("Could not seed activity types", seedErr);
    }

    await syncSharedAvatarOnLogin(
      supabase,
      user.id,
      (existing?.avatar_url as string | null | undefined) ?? null,
      (meta.avatar_url as string | undefined) ?? null,
    );

    return NextResponse.json({
      ok: true,
      nickname: hasNickname(nickname) ? nickname : null,
      needsSetup: !hasNickname(nickname),
    });
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
