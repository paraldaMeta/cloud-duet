"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { setLang, t as tr, useLang, useT } from "@/lib/client/i18n";
import { connect, useDuet } from "@/lib/client/store";
import { cn } from "@/lib/utils";
import { Mascot } from "../Mascot";

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  );
}
function Apple() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden>
      <path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.4.8c1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.1zM13.9 5c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z" />
    </svg>
  );
}

/** Top-right 中文 / EN pill for the signed-out screens, which are always light. */
export function LangSwitch({ className }: { className?: string }) {
  const lang = useLang();
  return (
    <button
      type="button"
      aria-label="切换语言 / Switch language"
      onClick={() => setLang(lang === "zh" ? "en" : "zh")}
      className={cn("grid h-11 min-w-11 place-items-center", className)}
    >
      <span className="flex h-8 items-center gap-1 rounded-full bg-white px-3 text-[12.5px] font-medium shadow-[0_1px_4px_rgb(0_0_0/0.08)] transition-transform active:scale-95">
        <span className={lang === "zh" ? "text-[#141413]" : "text-[#B5B5B5]"}>中文</span>
        <span className="text-[#D6D6D6]">/</span>
        <span className={lang === "en" ? "text-[#141413]" : "text-[#B5B5B5]"}>EN</span>
      </span>
    </button>
  );
}

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function SignIn() {
  const providers = useDuet((s) => s.providers);
  const t = useT();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "password">("email");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("authError"),
  );

  const oauth = (provider: "google" | "apple") => {
    if (!providers[provider]) {
      setError(tr("{provider} sign-in isn't set up on this server yet. Use your email for now.", { provider: provider === "google" ? "Google" : "Apple" }));
      return;
    }
    setBusy(provider);
    window.location.assign(new URL(`/api/auth/${provider}`, window.location.origin));
  };
  const fromEmail = async () => {
    setBusy("email");
    setError(null);
    let res: Response;
    try {
      res = await fetch("/api/auth/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, timezone: tz() }),
      });
    } catch {
      setBusy(null);
      setError(tr("Couldn't sign in."));
      return;
    }
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setBusy(null);
      setError(json.error || tr("Couldn't sign in."));
      return;
    }
    window.history.replaceState(null, "", "/");
    useDuet.getState().set({ auth: "unknown" });
    connect();
  };

  return (
    <div className="fixed inset-0 z-[85] flex flex-col items-center overflow-y-auto bg-gradient-to-b from-[#F9F9F9] to-[#F3F3F3] px-6 text-[#141413]" style={{ colorScheme: "light" }}>
      <LangSwitch className="absolute right-3 top-[max(env(safe-area-inset-top),12px)]" />
      <div className="flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
        <motion.div initial={{ x: -120, rotate: -30, opacity: 0 }} animate={{ x: 0, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 140, damping: 16 }} className="mx-auto">
          <Mascot size={110} mood="writing" />
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mt-4 text-center font-serif text-[30px] font-semibold leading-tight tracking-[-0.3px]">
          {t("Welcome to Cloud Duet")}
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-2 text-center text-[15px] leading-relaxed text-[#3D3D3A]">
          {t("Always-on assistance for life and work. Text Cloud Duet your task, and it will come back to you for next steps.")}
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="mt-8 flex flex-col gap-2.5">
          <p className="mb-1 text-center text-[13px] text-[#8A8985]">{t("Sign in with your Cloud Duet account")}</p>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => oauth("google")}
            className="flex h-[52px] items-center justify-center gap-2.5 rounded-full border border-[#E3E3E3] bg-white text-[16px] font-medium shadow-[0_1px_2px_rgb(0_0_0/0.04)] active:scale-[0.98] disabled:opacity-60"
          >
            {busy === "google" ? <span className="size-4 animate-spin rounded-full border-2 border-[#141413] border-t-transparent" /> : <GoogleG />}
            {t("Continue with Google")}
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => oauth("apple")}
            className="flex h-[52px] items-center justify-center gap-2.5 rounded-full border border-[#E3E3E3] bg-white text-[16px] font-medium shadow-[0_1px_2px_rgb(0_0_0/0.04)] active:scale-[0.98] disabled:opacity-60"
          >
            {busy === "apple" ? <span className="size-4 animate-spin rounded-full border-2 border-[#141413] border-t-transparent" /> : <Apple />}
            {t("Continue with Apple")}
          </button>
          <div className="my-2 flex items-center gap-3 text-[12px] text-[#8A8985]">
            <span className="h-px flex-1 bg-[#E3E3E3]" />
            {t("or")}
            <span className="h-px flex-1 bg-[#E3E3E3]" />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (step === "email" && /\S+@\S+\.\S+/.test(email)) setStep("password");
              else if (step === "password" && password) void fromEmail();
            }}
            className="flex flex-col gap-2.5"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setStep("email");
              }}
              placeholder={t("Personal or work email")}
              className="h-[52px] rounded-full border border-[#E3E3E3] bg-white px-5 text-[16px] outline-none focus:border-[#141413]"
            />
            <AnimatePresence>
              {step === "password" && (
                <motion.input
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 52 }}
                  exit={{ opacity: 0, height: 0 }}
                  autoFocus
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("Password (8+ characters)")}
                  className="rounded-full border border-[#E3E3E3] bg-white px-5 text-[16px] outline-none focus:border-[#141413]"
                />
              )}
            </AnimatePresence>
            <AnimatePresence>
              {error && (
                <motion.p role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="px-2 text-center text-[13.5px] text-[#C2412D]">
                  {t(error)}
                </motion.p>
              )}
            </AnimatePresence>
            <button
              type="submit"
              disabled={!!busy || !/\S+@\S+\.\S+/.test(email) || (step === "password" && !password)}
              className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-[#141413] text-[16px] font-medium text-white transition-opacity disabled:opacity-30"
            >
              {busy === "email" ? <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : null}
              {t(step === "email" ? "Continue with email" : "Sign in or create account")}
              {!busy && <ArrowRight size={17} />}
            </button>
          </form>
        </motion.div>
      </div>
      <p className="max-w-[360px] pb-[max(env(safe-area-inset-bottom),20px)] text-center text-[11.5px] leading-snug text-[#8A8985]">
        {t("New email addresses get a new account. Your data stays on this server.")}
      </p>
    </div>
  );
}
