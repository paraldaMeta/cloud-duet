"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/client/i18n";

/** A live, scaled-down render of an artifact. */
export function Thumb({ id, updatedAt, scale = 0.32, className }: { id: string; updatedAt: string; scale?: number; className?: string }) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const inner = w / scale;
  return (
    <div ref={box} className={`relative overflow-hidden bg-white ${className ?? ""}`}>
      {w > 0 && (
        <iframe
          title={t("Preview")}
          src={`/api/artifacts/${id}/html?v=${encodeURIComponent(updatedAt)}`}
          sandbox="allow-scripts"
          loading="lazy"
          tabIndex={-1}
          className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
          style={{ width: inner, height: inner * 1.4, transform: `scale(${scale})` }}
        />
      )}
    </div>
  );
}
