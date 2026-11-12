"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { gsap } from "gsap";
import { useGames } from "@/components/providers/GamesProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useUI } from "@/components/providers/UIProvider";
import { isPlayable, pickRandomGame } from "@/games/registry/registry";
import { getGameTheme } from "@/games/theme";
import { isWebGLAvailable } from "@/utils/device";
import { useBrowserFlag } from "@/utils/hooks";
import { OrbitalCard } from "@/components/universe/OrbitalCard";
import { RandomPickButton } from "@/components/universe/RandomPickButton";
import { SelectionReveal } from "@/components/universe/SelectionReveal";
import type { CardProjection, FrameProjection, HologramCard, HologramEngine } from "@/three/HologramEngine";
import { ORBIT_DRAG_SPIN } from "@/three/HologramEngine";

const HologramCanvas = dynamic(() => import("@/three/HologramCanvas"), {
  ssr: false,
  loading: () => null,
});

/** Pixels of travel before a press becomes a drag instead of a click. */
const DRAG_CLICK_THRESHOLD = 6;
/** A release more than this long after the last move carries no flick. */
const DRAG_FLICK_MAX_IDLE_MS = 120;

interface OrbitDrag {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  lastT: number;
  velX: number;
  moved: boolean;
}

export type PickPhase = "idle" | "spinning" | "revealing";

/**
 * The homepage centerpiece: a holographic machine with every registered game
 * orbiting it on a sphere, plus the cinematic RANDOM PICK sequence.
 */
export function HolographicUniverse() {
  const { games, getGame } = useGames();
  const { launch, openDetails } = useUI();
  const { quality, reducedMotion, settings, sfx } = useSettings();

  const [webglFailed, setWebglFailed] = useState(false);
  const webglAvailable = useBrowserFlag(isWebGLAvailable, true);
  const [phase, setPhase] = useState<PickPhase>("idle");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [manualPickOpen, setManualPickOpen] = useState(false);
  const [manualQuery, setManualQuery] = useState("");

  const engineRef = useRef<HologramEngine | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const projectsRef = useRef(new Map<string, CardProjection>());
  const bloomRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const reducedRef = useRef(reducedMotion);
  const busyRef = useRef(false);
  const dragRef = useRef<OrbitDrag | null>(null);
  const suppressClickRef = useRef(false);
  const [orbitDragging, setOrbitDragging] = useState(false);

  useEffect(() => {
    reducedRef.current = reducedMotion;
  }, [reducedMotion]);

  const useWebgl = webglAvailable && !webglFailed;

  /* ---------------- orbital cards ---------------- */

  const cards: HologramCard[] = useMemo(
    () =>
      games.map((g) => {
        const t = getGameTheme(g);
        return {
          id: g.id,
          title: g.title,
          primary: t.primary,
          secondary: t.secondary,
          playable: isPlayable(g),
        };
      }),
    [games],
  );

  /**
   * The engine reports screen projections every frame. They are written straight
   * to the DOM (never through React state) so the animation stays smooth.
   */
  const onProject = useCallback((frame: FrameProjection) => {
    for (const p of frame.cards) {
      projectsRef.current.set(p.id, p);
      const el = cardRefs.current.get(p.id);
      if (!el) continue;
      const depth = p.facing;
      el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -50%) rotateY(${p.rotationY.toFixed(2)}deg) rotateX(${p.rotationX.toFixed(2)}deg) scale(${p.scale.toFixed(3)})`;
      // Depth grading: the back of the sphere dims almost to silhouette while
      // the front stays fully lit, so the formation reads as genuinely three
      // dimensional instead of a flat wall of cards.
      el.style.opacity = (0.12 + Math.pow(depth, 1.35) * 0.88).toFixed(3);
      el.style.zIndex = String(1000 + Math.round(p.depth * 10));
    }
    // The machine's bloom sits above the cards so it always reads as the
    // brightest, most dominant element in the composition.
    const bloom = bloomRef.current;
    if (bloom) {
      bloom.style.transform = `translate3d(${frame.core.x.toFixed(1)}px, ${frame.core.y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${frame.core.scale.toFixed(3)})`;
    }
  }, []);

  const onReady = useCallback((engine: HologramEngine | null) => {
    engineRef.current = engine;
  }, []);

  /* ---------------- random pick ---------------- */

  const reset = useCallback(() => {
    const engine = engineRef.current;
    timelineRef.current?.kill();
    timelineRef.current = null;
    if (engine) {
      engine.autoOrbit = true;
      engine.setBoost(0, 0.14);
      engine.setSelected(null);
      engine.setSelectionProgress(0);
    }
    setSelectedId(null);
    setPhase("idle");
    busyRef.current = false;
  }, []);

  const runPick = useCallback(() => {
    if (busyRef.current) return;
    const engine = engineRef.current;
    const chosen = pickRandomGame(games);
    if (!chosen) return;

    busyRef.current = true;
    setPhase("spinning");
    sfx("hologram");

    const index = cards.findIndex((c) => c.id === chosen.id);

    // Without WebGL there is no machine to spin — show the result immediately.
    if (!engine) {
      setSelectedId(chosen.id);
      setPhase("revealing");
      busyRef.current = false;
      sfx("reveal");
      return;
    }

    const reduced = reducedRef.current;
    const target = engine.landingTargetFor(index, reduced ? 0 : 3);

    if (reduced) {
      // Reduced motion: skip the spin and jump straight to the reveal.
      engine.autoOrbit = false;
      engine.orbitAngle = target;
      engine.setSelected(chosen.id);
      engine.setSelectionProgress(1);
      setSelectedId(chosen.id);
      setPhase("revealing");
      busyRef.current = false;
      sfx("reveal");
      return;
    }

    engine.autoOrbit = false;

    const timeline = gsap.timeline({
      onComplete: () => {
        setPhase("revealing");
        busyRef.current = false;
      },
    });
    timelineRef.current = timeline;

    // 1 — accelerate: the universe comes alive.
    timeline.to(engine, { orbitSpeed: 3.4, duration: 1.15, ease: "power2.in" }, 0);
    timeline.to(engine, { energy: 1, duration: 1.15, ease: "power2.in" }, 0);

    // 2 — the machine spins, chasing its target.
    timeline.to(engine, { orbitAngle: target, duration: 2.5, ease: "power3.inOut" }, 0.2);

    // 3 — decelerate into the chosen world.
    timeline.to(engine, { orbitSpeed: 0.14, duration: 1.3, ease: "power3.out" }, "-=0.4");
    timeline.to(engine, { energy: 0.55, duration: 1.3, ease: "power2.out" }, "<");

    // 4 — the chosen card breaks the sphere and emerges.
    timeline.call(() => {
      engine.setSelected(chosen.id);
      sfx("reveal");
    });
    timeline.to(engine, { selectionProgress: 1, duration: 1.05, ease: "power3.out" });
    timeline.call(() => setSelectedId(chosen.id));
  }, [cards, games, sfx]);

  // Restore auto-orbit if the component unmounts mid-sequence.
  useEffect(
    () => () => {
      timelineRef.current?.kill();
      const engine = engineRef.current;
      if (engine) {
        engine.autoOrbit = true;
        engine.setBoost(0, 0.14);
      }
    },
    [],
  );

  /* ---------------- interactions ---------------- */

  const onCardEnter = useCallback(
    (id: string) => {
      setHoveredId(id);
      sfx("hover");
    },
    [sfx],
  );

  const onCardLeave = useCallback(() => setHoveredId(null), []);

  const onCardSelect = useCallback(
    (id: string) => {
      const game = getGame(id);
      if (!game) return;
      if (!isPlayable(game)) {
        openDetails(id);
        return;
      }
      launch(id);
    },
    [getGame, launch, openDetails],
  );

  /* ---------------- orbit drag ---------------- */

  const onStagePointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      // Touch keeps its native gestures — the page still has to scroll.
      if (e.pointerType === "touch" || e.button !== 0) return;
      if (phase !== "idle" || !engineRef.current) return;
      const target = e.target as HTMLElement;
      // Buttons and links keep their own behaviour. Orbital cards may start a
      // drag; their click is suppressed on release if the pointer moved.
      if (
        target.closest("a, button, input, textarea, select") &&
        !target.closest(".gu-orbital")
      ) {
        return;
      }

      suppressClickRef.current = false;
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        lastT: performance.now(),
        velX: 0,
        moved: false,
      };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Capture is best-effort; the handlers still work without it.
      }
      document.body.style.userSelect = "none";
      document.documentElement.dataset.guCursor = "grab";
      setOrbitDragging(true);
    },
    [phase],
  );

  const onStagePointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const now = performance.now();
    const dt = Math.max(now - d.lastT, 1) / 1000;
    const dx = e.clientX - d.lastX;
    const dy = e.clientY - d.lastY;
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    d.lastT = now;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) >= DRAG_CLICK_THRESHOLD) {
      d.moved = true;
    }
    // Exponential moving average of horizontal velocity (px/s) for the flick.
    d.velX = d.velX * 0.72 + (dx / dt) * 0.28;
    engineRef.current?.dragBy(dx, dy);
  }, []);

  const endStageDrag = useCallback(
    (e: React.PointerEvent<HTMLElement>, allowFlick: boolean) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      dragRef.current = null;
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Already released by the browser — nothing to do.
      }
      document.body.style.userSelect = "";
      delete document.documentElement.dataset.guCursor;
      setOrbitDragging(false);

      const engine = engineRef.current;
      if (engine) {
        const idleFor = performance.now() - d.lastT;
        const flick =
          allowFlick && d.moved && idleFor < DRAG_FLICK_MAX_IDLE_MS
            ? d.velX * ORBIT_DRAG_SPIN
            : 0;
        engine.endDrag(flick);
      }
      if (d.moved) suppressClickRef.current = true;
    },
    [],
  );

  const onStagePointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => endStageDrag(e, true),
    [endStageDrag],
  );

  const onStagePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLElement>) => endStageDrag(e, false),
    [endStageDrag],
  );

  // A drag that ends on top of a card must not also fire the card's click.
  const onStageClickCapture = useCallback((e: React.MouseEvent) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    e.stopPropagation();
    e.preventDefault();
  }, []);

  // Route changes mid-drag would otherwise strand the selection guard.
  useEffect(
    () => () => {
      dragRef.current = null;
      document.body.style.userSelect = "";
      delete document.documentElement.dataset.guCursor;
    },
    [],
  );

  const hovered = hoveredId ? getGame(hoveredId) : undefined;
  const selected = selectedId ? getGame(selectedId) : undefined;
  const manualGames = useMemo(() => {
    const q = manualQuery.trim().toLowerCase();
    if (!q) return games;
    return games.filter((g) =>
      [g.title, g.genre, g.category, ...(g.tags || [])].join(" ").toLowerCase().includes(q),
    );
  }, [games, manualQuery]);

  const onManualSelect = useCallback(
    (id: string) => {
      const game = getGame(id);
      if (!game) return;
      setManualPickOpen(false);
      setManualQuery("");
      if (!isPlayable(game)) {
        openDetails(id);
        return;
      }
      setSelectedId(id);
      setPhase("revealing");
    },
    [getGame, openDetails],
  );

  /* ---------------- render ---------------- */

  if (games.length === 0) {
    return (
      <section className="gu-stage gu-stage--holo" aria-label="Game Universe">
        <div className="gu-holo-empty">
          <p className="gu-kicker">Signal not detected</p>
          <p className="gu-title mt-3 text-3xl">Your universe is waiting</p>
          <Link href="/explore" className="gu-btn gu-btn--primary mt-6">
            Explore
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      className="gu-stage gu-stage--holo"
      aria-label="Holographic game universe"
      data-testid="holographic-universe"
      data-phase={phase}
      data-dragging={orbitDragging ? "true" : "false"}
      data-cursor={phase === "idle" ? "grab" : undefined}
      onPointerDown={onStagePointerDown}
      onPointerMove={onStagePointerMove}
      onPointerUp={onStagePointerUp}
      onPointerCancel={onStagePointerCancel}
      onLostPointerCapture={onStagePointerCancel}
      onClickCapture={onStageClickCapture}
    >
      {useWebgl && (
        <HologramCanvas
          cards={cards}
          quality={quality}
          reducedMotion={reducedMotion}
          particles={settings.particles}
          onReady={onReady}
          onProject={onProject}
          onFail={() => setWebglFailed(true)}
        />
      )}

      {/* Orbital cards — real DOM so they stay crisp, focusable and clickable. */}
      <div className="gu-orbit-layer" aria-label="Orbiting game worlds">
        {games.map((g) => (
          <OrbitalCard
            key={g.id}
            game={g}
            registerRef={(el) => {
              if (el) cardRefs.current.set(g.id, el);
              else cardRefs.current.delete(g.id);
            }}
            onEnter={onCardEnter}
            onLeave={onCardLeave}
            onSelect={onCardSelect}
            active={hoveredId === g.id || selectedId === g.id}
            revealed={selectedId === g.id}
          />
        ))}
      </div>

      {/* The machine's volumetric bloom — drawn above the cards so the core
          always reads as the dominant element in the composition. */}
      <div ref={bloomRef} className="gu-holo-bloom" aria-hidden />

      <div className="gu-stage-vignette" aria-hidden />

      {/* Title block */}
      <div className="gu-holo-head">
        <p className="gu-kicker gu-intro-line" style={{ animationDelay: "0.1s" }}>
          Game Universe
        </p>
        <h1 className="gu-title gu-glow-text mt-3 text-[clamp(1.9rem,4.4vw,3.6rem)]">
          <span className="gu-gradient-text">Choose</span> your world
        </h1>
        <p className="gu-holo-description mt-3 max-w-sm text-[1.05rem] text-[#aeb6ca]">
          {games.length} {games.length === 1 ? "world" : "worlds"} orbiting the core. Hover a card to
          inspect it, or let the machine choose.
        </p>

        {/* At-a-glance numbers: scale reads instantly without a click. */}
        <ul className="gu-holo-stats" aria-label="Universe at a glance">
          <li>
            <strong>{games.length}</strong>
            <span>Worlds</span>
          </li>
          <li>
            <strong>{games.filter((g) => isPlayable(g)).length}</strong>
            <span>Ready to play</span>
          </li>
          <li>
            <strong>{new Set(games.map((g) => g.genre)).size}</strong>
            <span>Genres</span>
          </li>
        </ul>
        {!webglAvailable && (
          <p className="mt-2 max-w-md text-sm text-amber" role="note">
            3D view unavailable (WebGL is disabled) — showing the flat universe. Games still play
            normally.
          </p>
        )}
      </div>

      {/* Hover readout */}
      {hovered && hovered.id !== selectedId && (
        <div className="gu-holo-readout" data-testid="holo-readout">
          <span
            className="gu-holo-readout__dot"
            style={{ background: getGameTheme(hovered).primary }}
          />
          <span className="gu-holo-readout__title">{hovered.title}</span>
          <span className="gu-holo-readout__meta">
            {hovered.category} · {hovered.genre}
          </span>
        </div>
      )}

      {/* Pick controls */}
      <div className="gu-holo-controls">
        <div className="flex flex-col items-center gap-2 sm:flex-row">
          <RandomPickButton
            phase={phase}
            disabled={games.length === 0}
            onClick={runPick}
            onReset={reset}
          />
          <button
            type="button"
            className="gu-btn"
            data-testid="manual-pick-toggle"
            onClick={() => setManualPickOpen((v) => !v)}
          >
            {manualPickOpen ? "Close picker" : "Pick manually"}
          </button>
        </div>
        <p className="gu-holo-tagline">Let the universe decide, or pick a world yourself.</p>

        {manualPickOpen && (
          <div className="gu-panel gu-clip mt-2 w-full max-w-xl p-4 text-left" data-testid="manual-picker">
            <input
              type="search"
              value={manualQuery}
              onChange={(e) => setManualQuery(e.target.value)}
              placeholder="Search worlds to pick..."
              className="gu-input w-full"
              aria-label="Search worlds to pick manually"
              autoFocus
            />
            <ul className="mt-3 max-h-56 overflow-auto pr-1">
              {manualGames.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left hover:bg-white/5"
                    onClick={() => onManualSelect(g.id)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-display text-[0.72rem] font-bold tracking-[0.12em] uppercase text-[#eef3ff]">{g.title}</span>
                      <span className="block truncate text-[0.85rem] text-[#aab2c6]">
                        {g.category} · {g.genre}{isPlayable(g) ? "" : ` · ${g.status}`}
                      </span>
                    </span>
                    <span className={`gu-btn gu-btn--sm ${isPlayable(g) ? "gu-btn--primary" : ""}`}>
                      {isPlayable(g) ? "Pick" : "Details"}
                    </span>
                  </button>
                </li>
              ))}
              {manualGames.length === 0 && (
                <li className="px-3 py-4 text-center text-[#aab2c6]">No worlds match.</li>
              )}
            </ul>
          </div>
        )}
      </div>
      {/* Selected world reveal */}
      {selected && phase === "revealing" && (
        <SelectionReveal
          game={selected}
          onPlay={() => launch(selected.id)}
          onPickAgain={reset}
          onBackToUniverse={reset}
          onDetails={() => openDetails(selected.id)}
        />
      )}

      <div className="gu-scanlines" aria-hidden />
    </section>
  );
}
