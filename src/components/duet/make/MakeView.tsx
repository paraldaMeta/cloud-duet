"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, ChevronRight, Lightbulb, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/client/i18n";
import { api, useDuet } from "@/lib/client/store";
import type { Artifact, ArtifactType } from "@/lib/shared/types";
import { cn } from "@/lib/utils";
import { timeAgo } from "../bits";
import { useBusy, useNow } from "../hooks";
import { Illustration } from "./Illustration";
import { Thumb } from "./Thumb";
import { ArtifactTypeIcon, TYPE_META } from "./types";

const HERO: { type: ArtifactType; ideas: string[] }[] = [
  { type: "webpage", ideas: ["A booking page for my bike shop", "A waitlist page for the newsletter"] },
  { type: "docs", ideas: ["A one-page brief", "A launch checklist for Mercury Labs"] },
  { type: "slides", ideas: ["A pitch deck for the bakery", "A Q4 update for investors"] },
];

function useTypewriter() {
  const t = useT();
  const [i, setI] = useState(0);
  const [n, setN] = useState(0);
  const [phase, setPhase] = useState<"type" | "hold" | "erase">("type");
  const flat = HERO.flatMap((h) => h.ideas.map((idea) => ({ type: h.type, idea: t(idea) })));
  const cur = flat[i % flat.length];
  useEffect(() => {
    const timer = setTimeout(
      () => {
        if (phase === "type") {
          if (n < cur.idea.length) setN(n + 1);
          else setPhase("hold");
        } else if (phase === "hold") setPhase("erase");
        else if (n > 0) setN(n - 1);
        else {
          setPhase("type");
          setI(i + 1);
        }
      },
      phase === "type" ? 45 : phase === "hold" ? 1600 : 18,
    );
    return () => clearTimeout(timer);
  }, [n, phase, i, cur.idea.length]);
  return { type: cur.type, text: cur.idea.slice(0, n), full: cur.idea };
}

function TypeChip({ type }: { type: ArtifactType }) {
  const t = useT();
  const m = TYPE_META[type];
  return (
    <motion.span layout key={type} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium" style={{ background: `${m.color}1F`, color: m.color }}>
      <ArtifactTypeIcon type={type} size={14} /> {t(m.label)}
    </motion.span>
  );
}

function Hero({ onDismiss }: { onDismiss: () => void }) {
  const t = useT();
  const tw = useTypewriter();
  const [text, setText] = useState("");
  const set = useDuet((s) => s.set);
  const [locked, setLocked] = useState<ArtifactType | null>(null);
  const type = locked ?? tw.type;
  const order: ArtifactType[] = ["webpage", "docs", "slides", "dashboard"];
  const color = TYPE_META[type].color;
  const [, guard] = useBusy();
  const go = () =>
    guard(async () => {
      const prompt = text.trim() || tw.full;
      const b = await api.post<{ id: string }>("builds", { type, prompt });
      set({ buildId: b.id });
    });
  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} className="relative overflow-hidden rounded-[26px] p-4" style={{ background: `${color}14` }}>
      <button type="button" aria-label={t("Dismiss")} onClick={onDismiss} className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-black/5 text-ink-2">
        <X size={16} />
      </button>
      <AnimatePresence mode="wait">
        <motion.div key={type} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="flex justify-center py-3" style={{ color }}>
          <Illustration type={type} size={170} />
        </motion.div>
      </AnimatePresence>
      <div className="flex items-center gap-2 rounded-[22px] bg-chrome p-1.5 pl-2 shadow-sm">
        <button type="button" aria-label={t("Change type")} onClick={() => setLocked(order[(order.indexOf(type) + 1) % order.length])}>
          <TypeChip type={type} />
        </button>
        <input
          value={text}
          onChange={(e) => {
            if (!locked) setLocked(tw.type);
            setText(e.target.value);
          }}
          onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && go()}
          placeholder={tw.text}
          className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-3"
        />
        <button type="button" aria-label={t("Make it")} onClick={go} className="grid size-9 shrink-0 place-items-center rounded-full text-white transition" style={{ background: text ? "#D65A45" : "var(--duet-solid)", color: text ? "#fff" : "var(--duet-solid-fg)" }}>
          <ArrowUp size={18} strokeWidth={2.4} />
        </button>
      </div>
    </motion.div>
  );
}

function Tile({ a, wide = false }: { a: Artifact; wide?: boolean }) {
  const t = useT();
  const set = useDuet((s) => s.set);
  const now = useNow(20_000);
  const fresh = now - Date.parse(a.createdAt) < 5 * 60_000;
  return (
    <motion.button
      layout
      type="button"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={() => set({ viewerId: a.id })}
      className={cn("overflow-hidden rounded-[20px] border bg-chrome text-left transition active:scale-[0.98]", fresh ? "border-[#D65A45] ring-1 ring-[#D65A45]" : "border-hair", wide ? "w-[200px] shrink-0" : "w-full")}
    >
      <div className="relative">
        <Thumb id={a.id} updatedAt={a.updatedAt} className="h-32 w-full" scale={0.3} />
        {fresh && <span className="absolute left-2 top-2 rounded-full bg-[#D65A45] px-2 py-0.5 text-[11px] font-semibold text-white">{t("Just made")}</span>}
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-[14px] font-semibold leading-snug">{a.title}</p>
        <p className="mt-1 flex items-center gap-1 text-[12px] text-ink-2">
          <ArtifactTypeIcon type={a.type} size={13} /> {fresh && now - Date.parse(a.createdAt) < 60_000 ? t("this minute") : timeAgo(a.updatedAt)}
        </p>
      </div>
    </motion.button>
  );
}

const FAB_ITEMS: { type: ArtifactType; color: string }[] = [
  { type: "designsystem", color: "#8A63D2" },
  { type: "design", color: "#8A63D2" },
  { type: "dashboard", color: "#8A63D2" },
  { type: "slides", color: "#E2853A" },
  { type: "docs", color: "#3F7BD8" },
  { type: "webpage", color: "#D0533E" },
];

const TEMPLATES = [
  { title: "Daily todo", body: "Today's list, refreshed every morning", type: "docs" as const, prompt: "A daily todo list refreshed every morning from my email and calendar" },
  { title: "Email triage", body: "What needs a reply, sorted by urgency", type: "dashboard" as const, prompt: "An email triage dashboard of what needs a reply, sorted by urgency" },
  { title: "Calendar prep", body: "What's coming up and what to prepare", type: "docs" as const, prompt: "A calendar prep doc of what's coming up this week and what to prepare" },
];

export function MakeView() {
  const t = useT();
  const data = useDuet((s) => s.data)!;
  const set = useDuet((s) => s.set);
  const [hero, setHero] = useState(true);
  const [fab, setFab] = useState(false);
  const arts = useMemo(() => [...data.artifacts].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)), [data.artifacts]);
  const today = arts.filter((a) => new Date(a.updatedAt).toDateString() === new Date().toDateString());
  const earlier = arts.filter((a) => !today.includes(a));
  const designs = arts.filter((a) => a.type === "design" || a.type === "designsystem");
  const pages = arts.filter((a) => a.type === "webpage");
  const building = data.builds.filter((b) => !b.done);

  const start = async (type: ArtifactType, prompt: string) => {
    const b = await api.post<{ id: string }>("builds", { type, prompt });
    set({ buildId: b.id });
  };

  return (
    <div className="relative h-full">
      <div className="no-scrollbar h-full overflow-y-auto">
        <div className="mx-auto max-w-[680px] space-y-6 px-4 pb-[200px] pt-[118px]">
          <AnimatePresence>{hero && <Hero onDismiss={() => setHero(false)} />}</AnimatePresence>

          {building.length > 0 && (
            <section className="space-y-2">
              {building.map((b) => (
                <button key={b.id} type="button" onClick={() => set({ buildId: b.id })} className="flex w-full items-center gap-3 rounded-2xl border border-hair bg-chrome p-3 text-left">
                  <span className="size-4 animate-spin rounded-full border-2 border-[#D65A45] border-t-transparent" />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{b.title}</span>
                  <span className="shimmer text-[13px] text-ink-2">{t(b.status)}</span>
                </button>
              ))}
            </section>
          )}

          {arts.length === 0 ? (
            <section>
              <p className="mb-2 text-[17px] font-semibold">{t("Templates")}</p>
              <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
                {TEMPLATES.map((tpl) => (
                  <button key={tpl.title} type="button" onClick={() => start(tpl.type, t(tpl.prompt))} className="w-[180px] shrink-0 rounded-[20px] border border-hair bg-chrome p-3.5 text-left">
                    <span className="flex items-center justify-between">
                      <Lightbulb size={18} className="text-[#B07A00]" />
                      <Plus size={18} className="text-ink-3" />
                    </span>
                    <span className="mt-6 block text-[15px] font-semibold">{t(tpl.title)}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{t(tpl.body)}</span>
                  </button>
                ))}
              </div>
              <p className="pt-16 text-center text-[15px] text-ink-3">{t("Everything Cloud Duet makes shows up here")}</p>
            </section>
          ) : (
            <>
              {today.length > 0 && (
                <section>
                  <p className="mb-2 text-[17px] font-semibold">{t("Changed today")}</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {today.map((a) => (
                      <Tile key={a.id} a={a} />
                    ))}
                  </div>
                </section>
              )}
              {designs.length > 0 && (
                <section>
                  <p className="mb-2 text-[17px] font-semibold">{t("Designs")}</p>
                  <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
                    {designs.map((a) => (
                      <Tile key={a.id} a={a} wide />
                    ))}
                  </div>
                </section>
              )}
              {pages.length > 0 && (
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[17px] font-semibold">{t("Pages")}</p>
                    <span className="flex items-center text-[14px] text-ink-2">
                      {t("See all")} <ChevronRight size={15} />
                    </span>
                  </div>
                  <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
                    {pages.map((a) => (
                      <Tile key={a.id} a={a} wide />
                    ))}
                  </div>
                </section>
              )}
              {earlier.length > 0 && (
                <section>
                  <p className="mb-2 text-[17px] font-semibold">
                    {t("Earlier")} <span className="text-ink-3">{earlier.length}</span>
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {earlier.map((a) => (
                      <Tile key={a.id} a={a} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {fab && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setFab(false)} className="absolute inset-0 z-30 bg-paper/60 backdrop-blur-md" />
        )}
      </AnimatePresence>
      <div className="absolute bottom-[112px] right-[max(9%,calc(50%-200px))] z-40 flex flex-col items-end gap-2.5">
        <AnimatePresence>
          {fab &&
            FAB_ITEMS.map((it, i) => (
              <motion.button
                key={it.type}
                type="button"
                initial={{ opacity: 0, y: 24, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { delay: (FAB_ITEMS.length - 1 - i) * 0.035, type: "spring", stiffness: 500, damping: 30 } }}
                exit={{ opacity: 0, y: 16, scale: 0.85, transition: { delay: i * 0.02 } }}
                onClick={() => {
                  setFab(false);
                  set({ describeType: it.type });
                }}
                className="chrome-shadow flex items-center gap-2 rounded-full bg-chrome py-2.5 pl-3 pr-4 text-[15px] font-medium"
              >
                <span style={{ color: it.color }}>
                  <ArtifactTypeIcon type={it.type} size={18} />
                </span>
                {t(TYPE_META[it.type].label)}
              </motion.button>
            ))}
        </AnimatePresence>
        <motion.button
          type="button"
          aria-label={fab ? t("Close") : t("Make something")}
          whileTap={{ scale: 0.92 }}
          onClick={() => setFab((f) => !f)}
          animate={{ rotate: fab ? 45 : 0 }}
          className="grid size-14 place-items-center rounded-full bg-[#D65A45] text-white shadow-lg shadow-[#D65A45]/30"
        >
          <Plus size={26} />
        </motion.button>
      </div>
    </div>
  );
}
