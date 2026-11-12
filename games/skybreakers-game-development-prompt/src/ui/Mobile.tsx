import { useRef, useState, type ReactNode } from 'react';
import { G, input } from '../game/runtime';
import { SPELLS } from '../game/data';
import { useStore } from '../game/store';
import { useTick } from './hooks';

function Joystick() {
  const base = useRef<HTMLDivElement>(null); const [k, setK] = useState({ x: 0, y: 0 }); const id = useRef(-1);
  const upd = (e: React.PointerEvent) => { const r = base.current!.getBoundingClientRect(); let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2); const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } setK({ x: dx, y: dy }); input.joy.x = Math.abs(dx) < 0.12 ? 0 : dx; input.joy.y = Math.abs(dy) < 0.12 ? 0 : -dy; };
  const end = () => { id.current = -1; setK({ x: 0, y: 0 }); input.joy.x = 0; input.joy.y = 0; };
  return <div ref={base} className="joy absolute left-4 bottom-4 w-[128px] h-[128px] rounded-full pointer-events-auto" style={{ background: 'radial-gradient(circle, rgba(90,150,255,.18), rgba(10,20,60,.45))', border: '2px solid rgba(232,196,106,.5)' }} data-ui
    onPointerDown={e => { id.current = e.pointerId; (e.target as HTMLElement).setPointerCapture(e.pointerId); upd(e); }} onPointerMove={e => { if (id.current === e.pointerId) upd(e); }} onPointerUp={end} onPointerCancel={end}>
    <div className="absolute w-14 h-14 rounded-full" style={{ left: 64 - 28 + k.x * 40, top: 64 - 28 + k.y * 40, background: 'radial-gradient(circle at 30% 30%, #ffe9a0, #a9822c)', boxShadow: '0 0 14px rgba(232,196,106,.7)' }} /></div>;
}
function B({ children, size = 56, hold, press, className = '', style }: { children: ReactNode; size?: number; hold?: string; press?: string; className?: string; style?: React.CSSProperties }) {
  const [on, setOn] = useState(false);
  return <div data-ui className={`joy pointer-events-auto rounded-full flex items-center justify-center font-title font-bold text-white select-none ${className}`} style={{ width: size, height: size, background: on ? 'rgba(232,196,106,.55)' : 'rgba(14,24,70,.65)', border: '2px solid rgba(232,196,106,.6)', fontSize: size > 60 ? 13 : 11, ...style }}
    onPointerDown={e => { (e.target as HTMLElement).setPointerCapture(e.pointerId); setOn(true); if (hold) input.virt[hold] = true; if (press) input.press(press); if (hold === 'attack') { input.lmbPressed = true; } }}
    onPointerUp={() => { setOn(false); if (hold) input.virt[hold] = false; if (hold === 'attack') input.lmbReleased = true; }} onPointerCancel={() => { setOn(false); if (hold) input.virt[hold] = false; }}>{children}</div>;
}
export function MobileControls() {
  useTick(200); const s = useStore(); const ship = G.player.inShip; const look = useRef({ id: -1, x: 0, y: 0 });
  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      <div className="absolute top-0 bottom-0 right-0 left-[38%] pointer-events-auto joy" data-ui style={{ touchAction: 'none' }}
        onPointerDown={e => { if (look.current.id < 0) { look.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; (e.target as HTMLElement).setPointerCapture(e.pointerId); } }}
        onPointerMove={e => { const l = look.current; if (l.id === e.pointerId) { input.touchLook.x += (e.clientX - l.x) * 1.1; input.touchLook.y += (e.clientY - l.y) * 1.1; l.x = e.clientX; l.y = e.clientY; } }}
        onPointerUp={e => { if (look.current.id === e.pointerId) look.current.id = -1; }} onPointerCancel={() => { look.current.id = -1; }} />
      <Joystick />
      {!ship ? <>
        <B size={84} hold="attack" press="KeyF" className="absolute right-5 bottom-8">ATTACK</B>
        <B press="Space" className="absolute right-[112px] bottom-6">JUMP</B><B press="KeyV" className="absolute right-5 bottom-[128px]">DODGE</B><B hold="block" className="absolute right-[100px] bottom-[96px]" size={48}>BLOCK</B>
        <B press="KeyE" className="absolute right-[180px] bottom-[56px] !border-[#ffe9a0]" size={52}>E</B><B hold="sprint" className="absolute left-[150px] bottom-6" size={46}>RUN</B>
        <B press="Tab" className="absolute right-[24px] bottom-[196px]" size={44}>LOCK</B><B press="KeyQ" className="absolute right-[80px] bottom-[188px]" size={44}>⚔</B>
        <div className="absolute right-3 top-[190px] flex flex-col gap-1">{SPELLS.map((sp, i) => <B key={sp.id} press={`Digit${i + 1}`} size={38} style={{ opacity: s.level >= sp.reqLevel ? 1 : 0.35 }}>{sp.icon}</B>)}</div>
      </> : <>
        <B hold="attack" size={80} className="absolute right-5 bottom-8">FIRE</B><B hold="up" className="absolute right-[108px] bottom-[110px]">▲</B><B hold="down" className="absolute right-[108px] bottom-[40px]">▼</B><B hold="sprint" size={50} className="absolute right-5 bottom-[128px]">BOOST</B>
        <B press="KeyE" size={50} className="absolute right-[176px] bottom-[60px] !border-[#ffe9a0]">EXIT</B><B press="KeyQ" size={44} className="absolute right-[190px] bottom-[120px]">⚙ WPN</B><B press="KeyR" size={44} className="absolute left-[150px] bottom-[20px]">FUEL</B><B press="KeyH" size={44} className="absolute left-[150px] bottom-[72px]">FIX</B>
      </>}
      <div className="absolute top-[150px] right-2 flex gap-1"><B size={40} press="KeyI" className="!text-[10px]">🎒</B><B size={40} press="Escape">⏸</B></div>
      {s.placing && <B size={64} press="KeyE" className="absolute left-1/2 -translate-x-1/2 bottom-[130px] !border-green-300">✔ BUILD</B>}
    </div>
  );
}
