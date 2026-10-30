// Public links to artifacts. A token maps to one account's artifact, so the
// link opens without signing in and stops working once it's revoked.
import path from "node:path";
import { randomBytes } from "node:crypto";
import { DATA_DIR } from "./context";
import { readJson, writeJson } from "./fsx";

type Shares = Record<string, { uid: string; artifactId: string }>;

const file = () => path.join(/*turbopackIgnore: true*/ DATA_DIR, "shares.json");

function load(): Shares {
  return readJson<Shares>(file(), {});
}

function save(s: Shares) {
  writeJson(file(), s);
}

export function shareToken(uid: string, artifactId: string): string {
  const s = load();
  const existing = Object.entries(s).find(([, v]) => v.uid === uid && v.artifactId === artifactId);
  if (existing) return existing[0];
  const token = randomBytes(18).toString("base64url");
  s[token] = { uid, artifactId };
  save(s);
  return token;
}

export function revokeShares(uid: string, artifactId: string) {
  const s = load();
  for (const [k, v] of Object.entries(s)) if (v.uid === uid && v.artifactId === artifactId) delete s[k];
  save(s);
}

export function resolveShare(token: string) {
  const s = load();
  return Object.hasOwn(s, token) && /^[A-Za-z0-9_-]{24}$/.test(token) ? s[token] : undefined;
}
