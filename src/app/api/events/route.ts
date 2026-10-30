import { subscribe } from "@/lib/server/bus";
import { asAccount } from "@/lib/server/http";

export async function GET(req: Request) {
  return asAccount(req, (uid) => {
    const enc = new TextEncoder();
    let unsubscribe = () => {};
    let ping: NodeJS.Timeout | undefined;
    const stream = new ReadableStream({
      start(controller) {
        const send = (data: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
        // Proxies and tunnels buffer small first chunks; a padded comment pushes the stream through.
        controller.enqueue(enc.encode(`:${" ".repeat(4096)}\n\n`));
        send({ type: "hello" });
        unsubscribe = subscribe(uid, send);
        ping = setInterval(() => controller.enqueue(enc.encode(": ping\n\n")), 15_000);
        req.signal.addEventListener("abort", () => {
          unsubscribe();
          clearInterval(ping);
          try {
            controller.close();
          } catch {}
        });
      },
      cancel() {
        unsubscribe();
        clearInterval(ping);
      },
    });
    return new Response(stream, {
      headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" },
    });
  });
}
