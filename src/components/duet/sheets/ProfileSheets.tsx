"use client";

import { motion } from "motion/react";
import {
  Bell, Brain, CircleCheck, CircleX, CreditCard, ExternalLink, Gauge, KeyRound, LogOut, MessageSquareHeart, Plug, RotateCcw, Sparkles,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { setLang, useLang, useT } from "@/lib/client/i18n";
import { api, signOut, useDuet, type Sheet } from "@/lib/client/store";
import { disablePush, enablePush } from "@/lib/client/push";
import { LANGS, locale, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Drawer, Group, Row, Segment, Toggle } from "../Drawer";
import { AppLogo } from "../Logos";

const ic = "text-ink-2";

export function ProfileSheet({ open }: { open: boolean }) {
  const { data, set } = useDuet();
  const { theme, setTheme } = useTheme();
  const t = useT();
  const lang = useLang();
  const [feedback, setFeedback] = useState(false);
  const [text, setText] = useState("");
  if (!data) return null;
  const go = (sheet: Sheet) => set({ sheet });
  const engine = data.engine.mode === "demo" ? t("Demo engine") : `${data.engine.mode === "anthropic" ? "Anthropic" : t("OpenAI-compatible")} · ${data.engine.model}`;
  const pct = Math.round((data.usage.weeklyUsed / data.usage.weeklyLimit) * 100);

  return (
    <Drawer open={open} onClose={() => go(null)} full>
      <div className="flex flex-col items-center pt-1 text-center">
        <div className="grid size-20 place-items-center rounded-full bg-[#C7604A] text-[28px] font-semibold text-white">{data.user.initials}</div>
        <h2 className="mt-3 font-serif text-[24px] font-semibold">{data.user.name}</h2>
        <p className="text-[14px] text-ink-2">{data.user.email}</p>
      </div>
      <Group>
        <Row icon={<Gauge size={19} className={ic} />} label={t("Usage")} detail={t("{pct}% of weekly limit used", { pct })} onClick={() => go("usage")} />
        <Row icon={<Plug size={19} className={ic} />} label={t("Connected apps")} detail={t("{n} connected", { n: data.connectors.filter((c) => c.connected).length })} onClick={() => go("claude")} />
        <Row icon={<Brain size={19} className={ic} />} label={t("Memory")} detail={t("What Cloud Duet remembers about you")} onClick={() => go("memory")} />
        <Row icon={<Bell size={19} className={ic} />} label={t("Notifications")} detail={t("Morning brief at {time}", { time: fmt12(data.settings.briefTime, lang) })} onClick={() => go("notifications")} />
        <Row icon={<CreditCard size={19} className={ic} />} label={t("Payments")} detail={data.settings.paymentsTestMode ? t("Link · test mode") : "Link"} onClick={() => go("payments")} />
        <Row icon={<KeyRound size={19} className={ic} />} label={t("Model & API key")} detail={engine} onClick={() => go("model")} />
        <Row icon={<Plug size={19} className={ic} />} label={t("Keys & services")} detail={t("Real apps, browser, sign-in, push")} onClick={() => go("services")} />
      </Group>
      <Group title={t("Appearance")}>
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-[15.5px]">{t("Theme")}</span>
          <Segment
            id="theme"
            value={(theme as "light" | "dark" | "system") ?? "system"}
            onChange={setTheme}
            options={[
              { v: "light", label: t("Light") },
              { v: "dark", label: t("Dark") },
              { v: "system", label: t("Auto") },
            ]}
          />
        </div>
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-[15.5px]">{t("Language")}</span>
          <Segment<Lang> id="lang" value={lang} onChange={setLang} options={LANGS.map((l) => ({ v: l.id, label: l.label }))} />
        </div>
      </Group>
      <Group>
        <Row icon={<MessageSquareHeart size={19} className={ic} />} label={t("Send feedback")} onClick={() => setFeedback((v) => !v)} chevron={false} />
        {feedback && (
          <div className="flex gap-2 p-3">
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("What's working, what isn't?")}
              className="min-w-0 flex-1 rounded-xl bg-black/[0.05] px-3 py-2 text-[15px] outline-none dark:bg-white/10"
            />
            <button
              type="button"
              onClick={async () => {
                await api.post("feedback", { text });
                setText("");
                setFeedback(false);
                toast(t("Thanks, that helps."));
              }}
              className="rounded-xl bg-solid px-3 text-[14px] font-semibold text-solid-fg"
            >
              {t("Send")}
            </button>
          </div>
        )}
        <Row icon={<Sparkles size={19} className={ic} />} label={t("Replay onboarding")} onClick={() => set({ sheet: null, replay: true })} chevron={false} />
        <Row
          icon={<RotateCcw size={19} className={ic} />}
          label={t("Reset demo workspace")}
          onClick={async () => {
            if (!confirm(t("Start over with a fresh workspace? Messages, tasks and makes will be cleared."))) return;
            set({ sheet: null, tab: "chat", channelId: "main", taskId: null });
            await api.post("reset");
          }}
          chevron={false}
        />
        <Row
          icon={<LogOut size={19} className="text-[#D23B2A]" />}
          label={t("Sign out")}
          danger
          chevron={false}
          onClick={async () => {
            set({ sheet: null, tab: "chat", channelId: "main", taskId: null });
            await signOut();
          }}
        />
      </Group>
      <p className="mt-4 text-center text-[12px] text-ink-3">{t("Cloud Duet · open source")}</p>
    </Drawer>
  );
}

function fmt12(hhmm: string, lang: Lang) {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(locale(lang), { hour: "numeric", minute: "2-digit" });
}

function Bar({ used, limit, label, detail }: { used: number; limit: number; label: string; detail: string }) {
  const t = useT();
  const pct = Math.min(100, (used / limit) * 100);
  const color = pct >= 90 ? "#C34929" : pct >= 70 ? "#D79100" : "var(--duet-ink)";
  return (
    <div className="px-3 py-3.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[15.5px] font-medium">{label}</span>
        <span className="text-[13px] tabular-nums text-ink-2">{t("{pct}% used", { pct: Math.round(pct) })}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/10">
        <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 120, damping: 22 }} />
      </div>
      <p className="mt-1.5 text-[12.5px] text-ink-2">{detail}</p>
    </div>
  );
}

export function UsageSheet({ open }: { open: boolean }) {
  const { data, set } = useDuet();
  const t = useT();
  const lang = useLang();
  if (!data) return null;
  const u = data.usage;
  const sessionEnds = u.sessionStartedAt ? new Date(Date.parse(u.sessionStartedAt) + 5 * 3600_000) : null;
  return (
    <Drawer open={open} onClose={() => set({ sheet: null })} onBack={() => set({ sheet: "profile" })} title={t("Usage")}>
      <Group>
        <Bar used={u.sessionUsed} limit={u.sessionLimit} label={t("Current session")} detail={sessionEnds ? t("Resets {time}", { time: sessionEnds.toLocaleTimeString(locale(lang), { hour: "numeric", minute: "2-digit" }) }) : t("Starts with your next message")} />
        <Bar used={u.weeklyUsed} limit={u.weeklyLimit} label={t("This week")} detail={t("Resets {time}", { time: new Date(u.weekResetsAt).toLocaleDateString(locale(lang), { weekday: "long", hour: "numeric", minute: "2-digit" }) })} />
      </Group>
      {u.resetAvailable ? (
        <div className="mt-4 overflow-hidden rounded-2xl bg-[#C7604A]/10 p-4">
          <p className="font-serif text-[18px] font-semibold">{t("One free reset")}</p>
          <p className="mt-1 text-[14px] text-ink-2">
            {t("Clear both limits once, on us. Available until {date}.", { date: new Date(u.resetExpires).toLocaleDateString(locale(lang), { month: "long", day: "numeric" }) })}
          </p>
          <button
            type="button"
            onClick={async () => {
              await api.post("usage/reset");
              toast(t("Limits reset. Cloud Duet picks up where it left off."));
            }}
            className="mt-3 h-11 w-full rounded-full bg-[#D65A45] text-[15px] font-semibold text-white active:scale-[0.98]"
          >
            {t("Reset for free")}
          </button>
        </div>
      ) : (
        <p className="mt-4 px-3 text-[13px] text-ink-3">{t("You've used your free reset. Limits reset on their own schedule.")}</p>
      )}
      <p className="mt-4 px-3 text-[12.5px] text-ink-3">{t("Background tasks, routines and makes count toward the same limits as chat.")}</p>
    </Drawer>
  );
}

export function MemorySheet({ open }: { open: boolean }) {
  const { data, set } = useDuet();
  const t = useT();
  const [draft, setDraft] = useState<string | null>(null);
  const [fact, setFact] = useState("");
  const memory = data?.memory ?? "";
  const text = draft ?? memory;
  if (!data) return null;
  const dirty = draft !== null && draft !== memory;
  return (
    <Drawer
      open={open}
      onClose={() => {
        setDraft(null);
        set({ sheet: null });
      }}
      onBack={() => {
        setDraft(null);
        set({ sheet: "profile" });
      }}
      title={t("Memory")}
      full
      footer={
        <button
          type="button"
          disabled={!dirty}
          onClick={async () => {
            await api.put("memory", { memory: text });
            setDraft(null);
            toast(t("Memory saved"));
          }}
          className="h-12 w-full rounded-full bg-solid text-[16px] font-semibold text-solid-fg disabled:opacity-40"
        >
          {t("Save changes")}
        </button>
      }
    >
      <p className="px-1 pt-1 text-[14px] text-ink-2">{t("Cloud Duet reads this before every conversation and task. Edit it like a note, or add one line at a time.")}</p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!fact.trim()) return;
          await api.post("memory", { fact });
          setFact("");
          toast(t("Remembered"));
        }}
      >
        <input value={fact} onChange={(e) => setFact(e.target.value)} placeholder={t("Remember that…")} className="min-w-0 flex-1 rounded-xl bg-chrome px-3 py-2.5 text-[15px] outline-none" />
        <button type="submit" className="rounded-xl bg-chrome px-3.5 text-[14px] font-semibold">
          {t("Add")}
        </button>
      </form>
      <textarea value={text} onChange={(e) => setDraft(e.target.value)} spellCheck={false} className="mt-3 h-[52dvh] w-full resize-none rounded-2xl bg-chrome p-3.5 font-mono text-[13.5px] leading-relaxed outline-none" />
    </Drawer>
  );
}

export function NotificationsSheet({ open }: { open: boolean }) {
  const { data, set } = useDuet();
  const t = useT();
  const lang = useLang();
  if (!data) return null;
  const s = data.settings;
  const save = (p: Partial<typeof s>) => api.patch("settings", p);
  const perm = typeof Notification !== "undefined" ? Notification.permission : "unsupported";
  return (
    <Drawer open={open} onClose={() => set({ sheet: null })} onBack={() => set({ sheet: "profile" })} title={t("Notifications")}>
      <Group note={perm === "denied" ? t("Your browser is blocking notifications for this site. In-app banners still show.") : t("Notifications reach this device even when Duet is closed. On iPhone, add Duet to your Home Screen first.")}>
        <Row
          icon={<Bell size={19} className={ic} />}
          label={t("Notifications")}
          detail={t("When something is ready or needs you")}
          right={
            <Toggle
              label={t("Notifications")}
              on={s.notifications}
              onChange={async (v) => {
                if (v) {
                  const why = await enablePush().catch((e: Error) => e.message);
                  if (why) return void toast(why);
                } else await disablePush().catch(() => {});
                await save({ notifications: v }).catch((e: Error) => toast(e.message));
              }}
            />
          }
        />
        <Row
          label={t("Send a test")}
          chevron={false}
          onClick={async () => {
            await api.post("push/test");
            await api.post("notify-test");
          }}
        />
      </Group>
      <Group title={t("Routines")} note={t("Cloud Duet reads your inbox and calendar on this schedule and only messages you when something matters.")}>
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-[15.5px]">{t("Morning brief")}</span>
          <input type="time" value={s.briefTime} onChange={(e) => save({ briefTime: e.target.value })} className="rounded-lg bg-black/[0.05] px-2 py-1 text-[15px] tabular-nums outline-none dark:bg-white/10" />
        </div>
        <div className="px-3 py-2.5">
          <span className="text-[15.5px]">{t("Check-ins")}</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[8, 10, 12, 13, 15, 16, 18, 19, 21, 22].map((h) => {
              const on = s.checkinHours.includes(h);
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => save({ checkinHours: on ? s.checkinHours.filter((x) => x !== h) : [...s.checkinHours, h].sort((a, b) => a - b) })}
                  className={cn("rounded-full px-2.5 py-1 text-[13px] font-medium tabular-nums transition-colors", on ? "bg-solid text-solid-fg" : "bg-black/[0.05] text-ink-2 dark:bg-white/10")}
                >
                  {fmt12(`${h}:${String(s.checkinMinute).padStart(2, "0")}`, lang)}
                </button>
              );
            })}
          </div>
        </div>
        <Row label={t("Weekends")} detail={t("Run routines on Saturday and Sunday")} right={<Toggle label={t("Weekends")} on={s.weekendsOn} onChange={(v) => save({ weekendsOn: v })} />} />
      </Group>
    </Drawer>
  );
}

export function PaymentsSheet({ open }: { open: boolean }) {
  const { data, set } = useDuet();
  const t = useT();
  if (!data) return null;
  const link = data.connectors.find((c) => c.id === "link");
  return (
    <Drawer open={open} onClose={() => set({ sheet: null })} onBack={() => set({ sheet: "profile" })} title={t("Payments")}>
      <div className="flex flex-col items-center pt-1 text-center">
        <div className="chrome-shadow grid size-16 place-items-center rounded-2xl bg-chrome">
          <AppLogo id="link" size={34} />
        </div>
        <p className="mt-3 max-w-[310px] text-[14.5px] text-ink-2">{t("Cloud Duet can pay for things you approve using a one-time card from Link. Every purchase needs your OK, with the amount and merchant up front.")}</p>
      </div>
      <Group>
        <Row
          icon={<AppLogo id="link" size={20} />}
          label="Link"
          detail={link?.connected ? link.accounts[0] : t("Not connected")}
          right={
            <button
              type="button"
              onClick={() => api.patch("connectors/link", { connected: !link?.connected })}
              className={cn("rounded-full px-3 py-1 text-[13px] font-medium", link?.connected ? "text-[#D23B2A]" : "bg-solid text-solid-fg")}
            >
              {link?.connected ? t("Disconnect") : t("Connect")}
            </button>
          }
        />
        <Row label={t("Test mode")} detail={t("Approvals go through without charging a card")} right={<Toggle label={t("Test mode")} on={data.settings.paymentsTestMode} onChange={(v) => api.patch("settings", { paymentsTestMode: v })} />} />
      </Group>
      <p className="mt-4 px-3 text-[12.5px] text-ink-3">{t("Cloud Duet never stores card numbers, and won't trade, transfer money or move funds between accounts.")}</p>
    </Drawer>
  );
}

/** OpenAI-compatible providers, mostly ones that work well from mainland China. */
const MODEL_PRESETS = [
  { id: "deepseek", name: "DeepSeek", baseURL: "https://api.deepseek.com/v1", model: "deepseek-chat", keys: "https://platform.deepseek.com/api_keys" },
  { id: "qwen", name: "Qwen (Alibaba Bailian)", baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus", keys: "https://bailian.console.aliyun.com/?tab=model#/api-key" },
  { id: "kimi", name: "Kimi (Moonshot)", baseURL: "https://api.moonshot.cn/v1", model: "kimi-k2-turbo-preview", keys: "https://platform.moonshot.cn/console/api-keys" },
  { id: "glm", name: "Zhipu GLM", baseURL: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4.6", keys: "https://open.bigmodel.cn/usercenter/apikeys" },
  { id: "doubao", name: "Doubao (Volcano Ark)", baseURL: "https://ark.cn-beijing.volces.com/api/v3", model: "doubao-seed-1-6-250615", keys: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey" },
  { id: "siliconflow", name: "SiliconFlow", baseURL: "https://api.siliconflow.cn/v1", model: "deepseek-ai/DeepSeek-V3", keys: "https://cloud.siliconflow.cn/account/ak" },
  { id: "minimax", name: "MiniMax", baseURL: "https://api.minimaxi.com/v1", model: "MiniMax-M2", keys: "https://platform.minimaxi.com/user-center/basic-information/interface-key" },
  { id: "openai", name: "OpenAI", baseURL: "https://api.openai.com/v1", model: "gpt-5.6", keys: "https://platform.openai.com/api-keys" },
];

interface ModelInfo {
  provider: "anthropic" | "openai";
  model: string;
  baseURL: string;
  hasKey: boolean;
  keyHint: string;
}

/** The reserved model hook: bring your own key, or stay on the demo engine. */
export function ModelSheet({ open }: { open: boolean }) {
  const { data, set } = useDuet();
  const t = useT();
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [provider, setProvider] = useState<ModelInfo["provider"]>("anthropic");
  const [key, setKey] = useState("");
  const [model, setModel] = useState("");
  const [baseURL, setBaseURL] = useState("");
  const [test, setTest] = useState<{ ok: boolean; error?: string; ms: number } | "busy" | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void api.call<ModelInfo>("GET", "model").then(
      (m) => {
        if (cancelled) return;
        setInfo(m);
        setProvider(m.provider);
        setModel(m.model);
        setBaseURL(m.baseURL);
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [open]);

  const save = async () => {
    try {
      const m = await api.put<ModelInfo>("model", { provider, model, baseURL, ...(key.trim() ? { apiKey: key.trim() } : {}) });
      setInfo(m);
      setKey("");
      toast(m.hasKey ? t("Saved. Replies now come from the model.") : t("Saved. Add a key to switch off the demo engine."));
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const live = data?.engine.mode !== "demo";
  return (
    <Drawer
      open={open}
      onClose={() => {
        setTest(null);
        setKey("");
        set({ sheet: null });
      }}
      onBack={() => {
        setTest(null);
        setKey("");
        set({ sheet: "profile" });
      }}
      title={t("Model & API key")}
      full
    >
      <div className={cn("mt-1 flex items-center gap-3 rounded-2xl p-3.5", live ? "bg-ready/10" : "bg-black/[0.05] dark:bg-white/10")}>
        <span className={cn("size-2.5 shrink-0 rounded-full", live ? "bg-ready" : "bg-ink-3")} />
        <div className="min-w-0">
          <p className="text-[15px] font-medium">{live ? t("Live · {model}", { model: data?.engine.model ?? "" }) : t("Demo engine")}</p>
          <p className="text-[13px] text-ink-2">
            {live ? t("Cloud Duet thinks with your model and calls tools on its own: apps, tasks, memory, reminders, its browser.") : t("Scripted replies on a sample workspace. Add a key to use a real model.")}
          </p>
        </div>
      </div>

      <Group title={t("Provider")}>
        <div className="p-2">
          <Segment
            id="provider"
            value={provider}
            onChange={(p) => {
              setProvider(p);
              setModel(p === "anthropic" ? "claude-opus-5-5" : "gpt-5.6");
            }}
            options={[
              { v: "anthropic", label: "Anthropic" },
              { v: "openai", label: t("OpenAI-compatible") },
            ]}
          />
        </div>
      </Group>

      <Group title={t("Quick setup")} note={t("Fills in the address and a model. Model names change often; check the provider's model list if one fails.")}>
        <div className="flex flex-wrap gap-2 p-3">
          {MODEL_PRESETS.map((p) => {
            const on = provider === "openai" && baseURL === p.baseURL;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setProvider("openai");
                  setBaseURL(p.baseURL);
                  setModel(p.model);
                }}
                className={cn("rounded-full px-3 py-1.5 text-[13.5px] font-medium transition-colors", on ? "bg-solid text-solid-fg" : "bg-black/[0.06] dark:bg-white/10")}
              >
                {t(p.name)}
              </button>
            );
          })}
        </div>
        {MODEL_PRESETS.filter((p) => provider === "openai" && baseURL === p.baseURL).map((p) => (
          <a key={p.id} href={p.keys} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-4 pb-3 text-[13.5px] font-medium text-link">
            {t("Get a {name} API key", { name: t(p.name) })}
            <ExternalLink size={12} />
          </a>
        ))}
      </Group>

      <Group title={t("API key")} note={t("Stored on this server for your account only and never sent back to the browser. Get one at console.anthropic.com/settings/keys or platform.openai.com/api-keys.")}>
        <div className="flex items-center gap-2 px-3 py-2">
          <KeyRound size={17} className="shrink-0 text-ink-3" />
          <input
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={info?.hasKey ? t("Saved key {hint}", { hint: info.keyHint }) : provider === "anthropic" ? "sk-ant-…" : "sk-…"}
            className="min-w-0 flex-1 bg-transparent py-1.5 font-mono text-[14px] outline-none placeholder:font-sans placeholder:text-ink-3"
          />
          {info?.hasKey && (
            <button
              type="button"
              onClick={async () => {
                setInfo(await api.del<ModelInfo>("model"));
                toast(t("Key removed. Back on the demo engine."));
              }}
              className="text-[13px] font-medium text-[#D23B2A]"
            >
              {t("Remove")}
            </button>
          )}
        </div>
      </Group>

      <Group title={t("Model")}>
        <div className="px-3 py-2">
          <input value={model} onChange={(e) => setModel(e.target.value)} className="w-full bg-transparent py-1.5 font-mono text-[14px] outline-none" />
        </div>
        <div className="px-3 py-2">
          <input
            value={baseURL}
            onChange={(e) => setBaseURL(e.target.value)}
            placeholder={provider === "anthropic" ? t("Base URL (optional)") : "https://api.openai.com/v1"}
            className="w-full bg-transparent py-1.5 font-mono text-[14px] outline-none placeholder:font-sans placeholder:text-ink-3"
          />
        </div>
      </Group>

      <div className="mt-5 flex gap-2">
        <button type="button" onClick={save} className="h-12 flex-1 rounded-full bg-solid text-[16px] font-semibold text-solid-fg active:scale-[0.98]">
          {t("Save")}
        </button>
        <button
          type="button"
          disabled={!info?.hasKey || test === "busy"}
          onClick={async () => {
            setTest("busy");
            setTest(await api.post<{ ok: boolean; error?: string; ms: number }>("model/test").catch((e: Error) => ({ ok: false, error: e.message, ms: 0 })));
          }}
          className="h-12 rounded-full bg-chrome px-5 text-[15px] font-semibold disabled:opacity-40"
        >
          {test === "busy" ? t("Testing…") : t("Test")}
        </button>
      </div>
      {test && test !== "busy" && (
        <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={cn("mt-3 flex items-start gap-2 px-1 text-[13.5px]", test.ok ? "text-ready" : "text-[#D23B2A]")}>
          {test.ok ? <CircleCheck size={16} className="mt-0.5 shrink-0" /> : <CircleX size={16} className="mt-0.5 shrink-0" />}
          {test.ok ? t("Connected in {ms} ms", { ms: test.ms }) : test.error}
        </motion.p>
      )}
      <div className="mt-6 flex items-center gap-2 px-1 text-[12.5px] text-ink-3">
        <span>
          {t("With a key, Cloud Duet uses tools on its own: email, calendar, files, tasks, memory, reminders. Another backend? Add an adapter in {file}.")
            .split(/(\{file\})/)
            .map((part, i) =>
              part === "{file}" ? (
                <code key={i} className="font-mono">
                  src/lib/server/agent/loop.ts
                </code>
              ) : (
                part
              ),
            )}
        </span>
      </div>
    </Drawer>
  );
}
