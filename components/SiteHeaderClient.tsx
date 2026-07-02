"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { MobileMenu } from "@/components/MobileMenu";

type NavItem = {
  href: string;
  label: string;
};

type Props = {
  githubLabel: string;
  githubUrl: string;
  logo: {
    src: string;
    width: number;
    height: number;
  };
  logoAlt: string;
  menuCloseLabel: string;
  menuLabel: string;
  navItems: NavItem[];
  npmLabel: string;
  npmUrl: string;
};

export function SiteHeaderClient({
  githubLabel,
  githubUrl,
  logo,
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
    <header
      className="sticky top-0 z-50 border-b border-white/10 bg-[#07110f]/90 backdrop-blur-xl"
    >
      <div className="mx-auto max-w-content px-4 py-3 sm:px-6 lg:px-8">
        <div
          className={`relative overflow-visible rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_18px_50px_rgba(0,0,0,0.18)] transition-all duration-300 ${
            scrolled ? "bg-white/[0.07] shadow-[0_16px_42px_rgba(0,0,0,0.22)]" : ""
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
              className="flex items-center rounded-xl bg-white px-3 py-2 shadow-[0_10px_28px_rgba(0,0,0,0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Image
                src={logo.src}
                alt={logoAlt}
                width={logo.width}
                height={logo.height}
                priority
                className={`${scrolled ? "h-9" : "h-10"} w-auto transition-all duration-300`}
              />
            </Link>

            <nav
              className="hidden max-w-[min(100%,42rem)] flex-1 items-center justify-center gap-2 overflow-visible px-4 xl:flex"
              aria-label="Primary"
            >
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="shrink-0 rounded-full px-3.5 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="hidden items-center gap-2 xl:flex">
              <a
                href={npmUrl}
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white/75 transition-colors hover:border-white/30 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                target="_blank"
                rel="noopener noreferrer"
              >
                {npmLabel}
              </a>
              <a
                href={githubUrl}
                className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#07110f] transition-colors hover:bg-paper-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                target="_blank"
                rel="noopener noreferrer"
              >
                {githubLabel}
              </a>
            </div>

            <div className="flex items-center gap-2 xl:hidden">
              <a
                href={githubUrl}
                className="hidden items-center justify-center rounded-full bg-white px-3.5 py-2.5 text-sm font-semibold text-[#07110f] transition-colors hover:bg-paper-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:inline-flex"
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
