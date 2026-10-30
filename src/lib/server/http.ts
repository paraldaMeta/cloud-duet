import { accountFromRequest, sameOrigin } from "./auth";
import { runAs } from "./context";
import { ensureStarted } from "./engine";

/** Runs a handler as the signed-in account, or answers 401. */
export function asAccount(req: Request, fn: (uid: string) => Promise<Response> | Response): Promise<Response> | Response {
  const account = accountFromRequest(req);
  if (!account) return Response.json({ error: "Sign in first" }, { status: 401 });
  if (req.method !== "GET" && req.method !== "HEAD" && !sameOrigin(req)) return Response.json({ error: "Cross-site request" }, { status: 403 });
  ensureStarted();
  return runAs(account.id, () => fn(account.id));
}
