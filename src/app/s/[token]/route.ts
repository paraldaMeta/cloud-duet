import type { Artifact } from "@/lib/shared/types";
import { runAs } from "@/lib/server/context";
import { resolveShare } from "@/lib/server/share";
import { find } from "@/lib/server/store";

const CSP = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; frame-ancestors 'none'; sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox";

const gone = () =>
  new Response(
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>链接不可用 · Link not available</title><body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#F6F6F4;color:#141413"><div style="text-align:center;padding:24px"><h1 style="font-size:22px;margin:0 0 8px">此链接不可用</h1><p style="color:#6B6A66;margin:0">分享者可能已关闭此链接。</p><h2 style="font-size:17px;margin:20px 0 6px">This link isn't available</h2><p style="color:#6B6A66;margin:0">It may have been turned off by the person who shared it.</p></div>`,
    { status: 404, headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": CSP } },
  );

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const share = resolveShare((await ctx.params).token);
  if (!share) return gone();
  const art = runAs(share.uid, () => find<Artifact>("artifacts", share.artifactId));
  if (!art) return gone();
  return new Response(art.html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": CSP,
      "x-robots-tag": "noindex",
      "referrer-policy": "no-referrer",
      "cache-control": "no-store",
    },
  });
}
