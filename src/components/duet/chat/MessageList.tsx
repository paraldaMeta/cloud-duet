"use client";

import { AnimatePresence, motion } from "motion/react";
import { Copy, CornerDownRight, ThumbsDown, ThumbsUp } from "lucide-react";
import { Fragment, useRef, useState } from "react";
import { toast } from "sonner";
import { t as tt, useT } from "@/lib/client/i18n";
import { api, send, useDuet } from "@/lib/client/store";
import type { Message, Reaction } from "@/lib/shared/types";
import { cn } from "@/lib/utils";
import { clock, dayLabel, Squiggle } from "../bits";
import { TaskGlyph } from "../tasks/TaskGlyph";
import { MessageFiles } from "./Attachments";
import { CardView } from "./Cards";
import { Markdown } from "./Markdown";

const REACTIONS: Reaction[] = ["👍", "❤️", "⭐"];

export function TypingDots() {
  return (
    <motion.div initial={{ opacity: 0, y: 6, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex w-fit gap-1 rounded-[20px] bg-bubble px-4 py-3.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="typing-dot size-2 rounded-full bg-ink-2" style={{ animationDelay: `${i * 0.16}s` }} />
      ))}
    </motion.div>
  );
}

function SpawnChip({ taskId }: { taskId: string }) {
  const task = useDuet((s) => s.data?.tasks.find((t) => t.id === taskId));
  const set = useDuet((s) => s.set);
  if (!task) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 380, damping: 28 }} className="mr-3 flex items-start justify-end">
      <button
        type="button"
        onClick={() => set({ taskId })}
        className="mt-3 flex max-w-[230px] items-center gap-2 rounded-full border border-hair bg-chrome py-1.5 pl-2.5 pr-3.5 text-[14px] shadow-sm active:scale-[0.98]"
      >
        <TaskGlyph status={task.status} size={15} />
        <span className="truncate">{task.title}</span>
      </button>
      <svg width="26" height="32" viewBox="0 0 26 32" className="-ml-px shrink-0 text-hair" aria-hidden>
        <path d="M22 0 C22 18, 18 26, 2 26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </motion.div>
  );
}

function Bubble({ m, menuOpen, onMenu, lastUser }: { m: Message; menuOpen: boolean; onMenu: (open: boolean) => void; lastUser: boolean }) {
  const t = useT();
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const [picked, setPicked] = useState(false);
  const mine = m.role === "user";
  const startPress = (e: React.PointerEvent) => {
    origin.current = { x: e.clientX, y: e.clientY };
    press.current = setTimeout(() => {
      press.current = null;
      navigator.vibrate?.(8);
      onMenu(true);
    }, 480);
  };
  const cancel = () => press.current && clearTimeout(press.current);
  const moved = (e: React.PointerEvent) => {
    if (Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) > 8) cancel();
  };

  return (
    <div className={cn("relative flex flex-col", mine ? "items-end" : "items-start")}>
      <span className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-[12px] text-ink-3" style={{ right: -58 }}>
        {clock(m.createdAt)}
      </span>
      {!!m.attachments?.length && (
        <div className={cn("flex w-full", mine ? "justify-end" : "justify-start", m.text && "mb-1.5")}>
          <MessageFiles files={m.attachments} mine={mine} />
        </div>
      )}
      {m.text && (
        <div className="relative max-w-[82%]">
          <motion.div
            onPointerDown={startPress}
            onPointerUp={cancel}
            onPointerLeave={cancel}
            onPointerMove={moved}
            onPointerCancel={cancel}
            onContextMenu={(e) => {
              e.preventDefault();
              onMenu(true);
            }}
            animate={{ scale: menuOpen ? 1.03 : 1 }}
            className={cn(
              "relative select-text [-webkit-touch-callout:none] px-[14px] py-[9px] text-[17px] leading-[23px]",
              mine ? "rounded-[20px] rounded-br-[6px] bg-bubble-user text-bubble-user-fg" : "rounded-[20px] bg-bubble text-ink",
            )}
          >
            {mine ? <p className="whitespace-pre-wrap">{m.text}</p> : <Markdown text={m.text} />}
          </motion.div>
          {(m.reactions.length > 0 || m.claudeReaction) && (
            <div className={cn("absolute -bottom-3 flex gap-0.5", mine ? "right-2" : "left-2")}>
              {[...m.reactions, ...(m.claudeReaction ? [m.claudeReaction] : [])].map((r, i) => (
                <motion.span key={`${r}${i}`} initial={{ scale: 0 }} animate={{ scale: 1 }} className="grid size-6 place-items-center rounded-full border border-hair bg-chrome text-[13px] shadow-sm">
                  {r}
                </motion.span>
              ))}
            </div>
          )}
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.95 }}
                className={cn("absolute bottom-full z-20 mb-2 w-56 overflow-hidden rounded-2xl bg-chrome shadow-xl ring-1 ring-black/5", mine ? "right-0" : "left-0")}
              >
                <div className="flex justify-around border-b border-hair px-2 py-2">
                  {REACTIONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        void api.patch(`messages/${m.id}`, { reaction: r });
                        onMenu(false);
                      }}
                      className={cn("grid size-10 place-items-center rounded-full text-[22px] transition active:scale-90", m.reactions.includes(r) && "bg-black/5 dark:bg-white/10")}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                {[
                  { icon: Copy, label: t("Copy"), run: () => navigator.clipboard?.writeText(m.text).then(() => toast(tt("Copied"))) },
                  ...(!mine
                    ? [
                        { icon: ThumbsUp, label: t("Good response"), run: () => api.patch(`messages/${m.id}`, { feedback: "good" }).then(() => toast(tt("Thanks for the feedback"))) },
                        { icon: ThumbsDown, label: t("Bad response"), run: () => api.patch(`messages/${m.id}`, { feedback: "bad" }).then(() => toast(tt("Thanks for the feedback"))) },
                      ]
                    : []),
                ].map(({ icon: I, label, run }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      void run();
                      onMenu(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-[15px] hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <I size={17} className="text-ink-2" /> {label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      {m.card && (
        <div className={cn("w-full", m.text && "mt-1.5", mine ? "flex justify-end" : "")}>
          <CardView m={m} />
        </div>
      )}
      {m.quickReplies && !picked && m.quickReplies.some((q) => !q.used) && !m.quickReplies.some((q) => q.used) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {m.quickReplies.map((q, i) => (
            <motion.button
              key={q.label}
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06 }}
              disabled={picked}
              onClick={() => {
                setPicked(true);
                void api.patch(`messages/${m.id}`, { quickReply: q.label }).catch(() => {});
                send(q.label, { channelId: m.channelId, taskId: m.taskId }).catch((e: Error) => {
                  setPicked(false);
                  toast(e.message);
                });
              }}
              className="flex items-center gap-1.5 rounded-full border border-hair px-3 py-1.5 text-[15px] active:scale-95"
            >
              <CornerDownRight size={14} className="text-ink-2" />
              {q.label}
            </motion.button>
          ))}
        </div>
      )}
      {mine && lastUser && (
        <span className="mr-1 mt-1 text-[11px] text-ink-3">{m.status === "seen" ? t("Seen") : t("Delivered")}</span>
      )}
      {mine && m.spawnedTaskId && <SpawnChip taskId={m.spawnedTaskId} />}
    </div>
  );
}

export function MessageList({ messages, lane, newAfter }: { messages: Message[]; lane: string; newAfter?: string | null }) {
  const t = useT();
  const [menu, setMenu] = useState<string | null>(null);
  const typing = useDuet((s) => !!s.data?.typing[lane]);
  const status = useDuet((s) => s.data?.status[lane] ?? null);
  const lastUserId = [...messages].reverse().find((m) => m.role === "user")?.id;
  const firstNew = newAfter ? messages.find((m) => m.role === "claude" && m.createdAt > newAfter)?.id : undefined;

  return (
    <div className="relative">
      {menu && <div className="fixed inset-0 z-10" onPointerDown={() => setMenu(null)} />}
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const gap = !prev || Date.parse(m.createdAt) - Date.parse(prev.createdAt) > 45 * 60_000;
        const sameSide = prev && prev.role === m.role && !gap;
        return (
          <Fragment key={m.id}>
            {gap && m.systemKind !== "date" && <p className="pb-2 pt-4 text-center text-[12px] text-ink-3">{dayLabel(m.createdAt)}</p>}
            {m.id === firstNew && (
              <div className="flex items-center gap-2 py-3 text-ink-3">
                <Squiggle className="flex-1" width={200} />
                <span className="text-[12px] font-semibold text-orange">{t("New")}</span>
                <Squiggle className="flex-1" width={200} />
              </div>
            )}
            <motion.div
              layout="position"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className={cn(m.role === "system" ? "py-2" : sameSide ? "pt-1.5" : "pt-4", m.reactions.length > 0 && "pb-3", menu === m.id && "relative z-20")}
            >
              {m.role === "system" ? (
                <p className="text-center text-[12px] text-ink-3">{m.text}</p>
              ) : (
                <Bubble m={m} menuOpen={menu === m.id} onMenu={(o) => setMenu(o ? m.id : null)} lastUser={m.id === lastUserId} />
              )}
            </motion.div>
          </Fragment>
        );
      })}
      <AnimatePresence>
        {status && !typing && (
          <motion.p key={status} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 w-fit rounded-full bg-bubble/70 px-3 py-1 text-[13px] text-ink-2">
            <span className="shimmer">{t(status)}</span>
          </motion.p>
        )}
      </AnimatePresence>
      <AnimatePresence>{typing && <div className="pt-4"><TypingDots /></div>}</AnimatePresence>
    </div>
  );
}
