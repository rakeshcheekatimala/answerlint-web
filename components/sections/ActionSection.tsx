import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { branding } from "@/config/branding";

export async function ActionSection() {
  const t = await getTranslations("Action");

  return (
    <section
      id="action"
      className="scroll-mt-24 border-b border-border bg-wash py-16 sm:py-24"
    >
      <div className="safe-pad mx-auto max-w-content sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">
              Ship workflow
            </p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
              {t("title")}
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-8 text-ink-muted sm:text-lg">{t("subtitle")}</p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-8">
          <div className="min-w-0 overflow-hidden border border-border bg-[#0b1210] shadow-soft">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b65]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#f4c358]" />
              <span className="h-2.5 w-2.5 rounded-full bg-accent" />
              <span className="ml-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                citeops overview
              </span>
            </div>
            <Image
              src={branding.overviewImageUrl}
              alt={t("imageAlt")}
              width={1200}
              height={720}
              className="block h-auto w-full max-w-full object-cover object-top"
              sizes="(max-width: 768px) calc(100vw - 2rem), (max-width: 1024px) calc(100vw - 3rem), 50vw"
            />
          </div>
          <div className="min-w-0 border border-border bg-card shadow-soft">
            <div className="border-b border-border p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-subtle">
                {t("codeCaption")}
              </p>
              <pre className="mt-4 max-w-full overflow-x-auto border border-border bg-[#0b1210] p-4 text-sm leading-relaxed text-emerald-100">
                <code className="block w-max min-w-full whitespace-pre">
                  {t("codeBlock")}
                </code>
              </pre>
            </div>
            <div className="grid gap-px bg-border">
              {[t("detail1"), t("detail2"), t("detail3")].map((item) => (
                <p
                  key={item}
                  className="bg-card px-5 py-4 text-sm leading-7 text-ink-muted sm:px-6"
                >
                  {item}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
