"use client";

import { useEffect, useRef, useState } from "react";

export function useSessionClock(
  startedAtIso: string | null,
  serverNowIso: string | null,
) {
  const [, setTick] = useState(0);
  const perfStart = useRef<number | null>(null);
  const baselineElapsed = useRef(0);
  const activeKey = `${startedAtIso}|${serverNowIso}`;
  const keyRef = useRef(activeKey);

  if (keyRef.current !== activeKey) {
    keyRef.current = activeKey;
    if (startedAtIso && serverNowIso) {
      const startedAt = new Date(startedAtIso).getTime();
      const serverNow = new Date(serverNowIso).getTime();
      baselineElapsed.current = Math.max(0, serverNow - startedAt);
      perfStart.current = performance.now();
    } else {
      baselineElapsed.current = 0;
      perfStart.current = null;
    }
  }

  useEffect(() => {
    if (!startedAtIso || !serverNowIso) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(id);
  }, [startedAtIso, serverNowIso]);

  if (!startedAtIso || !serverNowIso || perfStart.current == null) return 0;
  return Math.floor(
    (baselineElapsed.current + (performance.now() - perfStart.current)) / 1000,
  );
}
