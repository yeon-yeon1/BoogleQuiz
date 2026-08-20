"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Requests a screen Wake Lock so the kiosk tablet never sleeps while the
 * page is visible, and re-acquires it automatically if the tab regains
 * visibility (the lock is released by the browser when hidden/minimized).
 */
export function useWakeLock() {
  const lockRef = useRef<WakeLockSentinel | null>(null);
  const [active, setActive] = useState(false);

  const requestLock = useCallback(async () => {
    if (!("wakeLock" in navigator)) return;
    try {
      lockRef.current = await navigator.wakeLock.request("screen");
      setActive(true);
      lockRef.current.addEventListener("release", () => setActive(false));
    } catch {
      setActive(false);
    }
  }, []);

  useEffect(() => {
    // requestLock is async and only calls setState after its `await`, but the
    // set-state-in-effect rule can't see across that boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    requestLock();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && !lockRef.current) {
        requestLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      lockRef.current?.release().catch(() => {});
    };
  }, [requestLock]);

  return { active };
}
