"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useKioskStore } from "@/lib/stateMachine";
import { useIdleReset } from "@/lib/useIdleReset";
import { useWakeLock } from "@/lib/useWakeLock";
import { PRESENCE_MOVE_TRANSITION, HOP_IN_TRANSITION } from "@/lib/characterMotion";
import type { CharacterExpression, KioskState } from "@/lib/types";
import CameraVision from "@/components/CameraVision";
import CharacterStage from "@/components/CharacterStage";
import QuizSection from "@/components/QuizSection";
import LoadingOrbit from "@/components/LoadingOrbit";
import ResultScore from "@/components/ResultScore";
import RouletteScreen from "@/components/RouletteScreen";

const GREETING_TEXT = "안녕! 나에 대해 잘 알고 있는지 확인해볼까?";
const ENGAGE_TEXT =
  "장 건강은 매일의 컨디션을 좌우해.\n간단한 퀴즈로 얼마나 알고 있는지 확인하자.";
const LOADING_TEXT = "분석 중이에요...";

// PRESENCE plays as one continuous wake-up beat across existing art rather
// than a single static "surprised" pose: eyes open (bloating-mid), stays
// that way through the hop/travel, then lands and goes "!!" (bloating-dark)
// right before GREETING's bubble appears.
type PresencePhase = "waking" | "moving" | "exclaiming";
const PRESENCE_PHASE_EXPRESSION: Record<PresencePhase, CharacterExpression> = {
  waking: "bloating-mid",
  moving: "bloating-mid",
  exclaiming: "bloating-dark",
};
const PRESENCE_WAKE_MS = 350;
const PRESENCE_EXCLAIM_LEAD_MS = 500;
const PRESENCE_HOLD_MS = 500;

interface StageLayout {
  x: number;
  y: number;
  size: number;
  expression: CharacterExpression;
  sleeping?: boolean;
  breathing?: boolean;
  alert?: boolean;
  hop?: boolean;
  bubbleText?: string;
  bubbleTypewriter?: boolean;
}

export default function Home() {
  useIdleReset();
  useWakeLock();

  const state = useKioskStore((s) => s.state);
  const faceX = useKioskStore((s) => s.faceX);
  const faceY = useKioskStore((s) => s.faceY);
  const faceDetected = useKioskStore((s) => s.faceDetected);
  const advanceToGreeting = useKioskStore((s) => s.advanceToGreeting);
  const advanceToEngage = useKioskStore((s) => s.advanceToEngage);
  const advanceToQuiz = useKioskStore((s) => s.advanceToQuiz);
  const showResult = useKioskStore((s) => s.showResult);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [presencePhase, setPresencePhase] = useState<PresencePhase>("waking");

  // IDLE keeps tracking the detected face position — the character glides
  // across the screen toward wherever the person is, still asleep, rather
  // than sitting fixed. Also used by PRESENCE's "waking" beat below, since
  // faceX/faceY keep updating live through the state transition — that
  // beat is short enough (see PRESENCE_WAKE_MS) that it just reads as the
  // character still glancing at you as its eyes open, before it hops in.
  const IDLE_GAZE = { xBase: 10, xRange: 80, yBase: 15, yRange: 70, fallbackX: 18, fallbackY: 70 };
  const hasGaze = faceDetected && faceX !== null && faceY !== null;
  const gazeX = hasGaze ? IDLE_GAZE.xBase + faceX! * IDLE_GAZE.xRange : IDLE_GAZE.fallbackX;
  const gazeY = hasGaze ? IDLE_GAZE.yBase + faceY! * IDLE_GAZE.yRange : IDLE_GAZE.fallbackY;

  const STAGE_LAYOUT: Partial<Record<KioskState, StageLayout>> = {
    IDLE: { x: gazeX, y: gazeY, size: 190, expression: "idle", sleeping: true },
    PRESENCE:
      presencePhase === "waking"
        ? { x: gazeX, y: gazeY, size: 220, expression: PRESENCE_PHASE_EXPRESSION.waking }
        : {
            x: 50,
            y: 55,
            size: 220,
            expression: PRESENCE_PHASE_EXPRESSION[presencePhase],
            alert: presencePhase === "exclaiming",
            hop: true,
          },
    GREETING: {
      x: 50,
      y: 42,
      size: 220,
      expression: "happy",
      bubbleText: GREETING_TEXT,
      bubbleTypewriter: true,
    },
    // Same spot/size as GREETING on purpose — CharacterStage never
    // unmounts across the GREETING→ENGAGE handoff, so only the bubble text
    // crossfades instead of the whole character cutting away and back.
    ENGAGE: {
      x: 50,
      y: 42,
      size: 220,
      expression: "happy",
      breathing: true,
      bubbleText: ENGAGE_TEXT,
      bubbleTypewriter: true,
    },
    // y:50 matches LoadingOrbit's own centering (absolute inset-0 +
    // items-center/justify-center), so the character sits at the exact
    // center of the orbiting ring instead of a bit above it.
    LOADING: { x: 50, y: 50, size: 200, expression: "idle", bubbleText: LOADING_TEXT },
  };

  // PRESENCE's edge→center move uses the prototype's overshoot easing
  // instead of the generic spring — stretched to 2.6s (see
  // PRESENCE_MOVE_TRANSITION) so the hop-in reads as deliberate steps. It
  // runs in lockstep with the hop's own HOP_IN_TRANSITION, both kicked off
  // together the moment the "moving" phase starts below.
  useEffect(() => {
    if (state !== "PRESENCE") return;
    const hopMs = (HOP_IN_TRANSITION.duration ?? 2.6) * 1000;

    // Deferred to a timeout (rather than called synchronously here) so the
    // reset itself doesn't trigger a render-phase setState cascade.
    const toWaking = setTimeout(() => setPresencePhase("waking"), 0);
    const toMoving = setTimeout(() => setPresencePhase("moving"), PRESENCE_WAKE_MS);
    const toExclaiming = setTimeout(
      () => setPresencePhase("exclaiming"),
      PRESENCE_WAKE_MS + Math.max(hopMs - PRESENCE_EXCLAIM_LEAD_MS, 0)
    );
    const toGreeting = setTimeout(
      advanceToGreeting,
      PRESENCE_WAKE_MS + hopMs + PRESENCE_HOLD_MS
    );

    return () => {
      clearTimeout(toWaking);
      clearTimeout(toMoving);
      clearTimeout(toExclaiming);
      clearTimeout(toGreeting);
    };
  }, [state, advanceToGreeting]);

  useEffect(() => {
    if (state === "GREETING") {
      const t = setTimeout(advanceToEngage, 2200);
      return () => clearTimeout(t);
    }
  }, [state, advanceToEngage]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(
        () => setIsFullscreen(true),
        () => {}
      );
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false));
    }
  }, []);

  const layout = STAGE_LAYOUT[state];

  return (
    <main className="relative h-dvh w-full touch-none overflow-hidden bg-linear-to-b from-orange-50 to-white">
      <CameraVision />

      <button
        type="button"
        onClick={toggleFullscreen}
        className="absolute right-4 top-4 z-50 rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-gray-500 shadow-sm hover:bg-white"
      >
        {isFullscreen ? "전체화면 종료" : "전체화면"}
      </button>

      {layout && (
        <CharacterStage
          expression={layout.expression}
          xPercent={layout.x}
          yPercent={layout.y}
          size={layout.size}
          sleeping={layout.sleeping}
          breathing={layout.breathing}
          alert={layout.alert}
          hop={layout.hop}
          bubbleText={layout.bubbleText}
          bubbleTypewriter={layout.bubbleTypewriter}
          positionTransition={state === "PRESENCE" ? PRESENCE_MOVE_TRANSITION : undefined}
        />
      )}

      <AnimatePresence mode="wait">
        {state === "ENGAGE" && (
          <motion.div
            key="engage"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-x-0 top-[calc(42%+150px)] flex justify-center px-8">
              <button
                type="button"
                onClick={advanceToQuiz}
                className="rounded-full bg-orange-500 px-8 py-3 text-base font-semibold text-white shadow-md hover:bg-orange-600"
              >
                퀴즈 시작하기
              </button>
            </div>
          </motion.div>
        )}

        {state === "QUIZ" && (
          <motion.div key="quiz" className="absolute inset-0">
            <QuizSection />
          </motion.div>
        )}

        {state === "LOADING" && (
          <motion.div
            key="loading"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <LoadingOrbit onComplete={showResult} />
          </motion.div>
        )}

        {state === "RESULT" && (
          <motion.div
            key="result"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ResultScore />
          </motion.div>
        )}

        {state === "ROULETTE" && (
          <motion.div
            key="roulette"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <RouletteScreen />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
