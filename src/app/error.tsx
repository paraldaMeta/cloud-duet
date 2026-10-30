"use client";

import { useT } from "@/lib/client/i18n";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  return (
    <div className="fixed inset-0 grid place-items-center bg-paper px-8 text-center">
      <div className="max-w-sm space-y-4">
        <p className="font-serif text-[24px] leading-tight">{t("Something went wrong")}</p>
        <p className="text-[15px] text-ink-2">{t("Cloud Duet hit an unexpected error. Your data is safe on the server.")}</p>
        {error.digest && <p className="text-[12px] text-ink-3">{error.digest}</p>}
        <div className="flex justify-center gap-2">
          <button type="button" onClick={reset} className="rounded-full bg-solid px-5 py-2.5 text-[15px] font-medium text-solid-fg">
            {t("Try again")}
          </button>
          <button type="button" onClick={() => window.location.reload()} className="rounded-full border border-hair px-5 py-2.5 text-[15px]">
            {t("Reload")}
          </button>
        </div>
      </div>
    </div>
  );
}
