import { useMemo, type RefObject } from 'react';
import { bus, idbGet, useGame, type SaveData } from '../game/store';
import { audio } from '../game/audio';
import { isTouch } from './Touch';

export async function continueGame() {
  const slot = await idbGet<string>('latest');
  const d = slot ? await idbGet<SaveData>(slot) : null;
  if (d) {
    useGame.getState().load(d);
    setTimeout(() => bus.emit('requestLock'), 50);
  }
}
export function Menu({ canvas }: { canvas: RefObject<HTMLCanvasElement | null> }) {
  const st = useGame();
  const motes = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        l: (i * 37 + 13) % 100,
        d: 7 + ((i * 53) % 110) / 10,
        s: (i * 29) % 11,
        k: i,
        blue: i % 3 === 0,
      })),
    []
  );
  const start = () => {
    audio.init();
    st.newGame();
    if (!isTouch)
      setTimeout(() => {
        try {
          const request = canvas.current?.requestPointerLock?.();
          if (request && typeof (request as Promise<void>).catch === 'function') {
            (request as Promise<void>).catch(() => {
              /* pointer lock can be refused in headless or embedded contexts */
            });
          }
        } catch {
          /* ignore */
        }
      }, 30);
  };
  const items: { label: string; fn: () => void; disabled?: boolean; primary?: boolean }[] = [
    { label: 'New Game', fn: start, primary: true },
    { label: 'Continue', fn: () => continueGame(), disabled: !st.hasSave },
    { label: 'Load Game', fn: () => st.setPanel('load'), disabled: !st.hasSave },
    { label: 'High Scores', fn: () => st.setPanel('scores') },
    { label: 'Settings', fn: () => st.setPanel('settings') },
    { label: 'Controls', fn: () => st.setPanel('controls') },
    { label: 'Credits', fn: () => st.setPanel('credits') },
  ];
  return (
    <div className="menu-screen fixed inset-0">
      <div className="menu-grid" aria-hidden="true" />
      <div className="menu-scan" aria-hidden="true" />
      {motes.map((m) => (
        <span
          key={m.k}
          className={'mote' + (m.blue ? ' blue' : '')}
          style={{
            left: m.l + '%',
            animationDuration: m.d + 's',
            animationDelay: -m.s + 's',
            opacity: m.blue ? 0.55 : 0.8,
          }}
          aria-hidden="true"
        />
      ))}
      <div className="menu-topbar" aria-hidden="true">
        <span>
          SYSTEM // <b>SHADOW_MONARCH</b>
        </span>
        <span>
          BUILD <b>0.1.0</b> · WEBGL · SEOUL NODE
        </span>
      </div>
      <main className="menu-layout">
        <section className="menu-left">
          <div className="menu-kicker">The System presents</div>
          <h1 className="menu-title">
            <span>Solo</span>
            <span>Leveling</span>
          </h1>
          <div className="menu-subtitle">The Shadow Monarch</div>
          <p className="menu-tag">START AS THE WEAKEST. RISE AS THE MONARCH.</p>
          <nav className="menu-nav" aria-label="Main menu">
            {items.map((item, i) => (
              <button
                key={item.label}
                className={'menu-btn' + (item.primary ? ' primary' : '')}
                disabled={item.disabled}
                onClick={() => {
                  audio.init();
                  bus.emit('sfx', 'ui');
                  item.fn();
                }}
              >
                <span className="mn">{String(i + 1).padStart(2, '0')}</span>
                <span>{item.label}</span>
                <span className="arrow" aria-hidden="true">
                  ▶
                </span>
              </button>
            ))}
          </nav>
          <div className="menu-status" role="status">
            <span className={'dot' + (st.hasSave ? '' : ' off')} />
            {st.hasSave ? 'SAVE LINK ESTABLISHED — CONTINUE AVAILABLE' : 'NO SAVE DATA — BEGIN A NEW AWAKENING'}
          </div>
        </section>
        <div className="menu-right" aria-hidden="true">
          <div className="menu-frame" />
          <div className="menu-corner-tag">
            HUNTER FILE // 001
            <br />
            <b>SUNG JIN-WOO</b>
            <br />
            THREAT: <b>MONARCH</b>
            <br />
            STATUS: <b>AWAKENED</b>
          </div>
        </div>
      </main>
      <div className="menu-bottom" aria-hidden="true">
        <div>UNOFFICIAL FAN PROJECT · BUILT WITH THREE.JS</div>
        <div className="zones">SEOUL · DOUBLE DUNGEON · VENOM CAVE · JOB CHANGE · SHADOW ARMY</div>
      </div>
    </div>
  );
}
