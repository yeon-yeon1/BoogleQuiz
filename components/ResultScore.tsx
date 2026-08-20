"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useKioskStore, getScoreResult } from "@/lib/stateMachine";
import { scoreToIntensity } from "@/lib/characterAssets";
import type { LeadPayload } from "@/lib/types";
import CharacterImage from "./CharacterImage";

/**
 * Which expression represents which score tier is not decided yet — this
 * just reuses the existing symptom-report art as a stand-in reaction so
 * the score screen isn't a blank circle. Swap freely once real "quiz
 * result" art exists.
 */
function expressionForRatio(ratio: number) {
  const intensity = scoreToIntensity(1 - ratio, 1); // low ratio -> "dark", high ratio -> "light"
  return `stool-${intensity}` as const;
}

function encouragementFor(ratio: number): string {
  if (ratio >= 1) return "완벽해요! 만점입니다 🎉";
  if (ratio >= 0.5) return "잘했어요! 조금만 더 챙기면 완벽해요";
  return "괜찮아요, 이제부터 하나씩 챙겨봐요!";
}

// Gives the visitor a moment to actually scan the QR and follow before the
// confirm button even shows up, instead of it being tappable immediately.
const FOLLOW_BUTTON_DELAY_MS = 3000;

export default function ResultScore() {
  const quizAnswers = useKioskStore((s) => s.quizAnswers);
  const reset = useKioskStore((s) => s.reset);
  const confirmFollow = useKioskStore((s) => s.confirmFollow);
  const submitted = useRef(false);
  const [showFollowButton, setShowFollowButton] = useState(false);

  const score = getScoreResult(quizAnswers);
  const ratio = score.total > 0 ? score.correct / score.total : 0;
  const expression = expressionForRatio(ratio);

  useEffect(() => {
    const t = setTimeout(() => setShowFollowButton(true), FOLLOW_BUTTON_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (submitted.current) return;
    submitted.current = true;

    const payload: LeadPayload = {
      timestamp: new Date().toISOString(),
      quizAnswers,
      score,
    };

    fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Best-effort: kiosk flow shouldn't block on lead submission failing.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full w-full flex-row items-center justify-between gap-47 px-24">
      <div className="flex flex-col items-center gap-5">
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 20 }}
          className="relative h-64 w-64"
        >
          <CharacterImage expression={expression} />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-center text-5xl font-bold text-gray-800"
        >
          {score.total}문제 중 {score.correct}개 정답!
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-xl font-medium text-gray-500"
        >
          {encouragementFor(ratio)}
        </motion.p>

        <button
          type="button"
          onClick={reset}
          className="mt-3 rounded-full border border-gray-300 px-8 py-3 text-base font-medium text-gray-500 hover:bg-gray-50"
        >
          처음으로
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.4 }}
        className="flex flex-col items-center gap-6"
      >
        <p className="text-center text-xl font-semibold text-gray-700">
          인스타그램을 팔로우하고
          <br />
          룰렛 이벤트에 참여하세요!
        </p>
        <Image src="/assets/illust/QR.svg" alt="인스타그램 팔로우 QR 코드" width={384} height={543} className="h-auto w-96 rounded-2xl shadow-lg" />
        <AnimatePresence>
          {showFollowButton && (
            <motion.button
              type="button"
              onClick={confirmFollow}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-full bg-orange-500 px-12 py-4 text-lg font-semibold text-white shadow-md hover:bg-orange-600"
            >
              팔로우 완료
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
