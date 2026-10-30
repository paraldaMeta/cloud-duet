"use client";

import { AnimatePresence, motion, useMotionValue, animate } from "motion/react";
import { ArrowDown } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/client/i18n";
import { api, useDuet } from "@/lib/client/store";
import { Mascot } from "../Mascot";
import { MessageList } from "./MessageList";

export function useStickyScroll(deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [away, setAway] = useState(false);

  const toBottom = (smooth = true) => {
    const el = ref.current;
    if (!el) return;
    pinned.current = true;
    setAway(false);
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const d = el.scrollHeight - el.scrollTop - el.clientHeight;
      pinned.current = d < 80;
      setAway(d > 240);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const onSent = () => setTimeout(() => toBottom(), 30);
    window.addEventListener("duet:sent", onSent);
    // Content that grows (cards, iframes) keeps the newest message in view.
    const ro = new ResizeObserver(() => {
      if (pinned.current) el.scrollTop = el.scrollHeight;
    });
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("duet:sent", onSent);
      ro.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && pinned.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  return { ref, away, toBottom };
}

export function ChatView() {
  const t = useT();
  const data = useDuet((s) => s.data)!;
  const channelId = useDuet((s) => s.channelId);
  const channel = data.channels.find((c) => c.id === channelId);
  const messages = useMemo(() => data.messages.filter((m) => m.channelId === channelId && !m.taskId), [data.messages, channelId]);
  // The "New" divider marks what arrived since you last looked; captured when the channel opens.
  const [seen, setSeen] = useState<{ channelId: string; at: string | null }>({ channelId, at: channel?.lastReadAt ?? null });
  if (seen.channelId !== channelId) setSeen({ channelId, at: channel?.lastReadAt ?? null });
  const newAfter = seen.at;
  const typing = !!data.typing[channelId];
  const { ref, away, toBottom } = useStickyScroll([messages.length, typing, data.status[channelId]]);
  const x = useMotionValue(0);

  useEffect(() => {
    void api.post(`channels/${channelId}/read`);
  }, [channelId]);
  useEffect(() => {
    const mark = () => document.visibilityState === "visible" && api.post(`channels/${channelId}/read`).catch(() => {});
    const timer = setInterval(mark, 15_000);
    return () => clearInterval(timer);
  }, [channelId]);

  return (
    <div className="relative h-full">
      <div
        ref={ref}
        className="no-scrollbar h-full overflow-y-auto overflow-x-hidden"
        onPointerDown={() => window.dispatchEvent(new CustomEvent("duet:blur"))}
      >
        <motion.div
          className="mx-auto max-w-[680px] px-4 pb-[190px] pt-[118px]"
          style={{ x }}
          drag="x"
          dragDirectionLock
          dragConstraints={{ left: -64, right: 0 }}
          dragElastic={0.12}
          dragMomentum={false}
          onDragEnd={() => animate(x, 0, { type: "spring", stiffness: 500, damping: 40 })}
        >
          {messages.length === 0 && !typing ? (
            <EmptyChannel name={channel?.name ?? "main"} />
          ) : (
            <MessageList messages={messages} lane={channelId} newAfter={newAfter} />
          )}
          <p className="pt-6 text-center text-[12px] text-ink-3">{t("Cloud Duet is AI and can make mistakes.")}</p>
        </motion.div>
      </div>
      <AnimatePresence>
        {away && (
          <motion.button
            type="button"
            aria-label={t("Scroll to bottom")}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => toBottom()}
            className="chrome-shadow absolute bottom-[178px] left-1/2 z-20 -ml-5 grid size-10 place-items-center rounded-full bg-chrome"
          >
            <ArrowDown size={18} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyChannel({ name }: { name: string }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center pt-24 text-center">
      <Mascot size={72} />
      <p className="mt-4 font-serif text-[22px] font-semibold">{name === "main" ? t("Your main thread") : `#${name}`}</p>
      <p className="mt-1 max-w-[280px] text-[15px] text-ink-2">{t("Tell Cloud Duet what you need, typed or spoken. It'll work in the background and come back when something needs you.")}</p>
    </div>
  );
}
