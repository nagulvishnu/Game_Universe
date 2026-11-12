"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useUI } from "@/components/providers/UIProvider";
import { useGames } from "@/components/providers/GamesProvider";
import { searchGames } from "@/games/registry/registry";
import { useFullscreen } from "@/utils/hooks";
import { GlobalSearch } from "@/components/nav/GlobalSearch";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore Games" },
  { href: "/categories", label: "Categories" },
  { href: "/about", label: "About" },
] as const;

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      {on ? (
        <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
      ) : (
        <path d="m16 9 5 6m0-6-5 6" />
      )}
    </svg>
  );
}

function ExpandIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      {active ? (
        <path d="M9 3v6H3M15 21v-6h6M3 15h6V21M21 9h-6V3" />
      ) : (
        <path d="M3 9V4h5M21 15v5h-5M14 3h7v7M10 21H3v-7" />
      )}
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

/**
 * The site navigation: brand, primary links, search, sound and fullscreen.
 */
export function MainNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { settings, setAudio } = useSettings();
  const { setSettingsOpen } = useUI();
  const { games } = useGames();
  const { supported: fsSupported, active: fullscreen } = useFullscreen();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Escape closes the search overlay.
  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  const toggleFullscreen = () => {
    if (!fsSupported) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname === "/universe";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  // Game routes render their own fullscreen launcher chrome — the hub nav must
  // not sit on top of the game's own header.
  if (pathname?.startsWith("/game/")) return null;

  return (
    <header className="gu-nav">
      <Link href="/" className="gu-nav__brand" aria-label="Game Universe — home">
        <span className="gu-nav__mark" aria-hidden>
          <svg width="13" height="14" viewBox="0 0 13 14" fill="none">
            <path d="M12 7 1 0.5v13L12 7v-0.5Z" fill="currentColor" />
          </svg>
        </span>
        <span className="gu-nav__wordmark">
          Game <span className="gu-nav__wordmark-accent">Universe</span>
        </span>
      </Link>

      <nav aria-label="Primary" className="gu-nav__links">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="gu-navlink"
            aria-current={isActive(l.href) ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="gu-nav__tools">
        <button
          type="button"
          className="gu-iconbtn"
          aria-label="Search games"
          aria-expanded={searchOpen}
          onClick={() => setSearchOpen((o) => !o)}
          data-testid="nav-search"
        >
          <SearchIcon />
        </button>

        <button
          type="button"
          className="gu-iconbtn"
          aria-label={settings.audio ? "Turn sound off" : "Turn sound on"}
          aria-pressed={settings.audio}
          onClick={() => setAudio(!settings.audio)}
          data-testid="nav-sound"
        >
          <SpeakerIcon on={settings.audio} />
        </button>

        <button
          type="button"
          className="gu-iconbtn gu-iconbtn--wide"
          aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          onClick={toggleFullscreen}
          data-testid="nav-fullscreen"
        >
          <ExpandIcon active={fullscreen} />
        </button>

        <button
          type="button"
          className="gu-iconbtn gu-iconbtn--wide gu-nav__menu-btn"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="gu-nav__menu-glyph" data-open={open ? "true" : "false"} aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        </button>
      </div>

      {searchOpen && (
        <GlobalSearch
          games={games}
          onClose={() => setSearchOpen(false)}
          onNavigate={(href) => {
            setSearchOpen(false);
            router.push(href);
          }}
        />
      )}

      {open && (
        <nav
          id="mobile-menu"
          ref={menuRef}
          aria-label="Mobile"
          className="gu-nav__mobile gu-panel"
        >
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="gu-navlink gu-nav__mobile-link"
            aria-current={isActive(l.href) ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            {l.label}
          </Link>
        ))}
          <button
            type="button"
            className="gu-navlink gu-nav__mobile-link"
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

export { searchGames };
