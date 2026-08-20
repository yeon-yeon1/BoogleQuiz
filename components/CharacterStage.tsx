"use client";

import { motion, type Transition } from "framer-motion";
import type { CharacterExpression } from "@/lib/types";
import CharacterCore from "./CharacterCore";

export interface CharacterStageProps {
  expression: CharacterExpression;
  /** Center anchor, 0-100 (% of the positioned parent). */
  xPercent: number;
  yPercent: number;
  size?: number;
  zIndex?: number;
  sleeping?: boolean;
  breathing?: boolean;
  alert?: boolean;
  hop?: boolean;
  bubbleText?: string;
  bubbleTypewriter?: boolean;
  /** Override the default spring, e.g. PRESENCE_MOVE_TRANSITION for the edge→center hop-in. */
  positionTransition?: Transition;
  className?: string;
}

const DEFAULT_POSITION_TRANSITION: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 18,
  mass: 0.9,
};

/**
 * Percent-anchored, spring-driven character position (IDLE, PRESENCE,
 * GREETING, ENGAGE, LOADING, RESULT). Position lives on this outer
 * motion.div; CharacterCore owns expression crossfade + idle/hop/zzz/
 * exclaim/bubble, so a mid-flight move never interrupts an expression
 * swap or vice versa.
 */
export default function CharacterStage({
  expression,
  xPercent,
  yPercent,
  size = 220,
  zIndex = 10,
  sleeping = false,
  breathing = false,
  alert = false,
  hop = false,
  bubbleText,
  bubbleTypewriter,
  positionTransition,
  className,
}: CharacterStageProps) {
  return (
    <motion.div
      className={`absolute ${className ?? ""}`}
      style={{ zIndex }}
      animate={{ left: `${xPercent}%`, top: `${yPercent}%` }}
      transition={positionTransition ?? DEFAULT_POSITION_TRANSITION}
    >
      <div style={{ width: size, height: size, transform: "translate(-50%, -50%)" }}>
        <CharacterCore
          expression={expression}
          size={size}
          sleeping={sleeping}
          breathing={breathing}
          alert={alert}
          hop={hop}
          bubbleText={bubbleText}
          bubbleTypewriter={bubbleTypewriter}
        />
      </div>
    </motion.div>
  );
}
