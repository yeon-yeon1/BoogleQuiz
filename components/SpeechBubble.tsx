"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { BUBBLE_TRANSITION } from "@/lib/characterMotion";

interface SpeechBubbleProps {
  text: string;
  /** Reveal the text one character at a time. */
  typewriter?: boolean;
  typewriterSpeedMs?: number;
  className?: string;
}

/**
 * Coral-bordered bubble with a centered tail, matching
 * character-alive-prototype.html's `.bubble`. Meant to be placed as a
 * child of the character's positioning box with `bottom: 100%` so it
 * always tracks directly above the character's head, wherever it is.
 */
export default function SpeechBubble({
  text,
  typewriter = false,
  typewriterSpeedMs = 28,
  className,
}: SpeechBubbleProps) {
  const [prevText, setPrevText] = useState(text);
  const [shown, setShown] = useState(() => (typewriter ? "" : text));

  if (text !== prevText) {
    setPrevText(text);
    setShown(typewriter ? "" : text);
  }

  useEffect(() => {
    if (!typewriter) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, typewriterSpeedMs);
    return () => clearInterval(id);
  }, [text, typewriter, typewriterSpeedMs]);

  return (
    <motion.div
      key={text}
      className={className}
      style={{ transformOrigin: "50% 100%" }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={BUBBLE_TRANSITION}
    >
      {/* Layout-animated separately from the entrance pop above — sharing
          one element made the width settling at the end of the typewriter
          compound with the pop's overshoot into a second, unwanted bounce. */}
      <motion.div
        layout
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="relative w-max max-w-70 whitespace-pre-line rounded-[18px] border-2 border-[#f2946a] bg-white px-4 py-3 text-center shadow-lg"
      >
        <p className="text-sm font-semibold leading-snug text-[#55483f]">{shown}</p>
        {/* Two stacked border-triangles (not clip-path) so the outline
            stays crisp all the way around the tip — clip-path only cuts
            the fill, it can't draw a border along the cut edge itself,
            which is what made the old tail's border look broken. */}
        <span className="absolute -bottom-2.5 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[9px] border-t-10 border-x-transparent border-t-[#f2946a]" />
        <span className="absolute -bottom-2 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-8 border-x-transparent border-t-white" />
      </motion.div>
    </motion.div>
  );
}
