"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/client/i18n";
import { send, useDuet } from "@/lib/client/store";
import type { AppNotice } from "@/lib/shared/types";
import { getSpeech } from "./Composer";
import { Mascot, MascotMark, type MascotMood } from "./Mascot";

type Rec = InstanceType<NonNullable<ReturnType<typeof getSpeech>>>;

/** Full-screen voice: the mascot listens, the transcript builds under it, the button morphs into send. */
export function VoiceMode() {
  const set = useDuet((s) => s.set);
  const [text, setText] = useState("");
  const [supported] = useState(() => !!getSpeech());
  const [mood, setMood] = useState<MascotMood>(supported ? "listening" : "idle");
  const rec = useRef<Rec | null>(null);
  const t = useT();

  useEffect(() => {
    const R = getSpeech();
    if (!R) return;
    const r = new R();
    r.lang = navigator.language;
    r.interimResults = true;
    r.continuous = true;
    r.onresult = (e) => setText(Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join(""));
    r.onend = () => setMood((m) => (m === "listening" ? "idle" : m));
    r.onerror = () => setMood("idle");
    try {
      r.start();
    } catch {}
    rec.current = r;
    return () => r.abort?.();
  }, []);

  const close = () => {
    rec.current?.stop();
    set({ voice: false });
  };
  const submit = async () => {
    const msg = text.trim();
    if (!msg) return close();
    rec.current?.stop();
    setMood("thinking");
    try {
      await send(msg);
      setTimeout(() => set({ voice: false, tab: "chat" }), 450);
    } catch (e) {
      setMood("idle");
      toast((e as Error).message);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[70] flex flex-col items-center bg-paper/95 backdrop-blur-xl"
    >
      <div className="flex flex-1 flex-col items-center justify-center px-8">
        <motion.div initial={{ scale: 0.4, y: -220 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 220, damping: 22 }}>
          <Mascot mood={mood} size={200} />
        </motion.div>
        <p className="mt-6 h-6 text-[15px] text-ink-2">{t(mood === "thinking" ? "Sending…" : supported ? (mood === "listening" ? "Listening" : "Tap the mic to talk again") : "Voice isn't supported here. Type instead.")}</p>
        {supported ? (
          <p className="mt-3 min-h-[3em] max-w-[520px] text-center font-serif text-[24px] leading-snug">{text || <span className="text-ink-3">{t("Go ahead, I'm listening.")}</span>}</p>
        ) : (
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && submit()}
            className="mt-4 w-full max-w-[420px] rounded-2xl bg-chrome px-4 py-3 text-center text-[18px] outline-none"
            placeholder={t("What do you need?")}
          />
        )}
      </div>
      <div className="flex w-full max-w-[420px] items-center justify-between px-10 pb-[max(env(safe-area-inset-bottom),36px)]">
        <button type="button" aria-label={t("Cancel")} onClick={close} className="chrome-shadow grid size-16 place-items-center rounded-full bg-chrome">
          <X size={24} />
        </button>
        <motion.button
          type="button"
          aria-label={t("Send")}
          onClick={submit}
          animate={{ scale: text.trim() ? 1 : 0.92, backgroundColor: text.trim() ? "#D65A45" : "var(--duet-solid)" }}
          className="grid size-16 place-items-center rounded-full text-white"
        >
          <AnimatePresence mode="wait" initial={false}>
            {text.trim() ? (
              <motion.span key="send" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ opacity: 0 }}>
                <ArrowUp size={26} strokeWidth={2.4} />
              </motion.span>
            ) : (
              <motion.span key="wave" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-[3px] text-solid-fg">
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.span
                    key={i}
                    className="w-[3px] rounded-full bg-current"
                    animate={{ height: mood === "listening" ? [6, 20, 9, 16, 6] : 6 }}
                    transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.12 }}
                  />
                ))}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </motion.div>
  );
}

function Banner({ n }: { n: AppNotice }) {
  const set = useDuet((s) => s.set);
  const dismiss = useDuet((s) => s.dismissNotice);
  const t = useT();
  const onClose = () => dismiss(n.id);
  useEffect(() => {
    const timer = setTimeout(() => dismiss(n.id), 5200);
    return () => clearTimeout(timer);
  }, [dismiss, n.id]);
  return (
    <motion.button
      type="button"
      layout
      initial={{ y: -90, opacity: 0, scale: 0.96 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -70, opacity: 0, scale: 0.96, transition: { duration: 0.22 } }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.8, bottom: 0.1 }}
      onDragEnd={(_, i) => i.offset.y < -30 && onClose()}
      onClick={() => {
        set({ tab: n.taskId ? "tasks" : "chat", channelId: n.channelId ?? "main", taskId: n.taskId ?? null, menuOpen: false, sheet: null });
        onClose();
      }}
      className="pointer-events-auto flex w-full items-start gap-3 rounded-[22px] border border-white/40 bg-white/80 p-3 text-left shadow-[0_10px_40px_rgb(0_0_0/0.16)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#2A2A2A]/85"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-[11px] bg-[#F4F4F4] dark:bg-[#111]">
        <MascotMark size={34} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-[14.5px] font-semibold">{n.title}</span>
          <span className="text-[12px] text-ink-3">{t("now")}</span>
        </span>
        <span className="line-clamp-2 text-[14.5px] leading-snug">{n.body}</span>
      </span>
    </motion.button>
  );
}

export function NotificationBanners() {
  const notices = useDuet((s) => s.notices);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] mx-auto flex max-w-[440px] flex-col gap-2 px-3 pt-[max(env(safe-area-inset-top),10px)]">
      <AnimatePresence>
        {notices.slice(-2).map((n) => (
          <Banner key={n.id} n={n} />
        ))}
      </AnimatePresence>
    </div>
  );
}
