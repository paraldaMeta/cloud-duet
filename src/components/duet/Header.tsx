"use client";

import { AnimatePresence, motion } from "motion/react";
import { Menu } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { t as tr, useT } from "@/lib/client/i18n";
import { useDuet } from "@/lib/client/store";
import { Badge, ChannelGlyph, CircleButton } from "./bits";
import { Mascot, moodFor } from "./Mascot";
import { useUnreadChannels } from "./hooks";

export function Header() {
  const { data, channelId, taskId, tab, set } = useDuet();
  const unread = useUnreadChannels();
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const t = useT();
  if (!data) return null;

  const key = taskId ?? channelId;
  const status = data.status[key] ?? null;
  const typing = !!data.typing[key];
  const anyTaskWorking = data.tasks.some((t) => t.status === "working" && !t.archived);
  const live = status ?? (tab === "tasks" && anyTaskWorking ? "Working on your tasks" : null);
  const channel = data.channels.find((c) => c.id === channelId);
  const inChannel = tab === "chat" && channel && channel.id !== "main";

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30">
      <div className="fade-top absolute inset-x-0 top-0 h-28" />
      <div className="relative mx-auto flex max-w-[680px] items-start justify-between px-4 pt-[max(env(safe-area-inset-top),12px)]">
        <CircleButton className="pointer-events-auto mt-2 lg:invisible" aria-label={t("Open menu")} onClick={() => set({ menuOpen: true })}>
          <Menu size={20} strokeWidth={2} />
          <Badge count={unread} />
        </CircleButton>

        <div className="pointer-events-auto relative flex flex-col items-center">
          <button
            type="button"
            aria-label={t("What Cloud Duet has access to")}
            onClick={() => set({ sheet: "claude" })}
            className="chrome-shadow grid size-16 place-items-center rounded-full bg-chrome transition-transform active:scale-95"
          >
            <Mascot mood={moodFor(live, typing)} size={52} />
          </button>
          <AnimatePresence mode="popLayout" initial={false}>
            {(inChannel || live) && (
              <motion.div
                key={`${inChannel ? channel!.id : "main"}-${live ?? ""}`}
                initial={{ opacity: 0, y: -4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -2, scale: 0.98 }}
                transition={{ duration: 0.22 }}
                className="-mt-2.5 flex max-w-[220px] flex-col items-center rounded-full border border-hair bg-chrome px-3 py-1 text-[13px] leading-tight text-ink shadow-sm"
              >
                {inChannel && (
                  <span className="flex items-center gap-1.5 font-medium">
                    <ChannelGlyph icon={channel!.icon} color={channel!.color} size={14} radius={4} />#{channel!.name}
                  </span>
                )}
                {live && <span className={inChannel ? "text-[12px] text-ink-2" : "shimmer"}>{t(live)}</span>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <CircleButton
          className="pointer-events-auto mt-2 text-[14px] font-semibold"
          aria-label={t("Profile")}
          onClick={() => {
            if (longPressed.current) {
              longPressed.current = false;
              return;
            }
            set({ sheet: "profile" });
          }}
          onPointerDown={() => {
            longPressed.current = false;
            press.current = setTimeout(() => {
              press.current = null;
              longPressed.current = true;
              set({ replay: true });
              toast(tr("Replaying onboarding"));
            }, 700);
          }}
          onPointerUp={() => press.current && clearTimeout(press.current)}
          onPointerLeave={() => press.current && clearTimeout(press.current)}
          onPointerCancel={() => press.current && clearTimeout(press.current)}
        >
          {data.user.initials}
        </CircleButton>
      </div>
    </div>
  );
}
