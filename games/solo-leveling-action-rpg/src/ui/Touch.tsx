import { useRef, useState } from 'react';
import { bus, useGame } from '../game/store';
import { input } from '../game/input';

export const isTouch =
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
  window.matchMedia?.('(pointer: coarse)').matches;

const BTN: [string, string, number, number, number, boolean][] = [
  ['ATK', 'attack', 86, 22, 22, true],
  ['JUMP', 'jump', 56, 124, 30, false],
  ['DODGE', 'dodge', 56, 30, 124, false],
  ['E', 'interact', 52, 112, 112, false],
  ['LOCK', 'lock', 46, 196, 32, false],
  ['Q', 'dash', 44, 26, 196, false],
  ['F', 'special', 44, 80, 190, false],
  ['X', 'skillX', 44, 134, 178, false],
  ['Z', 'skillZ', 44, 188, 156, false],
  ['V', 'domain', 44, 226, 106, false],
  ['C', 'summon', 50, 262, 40, false],
  ['R', 'exchange', 44, 250, 160, false],
  ['RUN', 'sprint', 46, 262, 96, true],
];
export function Touch() {
  const [stick, setStick] = useState<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const sId = useRef(-1);
  const lId = useRef(-1);
  const last = useRef({ x: 0, y: 0 });
  const sens = useGame((s) => s.settings.sens);
  const down = (e: React.PointerEvent) => {
    const w = window.innerWidth;
    if (e.clientX < w * 0.4 && sId.current < 0 && e.clientY > window.innerHeight * 0.25) {
      sId.current = e.pointerId;
      setStick({ x: 0, y: 0, ox: e.clientX, oy: e.clientY });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } else if (e.clientX > w * 0.4 && lId.current < 0) {
      lId.current = e.pointerId;
      last.current = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };
  const move = (e: React.PointerEvent) => {
    if (e.pointerId === sId.current && stick) {
      let dx = e.clientX - stick.ox,
        dy = e.clientY - stick.oy;
      const l = Math.hypot(dx, dy),
        R = 56;
      if (l > R) {
        dx = (dx / l) * R;
        dy = (dy / l) * R;
      }
      input.stick.x = dx / R;
      input.stick.y = -dy / R;
      setStick({ ...stick, x: dx, y: dy });
      input.tHeld[Math.hypot(dx, dy) > 52 ? 'add' : 'delete']('sprint');
    } else if (e.pointerId === lId.current) {
      input.lookX += (e.clientX - last.current.x) * 1.5 * sens;
      input.lookY += (e.clientY - last.current.y) * 1.5 * sens;
      last.current = { x: e.clientX, y: e.clientY };
    }
  };
  const up = (e: React.PointerEvent) => {
    if (e.pointerId === sId.current) {
      sId.current = -1;
      setStick(null);
      input.stick.x = input.stick.y = 0;
      input.tHeld.delete('sprint');
    }
    if (e.pointerId === lId.current) lId.current = -1;
  };
  return (
    <div
      className="fixed inset-0"
      style={{ zIndex: 20, touchAction: 'none' }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {stick && (
        <>
          <div
            className="absolute rounded-full"
            style={{
              left: stick.ox - 60,
              top: stick.oy - 60,
              width: 120,
              height: 120,
              border: '2px solid rgba(154,216,255,.6)',
              background: 'rgba(20,60,140,.25)',
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              left: stick.ox + stick.x - 24,
              top: stick.oy + stick.y - 24,
              width: 48,
              height: 48,
              background: 'rgba(120,200,255,.7)',
            }}
          />
        </>
      )}
      {BTN.map(([label, act, size, r, b, hold]) => (
        <div
          key={act}
          className="tbtn"
          style={{ width: size, height: size, right: r, bottom: b }}
          onPointerDown={(e) => {
            e.stopPropagation();
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            input.press(act);
            if (hold || act === 'attack') input.tHeld.add(act);
            (e.currentTarget as HTMLElement).classList.add('on');
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            input.tHeld.delete(act);
            if (act === 'attack') input.press('attackUp');
            (e.currentTarget as HTMLElement).classList.remove('on');
          }}
          onPointerCancel={(e) => {
            input.tHeld.delete(act);
            (e.currentTarget as HTMLElement).classList.remove('on');
          }}
        >
          {label}
        </div>
      ))}
      <div
        className="absolute flex gap-2"
        style={{ top: 8, left: '50%', transform: 'translateX(-50%)' }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {[
          ['INV', 'inventory'],
          ['STATUS', 'status'],
          ['MAP', 'map'],
          ['QUEST', 'quests'],
          ['II', 'pause'],
        ].map(([l, a]) => (
          <button key={a} className="sys-btn sm" onClick={() => bus.emit('ui', a)}>
            {l}
          </button>
        ))}
      </div>
      <div
        className="absolute flex gap-1"
        style={{ right: 12, bottom: 220 }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className="sys-btn sm" onClick={() => input.press('cmd' + n)}>
            {['FOL', 'ATK', 'DEF', 'HLD', 'REG'][n - 1]}
          </button>
        ))}
      </div>
    </div>
  );
}
