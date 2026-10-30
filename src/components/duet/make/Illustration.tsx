import type { ArtifactType } from "@/lib/shared/types";

/** Large outline drawings for each kind of thing Cloud Duet makes. */
export function Illustration({ type, size = 160, className }: { type: ArtifactType; size?: number; className?: string }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 160 120" width={size} height={(size * 120) / 160} className={className} aria-hidden>
      {type === "webpage" && (
        <g {...s}>
          <rect x="14" y="12" width="132" height="96" rx="10" />
          <path d="M14 30h132" />
          <circle cx="26" cy="21" r="2.5" />
          <circle cx="35" cy="21" r="2.5" />
          <circle cx="44" cy="21" r="2.5" />
          <path d="M40 50h80M54 62h52" />
          <rect x="62" y="74" width="36" height="12" rx="6" />
        </g>
      )}
      {type === "docs" && (
        <g {...s}>
          <path d="M44 10h52l22 22v78H44z" />
          <path d="M96 10v22h22" />
          <path d="M56 50h48M56 62h48M56 74h36M56 86h44" />
        </g>
      )}
      {type === "slides" && (
        <g {...s}>
          <rect x="16" y="14" width="128" height="80" rx="8" />
          <path d="M80 94v14M62 108h36" />
          <path d="M34 36h50M34 48h34" />
          <path d="M96 76l12-18 10 10 12-20" />
        </g>
      )}
      {type === "dashboard" && (
        <g {...s}>
          <rect x="14" y="12" width="132" height="96" rx="10" />
          <rect x="26" y="24" width="50" height="26" rx="5" />
          <rect x="84" y="24" width="50" height="26" rx="5" />
          <path d="M30 96V80M44 96V70M58 96V76M72 96V62M86 96V68M100 96V58M114 96V64M128 96V54" />
        </g>
      )}
      {type === "design" && (
        <g {...s}>
          <rect x="22" y="10" width="44" height="90" rx="10" />
          <rect x="94" y="20" width="44" height="90" rx="10" />
          <path d="M66 52c10 0 16 4 28 12" strokeDasharray="4 5" />
          <path d="M30 70h28M102 80h28" />
        </g>
      )}
      {type === "designsystem" && (
        <g {...s}>
          <circle cx="40" cy="40" r="16" />
          <rect x="66" y="24" width="32" height="32" rx="8" />
          <path d="M120 24l16 32h-32z" />
          <path d="M26 82h108M26 96h70" />
        </g>
      )}
    </svg>
  );
}
