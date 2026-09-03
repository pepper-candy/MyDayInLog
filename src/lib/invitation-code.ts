import type { SupabaseClient } from "@supabase/supabase-js";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 5;
const CODE_PATTERN = /^[A-Z0-9]{5}$/;

export function normalizeInviteCodeInput(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

export function isInviteCodeFormatValid(code: string): boolean {
  return CODE_PATTERN.test(normalizeInviteCodeInput(code));
}

export function generateRandomInviteCode(): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

async function isCodeTakenInTable(
  supabase: SupabaseClient,
  table: "daylog_profiles" | "profiles",
  code: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("invitation_code", code)
    .maybeSingle();

  if (error) {
    const message = error.message ?? "";
    const missing = /schema cache|does not exist|PGRST205/i.test(message);

    // Shared project should have Milestone `profiles`. If it is missing, do
    // not block MyDayInLog signup — auth.users still enforces unique emails.
    if (table === "profiles") return false;

    if (missing) {
      throw new Error(
        "MyDayInLog tables are missing. Run scripts/daylog_tables.sql in the Supabase SQL Editor.",
      );
    }
    throw new Error(message || "Could not check invitation code");
  }

  return Boolean(data);
}

/**
 * Codes map to `{code}@mvp.local` in the shared auth.users table, so a code
 * already used in Milestone or MyDayInLog must not be offered again.
 */
export async function isInviteCodeAvailable(
  supabase: SupabaseClient,
  code: string,
): Promise<boolean> {
  const normalized = normalizeInviteCodeInput(code);
  if (!isInviteCodeFormatValid(normalized)) return false;

  if (await isCodeTakenInTable(supabase, "daylog_profiles", normalized)) {
    return false;
  }
  if (await isCodeTakenInTable(supabase, "profiles", normalized)) {
    return false;
  }
  return true;
}

export async function suggestAvailableInviteCode(
  supabase: SupabaseClient,
): Promise<string> {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const candidate = generateRandomInviteCode();
    if (await isInviteCodeAvailable(supabase, candidate)) {
      return candidate;
    }
  }
  throw new Error("Could not generate an available invitation code");
}
