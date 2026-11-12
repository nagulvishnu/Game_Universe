import { useEffect, useRef, useState } from 'react';
import { game, useFade } from './game/game';
import { audio } from './game/audio';
import { bus, idbGet, useGame, type SaveData } from './game/store';
import { Menu } from './ui/Menu';
import { Hud, Overlays } from './ui/Hud';
import { Panels } from './ui/Panels';
import { Touch, isTouch } from './ui/Touch';

export default function App() {
  const ref = useRef<HTMLCanvasElement>(null);
  const screen = useGame((s) => s.screen);
  const session = useGame((s) => s.session);
  const ui = useGame((s) => s.settings.uiScale);
  const post = useGame((s) => s.settings.post);
  const reducedMotion = useGame((s) => s.settings.reducedMotion);
  const fade = useFade((s) => s.v);
  const [fatal, setFatal] = useState<string | null>(null);
  useEffect(() => {
    try {
      game.init(ref.current!);
      game.start();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The 3D renderer could not be started.';
      queueMicrotask(() => setFatal(message));
      return;
    }
    idbGet<string>('latest')
      .then((k) => {
        if (k) useGame.setState({ hasSave: true });
      })
      .catch(() => {
        /* save detection is best-effort */
      });
    const u = bus.on('requestLock', () => {
      try {
        const request = ref.current?.requestPointerLock?.();
        if (request && typeof (request as Promise<void>).catch === 'function') {
          (request as Promise<void>).catch(() => {
            /* pointer lock can be refused outside a user gesture */
          });
        }
      } catch {
        /* ignore */
      }
    });
    return () => {
      u();
      game.dispose();
    };
  }, []);
  useEffect(() => {
    if (session > 0) game.newSession(useGame.getState().save.savedAt > 0);
  }, [session]);
  useEffect(() => {
    audio.setMode(screen === 'menu' ? 'menu' : audio.mode === 'menu' ? 'city' : audio.mode);
  }, [screen]);
  useEffect(() => {
    const h = () => audio.init();
    window.addEventListener('pointerdown', h);
    window.addEventListener('keydown', h);
    return () => {
      window.removeEventListener('pointerdown', h);
      window.removeEventListener('keydown', h);
    };
  }, []);
  useEffect(() => {
    const i = setInterval(() => {
      const s = useGame.getState();
      if (s.screen === 'playing') s.save.playTime += 1;
    }, 1000);
    return () => clearInterval(i);
  }, []);
  if (fatal) {
    return (
      <div className="fatal-screen" role="alert">
        <div className="sys-panel p-8" style={{ maxWidth: 560 }}>
          <div className="sys-title" style={{ fontSize: 14 }}>
            [ SYSTEM ERROR ]
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: '12px 0' }}>3D renderer unavailable</h1>
          <p style={{ color: '#cfe6ff', lineHeight: 1.6 }}>{fatal}</p>
          <p style={{ color: '#9ad8ff', fontSize: 13 }}>
            Try enabling hardware acceleration, closing other 3D applications, or using an up-to-date Chrome, Edge, or
            Firefox browser.
          </p>
          <button className="sys-btn pur mt-4" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className={reducedMotion ? 'reduce-motion' : undefined} style={{ zoom: ui, width: '100%', height: '100%' }}>
      <canvas id="game" ref={ref} tabIndex={0} aria-label="Game world" />
      {screen !== 'menu' && <Hud />}
      {screen !== 'menu' && <Overlays />}
      {screen !== 'menu' && isTouch && <Touch />}
      <Panels />
      {post && !reducedMotion && screen !== 'menu' && (
        <>
          <div className="cinema-grade fixed inset-0 pointer-events-none" />
          <div className="vignette fixed inset-0 pointer-events-none" />
          <div className="scanlines fixed inset-0 pointer-events-none opacity-50" />
        </>
      )}
      <div
        className="fixed inset-0 bg-black pointer-events-none"
        style={{ opacity: fade, transition: 'opacity 0.1s' }}
      />
      {screen === 'menu' && <Menu canvas={ref} />}
    </div>
  );
}
export type { SaveData };
