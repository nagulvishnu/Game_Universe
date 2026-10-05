import { useRef, useState } from 'react';
import type { Game, Hud } from '../game/game';

interface Props {
  game: Game;
  hud: Hud;
  onPause: () => void;
}

const LOOK_SCALE = 2.1;

export default function Touch({ game, hud, onPause }: Props) {
  const stickBase = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState<{ ox: number; oy: number; dx: number; dy: number } | null>(null);
  const stickId = useRef<number | null>(null);
  const lookId = useRef<number | null>(null);
  const lastLook = useRef({ x: 0, y: 0 });
  const [ads, setAds] = useState(false);
  const R = 56;

  const stickDown = (e: React.PointerEvent) => {
    if (stickId.current !== null) return;
    stickId.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setStick({ ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 });
  };
  const stickMove = (e: React.PointerEvent) => {
    if (e.pointerId !== stickId.current || !stick) return;
    let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
    const l = Math.hypot(dx, dy);
    if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
    setStick({ ...stick, dx, dy });
    game.input.mx = dx / R;
    game.input.my = -dy / R;
  };
  const stickUp = (e: React.PointerEvent) => {
    if (e.pointerId !== stickId.current) return;
    stickId.current = null;
    setStick(null);
    game.input.mx = 0;
    game.input.my = 0;
  };

  const lookDown = (e: React.PointerEvent) => {
    if (lookId.current !== null) return;
    lookId.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    lastLook.current = { x: e.clientX, y: e.clientY };
  };
  const lookMove = (e: React.PointerEvent) => {
    if (e.pointerId !== lookId.current) return;
    game.input.lookX += (e.clientX - lastLook.current.x) * LOOK_SCALE;
    game.input.lookY += (e.clientY - lastLook.current.y) * LOOK_SCALE;
    lastLook.current = { x: e.clientX, y: e.clientY };
  };
  const lookUp = (e: React.PointerEvent) => {
    if (e.pointerId === lookId.current) lookId.current = null;
  };

  // fire button (also acts as look surface while held)
  const fireId = useRef<number | null>(null);
  const fireLast = useRef({ x: 0, y: 0 });
  const [firing, setFiring] = useState(false);
  const fireDown = (e: React.PointerEvent) => {
    fireId.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    fireLast.current = { x: e.clientX, y: e.clientY };
    game.input.fire = true;
    setFiring(true);
  };
  const fireMove = (e: React.PointerEvent) => {
    if (e.pointerId !== fireId.current) return;
    game.input.lookX += (e.clientX - fireLast.current.x) * LOOK_SCALE;
    game.input.lookY += (e.clientY - fireLast.current.y) * LOOK_SCALE;
    fireLast.current = { x: e.clientX, y: e.clientY };
  };
  const fireUp = (e: React.PointerEvent) => {
    if (e.pointerId !== fireId.current) return;
    fireId.current = null;
    game.input.fire = false;
    setFiring(false);
  };

  const press = (fn: () => void) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); e.stopPropagation(); fn(); },
  });

  const inVeh = hud.phase === 'vehicle';
  const inAir = hud.phase === 'plane' || hud.phase === 'fall' || hud.phase === 'chute';
  const big = 'touch-btn absolute';

  return (
    <div className="absolute inset-0" style={{ touchAction: 'none' }}>
      {/* look surface (right 60%) */}
      <div className="absolute top-0 bottom-0 right-0 w-[60%]" style={{ touchAction: 'none' }} onPointerDown={lookDown} onPointerMove={lookMove} onPointerUp={lookUp} onPointerCancel={lookUp} />
      {/* stick surface (left 40%, lower 75%) */}
      <div className="absolute left-0 bottom-0 w-[42%] h-[75%]" style={{ touchAction: 'none' }} onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp} ref={stickBase}>
        {!stick && <div className="absolute left-8 bottom-10 w-28 h-28 rounded-full border-2 border-white/25 bg-white/5" />}
      </div>
      {stick && (
        <>
          <div className="fixed rounded-full border-2 border-white/40 bg-white/10 pointer-events-none" style={{ left: stick.ox - R, top: stick.oy - R, width: R * 2, height: R * 2 }} />
          <div className="fixed rounded-full bg-amber-300/80 pointer-events-none" style={{ left: stick.ox + stick.dx - 22, top: stick.oy + stick.dy - 22, width: 44, height: 44 }} />
        </>
      )}

      <button className="touch-btn absolute left-1/2 -translate-x-[150%] top-3 w-9 h-9 text-base" style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }} {...press(onPause)}>⏸</button>

      {/* action buttons */}
      <div className="absolute right-0 bottom-0 w-[300px] h-[250px] pointer-events-none" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {!inAir && !inVeh && (
          <button
            className={`${big} right-5 bottom-8 w-[84px] h-[84px] text-base pointer-events-auto ${firing ? 'on' : ''}`}
            style={{ touchAction: 'none', borderColor: '#f97316' }}
            onPointerDown={fireDown} onPointerMove={fireMove} onPointerUp={fireUp} onPointerCancel={fireUp}
          >
            🔥<span className="ml-1">FIRE</span>
          </button>
        )}
        <button className={`${big} pointer-events-auto ${inAir || inVeh ? 'right-6 bottom-10 w-[90px] h-[90px] text-base' : 'right-[116px] bottom-6 w-14 h-14'}`} {...press(() => { game.input.jump = true; })}
          onPointerUp={() => { game.input.brake = false; }} onPointerCancel={() => { game.input.brake = false; }}
          onPointerDownCapture={() => { if (inVeh) game.input.brake = true; }}>
          {hud.phase === 'plane' ? 'JUMP' : hud.phase === 'fall' ? 'CHUTE' : inVeh ? 'BRAKE' : 'JUMP'}
        </button>
        {!inAir && !inVeh && (
          <>
            <button className={`${big} right-[104px] bottom-[96px] w-12 h-12 pointer-events-auto`} {...press(() => game.startReload(game.player))}>RELOAD</button>
            <button className={`${big} right-[22px] bottom-[126px] w-12 h-12 pointer-events-auto ${ads ? 'on' : ''}`} {...press(() => { game.input.ads = !game.input.ads; setAds(game.input.ads); })}>AIM</button>
            <button className={`${big} right-[166px] bottom-[28px] w-11 h-11 pointer-events-auto`} {...press(() => game.cycleWeapon(1))}>⇄</button>
            <button className={`${big} right-[168px] bottom-[84px] w-11 h-11 pointer-events-auto`} {...press(() => game.throwPlayer('grenade'))}>💣</button>
            <button className={`${big} right-[150px] bottom-[138px] w-11 h-11 pointer-events-auto`} {...press(() => game.throwPlayer('bomb'))}>🧨</button>
            <button className={`${big} right-[96px] bottom-[158px] w-11 h-11 pointer-events-auto`} {...press(() => game.useMedkit())}>🩹</button>
          </>
        )}
        {(hud.touchAct || inVeh) && (
          <button className={`${big} right-[104px] ${inVeh ? 'bottom-[120px]' : 'bottom-[200px]'} w-14 h-14 pointer-events-auto text-amber-300 animate-pulse`} style={{ borderColor: '#fbbf24' }} {...press(() => game.interact())}>
            {inVeh ? 'EXIT' : 'USE'}
          </button>
        )}
      </div>
    </div>
  );
}
