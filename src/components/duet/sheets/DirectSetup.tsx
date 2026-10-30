"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/client/i18n";
import { api } from "@/lib/client/store";
import type { DirectApp, DirectForm } from "@/lib/shared/types";
import { Group } from "../Drawer";

const input =
  "h-11 w-full min-w-0 rounded-xl border border-hair bg-paper px-3.5 text-[15px] outline-none focus:border-ink placeholder:text-ink-3";

/** The form that connects a mailbox, Feishu, DingTalk or WeCom. Saving tests the connection first. */
export function DirectSetup({ id, name, onDone }: { id: DirectApp; name: string; onDone?: () => void }) {
  const t = useT();
  const [form, setForm] = useState<DirectForm | null>(null);
  const [failed, setFailed] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api.call<DirectForm>("GET", `direct/${id}`).then(
      (f) => {
        if (!live) return;
        setForm(f);
        setValues(f.values);
      },
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [id]);

  if (failed) return <p className="mt-6 text-center text-[14px] text-ink-2">{t("Couldn't load the setup form. Try again in a moment.")}</p>;
  if (!form) return <div className="mt-6 h-64 animate-pulse rounded-2xl bg-chrome" aria-busy />;

  const visible = form.fields.filter((f) => !f.showIf || (values[f.showIf.key] ?? "") === f.showIf.value);
  const missing = visible.some((f) => !f.optional && !(values[f.key] ?? "").trim() && !form.saved[f.key]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await api.put<DirectForm>(`direct/${id}`, values);
      setForm(next);
      setValues(next.values);
      toast(t("{app} connected", { app: name }));
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <form
      className="mt-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy && !missing) void submit();
      }}
    >
      <Group>
        <div className="flex flex-col gap-3.5 p-3.5">
          {visible.map((f) => (
            <label key={f.key} className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-ink-2">
                {f.label}
                {f.optional && <span className="font-normal text-ink-3"> · {t("optional")}</span>}
              </span>
              {f.type === "select" ? (
                <select value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} className={input}>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type === "password" || (f.type === "url" && form.saved[f.key]) ? "password" : f.type}
                  inputMode={f.type === "number" ? "numeric" : undefined}
                  autoComplete={f.type === "password" ? "new-password" : "off"}
                  spellCheck={false}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={form.saved[f.key] ? t("Saved {hint} · leave blank to keep", { hint: form.saved[f.key] }) : f.placeholder}
                  className={`${input} ${f.type === "password" || f.type === "url" ? "font-mono text-[14px] placeholder:font-sans" : ""}`}
                />
              )}
              {f.help && <span className="text-[12.5px] leading-snug text-ink-3">{f.help}</span>}
            </label>
          ))}
        </div>
      </Group>
      {form.links.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 px-1">
          {form.links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13.5px] font-medium text-link">
              {l.label}
              <ExternalLink size={12} />
            </a>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 px-1 text-[13.5px] leading-snug text-[#C2412D]">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || missing}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-solid text-[16px] font-semibold text-solid-fg transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {busy && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
        {busy ? t("Testing the connection…") : form.configured ? t("Save changes") : t("Connect {app}", { app: name })}
      </button>
      <p className="mt-3 text-center text-[12.5px] text-ink-3">{t("Saved on this server only, never shown again. Cloud Duet asks before sending anything.")}</p>
    </form>
  );
}
