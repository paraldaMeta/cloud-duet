import { ChartColumn, FileText, Globe, Layers, Palette, Presentation } from "lucide-react";
import type { ArtifactType } from "@/lib/shared/types";

export const TYPE_META: Record<ArtifactType, { label: string; color: string; Icon: typeof FileText; article: string }> = {
  webpage: { label: "Web page", color: "#D0533E", Icon: Globe, article: "A web page" },
  docs: { label: "Docs", color: "#3F7BD8", Icon: FileText, article: "A doc" },
  slides: { label: "Slides", color: "#E2853A", Icon: Presentation, article: "A deck" },
  dashboard: { label: "Dashboard", color: "#8A63D2", Icon: ChartColumn, article: "A dashboard" },
  design: { label: "Design", color: "#8A63D2", Icon: Palette, article: "A design" },
  designsystem: { label: "Design System", color: "#8A63D2", Icon: Layers, article: "A design system" },
};

export function ArtifactTypeIcon({ type, size = 16, colored = false }: { type: ArtifactType; size?: number; colored?: boolean }) {
  const { Icon, color } = TYPE_META[type];
  return <Icon size={size} strokeWidth={1.9} style={colored ? { color } : undefined} />;
}
