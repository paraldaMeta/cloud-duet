// Files people attach in chat. Stored per account under data/users/<id>/files/,
// served back only to that account, and read by the model when it replies.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Attachment } from "@/lib/shared/types";
import { userDir } from "./context";
import { tr } from "./i18n";

export const MAX_FILE_BYTES = 15 * 1024 * 1024;

const dir = () => {
  const d = path.join(/*turbopackIgnore: true*/ userDir(), "files");
  fs.mkdirSync(d, { recursive: true });
  return d;
};
const safe = (fileId: string) => fileId.replace(/[^a-zA-Z0-9-]/g, "");

export function saveFile(name: string, type: string, data: Buffer): Attachment {
  if (data.length > MAX_FILE_BYTES) throw new Error(tr("That file is over 15 MB."));
  const meta: Attachment = {
    id: randomUUID(),
    name: name.replace(/[\\/\0]/g, "_").slice(0, 160) || "file",
    type: type || "application/octet-stream",
    size: data.length,
  };
  fs.writeFileSync(path.join(dir(), meta.id), data, { mode: 0o600 });
  fs.writeFileSync(path.join(dir(), `${meta.id}.json`), JSON.stringify(meta), { mode: 0o600 });
  return meta;
}

export function fileMeta(fileId: string): Attachment | undefined {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir(), `${safe(fileId)}.json`), "utf8")) as Attachment;
  } catch {
    return undefined;
  }
}

export function readFile(fileId: string): { meta: Attachment; data: Buffer } | undefined {
  const meta = fileMeta(fileId);
  if (!meta) return undefined;
  try {
    return { meta, data: fs.readFileSync(path.join(dir(), safe(fileId))) };
  } catch {
    return undefined;
  }
}

const TEXT = /^(text\/|application\/(json|xml|javascript|x-yaml|yaml|csv|x-sh|sql))/;
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|ya?ml|xml|html?|css|js|jsx|ts|tsx|py|rb|go|rs|java|kt|swift|c|h|cpp|sql|sh|log|ini|toml|env)$/i;

export const isImage = (a: Attachment) => /^image\/(png|jpe?g|gif|webp)$/.test(a.type);
export const isPdf = (a: Attachment) => a.type === "application/pdf";
export const isText = (a: Attachment) => TEXT.test(a.type) || TEXT_EXT.test(a.name);

export function readText(a: Attachment, limit = 40_000): string | undefined {
  const f = readFile(a.id);
  if (!f) return undefined;
  const s = f.data.toString("utf8");
  return s.length > limit ? `${s.slice(0, limit)}\n…(cut at ${limit} characters)` : s;
}

export const sizeLabel = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
