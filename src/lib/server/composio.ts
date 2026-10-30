// Real apps through Composio: one key, OAuth handled by Composio. Each Duet
// account is its own Composio user. The model reaches connected apps through
// two tools (find an action, then run it), which keeps its tool list short; any
// action that writes or sends goes through an approval card first.
import { Composio } from "@composio/core";
import type { Connector } from "@/lib/shared/types";
import { currentUserId } from "./context";
import { getKey } from "./keys";
import { state, upsert } from "./store";
import { tr } from "./i18n";

/** Duet's connector ids → Composio toolkit slugs. Link has no Composio toolkit. */
export const TOOLKITS: Record<string, string> = {
  gmail: "gmail", gcal: "googlecalendar", gdrive: "googledrive", slack: "slack", stripe: "stripe",
  quickbooks: "quickbooks", gusto: "gusto", docusign: "docusign", hubspot: "hubspot", github: "github", linkedin: "linkedin",
};
const CONNECTOR_FOR = Object.fromEntries(Object.entries(TOOLKITS).map(([k, v]) => [v, k]));

const g = globalThis as unknown as { __duetComposio?: Map<string, Composio> };
const clients: Map<string, Composio> = (g.__duetComposio ??= new Map());

export function composioReady() {
  return !!getKey("composio");
}

function client(): Composio {
  const key = getKey("composio");
  if (!key) throw new Error(tr("Add a Composio API key in Profile → Keys & services to connect real apps."));
  let c = clients.get(key);
  if (!c) {
    c = new Composio({ apiKey: key });
    clients.set(key, c);
  }
  return c;
}

const userId = () => `duet-${currentUserId()}`;

async function session(toolkits?: string[]) {
  return client().create(userId(), { ...(toolkits ? { toolkits } : {}), manageConnections: false });
}

/** Apps connected for real through Composio, as Duet connector ids. */
export function realApps(): string[] {
  return state().connectors.filter((c) => c.connected && c.real && TOOLKITS[c.id]).map((c) => c.id);
}

export async function connectUrl(connectorId: string, callbackUrl: string): Promise<string> {
  const slug = TOOLKITS[connectorId];
  if (!slug) throw new Error(tr("This app can't be connected through Composio."));
  const req = await (await session([slug])).authorize(slug, { callbackUrl });
  if (!req.redirectUrl) throw new Error(tr("Composio didn't return a sign-in link for {app}.", { app: slug }));
  return req.redirectUrl;
}

/** Pulls connection state from Composio into the connectors list. */
export async function syncConnections(): Promise<string[]> {
  if (!composioReady()) return [];
  const slugs = Object.values(TOOLKITS);
  const res = await (await session(slugs)).toolkits({ toolkits: slugs, limit: slugs.length });
  const active: string[] = [];
  for (const t of res.items) {
    const id = CONNECTOR_FOR[t.slug];
    const c = id && state().connectors.find((x) => x.id === id);
    if (!c) continue;
    const on = !!t.connection?.isActive;
    if (on) active.push(id);
    if (on !== !!c.real || (on && !c.connected)) {
      upsert<Connector>("connectors", { ...c, real: on, connected: on ? true : c.real ? false : c.connected, accounts: on ? [state().user.email] : c.accounts });
    }
  }
  return active;
}

export async function disconnect(connectorId: string) {
  const slug = TOOLKITS[connectorId];
  if (!slug || !composioReady()) return;
  const c = client();
  const list = await c.connectedAccounts.list({ userIds: [userId()], toolkitSlugs: [slug] });
  for (const a of list.items) await c.connectedAccounts.delete(a.id);
}

/** Finds the actions that fit a use case, with their argument schemas. */
export async function searchActions(query: string, connectorIds: string[]) {
  const toolkits = connectorIds.map((id) => TOOLKITS[id]).filter(Boolean);
  const res = await (await session(toolkits)).search({ query, toolkits });
  if (!res.success) return { error: res.error ?? "Search failed" };
  const slugs = new Set(res.results.flatMap((r) => [...r.primaryToolSlugs, ...r.relatedToolSlugs.slice(0, 2)]));
  return {
    guidance: res.results.slice(0, 3).map((r) => ({ use_case: r.useCase, tools: r.primaryToolSlugs, how: r.executionGuidance, pitfalls: r.knownPitfalls?.slice(0, 3) })),
    tools: [...slugs].slice(0, 8).map((s) => {
      const t = res.toolSchemas[s];
      return { slug: s, app: t?.toolkit, description: t?.description?.slice(0, 300), input_schema: t?.inputSchema };
    }),
  };
}

export async function runAction(slug: string, args: Record<string, unknown>) {
  const res = await (await session()).execute(slug, args);
  return { ok: res.resultType === "completed", data: res.data, error: res.error };
}

/** Reads are safe to run straight away; anything else needs the person's OK. */
export function isReadAction(slug: string) {
  const s = slug.toLowerCase();
  return /(^|_)(get|list|fetch|search|find|read|retrieve|view|query)(_|$)/.test(s) && !/(^|_)(send|create|delete|update|post|reply|forward|move|trash|archive|insert|patch|remove|add|invite|share|submit|pay|transfer|run)(_|$)/.test(s);
}

/** Sends a Gmail message for an approved draft. */
export async function sendGmail(email: { to: string; cc?: string; subject: string; body: string }) {
  return runAction("GMAIL_SEND_EMAIL", {
    recipient_email: email.to, subject: email.subject, body: email.body,
    ...(email.cc ? { cc: email.cc.split(/[,;]\s*/).filter(Boolean) } : {}),
  });
}
