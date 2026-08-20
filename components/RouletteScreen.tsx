"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useKioskStore } from "@/lib/stateMachine";

// Placeholder prize copy — swap these for the real reward lineup before
// launch. Segment colors just alternate the brand palette.
const PRIZES = [
  { label: "1등 상품", color: "#FF8253" },
  { label: "꽝, 다음 기회에", color: "#FEF9EF" },
  { label: "2등 상품", color: "#FFCEBB" },
  { label: "쿠폰 증정", color: "#FEF9EF" },
  { label: "꽝, 다음 기회에", color: "#FFA17D" },
  { label: "3등 상품", color: "#FEF9EF" },
] as const;

const SEGMENT_DEG = 360 / PRIZES.length;
const SPIN_SPRING = { type: "spring", stiffness: 40, damping: 14, mass: 1.2 } as const;

function pickPrizeIndex() {
  return Math.floor(Math.random() * PRIZES.length);
}

/**
 * Roulette landing page — only reachable after the visitor self-reports
 * following on Instagram from the RESULT screen (see confirmFollow() in
 * stateMachine.ts; there's no real API to verify a follow for an anonymous
 * walk-up visitor, so this is an honor-system gate, not a technical one).
 */
export default function RouletteScreen() {
  const reset = useKioskStore((s) => s.reset);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wonIndex, setWonIndex] = useState<number | null>(null);
  const spunOnce = useRef(false);

  const conicGradient = useMemo(() => {
    const stops = PRIZES.map((p, i) => `${p.color} ${i * SEGMENT_DEG}deg ${(i + 1) * SEGMENT_DEG}deg`);
    return `conic-gradient(${stops.join(", ")})`;
  }, []);

  function handleSpin() {
    if (spinning || spunOnce.current) return;
    spunOnce.current = true;
    setSpinning(true);

    const target = pickPrizeIndex();
    // Land the target segment's center under the top pointer: offset from
    // 12 o'clock, plus several full turns so the spin reads as a real spin.
    const landingDeg = 360 - (target * SEGMENT_DEG + SEGMENT_DEG / 2);
    const extraTurns = 5 * 360;
    setRotation((prev) => prev - (prev % 360) + extraTurns + landingDeg);

    setTimeout(() => {
      setSpinning(false);
      setWonIndex(target);
    }, 3200);
  }

  return (
    <div className="flex h-full w-full flex-row items-center justify-center gap-16 px-16">
      <div className="relative shrink-0">
        <div
          className="absolute left-1/2 -top-3 z-10 h-6 w-6 -translate-x-1/2 rotate-180"
          style={{ clipPath: "polygon(50% 100%, 0 0, 100% 0)", backgroundColor: "#55483f" }}
        />
        <motion.div
          className="relative h-80 w-80 rounded-full border-8 border-white shadow-xl"
          style={{ background: conicGradient }}
          animate={{ rotate: rotation }}
          transition={SPIN_SPRING}
        >
          {PRIZES.map((p, i) => (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 w-28 text-center text-xs font-bold text-[#55483f]"
              style={{
                transform: `rotate(${i * SEGMENT_DEG + SEGMENT_DEG / 2}deg) translate(0, -108px) rotate(0deg)`,
                transformOrigin: "0 0",
              }}
            >
              {p.label}
            </div>
          ))}
        </motion.div>
      </div>

      <div className="flex w-72 flex-col items-center gap-5 text-center">
        {wonIndex === null ? (
          <>
            <h2 className="text-2xl font-bold text-gray-800">룰렛을 돌려보세요!</h2>
            <p className="text-sm font-medium text-gray-500">버튼을 누르면 한 번 돌아가요</p>
            <button
              type="button"
              onClick={handleSpin}
              disabled={spinning}
              className="rounded-full bg-orange-500 px-8 py-3 text-base font-semibold text-white shadow-md hover:bg-orange-600 disabled:opacity-50"
            >
              {spinning ? "돌아가는 중..." : "룰렛 돌리기"}
            </button>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-gray-800">{PRIZES[wonIndex].label}</h2>
            <p className="text-sm font-medium text-gray-500">직원에게 화면을 보여주세요</p>
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-gray-300 px-6 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50"
            >
              처음으로
            </button>
          </>
        )}
      </div>
    </div>
  );
}
