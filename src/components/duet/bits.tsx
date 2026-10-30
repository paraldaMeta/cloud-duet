"use client";

import {
  Book, Briefcase, Calendar, Car, ChartColumn, CircleDollarSign, Folder, Gift, Globe, Heart, House, Mail, MapPin, Music,
  Package, Pencil, Plane, PlaySquare, Scissors, Search, ShoppingBag, Sprout, SquareCheck, Users, type LucideIcon,
} from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { getLang, t } from "@/lib/client/i18n";
import { locale } from "@/lib/i18n";
import type { ChannelIcon } from "@/lib/shared/types";
import { cn } from "@/lib/utils";

export const CHANNEL_ICONS: Record<ChannelIcon, LucideIcon> = {
  checkbox: SquareCheck, calendar: Calendar, mail: Mail, dollar: CircleDollarSign, chart: ChartColumn, globe: Globe, pin: MapPin, house: House,
  cube: Package, play: PlaySquare, folder: Folder, pencil: Pencil, search: Search, heart: Heart, people: Users, briefcase: Briefcase,
  book: Book, plane: Plane, car: Car, scissors: Scissors, bag: ShoppingBag, gift: Gift, sprout: Sprout, music: Music,
};

export const SWATCHES = ["#B54C76", "#E5C0C5", "#E0BCAD", "#E69F4E", "#CAD0BA", "#5D927A", "#BECDDA", "#6290C2", "#C1BDD3"];

/** Light swatches need dark icons; dark ones need white. */
export function inkOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.68 ? "#3A3833" : "#FFFFFF";
}

export function ChannelGlyph({ icon, color, size = 28, radius = 8 }: { icon: ChannelIcon; color: string; size?: number; radius?: number }) {
  const Icon = CHANNEL_ICONS[icon] ?? SquareCheck;
  return (
    <span className="inline-grid shrink-0 place-items-center" style={{ width: size, height: size, borderRadius: radius, background: color, color: inkOn(color) }}>
      <Icon size={size * 0.55} strokeWidth={2} />
    </span>
  );
}

export function CircleButton({ className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "chrome-shadow relative grid size-11 shrink-0 place-items-center rounded-full bg-chrome text-ink transition-transform active:scale-95",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Badge({ count, className }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <span className={cn("absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-badge px-1 text-[11px] font-semibold text-white", className)}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function timeAgo(iso: string) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return t("Just now");
  if (s < 3600) return t("{n} min. ago", { n: Math.floor(s / 60) });
  if (s < 86400) return t("{n} hr ago", { n: Math.floor(s / 3600) });
  return new Date(iso).toLocaleDateString(locale(getLang()), { month: "short", day: "numeric" });
}

export function clock(iso: string) {
  return new Date(iso).toLocaleTimeString(locale(getLang()), { hour: "numeric", minute: "2-digit" });
}

export function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return t("Today {time}", { time: clock(iso) });
  if (d.toDateString() === y.toDateString()) return t("Yesterday {time}", { time: clock(iso) });
  return `${d.toLocaleDateString(locale(getLang()), { weekday: "short", month: "short", day: "numeric" })} ${clock(iso)}`;
}

/** The wavy grey divider used in task details and the "New" marker. */
export function Squiggle({ className, width = 120 }: { className?: string; width?: number }) {
  const pts: string[] = [];
  for (let x = 0; x <= width; x += 2) pts.push(`${x} ${5 + Math.sin(x / 4) * 3}`);
  return (
    <svg viewBox={`0 0 ${width} 10`} width={width} height={10} className={className} preserveAspectRatio="none" aria-hidden>
      <path d={`M${pts.join("L")}`} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
