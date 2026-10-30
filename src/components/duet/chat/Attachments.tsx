"use client";

import { motion } from "motion/react";
import { FileText, X } from "lucide-react";
import { useT } from "@/lib/client/i18n";
import type { Attachment } from "@/lib/shared/types";
import { cn } from "@/lib/utils";

export const fileUrl = (a: Attachment) => `/api/files/${a.id}`;
export const isImageFile = (type: string) => /^image\/(png|jpe?g|gif|webp)$/.test(type);
export const sizeLabel = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

function FileChip({ name, detail, onRemove, progress, href }: { name: string; detail: string; onRemove?: () => void; progress?: number; href?: string }) {
  const t = useT();
  const inner = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-black/[0.06] text-ink-2 dark:bg-white/10">
        <FileText size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-ink">{name}</span>
        <span className="block text-[12px] text-ink-3">{detail}</span>
      </span>
    </>
  );
  return (
    <div className="relative flex w-[210px] items-center gap-2.5 overflow-hidden rounded-2xl border border-hair bg-chrome py-2 pl-2 pr-3">
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-2.5">
          {inner}
        </a>
      ) : (
        inner
      )}
      {onRemove && (
        <button type="button" aria-label={t("Remove {name}", { name })} onClick={onRemove} className="grid size-6 shrink-0 place-items-center rounded-full bg-black/[0.06] text-ink-2 dark:bg-white/10">
          <X size={13} />
        </button>
      )}
      {progress !== undefined && progress < 1 && (
        <motion.span className="absolute bottom-0 left-0 h-[2px] bg-orange" initial={{ width: 0 }} animate={{ width: `${Math.round(progress * 100)}%` }} />
      )}
    </div>
  );
}

export interface PendingFile {
  key: string;
  name: string;
  type: string;
  size: number;
  preview?: string;
  progress: number;
  attachment?: Attachment;
  error?: string;
}

/** Files waiting above the composer, uploading or ready to send. */
export function PendingFiles({ files, onRemove }: { files: PendingFile[]; onRemove: (key: string) => void }) {
  const t = useT();
  if (!files.length) return null;
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-1 pb-2 pt-1">
      {files.map((f) =>
        f.preview && !f.error ? (
          <div key={f.key} className="relative size-16 shrink-0 overflow-hidden rounded-2xl border border-hair bg-chrome">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.preview} alt={f.name} className={cn("size-full object-cover", f.progress < 1 && "opacity-60")} />
            <button type="button" aria-label={t("Remove {name}", { name: f.name })} onClick={() => onRemove(f.key)} className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/60 text-white">
              <X size={12} />
            </button>
            {f.progress < 1 && <motion.span className="absolute bottom-0 left-0 h-[3px] bg-orange" animate={{ width: `${Math.round(f.progress * 100)}%` }} />}
          </div>
        ) : (
          <div key={f.key} className="shrink-0">
            <FileChip name={f.name} detail={f.error ?? (f.progress < 1 ? t("Uploading…") : sizeLabel(f.size))} progress={f.progress} onRemove={() => onRemove(f.key)} />
          </div>
        ),
      )}
    </div>
  );
}

/** Attachments inside a sent message. */
export function MessageFiles({ files, mine }: { files: Attachment[]; mine: boolean }) {
  return (
    <div className={cn("flex max-w-[82%] flex-wrap gap-1.5", mine ? "justify-end" : "justify-start")}>
      {files.map((f) =>
        isImageFile(f.type) ? (
          <a key={f.id} href={fileUrl(f)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[18px] border border-hair">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fileUrl(f)} alt={f.name} loading="lazy" className="max-h-[260px] max-w-[240px] object-cover" />
          </a>
        ) : (
          <FileChip key={f.id} name={f.name} detail={sizeLabel(f.size)} href={fileUrl(f)} />
        ),
      )}
    </div>
  );
}
