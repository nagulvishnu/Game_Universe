"use client";

import { useEffect, useRef } from "react";
import { useSettings } from "@/components/providers/SettingsProvider";

const STAR_COUNT = 140;
const DUST_COUNT = 26;

interface Star {
  x: number;
  y: number;
  r: number;
  a: number;
  tw: number;
  hue: number;
}

/**
 * The atmospheric layer that sits behind everything: a deep-space gradient,
 * drifting stars and slow motes.
 *
 * It is a single canvas painted once and only re-painted when the parallax
 * changes, so it costs almost nothing on any device.
 */
export function ParticleEnvironment() {
  const { reducedMotion } = useSettings();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let stars: Star[] = [];
    let dust: Star[] = [];
    let raf = 0;
    let pointerX = 0.5;
    let pointerY = 0.5;
    let targetX = 0.5;
    let targetY = 0.5;
    let running = true;
    let visible = true;

    const build = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = reducedMotion ? Math.round(STAR_COUNT * 0.45) : STAR_COUNT;
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.4 + Math.random() * 1.3,
        a: 0.15 + Math.random() * 0.65,
        tw: Math.random() * Math.PI * 2,
        hue: 210 + Math.random() * 90,
      }));

      dust = Array.from({ length: reducedMotion ? 0 : DUST_COUNT }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 1.2 + Math.random() * 2.6,
        a: 0.05 + Math.random() * 0.14,
        tw: Math.random() * Math.PI * 2,
        hue: 200 + Math.random() * 120,
      }));
    };

    const paint = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      const ox = (pointerX - 0.5) * 26;
      const oy = (pointerY - 0.5) * 18;

      for (const s of stars) {
        const twinkle = reducedMotion ? 1 : 0.65 + 0.35 * Math.sin(t * 0.0012 + s.tw);
        ctx.beginPath();
        ctx.fillStyle = `hsla(${s.hue}, 85%, 78%, ${s.a * twinkle})`;
        ctx.arc(s.x + ox, s.y + oy, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const d of dust) {
        const drift = Math.sin(t * 0.0004 + d.tw) * 16;
        ctx.beginPath();
        const grad = ctx.createRadialGradient(d.x + ox, d.y + oy + drift, 0, d.x + ox, d.y + oy + drift, d.r * 4);
        grad.addColorStop(0, `hsla(${d.hue}, 90%, 72%, ${d.a})`);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(d.x + ox - d.r * 4, d.y + oy + drift - d.r * 4, d.r * 8, d.r * 8);
      }
    };

    const loop = (t: number) => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      pointerX += (targetX - pointerX) * 0.05;
      pointerY += (targetY - pointerY) * 0.05;
      paint(t);
    };

    const onPointer = (e: PointerEvent) => {
      targetX = e.clientX / Math.max(window.innerWidth, 1);
      targetY = e.clientY / Math.max(window.innerHeight, 1);
    };

    const onResize = () => {
      build();
      paint(performance.now());
    };

    const onVisibility = () => {
      running = !document.hidden;
      if (running) raf = requestAnimationFrame(loop);
      else cancelAnimationFrame(raf);
    };

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[entries.length - 1]?.isIntersecting ?? true;
      },
      { threshold: 0 },
    );

    build();
    paint(0);
    raf = requestAnimationFrame(loop);
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    io.observe(canvas);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      io.disconnect();
    };
  }, [reducedMotion]);

  return (
    <div className="gu-void" aria-hidden data-testid="particle-environment">
      <div className="gu-void__gradient" />
      <div className="gu-void__nebula gu-void__nebula--a" />
      <div className="gu-void__nebula gu-void__nebula--b" />
      <div className="gu-void__nebula gu-void__nebula--c" />
      <canvas ref={canvasRef} className="gu-void__canvas" />
      <div className="gu-void__vignette" />
    </div>
  );
}
