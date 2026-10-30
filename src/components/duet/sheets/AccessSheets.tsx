"use client";

import { motion } from "motion/react";
import { Check, CreditCard, FolderClosed, Mail, MessagesSquare, CalendarDays, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/client/i18n";
import { api, useDuet } from "@/lib/client/store";
import type { Connector } from "@/lib/shared/types";
import { cn } from "@/lib/utils";
import { AppLogo } from "../Logos";
import { Mascot } from "../Mascot";
import { Drawer, Group, Row, Segment } from "../Drawer";

const CATEGORIES: { id: Connector["category"]; label: string; Icon: typeof Mail; off: string; on: string }[] = [
  { id: "files", label: "Files and docs", Icon: FolderClosed, off: "Can't read your files yet", on: "Reads your {apps}" },
  { id: "mail", label: "Mail", Icon: Mail, off: "Can't see your mail yet", on: "Reads your {apps}" },
  { id: "calendar", label: "Calendar", Icon: CalendarDays, off: "Can't see your schedule yet", on: "Sees your {apps}" },
  { id: "chat", label: "Team chat", Icon: MessagesSquare, off: "Can't see your team chat yet", on: "Reads your {apps}" },
  { id: "payments", label: "Payments", Icon: CreditCard, off: "Can't make purchases yet", on: "Pays with {apps}" },
];

/** Tapping the mascot: what Cloud Duet can reach right now. */
export function AssistantSheet({ open }: { open: boolean }) {
  const { data, set } = useDuet();
  const t = useT();
  const [more, setMore] = useState(false);
  const [q, setQ] = useState("");
  if (!data) return null;
  const close = () => {
    setMore(false);
    set({ sheet: null });
  };
  const byCat = (c: Connector["category"]) => data.connectors.filter((x) => x.category === c);
  const others = data.connectors.filter((c) => c.category === "other" && c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <Drawer open={open} onClose={close} onBack={more ? () => setMore(false) : undefined} title={more ? t("More apps") : undefined} full={more}>
      {!more ? (
        <>
          <div className="flex flex-col items-center pb-2 pt-1 text-center">
            <div className="chrome-shadow grid size-20 place-items-center rounded-full bg-chrome">
              <Mascot size={64} mood="idle" />
            </div>
            <h2 className="mt-3 font-serif text-[26px] font-semibold">Cloud Duet</h2>
            <p className="mt-0.5 text-[14.5px] text-ink-2">{t("It asks before sending, paying, signing or deleting anything.")}</p>
          </div>
          <Group title={t("What Cloud Duet has access to")}>
            {CATEGORIES.map(({ id, label, Icon, off, on: reads }) => {
              const list = byCat(id);
              const on = list.filter((c) => c.connected);
              return (
                <Row
                  key={id}
                  icon={on[0] ? <AppLogo id={on[0].id} size={24} /> : <Icon size={19} className="text-ink-2" />}
                  label={t(label)}
                  detail={on.length ? t(reads, { apps: on.map((c) => c.name).join(t(" and ")) }) : t(off)}
                  chevron={false}
                  right={
                    on.length ? (
                      <span className="grid size-7 place-items-center rounded-full bg-ready/12 text-ready">
                        <Check size={15} strokeWidth={2.6} />
                      </span>
                    ) : (
                      <span className="grid size-7 place-items-center rounded-full border-[1.5px] border-dashed border-ink-3 text-ink-2">
                        <Plus size={15} />
                      </span>
                    )
                  }
                  onClick={() => set({ sheet: { connector: (on[0] ?? list[0]).id } })}
                />
              );
            })}
          </Group>
          <Group>
            <Row icon={<Plus size={19} className="text-ink-2" />} label={t("More apps")} detail="QuickBooks, Gusto, Docusign, HubSpot…" onClick={() => setMore(true)} />
          </Group>
          <p className="mt-4 px-3 text-center text-[12.5px] text-ink-3">{t("Your tools, projects, chats, memory and skills come with your Cloud Duet account.")}</p>
        </>
      ) : (
        <>
          <label className="mt-1 flex items-center gap-2 rounded-xl bg-black/[0.05] px-3 py-2 dark:bg-white/10">
            <Search size={16} className="text-ink-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search apps")} className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3" />
          </label>
          <Group>
            {others.map((c) => (
              <Row
                key={c.id}
                icon={<AppLogo id={c.id} size={26} />}
                label={c.name}
                detail={c.description}
                right={c.connected ? <span className="text-[13px] font-medium text-ready">{t("Connected")}</span> : <span className="rounded-full bg-black/[0.06] px-3 py-1 text-[13px] font-medium dark:bg-white/10">{t("Connect")}</span>}
                chevron={false}
                onClick={() => set({ sheet: { connector: c.id } })}
              />
            ))}
            {others.length === 0 && <p className="p-4 text-center text-[14px] text-ink-2">{t("No apps match “{q}”.", { q })}</p>}
          </Group>
        </>
      )}
    </Drawer>
  );
}

/** One connector: accounts, per-tool Ask/Always policy, connect/disconnect. */
export function ConnectorSheet({ id }: { id: string | null }) {
  const { data, set } = useDuet();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [account, setAccount] = useState("");
  const c = data?.connectors.find((x) => x.id === id);
  const close = () => {
    setAdding(false);
    setAccount("");
    set({ sheet: null });
  };
  const addAccount = async (email?: string) => {
    if (!c) return;
    setBusy(true);
    try {
      const r = await api.post<{ url?: string; ask?: boolean; sample?: boolean }>(`connectors/${c.id}/connect`, { add: true, account: email });
      if (r.url) {
        window.location.assign(r.url);
        return;
      }
      if (r.ask) setAdding(true);
      else {
        toast(t("Added {email} to {app} (sample data)", { email: email ?? "", app: c.name }));
        setAdding(false);
        setAccount("");
      }
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  };
  const connect = async (connected: boolean) => {
    if (!c) return;
    setBusy(true);
    try {
      if (connected) {
        const r = await api.post<{ url?: string; sample?: boolean }>(`connectors/${c.id}/connect`);
        if (r.url) {
          window.location.assign(r.url);
          return;
        }
        toast(t("{app} connected to sample data. Add a Composio key in Keys & services to use your real account.", { app: c.name }));
      } else {
        await api.patch(`connectors/${c.id}`, { connected: false });
        toast(t("{app} disconnected", { app: c.name }));
      }
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <Drawer open={!!c} onClose={close} onBack={() => set({ sheet: "claude" })} title={c?.name} full>
      {c && (
        <>
          <div className="flex flex-col items-center pt-2 text-center">
            <div className="relative">
              <div className="chrome-shadow grid size-16 place-items-center rounded-2xl bg-chrome">
                <AppLogo id={c.id} size={36} />
              </div>
              {c.connected && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 18 }} className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full border-2 border-paper bg-ready text-white">
                  <Check size={13} strokeWidth={3} />
                </motion.span>
              )}
            </div>
            <p className="mt-3 max-w-[300px] text-[14.5px] text-ink-2">{c.description}</p>
            {c.connected && (
              <span className={cn("mt-2 rounded-full px-2.5 py-0.5 text-[12px] font-medium", c.real ? "bg-ready/15 text-ready" : "bg-black/[0.06] text-ink-2 dark:bg-white/10")}>
                {c.real ? t("Your real account") : t("Sample data")}
              </span>
            )}
          </div>
          {c.connected ? (
            <>
              <Group title={t("Accounts")}>
                {c.accounts.map((a) => (
                  <Row key={a} icon={<AppLogo id={c.id} size={20} />} label={a} />
                ))}
                {adding ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void addAccount(account);
                    }}
                    className="flex items-center gap-2 px-3 py-2"
                  >
                    <input
                      autoFocus
                      type="email"
                      value={account}
                      onChange={(e) => setAccount(e.target.value)}
                      placeholder="name@example.com"
                      className="h-10 min-w-0 flex-1 rounded-full border border-hair bg-paper px-4 text-[15px] outline-none focus:border-ink"
                    />
                    <button type="submit" disabled={busy || !account.trim()} className="h-10 rounded-full bg-solid px-4 text-[14px] font-medium text-solid-fg disabled:opacity-40">
                      {t("Add")}
                    </button>
                  </form>
                ) : (
                  <Row icon={<Plus size={18} className="text-ink-2" />} label={t("Add another account")} onClick={() => void addAccount()} />
                )}
              </Group>
              <Group
                title={t("What Cloud Duet can do")}
                note={t("Ask means Cloud Duet shows you a card to approve first. Read-only tools run on their own.")}
              >
                <div className="flex items-center justify-end gap-2 px-3 py-2">
                  <button type="button" onClick={() => api.patch(`connectors/${c.id}`, { all: "ask" })} className="text-[13px] font-medium text-link">
                    {t("Ask for everything")}
                  </button>
                  <span className="text-ink-3">·</span>
                  <button type="button" onClick={() => api.patch(`connectors/${c.id}`, { all: "default" })} className="text-[13px] font-medium text-link">
                    {t("Reset")}
                  </button>
                </div>
                {[...c.tools].sort((a, b) => Number(a.write) - Number(b.write)).map((tool, i, list) => (
                  <Row
                    key={tool.slug}
                    label={
                      <>
                        {(i === 0 || list[i - 1].write !== tool.write) && (
                          <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-3">{tool.write ? t("Write") : t("Read")}</span>
                        )}
                        {tool.name}
                      </>
                    }
                    detail={tool.write ? t("Sends, creates or changes things") : t("Only looks")}
                    right={
                      <Segment
                        id={tool.slug}
                        value={tool.mode}
                        options={[
                          { v: "ask", label: t("Ask") },
                          { v: "always", label: t("Always") },
                        ]}
                        onChange={(mode) => api.patch(`connectors/${c.id}`, { tool: tool.slug, mode })}
                      />
                    }
                  />
                ))}
              </Group>
              <Group>
                <Row label={t("Disconnect")} danger onClick={() => connect(false)} chevron={false} />
              </Group>
            </>
          ) : (
            <div className="mt-6">
              <button
                type="button"
                disabled={busy}
                onClick={() => connect(true)}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-solid text-[16px] font-semibold text-solid-fg transition-transform active:scale-[0.98] disabled:opacity-70"
              >
                {busy ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
                {busy ? t("Connecting…") : t("Connect {app}", { app: c.name })}
              </button>
              <p className="mt-3 text-center text-[12.5px] text-ink-3">{t("In this demo, connecting uses sample data. No real account is touched.")}</p>
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}
