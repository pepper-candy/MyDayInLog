"use client";

import { AvatarCircle } from "@/components/ui/AvatarCircle";
import { SpinnerIcon } from "@/components/ui/Icons";
import { compressImage } from "@/lib/compress-image";
import { createClient } from "@/lib/supabase/client";
import type { DaylogProfile } from "@/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export function ProfilePageClient() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<DaylogProfile | null>(null);
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [goingBack, setGoingBack] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const profileRes = await fetch("/api/profile");
    const profileJson = (await profileRes.json()) as {
      profile?: DaylogProfile;
      error?: string;
    };
    if (!profileRes.ok || !profileJson.profile) {
      throw new Error(profileJson.error || "Could not load profile");
    }
    setProfile(profileJson.profile);
    setNickname(profileJson.profile.nickname ?? "");
  }, []);

  useEffect(() => {
    void load()
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load");
      })
      .finally(() => setLoading(false));
  }, [load]);

  async function copyPasscode() {
    const code = profile?.invitation_code?.trim().toUpperCase() ?? "";
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy passcode");
    }
  }

  async function saveNickname() {
    const name = nickname.trim();
    if (!name) {
      setError("Nickname is required");
      return;
    }
    if (name === (profile?.nickname ?? "").trim()) return;
    setSavingName(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: name }),
      });
      const data = (await res.json()) as { error?: string; nickname?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not save nickname");
      }
      const saved = data.nickname ?? name;
      setNickname(saved);
      setProfile((prev) => (prev ? { ...prev, nickname: saved } : prev));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save nickname");
    } finally {
      setSavingName(false);
    }
  }

  async function onPickAvatar(file: File | null) {
    if (!file) return;
    setSavingAvatar(true);
    setError(null);
    try {
      const compressed = await compressImage(file);
      const form = new FormData();
      form.append("file", compressed, "avatar.jpg");
      form.append("folder", "avatars");
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: form,
      });
      const uploadData = (await uploadRes.json()) as {
        url?: string;
        error?: string;
      };
      if (!uploadRes.ok || !uploadData.url) {
        throw new Error(uploadData.error || "Avatar upload failed");
      }

      const patchRes = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: uploadData.url }),
      });
      const patchData = (await patchRes.json()) as { error?: string };
      if (!patchRes.ok) {
        throw new Error(patchData.error || "Could not save avatar");
      }

      setProfile((prev) =>
        prev ? { ...prev, avatar_url: uploadData.url ?? null } : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save avatar");
    } finally {
      setSavingAvatar(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <SpinnerIcon size={22} className="text-gold" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-10 bg-[#f7f0e6]/95 px-4 pb-3 pt-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={goingBack}
            onClick={() => {
              if (goingBack) return;
              setGoingBack(true);
              router.push("/");
            }}
            className="flex size-10 items-center justify-center rounded-full border border-[rgba(200,146,42,0.2)] bg-surface text-gold disabled:cursor-wait"
            aria-label="Back"
          >
            {goingBack ? (
              <SpinnerIcon size={18} className="text-gold" />
            ) : (
              <svg
                viewBox="0 0 20 20"
                className="size-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M12.5 15 7.5 10l5-5" />
              </svg>
            )}
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-ink">Profile</h1>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-8 pt-2">
        {error ? (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-center text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <section className="rounded-3xl border border-[rgba(200,146,42,0.18)] bg-[rgba(253,246,236,0.7)] px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              disabled={savingAvatar}
              onClick={() => fileRef.current?.click()}
              className="relative size-16 shrink-0"
              aria-label="Change profile picture"
            >
              <AvatarCircle
                url={profile?.avatar_url}
                alt=""
                className="size-16 border border-[rgba(200,146,42,0.2)]"
              />
              {savingAvatar ? (
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-[rgba(253,246,236,0.7)]">
                  <SpinnerIcon size={18} className="text-gold" />
                </span>
              ) : null}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onPickAvatar(e.target.files?.[0] ?? null)}
            />
            <div className="min-w-0 flex-1">
              <label
                htmlFor="profile-nickname"
                className="text-[11px] font-semibold uppercase tracking-[1.4px] text-[rgba(28,22,16,0.5)]"
              >
                Nickname
              </label>
              <input
                id="profile-nickname"
                value={nickname}
                maxLength={32}
                disabled={savingName}
                onChange={(e) => {
                  setNickname(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void saveNickname();
                  }
                }}
                aria-label="Nickname"
                className="mt-1 h-10 w-full rounded-xl border border-[rgba(200,146,42,0.2)] bg-surface px-3 text-base font-semibold text-ink outline-none focus:border-gold/50 disabled:opacity-60"
              />
              {nickname.trim() !== (profile?.nickname ?? "").trim() ? (
                <button
                  type="button"
                  disabled={savingName || !nickname.trim()}
                  onClick={() => void saveNickname()}
                  className="mt-2 w-full rounded-full bg-[rgba(252,221,166,0.45)] px-4 py-2 text-sm font-semibold text-gold disabled:opacity-50"
                >
                  {savingName ? "Saving…" : "Save nickname"}
                </button>
              ) : null}
              <p className="mt-1 text-xs text-[rgba(28,22,16,0.5)]">
                Same photo as Milestone. Tap the picture to change.
              </p>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-1.5">
          <h2 className="text-sm font-semibold uppercase tracking-[1.2px] text-[rgba(28,22,16,0.55)]">
            Your passcode
          </h2>
          <div className="rounded-2xl bg-surface px-4 py-4">
            <p className="text-center text-xl font-semibold tracking-[4px] text-ink">
              {profile?.invitation_code}
            </p>
            <p className="mt-1 text-center text-xs text-[rgba(28,22,16,0.55)]">
              Keep this safe — it is your only sign-in code.
            </p>
            <button
              type="button"
              onClick={() => void copyPasscode()}
              className="mt-3 w-full rounded-full border border-[rgba(200,146,42,0.35)] bg-[rgba(252,221,166,0.22)] px-4 py-2.5 text-sm font-semibold text-gold transition hover:bg-[rgba(252,221,166,0.35)]"
            >
              {copied ? "Copied!" : "Copy passcode"}
            </button>
          </div>
        </section>

        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full rounded-full border border-[rgba(198,40,40,0.25)] px-4 py-3 text-sm font-semibold text-[#c62828]"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
