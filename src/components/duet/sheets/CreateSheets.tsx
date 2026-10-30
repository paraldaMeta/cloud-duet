"use client";

import { motion } from "motion/react";
import { Check } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/client/i18n";
import { api, useDuet } from "@/lib/client/store";
import type { Channel, ChannelIcon } from "@/lib/shared/types";
import { cn } from "@/lib/utils";
import { CHANNEL_ICONS, ChannelGlyph, SWATCHES, inkOn } from "../bits";
import { Drawer } from "../Drawer";
import { useBusy } from "../hooks";

export function NewChannelSheet({ open }: { open: boolean }) {
  const set = useDuet((s) => s.set);
  const t = useT();
  const [icon, setIcon] = useState<ChannelIcon>("checkbox");
  const [color, setColor] = useState(SWATCHES[5]);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const close = () => {
    set({ sheet: null });
    setName("");
    setPurpose("");
  };
  const slug = name.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 60);
  const [creating, guard] = useBusy();

  const create = () =>
    guard(async () => {
      if (!slug) return;
      const ch = await api.post<Channel>("channels", { name: slug, icon, color, purpose });
      close();
      set({ menuOpen: false, tab: "chat", channelId: ch.id, taskId: null });
    });

  return (
    <Drawer
      open={open}
      onClose={close}
      title={t("New channel")}
      full
      footer={
        <button type="button" disabled={!slug || creating} onClick={() => void create()} className="h-12 w-full rounded-full bg-solid text-[16px] font-semibold text-solid-fg transition-opacity disabled:opacity-35">
          {t("Create channel")}
        </button>
      }
    >
      <div className="flex flex-col items-center py-3">
        <motion.div key={`${icon}${color}`} initial={{ scale: 0.85, rotate: -6 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}>
          <ChannelGlyph icon={icon} color={color} size={68} radius={20} />
        </motion.div>
        <p className="mt-2 h-5 text-[15px] font-medium text-ink-2">{slug ? `#${slug}` : ""}</p>
      </div>
      <div className="rounded-2xl bg-chrome p-3">
        <div className="grid grid-cols-8 gap-1.5">
          {(Object.keys(CHANNEL_ICONS) as ChannelIcon[]).map((k) => {
            const Icon = CHANNEL_ICONS[k];
            const on = k === icon;
            return (
              <button
                key={k}
                type="button"
                aria-label={k}
                onClick={() => setIcon(k)}
                className={cn("grid aspect-square place-items-center rounded-xl transition-colors", on ? "" : "text-ink-2 hover:bg-black/[0.04] dark:hover:bg-white/5")}
                style={on ? { background: color, color: inkOn(color) } : undefined}
              >
                <Icon size={19} />
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex justify-between border-t border-hair pt-3">
          {SWATCHES.map((c) => (
            <button key={c} type="button" aria-label={t("Color {c}", { c })} onClick={() => setColor(c)} className="relative grid size-8 place-items-center rounded-full" style={{ background: c }}>
              {c === color && (
                <motion.span layoutId="swatch-ring" className="absolute -inset-[3px] rounded-full border-2 border-ink" transition={{ type: "spring", stiffness: 600, damping: 36 }} />
              )}
              {c === color && <Check size={14} strokeWidth={3} style={{ color: inkOn(c) }} />}
            </button>
          ))}
        </div>
      </div>
      <label className="mt-4 block">
        <span className="px-1 text-[13px] font-medium text-ink-2">{t("Name")}</span>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && !creating && void create()}
          placeholder={t("e.g. launch-review")}
          className="mt-1 w-full rounded-xl bg-chrome px-3.5 py-3 text-[16px] outline-none placeholder:text-ink-3"
        />
      </label>
      <label className="mt-3 block">
        <span className="px-1 text-[13px] font-medium text-ink-2">{t("What's it for?")}</span>
        <textarea
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          rows={3}
          placeholder={t("Cloud Duet uses this to decide what belongs here.")}
          className="mt-1 w-full resize-none rounded-xl bg-chrome px-3.5 py-3 text-[16px] outline-none placeholder:text-ink-3"
        />
      </label>
    </Drawer>
  );
}

const IDEAS = ["Chase the Kestrel Coffee invoice", "Prep me for Thursday's launch review", "Find a time with Diana next week", "Summarize unread newsletters"];

export function AddTaskSheet({ open }: { open: boolean }) {
  const { set, channelId } = useDuet();
  const t = useT();
  const [text, setText] = useState("");
  const close = () => {
    set({ sheet: null });
    setText("");
  };
  const [adding, guard] = useBusy();
  const add = (prompt = text) =>
    guard(async () => {
      if (!prompt.trim()) return;
      await api.post("tasks", { prompt: prompt.trim(), channelId });
      close();
      set({ tab: "tasks" });
    });
  return (
    <Drawer
      open={open}
      onClose={close}
      title={t("New task")}
      footer={
        <button type="button" disabled={!text.trim() || adding} onClick={() => void add()} className="h-12 w-full rounded-full bg-[#D65A45] text-[16px] font-semibold text-white disabled:opacity-35">
          {t("Hand it to Cloud Duet")}
        </button>
      }
    >
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void add();
          }
        }}
        rows={4}
        placeholder={t("What should Cloud Duet take off your plate?")}
        className="mt-1 w-full resize-none rounded-2xl bg-chrome p-3.5 text-[17px] outline-none placeholder:text-ink-3"
      />
      <p className="mt-4 px-1 text-[13px] font-medium text-ink-2">{t("Try")}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {IDEAS.map((i) => (
          <button key={i} type="button" onClick={() => setText(t(i))} className="rounded-full border border-hair bg-chrome px-3 py-1.5 text-[14px] active:scale-95">
            {t(i)}
          </button>
        ))}
      </div>
      <p className="mt-4 px-1 text-[12.5px] text-ink-3">{t("Cloud Duet works on it in the background and lets you know when it's ready or needs you.")}</p>
    </Drawer>
  );
}
