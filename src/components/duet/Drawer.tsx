"use client";

import { AnimatePresence, motion, useDragControls, type PanInfo } from "motion/react";
import { ChevronLeft, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useT } from "@/lib/client/i18n";
import { cn } from "@/lib/utils";

/** An iOS-style sheet: springs up from the bottom, drags down to dismiss, docks centred on desktop. */
export function Drawer({
  open,
  onClose,
  onBack,
  title,
  children,
  className,
  full = false,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  full?: boolean;
  footer?: ReactNode;
}) {
  const drag = useDragControls();
  const t = useT();
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);

  const end = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal>
          <motion.div
            className="absolute inset-0 bg-black/25 dark:bg-black/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 40, mass: 0.9 }}
            drag="y"
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.9 }}
            onDragEnd={end}
            className={cn(
              "relative flex w-full flex-col overflow-hidden rounded-t-[28px] bg-paper shadow-2xl sm:max-w-[460px] sm:rounded-[28px]",
              full ? "h-[94dvh] sm:h-[86dvh]" : "max-h-[92dvh]",
              className,
            )}
          >
            <div className="shrink-0 cursor-grab touch-none pt-2 active:cursor-grabbing" onPointerDown={(e) => drag.start(e)}>
              <div className="mx-auto h-[5px] w-9 rounded-full bg-black/15 dark:bg-white/20" />
              <div className="relative flex min-h-12 items-center justify-center px-14 pt-1.5">
                {onBack && (
                  <button type="button" aria-label={t("Back")} onClick={onBack} className="absolute left-3 grid size-9 place-items-center rounded-full bg-black/[0.05] text-ink dark:bg-white/10">
                    <ChevronLeft size={19} />
                  </button>
                )}
                {title && <h2 className="truncate text-center text-[17px] font-semibold">{title}</h2>}
                <button type="button" aria-label={t("Close")} onClick={onClose} className="absolute right-3 grid size-9 place-items-center rounded-full bg-black/[0.05] text-ink dark:bg-white/10">
                  <X size={17} />
                </button>
              </div>
            </div>
            <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),20px)]">{children}</div>
            {footer && <div className="shrink-0 px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-2">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Group({ title, children, note }: { title?: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section className="mt-5 first:mt-2">
      {title && <h3 className="mb-1.5 px-3 text-[13px] font-medium text-ink-2">{title}</h3>}
      <div className="divide-y divide-hair overflow-hidden rounded-2xl bg-chrome">{children}</div>
      {note && <p className="mt-1.5 px-3 text-[12.5px] leading-snug text-ink-3">{note}</p>}
    </section>
  );
}

export function Row({
  icon,
  label,
  detail,
  right,
  onClick,
  danger,
  chevron = !!onClick,
}: {
  icon?: ReactNode;
  label: ReactNode;
  detail?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  chevron?: boolean;
}) {
  const inner = (
    <>
      {icon && <span className="grid size-8 shrink-0 place-items-center">{icon}</span>}
      <span className="min-w-0 flex-1 text-left">
        <span className={cn("block truncate text-[15.5px]", danger && "text-[#D23B2A]")}>{label}</span>
        {detail && <span className="block truncate text-[13px] text-ink-2">{detail}</span>}
      </span>
      {right}
      {chevron && <ChevronLeft size={17} className="rotate-180 text-ink-3" />}
    </>
  );
  if (!onClick) return <div className="flex min-h-[52px] items-center gap-3 px-3 py-2">{inner}</div>;
  return (
    <button type="button" onClick={onClick} className="flex min-h-[52px] w-full items-center gap-3 px-3 py-2 transition-colors active:bg-black/[0.04] dark:active:bg-white/5">
      {inner}
    </button>
  );
}

/** A Duet-style toggle: a small pill that slides. */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn("relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors duration-200", on ? "bg-ready" : "bg-black/15 dark:bg-white/20")}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 700, damping: 38 }}
        className={cn("absolute top-[2px] size-[26px] rounded-full bg-white shadow", on ? "right-[2px]" : "left-[2px]")}
      />
    </button>
  );
}

/** Two-option segmented control (Ask / Always). */
export function Segment<T extends string>({ value, options, onChange, id }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; id: string }) {
  return (
    <div className="relative flex shrink-0 rounded-full bg-black/[0.06] p-0.5 dark:bg-white/10">
      {options.map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)} className={cn("relative z-10 rounded-full px-3 py-1 text-[13px] font-medium transition-colors", value === o.v ? "text-ink" : "text-ink-2")}>
          {value === o.v && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 -z-10 rounded-full bg-chrome shadow-sm" transition={{ type: "spring", stiffness: 600, damping: 40 }} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}
