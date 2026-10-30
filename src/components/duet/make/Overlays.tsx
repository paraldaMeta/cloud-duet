"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Database, Ellipsis, LayoutPanelTop, Loader2, MessageSquare, Mic, MousePointer2, Pencil, RotateCw, Share, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/client/i18n";
import { api, useDuet } from "@/lib/client/store";
import type { Artifact, ArtifactType, Build } from "@/lib/shared/types";
import { cn } from "@/lib/utils";
import { getSpeech } from "../Composer";
import { Mascot } from "../Mascot";
import { useBusy } from "../hooks";
import { Illustration } from "./Illustration";
import { Thumb } from "./Thumb";
import { ArtifactTypeIcon, TYPE_META } from "./types";

export function DescribeSheet({ type }: { type: ArtifactType }) {
  const t = useT();
  const set = useDuet((s) => s.set);
  const [text, setText] = useState("");
  const meta = TYPE_META[type];
  const [, guard] = useBusy();
  const go = () =>
    guard(async () => {
      if (!text.trim()) return;
      const b = await api.post<Build>("builds", { type, prompt: text.trim() });
      set({ describeType: null, buildId: b.id });
    });
  const dictate = () => {
    const Rec = getSpeech();
    if (!Rec) return toast(t("Dictation isn't supported in this browser."));
    const r = new Rec();
    r.lang = navigator.language;
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => setText(Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join(""));
    r.onend = () => {};
    r.onerror = () => {};
    r.start();
  };
  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 340, damping: 38 }} className="absolute inset-0 z-50 flex flex-col bg-paper">
      <div className="relative flex items-center justify-center px-4 pt-[max(env(safe-area-inset-top),16px)]">
        <Mascot size={44} />
        <button type="button" aria-label={t("Close")} onClick={() => set({ describeType: null })} className="chrome-shadow absolute right-4 top-[max(env(safe-area-inset-top),16px)] grid size-10 place-items-center rounded-full bg-chrome">
          <X size={18} />
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2" style={{ color: meta.color }}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}>
          <Illustration type={type} size={220} />
        </motion.div>
        <p className="font-serif text-[20px] font-semibold text-ink">{t(meta.article)}</p>
      </div>
      <div className="mx-auto w-full max-w-[680px] px-3 pb-[max(env(safe-area-inset-bottom),20px)]">
        <div className="chrome-shadow flex items-end gap-2 rounded-[26px] bg-chrome p-1.5 pl-2.5">
          <span className="mb-1.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium" style={{ background: `${meta.color}1F`, color: meta.color }}>
            <ArtifactTypeIcon type={type} size={14} /> {t(meta.label)}
          </span>
          <textarea
            autoFocus
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void go();
              }
            }}
            placeholder={t("Describe what to build")}
            className="max-h-32 min-h-10 flex-1 resize-none bg-transparent py-2 text-[17px] outline-none placeholder:text-ink-3"
          />
          <button type="button" aria-label={t("Dictate")} onClick={dictate} className="grid size-10 shrink-0 place-items-center text-ink-2">
            <Mic size={20} />
          </button>
          <button type="button" aria-label={t("Build it")} onClick={go} className={cn("grid size-10 shrink-0 place-items-center rounded-full transition-colors", text.trim() ? "bg-[#D65A45] text-white" : "bg-black/10 text-ink-3 dark:bg-white/10")}>
            <ArrowUp size={19} strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function Skeleton({ type }: { type: ArtifactType }) {
  const blk = "skeleton rounded-xl bg-black/[0.07] dark:bg-white/10";
  if (type === "slides")
    return (
      <div className="flex h-full flex-col justify-center gap-4 p-8">
        <div className={cn(blk, "h-10 w-3/4")} />
        <div className={cn(blk, "h-5 w-1/2")} />
        <div className={cn(blk, "mt-6 h-24 w-full")} />
      </div>
    );
  if (type === "dashboard")
    return (
      <div className="grid h-full grid-cols-2 gap-3 p-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn(blk, "h-20")} style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
        <div className={cn(blk, "col-span-2 h-full min-h-28")} />
      </div>
    );
  return (
    <div className="flex h-full flex-col gap-3 p-6">
      <div className={cn(blk, "h-8 w-2/3")} />
      {[100, 92, 96, 70, 88, 60].map((w, i) => (
        <div key={i} className={cn(blk, "h-4")} style={{ width: `${w}%`, animationDelay: `${i * 0.1}s` }} />
      ))}
      <div className={cn(blk, "mt-2 h-28 w-full")} />
    </div>
  );
}

export function BuildView({ build }: { build: Build }) {
  const t = useT();
  const set = useDuet((s) => s.set);
  const art = useDuet((s) => s.data?.artifacts.find((a) => a.id === build.artifactId));
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - Date.parse(build.startedAt)) / 1000)), 500);
    return () => clearInterval(timer);
  }, [build.startedAt]);
  const mm = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="absolute inset-0 z-[45] flex flex-col bg-paper">
      <div className="relative flex justify-center pt-[max(env(safe-area-inset-top),14px)]">
        <div className="chrome-shadow grid size-16 place-items-center rounded-full bg-chrome">
          <Mascot mood={build.done ? "idle" : build.status.includes("Waking") ? "working" : "writing"} size={52} />
        </div>
        <button type="button" aria-label={t("Close")} onClick={() => set({ buildId: null, tab: "make" })} className="chrome-shadow absolute right-4 top-[max(env(safe-area-inset-top),16px)] grid size-10 place-items-center rounded-full bg-chrome">
          <X size={18} />
        </button>
      </div>
      <div className="mx-auto flex w-full max-w-[680px] flex-1 flex-col px-5 pb-[190px] pt-5">
        <p className="line-clamp-2 text-[19px] font-semibold leading-snug">{t("Make {title}", { title: build.title.charAt(0).toLowerCase() + build.title.slice(1) })}</p>
        <div className="mt-1 flex items-center justify-between text-[14px] text-ink-2">
          <AnimatePresence mode="wait">
            <motion.span key={build.status} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className={cn(!build.done && "shimmer")}>
              {t(build.status)}
            </motion.span>
          </AnimatePresence>
          <span className="tabular-nums">{mm}</span>
        </div>
        <div className="relative mt-5 flex-1">
          {build.done && art ? (
            <motion.button type="button" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} onClick={() => set({ buildId: null, viewerId: art.id })} className="block h-full w-full overflow-hidden rounded-[26px] border border-[#D65A45] text-left">
              <Thumb id={art.id} updatedAt={art.updatedAt} className="h-full w-full" scale={0.5} />
            </motion.button>
          ) : (
            <>
              <div className="absolute inset-0 overflow-hidden rounded-[26px] bg-chrome">
                <Skeleton type={build.type} />
              </div>
              <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
                <rect x="1" y="1" width="calc(100% - 2px)" height="calc(100% - 2px)" rx="25" fill="none" stroke="var(--duet-hair)" strokeWidth="1.5" />
                <motion.rect
                  x="1"
                  y="1"
                  width="calc(100% - 2px)"
                  height="calc(100% - 2px)"
                  rx="25"
                  fill="none"
                  stroke="#D65A45"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDasharray="0.22 0.78"
                  animate={{ strokeDashoffset: [0, -1] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
                />
              </svg>
            </>
          )}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-[104px] mx-auto w-full max-w-[680px] px-3">
        {build.done ? (
          <button type="button" onClick={() => art && set({ buildId: null, viewerId: art.id })} className="h-[52px] w-full rounded-full bg-solid text-[16px] font-medium text-solid-fg">
            {t("Open")}
          </button>
        ) : (
          <div className="chrome-shadow flex h-[52px] items-center justify-center gap-2 rounded-full bg-chrome text-[15px] text-ink-2">
            <Loader2 size={17} className="animate-spin" /> {t("Cloud Duet is working on it...")}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function DashboardToolbar({ a, onRefresh, onComment }: { a: Artifact; onRefresh: () => void; onComment: () => void }) {
  const t = useT();
  const [phase, setPhase] = useState<"loading" | "refreshing" | "done">("loading");
  const [sources, setSources] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("refreshing"), 900);
    const t2 = setTimeout(() => setPhase("done"), 2000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [a.updatedAt]);
  return (
    <div className="relative mx-auto flex w-full max-w-[680px] items-center gap-2 px-4 py-2 text-[13px] text-ink-2">
      {phase === "done" ? <span>{t("Updated now")}</span> : <span className="flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" />{phase === "loading" ? t("Loading {n} sources", { n: a.sources.length }) : t("Refreshing...")}</span>}
      <span className="flex-1" />
      <button type="button" aria-label={t("Refresh")} onClick={onRefresh} className="grid size-8 place-items-center rounded-full hover:bg-black/5">
        <RotateCw size={16} />
      </button>
      <button type="button" aria-label={t("Comment")} onClick={onComment} className="grid size-8 place-items-center rounded-full hover:bg-black/5">
        <MousePointer2 size={16} />
      </button>
      <button type="button" aria-label={t("Sources")} onClick={() => setSources((s) => !s)} className="grid size-8 place-items-center rounded-full hover:bg-black/5">
        <Database size={16} />
      </button>
      <AnimatePresence>
        {sources && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute right-4 top-11 z-10 w-56 rounded-2xl bg-chrome p-3 shadow-xl ring-1 ring-black/5">
            <p className="text-[13px] font-semibold text-ink">{t("Sources")}</p>
            {a.sources.map((s) => (
              <p key={s} className="mt-1 text-[13px]">
                {s}
              </p>
            ))}
            {a.refresh && <p className="mt-2 text-[12px] text-ink-3">{a.refresh}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ArtifactViewer({ a, embedded = false }: { a: Artifact; embedded?: boolean }) {
  const t = useT();
  const set = useDuet((s) => s.set);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [, sendEdit] = useBusy();
  const [edit, setEdit] = useState("");
  const [v, setV] = useState(0);

  const body = (
    <>
      {a.type === "dashboard" && (
        <DashboardToolbar
          a={a}
          onRefresh={async () => {
            await api.post(`artifacts/${a.id}/refresh`);
            setV((x) => x + 1);
          }}
          onComment={() => {
            if (embedded) set({ viewerId: a.id });
            else setEditing(true);
          }}
        />
      )}
      <div className="relative mx-auto w-full max-w-[980px] flex-1 overflow-hidden px-2 pb-2">
        <iframe key={`${a.updatedAt}-${v}`} title={a.title} src={`/api/artifacts/${a.id}/html?v=${encodeURIComponent(a.updatedAt)}${v}`} sandbox="allow-scripts allow-forms" className="h-full w-full rounded-[20px] border border-hair bg-white" />
      </div>
    </>
  );

  if (embedded) return <div className="flex h-full flex-col pb-[100px] pt-[110px]">{body}</div>;

  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 340, damping: 38 }} className="absolute inset-0 z-[55] flex flex-col bg-paper">
      <div className="mx-auto flex w-full max-w-[980px] items-center gap-3 px-4 pb-2 pt-[max(env(safe-area-inset-top),14px)]">
        <button type="button" aria-label={t("Close")} onClick={() => set({ viewerId: null })} className="chrome-shadow grid size-10 shrink-0 place-items-center rounded-full bg-chrome">
          <X size={18} />
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold">{a.title}</p>
        <div className="chrome-shadow relative flex shrink-0 items-center rounded-full bg-chrome">
          <button type="button" aria-label={t("Edit")} onClick={() => setEditing(true)} className="grid size-10 place-items-center">
            <Pencil size={16} />
          </button>
          <button type="button" aria-label={t("More")} onClick={() => setMenu((m) => !m)} className="grid size-10 place-items-center">
            <Ellipsis size={18} />
          </button>
          <AnimatePresence>
            {menu && (
              <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute right-0 top-12 z-10 w-52 origin-top-right overflow-hidden rounded-2xl bg-chrome py-1 shadow-xl ring-1 ring-black/5">
                {[
                  {
                    icon: Share,
                    label: t("Share"),
                    run: async () => {
                      try {
                        const { url } = await api.post<{ url: string }>(`artifacts/${a.id}/share`);
                        if (navigator.share) await navigator.share({ title: a.title, url }).catch(() => navigator.clipboard?.writeText(url));
                        else await navigator.clipboard?.writeText(url);
                        toast(t("Link copied. Anyone with it can view this."));
                      } catch (e) {
                        toast((e as Error).message);
                      }
                    },
                  },
                  { icon: MessageSquare, label: t("Comment"), run: () => setEditing(true) },
                  {
                    icon: LayoutPanelTop,
                    label: a.inTabBar ? t("Remove from tab bar") : t("Add to tab bar"),
                    run: async () => {
                      for (const other of useDuet.getState().data!.artifacts.filter((x) => x.inTabBar && x.id !== a.id)) await api.patch(`artifacts/${other.id}`, { inTabBar: false });
                      await api.patch(`artifacts/${a.id}`, { inTabBar: !a.inTabBar });
                      if (!a.inTabBar) set({ viewerId: null, tab: "pinned", buildId: null, taskId: null });
                    },
                  },
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
      {body}
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-[680px] px-3 pb-[max(env(safe-area-inset-bottom),16px)]">
            <div className="chrome-shadow flex items-center gap-2 rounded-[26px] bg-chrome p-1.5 pl-4">
              <input
                autoFocus
                value={edit}
                onChange={(e) => setEdit(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEditing(false);
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && edit.trim()) {
                    void sendEdit(async () => {
                      await api.post(`artifacts/${a.id}/edit`, { text: edit.trim() });
                      toast(t("Sent to Cloud Duet. It'll update this and let you know."));
                      setEdit("");
                      setEditing(false);
                    });
                  }
                }}
                placeholder={t("What should change?")}
                className="h-10 flex-1 bg-transparent text-[16px] outline-none"
              />
              <button type="button" aria-label={t("Close")} onClick={() => setEditing(false)} className="grid size-10 place-items-center text-ink-2">
                <X size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
