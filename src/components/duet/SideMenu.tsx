"use client";

import { AnimatePresence, motion } from "motion/react";
import { Archive, ArchiveRestore, ChevronDown, Layers, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { t as tr, useT } from "@/lib/client/i18n";
import { api, useDuet } from "@/lib/client/store";
import type { Channel } from "@/lib/shared/types";
import { cn } from "@/lib/utils";
import { ChannelGlyph } from "./bits";
import { Mascot } from "./Mascot";

function unreadIn(c: Channel, messages: { channelId: string; role: string; createdAt: string; taskId?: string }[]) {
  return messages.filter((m) => m.channelId === c.id && !m.taskId && m.role === "claude" && m.createdAt > c.lastReadAt).length;
}

export function SideMenu() {
  const { data, channelId, tab, set } = useDuet();
  const [archived, setArchived] = useState(false);
  const t = useT();
  if (!data) return null;
  const main = data.channels.find((c) => c.id === "main");
  const live = data.channels.filter((c) => c.id !== "main" && !c.archived);
  const gone = data.channels.filter((c) => c.archived);
  const pick = (id: string) => set({ channelId: id, menuOpen: false, taskId: null, tab: tab === "pinned" ? "chat" : tab });

  return (
    <div className="flex h-full flex-col pt-[max(env(safe-area-inset-top),16px)]">
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-2">
        <Mascot size={40} />
        <span className="font-serif text-[22px] font-semibold">Cloud Duet</span>
      </div>
      <div className="mx-5 h-px bg-hair" />
      <nav className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-3">
        <button
          type="button"
          onClick={() => pick("main")}
          className={cn("flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-colors", channelId === "main" ? "bg-black/[0.06] dark:bg-white/10" : "active:bg-black/[0.04]")}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#C7604A] text-white">
            <Layers size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-semibold">{t("Everything")}</span>
            <span className="block truncate text-[13px] text-ink-2">{t("All chat context across every channel")}</span>
          </span>
          {main && unreadIn(main, data.messages) > 0 && <span className="size-2.5 rounded-full bg-badge" />}
        </button>

        <div className="relative ml-[29px] mt-0.5">
          <AnimatePresence initial={false}>
            {live.map((c, i) => {
              const unread = unreadIn(c, data.messages);
              const last = i === live.length - 1;
              return (
                <motion.div
                  key={c.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="group relative pl-4"
                >
                  <span className={cn("absolute left-0 top-0 w-px bg-ink-3/40", last ? "h-[26px]" : "h-full")} />
                  <span className="absolute left-0 top-[26px] h-px w-3 bg-ink-3/40" />
                  <button
                    type="button"
                    onClick={() => pick(c.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      void api.patch(`channels/${c.id}`, { archived: true });
                      if (channelId === c.id) set({ channelId: "main" });
                      toast(tr("Archived #{name}", { name: c.name }));
                    }}
                    className={cn("flex w-full items-center gap-2.5 rounded-2xl px-2 py-2 text-left transition-colors", channelId === c.id ? "bg-black/[0.06] dark:bg-white/10" : "active:bg-black/[0.04]")}
                  >
                    <ChannelGlyph icon={c.icon} color={c.color} size={30} radius={9} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-[15px]", unread ? "font-semibold" : "font-medium")}>{c.name}</span>
                      {c.purpose && <span className="block truncate text-[12.5px] text-ink-2">{c.purpose}</span>}
                    </span>
                    {unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-badge px-1.5 text-[11px] font-semibold text-white">{unread}</span>}
                    <span className="size-7 shrink-0" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={t("Archive {name}", { name: c.name })}
                    onClick={() => {
                      void api.patch(`channels/${c.id}`, { archived: true }).catch(() => {});
                      if (channelId === c.id) set({ channelId: "main" });
                      toast(tr("Archived #{name}", { name: c.name }));
                    }}
                    className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-ink-3 opacity-0 hover:bg-black/5 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-white/10 [@media(hover:none)]:opacity-60"
                  >
                    <Archive size={14} />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <button type="button" onClick={() => set({ sheet: "newChannel" })} className="mt-1 flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left text-ink-2 active:bg-black/[0.04]">
          <span className="grid size-9 place-items-center rounded-[10px] border-[1.5px] border-dashed border-ink-3/60">
            <Plus size={17} />
          </span>
          <span className="text-[15px] font-medium">{t("New channel")}</span>
        </button>

        <button type="button" onClick={() => setArchived((v) => !v)} className="mt-1 flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left text-ink-2 active:bg-black/[0.04]">
          <span className="grid size-9 place-items-center">
            <Archive size={18} />
          </span>
          <span className="flex-1 text-[15px] font-medium">{t("Archived")}</span>
          {gone.length > 0 && <span className="text-[13px] tabular-nums">{gone.length}</span>}
          <ChevronDown size={16} className={cn("transition-transform", archived && "rotate-180")} />
        </button>
        <AnimatePresence initial={false}>
          {archived && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              {gone.length === 0 && <p className="px-14 py-2 text-[13px] text-ink-3">{t("Nothing archived. Right-click a channel to archive it.")}</p>}
              {gone.map((c) => (
                <div key={c.id} className="flex items-center gap-2.5 py-1.5 pl-[52px] pr-2 opacity-70">
                  <ChannelGlyph icon={c.icon} color={c.color} size={24} radius={7} />
                  <span className="min-w-0 flex-1 truncate text-[14px]">{c.name}</span>
                  <button type="button" aria-label={t("Restore {name}", { name: c.name })} onClick={() => api.patch(`channels/${c.id}`, { archived: false })} className="grid size-8 place-items-center rounded-full text-ink-2 hover:bg-black/5">
                    <ArchiveRestore size={15} />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </div>
  );
}
