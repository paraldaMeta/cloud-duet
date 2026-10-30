"use client";

import { motion } from "motion/react";
import { useEffect, useRef } from "react";

// Same command structure in every pose so the path morphs instead of swapping.
const WAVE = "M8 56 C24 38, 36 74, 52 56 C62 45, 76 46, 96 50";
const DASH = "M78 44 C79 44.5, 80 45, 81 45.5 C82 46, 83 46.5, 85 47";
const TUCK = "M58 46 C60 47, 62 49, 64 51 C65 52, 66 53, 67 54";
const CHECK = "M30 52 C34 56, 39 61, 44 67 C52 55, 61 42, 72 31";

const RAYS = Array.from({ length: 9 }, (_, i) => {
  const a = (i / 9) * Math.PI * 2 - Math.PI / 2 + (i % 2 ? 0.12 : -0.05);
  return { a, r0: 42 + (i % 3) * 3, len: 7 + (i % 2) * 3 };
});

/** The orange circle and hand-drawn check that closes onboarding. */
export function Celebration({ onDone }: { onDone: () => void }) {
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    const t = setTimeout(() => done.current(), 2300);
    return () => clearTimeout(t);
  }, []);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.4 } }} className="fixed inset-0 z-[90] grid place-items-center bg-[#F7F7F7] dark:bg-[#0C0C0C]">
      <svg viewBox="0 0 100 100" width={150} height={150} className="overflow-visible">
        <motion.circle
          cx="50"
          cy="50"
          r="31"
          fill="#C6624B"
          initial={{ scale: 0.3, opacity: 0.7 }}
          animate={{ scale: [0.3, 1.08, 0.86, 1], opacity: 1 }}
          transition={{ duration: 0.9, times: [0, 0.35, 0.65, 1], ease: "easeOut" }}
          style={{ transformOrigin: "50px 50px" }}
        />
        <motion.path
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[#141413] dark:text-white"
          initial={{ d: WAVE }}
          animate={{ d: [WAVE, DASH, TUCK, CHECK], strokeWidth: [5, 5, 6, 7] }}
          transition={{ duration: 0.95, times: [0, 0.35, 0.55, 1], ease: "easeInOut" }}
        />
        {RAYS.map((r, i) => (
          <motion.line
            key={i}
            x1={50 + Math.cos(r.a) * r.r0}
            y1={50 + Math.sin(r.a) * r.r0}
            x2={50 + Math.cos(r.a) * (r.r0 + r.len)}
            y2={50 + Math.sin(r.a) * (r.r0 + r.len)}
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
            className="text-[#141413] dark:text-white"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.7, 1, 1.15, 1.2] }}
            transition={{ delay: 0.95, duration: 0.75, times: [0, 0.2, 0.7, 1] }}
            style={{ transformOrigin: "50px 50px" }}
          />
        ))}
      </svg>
    </motion.div>
  );
}
