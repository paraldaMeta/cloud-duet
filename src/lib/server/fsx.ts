import fs from "node:fs";
import path from "node:path";

/** Reads JSON, or the fallback when the file doesn't exist. A corrupt file throws rather than reading as empty, so it is never saved over. */
export function readJson<T>(file: string, fallback: T): T {
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw e;
  }
  return JSON.parse(raw) as T;
}

/** Writes through a temp file and a rename, so a crash mid-write can't leave half a file. */
export function writeJson(file: string, data: unknown, mode = 0o600) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data), { mode });
  fs.renameSync(tmp, file);
}
