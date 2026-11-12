import { useEffect, useRef } from "react";
import { Game } from "../game/engine";
import { useApp } from "../game/store";

let current: Game | null = null;
export const getGame = () => current;

export default function GameView({ begin }: { begin: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const matchKey = useApp((s) => s.matchKey);

  useEffect(() => {
    const el = ref.current!;
    const st = useApp.getState();
    let cancelled = false;
    let g: Game | null = null;
    const t = setTimeout(() => {
      if (cancelled) return;
      g = new Game(el, {
        p1: st.p1, p2: st.p2, arena: st.arena, mode: st.mode, quality: st.settings.quality, shake: st.settings.shake,
        damageNumbers: st.settings.damageNumbers, fps: st.settings.fpsCounter,
        onMatchEnd: (r) => useApp.getState().finishMatch(r),
      });
      gameRef.current = g;
      current = g;
      (window as unknown as { __game: Game }).__game = g;
      if (useApp.getState().screen === "game") g.begin();
    }, 60);
    return () => {
      cancelled = true;
      clearTimeout(t);
      if (g) { g.dispose(); if (current === g) current = null; }
      gameRef.current = null;
    };
  }, [matchKey]);

  useEffect(() => {
    if (begin) gameRef.current?.begin();
  }, [begin]);

  return <div ref={ref} className="absolute inset-0 bg-black" />;
}
