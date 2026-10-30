"use client";

import { useEffect, useRef } from "react";
import type { AgentStatus } from "@/lib/shared/types";

export type MascotMood = "idle" | "working" | "tasks" | "writing" | "thinking" | "searching" | "starting" | "listening";

export function moodFor(status: AgentStatus | null | undefined, typing = false): MascotMood {
  if (typing) return "writing";
  switch (status) {
    case "Writing a draft":
      return "writing";
    case "Thinking it through":
    case "Checking memory":
      return "thinking";
    case "Searching the web":
    case "Looking something up":
    case "Searching your email":
    case "Checking recent files":
    case "Checking your calendar":
    case "Checking":
    case "Reading now":
      return "searching";
    case "Starting a task":
      return "starting";
    case "Working on your tasks":
      return "tasks";
    case "Working on it":
    case "Working in your browser":
    case "Waking Cloud Duet's workspace":
      return "working";
    default:
      return "idle";
  }
}

const N = 72;
type Pt = [number, number];

const tri = (x: number) => 2 * Math.abs(2 * (x - Math.floor(x + 0.5))) - 1;

function shape(mood: MascotMood, t: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    let x = 4 + 92 * u;
    let y = 50;
    switch (mood) {
      case "idle":
        y = 50 + 4.5 * Math.sin(2 * Math.PI * 1.25 * u + t * 1.3);
        break;
      case "listening":
        y = 50 + (3 + 5 * Math.abs(Math.sin(t * 6 + u * 9))) * Math.sin(2 * Math.PI * 3 * u + t * 5);
        break;
      case "working":
        y = 50 + 7 * Math.sin(2 * Math.PI * 2 * u - t * 3.2);
        break;
      case "tasks":
        y = 50 + 6.5 * tri(4 * u - t * 0.9);
        break;
      case "writing": {
        // A prolate cycloid gives the loopy cursive "ee".
        const th = u * 4 * Math.PI + 0.35;
        const k = 76 / (4 * Math.PI);
        x = 10 + k * th - 11 * Math.sin(th) + Math.sin(t * 2) * 0.8;
        y = 52 - 10 * Math.cos(th) * 0.95 + 1.5 * Math.sin(t * 2.4 + u * 6);
        break;
      }
      case "thinking": {
        x = 30 + 26 * u + Math.sin(t * 2) * 1.2;
        y = 50 + 0.6 * Math.sin(t * 3 + u * 4);
        break;
      }
      case "searching": {
        const a = 2 * Math.PI * u + t * 1.6;
        const rx = 46;
        const ry = 13;
        const tilt = -0.32;
        const ex = rx * Math.cos(a);
        const ey = ry * Math.sin(a);
        x = 50 + ex * Math.cos(tilt) - ey * Math.sin(tilt);
        y = 50 + ex * Math.sin(tilt) + ey * Math.cos(tilt);
        break;
      }
      case "starting":
        x = 2 + 40 * u - ((t * 40) % 6);
        y = 50 + 0.8 * Math.sin(t * 8 + u * 10);
        break;
    }
    pts.push([x, y]);
  }
  return pts;
}

const toD = (pts: Pt[]) => `M${pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join("L")}`;

export function Mascot({ mood = "idle", size = 64, className, still = false }: { mood?: MascotMood; size?: number; className?: string; still?: boolean }) {
  const lineRef = useRef<SVGPathElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const streaksRef = useRef<SVGGElement>(null);
  const moodRef = useRef(mood);
  useEffect(() => {
    moodRef.current = mood;
  }, [mood]);

  useEffect(() => {
    let cur = shape(moodRef.current, 0);
    let dot = 0;
    let streak = 0;
    let raf = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const frame = (now: number) => {
      const t = still || reduced ? 0 : (now - start) / 1000;
      const m = moodRef.current;
      const target = shape(m, t);
      const k = 0.14;
      cur = cur.map(([x, y], i) => [x + (target[i][0] - x) * k, y + (target[i][1] - y) * k]);
      lineRef.current?.setAttribute("d", toD(cur));
      dot += ((m === "thinking" ? 1 : 0) - dot) * 0.15;
      streak += ((m === "starting" ? 1 : 0) - streak) * 0.15;
      if (dotRef.current) {
        dotRef.current.setAttribute("opacity", dot.toFixed(3));
        dotRef.current.setAttribute("r", (3.2 * dot + 0.01).toFixed(2));
      }
      if (streaksRef.current) {
        streaksRef.current.setAttribute("opacity", streak.toFixed(3));
        streaksRef.current.setAttribute("transform", `translate(${-((t * 50) % 10)} 0)`);
      }
      if (bodyRef.current) {
        const busy = m !== "idle";
        const bob = Math.sin(t * (busy ? 3 : 1.6)) * (busy ? 1.6 : 1.1);
        const sq = 1 + Math.sin(t * (busy ? 6 : 2.2)) * (busy ? 0.035 : 0.02);
        bodyRef.current.setAttribute("transform", `translate(50 ${50 + bob}) scale(${(2 - sq).toFixed(4)} ${sq.toFixed(4)}) translate(-50 -50)`);
      }
      if (!still && !reduced) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    if (still || reduced) {
      // Settle the morph immediately when not animating.
      cur = shape(moodRef.current, 0);
      lineRef.current?.setAttribute("d", toD(cur));
    }
    return () => cancelAnimationFrame(raf);
  }, [still]);

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden>
      <g ref={bodyRef}>
        <circle cx="50" cy="50" r="27" fill="#C7604A" />
        <path ref={lineRef} d={toD(shape(mood, 0))} fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" className="text-[#141413] dark:text-white" />
        <circle ref={dotRef} cx="66" cy="50" r="0" fill="currentColor" className="text-[#141413] dark:text-white" opacity="0" />
        <g ref={streaksRef} opacity="0" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="text-[#141413] dark:text-white">
          <path d="M14 38 L34 38" />
          <path d="M8 62 L30 62" />
          <path d="M56 44 L70 44" opacity=".6" />
        </g>
      </g>
    </svg>
  );
}

/** The static mark used for the app icon and small tiles. */
export function MascotMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden>
      <circle cx="50" cy="50" r="30" fill="#C7604A" />
      <path d={toD(shape("writing", 0))} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-[#141413] dark:text-white" />
    </svg>
  );
}
