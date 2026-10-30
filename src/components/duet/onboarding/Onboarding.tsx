"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronLeft, Plus } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { useT } from "@/lib/client/i18n";
import { cn } from "@/lib/utils";
import { SlackLogo } from "../Logos";
import { Celebration } from "./Celebration";
import { AppArc, BrowserForm, ClockDial, PhoneNotification, SafetyCard } from "./Illustrations";
import { LangSwitch } from "./SignIn";

// "\n" marks a line break; in bodies it only applies from the sm breakpoint up.
const PAGES: { title: string; body: string }[] = [
  {
    title: "24/7 proactive help that\nkeeps tasks moving",
    body: "Cloud Duet notices what needs doing, does it\n in the background, and reaches out when it needs you.",
  },
  { title: "Already knows your setup", body: "Your tools, projects, chats, memory, and skills come with your Cloud Duet account." },
  {
    title: "It gets things done\non the web, too",
    body: "Cloud Duet works in its own browser. This lets Cloud Duet open\n sites and fill out forms for your to-do list.",
  },
  {
    title: "Safe, private,\nand in your control",
    body: "Cloud Duet checks with you before big steps and stops\n when something looks wrong.",
  },
  { title: "Connect your apps", body: "This way Cloud Duet can read what's new across apps, take action for you, and make sure you never miss a beat, with many more connectors available." },
  { title: "Get notified", body: "Allow notifications so Cloud Duet can tell you when tasks are done or your input is needed." },
];

function Lines({ text, brClass }: { text: string; brClass?: string }) {
  return text.split("\n").map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br className={brClass} />}
      {line}
    </Fragment>
  ));
}

function Primary({ children, onClick, className, disabled }: { children: ReactNode; onClick: () => void; className?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn("flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#141413] text-[17px] font-medium text-white transition-[transform,background-color,color] active:scale-[0.98]", className)}
    >
      {children}
    </button>
  );
}
function Secondary({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="h-14 w-full rounded-full border border-[#E3E3E3] bg-white text-[17px] font-medium text-[#141413] active:scale-[0.98]">
      {children}
    </button>
  );
}

/** The six-page onboarding, then the check celebration. Always light, like the original. */
export function Onboarding({ onFinish }: { onFinish: (r: { slack: boolean; notifications: boolean }) => void }) {
  const [page, setPage] = useState(0);
  const [nonce, setNonce] = useState(0);
  const [slack, setSlack] = useState(false);
  const [notif, setNotif] = useState<"idle" | "asking" | "on">("idle");
  const [celebrate, setCelebrate] = useState(false);
  const [gone, setGone] = useState(false);
  const t = useT();

  const go = (p: number) => {
    setPage(p);
    setNonce((n) => n + 1);
  };
  const finish = () => {
    setGone(true);
    setTimeout(() => setCelebrate(true), 250);
  };
  const turnOn = async () => {
    setNotif("asking");
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {}
    }
    await new Promise((r) => setTimeout(r, 450));
    setNotif("on");
    setTimeout(finish, 1000);
  };

  const ill = [<ClockDial key="1" />, <AppArc key="2" />, <BrowserForm key="3" />, <SafetyCard key="4" />, null, <PhoneNotification key="6" />][page];

  return (
    <div className="fixed inset-0 z-[85] flex flex-col bg-gradient-to-b from-[#F9F9F9] to-[#F3F3F3] text-[#141413]" style={{ colorScheme: "light" }}>
      <AnimatePresence>
        {!gone && (
          <motion.div key="pages" exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="mx-auto flex size-full max-w-[520px] flex-col">
            <div className="relative flex h-[68px] shrink-0 items-center justify-center pt-[env(safe-area-inset-top)]">
              {page > 0 && (
                <button type="button" aria-label={t("Back")} onClick={() => go(page - 1)} className="absolute left-4 grid size-11 place-items-center rounded-full bg-white shadow-[0_1px_4px_rgb(0_0_0/0.08)]">
                  <ChevronLeft size={22} />
                </button>
              )}
              <div className="flex gap-1.5">
                {PAGES.map((_, i) => (
                  <motion.span key={i} className="h-[3px] w-[22px] rounded-full" animate={{ backgroundColor: i === page ? "#141413" : "#D6D6D6" }} />
                ))}
              </div>
              <LangSwitch className="absolute right-3" />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${page}-${nonce}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.35 } }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto"
              >
                <div className="px-[18px] pt-3 text-center">
                  {page === 0 && <span className="mb-3 inline-block rounded-full bg-[#ECECEC] px-2.5 py-1 text-[12px] text-[#5E5D59]">{t("Research preview")}</span>}
                  <h1 className="font-serif text-[26px] font-semibold leading-[1.15] tracking-[-0.2px]"><Lines text={t(PAGES[page].title)} /></h1>
                  <p className="mx-auto mt-2 max-w-[440px] text-[14.5px] leading-[1.45] text-[#3D3D3A]"><Lines text={t(PAGES[page].body)} brClass="hidden sm:inline" /></p>
                </div>
                <div className={cn("flex flex-1 flex-col", page === 3 || page === 5 ? "justify-end" : "justify-center py-6")}>
                  {page === 4 ? (
                    <div className="mx-5 mt-8 flex items-center gap-3 rounded-2xl border border-black/[0.07] bg-white px-4 py-3.5">
                      <SlackLogo size={26} />
                      <span className="flex-1 text-[16px] font-medium">Slack</span>
                      <button
                        type="button"
                        aria-label={t(slack ? "Remove Slack" : "Add Slack")}
                        onClick={() => setSlack((v) => !v)}
                        className={cn("grid size-8 place-items-center rounded-full transition-colors", slack ? "bg-[#2E9A4E] text-white" : "bg-[#F1F1F1] text-[#141413]")}
                      >
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span key={String(slack)} initial={{ scale: 0.4, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0.4 }} transition={{ type: "spring", stiffness: 600, damping: 22 }}>
                            {slack ? <Check size={16} strokeWidth={3} /> : <Plus size={17} />}
                          </motion.span>
                        </AnimatePresence>
                      </button>
                    </div>
                  ) : (
                    ill
                  )}
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="shrink-0 px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-3">
              {page === 1 && <p className="mb-3 text-center text-[12px] text-[#8A8985]">{t("Cloud Duet uses your plan's usage limits.")}</p>}
              {page === 3 && (
                <p className="mb-3 text-center text-[11px] leading-snug text-[#8A8985]">
                  {t("Cloud Duet works in the background. It reads your connected apps and can act in them on its own, without you asking. It can make mistakes, so check its work. You can turn off any connected app in Settings.")}
                </p>
              )}
              {page < 4 && <Primary onClick={() => go(page + 1)}>{t("Next")}</Primary>}
              {page === 4 && (
                <div className="flex flex-col gap-2.5">
                  <Primary onClick={() => go(5)}>{t("Continue")}</Primary>
                  <Secondary
                    onClick={() => {
                      setSlack(false);
                      go(5);
                    }}
                  >
                    {t("Not now")}
                  </Secondary>
                </div>
              )}
              {page === 5 && (
                <div className="flex flex-col gap-2.5">
                  <Primary
                    onClick={turnOn}
                    disabled={notif !== "idle"}
                    className={cn(notif === "asking" && "opacity-60", notif === "on" && "bg-[#DFF3DA] text-[#2E7D32] opacity-100")}
                  >
                    {notif === "asking" && <span className="size-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />}
                    {notif === "on" && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 16 }}>
                        <Check size={19} strokeWidth={3} />
                      </motion.span>
                    )}
                    {t(notif === "on" ? "Notifications on" : "Turn on notifications")}
                  </Primary>
                  <Secondary onClick={finish}>{t("Not now")}</Secondary>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>{celebrate && <Celebration onDone={() => onFinish({ slack, notifications: notif === "on" })} />}</AnimatePresence>
    </div>
  );
}
