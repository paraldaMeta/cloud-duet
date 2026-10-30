"use client";

import { motion } from "motion/react";
import { useRef } from "react";
import { toast } from "sonner";
import { t as tr, useT } from "@/lib/client/i18n";
import { api, useDuet, type Tab } from "@/lib/client/store";
import { cn } from "@/lib/utils";
import { Badge } from "./bits";
import { useTaskBadge } from "./hooks";
import { ArtifactTypeIcon } from "./make/types";

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 12.2C4 7.8 7.6 4.5 12 4.5s8 3.3 8 7.7-3.6 7.7-8 7.7c-1.1 0-2.2-.2-3.1-.6L4.5 20.5l1.2-3.6C4.6 15.6 4 14 4 12.2z" />
      <path d="M8.3 12.4c.8-1.2 1.5-1.2 2.2 0s1.5 1.2 2.2 0 1.5-1.2 2.2 0" />
    </svg>
  );
}
function TasksIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m4 7 1.6 1.6L8.5 5.7M4 15.5l1.6 1.6 2.9-2.9" />
      <path d="M11.5 7.2H20M11.5 15.7H20" />
    </svg>
  );
}
function MakeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12.5 4.5H7a2.5 2.5 0 0 0-2.5 2.5v10A2.5 2.5 0 0 0 7 19.5h10a2.5 2.5 0 0 0 2.5-2.5v-5.5" />
      <path d="M8.5 15.5h3M10 14v3" />
      <path d="m18 3.8 2.2 2.2-6.4 6.4-2.8.6.6-2.8z" />
    </svg>
  );
}

export function TabBar() {
  const { tab, set, data } = useDuet();
  const badge = useTaskBadge();
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const t = useT();
  const pinned = data?.artifacts.find((a) => a.inTabBar);
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "chat", label: t("Chat"), icon: <ChatIcon /> },
    { id: "tasks", label: t("Tasks"), icon: <TasksIcon /> },
    { id: "make", label: t("Make"), icon: <MakeIcon /> },
  ];
  if (pinned) tabs.push({ id: "pinned", label: pinned.title, icon: <ArtifactTypeIcon type={pinned.type} size={22} /> });
  const compact = tabs.length > 3;

  return (
    <nav className="chrome-shadow pointer-events-auto mx-auto flex h-16 w-[82%] max-w-[420px] items-center gap-1 rounded-full bg-chrome p-[5px]" aria-label={t("Tabs")}>
      {tabs.map((x) => (
        <button
          key={x.id}
          type="button"
          aria-label={x.label}
          aria-current={tab === x.id}
          onClick={() => {
            if (longPressed.current) {
              longPressed.current = false;
              return;
            }
            window.dispatchEvent(new CustomEvent("duet:blur"));
            set({ tab: x.id, taskId: null });
          }}
          onPointerDown={() => {
            longPressed.current = false;
            if (x.id !== "pinned" || !pinned) return;
            press.current = setTimeout(async () => {
              press.current = null;
              longPressed.current = true;
              await api.patch(`artifacts/${pinned.id}`, { inTabBar: false }).catch(() => {});
              set({ tab: "make" });
              toast(tr("Removed from tab bar"));
            }, 650);
          }}
          onPointerUp={() => press.current && clearTimeout(press.current)}
          onPointerLeave={() => press.current && clearTimeout(press.current)}
          onPointerCancel={() => press.current && clearTimeout(press.current)}
          className={cn("relative flex h-[54px] flex-1 flex-col items-center justify-center rounded-full text-ink transition-colors", tab !== x.id && "text-ink-2")}
        >
          {tab === x.id && (
            <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-black/[0.06] dark:bg-white/10" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
          )}
          <span className="relative">
            {x.icon}
            {x.id === "tasks" && <Badge count={badge} className="-right-2.5" />}
          </span>
          {!compact && <span className="relative mt-0.5 text-[11px] font-medium">{x.label}</span>}
        </button>
      ))}
    </nav>
  );
}
