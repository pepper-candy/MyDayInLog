import {
  isInviteCodeAvailable,
  suggestAvailableInviteCode,
} from "@/lib/invitation-code";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const admin = createAdminClient();
    const code = await suggestAvailableInviteCode(admin);
    const available = await isInviteCodeAvailable(admin, code);
    return NextResponse.json({ code, available });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" &&
            err !== null &&
            "message" in err &&
            typeof err.message === "string"
          ? err.message
          : "Could not suggest a code";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
