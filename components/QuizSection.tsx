"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useAnimationFrame, useMotionValue } from "framer-motion";
import { useKioskStore } from "@/lib/stateMachine";
import { QUIZ_QUESTIONS } from "@/data/quizQuestions";
import { QUIZ_SPRING, ATTENTION_SWITCH_DELAY, ATTENTION_DWELL, ATTENTION_TILT_DEG, ATTENTION_EDGE_MARGIN, ATTENTION_TOP_MARGIN, ATTENTION_BOTTOM_MARGIN } from "@/lib/characterMotion";
import type { CharacterExpression } from "@/lib/types";
import CharacterCore from "./CharacterCore";

const CHAR_SIZE = 150;

// Hysteresis band (on the same 0..1 `speed` the spring loop already
// computes for scale) so the face only swaps between resting and
// "moving fast" once, instead of flickering right at one threshold. Set
// high on purpose — cramping-dark should read as "whoa, a big dash," not
// show up on every little correction, so only near-top-speed hops
// (edge-to-edge attention switches, or jumping to a just-tapped option)
// trigger it.
const MOVE_ENTER_SPEED = 0.85;
const MOVE_EXIT_SPEED = 0.35;

// Small deadzone around velX=0 so the cramping-dark art doesn't flip back
// and forth while the character is basically still, only when it's
// genuinely heading left vs. right.
const FLIP_VELOCITY_DEADZONE = 0.3;

const REST_EXPRESSIONS: CharacterExpression[] = ["bloating-mid", "gas-mid"];
function pickRestExpression(): CharacterExpression {
  return REST_EXPRESSIONS[Math.floor(Math.random() * REST_EXPRESSIONS.length)];
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

// Module-level (not written inline in the component) so the linter's
// purity check — which flags Math.random() literally inside a
// component/hook body — doesn't trip on scheduleAttentionSwitch below,
// even though it's only ever actually invoked from an effect/timeout.
function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

// How far outside the options block's edge the character's own edge should
// rest once it's pushed clear of it.
const AVOID_MARGIN = 8;

/** If the character (centered at cx,cy) would overlap `rect`, pushes its
 * center out to whichever edge of `rect` is closest, sliding along that
 * edge rather than jumping past it — so it "sticks" to the nearest side
 * of the options block instead of covering it. */
function keepClearOfRect(
  cx: number,
  cy: number,
  halfSize: number,
  rect: { left: number; right: number; top: number; bottom: number }
) {
  const left = rect.left - halfSize - AVOID_MARGIN;
  const right = rect.right + halfSize + AVOID_MARGIN;
  const top = rect.top - halfSize - AVOID_MARGIN;
  const bottom = rect.bottom + halfSize + AVOID_MARGIN;

  if (!(cx > left && cx < right && cy > top && cy < bottom)) return { x: cx, y: cy };

  const distLeft = cx - left;
  const distRight = right - cx;
  const distTop = cy - top;
  const distBottom = bottom - cy;
  const minDist = Math.min(distLeft, distRight, distTop, distBottom);

  if (minDist === distLeft) return { x: left, y: cy };
  if (minDist === distRight) return { x: right, y: cy };
  if (minDist === distTop) return { x: cx, y: top };
  return { x: cx, y: bottom };
}

/**
 * The real QUIZ step: a scored multiple-choice question with a character
 * that free-roams the stage on a 2D mass-spring-damper (ported from
 * character-alive-prototype.html's springLoop). Touch/gaze tracking proved
 * unreliable on real hardware, so the character's position now comes from
 * three things instead: the mouse on desktop (hover), a jump to sit beside
 * whichever option was just tapped, and its own periodic "peek at the
 * quiz" idle behavior — no continuous touch-drag tracking. "이전"/"다음"
 * step through questions explicitly rather than auto-advancing.
 */
export default function QuizSection() {
  const quizIndex = useKioskStore((s) => s.quizIndex);
  const quizAnswers = useKioskStore((s) => s.quizAnswers);
  const answerQuiz = useKioskStore((s) => s.answerQuiz);

  // Can trail behind the store's live quizIndex while reviewing an
  // already-answered question via "이전" — "다음" walks it back up. Reset
  // during render (React's documented pattern for "adjust state when a
  // prop changes") rather than in an effect, which would cost an extra
  // commit and trip the no-setState-in-effect lint rule.
  const [viewIndex, setViewIndex] = useState(quizIndex);
  const [liveSelection, setLiveSelection] = useState<number | null>(null);
  const [syncedQuizIndex, setSyncedQuizIndex] = useState(quizIndex);
  if (quizIndex !== syncedQuizIndex) {
    setSyncedQuizIndex(quizIndex);
    setViewIndex(quizIndex);
    setLiveSelection(null);
  }
  const isReviewing = viewIndex < quizIndex;

  const question = QUIZ_QUESTIONS[viewIndex];

  const selectedIndex = isReviewing ? (quizAnswers[viewIndex]?.selectedIndex ?? null) : liveSelection;

  const stageRef = useRef<HTMLDivElement | null>(null);
  const optionsRef = useRef<HTMLDivElement | null>(null);

  // Physics state lives in refs (not React state) so the RAF loop never
  // triggers a re-render — only the motion values it drives do.
  const posX = useRef(0);
  const posY = useRef(0);
  const velX = useRef(0);
  const velY = useRef(0);
  const targetX = useRef(0);
  const targetY = useRef(0);
  const attentionMode = useRef<"person" | "quiz">("person");
  const lookTilt = useRef(0);
  const lastPersonX = useRef<number | null>(null);
  const lastPersonY = useRef<number | null>(null);
  const attentionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyRef = useRef(false);

  const mvX = useMotionValue(0);
  const mvY = useMotionValue(0);
  const mvRotate = useMotionValue(0);
  const mvScaleX = useMotionValue(1);
  const mvScaleY = useMotionValue(1);

  // Swaps to a "moving fast" face only while the character is really
  // darting across the stage; settles back to a randomly-picked resting
  // face once it slows back down again.
  const [expression, setExpression] = useState<CharacterExpression>(pickRestExpression);
  const expressionRef = useRef<CharacterExpression>(expression);
  const flipDirRef = useRef(1);

  function setPersonTarget(x: number, y: number) {
    lastPersonX.current = x;
    lastPersonY.current = y;
    if (attentionMode.current === "person") {
      targetX.current = x;
      targetY.current = y;
    }
  }

  function clampToStage(x: number, y: number, stageWidth: number, stageHeight: number) {
    return {
      x: clamp(x, 10, stageWidth - CHAR_SIZE - 10),
      y: clamp(y, 60, stageHeight - CHAR_SIZE - 10),
    };
  }

  function scheduleAttentionSwitch() {
    if (attentionTimerRef.current) clearTimeout(attentionTimerRef.current);
    const delay = randomBetween(ATTENTION_SWITCH_DELAY.min, ATTENTION_SWITCH_DELAY.max);

    attentionTimerRef.current = setTimeout(() => {
      const stage = stageRef.current;
      if (!stage) return;
      const stageRect = stage.getBoundingClientRect();
      attentionMode.current = "quiz";

      const midX = stageRect.width / 2;
      const refX = lastPersonX.current !== null ? lastPersonX.current + CHAR_SIZE / 2 : posX.current + CHAR_SIZE / 2;
      const isLeftSide = refX < midX;
      targetX.current = isLeftSide ? ATTENTION_EDGE_MARGIN : stageRect.width - CHAR_SIZE - ATTENTION_EDGE_MARGIN;

      const topSpaceY = ATTENTION_TOP_MARGIN;
      const optionsRect = optionsRef.current?.getBoundingClientRect();
      const botSpaceY = optionsRect ? optionsRect.bottom - stageRect.top + ATTENTION_BOTTOM_MARGIN : topSpaceY;
      const useTop = randomBetween(0, 1) < 0.5;
      targetY.current = clamp(useTop ? topSpaceY : botSpaceY, 10, stageRect.height - CHAR_SIZE - 10);
      lookTilt.current = isLeftSide ? ATTENTION_TILT_DEG : -ATTENTION_TILT_DEG;

      attentionTimerRef.current = setTimeout(
        () => {
          attentionMode.current = "person";
          lookTilt.current = 0;
          if (lastPersonX.current !== null && lastPersonY.current !== null) {
            targetX.current = lastPersonX.current;
            targetY.current = lastPersonY.current;
          }
          scheduleAttentionSwitch();
        },
        randomBetween(ATTENTION_DWELL.min, ATTENTION_DWELL.max)
      );
    }, delay);
  }

  // Mount: center the character, start the attention-switch loop.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    posX.current = rect.width / 2 - CHAR_SIZE / 2;
    posY.current = rect.height / 2 - CHAR_SIZE / 2;
    targetX.current = posX.current;
    targetY.current = posY.current;
    mvX.set(posX.current);
    mvY.set(posY.current);
    readyRef.current = true;

    scheduleAttentionSwitch();

    return () => {
      if (attentionTimerRef.current) clearTimeout(attentionTimerRef.current);
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Desktop-only: the mouse cursor drives the character while hovering,
  // steering clear of the options block. Real touch input proved too
  // unreliable (OS/browser edge gestures eating the drag) to track this
  // way, so touch input is left to tap the options directly instead.
  function handleMouseMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return;
    const stage = stageRef.current;
    if (!stage) return;
    const stageRect = stage.getBoundingClientRect();
    const rawCx = e.clientX - stageRect.left;
    const rawCy = e.clientY - stageRect.top;

    const optionsRect = optionsRef.current?.getBoundingClientRect();
    const { x: cx, y: cy } = optionsRect
      ? keepClearOfRect(rawCx, rawCy, CHAR_SIZE / 2, {
          left: optionsRect.left - stageRect.left,
          right: optionsRect.right - stageRect.left,
          top: optionsRect.top - stageRect.top,
          bottom: optionsRect.bottom - stageRect.top,
        })
      : { x: rawCx, y: rawCy };

    const { x, y } = clampToStage(cx - CHAR_SIZE / 2, cy - CHAR_SIZE / 2, stageRect.width, stageRect.height);
    setPersonTarget(x, y);
  }

  // Jumps the character to sit half-tucked onto a fixed corner/edge of the
  // tapped option (the option's own z-10 keeps it drawn on top, so the
  // character pokes out from underneath) rather than tracking wherever it
  // happened to be standing: 1st option -> top-left corner, last option ->
  // bottom-right corner, and the options in between alternate right/left
  // edges (2nd -> right, 3rd -> left, ...).
  function moveBesideOption(optionEl: HTMLElement, index: number, total: number) {
    const stage = stageRef.current;
    if (!stage) return;
    const stageRect = stage.getBoundingClientRect();
    const optRect = optionEl.getBoundingClientRect();
    const left = optRect.left - stageRect.left;
    const right = optRect.right - stageRect.left;
    const top = optRect.top - stageRect.top;
    const bottom = optRect.bottom - stageRect.top;
    const vCenter = top + optRect.height / 2;

    const isFirst = index === 0;
    const isLast = index === total - 1;

    let cornerX: number;
    let cornerY: number;
    let onLeft: boolean;
    if (isFirst) {
      cornerX = left;
      cornerY = top;
      onLeft = true;
    } else if (isLast) {
      cornerX = right;
      cornerY = bottom;
      onLeft = false;
    } else if (index % 2 === 1) {
      cornerX = right;
      cornerY = vCenter;
      onLeft = false;
    } else {
      cornerX = left;
      cornerY = vCenter;
      onLeft = true;
    }

    lookTilt.current = onLeft ? ATTENTION_TILT_DEG : -ATTENTION_TILT_DEG;
    const { x, y } = clampToStage(cornerX - CHAR_SIZE / 2, cornerY - CHAR_SIZE / 2, stageRect.width, stageRect.height);
    setPersonTarget(x, y);
  }

  // The 2D mass-spring-damper — exact port of springLoop() in the prototype.
  useAnimationFrame(() => {
    if (!readyRef.current) return;
    const { stiffness, damping, rotateFromVelocity, rotateClamp, speedDivisor, scalePerSpeed } = QUIZ_SPRING;

    const fx = (targetX.current - posX.current) * stiffness;
    velX.current = (velX.current + fx) * damping;
    posX.current += velX.current;

    const fy = (targetY.current - posY.current) * stiffness;
    velY.current = (velY.current + fy) * damping;
    posY.current += velY.current;

    const rot = clamp(velX.current * rotateFromVelocity + lookTilt.current, -rotateClamp, rotateClamp);
    const speed = Math.min(Math.hypot(velX.current, velY.current) / speedDivisor, 1);
    const scale = 1 + speed * scalePerSpeed;

    if (velX.current > FLIP_VELOCITY_DEADZONE) flipDirRef.current = 1;
    else if (velX.current < -FLIP_VELOCITY_DEADZONE) flipDirRef.current = -1;
    // cramping-dark.svg faces right by default — mirror it while heading
    // left. Resting expressions don't care about facing, so leave them be.
    const isMoving = expressionRef.current === "cramping-dark";

    mvX.set(posX.current);
    mvY.set(posY.current);
    mvRotate.set(rot);
    mvScaleX.set(scale * (isMoving ? flipDirRef.current : 1));
    mvScaleY.set(scale);

    if (speed > MOVE_ENTER_SPEED) {
      if (expressionRef.current !== "cramping-dark") {
        expressionRef.current = "cramping-dark";
        setExpression("cramping-dark");
      }
    } else if (speed < MOVE_EXIT_SPEED) {
      if (expressionRef.current === "cramping-dark") {
        const next = pickRestExpression();
        expressionRef.current = next;
        setExpression(next);
      }
    }
  });

  // Selecting again before "다음" swaps the answer rather than locking in
  // the first tap — only pressing "다음" actually commits it.
  function handleSelect(index: number, e: React.MouseEvent<HTMLButtonElement>) {
    if (isReviewing || !question || index === liveSelection) return;
    setLiveSelection(index);
    moveBesideOption(e.currentTarget, index, question.options.length);
  }

  function handlePrevious() {
    setViewIndex((v) => Math.max(v - 1, 0));
  }

  function handleNext() {
    if (isReviewing) {
      setViewIndex((v) => Math.min(v + 1, quizIndex));
      return;
    }
    if (liveSelection === null || !question) return;
    answerQuiz(question.id, liveSelection);
  }

  if (!question) return null;

  const canGoNext = isReviewing || liveSelection !== null;

  return (
    <div
      ref={stageRef}
      className="relative h-full w-full touch-none overflow-hidden select-none"
      onPointerMove={handleMouseMove}
    >
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 px-6">
        <h3 className="text-center text-lg font-bold text-gray-800">
          <span className="text-orange-500">Q{viewIndex + 1}.</span> {question.prompt}
        </h3>

        <div ref={optionsRef} className="flex w-full max-w-lg flex-col gap-3">
          {question.options.map((option, i) => {
            // Right/wrong is never shown here — only "selected" — the
            // score itself is only revealed on the RESULT screen at the
            // end, not per-question as you go.
            const isSelected = i === selectedIndex;

            return (
              <button
                key={option.id}
                type="button"
                disabled={isReviewing}
                onClick={(e) => handleSelect(i, e)}
                className={`flex items-center gap-3 rounded-2xl border-2 bg-white px-4 py-4 text-left text-base font-semibold shadow-md transition-colors ${
                  isSelected ? "border-orange-400 bg-orange-50 text-orange-700" : "border-[#efe3da] text-[#55483f]"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                    isSelected ? "bg-orange-500" : "bg-[#cfc6bd]"
                  }`}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="flex w-full max-w-lg justify-between gap-3">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={viewIndex === 0}
            className="rounded-full border border-[#efe3da] bg-white px-6 py-2 text-sm font-semibold text-[#55483f] shadow-sm disabled:opacity-40"
          >
            이전
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!canGoNext}
            className="rounded-full bg-orange-500 px-6 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-40"
          >
            다음
          </button>
        </div>
      </div>

      <motion.div
        className="absolute left-0 top-0"
        style={{ x: mvX, y: mvY, rotate: mvRotate, scaleX: mvScaleX, scaleY: mvScaleY, width: CHAR_SIZE, height: CHAR_SIZE, zIndex: 5 }}
      >
        <CharacterCore expression={expression} size={CHAR_SIZE} />
      </motion.div>
    </div>
  );
}
