"use client";

import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { useEffect, useRef } from "react";
import type { CharacterExpression } from "@/lib/types";
import {
  IDLE_FLOAT_ANIMATE,
  IDLE_FLOAT_TRANSITION,
  HOP_IN_ANIMATE,
  HOP_IN_TRANSITION,
  ZZZ_ANIMATE,
  ZZZ_TRANSITION,
  EXCLAIM_TRANSITION,
  BREATHE_ANIMATE,
  BREATHE_TRANSITION,
} from "@/lib/characterMotion";
import CharacterImage from "./CharacterImage";
import SpeechBubble from "./SpeechBubble";

export interface CharacterCoreProps {
  expression: CharacterExpression;
  size: number;
  /** Plays the idleFloat drifting loop + shows the floating "z" (IDLE). */
  sleeping?: boolean;
  /** Plays a gentle in-place scale-pulse loop, no drift (ENGAGE). */
  breathing?: boolean;
  /** Shows the floating "!" mark (PRESENCE). */
  alert?: boolean;
  /** Flip false→true to play the 3-hop hopIn entrance once (PRESENCE). */
  hop?: boolean;
  bubbleText?: string;
  bubbleTypewriter?: boolean;
}

/**
 * The character's visual body: expression crossfade, idle-float/hop
 * transform layers, and the zzz/exclaim/bubble overlays — all positioned
 * relative to its own box. Carries no opinion about where that box sits on
 * screen; CharacterStage (percent+spring) and QuizCharacterFollower
 * (pixel+physics) each wrap this with their own positioning strategy.
 */
export default function CharacterCore({
  expression,
  size,
  sleeping = false,
  breathing = false,
  alert = false,
  hop = false,
  bubbleText,
  bubbleTypewriter,
}: CharacterCoreProps) {
  const hopControls = useAnimationControls();
  const prevHop = useRef(false);

  useEffect(() => {
    if (hop && !prevHop.current) {
      hopControls.set({ y: 0, scale: 0.7 });
      hopControls.start({ y: HOP_IN_ANIMATE.y, scale: HOP_IN_ANIMATE.scale, transition: HOP_IN_TRANSITION });
    }
    prevHop.current = hop;
  }, [hop, hopControls]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <AnimatePresence>
        {bubbleText && (
          <motion.div
            key="bubble"
            className="absolute left-1/2 -translate-x-1/2"
            style={{ bottom: "100%", marginBottom: 14 }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
          >
            <SpeechBubble text={bubbleText} typewriter={bubbleTypewriter} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="h-full w-full"
        animate={
          sleeping
            ? IDLE_FLOAT_ANIMATE
            : breathing
              ? BREATHE_ANIMATE
              : { y: 0, rotate: 0, scale: 1 }
        }
        transition={
          sleeping
            ? IDLE_FLOAT_TRANSITION
            : breathing
              ? BREATHE_TRANSITION
              : { duration: 0.3 }
        }
      >
        <motion.div className="relative h-full w-full" animate={hopControls}>
          <AnimatePresence>
            <CharacterImage key={expression} expression={expression} />
          </AnimatePresence>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {sleeping && (
          <motion.div
            key="zzz"
            className="pointer-events-none absolute -right-1 -top-2 text-xl font-extrabold text-[#e8703f]"
            initial={{ opacity: 0, y: 4, scale: 0.6 }}
            animate={ZZZ_ANIMATE}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={ZZZ_TRANSITION}
          >
            z
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {alert && (
          <motion.svg
            key="exclaim"
            className="pointer-events-none absolute -right-1 -top-9"
            width="42"
            height="42"
            viewBox="0 0 24 24"
            fill="none"
            initial={{ opacity: 0, scale: 0.3, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.3, rotate: -10 }}
            transition={EXCLAIM_TRANSITION}
          >
            <rect x="8.7" y="1" width="6.6" height="13.5" rx="3.3" fill="#e8703f" />
            <circle cx="12" cy="20" r="3.4" fill="#e8703f" />
          </motion.svg>
        )}
      </AnimatePresence>
    </div>
  );
}
