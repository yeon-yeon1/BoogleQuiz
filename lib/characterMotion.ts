import type { Transition } from "framer-motion";

/**
 * Motion constants ported 1:1 from character-alive-prototype.html.
 * These are the validated feel for the character — keep values exact
 * rather than "close enough" when touching this file.
 */

// idleFloat 3.4s ease-in-out infinite
export const IDLE_FLOAT_ANIMATE = {
  y: [0, -6, 0, -4, 0],
  rotate: [-2, 1, 2, -1, -2],
  scale: [1, 1.02, 1.04, 1.02, 1],
};
export const IDLE_FLOAT_TRANSITION: Transition = {
  duration: 3.4,
  ease: "easeInOut",
  repeat: Infinity,
  times: [0, 0.25, 0.5, 0.75, 1],
};

// hopIn — 3 hops, growing overshoot on scale. Prototype used 0.9s; slowed
// to 2.6s on request so each hop reads as a distinct step instead of a blur
// (keyframe shape/easing kept identical, only stretched in time).
export const HOP_IN_ANIMATE = {
  y: [0, -46, 0, -30, 0, -14, 0],
  scale: [0.7, 0.85, 0.82, 0.95, 0.92, 1.15, 1],
};
export const HOP_IN_TRANSITION: Transition = {
  duration: 2.6,
  ease: [0.22, 1, 0.36, 1],
  times: [0, 0.15, 0.32, 0.48, 0.64, 0.8, 1],
};

// floatZ 2.6s ease-in-out infinite
export const ZZZ_ANIMATE = {
  opacity: [0, 1, 0.9, 0],
  y: [4, -4, -18, -26],
  scale: [0.6, 1, 1.1, 1.2],
};
export const ZZZ_TRANSITION: Transition = {
  duration: 2.6,
  ease: "easeInOut",
  repeat: Infinity,
  times: [0, 0.15, 0.7, 1],
};

// breathing — gentle in-place scale pulse, no position/rotation change.
// Used where the character should stay put and just feel alive (ENGAGE),
// instead of roaming the screen.
export const BREATHE_ANIMATE = { scale: [1, 1.06, 1], y: 0, rotate: 0 };
export const BREATHE_TRANSITION: Transition = {
  duration: 2.8,
  ease: "easeInOut",
  repeat: Infinity,
};

// exclaim show/hide — 0.3s cubic-bezier(.34,1.56,.64,1)
export const OVERSHOOT_EASE: [number, number, number, number] = [0.34, 1.56, 0.64, 1];
export const EXCLAIM_TRANSITION: Transition = { duration: 0.3, ease: OVERSHOOT_EASE };

// bubble show/hide — 0.4s cubic-bezier(.34,1.56,.64,1)
export const BUBBLE_TRANSITION: Transition = { duration: 0.4, ease: OVERSHOOT_EASE };

// PRESENCE container move (left/bottom) — stretched to match the slowed
// HOP_IN_TRANSITION above, so the character hops its way to center over
// the same span instead of arriving early and hopping in place.
export const PRESENCE_MOVE_TRANSITION: Transition = { duration: 2.6, ease: OVERSHOOT_EASE };

/** QUIZ free-roam 2D mass-spring-damper — exact constants from springLoop(). */
export const QUIZ_SPRING = {
  stiffness: 0.085,
  damping: 0.8,
  rotateFromVelocity: 1.4,
  rotateClamp: 26,
  speedDivisor: 6,
  scalePerSpeed: 0.08,
} as const;

/** scheduleAttentionSwitch() timing — random ranges, in ms. */
export const ATTENTION_SWITCH_DELAY = { min: 2200, max: 4000 };
export const ATTENTION_DWELL = { min: 1300, max: 1900 };
export const ATTENTION_TILT_DEG = 12;
export const ATTENTION_EDGE_MARGIN = 4;
export const ATTENTION_TOP_MARGIN = 14;
export const ATTENTION_BOTTOM_MARGIN = 10;
