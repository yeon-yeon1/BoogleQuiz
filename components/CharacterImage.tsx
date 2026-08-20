"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { assetFor } from "@/lib/characterAssets";
import type { CharacterExpression } from "@/lib/types";

interface CharacterImageProps {
  expression: CharacterExpression;
}

/**
 * Renders one character expression as a crossfading layer. Falls back to a
 * gray placeholder circle if the SVG asset hasn't been dropped in yet, so
 * layout can be verified before final art arrives.
 *
 * The <img> only mounts after the client hydrates: a server-rendered <img>
 * starts fetching during HTML parsing, and a same-origin 404 can resolve
 * (and fire `error`) before React attaches its listener post-hydration,
 * silently swallowing the fallback. Deferring the mount avoids that race.
 */
export default function CharacterImage({ expression }: CharacterImageProps) {
  const [mounted, setMounted] = useState(false);
  const [errored, setErrored] = useState(false);
  const src = assetFor(expression);

  // Client-only mount gate (see comment above) — the deliberate point of
  // this effect is to flip state once, after hydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: "easeInOut" }}
    >
      {!mounted || errored ? (
        <div className="w-full h-full rounded-full bg-gray-300/80 border-2 border-dashed border-gray-400 flex items-center justify-center">
          <span className="text-[10px] text-gray-500 px-2 text-center leading-tight">
            {expression}
          </span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={expression}
          className="w-full h-full object-contain select-none"
          draggable={false}
          onError={() => setErrored(true)}
        />
      )}
    </motion.div>
  );
}
