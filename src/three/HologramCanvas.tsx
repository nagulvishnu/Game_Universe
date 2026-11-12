"use client";

import { useEffect, useRef } from "react";
import { HologramEngine } from "./HologramEngine";
import type { FrameProjection, HologramCard, HologramEngineOptions } from "./HologramEngine";

export interface HologramCanvasProps {
  cards: HologramCard[];
  quality: "high" | "medium" | "low";
  reducedMotion: boolean;
  particles: boolean;
  /** Receives the live engine so the parent can drive the cinematic sequence. */
  onReady: (engine: HologramEngine | null) => void;
  /** Called every frame with the latest screen projection of every card. */
  onProject: (frame: FrameProjection) => void;
  /** Called when WebGL fails so the UI can fall back to a static layout. */
  onFail: () => void;
}

/**
 * React shell around the imperative hologram engine.
 * Creates the engine once per configuration and disposes it on cleanup.
 */
export default function HologramCanvas({
  cards,
  quality,
  reducedMotion,
  particles,
  onReady,
  onProject,
  onFail,
}: HologramCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cb = useRef({ onProject, onFail, onReady });

  useEffect(() => {
    cb.current = { onProject, onFail, onReady };
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let engine: HologramEngine;
    try {
      engine = new HologramEngine(el, {
        quality,
        reducedMotion,
        particles,
        cards,
        onFail: () => cb.current.onFail(),
      } satisfies HologramEngineOptions);
    } catch {
      cb.current.onFail();
      return;
    }
    engine.setListener((p) => cb.current.onProject(p));
    cb.current.onReady(engine);
    return () => {
      cb.current.onReady(null);
      engine.dispose();
    };
  }, [quality, reducedMotion, particles, cards]);

  return <div ref={containerRef} className="absolute inset-0" data-testid="hologram-canvas" />;
}
