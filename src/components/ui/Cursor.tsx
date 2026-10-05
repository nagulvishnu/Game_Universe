"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSettings } from "@/components/providers/SettingsProvider";

type Mode = "default" | "link" | "play" | "text";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

const MAX_PARTICLES = 28;

/**
 * Premium cursor: glowing dot + lagging ring. Expands & shows PLAY over games,
 * with a small particle trail. Disabled on touch devices, inside games, and for reduced motion trails.
 */
export function Cursor() {
  const { reducedMotion } = useSettings();
  const pathname = usePathname();
  const [fine, setFine] = useState(false);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLCanvasElement>(null);
  const inGame = pathname.startsWith("/game/");
  const enabled = fine && !inGame;

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const on = () => setFine(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    root.classList.add("gu-cursor");

    const dot = dotRef.current!;
    const ring = ringRef.current!;
    const canvas = trailRef.current!;
    const ctx = canvas.getContext("2d");

    let mx = -100;
    let my = -100;
    let rx = -100;
    let ry = -100;
    let domMode: Mode = "default";
    let current: Mode = "default";
    let visible = false;
    let raf = 0;
    const particles: Particle[] = [];

    const sizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    sizeCanvas();

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      mx = e.clientX;
      my = e.clientY;
      if (!visible) {
        visible = true;
        rx = mx;
        ry = my;
        dot.style.opacity = "1";
        ring.style.opacity = "1";
      }
    };
    const onOver = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t || !t.closest) return;
      const explicit = t.closest("[data-cursor]")?.getAttribute("data-cursor");
      if (explicit === "play") domMode = "play";
      else if (t.closest("input, textarea, select")) domMode = "text";
      else if (t.closest("a, button, [role='button'], [role='switch'], summary, label")) domMode = "link";
      else domMode = "default";
    };
    const onLeaveDoc = () => {
      visible = false;
      dot.style.opacity = "0";
      ring.style.opacity = "0";
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      // Universe hover (WebGL portals) publishes its state on <html>.
      const universe = root.dataset.guCursor as Mode | undefined;
      const mode: Mode = universe === "play" ? "play" : domMode;
      if (mode !== current) {
        current = mode;
        ring.dataset.mode = mode;
        dot.dataset.mode = mode;
      }
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      dot.style.transform = `translate3d(${mx}px,${my}px,0)`;
      ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;

      if (!ctx) return;
      if (mode === "play" && !reducedMotion && visible && particles.length < MAX_PARTICLES && Math.random() < 0.7) {
        particles.push({
          x: rx + (Math.random() - 0.5) * 10,
          y: ry + (Math.random() - 0.5) * 10,
          vx: (Math.random() - 0.5) * 1.2,
          vy: (Math.random() - 0.5) * 1.2 - 0.3,
          life: 1,
        });
      }
      if (particles.length > 0 || canvas.dataset.dirty === "1") {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.dataset.dirty = particles.length > 0 ? "1" : "0";
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.035;
          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
          ctx.globalAlpha = p.life * 0.8;
          ctx.fillStyle = i % 2 ? "#38e8ff" : "#b07cff";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1 + p.life * 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    };
    raf = requestAnimationFrame(tick);

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeaveDoc);
    window.addEventListener("resize", sizeCanvas);
    return () => {
      cancelAnimationFrame(raf);
      root.classList.remove("gu-cursor");
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      document.documentElement.removeEventListener("pointerleave", onLeaveDoc);
      window.removeEventListener("resize", sizeCanvas);
    };
  }, [enabled, reducedMotion]);

  if (!enabled) return null;
  return (
    <div aria-hidden="true">
      <canvas ref={trailRef} className="gu-cursor-trail" />
      <div ref={ringRef} className="gu-cursor-ring" data-mode="default">
        <i />
        <span>PLAY</span>
      </div>
      <div ref={dotRef} className="gu-cursor-dot" />
    </div>
  );
}
