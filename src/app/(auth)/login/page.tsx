"use client";

import { CozyBackground } from "@/components/ui/CozyBackground";
import { SpinnerIcon } from "@/components/ui/Icons";
import { hasNickname } from "@/lib/auth";
import { isInviteCodeFormatValid } from "@/lib/invitation-code";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [welcome, setWelcome] = useState(false);
  const [creating, setCreating] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [offerUsed, setOfferUsed] = useState(false);
  const autoTriedCode = useRef("");
  const creatingRef = useRef(creating);
  creatingRef.current = creating;

  async function suggestSignupCode() {
    if (offerUsed || suggesting || loading) return;
    setSuggesting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/suggest");
      const data = (await res.json()) as { code?: string; error?: string };
      if (!res.ok || !data.code) {
        setError(data.error || "Could not suggest a passcode");
        return;
      }
      setCode(data.code);
      setCreating(true);
      setOfferUsed(true);
    } catch {
      setError("Could not suggest a passcode");
    } finally {
      setSuggesting(false);
    }
  }

  async function handleLogin(nextCode?: string) {
    const trimmed = (nextCode ?? code).trim();
    if (!trimmed) {
      setError("Please enter your passcode first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: trimmed,
          createAccount: creatingRef.current || undefined,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        needsSetup?: boolean;
        nickname?: string | null;
      };

      if (!res.ok) {
        setError(data.error || "Invalid code");
        return;
      }

      setWelcome(true);

      const supabase = createClient();
      await supabase.auth.getSession();
      await new Promise((r) => setTimeout(r, 700));

      if (data.needsSetup || !hasNickname(data.nickname)) {
        router.replace("/setup");
      } else {
        router.replace("/");
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isInviteCodeFormatValid(code)) {
      autoTriedCode.current = "";
      return;
    }
    if (loading || welcome || suggesting) return;
    if (autoTriedCode.current === code) return;

    const timer = window.setTimeout(() => {
      autoTriedCode.current = code;
      void handleLogin(code);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [code, loading, welcome, suggesting]);

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-warm-bg px-4 py-10">
      <CozyBackground />
      <div className="animate-slide-in-up relative z-10 flex w-full max-w-[440px] flex-col items-center">
        <header className="mb-8 text-center">
          <h1 className="font-serif text-[42px] leading-none tracking-[0.04em] text-ink sm:text-[46px]">
            My Day In Log
          </h1>
          <p className="mt-3 text-sm tracking-[0.06em] text-[rgba(28,22,16,0.5)]">
            Name the block. Log the hours.
          </p>
        </header>

        <div className="flex w-full flex-col items-center gap-2">
            <input
                id="passcode"
                value={code}
                maxLength={5}
                disabled={loading || welcome}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase().slice(0, 5));
                  setCreating(false);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleLogin();
                  }
                }}
                placeholder="CODE"
                aria-label="Passcode"
                autoComplete="off"
                className="h-[44px] w-[14.5rem] rounded-full border border-[rgba(200,146,42,0.2)] bg-surface px-4 text-center text-lg font-semibold tracking-[0.42em] text-ink shadow-[inset_0px_1px_4px_0px_rgba(0,0,0,0.06)] outline-none placeholder:tracking-[0.42em] placeholder:text-[rgba(138,122,104,0.4)] focus:border-gold/50 disabled:opacity-70"
              />

            {loading ? (
              <SpinnerIcon size={16} className="text-gold" />
            ) : error ? (
              <p className="text-center text-sm text-red-600">{error}</p>
            ) : null}

            <div
              className={`flex flex-col gap-1.5 transition-opacity duration-300 ${
                offerUsed ? "pointer-events-none opacity-0" : "opacity-100"
              }`}
              aria-hidden={offerUsed || undefined}
            >
              <button
                type="button"
                disabled={loading || suggesting || offerUsed}
                onClick={() => void suggestSignupCode()}
                tabIndex={offerUsed ? -1 : undefined}
                className="text-center text-xs font-medium tracking-[0.3px] text-[rgba(28,22,16,0.55)] underline underline-offset-2 disabled:opacity-50"
              >
                {suggesting ? "Finding a code…" : "Start MyDayInLog"}
              </button>
            </div>
          </div>
      </div>
    </main>
  );
}
