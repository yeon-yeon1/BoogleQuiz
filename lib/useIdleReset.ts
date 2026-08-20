"use client";

import { useEffect, useRef } from "react";
import { useKioskStore } from "./stateMachine";
import type { KioskState } from "./types";

const DEFAULT_IDLE_TIMEOUT_MS = 20_000;

/** ENGAGE is actively nudging the visitor toward a button rather than
 * waiting on a quick response, so it gets a much longer grace period
 * before giving up and going back to sleep. */
const STATE_IDLE_TIMEOUT_MS: Partial<Record<KioskState, number>> = {
  ENGAGE: 180_000,
};

const ACTIVITY_EVENTS = ["pointerdown", "touchstart", "keydown"] as const;

/**
 * Resets the kiosk back to IDLE after a period of no user interaction,
 * once the flow has moved past IDLE. Any touch/pointer/key activity, or a
 * state change, restarts the countdown.
 */
export function useIdleReset() {
  const state = useKioskStore((s) => s.state);
  const reset = useKioskStore((s) => s.reset);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // QUIZ shouldn't bounce someone back to the home screen just for
    // taking their time picking an answer.
    if (state === "IDLE" || state === "QUIZ") {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const timeoutMs = STATE_IDLE_TIMEOUT_MS[state] ?? DEFAULT_IDLE_TIMEOUT_MS;

    const restart = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => reset(), timeoutMs);
    };

    restart();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, restart));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, restart)
      );
    };
  }, [state, reset]);
}
