"use client";

import { useEffect, useState } from "react";

/** Seconds since mount, ticking every animation frame (or frozen when reduced motion is on). */
export function useClock(stopAt = Infinity) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      if (reduced) return setT(Math.min(stopAt, 60));
      const s = (now - t0) / 1000;
      setT(s);
      if (s < stopAt) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [stopAt]);
  return t;
}
