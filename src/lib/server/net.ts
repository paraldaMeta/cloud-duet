// Guards for addresses the server is asked to reach on someone's behalf.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function privateV4(ip: string) {
  const [a, b] = ip.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

/** Loopback, private, link-local (cloud metadata), CGNAT, multicast and reserved addresses. */
export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) return privateV4(ip);
  const v6 = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("ff");
}

/** True when the host is, or resolves to, an address that isn't on the public internet. */
export async function isPrivateHost(hostname: string): Promise<boolean> {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (isIP(h)) return isPrivateIp(h);
  try {
    const addrs = await lookup(h, { all: true });
    return addrs.some((a) => isPrivateIp(a.address));
  } catch {
    return true;
  }
}

/** A public http(s) URL, or null. */
export async function publicUrl(raw: string, httpsOnly = false): Promise<URL | null> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && (httpsOnly || u.protocol !== "http:")) return null;
  if (u.username || u.password) return null;
  return (await isPrivateHost(u.hostname)) ? null : u;
}
