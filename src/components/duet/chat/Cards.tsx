"use client";

import { animate, AnimatePresence, motion, useInView, useMotionValue, useTransform } from "motion/react";
import {
  CalendarCheck, Check, ChevronRight, CircleDollarSign, Clock, FileText, Globe, Lightbulb, Lock, Mail, Monitor, Pin, Play, ShieldCheck, Presentation, ChartColumn, Users, Wand2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { t as tt, useLang, useT } from "@/lib/client/i18n";
import { api, useDuet } from "@/lib/client/store";
import { locale } from "@/lib/i18n";
import type { Card, Message, SuggestionItem } from "@/lib/shared/types";
import { cn } from "@/lib/utils";
import { timeAgo } from "../bits";
import { useNow } from "../hooks";
import { ArtifactTypeIcon } from "../make/types";
import { Thumb } from "../make/Thumb";
import { ApprovalCard } from "./ApprovalCard";

const SUG_ICONS: Record<SuggestionItem["icon"], typeof Mail> = {
  mail: Mail, calendar: CalendarCheck, doc: FileText, chart: ChartColumn, dollar: CircleDollarSign, people: Users, globe: Globe, slides: Presentation,
};

function SuggestionsCard({ m, items }: { m: Message; items: SuggestionItem[] }) {
  const set = useDuet((s) => s.set);
  return (
    <div className="w-full max-w-[400px] space-y-2">
      {items.map((it, i) => {
        const Icon = SUG_ICONS[it.icon] ?? FileText;
        return (
          <motion.button
            key={it.title}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: it.started ? 0.55 : 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            onClick={async () => {
              if (it.started) {
                if (it.taskId) set({ taskId: it.taskId });
                return;
              }
              window.dispatchEvent(new CustomEvent("duet:sent"));
              await api.post("cards/suggestion", { messageId: m.id, index: i }).catch((e) => toast((e as Error).message));
            }}
            className="flex w-full items-start gap-3 rounded-[18px] border border-hair bg-chrome p-3 text-left transition active:scale-[0.99]"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-black/[0.05] text-ink dark:bg-white/10">
              <Icon size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold leading-snug">{it.title}</span>
              <span className="mt-0.5 line-clamp-2 block text-[14px] leading-snug text-ink-2">“{it.prompt}”</span>
            </span>
            {it.started && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-1 grid size-6 place-items-center rounded-full bg-ready text-white">
                <Check size={14} strokeWidth={3} />
              </motion.span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

function ProactiveCard({ suggestionId }: { suggestionId: string }) {
  const sug = useDuet((s) => s.data?.suggestions.find((x) => x.id === suggestionId));
  const t = useT();
  const set = useDuet((s) => s.set);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [0, 300], [0, 9]);
  const reveal = useTransform(x, [0, 120], [0, 1]);
  const [flying, setFlying] = useState(false);
  if (!sug || sug.state === "hidden") return null;

  const start = async () => {
    if (flying) return;
    setFlying(true);
    await animate(x, 640, { duration: 0.32, ease: [0.4, 0, 0.6, 1] });
    window.dispatchEvent(new CustomEvent("duet:sent"));
    try {
      await api.post(`suggestions/${sug.id}`, { action: "start" });
    } catch (e) {
      toast((e as Error).message);
      setFlying(false);
      void animate(x, 0, { type: "spring", stiffness: 400, damping: 32 });
    }
  };

  if (sug.state === "started") {
    return (
      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex w-full max-w-[400px] items-center gap-2.5 rounded-full py-1 text-[15px]">
        <span className="size-4 shrink-0 rounded-full border-2 border-ink-3" />
        <span className="min-w-0 flex-1 truncate">{sug.title}</span>
        <button type="button" onClick={() => set({ tab: "tasks" })} className="flex shrink-0 items-center text-[14px] text-ink-2">
          {t("See all tasks")} <ChevronRight size={16} />
        </button>
      </motion.div>
    );
  }

  return (
    <div className="relative w-full max-w-[400px]">
      <motion.div style={{ opacity: reveal }} className="absolute inset-0 flex items-center gap-3 rounded-[22px] bg-[#2E9A4E] px-5 text-white">
        <span className="grid size-10 place-items-center rounded-full bg-white/20">
          <Play size={18} fill="currentColor" />
        </span>
        <span className="text-[17px] font-semibold">{t("Start")}</span>
      </motion.div>
      <motion.div
        drag={flying ? false : "x"}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.9 }}
        style={{ x, rotate, transformOrigin: "20% 100%" }}
        onDragEnd={(_, info) => {
          if (info.offset.x > 110 || info.velocity.x > 700) void start();
        }}
        className="relative cursor-grab touch-pan-y space-y-2 rounded-[22px] border border-hair bg-chrome p-4 active:cursor-grabbing"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#FFF3D6] text-[#B07A00] dark:bg-[#3A2E10] dark:text-[#F2C14E]">
            <Lightbulb size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-[16px] font-semibold leading-snug">{sug.title}</p>
            <p className="mt-1 text-[15px] leading-snug text-ink-2">{sug.body}</p>
          </div>
        </div>
        <div className="flex gap-2.5 pt-1">
          <button type="button" onClick={() => api.post(`suggestions/${sug.id}`, { action: "hide" })} className="h-10 flex-1 rounded-full border border-hair text-[15px] font-medium">
            {t("Hide")}
          </button>
          <button type="button" onClick={start} className="h-10 flex-1 rounded-full bg-solid text-[15px] font-medium text-solid-fg">
            {t("Start")}
          </button>
        </div>
        <p className="text-center text-[11px] text-ink-3">{t("Swipe right to start")}</p>
      </motion.div>
    </div>
  );
}

function Ticker({ value, prefix = "", suffix = "", run }: { value: number; prefix?: string; suffix?: string; run: boolean }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    const c = animate(0, value, { duration: 1.2, ease: [0.2, 0.8, 0.2, 1], onUpdate: (n) => setV(n) });
    return () => c.stop();
  }, [run, value]);
  return (
    <span className="tabular-nums">
      {prefix}
      {Math.round(v).toLocaleString()}
      {suffix}
    </span>
  );
}

export function ArtifactCard({ artifactId }: { artifactId: string }) {
  const a = useDuet((s) => s.data?.artifacts.find((x) => x.id === artifactId));
  const set = useDuet((s) => s.set);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, amount: 0.4 });
  const t = useT();
  const now = useNow(30_000);
  if (!a) return null;
  return (
    <div ref={ref} className="w-full max-w-[400px] overflow-hidden rounded-[22px] border border-hair bg-chrome">
      <button type="button" onClick={() => set({ viewerId: a.id })} className="block w-full text-left">
        {a.metrics?.length ? (
          <div className="grid grid-cols-2 gap-px bg-hair">
            {a.metrics.slice(0, 4).map((mt) => (
              <div key={mt.label} className="bg-chrome px-3.5 py-3">
                <p className="text-[12px] text-ink-2">{mt.label}</p>
                <p className="mt-0.5 text-[22px] font-semibold tracking-tight">
                  <Ticker value={mt.value} prefix={mt.prefix} suffix={mt.suffix} run={inView} />
                </p>
              </div>
            ))}
          </div>
        ) : (
          <Thumb id={a.id} updatedAt={a.updatedAt} className="h-44 w-full border-b border-hair" scale={0.38} />
        )}
      </button>
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        <span className="text-ink-2">
          <ArtifactTypeIcon type={a.type} size={17} />
        </span>
        <button type="button" onClick={() => set({ viewerId: a.id })} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-[15px] font-semibold">{a.title}</span>
          <span className="block text-[12px] text-ink-2">{now - Date.parse(a.updatedAt) < 90_000 ? t("Updated now") : t("Updated {time}", { time: timeAgo(a.updatedAt).toLowerCase() })}</span>
        </button>
        <button
          type="button"
          aria-label={a.pinned ? t("Unpin") : t("Pin")}
          onClick={() => api.patch(`artifacts/${a.id}`, { pinned: !a.pinned })}
          className={cn("grid size-8 place-items-center rounded-full", a.pinned ? "text-orange" : "text-ink-3")}
        >
          <Pin size={16} fill={a.pinned ? "currentColor" : "none"} />
        </button>
        <ChevronRight size={18} className="text-ink-3" />
      </div>
    </div>
  );
}

function PlateCard({ m, items }: { m: Message; items: Extract<Card, { kind: "plate" }>["items"] }) {
  const t = useT();
  return (
    <div className="w-full max-w-[400px] overflow-hidden rounded-[22px] border border-hair bg-chrome">
      <p className="px-4 pb-1 pt-3.5 font-serif text-[18px] font-semibold">{t("Your plate today")}</p>
      <div className="divide-y divide-hair">
        {items.map((it, i) => (
          <div key={it.title} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium">{it.title}</p>
              <p className="truncate text-[13px] text-ink-2">{it.detail}</p>
            </div>
            <button
              type="button"
              disabled={it.done}
              onClick={() => {
                window.dispatchEvent(new CustomEvent("duet:sent"));
                void api.post("cards/plate", { messageId: m.id, index: i });
              }}
              className={cn("shrink-0 rounded-full border border-hair px-3.5 py-1.5 text-[14px] font-medium transition active:scale-95", it.done && "border-transparent text-ink-3")}
            >
              {it.done ? <Check size={16} className="text-ready" /> : it.action}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkillCard({ m, c }: { m: Message; c: Extract<Card, { kind: "skill" }> }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="w-full max-w-[400px] space-y-2.5 rounded-[22px] border border-hair bg-chrome p-4">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-black/5 dark:bg-white/10">
          <Wand2 size={15} />
        </span>
        <span className="font-mono text-[15px] font-semibold">{c.name}</span>
      </div>
      <p className="text-[15px] text-ink-2">{c.description}</p>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center text-[14px] text-link">
        {t("View skill")} <ChevronRight size={15} className={cn("transition", open && "rotate-90")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden rounded-xl bg-black/[0.04] p-3 text-[14px] dark:bg-white/5">
            {c.instructions}
          </motion.p>
        )}
      </AnimatePresence>
      {c.state === "pending" ? (
        <div className="flex gap-2.5">
          <button type="button" onClick={() => api.post("cards/skill", { messageId: m.id, save: false })} className="h-10 flex-1 rounded-full border border-hair text-[15px] font-medium">
            {t("Not now")}
          </button>
          <button type="button" onClick={() => api.post("cards/skill", { messageId: m.id, save: true })} className="h-10 flex-1 rounded-full bg-solid text-[15px] font-medium text-solid-fg">
            {t("Save skill")}
          </button>
        </div>
      ) : (
        <p className="text-[14px] text-ink-2">{c.state === "saved" ? t("Saved. Type / to use it.") : t("Not saved")}</p>
      )}
    </div>
  );
}

function SignInCard({ m, c }: { m: Message; c: Extract<Card, { kind: "signin" }> }) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const favicon = (
    <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#101828] text-[15px] font-bold text-[#F59E0B]">{c.site.slice(0, 1)}</span>
  );
  if (c.state !== "pending") {
    return (
      <div className="flex w-full max-w-[400px] items-center gap-3 rounded-[22px] border border-hair bg-chrome p-4">
        {favicon}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{c.state === "sent" ? t("Signed in to {domain}", { domain: c.domain }) : t("Sign in to {site}", { site: c.site })}</p>
          <p className="truncate text-[13px] text-ink-2">{c.state === "sent" ? t("{email} · password sent to Cloud Duet's browser, not saved", { email: c.email ?? "" }) : t("Dismissed")}</p>
        </div>
        {c.state === "sent" && (
          <span className="grid size-7 place-items-center rounded-full bg-ready/12 text-ready">
            <Check size={15} strokeWidth={2.6} />
          </span>
        )}
      </div>
    );
  }
  const submit = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    try {
      await api.post("cards/signin", { messageId: m.id, email, password });
      window.dispatchEvent(new CustomEvent("duet:sent"));
    } catch (e) {
      toast(e instanceof Error ? e.message : tt("Couldn't send that"));
    } finally {
      setPassword("");
      setBusy(false);
    }
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="w-full max-w-[400px] space-y-3 rounded-[22px] border border-hair bg-chrome p-4"
    >
      <div className="flex items-center gap-3">
        {favicon}
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold">{t("Sign in to {site}", { site: c.site })}</p>
          <p className="truncate text-[13px] text-ink-2">{c.domain}</p>
        </div>
      </div>
      <input
        type="email"
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("Email")}
        className="h-11 w-full rounded-xl bg-black/[0.05] px-3.5 text-[16px] outline-none focus:ring-2 focus:ring-[#C7604A]/40 dark:bg-white/10"
      />
      <input
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={t("Password")}
        className="h-11 w-full rounded-xl bg-black/[0.05] px-3.5 text-[16px] outline-none focus:ring-2 focus:ring-[#C7604A]/40 dark:bg-white/10"
      />
      <button type="submit" disabled={busy || !email.trim() || !password} className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-solid text-[15px] font-semibold text-solid-fg transition-opacity disabled:opacity-35">
        {busy ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Lock size={15} />}
        {t("Send to Cloud Duet's browser")}
      </button>
      <p className="flex items-start gap-1.5 text-[12px] leading-snug text-ink-3">
        <ShieldCheck size={14} className="mt-px shrink-0" />
        {t("Your password is typed straight into Cloud Duet's browser. Cloud Duet never sees it and it isn't saved.")}
      </p>
      <button type="button" onClick={() => api.post("cards/signin", { messageId: m.id, dismiss: true })} className="w-full text-center text-[13px] font-medium text-ink-2">
        {t("Not now")}
      </button>
    </form>
  );
}

function ScreenshotCard({ c }: { c: Extract<Card, { kind: "screenshot" }> }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block w-full max-w-[360px] overflow-hidden rounded-[18px] border border-hair bg-chrome text-left transition-transform active:scale-[0.99]">
        <div className="flex items-center gap-1.5 border-b border-hair bg-black/[0.03] px-3 py-1.5 dark:bg-white/5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-[7px] rounded-full bg-black/15 dark:bg-white/20" />
          ))}
          <span className="ml-1.5 flex min-w-0 items-center gap-1 truncate text-[11px] text-ink-2">
            <Lock size={10} className="shrink-0" />
            {c.url.replace(/^https:\/\//, "")}
          </span>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.image} alt={c.caption} className="block aspect-[800/520] w-full bg-white" />
        <p className="flex items-center gap-1.5 px-3 py-2 text-[12px] text-ink-2">
          <Monitor size={12} /> {t("Cloud Duet's own computer")} · {c.caption}
        </p>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[90] grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
          >
            <motion.div initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-[900px] overflow-hidden rounded-2xl bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.image} alt={c.caption} className="block w-full" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const APP_URLS: Record<string, string> = {
  gmail: "https://mail.google.com/",
  gcal: "https://calendar.google.com/",
  gdrive: "https://drive.google.com/",
  slack: "https://app.slack.com/client",
  stripe: "https://dashboard.stripe.com/",
  quickbooks: "https://qbo.intuit.com/",
  gusto: "https://app.gusto.com/",
  docusign: "https://app.docusign.com/",
  hubspot: "https://app.hubspot.com/",
  github: "https://github.com/",
  linkedin: "https://www.linkedin.com/",
};

export function CardView({ m }: { m: Message }) {
  const t = useT();
  const lang = useLang();
  const set = useDuet((s) => s.set);
  const data = useDuet((s) => s.data);
  const c = m.card!;
  switch (c.kind) {
    case "approval":
      return <ApprovalCard approvalId={c.approvalId} />;
    case "suggestions":
      return <SuggestionsCard m={m} items={c.items} />;
    case "proactive":
      return <ProactiveCard suggestionId={c.suggestionId} />;
    case "artifact":
      return <ArtifactCard artifactId={c.artifactId} />;
    case "plate":
      return <PlateCard m={m} items={c.items} />;
    case "skill":
      return <SkillCard m={m} c={c} />;
    case "signin":
      return <SignInCard m={m} c={c} />;
    case "screenshot":
      return <ScreenshotCard c={c} />;
    case "confirmation":
      return (
        <div className="flex w-full max-w-[400px] items-start gap-3 rounded-[22px] border border-hair bg-chrome p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#E3F3DF] text-ready dark:bg-[#17301A]">
            {c.icon === "calendar" ? <CalendarCheck size={18} /> : <Check size={18} />}
          </span>
          <div>
            <p className="text-[16px] font-semibold">{c.title}</p>
            {c.lines.map((l) => (
              <p key={l} className="text-[14px] text-ink-2">
                {l}
              </p>
            ))}
          </div>
        </div>
      );
    case "alert":
      return (
        <div className="w-full max-w-[400px] space-y-3 rounded-[22px] border border-hair bg-chrome p-4">
          <p className="text-[16px] font-semibold">{c.title}</p>
          <p className="text-[15px] leading-snug text-ink-2">{c.body}</p>
          <button
            type="button"
            onClick={() => {
              const app = c.action.replace(/^(Open|Connect)\s+/, "").trim().toLowerCase();
              const connector = data?.connectors.find((x) => x.name.toLowerCase() === app || x.id === app);
              if (c.action.startsWith("Connect")) return set({ sheet: connector ? { connector: connector.id } : "claude" });
              const href = c.href && /^https:\/\//i.test(c.href) ? c.href : APP_URLS[connector?.id ?? app];
              if (href) window.open(href, "_blank", "noopener,noreferrer");
              else set({ sheet: connector ? { connector: connector.id } : "claude" });
            }}
            className="h-11 w-full rounded-full bg-solid text-[16px] font-medium text-solid-fg active:scale-[0.99]"
          >
            {c.action}
          </button>
        </div>
      );
    case "usage_limit":
      return (
        <div className="flex w-full flex-col items-center gap-2 py-1 text-center">
          <p className="flex items-center gap-1.5 text-[13px] text-ink-2">
            <Clock size={14} />
            {c.lifted
              ? t("Usage limit lifted")
              : t("Usage limit reached · resumes {when}", { when: new Date(c.resumesAt).toLocaleString(locale(lang), { weekday: "long", hour: "numeric", minute: "2-digit" }) })}
          </p>
          {!c.lifted && (
            <button type="button" onClick={() => set({ sheet: "usage" })} className="rounded-full border border-hair px-3.5 py-1.5 text-[14px] font-medium">
              {t("Get more usage")}
            </button>
          )}
        </div>
      );
  }
}
