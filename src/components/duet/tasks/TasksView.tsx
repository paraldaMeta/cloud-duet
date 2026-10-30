"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ArrowUpDown, ChevronDown, Clock3, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLang, useT } from "@/lib/client/i18n";
import { api, useDuet } from "@/lib/client/store";
import { locale, type Lang, type Vars } from "@/lib/i18n";
import type { Routine, Task, TaskStatus } from "@/lib/shared/types";
import { cn } from "@/lib/utils";
import { ChannelGlyph, clock, timeAgo } from "../bits";
import { useNow } from "../hooks";
import { AppLogo } from "../Logos";
import { STATUS_META } from "./TaskGlyph";

function CheckBox({ task }: { task: Task }) {
  const t = useT();
  const [done, setDone] = useState(task.status === "resolved");
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (pending.current) clearTimeout(pending.current);
  }, []);
  return (
    <button
      type="button"
      aria-label={t("Mark complete")}
      onClick={async (e) => {
        e.stopPropagation();
        const next = !done;
        setDone(next);
        navigator.vibrate?.(6);
        if (pending.current) clearTimeout(pending.current);
        const was = task.status;
        pending.current = setTimeout(() => {
          pending.current = null;
          // Unchecking before the resolve went out just cancels it.
          if (!next && was !== "resolved") return;
          api.patch(`tasks/${task.id}`, { status: next ? "resolved" : "ready_for_review" }).catch((err: Error) => {
            setDone(!next);
            toast(err.message);
          });
        }, next ? 450 : 0);
      }}
      className={cn("mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-[7px] border-[1.8px] transition-colors", done ? "border-ink bg-ink text-paper" : "border-ink-3")}
    >
      <AnimatePresence>
        {done && (
          <motion.svg viewBox="0 0 16 16" width="14" height="14" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} aria-hidden>
            <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.25 }} />
          </motion.svg>
        )}
      </AnimatePresence>
    </button>
  );
}

function TaskRow({ task, showChannel }: { task: Task; showChannel: boolean }) {
  const set = useDuet((s) => s.set);
  const channel = useDuet((s) => s.data?.channels.find((c) => c.id === task.channelId));
  const t = useT();
  const meta = STATUS_META[task.status];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 36 }}
      className="flex cursor-pointer items-start gap-3 py-3"
      role="button"
      tabIndex={0}
      onClick={() => set({ taskId: task.id })}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
        e.preventDefault();
        set({ taskId: task.id });
      }}
    >
      <CheckBox key={task.status} task={task} />
      <div className="min-w-0 flex-1">
        <p className={cn("line-clamp-2 text-[19px] leading-[24px]", task.status === "resolved" && "text-ink-3 line-through decoration-ink-3/50")}>{task.title}</p>
        <p className="mt-1 truncate text-[14px]">
          <span style={{ color: meta.color }} className={cn("font-medium", task.status === "working" && "shimmer")}>
            {t(meta.label)}
          </span>
          <span className="text-ink-2"> · {task.latest}</span>
        </p>
        {showChannel && channel && channel.id !== "main" && (
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-2">
            <ChannelGlyph icon={channel.icon} color={channel.color} size={14} radius={4} />#{channel.name}
          </p>
        )}
      </div>
    </motion.div>
  );
}

function Group({ title, count, right, children, collapsible = false, defaultOpen = true }: { title: string; count: number; right?: React.ReactNode; children: React.ReactNode; collapsible?: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!count) return null;
  return (
    <motion.section layout className="pt-5">
      <button type="button" disabled={!collapsible} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left">
        <span className="text-[15px] font-semibold">{title}</span>
        <span className="text-[15px] text-ink-3">{count}</span>
        {collapsible && <ChevronDown size={16} className={cn("text-ink-3 transition-transform", !open && "-rotate-90")} />}
        <span className="flex-1" />
        {right}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function when(iso: string, t: (text: string, vars?: Vars) => string, lang: Lang) {
  const d = new Date(iso);
  const today = new Date();
  const tmr = new Date();
  tmr.setDate(today.getDate() + 1);
  const time = clock(iso);
  if (d.toDateString() === today.toDateString()) return t("today at {time}", { time });
  if (d.toDateString() === tmr.toDateString()) return t("tomorrow at {time}", { time });
  return t("{day} at {time}", { day: d.toLocaleDateString(locale(lang), { weekday: "long" }), time });
}

function RoutineRow({ r }: { r: Routine }) {
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const settings = useDuet((s) => s.data!.settings);
  const times = settings.checkinHours.map((h) => {
    const d = new Date();
    d.setHours(h, settings.checkinMinute, 0, 0);
    return clock(d.toISOString());
  });
  return (
    <div className="py-3">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-3 text-left">
        <Clock3 size={20} className="mt-0.5 shrink-0 text-ink-2" />
        <span className="min-w-0 flex-1">
          <span className="block text-[19px] leading-[24px]">{r.title}</span>
          <span className="mt-1 block text-[14px] text-ink-2">
            {r.id === "brief" ? t("Daily at {time} · next run {when}", { time: clock(r.nextRunAt), when: when(r.nextRunAt, t, lang) }) : t("Next run {when}", { when: when(r.nextRunAt, t, lang) })}
          </span>
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pl-8">
            <p className="pt-2 text-[14px] text-ink-2">
              {r.id === "checkin"
                ? t(settings.weekendsOn ? "At {times} and {last}, every day" : "At {times} and {last}, on weekdays", { times: times.slice(0, -1).join(t(", ")), last: times.at(-1) ?? "" })
                : t(settings.weekendsOn ? "Every day at {time}" : "Every weekday at {time}", { time: clock(r.nextRunAt) })}
            </p>
            <div className="mt-2 space-y-1">
              {r.runs.slice(0, 5).map((run) => (
                <p key={run.at} className="text-[13px] text-ink-3">
                  {when(run.at, t, lang).replace(/^./, (c) => c.toUpperCase())} · {t(run.outcome)}
                </p>
              ))}
              {r.runs.length === 0 && <p className="text-[13px] text-ink-3">{t("No runs yet")}</p>}
            </div>
            <button
              type="button"
              onClick={() => {
                void api.post(`routines/${r.id}`);
                toast(r.id === "brief" ? t("Writing your brief…") : t("Checking in…"));
                useDuet.getState().set({ tab: "chat", channelId: "main" });
              }}
              className="mt-3 rounded-full border border-hair px-4 py-1.5 text-[14px] font-medium"
            >
              {t("Run now")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function TasksView() {
  const t = useT();
  const data = useDuet((s) => s.data)!;
  const channelId = useDuet((s) => s.channelId);
  const set = useDuet((s) => s.set);
  const [seg, setSeg] = useState<"active" | "next">("active");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [oldest, setOldest] = useState(false);
  const [scanning, setScanning] = useState(false);
  useNow(30_000);

  const scoped = channelId !== "main";
  const tasks = useMemo(() => {
    const list = data.tasks.filter((x) => !x.archived && (!scoped || x.channelId === channelId) && (!query || x.title.toLowerCase().includes(query.toLowerCase())));
    list.sort((a, b) => (oldest ? 1 : -1) * (Date.parse(a.updatedAt) - Date.parse(b.updatedAt)));
    return list;
  }, [data.tasks, scoped, channelId, query, oldest]);
  const by = (s: TaskStatus) => tasks.filter((x) => x.status === s);
  const ready = by("ready_for_review");
  const upNext = data.upNext.filter((u) => !scoped || u.channelId === channelId);
  const latest = ready[0]?.updatedAt;

  return (
    <div className="no-scrollbar h-full overflow-y-auto">
      <div className="mx-auto max-w-[680px] px-5 pb-[200px] pt-[118px]">
        <div className="flex items-center gap-4">
          <LayoutGroup id="seg">
            {(["active", "next"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setSeg(s)} className={cn("font-serif text-[28px] font-semibold transition-colors", seg === s ? "text-ink" : "text-ink-3")}>
                {s === "active" ? t("Active") : t("Up next")}
                {s === "next" && upNext.length > 0 && <span className="ml-1 align-super text-[13px] text-orange">{upNext.length}</span>}
              </button>
            ))}
          </LayoutGroup>
          <span className="flex-1" />
          <button type="button" aria-label={t("Sort")} onClick={() => setOldest((o) => !o)} className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-black/5">
            <ArrowUpDown size={18} />
          </button>
          <button type="button" aria-label={t("Search")} onClick={() => setSearching((v) => !v)} className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-black/5">
            {searching ? <X size={18} /> : <Search size={18} />}
          </button>
        </div>
        <p className="text-[13px] text-ink-3">{scoped ? t("In #{name}", { name: data.channels.find((c) => c.id === channelId)?.name ?? "" }) : t("Everything")}</p>
        <AnimatePresence>
          {searching && (
            <motion.input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Search tasks")}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 44, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-3 w-full rounded-full border border-hair bg-chrome px-4 text-[16px] outline-none"
            />
          )}
        </AnimatePresence>

        {seg === "active" ? (
          <>
            <Group title={t("Ready for review")} count={ready.length} right={latest && <span className="text-[13px] text-ink-3">{t("Updated {time}", { time: timeAgo(latest).toLowerCase() })}</span>}>
              <AnimatePresence initial={false}>{ready.map((t) => <TaskRow key={t.id} task={t} showChannel={!scoped} />)}</AnimatePresence>
            </Group>
            <Group title={t("Needs input")} count={by("needs_input").length}>
              <AnimatePresence initial={false}>{by("needs_input").map((t) => <TaskRow key={t.id} task={t} showChannel={!scoped} />)}</AnimatePresence>
            </Group>
            <Group title={t("Working")} count={by("working").length}>
              <AnimatePresence initial={false}>{by("working").map((t) => <TaskRow key={t.id} task={t} showChannel={!scoped} />)}</AnimatePresence>
            </Group>
            <Group title={t("Scheduled")} count={data.routines.length + by("scheduled").length} collapsible>
              {data.routines.map((r) => (
                <RoutineRow key={r.id} r={r} />
              ))}
              {by("scheduled").map((t) => (
                <TaskRow key={t.id} task={t} showChannel={!scoped} />
              ))}
            </Group>
            <Group title={t("Resolved")} count={by("resolved").length} collapsible defaultOpen={false}>
              {by("resolved").map((t) => (
                <TaskRow key={t.id} task={t} showChannel={!scoped} />
              ))}
            </Group>
            {tasks.filter((x) => x.status !== "resolved").length === 0 && (
              <div className="pt-16 text-center">
                <p className="font-serif text-[20px] font-semibold">{t("Nothing in flight")}</p>
                <p className="mx-auto mt-1 max-w-[260px] text-[15px] text-ink-2">{t("Hand Cloud Duet a task from chat, or tap + to add one here.")}</p>
              </div>
            )}
          </>
        ) : upNext.length ? (
          <section className="pt-5">
            <p className="text-[15px] font-semibold">{t("From your connectors")}</p>
            <AnimatePresence initial={false}>
              {upNext.map((u) => (
                <motion.div key={u.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 60 }} className="flex items-start gap-3 py-3">
                  <span className="mt-1">
                    <AppLogo id={u.source.toLowerCase().replace("google ", "g").replace("gmail", "gmail")} size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[18px] leading-[23px]">{u.title}</p>
                    <p className="mt-0.5 text-[14px] text-ink-2">{u.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.post(`upnext/${u.id}`);
                      toast(t("Added. Cloud Duet is on it."));
                    }}
                    className="flex shrink-0 items-center gap-1 rounded-full border border-hair px-3 py-1.5 text-[14px] font-medium"
                  >
                    <Plus size={14} /> {t("Add")}
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </section>
        ) : (
          <div className="flex flex-col items-center pt-20 text-center">
            <div className="flex -space-x-2">
              {["gmail", "gcal", "slack"].map((id, i) => (
                <motion.span key={id} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.08 }} className="chrome-shadow grid size-12 place-items-center rounded-2xl bg-chrome">
                  <AppLogo id={id} size={24} />
                </motion.span>
              ))}
            </div>
            <p className="mt-5 font-serif text-[22px] font-semibold">{t("What can I take off your plate?")}</p>
            <p className="mt-1 max-w-[280px] text-[15px] text-ink-2">{t("I'll check your tools for work I can handle and bring you a short list.")}</p>
            <button
              type="button"
              disabled={scanning}
              onClick={async () => {
                setScanning(true);
                await api.post("tasks/scan");
                setTimeout(() => setScanning(false), 1500);
              }}
              className="chrome-shadow mt-5 flex items-center gap-2 rounded-full bg-chrome px-5 py-2.5 text-[15px] font-medium"
            >
              {scanning ? <span className="shimmer">{t("Checking your tools…")}</span> : t("Show me")}
            </button>
          </div>
        )}
      </div>

      <motion.button
        type="button"
        aria-label={t("Add a task")}
        whileTap={{ scale: 0.92 }}
        onClick={() => set({ sheet: "addTask" })}
        className="absolute bottom-[112px] right-[max(9%,calc(50%-200px))] z-20 grid size-14 place-items-center rounded-full bg-[#D65A45] text-white shadow-lg shadow-[#D65A45]/30"
      >
        <Plus size={26} />
      </motion.button>
    </div>
  );
}
