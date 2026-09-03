"use client";

import { CozyBackground } from "@/components/ui/CozyBackground";
import { AvatarCircle } from "@/components/ui/AvatarCircle";
import { SwipeToEnter } from "@/components/ui/SwipeToEnter";
import { compressImage } from "@/lib/compress-image";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function SetupPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [welcome, setWelcome] = useState(false);

  useEffect(() => {
    async function guard() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("daylog_profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.nickname && profile.nickname.trim()) {
        router.replace("/");
        return;
      }

      const { data: milestone } = await supabase
        .from("profiles")
        .select("avatar_url, nickname")
        .eq("id", user.id)
        .maybeSingle();

      const shared =
        (typeof milestone?.avatar_url === "string" &&
        milestone.avatar_url.trim()
          ? milestone.avatar_url
          : null) ??
        (typeof profile?.avatar_url === "string" && profile.avatar_url.trim()
          ? profile.avatar_url
          : null);
      if (shared) setAvatarUrl(shared);

      const milestoneName =
        typeof milestone?.nickname === "string" ? milestone.nickname.trim() : "";
      if (milestoneName) setNickname(milestoneName);
    }
    void guard();
  }, [router]);

  function onPickFile(file: File | null) {
    if (!file) return;
    setAvatarFile(file);
    setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit() {
    const name = nickname.trim();
    if (!name) {
      setError("Nickname is required.");
      throw new Error("nickname");
    }

    setLoading(true);
    setError(null);

    try {
      let nextAvatarUrl = avatarUrl;

      if (avatarFile) {
        try {
          const compressed = await compressImage(avatarFile);
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
          if (uploadRes.ok && uploadData.url) {
            nextAvatarUrl = uploadData.url;
          } else {
            console.warn(
              uploadData.error || "Avatar upload failed; continuing without a new photo",
            );
          }
        } catch (err) {
          console.warn("Avatar upload failed; continuing without a new photo", err);
        }
      }

      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: name,
          avatar_url: nextAvatarUrl,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not save profile");
        throw new Error(data.error || "Could not save profile");
      }

      setWelcome(true);
      await new Promise((r) => setTimeout(r, 800));
      router.replace("/remember-code");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const displayAvatar = preview || avatarUrl;

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-warm-bg px-4 py-10">
      <CozyBackground />
      <div className="animate-slide-in-up relative z-10 w-full max-w-[440px] rounded-3xl bg-[rgba(253,246,236,0.55)] px-6 py-12 shadow-[0px_8px_48px_0px_rgba(200,146,42,0.08)] sm:px-10 sm:py-14">
        <div className="mx-auto mb-10 flex justify-center">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative size-[160px] sm:size-[200px]"
            aria-label="Upload avatar"
          >
            <div className="absolute -inset-4 rounded-full bg-[rgba(252,221,166,0.35)] blur-md" />
            <div className="relative size-full overflow-hidden rounded-full bg-surface shadow-[0px_4px_40px_0px_rgba(200,146,42,0.18)]">
              {displayAvatar ? (
                <AvatarCircle
                  url={displayAvatar}
                  alt="Avatar preview"
                  className="size-full"
                />
              ) : (
                <div className="flex size-full flex-col items-center justify-center">
                  <svg
                    viewBox="0 0 80 80"
                    className="size-20 text-[rgba(28,22,16,0.35)]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <circle cx="40" cy="28" r="14" />
                    <path d="M16 66c4-14 16-22 24-22s20 8 24 22" />
                  </svg>
                  <span className="mt-2 text-xs font-semibold uppercase tracking-[1.68px] text-[rgba(28,22,16,0.4)]">
                    Add photo
                  </span>
                </div>
              )}
            </div>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="flex flex-col gap-3">
          <label
            htmlFor="nickname"
            className="text-center text-base font-medium tracking-[0.4px] text-[rgba(28,22,16,0.7)]"
          >
            Your Nickname
          </label>
          <input
            id="nickname"
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setError(null);
            }}
            placeholder="Your name here"
            className="h-[62px] w-full rounded-2xl border border-[rgba(200,146,42,0.2)] bg-surface px-6 text-center text-xl font-semibold tracking-[2.4px] text-ink shadow-[inset_0px_1px_4px_0px_rgba(0,0,0,0.06)] outline-none placeholder:tracking-[2.4px] placeholder:text-[rgba(138,122,104,0.4)] focus:border-gold/50"
          />
          <div className="flex min-h-4 items-center justify-center">
            {error ? (
              <p className="text-center text-sm text-red-600">{error}</p>
            ) : null}
          </div>
          <SwipeToEnter
            label="Swipe to Continue"
            successLabel={welcome ? "Welcome!" : undefined}
            disabled={loading}
            loading={loading}
            onComplete={handleSubmit}
          />
        </div>
      </div>
    </main>
  );
}
