"use client";

import { CozyBackground } from "@/components/ui/CozyBackground";
import { SwipeToEnter } from "@/components/ui/SwipeToEnter";
import { hasNickname } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

type SignupMode = "none" | "mentor" | "solo";

export default function LoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [welcome, setWelcome] = useState(false);
  const [signupMode, setSignupMode] = useState<SignupMode>("none");
  const [suggesting, setSuggesting] = useState(false);
  const [offerUsed, setOfferUsed] = useState(false);

  async function suggestSignupCode(mode: "mentor" | "solo") {
    if (offerUsed || suggesting || loading) return;
    setSuggesting(true);
    setError(null);
    const failLabel =
      mode === "mentor"
        ? "Could not suggest a mentor code"
        : "Could not suggest a solo code";
    try {
      const res = await fetch("/api/auth/mentor-suggest");
      const data = (await res.json()) as { code?: string; error?: string };
      if (!res.ok || !data.code) {
        setError(data.error || failLabel);
        return;
      }
      setCode(data.code);
      setSignupMode(mode);
      setOfferUsed(true);
    } catch {
      setError(failLabel);
    } finally {
      setSuggesting(false);
    }
  }

  async function handleLogin() {
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Please enter your invitation code first.");
      throw new Error("empty");
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: trimmed,
          createMentor: signupMode === "mentor" || undefined,
          createSolo: signupMode === "solo" || undefined,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        needsSetup?: boolean;
        needsFirstChild?: boolean;
        isSolo?: boolean;
        nickname?: string | null;
      };

      if (!res.ok) {
        setError(data.error || "Invalid code");
        throw new Error(data.error || "Invalid code");
      }

      setWelcome(true);

      // Ensure client session is warm, then navigate
      const supabase = createClient();
      await supabase.auth.getSession();

      await new Promise((r) => setTimeout(r, 700));

      if (data.needsSetup || !hasNickname(data.nickname)) {
        router.replace("/setup");
      } else if (data.needsFirstChild) {
        router.replace("/remember-codes");
      } else {
        router.replace("/dashboard");
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const signupLabel =
    signupMode === "mentor" || signupMode === "solo"
      ? "Swipe to Signup"
      : "Swipe to Enter";

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-warm-bg px-4 py-10">
      <CozyBackground />
      <div className="animate-slide-in-up relative z-10 w-full max-w-[440px] rounded-3xl bg-[rgba(253,246,236,0.55)] px-6 py-12 shadow-[0px_8px_48px_0px_rgba(200,146,42,0.08)] sm:px-10 sm:py-14">
        <div className="mx-auto mb-10 flex justify-center">
          <div className="relative size-[200px] sm:size-[260px]">
            <div className="absolute -inset-4 rounded-full bg-[rgba(252,221,166,0.35)] blur-md" />
            <div className="relative size-full overflow-hidden rounded-full bg-surface shadow-[0px_4px_40px_0px_rgba(200,146,42,0.18)]">
              <Image
                src="/brand/logo_d.png"
                alt="MILESTONE"
                fill
                priority
                className="object-cover"
                sizes="260px"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <label
            htmlFor="invitation-code"
            className="text-center text-base font-medium tracking-[0.4px] text-[rgba(28,22,16,0.7)]"
          >
            Enter Your Invitation Code
          </label>

          <input
            id="invitation-code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setSignupMode("none");
              setError(null);
            }}
            placeholder="— — — — —"
            autoComplete="off"
            className="h-[62px] w-full rounded-2xl border border-[rgba(200,146,42,0.2)] bg-surface px-6 text-center text-xl font-semibold tracking-[6px] text-ink shadow-[inset_0px_1px_4px_0px_rgba(0,0,0,0.06)] outline-none placeholder:tracking-[6px] placeholder:text-[rgba(138,122,104,0.4)] focus:border-gold/50"
          />

          <div className="flex min-h-4 items-center justify-center">
            {error ? (
              <p className="text-center text-sm text-red-600">{error}</p>
            ) : null}
          </div>

          <SwipeToEnter
            label={signupLabel}
            successLabel={welcome ? "Welcome!" : undefined}
            disabled={loading || suggesting}
            loading={loading}
            onComplete={handleLogin}
          />

          <div
            className={`-mt-1 flex flex-col gap-1.5 transition-opacity duration-300 ${
              offerUsed
                ? "pointer-events-none opacity-0"
                : "opacity-100"
            }`}
            aria-hidden={offerUsed || undefined}
          >
            <button
              type="button"
              disabled={loading || suggesting || offerUsed}
              onClick={() => void suggestSignupCode("mentor")}
              tabIndex={offerUsed ? -1 : undefined}
              className="text-center text-xs font-medium tracking-[0.3px] text-[rgba(28,22,16,0.55)] underline underline-offset-2 disabled:opacity-50"
            >
              {suggesting && signupMode !== "solo"
                ? "Finding a code…"
                : "Start as a Mentor"}
            </button>
            <button
              type="button"
              disabled={loading || suggesting || offerUsed}
              onClick={() => void suggestSignupCode("solo")}
              tabIndex={offerUsed ? -1 : undefined}
              className="text-center text-xs font-medium tracking-[0.3px] text-[rgba(28,22,16,0.55)] underline underline-offset-2 disabled:opacity-50"
            >
              {suggesting && signupMode === "solo"
                ? "Finding a code…"
                : "Start a Solo Challenge"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
