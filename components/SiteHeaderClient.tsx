"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { MobileMenu } from "@/components/MobileMenu";

type NavItem = {
  href: string;
  label: string;
};

type Props = {
  displayName: string;
  githubLabel: string;
  githubUrl: string;
  logoAlt: string;
  menuCloseLabel: string;
  menuLabel: string;
  navItems: NavItem[];
  npmLabel: string;
  npmUrl: string;
};

export function SiteHeaderClient({
  displayName,
  githubLabel,
  githubUrl,
  logoAlt,
  menuCloseLabel,
  menuLabel,
  navItems,
  npmLabel,
  npmUrl,
}: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0a]/92 backdrop-blur-xl">
      <div className="mx-auto max-w-content px-4 py-2.5 sm:px-6 lg:px-8">
        <div
          className={`relative overflow-visible border border-white/10 bg-[#0d0d0d]/95 shadow-[0_14px_40px_rgba(0,0,0,0.2)] transition-all duration-300 ${
            scrolled ? "bg-[#101010]/95 shadow-[0_12px_34px_rgba(0,0,0,0.24)]" : ""
          }`}
        >
          <div className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div
            className={`flex items-center justify-between gap-4 px-4 sm:px-6 ${
              scrolled ? "py-2.5" : "py-3.5"
            }`}
          >
            <Link
              href="/#top"
              aria-label={logoAlt}
              className="flex h-[48px] items-center gap-2 border border-white/10 bg-white/[0.03] px-3 py-1.5 shadow-[0_8px_18px_rgba(0,0,0,0.12)] backdrop-blur-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span className="grid h-8 w-8 place-items-center border border-score-high/40 bg-score-high text-sm font-black text-[#0a0a0a]">
                A
              </span>
              <span
                className={`font-display font-semibold tracking-normal text-white transition-all duration-300 ${
                  scrolled ? "text-lg" : "text-xl"
                }`}
              >
                {displayName}
              </span>
            </Link>

            <nav
              className="hidden max-w-[min(100%,42rem)] flex-1 items-center justify-center gap-2 overflow-visible px-4 xl:flex"
              aria-label="Primary"
            >
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="shrink-0 border border-transparent px-3.5 py-2 text-sm font-medium text-white/70 transition-colors hover:border-white/10 hover:bg-white/[0.04] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="hidden items-center gap-2 xl:flex">
              <a
                href={npmUrl}
                className="inline-flex items-center justify-center border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/75 transition-colors hover:border-white/30 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                target="_blank"
                rel="noopener noreferrer"
              >
                {npmLabel}
              </a>
              <a
                href={githubUrl}
                className="inline-flex items-center justify-center border border-white bg-white px-4 py-2 text-sm font-semibold text-[#07110f] transition-colors hover:bg-paper-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                target="_blank"
                rel="noopener noreferrer"
              >
                {githubLabel}
              </a>
            </div>

            <div className="flex items-center gap-2 xl:hidden">
              <a
                href={githubUrl}
                className="hidden items-center justify-center border border-white bg-white px-3.5 py-2.5 text-sm font-semibold text-[#07110f] transition-colors hover:bg-paper-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:inline-flex"
                target="_blank"
                rel="noopener noreferrer"
              >
                {githubLabel}
              </a>
              <MobileMenu
                closeLabel={menuCloseLabel}
                menuLabel={menuLabel}
                items={navItems}
                secondaryItems={[
                  { href: npmUrl, label: npmLabel },
                  { href: githubUrl, label: githubLabel },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
