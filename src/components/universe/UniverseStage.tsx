"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useGames } from "@/components/providers/GamesProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useUI } from "@/components/providers/UIProvider";
import { GameArt } from "@/components/games/GameArt";
import { StatusBadge } from "@/components/games/StatusBadge";
import { EmptyUniverse } from "@/components/games/EmptyUniverse";
import { isPlayable } from "@/games/registry/registry";
import { getGameTheme } from "@/games/theme";
import { themeStyle } from "@/ui/themeStyle";
import { isWebGLAvailable } from "@/utils/device";
import { useBrowserFlag, useMediaQuery } from "@/utils/hooks";

const UniverseCanvas = dynamic(() => import("@/three/UniverseCanvas"), { ssr: false, loading: () => null });

type Mode = "webgl" | "simple";

/**
 * The 3D Game Universe viewport. Falls back to a lite hero (animated 2D backdrop + featured game)
 * on small screens or when WebGL is unavailable. The library below keeps working either way.
 */
export function UniverseStage({ home = false }: { home?: boolean }) {
  const { games, featured, getGame } = useGames();
  const { launch, openDetails, launching } = useUI();
  const { quality, reducedMotion, settings, sfx } = useSettings();
  const [webglFailed, setWebglFailed] = useState(false);
  const webglAvailable = useBrowserFlag(isWebGLAvailable, true);
  const narrow = useMediaQuery("(max-width: 767px)");
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [dockId, setDockId] = useState<string | null>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const webgl = webglAvailable && !webglFailed;
  const mode: Mode = narrow || !webgl ? "simple" : "webgl";

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const scheduleRelease = useCallback(() => {
    clearTimer();
    timer.current = setTimeout(() => setHoverId(null), 350);
  }, []);

  useEffect(() => () => clearTimer(), []);

  const activeId = hoverId ?? dockId;
  const active = activeId ? getGame(activeId) : undefined;
  const labelOn = !!activeId;

  // Tell the custom cursor when a portal is hovered.
  useEffect(() => {
    const root = document.documentElement;
    if (hoverId && active && isPlayable(active)) root.dataset.guCursor = "play";
    else delete root.dataset.guCursor;
    return () => {
      delete root.dataset.guCursor;
    };
  }, [hoverId, active]);

  const onHover = useCallback(
    (id: string | null) => {
      if (id) {
        clearTimer();
        setHoverId((prev) => {
          if (prev !== id) sfx("hover");
          return id;
        });
      } else scheduleRelease();
    },
    [scheduleRelease, sfx],
  );

  const onSelect = useCallback(
    (id: string, pointerType: string) => {
      // Touch: first tap previews (hover state), PLAY button launches.
      if (pointerType !== "mouse") return;
      launch(id);
    },
    [launch],
  );

  const onProject = useCallback((p: { x: number; y: number } | null) => {
    const el = labelRef.current;
    if (!el) return;
    if (!p) {
      el.style.opacity = "0";
      return;
    }
    el.style.opacity = "1";
    el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, 0)`;
  }, []);

  const hero = featured[0] ?? games[0];

  return (
    <section
      className="gu-stage"
      aria-label="Game Universe"
      data-testid="universe-stage"
      data-mode={mode}
    >
      {mode === "webgl" && games.length > 0 && (
        <UniverseCanvas
          games={games}
          quality={quality}
          reducedMotion={reducedMotion}
          particles={settings.particles}
          activeId={activeId}
          launchId={launching?.id ?? null}
          onHover={onHover}
          onSelect={onSelect}
          onProject={onProject}
          onFail={() => setWebglFailed(true)}
        />
      )}
      {mode !== "webgl" && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="gu-fallback-orb left-[8%] top-[12%] h-72 w-72 bg-violet" />
          <div className="gu-fallback-orb right-[6%] top-[30%] h-80 w-80 bg-neon" style={{ animationDelay: "-5s", opacity: 0.3 }} />
          <div className="gu-fallback-orb bottom-[5%] left-[35%] h-64 w-64 bg-magenta" style={{ animationDelay: "-9s", opacity: 0.25 }} />
          <div className="gu-atmo-grid" />
        </div>
      )}
      <div className="gu-stage-vignette" />

      {/* Title block */}
      <div className={`pointer-events-none absolute left-0 top-0 z-10 px-[clamp(1.25rem,4vw,4rem)] pt-[clamp(5.5rem,14vh,8rem)] ${mode === "simple" ? "right-0" : ""}`}>
        <p className="gu-kicker gu-intro-line" style={{ animationDelay: "0.1s" }}>
          Nagul&apos;s
        </p>
        <h1 className="gu-title gu-glow-text mt-3 text-[clamp(2.2rem,6.2vw,5.4rem)]">
          <span className="gu-gradient-text">Game</span> Universe
        </h1>
        <p className="mt-4 max-w-md text-lg text-[#b8c2ee]">
          {games.length > 0
            ? mode === "simple"
              ? `${games.length} ${games.length === 1 ? "world" : "worlds"} ready to play.`
              : `${games.length} ${games.length === 1 ? "world" : "worlds"} discovered. Hover a world, click to enter.`
            : "An empty universe, ready for its first world."}
        </p>
        {!webgl && (
          <p className="mt-2 max-w-md text-sm text-amber" role="note">
            3D view unavailable (WebGL is disabled) — showing the lite universe. Games still play normally.
          </p>
        )}
      </div>

      {games.length === 0 && (
        <div className="absolute inset-x-0 bottom-0 top-[40%] z-10 flex items-center px-4">
          <EmptyUniverse />
        </div>
      )}

      {/* Floating world label (positioned by the engine, no React re-render) */}
      {mode === "webgl" && (
        <div ref={labelRef} className="gu-label z-10" style={{ opacity: 0 }} aria-hidden>
          {labelOn && active && (
            <>
              <p className="text-[0.6rem] text-neon">{getGameTheme(active).world}</p>
              <p className="mt-1 text-lg font-extrabold text-white [text-shadow:0_0_18px_var(--c1)]" style={themeStyle(active)}>
                {active.title}
              </p>
            </>
          )}
        </div>
      )}

      {/* Hover / focus preview card */}
      {mode === "webgl" && active && !launching && (
        <div
          key={active.id}
          className="gu-preview gu-panel gu-clip absolute bottom-24 left-1/2 z-20 w-[min(92vw,520px)] -translate-x-1/2 px-6 py-5"
          style={{ ...themeStyle(active), borderColor: "var(--c1)" }}
          onPointerEnter={clearTimer}
          onPointerLeave={scheduleRelease}
          data-testid="portal-preview"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="gu-kicker" style={{ color: "var(--c1)" }}>
                {active.category} · {active.genre}
              </p>
              <h2 className="gu-title mt-1 text-2xl sm:text-3xl">{active.title}</h2>
            </div>
            <StatusBadge game={active} />
          </div>
          <p className="mt-2 line-clamp-2 text-[1.05rem] text-[#c2cbf2]">{active.description}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="gu-btn gu-btn--primary"
              disabled={!isPlayable(active)}
              onClick={() => launch(active.id)}
              data-cursor="play"
            >
              {isPlayable(active) ? "▶ Play" : active.status === "development" ? "In development" : "Coming soon"}
            </button>
            <button type="button" className="gu-btn" onClick={() => openDetails(active.id)}>
              Details
            </button>
          </div>
        </div>
      )}

      {/* Simple (mobile / no-WebGL) hero */}
      {mode !== "webgl" && hero && (
        <div className="absolute inset-x-0 bottom-0 z-10 px-[clamp(1rem,4vw,4rem)] pb-16">
          <div
            className="gu-panel gu-clip gu-corners mx-auto grid max-w-4xl overflow-hidden sm:grid-cols-[1.1fr_1fr]"
            style={{ ...themeStyle(hero), borderColor: "var(--c1)" }}
            data-testid="simple-hero"
          >
            <GameArt game={hero} variant="banner" className="aspect-[16/9] w-full sm:aspect-auto sm:min-h-[220px]" />
            <div className="flex flex-col justify-center gap-3 p-5">
              <p className="gu-kicker" style={{ color: "var(--c1)" }}>
                {featured[0] ? "Featured game" : "Play now"}
              </p>
              <h2 className="gu-title text-2xl">{hero.title}</h2>
              <p className="line-clamp-3 text-[#c2cbf2]">{hero.description}</p>
              <div className="flex flex-wrap gap-3 pt-1">
                <button type="button" className="gu-btn gu-btn--primary" disabled={!isPlayable(hero)} onClick={() => launch(hero.id)}>
                  ▶ Play
                </button>
                <Link href="/library" className="gu-btn">
                  Library
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dock — keyboard-accessible list of every world */}
      {mode === "webgl" && games.length > 0 && (
        <nav
          aria-label="Game worlds"
          className="absolute inset-x-0 bottom-4 z-20 flex justify-center px-4"
        >
          <ul className="flex max-w-full gap-2 overflow-x-auto pb-1">
            {games.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  className="gu-dock-btn"
                  style={themeStyle(g)}
                  aria-current={activeId === g.id}
                  onPointerEnter={() => {
                    clearTimer();
                    setDockId(g.id);
                  }}
                  onPointerLeave={() => setDockId(null)}
                  onFocus={() => {
                    clearTimer();
                    setHoverId(null);
                    setDockId(g.id);
                  }}
                  onBlur={() => setDockId((p) => (p === g.id ? null : p))}
                  onClick={() => launch(g.id)}
                  aria-label={`${g.title} — ${isPlayable(g) ? "play" : g.status}`}
                >
                  <i aria-hidden />
                  {g.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {home && games.length > 0 && (
        <a
          href="#featured"
          className="gu-bob absolute bottom-5 right-[clamp(1rem,3vw,2.5rem)] z-20 hidden flex-col items-center gap-1 font-display text-[0.55rem] tracking-[0.3em] text-dim hover:text-neon sm:flex"
          aria-label="Scroll to featured games"
        >
          SCROLL
          <svg width="14" height="20" viewBox="0 0 14 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M7 2v14m0 0-5-5m5 5 5-5" />
          </svg>
        </a>
      )}
      <div className="gu-scanlines" />
    </section>
  );
}
