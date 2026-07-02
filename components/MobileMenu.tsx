"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = {
  href: string;
  label: string;
};

type Props = {
  closeLabel: string;
  menuLabel: string;
  items: NavItem[];
  secondaryItems?: NavItem[];
};

export function MobileMenu({
  closeLabel,
  menuLabel,
  items,
  secondaryItems = [],
}: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative xl:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? closeLabel : menuLabel}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white transition hover:border-white/30 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="sr-only">{open ? closeLabel : menuLabel}</span>
        <span className="relative h-4 w-5" aria-hidden="true">
          <span
            className={`absolute left-0 top-0 h-0.5 w-5 rounded-full bg-current transition ${
              open ? "translate-y-[7px] rotate-45" : ""
            }`}
          />
          <span
            className={`absolute left-0 top-[7px] h-0.5 w-5 rounded-full bg-current transition ${
              open ? "opacity-0" : ""
            }`}
          />
          <span
            className={`absolute left-0 top-[14px] h-0.5 w-5 rounded-full bg-current transition ${
              open ? "-translate-y-[7px] -rotate-45" : ""
            }`}
          />
        </span>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label={closeLabel}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px]"
          />
          <nav
            id="mobile-nav-panel"
            aria-label="Mobile"
            className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-[#07110f] p-3 shadow-[0_18px_50px_rgba(0,0,0,0.34)]"
          >
            <div className="grid gap-2">
              {items.map((item) => {
                const isCurrent =
                  item.href === "/playground"
                    ? pathname?.endsWith("/playground")
                    : false;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isCurrent ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-4 py-3 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
            {secondaryItems.length > 0 ? (
              <div className="mt-3 grid gap-2 border-t border-white/10 pt-3">
                {secondaryItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white/85 transition hover:border-white/25 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            ) : null}
          </nav>
        </>
      ) : null}
    </div>
  );
}
