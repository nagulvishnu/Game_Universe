"use client";

import { useEffect, useRef } from "react";
import { useGames } from "@/components/providers/GamesProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useUI } from "@/components/providers/UIProvider";
import { GameArt } from "@/components/games/GameArt";
import { StatusBadge } from "@/components/games/StatusBadge";
import { Reveal } from "@/components/ui/Reveal";
import { isPlayable } from "@/games/registry/registry";
import type { GameRecord } from "@/games/types";
import { themeStyle } from "@/ui/themeStyle";

function Spotlight({ game, big }: { game: GameRecord; big: boolean }) {
  const { launch, openDetails } = useUI();
  const { reducedMotion } = useSettings();
  const wrap = useRef<HTMLDivElement>(null);
  const art = useRef<HTMLDivElement>(null);
  const playable = isPlayable(game);

  // Light scroll parallax on the banner (skipped for reduced motion).
  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const w = wrap.current;
      const a = art.current;
      if (!w || !a) return;
      const r = w.getBoundingClientRect();
      const p = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
      a.style.transform = `translate3d(0, ${p * -40}px, 0) scale(1.12)`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reducedMotion]);

  return (
    <div
      ref={wrap}
      className={`gu-clip relative isolate overflow-hidden border border-[var(--c1)] ${big ? "min-h-[460px]" : "min-h-[340px]"}`}
      style={themeStyle(game)}
      data-testid="featured-game"
    >
      <div ref={art} className="absolute inset-0 -z-10 will-change-transform">
        <GameArt game={game} variant="banner" className="h-full w-full" />
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#04040b] via-[#04040bcc] to-transparent" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#04040b] via-transparent to-transparent" />
      <div className="gu-scanlines" />
      <div className={`flex h-full flex-col justify-end gap-4 p-7 sm:p-10 ${big ? "max-w-2xl" : "max-w-lg"}`}>
        <StatusBadge game={game} />
        <p className="gu-kicker" style={{ color: "var(--c1)" }}>
          {game.flagship ? "Flagship" : "Featured"} · {game.category} · {game.genre}
        </p>
        <h3 className={`gu-title gu-glow-text ${big ? "text-4xl sm:text-6xl" : "text-3xl sm:text-4xl"}`}>{game.title}</h3>
        <p className="line-clamp-3 text-lg text-[#c9d1f5]">{game.description}</p>
        <div className="flex flex-wrap gap-3 pt-1">
          <button
            type="button"
            className="gu-btn gu-btn--primary"
            disabled={!playable}
            onClick={() => launch(game.id)}
            data-cursor="play"
          >
            {playable ? "▶ Play now" : game.status === "development" ? "In development" : "Coming soon"}
          </button>
          <button type="button" className="gu-btn" onClick={() => openDetails(game.id)}>
            Details
          </button>
        </div>
      </div>
    </div>
  );
}

export function FeaturedSection() {
  const { featured } = useGames();
  if (featured.length === 0) return null;
  const [first, ...rest] = featured;
  return (
    <section id="featured" aria-labelledby="featured-heading" className="relative scroll-mt-16 px-[clamp(1rem,4vw,4rem)] py-24">
      <div className="mx-auto max-w-[1400px]">
        <Reveal>
          <p className="gu-kicker">Featured</p>
          <h2 id="featured-heading" className="gu-title mt-3 text-3xl sm:text-5xl">
            Enter the <span className="gu-gradient-text">spotlight</span>
          </h2>
        </Reveal>
        <Reveal className="mt-10" delay={80}>
          <Spotlight game={first} big />
        </Reveal>
        {rest.length > 0 && (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {rest.slice(0, 4).map((g, i) => (
              <Reveal key={g.id} delay={i * 80}>
                <Spotlight game={g} big={false} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function AboutSection() {
  const items = [
    {
      n: "01",
      t: "Discovery",
      d: "Every folder in /games with a game.json becomes a world. The hub validates it at build time and skips anything broken — without ever crashing.",
    },
    {
      n: "02",
      t: "Isolation",
      d: "Games are never merged into the hub. Each one runs in its own sandboxed frame with its own code, controls and save data.",
    },
    {
      n: "03",
      t: "Launch",
      d: "One dynamic route — /game/:id — launches any registered game, with real load progress, fullscreen, and a way home.",
    },
  ];
  return (
    <section id="about" aria-labelledby="about-heading" className="relative px-[clamp(1rem,4vw,4rem)] py-24">
      <div className="mx-auto max-w-[1400px]">
        <Reveal>
          <p className="gu-kicker">About the universe</p>
          <h2 id="about-heading" className="gu-title mt-3 max-w-3xl text-3xl sm:text-5xl">
            One home for <span className="gu-gradient-text">every game</span> I build
          </h2>
          <p className="mt-5 max-w-2xl text-lg text-[#b8c2ee]">
            This is a personal arcade and portfolio: a launcher that grows on its own. Drop a new game into the games
            folder and a new world appears in the universe.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {items.map((it, i) => (
            <Reveal key={it.n} delay={i * 100}>
              <div className="gu-panel gu-clip h-full p-7">
                <p className="font-display text-4xl font-black text-transparent [-webkit-text-stroke:1px_var(--gu-cyan)]">{it.n}</p>
                <h3 className="gu-title mt-4 text-xl">{it.t}</h3>
                <p className="mt-3 text-[#b8c2ee]">{it.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-[var(--gu-line)] px-[clamp(1rem,4vw,4rem)] py-8">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 text-sm text-dim">
        <p className="font-display text-[0.65rem] tracking-[0.3em] uppercase">Nagul&apos;s Game Universe</p>
        <p>Every world is an independent game.</p>
      </div>
    </footer>
  );
}
