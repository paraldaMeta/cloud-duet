"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Check, ChevronRight, Copy, CornerDownRight, FileSignature, Pencil, ShieldCheck, Trash2, Wrench, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { t as tt, useLang, useT } from "@/lib/client/i18n";
import { api, send, useDuet } from "@/lib/client/store";
import { locale } from "@/lib/i18n";
import type { Approval } from "@/lib/shared/types";
import { cn } from "@/lib/utils";
import { AppLogo, GmailLogo } from "../Logos";
import { useNow } from "../hooks";

function Buttons({ a, approveLabel, onApprove }: { a: Approval; approveLabel: string; onApprove?: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState<"yes" | "no" | null>(null);
  const decide = async (approve: boolean) => {
    setBusy(approve ? "yes" : "no");
    try {
      await api.post(`approvals/${a.id}`, { approve });
      window.dispatchEvent(new CustomEvent("duet:sent"));
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  if (a.status !== "pending") {
    const done = t({ email: "Sent", payment: "Paid", sign: "Sent for signature", delete: "Done", action: "Approved" }[a.kind]);
    return (
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 pt-1 text-[15px] font-medium">
        {a.status === "approved" ? (
          <>
            <span className="grid size-5 place-items-center rounded-full bg-ready text-white">
              <Check size={13} strokeWidth={3} />
            </span>
            <span className="text-ready">{done}</span>
          </>
        ) : (
          <span className="text-ink-3">{t("Not now")}</span>
        )}
      </motion.div>
    );
  }
  return (
    <div className="flex gap-2.5 pt-1">
      <button type="button" disabled={!!busy} onClick={() => decide(false)} className="h-11 flex-1 rounded-full border border-hair text-[16px] font-medium transition active:scale-[0.98] disabled:opacity-50">
        {t("Not now")}
      </button>
      <button
        type="button"
        disabled={!!busy}
        onClick={() => (onApprove ? onApprove() : decide(true))}
        className="h-11 flex-1 rounded-full bg-solid text-[16px] font-medium text-solid-fg transition active:scale-[0.98] disabled:opacity-60"
      >
        {busy === "yes" ? "…" : approveLabel}
      </button>
    </div>
  );
}

function Shell({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <div id={id} className={cn("w-full max-w-[400px] space-y-3 rounded-[22px] border border-hair bg-chrome p-4", className)}>
      {children}
    </div>
  );
}

function HighlightedBody({ body, highlight }: { body: string; highlight?: Approval["highlight"] }) {
  const now = useNow(1000);
  const fresh = highlight && now - Date.parse(highlight.at) < 5000 && body.includes(highlight.text);
  if (!fresh) return <p className="whitespace-pre-wrap text-[17px] leading-[23px]">{body}</p>;
  const i = body.indexOf(highlight!.text);
  return (
    <p className="whitespace-pre-wrap text-[17px] leading-[23px]">
      {body.slice(0, i)}
      <span key={highlight!.at} className="glow">
        {highlight!.text}
      </span>
      {body.slice(i + highlight!.text.length)}
    </p>
  );
}

function EmailCard({ a }: { a: Approval }) {
  const t = useT();
  const e = a.email!;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(e.body);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (a.highlight) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [a.highlight]);
  return (
    <div ref={ref} className="w-full max-w-[400px]">
      <Shell>
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg border border-hair bg-white">
            {e.app === "gmail" ? <GmailLogo size={16} /> : <AppLogo id={e.app} size={16} />}
          </span>
          <span className="min-w-0 truncate text-[15px] font-semibold">
            {e.app === "slack" ? t("Slack message") : t("Email")}
            {e.from && <span className="ml-1.5 text-[13px] font-normal text-ink-2">{t("from {from}", { from: e.from })}</span>}
          </span>
          <span className="flex-1" />
          <button type="button" aria-label={t("Copy")} className="grid size-8 place-items-center rounded-full text-ink-2 hover:bg-black/5" onClick={() => navigator.clipboard?.writeText(e.body).then(() => toast(tt("Copied")))}>
            <Copy size={17} />
          </button>
          {a.status === "pending" && (
            <button
              type="button"
              aria-label={t("Edit")}
              className={cn("grid size-8 place-items-center rounded-full text-ink-2 hover:bg-black/5", editing && "bg-black/5 text-ink")}
              onClick={() => {
                setDraft(e.body);
                setEditing((v) => !v);
              }}
            >
              <Pencil size={16} />
            </button>
          )}
        </div>
        <div className="space-y-1.5 text-[15px] text-ink-2">
          <div className="flex gap-1.5">
            <span>{t("To:")}</span>
            <span className="truncate text-ink">{e.to}</span>
          </div>
          <div className="h-px bg-hair" />
          <div className="flex gap-1.5">
            <span>{t("Subject:")}</span>
            <span className="truncate text-ink">{e.subject}</span>
          </div>
          <div className="h-px bg-hair" />
        </div>
        {editing ? (
          <div className="space-y-2">
            <textarea value={draft} onChange={(ev) => setDraft(ev.target.value)} rows={7} className="w-full resize-none rounded-xl border border-hair bg-transparent p-2.5 text-[16px] leading-[22px] outline-none focus:border-orange" />
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-full px-3 py-1.5 text-[14px] text-ink-2" onClick={() => setEditing(false)}>
                {t("Cancel")}
              </button>
              <button
                type="button"
                className="rounded-full bg-solid px-4 py-1.5 text-[14px] font-medium text-solid-fg"
                onClick={() =>
                  api.patch(`approvals/${a.id}`, { body: draft }).then(
                    () => setEditing(false),
                    (err) => toast((err as Error).message),
                  )
                }
              >
                {t("Save")}
              </button>
            </div>
          </div>
        ) : (
          <HighlightedBody body={e.body} highlight={a.highlight} />
        )}
        {!editing && <Buttons a={a} approveLabel={t("Send")} />}
      </Shell>
      {a.status === "pending" && (
        <button type="button" onClick={() => send(tt("Shorten it"), { channelId: a.channelId, taskId: undefined })} className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-hair px-3 py-1.5 text-[14px] text-ink">
          <CornerDownRight size={14} className="text-ink-2" /> {t("Shorten")}
        </button>
      )}
    </div>
  );
}

function expiresIn(iso: string, now: number, t: ReturnType<typeof useT>) {
  const m = Math.max(0, Math.ceil((Date.parse(iso) - now) / 60000));
  return m === 0 ? t("Expired") : t("Expires in {m} min", { m });
}

function PaymentCard({ a }: { a: Approval }) {
  const t = useT();
  const lang = useLang();
  const p = a.payment!;
  const now = useNow(10_000);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const amount = p.amount.toLocaleString(locale(lang), { style: "currency", currency: p.currency });
  const decide = async (approve: boolean) => {
    setBusy(true);
    await api.post(`approvals/${a.id}`, { approve }).catch((e) => toast((e as Error).message));
    setBusy(false);
    setOpen(false);
  };
  return (
    <Shell>
      <div className="flex items-baseline justify-between">
        <span className="text-[28px] font-semibold tracking-tight">{amount}</span>
        {a.status === "pending" && <span className="text-[13px] text-ink-2">{expiresIn(p.expiresAt, now, t)}</span>}
      </div>
      <div>
        <p className="text-[16px] font-medium">{p.merchant}</p>
        <p className="text-[14px] text-ink-2">{p.description}</p>
      </div>
      <button type="button" className="flex w-full items-center justify-between rounded-xl bg-black/[0.04] px-3 py-2.5 text-left dark:bg-white/5">
        <span>
          <span className="block text-[12px] text-ink-2">{t("Order summary")}</span>
          <span className="text-[15px]">{p.item}</span>
        </span>
        <ChevronRight size={18} className="text-ink-3" />
      </button>
      {a.status === "pending" ? (
        <button type="button" onClick={() => setOpen(true)} className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-[#00D66F] text-[16px] font-semibold text-[#011E0F] active:scale-[0.98]">
          {t("Approve in Link")} <ArrowUpRight size={18} />
        </button>
      ) : (
        <Buttons a={a} approveLabel={t("Approve")} />
      )}
      {a.status === "pending" && (
        <button type="button" onClick={() => decide(false)} className="w-full text-center text-[14px] text-ink-2">
          {t("Not now")}
        </button>
      )}
      <p className="text-center text-[11px] text-ink-3">{t("Test mode · nothing is charged")}</p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[400px] rounded-[26px] border-hair bg-chrome p-5" showCloseButton={false}>
          <DialogTitle className="sr-only">{t("Spend request")}</DialogTitle>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[15px] font-semibold">
              <AppLogo id="link" size={22} /> Link
            </span>
            <button type="button" aria-label={t("Close")} onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-full bg-black/5">
              <X size={16} />
            </button>
          </div>
          <div className="space-y-1 pt-2">
            <p className="text-[15px] text-ink-2">{t("Cloud Duet is requesting to spend")}</p>
            <p className="text-[34px] font-semibold tracking-tight">{amount}</p>
            <p className="text-[13px] text-ink-2">{expiresIn(p.expiresAt, now, t)}</p>
          </div>
          <div className="space-y-0 divide-y divide-hair rounded-2xl border border-hair">
            <div className="flex items-center justify-between px-3.5 py-3">
              <span className="text-[15px]">{p.merchant}</span>
              <button type="button" className="text-[14px] text-link" onClick={() => toast(tt("Merchant verified in test mode."))}>
                {t("Inspect")}
              </button>
            </div>
            <div className="px-3.5 py-3 text-[14px] text-ink-2">{p.description}</div>
            <div className="flex items-center gap-2 px-3.5 py-3 text-[15px]">
              <span className="rounded bg-[#1A1F71] px-1.5 text-[11px] font-bold text-white">VISA</span> {t("One-time card")} ·••• 4242
            </div>
          </div>
          <p className="flex gap-2 text-[12px] leading-snug text-ink-2">
            <ShieldCheck size={16} className="mt-px shrink-0" />
            {t("By approving this hold, you take responsibility for any agent purchases. Your real payment details are never shared. Test mode: nothing is charged.")}
          </p>
          <div className="flex gap-2.5">
            <button type="button" disabled={busy} onClick={() => decide(false)} className="h-12 flex-1 rounded-full border border-hair text-[16px] font-medium">
              {t("Decline")}
            </button>
            <button type="button" disabled={busy} onClick={() => decide(true)} className="h-12 flex-1 rounded-full bg-solid text-[16px] font-medium text-solid-fg">
              {t("Approve")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}

function SignCard({ a }: { a: Approval }) {
  const t = useT();
  const s = a.sign!;
  return (
    <Shell>
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-[#FFCC22] text-[#1A1A1A]">
          <FileSignature size={16} />
        </span>
        <span className="text-[15px] font-semibold">{t("Signature request")}</span>
      </div>
      <div className="space-y-1.5 text-[15px]">
        <p className="font-medium">{s.document}</p>
        <p className="text-ink-2">{t("To: {list}", { list: s.recipients.join(", ") })}</p>
        <p className="text-ink-2">{t("Via {via}", { via: s.via })}</p>
      </div>
      <Buttons a={a} approveLabel={t("Approve")} />
    </Shell>
  );
}

function DeleteCard({ a }: { a: Approval }) {
  const t = useT();
  const d = a.delete!;
  const [more, setMore] = useState(false);
  const shown = more ? d.items : d.items.slice(0, 4);
  return (
    <Shell>
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-[#FBE9E4] text-[#B4462E]">
          <Trash2 size={16} />
        </span>
        <span className="text-[15px] font-semibold">{t("Delete")}</span>
      </div>
      <p className="text-[15px]">{d.what}</p>
      <ul className="space-y-1 text-[14px] text-ink-2">
        {shown.map((it) => (
          <li key={it} className="truncate">
            · {it}
          </li>
        ))}
      </ul>
      {d.items.length > 4 && (
        <button type="button" onClick={() => setMore((m) => !m)} className="text-[14px] text-link">
          {more ? t("Show less") : t("Show all {n}", { n: d.items.length })}
        </button>
      )}
      <Buttons a={a} approveLabel={t("Approve")} />
    </Shell>
  );
}

function ActionCard({ a }: { a: Approval }) {
  const t = useT();
  const x = a.action!;
  return (
    <Shell>
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-black/5">
          <Wrench size={15} />
        </span>
        <span className="text-[15px] font-semibold">{x.tool}</span>
      </div>
      <dl className="space-y-1 text-[14px]">
        {x.args.map((f) => (
          <div key={f.name} className="flex gap-2">
            <dt className="text-ink-2">{f.name}:</dt>
            <dd className="truncate">{f.value}</dd>
          </div>
        ))}
      </dl>
      <Buttons a={a} approveLabel={t("Approve")} />
    </Shell>
  );
}

export function ApprovalCard({ approvalId }: { approvalId: string }) {
  const a = useDuet((s) => s.data?.approvals.find((x) => x.id === approvalId));
  if (!a) return null;
  return (
    <AnimatePresence initial={false}>
      {a.kind === "email" && <EmailCard a={a} />}
      {a.kind === "payment" && <PaymentCard a={a} />}
      {a.kind === "sign" && <SignCard a={a} />}
      {a.kind === "delete" && <DeleteCard a={a} />}
      {a.kind === "action" && <ActionCard a={a} />}
    </AnimatePresence>
  );
}
