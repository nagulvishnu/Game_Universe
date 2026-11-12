import { useRef, useState } from 'react';
import { Action, useGame, useHud } from '../game/store';
import { input } from '../game/input';

function Btn({ a, label, x, y, s, extra }: { a: Action; label: string; x: string; y: string; s: number; extra?: number }) {
  const [down, setDown] = useState(false);
  return (
    <div className={`touch-btn ${down ? 'down' : ''}`} style={{ right: x, bottom: y, width: s, height: s, fontSize: s * .26 }}
      onPointerDown={e => { e.stopPropagation(); (e.target as HTMLElement).setPointerCapture(e.pointerId); setDown(true); input.press(a); }}
      onPointerUp={() => { setDown(false); input.release(a); }} onPointerCancel={() => { setDown(false); input.release(a); }}>
      {label}{extra ? <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(rgba(0,0,0,.7) ${extra * 360}deg, transparent 0)` }} /> : null}
    </div>
  );
}

export default function Touch() {
  const stick = useRef<HTMLDivElement>(null), knob = useRef<HTMLDivElement>(null), id = useRef(-1), look = useRef<{ id: number; x: number; y: number } | null>(null);
  const h = useHud(); const sens = useGame(s => s.settings.sens);
  const upd = (e: React.PointerEvent) => {
    const r = stick.current!.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = e.clientX - cx, dy = e.clientY - cy; const m = Math.hypot(dx, dy), max = r.width / 2;
    if (m > max) { dx = dx / m * max; dy = dy / m * max; } input.axis.x = dx / max; input.axis.y = -dy / max; knob.current!.style.transform = `translate(${dx}px,${dy}px)`;
    if (Math.hypot(dx, dy) / max > .92) input.press('sprint'); else input.release('sprint');
  };
  const end = () => { id.current = -1; input.axis.x = input.axis.y = 0; input.release('sprint'); if (knob.current) knob.current.style.transform = ''; };
  return (
    <div className="absolute inset-0" style={{ touchAction: 'none' }}
      onPointerDown={e => { if (!look.current && e.clientX > window.innerWidth * .35) { look.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } }}
      onPointerMove={e => { const l = look.current; if (l && l.id === e.pointerId) { input.look.x += (e.clientX - l.x) * 1.15 * sens; input.look.y += (e.clientY - l.y) * 1.15 * sens; l.x = e.clientX; l.y = e.clientY; } }}
      onPointerUp={e => { if (look.current?.id === e.pointerId) look.current = null; }} onPointerCancel={() => { look.current = null; }}>
      <div ref={stick} className="absolute rounded-full border-2 border-white/30 bg-black/30" style={{ left: 28, bottom: 28, width: 140, height: 140, touchAction: 'none' }}
        onPointerDown={e => { e.stopPropagation(); id.current = e.pointerId; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); upd(e); }}
        onPointerMove={e => { if (id.current === e.pointerId) upd(e); }} onPointerUp={end} onPointerCancel={end}>
        <div ref={knob} className="absolute rounded-full bg-white/35 border border-white/60" style={{ left: 45, top: 45, width: 50, height: 50 }} />
      </div>
      <Btn a="light" label="ATK" x="26px" y="70px" s={92} />
      <Btn a="heavy" label="HVY" x="128px" y="46px" s={64} />
      <Btn a="deflect" label="PARRY" x="124px" y="122px" s={70} />
      <Btn a="dodge" label="DASH" x="30px" y="176px" s={62} />
      <Btn a="jump" label="JUMP" x="104px" y="198px" s={54} />
      <Btn a="spec1" label="E" x="194px" y="78px" s={52} extra={h.cds[0]} />
      <Btn a="spec2" label="R" x="190px" y="138px" s={52} extra={h.cds[1]} />
      <Btn a="ult" label="ULT" x="14px" y="272px" s={58} />
      <Btn a="awaken" label="AWK" x="84px" y="262px" s={50} />
      <Btn a="lock" label="◎" x="150px" y="254px" s={44} />
      <div className="touch-btn" style={{ left: 170, bottom: 190, width: 46, height: 46, fontSize: 18 }} onPointerDown={e => { e.stopPropagation(); useGame.getState().set({ screen: 'combat' }); document.exitPointerLock?.(); }}>☰</div>
    </div>
  );
}
