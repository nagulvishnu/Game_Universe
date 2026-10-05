"use client";

import { useEffect, useMemo, useRef } from "react";
import type { GameRecord } from "@/games/types";
import { getGameTheme, hashString } from "@/games/theme";
import { isPlayable } from "@/games/registry/registry";
import { UniverseEngine } from "./UniverseEngine";
import type { PortalSpec, Quality } from "./UniverseEngine";

export interface UniverseCanvasProps {
  games: GameRecord[];
  quality: Quality;
  reducedMotion: boolean;
  particles: boolean;
  activeId: string | null;
  launchId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string, pointerType: string) => void;
  onProject: (p: { x: number; y: number } | null) => void;
  onFail: () => void;
}

/** React shell around the imperative Three.js engine: creates it once per config, disposes on cleanup. */
export default function UniverseCanvas(props: UniverseCanvasProps) {
  const { games, quality, reducedMotion, particles, activeId, launchId } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<UniverseEngine | null>(null);
  const cb = useRef(props);

  useEffect(() => {
    cb.current = props;
  });

  const specs = useMemo<PortalSpec[]>(
    () =>
      games.map((g) => {
        const t = getGameTheme(g);
        return {
          id: g.id,
          title: g.title,
          kind: t.kind,
          primary: t.primary,
          secondary: t.secondary,
          seed: hashString(g.id),
          playable: isPlayable(g),
        };
      }),
    [games],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let engine: UniverseEngine;
    try {
      engine = new UniverseEngine(el, {
        quality,
        reducedMotion,
        particles,
        portals: specs,
        onHover: (id) => cb.current.onHover(id),
        onSelect: (id, type) => cb.current.onSelect(id, type),
        onProject: (p) => cb.current.onProject(p),
        onContextLost: () => cb.current.onFail(),
      });
    } catch {
      cb.current.onFail();
      return;
    }
    engineRef.current = engine;
    engine.setActive(cb.current.activeId);
    if (cb.current.launchId) engine.launch(cb.current.launchId);
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [specs, quality, reducedMotion, particles]);

  useEffect(() => {
    engineRef.current?.setActive(activeId);
  }, [activeId]);

  useEffect(() => {
    if (launchId) engineRef.current?.launch(launchId);
    else engineRef.current?.cancelLaunch();
  }, [launchId]);

  return <div ref={containerRef} className="absolute inset-0" data-testid="universe-canvas" />;
}
