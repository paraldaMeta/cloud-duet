// Sign-in, sign-out and the OAuth round trips.
import {
  accountFromRequest, appleAuthUrl, appleExchange, clearCookie, emailSignIn, endSession, googleAuthUrl, googleExchange, newState,
  oauthSignIn, providers, publicOrigin, readCookie, sameOrigin, sessionCookie, touchWorkspace, type Account,
} from "@/lib/server/auth";
import { runAs } from "@/lib/server/context";
import { ensureStarted } from "@/lib/server/engine";
import { syncEngine } from "@/lib/server/engine/provider";
import { tr } from "@/lib/server/i18n";

type Ctx = { params: Promise<{ path: string[] }> };

const STATE_COOKIE = "duet_oauth";

function signedIn(req: Request, account: Account, timezone?: string, to?: string) {
  touchWorkspace(account, timezone);
  runAs(account.id, () => syncEngine());
  ensureStarted();
  const cookie = sessionCookie(req, account.id);
  if (to) return new Response(null, { status: 303, headers: { location: to, "set-cookie": cookie } });
  return Response.json({ user: { id: account.id, email: account.email, name: account.name } }, { headers: { "set-cookie": cookie } });
}

function startOAuth(req: Request, url: string, st: string) {
  const secure = publicOrigin(req).startsWith("https:");
  // Apple posts the callback cross-site, so this cookie needs SameSite=None (which needs https).
  const cookie = `${STATE_COOKIE}=${st}; Path=/api/auth; HttpOnly; Max-Age=600; ${secure ? "SameSite=None; Secure" : "SameSite=Lax"}`;
  return new Response(null, { status: 303, headers: { location: url, "set-cookie": cookie } });
}

const fail = (req: Request, msg: string) =>
  new Response(null, { status: 303, headers: { location: `${publicOrigin(req)}/?authError=${encodeURIComponent(tr(msg))}` } });

export async function GET(req: Request, ctx: Ctx) {
  const [a, b] = (await ctx.params).path;
  const origin = publicOrigin(req);
  const url = new URL(req.url);
  if (a === "me") {
    const acct = accountFromRequest(req);
    return Response.json({ user: acct ? { id: acct.id, email: acct.email, name: acct.name } : null, providers: providers() });
  }
  if (a === "google" && !b) {
    if (!providers().google) return fail(req, "Google sign-in isn't set up on this server yet.");
    const st = newState();
    return startOAuth(req, googleAuthUrl(origin, st), st);
  }
  if (a === "google" && b === "callback") {
    if (!url.searchParams.get("code") || url.searchParams.get("state") !== readCookie(req, STATE_COOKIE)) return fail(req, "Google sign-in was cancelled.");
    try {
      const p = await googleExchange(origin, url.searchParams.get("code")!);
      return signedIn(req, oauthSignIn("google", p.sub, p.email, p.verified, p.name), undefined, `${origin}/`);
    } catch (e) {
      return fail(req, (e as Error).message);
    }
  }
  if (a === "apple" && !b) {
    if (!providers().apple) return fail(req, "Apple sign-in isn't set up on this server yet.");
    const st = newState();
    return startOAuth(req, appleAuthUrl(origin, st), st);
  }
  return Response.json({ error: tr("Not found") }, { status: 404 });
}

export async function POST(req: Request, ctx: Ctx) {
  const [a, b] = (await ctx.params).path;
  if (a === "email") {
    if (!sameOrigin(req)) return Response.json({ error: tr("Not found") }, { status: 403 });
    if (Number(req.headers.get("content-length") ?? 0) > 8192) return Response.json({ error: tr("Enter a valid email.") }, { status: 413 });
    const d = (await req.json().catch(() => ({}))) as { email?: string; password?: string; name?: string; timezone?: string };
    const client = (process.env.TRUST_PROXY === "1" && req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()) || undefined;
    const r = await emailSignIn(String(d.email ?? ""), String(d.password ?? ""), typeof d.name === "string" ? d.name : undefined, client);
    if (!r.account) return Response.json({ error: r.error }, { status: 400 });
    return signedIn(req, r.account, typeof d.timezone === "string" ? d.timezone.slice(0, 64) : undefined);
  }
  if (a === "logout") {
    endSession(req);
    return Response.json({ ok: true }, { headers: { "set-cookie": clearCookie() } });
  }
  if (a === "apple" && b === "callback") {
    const form = await req.formData();
    const origin = publicOrigin(req);
    if (!form.get("code") || form.get("state") !== readCookie(req, STATE_COOKIE)) return fail(req, "Apple sign-in was cancelled.");
    try {
      const claims = await appleExchange(origin, String(form.get("code")));
      // Apple only sends the name on the very first sign-in.
      let name: string | undefined;
      try {
        const u = JSON.parse(String(form.get("user") ?? "{}")) as { name?: { firstName?: string; lastName?: string } };
        name = [u.name?.firstName, u.name?.lastName].filter(Boolean).join(" ") || undefined;
      } catch {}
      return signedIn(req, oauthSignIn("apple", claims.sub, claims.email, claims.verified, name), undefined, `${origin}/`);
    } catch (e) {
      return fail(req, (e as Error).message);
    }
  }
  return Response.json({ error: tr("Not found") }, { status: 404 });
}
