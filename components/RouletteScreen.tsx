"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useKioskStore } from "@/lib/stateMachine";

// Ported from the "굿즈 룰렛" design (claude.ai/design project
// 8e04fe27-e50e-4dd5-a7ad-445b35f49a59, Goods Roulette.dc.html) — wedge
// layout/sizes, colors, pointer, center START button and label placement
// all match that file exactly (unlike an earlier version of this file,
// which also resized the wedges to rebalance odds — that was reverted;
// the wheel's look stays as designed).
//
// The actual odds are handled separately from the wedge angles below
// (see PRIZE_WEIGHTS/pickWedge) rather than being read off wedge size the
// way the source design did it: at the source's literal per-degree odds
// (로고 스티커 50%, 브리스톨 스티커 30%, 부적카드 15%, 키캡 키링 5%) one
// prize won half the time, which felt repetitive — landing still animates
// to a real wedge of the chosen prize, it's just which prize gets chosen
// that's reweighted to 35/30/20/15.
const WEDGE_STYLE: Record<string, { fill: string; text: string; fontSize: number; width: number; radius: number }> = {
  "로고 스티커": { fill: "#F4744A", text: "#FFFFFF", fontSize: 14, width: 96, radius: 142 },
  "브리스톨 스티커": { fill: "#FFC7AE", text: "#8C3A1E", fontSize: 13, width: 92, radius: 142 },
  "부적카드": { fill: "#FFEFE6", text: "#C24E29", fontSize: 12, width: 74, radius: 142 },
  "키캡 키링": { fill: "#FFC94A", text: "#FFFFFF", fontSize: 11, width: 64, radius: 148 },
};

const WEDGES = [
  { a: 0, s: 45, n: "로고 스티커" },
  { a: 45, s: 36, n: "브리스톨 스티커" },
  { a: 81, s: 45, n: "로고 스티커" },
  { a: 126, s: 27, n: "부적카드" },
  { a: 153, s: 45, n: "로고 스티커" },
  { a: 198, s: 36, n: "브리스톨 스티커" },
  { a: 234, s: 18, n: "키캡 키링" },
  { a: 252, s: 45, n: "로고 스티커" },
  { a: 297, s: 36, n: "브리스톨 스티커" },
  { a: 333, s: 27, n: "부적카드" },
] as const;

const PRIZE_WEIGHTS: Record<string, number> = {
  "로고 스티커": 35,
  "브리스톨 스티커": 30,
  "부적카드": 20,
  "키캡 키링": 15,
};

const BONUS_PRIZE = "물티슈";
const WHEEL_SIZE = 440;
const SPIN_TRANSITION = { duration: 4.6, ease: [0.16, 0.86, 0.09, 1] } as const;
const SPIN_DURATION_MS = 4700;

// Picks a prize by PRIZE_WEIGHTS first, then a random wedge instance of
// that prize to actually land on — decoupling win odds from how large
// that prize's slices are drawn.
function pickWedge() {
  const totalWeight = Object.values(PRIZE_WEIGHTS).reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * totalWeight;
  let chosenName: string = WEDGES[0].n;
  for (const name in PRIZE_WEIGHTS) {
    const weight = PRIZE_WEIGHTS[name];
    if (roll < weight) {
      chosenName = name;
      break;
    }
    roll -= weight;
  }
  const candidates = WEDGES.filter((w) => w.n === chosenName);
  return candidates[Math.floor(Math.random() * candidates.length)] ?? WEDGES[0];
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
  const [won, setWon] = useState<{ n: string } | null>(null);
  const spunOnce = useRef(false);

  const conicGradient = useMemo(() => {
    const stops = WEDGES.map((w) => `${WEDGE_STYLE[w.n].fill} ${w.a}deg ${w.a + w.s}deg`);
    return `conic-gradient(${stops.join(", ")})`;
  }, []);

  function handleSpin() {
    if (spinning || spunOnce.current) return;
    spunOnce.current = true;
    setSpinning(true);

    const w = pickWedge();
    // Land somewhere in the middle 60% of the wedge (never right at an
    // edge), plus several full turns so the spin reads as a real spin.
    const target = w.a + w.s * (0.2 + Math.random() * 0.6);
    setRotation((prev) => {
      const delta = (((-target - prev) % 360) + 360) % 360;
      return prev + 360 * 6 + delta;
    });

    setTimeout(() => {
      setSpinning(false);
      setWon({ n: w.n });
    }, SPIN_DURATION_MS);
  }

  return (
    <div
      className="flex h-full w-full flex-row items-center justify-center gap-16 px-16 py-8"
      style={{ background: "#EFEDEA", fontFamily: "Pretendard, system-ui, sans-serif" }}
    >
      <div className="flex flex-col items-center gap-7">
        <div className="flex flex-col items-center gap-2.5">
          <div className="rounded-[10px] bg-[#F4744A] px-6 py-2.5 text-3xl font-bold tracking-tight text-white">굿즈 룰렛</div>
          <AnimatePresence mode="wait">
            {won === null ? (
              <motion.p
                key="prompt"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="m-0 text-[17px] font-medium text-[#8A7F79]"
              >
                돌려서 굿즈 하나를 받아가세요
              </motion.p>
            ) : (
              <motion.p
                key="result"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }}
                className="m-0 text-[17px] font-semibold text-[#F4744A]"
              >
                🎉 당첨을 축하드려요!
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className="relative shrink-0" style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}>
          <div
            className="absolute -top-1.5 left-1/2 z-10 h-0 w-0 -translate-x-1/2 drop-shadow-md"
            style={{ borderLeft: "13px solid transparent", borderRight: "13px solid transparent", borderTop: "52px solid #8A5A3B" }}
          />

          <div
            className="absolute inset-0 rounded-full bg-white"
            style={{ boxShadow: "0 12px 32px rgba(160,120,100,.28), inset 0 0 0 10px #FFFFFF, inset 0 0 0 13px #FFD9C7" }}
          />

          <motion.div
            className="absolute overflow-hidden rounded-full"
            style={{ inset: 13, background: conicGradient }}
            animate={{ rotate: rotation }}
            transition={SPIN_TRANSITION}
          />

          {/* Labels live outside the spinning gradient layer: each one gets
              its own pivot (rotates out to its wedge) plus an inner
              counter-rotation of the same amount, so the text tracks the
              wheel's position but never tilts — otherwise it spins along
              with the wheel and ends up sideways once it stops. */}
          {WEDGES.map((w, i) => {
            const mid = w.a + w.s / 2;
            const style = WEDGE_STYLE[w.n];
            return (
              <motion.div
                key={i}
                className="absolute left-1/2 top-1/2 h-0 w-0"
                style={{ rotate: mid }}
                animate={{ rotate: mid + rotation }}
                transition={SPIN_TRANSITION}
              >
                <motion.div
                  className="absolute left-1/2 -translate-x-1/2 whitespace-pre-line text-center font-extrabold leading-tight"
                  style={{
                    top: -style.radius,
                    width: style.width,
                    fontSize: style.fontSize,
                    color: style.text,
                    rotate: -mid,
                  }}
                  animate={{ rotate: -(mid + rotation) }}
                  transition={SPIN_TRANSITION}
                >
                  {w.n.replace(" ", "\n")}
                </motion.div>
              </motion.div>
            );
          })}

          <button
            type="button"
            onClick={handleSpin}
            disabled={spinning || won !== null}
            className="absolute left-1/2 top-1/2 z-20 flex h-26 w-26 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-none bg-white text-lg font-extrabold tracking-tight text-[#F4744A] shadow-[0_6px_16px_rgba(160,110,90,.32)] disabled:opacity-70"
          >
            START
          </button>
        </div>
      </div>

      {/* "당첨을 축하합니다" ticket card — ported from the same Design
          project's later revision, which replaced the plain pill result
          with this ribbon+dashed-card layout. Kept to the roulette's right
          side rather than reproducing the design file's own decorative
          sparkle-burst backdrop, since we already have a real spinning
          wheel on the left. */}
      <AnimatePresence>
        {won !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
            className="flex flex-col items-center"
            style={{ width: 450 }}
          >
            <div
              className="relative z-10 text-center text-[19px] font-extrabold tracking-[-0.4px] text-white shadow-[0_6px_14px_rgba(196,78,41,0.28)]"
              style={{
                background: "#F4744A",
                clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 84%, 0 100%)",
                padding: "13px 54px 26px",
              }}
            >
              당첨을 축하합니다
            </div>

            <div
              className="relative flex w-full flex-col items-center gap-3.5 rounded-[20px] border-2 border-dashed bg-white shadow-[0_14px_30px_rgba(160,120,100,0.2)]"
              style={{ borderColor: "#FFC7AE", marginTop: -6, padding: "30px 26px 26px" }}
            >
              <div className="absolute -left-[11px] -top-[9px] h-[18px] w-[18px] rounded-full" style={{ background: "#EFEDEA" }} />
              <div className="absolute -right-[11px] -top-[9px] h-[18px] w-[18px] rounded-full" style={{ background: "#EFEDEA" }} />

              <span className="text-[11px] font-bold tracking-[2.4px] text-[#C9B7AC]">GOODS ROULETTE</span>

              <div className="flex w-full items-center justify-center gap-2.5">
                <span className="h-px flex-1" style={{ background: "#F3E2D8" }} />
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: "#FFC94A" }} />
                <span className="h-px flex-1" style={{ background: "#F3E2D8" }} />
              </div>

              <div className="text-center text-[30px] font-extrabold tracking-[-1px] text-[#3A322E]">{won.n}</div>

              <div className="flex items-center gap-1.5 text-sm font-bold tracking-[-0.3px] text-[#C24E29]">
                <span className="h-[5px] w-[5px] rounded-full" style={{ background: "#FFC94A" }} />
                {BONUS_PRIZE} 1개를 함께 드립니다
              </div>
            </div>

            <button
              type="button"
              onClick={reset}
              className="mt-5 rounded-full border border-[#E3DCD6] bg-white px-8 py-3 text-base font-medium text-[#8A7F79] shadow-sm hover:bg-[#FAF8F6]"
            >
              처음으로
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
