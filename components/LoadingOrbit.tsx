"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";

interface LoadingOrbitProps {
  /** ms before onComplete fires — spec calls for ~1.5-2s of "analyzing". */
  durationMs?: number;
  onComplete?: () => void;
  ringRadius?: number;
}

/**
 * Scattered floating bubbles (varied size/color/depth) around a close
 * dashed ring, rather than evenly-spaced dots locked to one orbit radius —
 * matches the character's own decorative-bubble look instead of a generic
 * spinner.
 */
const BUBBLES = [
  { angle: 20, radius: 140, size: 20, color: "#FFCEBB", floatDelay: 0 },
  { angle: 70, radius: 168, size: 34, color: "#FFA17D", floatDelay: 0.3 },
  { angle: 125, radius: 145, size: 24, color: "#FFE3D9", floatDelay: 0.6 },
  { angle: 190, radius: 165, size: 30, color: "#FF9D72", floatDelay: 0.9 },
  { angle: 250, radius: 140, size: 22, color: "#FFCEBB", floatDelay: 1.2 },
  { angle: 310, radius: 160, size: 30, color: "#FFA17D", floatDelay: 1.5 },
] as const;

export default function LoadingOrbit({
  durationMs = 1800,
  onComplete,
  ringRadius = 130,
}: LoadingOrbitProps) {
  useEffect(() => {
    if (!onComplete) return;
    const id = setTimeout(onComplete, durationMs);
    return () => clearTimeout(id);
  }, [durationMs, onComplete]);

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <motion.div
        className="absolute rounded-full border-2 border-dashed border-[#f7c3ac]"
        style={{ width: ringRadius * 2, height: ringRadius * 2 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
      />

      {BUBBLES.map((b, i) => {
        const rad = (b.angle * Math.PI) / 180;
        const x = Math.sin(rad) * b.radius;
        const y = -Math.cos(rad) * b.radius;
        return (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: b.size,
              height: b.size,
              marginLeft: -b.size / 2,
              marginTop: -b.size / 2,
              backgroundColor: b.color,
            }}
            initial={{ x, y }}
            animate={{ x, y: [y, y - 10, y] }}
            transition={{
              duration: 2.6,
              repeat: Infinity,
              ease: "easeInOut",
              delay: b.floatDelay,
            }}
          />
        );
      })}
    </div>
  );
}
