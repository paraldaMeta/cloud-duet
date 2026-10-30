// Self-contained HTML for the things Cloud Duet makes. In demo mode these are
// filled from the sample workspace; a model can also hand in its own HTML.
import type { Artifact, ArtifactType } from "@/lib/shared/types";
import { SAMPLE } from "../fixtures";
import { locale } from "@/lib/i18n";
import { tr, userLang } from "../i18n";
import { state } from "../store";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const BASE_CSS = `
*{box-sizing:border-box}html,body{margin:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif;color:#141413;background:#FAFAF8;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:"Iowan Old Style","Source Serif 4",Georgia,serif;font-weight:600;letter-spacing:-.01em;margin:0}
.muted{color:#6B6A66}.wrap{max-width:880px;margin:0 auto;padding:28px 22px 48px}
.pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:4px 10px;border-radius:999px;background:#F0EEE8;color:#5C5A55}
@media (prefers-color-scheme:dark){body{background:#111;color:#F2F2F2}.muted{color:#9A9893}.pill{background:#222;color:#BBB}}
`;

function page(title: string, css: string, body: string, script = "") {
  return `<!doctype html><html lang="${locale(userLang())}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${BASE_CSS}${css}</style></head><body>${body}${script ? `<script>${script}</script>` : ""}</body></html>`;
}

function dashboard(title: string): Pick<Artifact, "html" | "metrics" | "sources"> {
  const metrics = [
    { label: tr("Revenue this month"), value: 48250, prefix: "$" },
    { label: tr("Overdue invoices"), value: 8350, prefix: "$" },
    { label: tr("Active clients"), value: 14 },
    { label: tr("Replies owed"), value: 3 },
  ];
  const weeks = [18, 22, 19, 27, 31, 29, 36, 41];
  const max = Math.max(...weeks);
  const bars = weeks
    .map((v, i) => `<div class="bar"><span style="height:${(v / max) * 100}%"></span><em>${tr("W{n}", { n: i + 1 })}</em></div>`)
    .join("");
  const rows = SAMPLE.invoices
    .map((r) => `<tr><td>${esc(r.customer)}</td><td>$${r.amount.toLocaleString(locale(userLang()))}</td><td><span class="late">${tr("{n} days", { n: r.daysOverdue })}</span></td></tr>`)
    .join("");
  const html = page(
    title,
    `.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:20px 0}
@media(min-width:700px){.grid{grid-template-columns:repeat(4,1fr)}}
.card{background:#fff;border:1px solid #ECEAE4;border-radius:16px;padding:14px 16px}
.card b{display:block;font-size:26px;font-weight:600;margin-top:6px;font-variant-numeric:tabular-nums}
.chart{display:flex;align-items:flex-end;gap:10px;height:160px;padding:12px 4px 22px}
.bar{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;position:relative}
.bar span{display:block;width:100%;border-radius:8px 8px 3px 3px;background:linear-gradient(#D9826D,#C7604A);animation:grow .9s cubic-bezier(.2,.8,.2,1) both}
.bar em{position:absolute;bottom:-20px;font-style:normal;font-size:11px;color:#8A8883}
@keyframes grow{from{height:0}}
table{width:100%;border-collapse:collapse;font-size:14px}td{padding:10px 4px;border-top:1px solid #EFEDE8}
.late{color:#B4462E;background:#FBE9E4;border-radius:999px;padding:2px 8px;font-size:12px}
@media (prefers-color-scheme:dark){.card{background:#1A1A1A;border-color:#2A2A2A}td{border-color:#2A2A2A}.late{background:#3A1D17;color:#F0A08C}}`,
    `<div class="wrap"><span class="pill">● ${tr("Live")} · Stripe, QuickBooks, Gmail</span><h1 style="margin-top:12px;font-size:30px">${esc(title)}</h1>
<p class="muted">${tr("Updated just now. Numbers come from your connected apps; each figure links back to its source.")}</p>
<div class="grid">${metrics.map((m) => `<div class="card"><span class="muted" style="font-size:13px">${esc(m.label)}</span><b data-v="${m.value}" data-p="${m.prefix ?? ""}">${m.prefix ?? ""}0</b></div>`).join("")}</div>
<div class="card"><h3 style="font-size:17px">${tr("Weekly revenue, in thousands")}</h3><div class="chart">${bars}</div></div>
<div class="card" style="margin-top:12px"><h3 style="font-size:17px;margin-bottom:6px">${tr("Overdue invoices")}</h3><table>${rows}</table></div></div>`,
    `document.querySelectorAll('[data-v]').forEach(function(el){var t=+el.dataset.v,p=el.dataset.p,s=performance.now();function f(n){var k=Math.min(1,(n-s)/900);el.textContent=p+Math.round(t*(1-Math.pow(1-k,3))).toLocaleString();if(k<1)requestAnimationFrame(f)}requestAnimationFrame(f)})`,
  );
  return { html, metrics, sources: ["Stripe", "QuickBooks", "Gmail"] };
}

function docs(title: string, prompt: string): Pick<Artifact, "html" | "sources"> {
  const html = page(
    title,
    `.doc{max-width:680px;margin:0 auto;padding:40px 24px 64px;line-height:1.6;font-size:16px}
.doc h1{font-size:32px;line-height:1.15;margin:10px 0 6px}.doc h2{font-size:20px;margin:28px 0 8px}
.doc li{margin:6px 0}.src{font-size:12px;color:#8A8883;border-left:2px solid #E4C3B8;padding-left:10px;margin-top:28px}`,
    `<article class="doc"><span class="pill">${tr("Brief")} · ${today()}</span>
<h1>${esc(title)}</h1><p class="muted">${tr("Prepared by Cloud Duet from your request: “{prompt}”", { prompt: esc(prompt.slice(0, 140)) })}</p>
<h2>${tr("The short version")}</h2><p>${tr("Three things matter most this week: the Mercury Labs launch review at 2 PM, the Series A deck Maya is waiting on, and $8,350 in overdue invoices. Everything below has a suggested next step.")}</p>
<h2>${tr("What's happening")}</h2><ul><li><b>${tr("Mercury Labs launch.")}</b> ${tr("Review moved to 2 PM. Diana wants the final QA list; 4 of 27 items are still open.")}</li>
<li><b>${tr("Fundraising.")}</b> ${tr("Maya Chen (Harbor Ventures) asked for the updated deck before Friday's partner meeting.")}</li>
<li><b>${tr("Renewals.")}</b> ${tr("Northwind wants a summary of what shipped this quarter before renewing for Q1.")}</li></ul>
<h2>${tr("Recommended next steps")}</h2><ol><li>${tr("Send Diana the QA list before 1 PM.")}</li><li>${tr("Share the deck with Maya on Thursday so there's time for notes.")}</li><li>${tr("Send reminders on the three overdue invoices.")}</li></ol>
<p class="src">${tr("Sources: Gmail (4 threads), Google Calendar (today), Stripe (3 invoices).")}</p></article>`,
  );
  return { html, sources: ["Gmail", "Google Calendar", "Stripe"] };
}

function today() {
  const opts = { month: "short", day: "numeric" } as const;
  try {
    return new Date().toLocaleDateString(locale(userLang()), { ...opts, timeZone: state().user.timezone || "UTC" });
  } catch {
    return new Date().toLocaleDateString(locale(userLang()), opts);
  }
}

function inline(s: string) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.+?)\*/g, "<i>$1</i>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

/** A doc written by the model, as light markdown: headings, lists, paragraphs. */
export function renderDoc(title: string, markdown: string, sources: string[] = []): string {
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  const close = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (h) {
      close();
      const level = Math.max(2, h[1].length);
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
    } else if (ul || ol) {
      const kind = ul ? "ul" : "ol";
      if (list !== kind) {
        close();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline((ul ?? ol)![1])}</li>`);
    } else if (line.trim()) {
      close();
      out.push(`<p>${inline(line)}</p>`);
    } else close();
  }
  close();
  return page(
    title,
    `.doc{max-width:680px;margin:0 auto;padding:40px 24px 64px;line-height:1.6;font-size:16px}
.doc h1{font-size:32px;line-height:1.15;margin:10px 0 6px}.doc h2{font-size:20px;margin:28px 0 8px}.doc h3{font-size:17px;margin:20px 0 6px}
.doc li{margin:6px 0}.doc a{color:#C7604A}.doc code{background:#F0EEE8;border-radius:4px;padding:1px 4px}
.src{font-size:12px;color:#8A8883;border-left:2px solid #E4C3B8;padding-left:10px;margin-top:28px}`,
    `<article class="doc"><span class="pill">${tr("Doc")} · ${today()}</span>
<h1>${esc(title)}</h1>${out.join("\n")}${sources.length ? `<p class="src">${tr("Sources: {list}", { list: sources.map(esc).join(tr(", ")) })}</p>` : ""}</article>`,
  );
}

function slides(title: string): Pick<Artifact, "html" | "sources"> {
  const items = [
    { h: title, p: `${SAMPLE.company} · ${tr("Q4 update")}`, big: true },
    { h: tr("Where we are"), p: tr("14 active clients · $48k monthly revenue · 2 launches this month") },
    { h: tr("What's working"), p: tr("Repeat clients are 70% of revenue. Launch work converts to retainers 3 of 4 times.") },
    { h: tr("What we need"), p: tr("One senior product designer and a cleaner invoicing loop.") },
    { h: tr("Next 90 days"), p: tr("Ship Mercury Labs, renew Northwind, launch the newsletter, hire.") },
  ];
  const html = page(
    title,
    `body{background:#1B1B1A}.deck{height:100vh;overflow-y:auto;scroll-snap-type:y mandatory}
.slide{scroll-snap-align:start;min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:8vw;background:#F6F1EA;border-bottom:8px solid #1B1B1A;position:relative}
.slide h1{font-size:clamp(28px,6vw,64px);line-height:1.05;max-width:16ch}.slide p{font-size:clamp(15px,2.2vw,22px);color:#55534E;max-width:40ch;margin-top:16px}
.slide.big{background:#C7604A;color:#fff}.slide.big p{color:#FBE3DB}.n{position:absolute;bottom:20px;right:28px;font-size:12px;opacity:.6}`,
    `<div class="deck">${items.map((s, i) => `<section class="slide ${s.big ? "big" : ""}"><h1>${esc(s.h)}</h1><p>${esc(s.p)}</p><span class="n">${i + 1} / ${items.length}</span></section>`).join("")}</div>`,
  );
  return { html, sources: ["Google Drive", "QuickBooks"] };
}

function webpage(title: string, prompt: string): Pick<Artifact, "html" | "sources"> {
  const services = [tr("Tune-up"), tr("Full service"), tr("Fitting")].map(esc);
  const thanks = esc(tr("Thanks! We'll confirm by email.")).replace(/'/g, "\\'");
  const html = page(
    title,
    `.hero{padding:64px 24px 40px;text-align:center;background:radial-gradient(120% 80% at 50% 0%,#FBE7DF,transparent)}
.hero h1{font-size:clamp(32px,7vw,56px);line-height:1.05;max-width:14ch;margin:14px auto 12px}
.btn{display:inline-block;background:#141413;color:#fff;border-radius:999px;padding:14px 22px;font-weight:600;text-decoration:none;margin-top:16px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;max-width:880px;margin:0 auto;padding:0 22px 40px}
.c{background:#fff;border:1px solid #ECEAE4;border-radius:18px;padding:18px}.c b{display:block;font-size:17px;margin-bottom:4px}
form{max-width:420px;margin:0 auto 64px;padding:0 22px;display:grid;gap:10px}input,select{font:inherit;padding:13px 14px;border-radius:12px;border:1px solid #DDD9D1;background:#fff}
@media (prefers-color-scheme:dark){.c,input,select{background:#1A1A1A;border-color:#2A2A2A;color:#eee}.btn{background:#fff;color:#111}}`,
    `<header class="hero"><span class="pill">${tr("Made with Cloud Duet")}</span><h1>${esc(title)}</h1><p class="muted" style="max-width:46ch;margin:0 auto">${esc(prompt.slice(0, 160))}</p><a class="btn" href="#book">${tr("Book a time")}</a></header>
<section class="cards"><div class="c"><b>${services[0]}</b><span class="muted">${tr("45 min · from $60")}</span></div><div class="c"><b>${services[1]}</b><span class="muted">${tr("2 hrs · from $140")}</span></div><div class="c"><b>${services[2]}</b><span class="muted">${tr("30 min · free")}</span></div></section>
<form id="book" onsubmit="event.preventDefault();this.innerHTML='<p style=&quot;text-align:center&quot;>${thanks}</p>'"><input placeholder="${esc(tr("Your name"))}" required><input type="email" placeholder="${esc(tr("Email"))}" required><select>${services.map((o) => `<option>${o}</option>`).join("")}</select><button class="btn" style="border:0;cursor:pointer">${tr("Request booking")}</button></form>`,
  );
  return { html, sources: [] };
}

function design(title: string): Pick<Artifact, "html" | "sources"> {
  const html = page(
    title,
    `.board{display:flex;gap:18px;padding:28px;overflow-x:auto;background:#EDEBE6;min-height:100vh;align-items:flex-start}
.phone{flex:none;width:240px;height:500px;background:#fff;border-radius:34px;border:8px solid #141413;padding:22px 16px;display:flex;flex-direction:column;gap:10px}
.blk{background:#F1EEE8;border-radius:12px}.acc{background:#C7604A}.t{height:12px;border-radius:6px;background:#D9D5CC}
.lbl{font-size:12px;color:#6B6A66;margin:0 0 8px 4px}`,
    `<div class="board">${[tr("Welcome"), tr("Pick a time"), tr("Confirmed")].map((n, i) => `<div><p class="lbl">${i + 1}. ${esc(n)}</p><div class="phone"><div class="t" style="width:60%"></div><div class="blk ${i === 2 ? "acc" : ""}" style="height:${140 - i * 20}px"></div><div class="t"></div><div class="t" style="width:80%"></div><div style="flex:1"></div><div class="blk" style="height:48px;background:#141413;border-radius:999px"></div></div></div>`).join("")}</div>`,
  );
  return { html, sources: [] };
}

function designSystem(title: string): Pick<Artifact, "html" | "sources"> {
  const colors = ["#C7604A", "#141413", "#F4F4F4", "#1C760E", "#D79100", "#5B86D3"];
  const html = page(
    title,
    `.sw{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;margin:18px 0 28px}.s{border-radius:16px;overflow:hidden;border:1px solid #E6E3DC}.s div{height:72px}.s p{margin:0;padding:8px 10px;font-size:12px;font-family:ui-monospace,monospace}
.type p{margin:6px 0}.btns{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.b{padding:12px 18px;border-radius:999px;font-weight:600}`,
    `<div class="wrap"><span class="pill">${tr("Design system")}</span><h1 style="font-size:34px;margin:12px 0">${esc(title)}</h1>
<h3>${tr("Colour")}</h3><div class="sw">${colors.map((c) => `<div class="s"><div style="background:${c}"></div><p>${c}</p></div>`).join("")}</div>
<h3>${tr("Type")}</h3><div class="type"><p style="font-family:Georgia,serif;font-size:34px">${tr("Serif display, 34")}</p><p style="font-size:17px">${tr("Body, 17 — Cloud Duet is AI and can make mistakes.")}</p><p class="muted" style="font-size:13px">${tr("Caption, 13")}</p></div>
<h3 style="margin-top:24px">${tr("Buttons")}</h3><div class="btns"><span class="b" style="background:#141413;color:#fff">${tr("Send")}</span><span class="b" style="border:1px solid #DDD">${tr("Not now")}</span><span class="b" style="background:#C7604A;color:#fff">${tr("Start")}</span></div></div>`,
  );
  return { html, sources: [] };
}

export function renderArtifact(type: ArtifactType, title: string, prompt: string): Pick<Artifact, "html" | "metrics" | "sources"> {
  switch (type) {
    case "dashboard":
      return dashboard(title);
    case "docs":
      return docs(title, prompt);
    case "slides":
      return slides(title);
    case "webpage":
      return webpage(title, prompt);
    case "design":
      return design(title);
    case "designsystem":
      return designSystem(title);
  }
}

/** Guesses what kind of thing a request asks for. */
export function artifactTypeFor(text: string): ArtifactType | null {
  const t = text.toLowerCase();
  if (/design system|style guide|tokens|设计系统|设计规范|风格指南/.test(t)) return "designsystem";
  if (/dashboard|metrics|kpi|tracker|看板|仪表盘|指标|追踪表/.test(t)) return "dashboard";
  if (/deck|slides|presentation|pitch|演示文稿|幻灯片|路演|ppt/.test(t)) return "slides";
  if (/landing|web ?page|website|booking page|site\b|web app|prototype|落地页|网页|网站|预约页|原型/.test(t)) return "webpage";
  if (/mockup|design|wireframe|screens?\b|设计稿|线框|界面|设计/.test(t)) return "design";
  if (/brief|doc|report|research|memo|summary|plan|forecast|model|analysis|write.?up|简报|文档|报告|调研|备忘|总结|汇总|摘要|计划|预测|分析|纪要/.test(t)) return "docs";
  return null;
}

export function titleFor(type: ArtifactType, text: string): string {
  const cleaned = text
    .replace(/^(please\s+)?(can you\s+|could you\s+)?(make|build|create|put together|pull together|draft|write|prepare|design)\s+(me\s+)?(a|an|the)?\s*/i, "")
    .replace(/^请?(帮我|给我|替我)?(做|制作|创建|搭建|整理|汇总|起草|撰写|写|准备|设计)(一下)?(一个|一份|一套|一页|个|份|套)?/, "")
    .replace(/[.?!。？！]+$/, "")
    .trim();
  const cjk = /[\u3400-\u9fff]/.test(cleaned);
  const base = cleaned.length > (cjk ? 1 : 3) ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : "";
  const fallback: Record<ArtifactType, string> = {
    dashboard: tr("Business dashboard"),
    docs: tr("Weekly brief"),
    slides: tr("Q4 update deck"),
    webpage: tr("Booking page"),
    design: tr("Booking flow screens"),
    designsystem: tr("Studio design system"),
  };
  return (base || fallback[type]).slice(0, 60);
}
