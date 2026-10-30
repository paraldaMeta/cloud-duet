"use client";

import { AnimatePresence, motion } from "motion/react";
import { Archive, ArrowUpRight, Check, ChevronLeft, CircleCheck, FileText, Link2, MoreHorizontal, RotateCw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/client/i18n";
import { api, send, useDuet } from "@/lib/client/store";
import type { Task, TaskStep } from "@/lib/shared/types";
import { cn } from "@/lib/utils";
import { clock, Squiggle, timeAgo } from "../bits";
import { Composer } from "../Composer";
import { MessageList } from "../chat/MessageList";
import { useStickyScroll } from "../chat/ChatView";
import { STATUS_META } from "./TaskGlyph";

function StepIcon({ state }: { state: TaskStep["state"] }) {
  if (state === "done")
    return (
      <motion.span initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="grid size-[20px] shrink-0 place-items-center rounded-full bg-ink text-paper">
        <Check size={12} strokeWidth={3} />
      </motion.span>
    );
  if (state === "current")
    return (
      <svg viewBox="0 0 20 20" width="20" height="20" className="shrink-0 animate-spin text-working" style={{ animationDuration: "1s" }} aria-hidden>
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeOpacity=".18" strokeWidth="2" />
        <path d="M10 2a8 8 0 0 1 8 8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  return <span className="size-[20px] shrink-0 rounded-full border-[1.6px] border-dashed border-ink-3" />;
}

export function TaskDetail({ task }: { task: Task }) {
  const t = useT();
  const set = useDuet((s) => s.set);
  const data = useDuet((s) => s.data)!;
  const [menu, setMenu] = useState(false);
  const messages = useMemo(() => data.messages.filter((m) => m.taskId === task.id), [data.messages, task.id]);
  const { ref } = useStickyScroll([messages.length, data.typing[task.id]]);
  const meta = STATUS_META[task.status];
  const close = () => set({ taskId: null });

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 380, damping: 40 }}
      drag="x"
      dragDirectionLock
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0, right: 0.6 }}
      onDragEnd={(_, i) => (i.offset.x > 120 || i.velocity.x > 600) && close()}
      className="absolute inset-0 z-40 flex flex-col bg-paper"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10">
        <div className="fade-top absolute inset-x-0 top-0 h-24" />
        <div className="relative mx-auto flex max-w-[680px] items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),12px)]">
          <button type="button" aria-label={t("Back")} onClick={close} className="chrome-shadow pointer-events-auto mt-2 grid size-11 place-items-center rounded-full bg-chrome">
            <ChevronLeft size={22} />
          </button>
          <div className="chrome-shadow pointer-events-auto mt-2 flex min-w-0 flex-1 items-center gap-2 rounded-full bg-chrome py-1.5 pl-1.5 pr-4">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-black/[0.05] dark:bg-white/10">
              <FileText size={16} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold leading-tight">{task.title}</span>
              <span className="block text-[12px] leading-tight" style={{ color: meta.color }}>
                {t(meta.label)}
                <span className="text-ink-2"> · {t(task.updateCount === 1 ? "{n} update" : "{n} updates", { n: task.updateCount })}</span>
              </span>
            </span>
          </div>
          <div className="pointer-events-auto relative mt-2">
            <button type="button" aria-label={t("More")} onClick={() => setMenu((m) => !m)} className="chrome-shadow grid size-11 place-items-center rounded-full bg-chrome">
              <MoreHorizontal size={20} />
            </button>
            <AnimatePresence>
              {menu && (
                <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute right-0 top-12 w-48 origin-top-right overflow-hidden rounded-2xl bg-chrome py-1 shadow-xl ring-1 ring-black/5">
                  {[
                    { icon: CircleCheck, label: t("Mark complete"), run: () => api.patch(`tasks/${task.id}`, { status: "resolved" }).then(close) },
                    { icon: Archive, label: t("Archive"), run: () => api.patch(`tasks/${task.id}`, { archived: true }).then(close) },
                    { icon: Link2, label: t("Copy link"), run: () => navigator.clipboard?.writeText(`${location.origin}/?task=${task.id}`).then(() => toast(t("Link copied"))) },
                  ].map(({ icon: I, label, run }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        setMenu(false);
                        void run();
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-[15px] hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <I size={17} className="text-ink-2" />
                      {label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div ref={ref} className="no-scrollbar flex-1 overflow-y-auto" onPointerDown={() => setMenu(false)}>
        <div className="mx-auto max-w-[680px] px-5 pb-[130px] pt-[96px]">
          <div className="flex items-start gap-2">
            <h1 className="flex-1 text-[22px] font-semibold leading-tight">{task.title}</h1>
            <button type="button" aria-label={t("Refresh")} onClick={() => send(t("Any update?"), { channelId: task.channelId, taskId: task.id })} className="mt-0.5 text-ink-3">
              <RotateCw size={18} />
            </button>
          </div>
          <p className="mt-2 text-[16px] leading-[23px] text-ink-2">{task.description || task.prompt}</p>
          {task.noticedAt && <p className="mt-2 text-[13px] text-ink-3">{t("Noticed {time}", { time: clock(task.noticedAt) })}</p>}
          <Squiggle className="my-5 text-hair" width={140} />

          {task.steps.length > 0 && (
            <section>
              <p className="mb-2 text-[15px] font-semibold">{t("What Cloud Duet is doing")}</p>
              <div className="space-y-2.5">
                {task.steps.map((s) => (
                  <motion.div layout key={s.text} className="flex items-center gap-3">
                    <StepIcon state={s.state} />
                    <span className={cn("text-[16px]", s.state === "pending" && "text-ink-3", s.state === "current" && "font-medium")}>{s.text}</span>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {task.updates.length > 0 && (
            <section className="mt-6">
              <p className="mb-1 text-[15px] font-semibold">{t("Decisions and updates")}</p>
              <AnimatePresence initial={false}>
                {task.updates.map((u) => (
                  <motion.div key={u.at + u.text} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 border-b border-hair py-2.5 last:border-0">
                    <ArrowUpRight size={16} className="mt-0.5 shrink-0 text-ink-3" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px]">{u.text}</p>
                      <p className="text-[12px] text-ink-3">
                        {u.source} · {timeAgo(u.at)}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </section>
          )}

          {task.resources.length > 0 && (
            <section className="mt-6">
              <p className="mb-1 text-[15px] font-semibold">{t("Resources")}</p>
              {task.resources.map((r) => (
                <button
                  key={r.title}
                  type="button"
                  onClick={() => r.artifactId && set({ viewerId: r.artifactId })}
                  className="flex w-full items-center gap-3 rounded-xl py-2 text-left"
                >
                  <span className="grid size-10 place-items-center rounded-xl bg-black/[0.05] dark:bg-white/10">
                    <FileText size={18} />
                  </span>
                  <span>
                    <span className="block text-[15px] font-medium">{r.title}</span>
                    <span className="block text-[13px] text-ink-2">{t(r.type)}</span>
                  </span>
                </button>
              ))}
            </section>
          )}

          {messages.length > 0 && (
            <section className="mt-6 border-t border-hair pt-2">
              <MessageList messages={messages} lane={task.id} />
            </section>
          )}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10">
        <div className="fade-bottom pointer-events-none absolute inset-x-0 bottom-0 h-28" />
        <div className="relative mx-auto max-w-[680px] px-3 pb-[max(env(safe-area-inset-bottom),16px)]">
          <Composer placeholder={t("Reply to Cloud Duet")} showVoice={false} onSend={(text, files) => send(text, { channelId: task.channelId, taskId: task.id, files })} />
        </div>
      </div>
    </motion.div>
  );
}
