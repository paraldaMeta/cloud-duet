import { Check, Clock3 } from "lucide-react";
import type { TaskStatus } from "@/lib/shared/types";

export const STATUS_META: Record<TaskStatus, { label: string; color: string }> = {
  working: { label: "Working", color: "#5B86D3" },
  needs_input: { label: "Needs input", color: "#D79100" },
  ready_for_review: { label: "Ready for review", color: "var(--duet-ready)" },
  scheduled: { label: "Scheduled", color: "var(--duet-ink-2)" },
  resolved: { label: "Resolved", color: "var(--duet-ink-3)" },
};

/** A small status mark: spinner while working, filled dots otherwise. */
export function TaskGlyph({ status, size = 16 }: { status: TaskStatus; size?: number }) {
  if (status === "working") {
    return (
      <svg viewBox="0 0 20 20" width={size} height={size} className="shrink-0 animate-spin" style={{ color: "#5B86D3", animationDuration: "0.9s" }} aria-hidden>
        <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeOpacity=".2" strokeWidth="2.4" />
        <path d="M10 2.5a7.5 7.5 0 0 1 7.5 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === "scheduled") return <Clock3 size={size} className="shrink-0 text-ink-2" />;
  if (status === "resolved") {
    return (
      <span className="grid shrink-0 place-items-center rounded-full bg-ink-3 text-white" style={{ width: size, height: size }}>
        <Check size={size * 0.7} strokeWidth={3} />
      </span>
    );
  }
  const color = STATUS_META[status].color;
  return (
    <span className="grid shrink-0 place-items-center rounded-full border-2" style={{ width: size, height: size, borderColor: color }}>
      <span className="rounded-full" style={{ width: size * 0.38, height: size * 0.38, background: color }} />
    </span>
  );
}
