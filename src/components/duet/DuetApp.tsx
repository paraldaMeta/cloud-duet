"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { enablePush, registerWorker } from "@/lib/client/push";
import { t as tr, useLang, useT } from "@/lib/client/i18n";
import { locale } from "@/lib/i18n";
import { api, connect, send, useDuet } from "@/lib/client/store";
import type { ArtifactType } from "@/lib/shared/types";
import { cn } from "@/lib/utils";
import { ChatView } from "./chat/ChatView";
import { Composer } from "./Composer";
import { Header } from "./Header";
import { useIsDesktop } from "./hooks";
import { ArtifactViewer, BuildView, DescribeSheet } from "./make/Overlays";
import { MakeView } from "./make/MakeView";
import { Mascot } from "./Mascot";
import { Onboarding } from "./onboarding/Onboarding";
import { SignIn } from "./onboarding/SignIn";
import { NotificationBanners, VoiceMode } from "./Overlays";
import { AssistantSheet, ConnectorSheet } from "./sheets/AccessSheets";
import { AddTaskSheet, NewChannelSheet } from "./sheets/CreateSheets";
import { ServicesSheet } from "./sheets/ServicesSheet";
import { MemorySheet, ModelSheet, NotificationsSheet, PaymentsSheet, ProfileSheet, UsageSheet } from "./sheets/ProfileSheets";
import { SideMenu } from "./SideMenu";
import { TabBar } from "./TabBar";
import { TaskDetail } from "./tasks/TaskDetail";
import { TasksView } from "./tasks/TasksView";

const INTRO_KEY = "duet.intro";

type IntroChoice = { slack: boolean; notifications: boolean; applied?: boolean };

function subscribeIntro(onChange: () => void) {
  window.addEventListener("duet-intro", onChange);
  return () => window.removeEventListener("duet-intro", onChange);
}

function readIntroRaw() {
  return localStorage.getItem(INTRO_KEY);
}

function noIntro() {
  return null;
}

function writeIntro(choice: IntroChoice) {
  localStorage.setItem(INTRO_KEY, JSON.stringify(choice));
  window.dispatchEvent(new Event("duet-intro"));
}

function parseIntro(raw: string | null): IntroChoice | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as IntroChoice;
    if (typeof v.slack !== "boolean" || typeof v.notifications !== "boolean") return null;
    return v;
  } catch {
    return null;
  }
}

function Splash({ offline }: { offline: boolean }) {
  const t = useT();
  return (
    <div className="fixed inset-0 grid place-items-center bg-paper">
      <div className="flex flex-col items-center gap-4">
        <Mascot size={96} mood={offline ? "thinking" : "idle"} />
        {offline && <p className="text-[14px] text-ink-2">{t("Can't reach the Duet server. Retrying…")}</p>}
      </div>
    </div>
  );
}

function Sheets() {
  const sheet = useDuet((s) => s.sheet);
  const connector = typeof sheet === "object" && sheet ? sheet.connector : null;
  return (
    <>
      <AssistantSheet open={sheet === "claude"} />
      <ConnectorSheet id={connector} />
      <ProfileSheet open={sheet === "profile"} />
      <UsageSheet open={sheet === "usage"} />
      <MemorySheet open={sheet === "memory"} />
      <NotificationsSheet open={sheet === "notifications"} />
      <PaymentsSheet open={sheet === "payments"} />
      <ModelSheet open={sheet === "model"} />
      <ServicesSheet open={sheet === "services"} />
      <NewChannelSheet open={sheet === "newChannel"} />
      <AddTaskSheet open={sheet === "addTask"} />
    </>
  );
}

function Main() {
  const { data, tab, channelId, taskId, viewerId, buildId, describeType } = useDuet();
  const desktop = useIsDesktop();
  const [typing, setTyping] = useState(false);
  const t = useT();
  if (!data) return null;
  const keyboard = typing && !desktop;
  const task = taskId ? data.tasks.find((t) => t.id === taskId) : null;
  const viewer = viewerId ? data.artifacts.find((a) => a.id === viewerId) : null;
  const build = buildId ? data.builds.find((b) => b.id === buildId) : null;
  const pinned = data.artifacts.find((a) => a.inTabBar);
  const channel = data.channels.find((c) => c.id === channelId);

  return (
    <div className="relative h-full overflow-hidden bg-paper">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="absolute inset-0"
        >
          {tab === "chat" && <ChatView />}
          {tab === "tasks" && <TasksView />}
          {tab === "make" && <MakeView />}
          {tab === "pinned" && (pinned ? <ArtifactViewer a={pinned} embedded /> : <ChatView />)}
        </motion.div>
      </AnimatePresence>

      <Header />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
        <div className="fade-bottom absolute inset-x-0 bottom-0 h-40" />
        <div className="relative mx-auto flex max-w-[680px] flex-col gap-2.5 px-3 pb-[max(env(safe-area-inset-bottom),12px)]">
          {tab === "chat" && (
            <div className="pointer-events-auto">
              <Composer
                placeholder={channel && channel.id !== "main" ? t("Message #{name}", { name: channel.name }) : t("Message Cloud Duet")}
                onSend={(text, files) => send(text, { files })}
                onFocusChange={setTyping}
              />
            </div>
          )}
          <AnimatePresence initial={false}>
            {!(keyboard && tab === "chat") && (
              <motion.div key="tabbar" initial={{ opacity: 0, y: 24, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: 24, height: 0 }} transition={{ duration: 0.2 }}>
                <TabBar />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>{task && <TaskDetail key={task.id} task={task} />}</AnimatePresence>
      <AnimatePresence>{describeType && <DescribeSheet key="describe" type={describeType as ArtifactType} />}</AnimatePresence>
      <AnimatePresence>{build && <BuildView key={build.id} build={build} />}</AnimatePresence>
      <AnimatePresence>{viewer && <ArtifactViewer key={viewer.id} a={viewer} />}</AnimatePresence>
    </div>
  );
}

function Shell() {
  const { menuOpen, set, voice } = useDuet();
  const desktop = useIsDesktop();
  const [w, setW] = useState(390);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const shift = Math.min(w * 0.8, 340);
  const open = menuOpen && !desktop;

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-[#EBEBEB] dark:bg-[#151515]">
      {desktop ? (
        <aside className="w-[300px] shrink-0 border-r border-hair bg-[#EFEFEF] dark:bg-[#141414]">
          <SideMenu />
        </aside>
      ) : (
        <aside className="absolute inset-y-0 left-0" style={{ width: shift }}>
          <SideMenu />
        </aside>
      )}
      <motion.main
        className={cn("relative z-10 min-w-0 flex-1 overflow-hidden", !desktop && "shadow-[-10px_0_40px_rgb(0_0_0/0.12)]")}
        animate={{ x: open ? shift : 0, borderRadius: open ? 32 : 0, scale: open ? 0.96 : 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 40 }}
        style={{ originX: 0 }}
      >
        <Main />
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[70] bg-black/15"
              onClick={() => set({ menuOpen: false })}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0.4, right: 0 }}
              onDragEnd={(_, i) => i.offset.x < -40 && set({ menuOpen: false })}
            />
          )}
        </AnimatePresence>
      </motion.main>
      <Sheets />
      <AnimatePresence>{voice && <VoiceMode />}</AnimatePresence>
      <NotificationBanners />
    </div>
  );
}

export function DuetApp() {
  const { data, auth, connected, replay, set } = useDuet();
  const [celebrated, setCelebrated] = useState(false);
  const introRaw = useSyncExternalStore(subscribeIntro, readIntroRaw, noIntro);
  const intro = parseIntro(introRaw);
  const applying = useRef<string | null>(null);
  useEffect(() => connect(), []);
  useEffect(() => {
    if (auth !== "in" || !data || data.user.onboarded || !introRaw || !intro || intro.applied || applying.current === introRaw) return;
    applying.current = introRaw;
    if (intro.notifications) void enablePush().catch(() => {});
    void api.post("onboarding", { slack: intro.slack, notifications: intro.notifications }).then(
      () => writeIntro({ slack: intro.slack, notifications: intro.notifications, applied: true }),
      () => {
        applying.current = null;
      },
    );
  }, [auth, data, intro, introRaw]);
  const lang = useLang();
  const savedLang = data?.settings.language;
  useEffect(() => {
    document.documentElement.lang = locale(lang);
    if (auth === "in" && data && savedLang !== lang) void api.patch("settings", { language: lang }).catch(() => {});
  }, [auth, data, lang, savedLang]);
  const linkedTask = useRef<string | null>(null);
  useEffect(() => {
    if (!data) return;
    const params = new URLSearchParams(window.location.search);
    linkedTask.current ??= params.get("task") ? `task:${params.get("task")}` : params.get("channel") ? `channel:${params.get("channel")}` : "";
    const link = linkedTask.current;
    if (!link) return;
    linkedTask.current = "";
    window.history.replaceState(null, "", "/");
    const [kind, id] = [link.slice(0, link.indexOf(":")), link.slice(link.indexOf(":") + 1)];
    if (kind === "channel") {
      if (data.channels.some((c) => c.id === id)) set({ tab: "chat", channelId: id, taskId: null, sheet: null });
      return;
    }
    const task = data.tasks.find((t) => t.id === id);
    if (task) set({ tab: "chat", channelId: task.channelId, taskId: task.id, sheet: null });
    else toast(tr("That task isn't in this account."));
  }, [data, set]);
  useEffect(() => {
    registerWorker();
    const params = new URLSearchParams(window.location.search);
    const appId = params.get("connected");
    if (appId) {
      window.history.replaceState(null, "", "/");
      void api.post("connectors/sync").then(() => {
        const c = useDuet.getState().data?.connectors.find((x) => x.id === appId);
        toast(c?.real ? tr("{name} connected to your real account", { name: c.name }) : tr("That app didn't finish connecting. Try again from the Cloud Duet sheet."));
      }, () => {});
    }
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "open") set({ tab: "chat", channelId: e.data.channelId ?? "main", taskId: e.data.taskId ?? null, sheet: null });
    };
    // Any failed request nobody handled still tells the person something went wrong.
    const onReject = (e: PromiseRejectionEvent) => {
      if (!(e.reason instanceof Error) || !e.reason.message) return;
      e.preventDefault();
      toast(e.reason.message);
    };
    navigator.serviceWorker?.addEventListener("message", onMsg);
    window.addEventListener("unhandledrejection", onReject);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", onMsg);
      window.removeEventListener("unhandledrejection", onReject);
    };
  }, [set]);

  if (auth === "unknown") return <Splash offline={!connected} />;
  // The six-page intro plays before any account exists. Sign-in comes after it.
  if (auth === "out") {
    if (!intro) {
      return (
        <Onboarding
          onFinish={(r) => writeIntro({ slack: r.slack, notifications: r.notifications, applied: false })}
        />
      );
    }
    return <SignIn />;
  }
  if (!data) return <Splash offline={!connected} />;
  const introPending = !!intro && !intro.applied;
  const onboarding = data.user.signedIn && ((!data.user.onboarded && !introPending) || replay);
  const showShell = data.user.signedIn && (data.user.onboarded || (introPending && !replay));

  return (
    <>
      {showShell && <Shell />}
      <AnimatePresence>
        {!data.user.signedIn && (
          <motion.div key="signin" exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <SignIn />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {onboarding && !celebrated && (
          <motion.div key="onboarding" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            <Onboarding
              onFinish={async (r) => {
                setCelebrated(true);
                try {
                  if (replay) set({ replay: false, tab: "chat", channelId: "main" });
                  else {
                    if (r.notifications) void enablePush().catch(() => {});
                    await api.post("onboarding", r);
                  }
                } catch (e) {
                  toast((e as Error).message);
                } finally {
                  setTimeout(() => setCelebrated(false), 600);
                }
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
