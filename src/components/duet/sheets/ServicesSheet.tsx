"use client";

import { ExternalLink, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/client/i18n";
import { api, useDuet } from "@/lib/client/store";
import { cn } from "@/lib/utils";
import { Drawer, Group } from "../Drawer";

interface Service {
  id: string;
  name: string;
  what: string;
  ready: boolean;
  hint?: string;
  detail?: string;
  editable: "sheet" | "inline" | "env" | "none";
  env?: string;
  links: { label: string; url: string }[];
}

/** Every outside service Duet can use, whether it's set up, and where to get its key. */
export function ServicesSheet({ open }: { open: boolean }) {
  const set = useDuet((s) => s.set);
  const t = useT();
  const [list, setList] = useState<Service[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    void api.call<{ services: Service[] }>("GET", "services").then((r) => live && setList(r.services), () => live && setList([]));
    return () => {
      live = false;
    };
  }, [open]);

  const save = async (id: string, value: string) => {
    setBusy(id);
    try {
      const r = await api.put<{ services: Service[] }>("keys", { [id]: value });
      setList(r.services);
      setDrafts((d) => ({ ...d, [id]: "" }));
      toast(value ? t("Saved") : t("Removed"));
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(null);
  };

  return (
    <Drawer open={open} onClose={() => set({ sheet: null })} onBack={() => set({ sheet: "profile" })} title={t("Keys & services")} full>
      <p className="px-1 pt-1 text-[14px] leading-snug text-ink-2">
        {t("Duet runs on its own with sample data. Each key below turns on a real piece. Keys stay on the server and are never shown again.")}
      </p>
      {!list && (
        <div className="mt-6 flex flex-col gap-3" aria-busy>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-chrome" />
          ))}
        </div>
      )}
      {list?.map((s) => (
        <Group key={s.id}>
          <div className="p-3.5">
            <div className="flex items-center gap-2.5">
              <span className={cn("size-2.5 shrink-0 rounded-full", s.ready ? "bg-ready" : "bg-ink-3/50")} />
              <span className="flex-1 text-[15.5px] font-medium">{s.name}</span>
              <span className={cn("text-[12.5px]", s.ready ? "text-ready" : "text-ink-3")}>
                {s.detail ?? (s.ready ? `${t("On")}${s.hint ? ` · ${s.hint}` : ""}` : t("Not set up"))}
              </span>
            </div>
            <p className="mt-1 pl-5 text-[13.5px] leading-snug text-ink-2">{s.what}</p>
            {s.links.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-5">
                {s.links.map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13.5px] font-medium text-link">
                    {l.label}
                    <ExternalLink size={12} />
                  </a>
                ))}
              </div>
            )}
            {s.editable === "inline" && (
              <form
                className="mt-3 flex items-center gap-2 pl-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (drafts[s.id]?.trim()) void save(s.id, drafts[s.id].trim());
                }}
              >
                <KeyRound size={16} className="shrink-0 text-ink-3" />
                <input
                  type="password"
                  autoComplete="off"
                  aria-label={t("{name} API key", { name: s.name })}
                  value={drafts[s.id] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [s.id]: e.target.value }))}
                  placeholder={s.ready ? t("Saved key {hint}", { hint: s.hint ?? "" }) : t("Paste API key")}
                  className="min-w-0 flex-1 rounded-xl bg-black/[0.05] px-3 py-2 font-mono text-[13.5px] outline-none placeholder:font-sans dark:bg-white/10"
                />
                {drafts[s.id]?.trim() ? (
                  <button type="submit" disabled={busy === s.id} className="rounded-xl bg-solid px-3 py-2 text-[13.5px] font-semibold text-solid-fg disabled:opacity-50">
                    {busy === s.id ? t("Saving…") : t("Save")}
                  </button>
                ) : (
                  s.ready && (
                    <button type="button" onClick={() => void save(s.id, "")} className="px-1 text-[13px] font-medium text-[#D23B2A]">
                      {t("Remove")}
                    </button>
                  )
                )}
              </form>
            )}
            {s.editable === "sheet" && (
              <button type="button" onClick={() => set({ sheet: "model" })} className="mt-2 pl-5 text-[13.5px] font-medium text-link">
                {s.ready ? t("Change model or key") : t("Add a key")}
              </button>
            )}
            {s.editable === "env" && !s.ready && (
              <p className="mt-2 pl-5 text-[12.5px] leading-snug text-ink-3">
                {t("Set {env} in {file} on the server and restart.")
                  .split(/(\{env\}|\{file\})/)
                  .map((part, i) =>
                    part === "{env}" || part === "{file}" ? (
                      <code key={i} className="font-mono">
                        {part === "{env}" ? s.env : ".env.local"}
                      </code>
                    ) : (
                      part
                    ),
                  )}
              </p>
            )}
          </div>
        </Group>
      ))}
    </Drawer>
  );
}
