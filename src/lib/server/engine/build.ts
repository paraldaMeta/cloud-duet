// The Make tab's build view: a build walks through its steps on Cloud Duet's
// computer, then lands as an artifact in "Changed today".
import type { ArtifactType, Build } from "@/lib/shared/types";
import { id, nowIso, patch, upsert } from "../store";
import { createArtifact, sleep } from "./actions";
import { titleFor } from "./artifacts";

const STEPS: Record<ArtifactType, string[]> = {
  dashboard: ["Reading your connected apps", "Pulling the numbers", "Laying out the dashboard", "Adding a daily refresh"],
  docs: ["Reading the relevant threads", "Outlining", "Writing", "Checking sources"],
  slides: ["Gathering the story", "Outlining the deck", "Designing slides", "Polishing"],
  webpage: ["Planning the page", "Writing the copy", "Building the page", "Testing on mobile"],
  design: ["Sketching the flow", "Laying out screens", "Polishing"],
  designsystem: ["Collecting colours and type", "Defining components", "Documenting"],
};

export function startBuild(type: ArtifactType, prompt: string): Build {
  const build: Build = { id: id(), type, prompt, title: titleFor(type, prompt), status: "Starting up", startedAt: nowIso(), done: false };
  upsert("builds", build);
  void (async () => {
    await sleep(1200);
    patch<Build>("builds", build.id, { status: "Waking Cloud Duet's workspace" });
    await sleep(1800);
    for (const s of STEPS[type]) {
      patch<Build>("builds", build.id, { status: s });
      await sleep(1500 + Math.random() * 800);
    }
    const art = createArtifact({ type, title: build.title, prompt, channelId: "main" });
    patch<Build>("builds", build.id, { status: "Done", done: true, artifactId: art.id });
  })();
  return build;
}
