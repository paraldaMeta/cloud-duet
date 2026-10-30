"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, AudioLines, ListPlus, Mic, Paperclip, Plus, Sparkles, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getLang, t as tt, useT } from "@/lib/client/i18n";
import { uploadFile, useDuet } from "@/lib/client/store";
import { locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { isImageFile, PendingFiles, type PendingFile } from "./chat/Attachments";

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

export function getSpeech(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function Composer({
  placeholder,
  onSend,
  onFocusChange,
  showPlus = true,
  showVoice = true,
}: {
  placeholder: string;
  onSend: (text: string, files: string[]) => void | Promise<unknown>;
  onFocusChange?: (focused: boolean) => void;
  showPlus?: boolean;
  showVoice?: boolean;
}) {
  const t = useT();
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const [listening, setListening] = useState(false);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const ref = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const uploading = files.some((f) => !f.attachment && !f.error);
  const ready = files.filter((f) => f.attachment).map((f) => f.attachment!.id);
  const canSend = !uploading && (!!text.trim() || ready.length > 0);

  const addFiles = (list: FileList | File[]) => {
    for (const file of Array.from(list).slice(0, 8)) {
      const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
      const preview = isImageFile(file.type) ? URL.createObjectURL(file) : undefined;
      setFiles((fs) => [...fs, { key, name: file.name, type: file.type, size: file.size, preview, progress: 0 }]);
      const update = (p: Partial<PendingFile>) => setFiles((fs) => fs.map((f) => (f.key === key ? { ...f, ...p } : f)));
      uploadFile(file, (progress) => update({ progress })).then(
        (attachment) => update({ attachment, progress: 1 }),
        (e: Error) => {
          update({ error: e.message, progress: 1 });
          toast(`${file.name}: ${e.message}`);
        },
      );
    }
  };
  const removeFile = (key: string) =>
    setFiles((fs) => {
      const f = fs.find((x) => x.key === key);
      if (f?.preview) URL.revokeObjectURL(f.preview);
      return fs.filter((x) => x.key !== key);
    });
  const rec = useRef<SpeechRec | null>(null);
  const skills = useDuet((s) => s.data?.skills ?? []);
  const set = useDuet((s) => s.set);
  const slash = text.startsWith("/") && !text.includes(" ");
  const matches = slash ? skills.filter((k) => k.name.startsWith(text)) : [];

  useEffect(() => {
    const blur = () => ref.current?.blur();
    window.addEventListener("duet:blur", blur);
    return () => window.removeEventListener("duet:blur", blur);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  const submit = () => {
    const msg = text.trim();
    if (!canSend) return;
    const sent = files;
    setFiles([]);
    setText("");
    rec.current?.stop();
    ref.current?.blur();
    Promise.resolve(onSend(msg, ready)).then(
      () => {
        for (const f of sent) if (f.preview) URL.revokeObjectURL(f.preview);
      },
      (e: Error) => {
        toast(e.message || tt("Couldn't send that"));
        setText((cur) => cur || msg);
        setFiles((cur) => (cur.length ? cur : sent));
      },
    );
  };

  const latest = useRef({ files, rec });
  useEffect(() => {
    latest.current = { files, rec };
  });
  useEffect(
    () => () => {
      latest.current.rec.current?.abort?.();
      for (const f of latest.current.files) if (f.preview) URL.revokeObjectURL(f.preview);
    },
    [],
  );

  const dictate = () => {
    const Rec = getSpeech();
    if (!Rec) {
      toast(tt("Dictation isn't supported in this browser."));
      return;
    }
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = new Rec();
    r.lang = locale(getLang());
    r.interimResults = true;
    r.continuous = true;
    const base = text ? `${text} ` : "";
    r.onresult = (e) => {
      let s = "";
      for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript;
      setText(base + s);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };

  return (
    <div className="relative">
      <AnimatePresence>
        {matches.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="chrome-shadow absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-2xl bg-chrome py-1"
          >
            {matches.map((k) => (
              <button key={k.name} type="button" onClick={() => setText(`${k.name} `)} className="flex w-full flex-col px-4 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[15px] font-medium">{k.name}</span>
                <span className="truncate text-[13px] text-ink-2">{k.description}</span>
              </button>
            ))}
          </motion.div>
        )}
        {menu && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            className="chrome-shadow absolute bottom-full left-0 mb-2 w-56 origin-bottom-left overflow-hidden rounded-2xl bg-chrome py-1.5"
          >
            {[
              { icon: Paperclip, label: "Add a file", id: "file" },
              { icon: ListPlus, label: "Add a task", id: "task" },
              { icon: Sparkles, label: "Make something", id: "make" },
            ].map(({ icon: I, label, id }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setMenu(false);
                  if (id === "file") picker.current?.click();
                  else if (id === "task") set({ sheet: "addTask" });
                  else set({ tab: "make" });
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-[15px] hover:bg-black/5 dark:hover:bg-white/5"
              >
                <I size={18} className="text-ink-2" /> {t(label)}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <input
        ref={picker}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <PendingFiles files={files} onRemove={removeFile} />
      <div className="chrome-shadow flex items-end gap-1 rounded-[26px] bg-chrome p-[6px] pl-2">
        {showPlus && (
          <button type="button" aria-label={t("More")} onClick={() => setMenu((m) => !m)} className="grid size-10 shrink-0 place-items-center rounded-full text-ink-2 transition-transform active:scale-90">
            <Plus size={22} className={cn("transition-transform duration-200", menu && "rotate-45")} />
          </button>
        )}
        <textarea
          ref={ref}
          rows={1}
          value={text}
          placeholder={listening ? t("Listening…") : placeholder}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => {
            setMenu(false);
            onFocusChange?.(true);
          }}
          onBlur={() => onFocusChange?.(false)}
          onPaste={(e) => {
            const pasted = Array.from(e.clipboardData.files);
            if (showPlus && pasted.length) {
              e.preventDefault();
              addFiles(pasted);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          className={cn("max-h-[140px] min-h-10 flex-1 resize-none bg-transparent py-[9px] text-[17px] leading-[22px] text-ink outline-none placeholder:text-ink-3", !showPlus && "pl-2")}
        />
        <button
          type="button"
          aria-label={listening ? t("Stop dictation") : t("Dictate")}
          onClick={dictate}
          className={cn("grid size-10 shrink-0 place-items-center rounded-full text-ink-2 transition", listening && "bg-orange/15 text-orange")}
        >
          {listening ? <Square size={16} fill="currentColor" /> : <Mic size={20} />}
        </button>
        <AnimatePresence mode="popLayout" initial={false}>
          {text.trim() || files.length ? (
            <motion.button
              key="send"
              type="button"
              aria-label={t("Send")}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={submit}
              disabled={!canSend}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-solid text-solid-fg transition-opacity disabled:opacity-40"
            >
              <ArrowUp size={20} strokeWidth={2.4} />
            </motion.button>
          ) : showVoice ? (
            <motion.button
              key="voice"
              type="button"
              aria-label={t("Talk it through")}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              onClick={() => set({ voice: true })}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-solid text-solid-fg"
            >
              <AudioLines size={20} />
            </motion.button>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
