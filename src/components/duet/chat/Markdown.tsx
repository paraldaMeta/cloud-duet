"use client";

import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { useDuet } from "@/lib/client/store";
import type { TaskStatus } from "@/lib/shared/types";
import { TaskGlyph } from "../tasks/TaskGlyph";

export function TaskLink({ taskId, children }: { taskId: string; children?: React.ReactNode }) {
  const task = useDuet((s) => s.data?.tasks.find((t) => t.id === taskId));
  const set = useDuet((s) => s.set);
  return (
    <button
      type="button"
      onClick={() => set({ taskId, tab: "chat" })}
      className="mx-0.5 inline-flex max-w-full translate-y-[2px] items-center gap-1.5 rounded-full bg-black/[0.05] px-2 py-[1px] align-baseline text-[16px] text-link dark:bg-white/10"
    >
      <TaskGlyph status={(task?.status ?? "working") as TaskStatus} size={14} />
      <span className="truncate">{children ?? task?.title}</span>
    </button>
  );
}

/** Only web and mail links open; anything else (javascript:, data:…) renders as plain text. */
export function safeHref(href?: string): href is string {
  return !!href && /^(https?:|mailto:)/i.test(href);
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="prose-duet">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(u) => (u.startsWith("task:") ? u : defaultUrlTransform(u))}
        components={{
          a: ({ href, children }) =>
            href?.startsWith("task:") ? (
              <TaskLink taskId={href.slice(5)}>{children}</TaskLink>
            ) : safeHref(href) ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
