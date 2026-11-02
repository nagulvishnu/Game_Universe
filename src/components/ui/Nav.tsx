"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useUI } from "@/components/providers/UIProvider";

const LINKS = [
  { href: "/universe", label: "Universe" },
  { href: "/library", label: "Library" },
  { href: "/#featured", label: "Featured" },
  { href: "/library#search", label: "Search" },
] as const;

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      {on ? <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /> : <path d="m16 9 5 6m0-6-5 6" />}
    </svg>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { settings, setAudio } = useSettings();
  const { setSettingsOpen } = useUI();
  const [open, setOpen] = useState(false);

  if (pathname.startsWith("/game/")) return null;

  const isActive = (href: string) => {
    if (href.includes("#")) return false;
    return pathname === href || (href === "/universe" && pathname === "/");
  };

  return (
    <header className="gu-nav">
      <Link href="/" className="group flex items-center gap-3" aria-label="Game Universe — home" onClick={() => setOpen(false)}>
        <span
          className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[#6f9bff] to-[#4a76f0] shadow-[0_8px_24px_-8px_rgba(74,118,240,0.9)] transition-transform duration-300 group-hover:scale-110"
          aria-hidden
        >
          <svg width="11" height="12" viewBox="0 0 11 12" fill="none" aria-hidden>
            <path d="M10.5 5.25 1.5 0v12l9-5.25v-.5Z" fill="#fff" />
          </svg>
        </span>
        <span className="font-display text-[0.76rem] font-bold tracking-[0.28em] uppercase">
          Game <span className="text-neon">Universe</span>
        </span>
      </Link>

      <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
        {LINKS.map((l) => (
          <Link
            key={l.label}
            href={l.href}
            className="gu-navlink"
            aria-current={isActive(l.href) ? "page" : undefined}
          >
            {l.label}
          </Link>
        ))}
        <button type="button" className="gu-navlink" onClick={() => setSettingsOpen(true)}>
          Settings
        </button>
      </nav>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="gu-chip flex items-center gap-2"
          aria-pressed={settings.audio}
          aria-label={settings.audio ? "Turn audio off" : "Turn audio on"}
          onClick={() => setAudio(!settings.audio)}
        >
          <SpeakerIcon on={settings.audio} />
          <span className="hidden sm:inline">Audio</span>
        </button>
        <button
          type="button"
          className="gu-chip md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {open && (
        <nav
          id="mobile-menu"
          aria-label="Mobile"
          className="gu-panel absolute left-3 right-3 top-[calc(var(--gu-nav-h)-6px)] flex flex-col gap-1 p-4 md:hidden"
        >
          {LINKS.map((l) => (
            <Link key={l.label} href={l.href} className="gu-navlink block py-3" onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          <button
            type="button"
            className="gu-navlink block py-3 text-left"
            onClick={() => {
              setOpen(false);
              setSettingsOpen(true);
            }}
          >
            Settings
          </button>
        </nav>
      )}
    </header>
  );
}
