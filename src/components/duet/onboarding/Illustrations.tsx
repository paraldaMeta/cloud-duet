"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Cloud, CloudCog, Lock, MessageCircle, Moon, PauseCircle, PenTool, Sun, ToggleRight, Waypoints } from "lucide-react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "@/lib/client/i18n";
import { cn } from "@/lib/utils";
import { CalendarLogo, CloudMark, DriveLogo, GitHubLogo, GmailLogo } from "../Logos";
import { MascotMark } from "../Mascot";
import { useClock } from "./useClock";

const ORANGE = "#C6624B";

function Chip({ icon, children, className }: { icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-black/[0.07] bg-white px-3 text-[13px] text-[#141413] shadow-[0_2px_10px_rgb(0_0_0/0.06)]", className)}>
      {icon}
      {children}
    </span>
  );
}

/* Page 1: the 24-hour dial. */
const DOTS = [
  { a: 32, label: "Finished your report", icon: <DriveLogo size={14} />, pos: "left-[56%] top-[24%]" },
  { a: 122, label: "Prepped your 2 PM", icon: <CalendarLogo size={14} />, pos: "left-[52%] top-[60%]" },
  { a: 227, label: "Drafted a reply", icon: <GmailLogo size={14} />, pos: "right-[50%] top-[64%]" },
  { a: 300, label: "Reviewed a PR", icon: <GitHubLogo size={14} />, pos: "right-[52%] top-[28%]" },
];

/** The rim dot the hand passed most recently, given its total swept angle (it starts at 20°). */
function lastDotHit(A: number): { i: number; at: number } | null {
  let best: { i: number; at: number } | null = null;
  const k0 = Math.floor(A / 360);
  for (const k of [k0, k0 - 1]) {
    DOTS.forEach((d, i) => {
      const abs = d.a + 360 * k;
      if (abs <= A && abs >= 20 && (!best || abs > best.at)) best = { i, at: abs };
    });
  }
  return best;
}

export function ClockDial() {
  const t = useClock();
  const tr = useT();
  const A = 20 + 40 * t;
  const angle = A % 360;
  const hit = lastDotHit(A);
  const since = hit ? (A - hit.at) / 40 : 99;

  return (
    <div className="relative mx-auto aspect-square w-[min(290px,74vw)]">
      <div className="absolute inset-0 rounded-full bg-[#FAFAFA] shadow-[0_6px_30px_rgb(0_0_0/0.06),0_1px_2px_rgb(0_0_0/0.04)]" />
      <div
        className="absolute inset-[3%] rounded-full"
        style={{
          transform: `rotate(${angle}deg)`,
          background: "conic-gradient(from -70deg, rgb(233 181 166 / 0) 0deg, rgb(233 181 166 / 0.38) 70deg, transparent 70.2deg)",
          WebkitMaskImage: "radial-gradient(circle, transparent 18%, black 100%)",
          maskImage: "radial-gradient(circle, transparent 18%, black 100%)",
        }}
      />
      <svg viewBox="0 0 300 300" className="absolute inset-0 size-full">
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i * 15 * Math.PI) / 180;
          const major = i % 6 === 0;
          const r1 = major ? 124 : 130;
          return (
            <line
              key={i}
              x1={150 + r1 * Math.sin(a)}
              y1={150 - r1 * Math.cos(a)}
              x2={150 + 138 * Math.sin(a)}
              y2={150 - 138 * Math.cos(a)}
              stroke={major ? "#333" : "#D4D4D4"}
              strokeWidth={major ? 3 : 1.2}
              strokeLinecap="round"
            />
          );
        })}
        <line x1="150" y1="150" x2={150 + 136 * Math.sin((angle * Math.PI) / 180)} y2={150 - 136 * Math.cos((angle * Math.PI) / 180)} stroke={ORANGE} strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="150" cy="150" r="4" fill={ORANGE} />
        {DOTS.map((d, i) => {
          const a = (d.a * Math.PI) / 180;
          const x = 150 + 138 * Math.sin(a);
          const y = 150 - 138 * Math.cos(a);
          const pulse = hit?.i === i && since < 0.9 ? since / 0.9 : -1;
          return (
            <g key={i}>
              {pulse >= 0 && <circle cx={x} cy={y} r={6 + pulse * 14} fill={ORANGE} opacity={0.35 * (1 - pulse)} />}
              <circle cx={x} cy={y} r="6" fill={ORANGE} />
            </g>
          );
        })}
      </svg>
      <Moon size={18} className="absolute left-1/2 top-[15%] -translate-x-1/2 text-[#B5B5B5]" strokeWidth={1.6} />
      <Sun size={18} className="absolute bottom-[15%] left-1/2 -translate-x-1/2 text-[#B5B5B5]" strokeWidth={1.6} />
      <AnimatePresence>
        {hit && (
          <motion.div
            key={`${hit.i}-${hit.at}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.35 }}
            className={cn("absolute", DOTS[hit.i].pos)}
          >
            <Chip icon={DOTS[hit.i].icon} className="h-8">
              {tr(DOTS[hit.i].label)}
            </Chip>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Page 2: apps flying along the arc from Cloud Duet to Duet. */
const tint = (c: string, I: typeof Cloud) => <I size={14} style={{ color: c }} strokeWidth={2} />;
const APPS: { label: string; icon: ReactNode; row: number }[] = [
  { label: "Gmail", icon: <GmailLogo size={14} />, row: 0 },
  { label: "Calendar", icon: <CalendarLogo size={14} />, row: 0 },
  { label: "Drive", icon: <DriveLogo size={14} />, row: 0 },
  { label: "Cloudflare Developer Platform", icon: tint("#F38020", Cloud), row: 1 },
  { label: "Cloudinary", icon: tint("#3448C5", CloudCog), row: 2 },
  { label: "Excalidraw", icon: tint("#6965DB", PenTool), row: 2 },
  { label: "Finance Manager", icon: tint("#5E5D59", MessageCircle), row: 3 },
  { label: "Friend's mobile app analysis", icon: tint("#5E5D59", MessageCircle), row: 4 },
  { label: "Storage cleanup on mini", icon: tint("#5E5D59", MessageCircle), row: 5 },
  { label: "Google voice navigator", icon: tint("#5E5D59", Waypoints), row: 6 },
  { label: "Studio image gen", icon: tint("#5E5D59", Waypoints), row: 6 },
  { label: "X navigator", icon: tint("#5E5D59", Waypoints), row: 7 },
];
const ARC = "M70 58 Q170 -6 270 58";
const STEP = 0.25;
const FLY = 0.7;

export function AppArc() {
  const t = useClock(APPS.length * STEP + FLY + 1);
  const tr = useT();
  const done = t > (APPS.length - 1) * STEP + FLY + 0.15;
  const rows = Array.from(new Set(APPS.map((a) => a.row)));
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[100px] w-[340px] max-w-full">
        <svg viewBox="0 0 340 100" className="absolute inset-0 size-full overflow-visible">
          <path d={ARC} fill="none" stroke="#BDBDBD" strokeWidth="1.6" strokeDasharray="0.1 5" strokeLinecap="round" />
        </svg>
        <div className="absolute left-[40px] top-[28px] grid size-[60px] place-items-center rounded-2xl" style={{ background: ORANGE }}>
          <CloudMark size={34} className="text-white" />
        </div>
        <div className="absolute right-[40px] top-[28px] grid size-[60px] place-items-center rounded-2xl border border-black/[0.06] bg-white shadow-sm">
          <MascotMark size={48} />
          <AnimatePresence>
            {done && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 520, damping: 14 }}
                className="absolute -right-2 -top-2 grid size-[22px] place-items-center rounded-full border-2 border-[#F7F7F7] bg-[#2E9A4E] text-white"
              >
                <Check size={12} strokeWidth={3.4} />
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        {APPS.map((a, i) => {
          const p = (t - i * STEP) / FLY;
          if (p <= 0 || p >= 1) return null;
          const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
          const label = tr(a.label);
          return (
            <div
              key={a.label}
              className="pointer-events-none absolute left-0 top-0"
              style={{
                offsetPath: `path("${ARC}")`,
                offsetDistance: `${e * 100}%`,
                offsetRotate: "0deg",
                opacity: p < 0.12 ? p / 0.12 : p > 0.85 ? (1 - p) / 0.15 : 1,
              }}
            >
              <span className="inline-flex h-[26px] items-center gap-1 whitespace-nowrap rounded-full border border-black/[0.07] bg-white px-2 text-[12px] shadow-sm">
                {a.icon}
                {label.length > 12 ? label.split(" ")[0] : label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex flex-col items-center gap-2">
        {rows.map((r) => (
          <div key={r} className="flex justify-center gap-2">
            {APPS.map((a, i) =>
              a.row === r && t > i * STEP + FLY ? (
                <motion.span key={a.label} initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 420, damping: 24 }}>
                  <Chip icon={a.icon} className="h-8 text-[14px]">
                    {tr(a.label)}
                  </Chip>
                </motion.span>
              ) : null,
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* Page 3: Cloud Duet's cursor filling a form in its own browser. */
const FIELDS = [
  { label: "Name", value: "Alex Kim", at: 1.6 },
  { label: "Team", value: "Product design", at: 3.0 },
  { label: "Dates", value: "May 12 to 14", at: 4.8 },
];
const GLIDE = 0.5;
const CPS = 14;

export function BrowserForm() {
  const t = useClock(9);
  const tr = useT();
  const body = useRef<HTMLDivElement>(null);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const [spots, setSpots] = useState<{ x: number; y: number }[]>([]);
  const [end, setEnd] = useState({ x: 0, y: 0 });
  useLayoutEffect(() => {
    const b = body.current;
    if (!b) return;
    setSpots(refs.current.map((el) => (el ? { x: el.offsetLeft + el.offsetWidth * 0.62, y: el.offsetTop + el.offsetHeight * 0.55 } : { x: 0, y: 0 })));
    setEnd({ x: b.offsetWidth - 34, y: b.offsetHeight - 26 });
  }, []);

  let target = end;
  let active = -1;
  FIELDS.forEach((f, i) => {
    if (t >= f.at) {
      target = spots[i] ?? end;
      active = i;
    }
  });
  const finished = t >= 6.5;
  if (finished) {
    target = end;
    active = -1;
  }
  const typed = (i: number) => {
    const start = FIELDS[i].at + GLIDE;
    const n = Math.max(0, Math.floor((t - start) * CPS));
    return tr(FIELDS[i].value).slice(0, n);
  };

  return (
    <div className="mx-auto flex w-full max-w-[380px] flex-col px-4">
      <AnimatePresence>
        {t > 0.4 && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="self-end rounded-full bg-white px-4 py-2.5 text-[15px] shadow-[0_1px_4px_rgb(0_0_0/0.06)]">
            {tr("Sign my team up for the conference")}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {t > 1.0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="mt-3 overflow-hidden rounded-[18px] border border-black/[0.06] bg-white shadow-[0_6px_24px_rgb(0_0_0/0.07)]"
          >
            <div className="flex items-center gap-1.5 bg-[#EFEFEF] px-3 py-2">
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-2 rounded-full bg-[#CFCFCF]" />
              ))}
              <span className="mx-auto inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-[11px] text-[#5E5D59]">
                <Cloud size={11} /> {tr("Cloud Duet's own computer")}
              </span>
            </div>
            <div ref={body} className="relative p-3.5 pb-4">
              <p className="mb-2.5 text-[13px] font-semibold text-[#141413]">{tr("Conference sign-up")}</p>
              {FIELDS.map((f, i) => (
                <div key={f.label} className="mb-2.5 last:mb-0">
                  <p className="mb-1 text-[11px] text-[#8A8985]">{tr(f.label)}</p>
                  <div
                    ref={(el) => {
                      refs.current[i] = el;
                    }}
                    className={cn("flex h-[30px] items-center rounded-lg bg-[#F2F2F2] px-2.5 text-[13px] text-[#141413] transition-shadow", active === i && "shadow-[inset_0_0_0_1px_#C6624B]")}
                  >
                    {typed(i)}
                    {active === i && typed(i).length < tr(f.value).length && t > f.at + GLIDE && <span className="ml-px h-3.5 w-px animate-pulse bg-[#141413]" />}
                  </div>
                </div>
              ))}
              {t > 1.6 && spots.length > 0 && (
                <motion.div
                  className="pointer-events-none absolute left-0 top-0"
                  initial={{ x: end.x, y: end.y, opacity: 0 }}
                  animate={{ x: target.x, y: target.y, opacity: 1 }}
                  transition={{ duration: GLIDE, ease: [0.4, 0, 0.2, 1] }}
                >
                  <svg width="16" height="18" viewBox="0 0 16 18" className="drop-shadow-sm">
                    <path d="M1.5 1.5 L1.5 15 L5.2 11.6 L8 17 L10.4 15.8 L7.7 10.6 L12.8 10.4 Z" fill={ORANGE} stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
                  </svg>
                  <span className="absolute left-3 top-4 rounded-full px-1.5 py-px text-[10px] font-semibold text-white" style={{ background: ORANGE }}>
                    Cloud Duet
                  </span>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {t > 7.0 && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 max-w-[85%] self-start rounded-2xl bg-[#ECECEC] px-3.5 py-2.5 text-[15px] text-[#141413]">
            {tr("The form's filled in. Take a look before I send it.")}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PhoneTop({ children, flip = false }: { children?: ReactNode; flip?: boolean }) {
  return (
    <div
      className={cn("relative mx-auto h-[300px] w-[min(300px,78vw)] bg-[#E9E9E9]", flip ? "rounded-b-[44px]" : "rounded-t-[44px]")}
      style={{
        WebkitMaskImage: `linear-gradient(${flip ? "to top" : "to bottom"}, black 55%, transparent)`,
        maskImage: `linear-gradient(${flip ? "to top" : "to bottom"}, black 55%, transparent)`,
      }}
    >
      {!flip && <span className="absolute left-1/2 top-3.5 h-[22px] w-[84px] -translate-x-1/2 rounded-full bg-[#D2D2D2]" />}
      {children}
    </div>
  );
}

/* Page 4: safety card over a phone. */
const SAFE = [
  { icon: PauseCircle, bg: "#FCEFC7", fg: "#B58100", title: "Pauses when something looks unsafe", sub: "Cloud Duet stops and checks with you first." },
  { icon: ToggleRight, bg: "#ECE6FA", fg: "#7556C8", title: "You set the permissions", sub: "Choose what Cloud Duet can and can't do." },
  { icon: Lock, bg: "#DFF3DA", fg: "#2E7D32", title: "Private and secure", sub: "Your messages and data stay protected." },
];

export function SafetyCard() {
  const t = useT();
  return (
    <div className="relative">
      <PhoneTop />
      <div className="absolute inset-x-0 top-[70px] mx-auto w-[calc(100%-32px)] max-w-[360px] overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_10px_30px_rgb(0_0_0/0.08)]">
        {SAFE.map((r, i) => (
          <motion.div
            key={r.title}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 + i * 0.2, type: "spring", stiffness: 260, damping: 26 }}
            className="flex items-center gap-3 border-b border-black/[0.06] px-3.5 py-3 last:border-0"
          >
            <span className="grid size-[26px] shrink-0 place-items-center rounded-lg" style={{ background: r.bg, color: r.fg }}>
              <r.icon size={16} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-medium text-[#141413]">{t(r.title)}</span>
              <span className="block truncate text-[12.5px] text-[#8A8985]">{t(r.sub)}</span>
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* Page 6: a notification drops onto a phone. */
export function PhoneNotification() {
  const t = useT();
  return (
    <PhoneTop flip>
      <motion.div
        initial={{ y: -60, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ delay: 0.6, type: "spring", stiffness: 300, damping: 22 }}
        className="absolute inset-x-3 top-[78px] flex items-start gap-2.5 rounded-[18px] bg-white p-2.5 shadow-[0_6px_20px_rgb(0_0_0/0.08)]"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#F4F4F4]">
          <MascotMark size={30} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex justify-between">
            <span className="text-[13px] font-bold text-[#141413]">Cloud Duet</span>
            <span className="text-[11px] text-[#8A8985]">{t("now")}</span>
          </span>
          <span className="block truncate text-[13px] text-[#141413]">{t("Your prep for Launch review is ready.")}</span>
        </span>
      </motion.div>
      <div className="absolute inset-x-0 bottom-6 flex justify-center gap-4">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="size-[50px] rounded-[14px] bg-white" />
        ))}
      </div>
    </PhoneTop>
  );
}
