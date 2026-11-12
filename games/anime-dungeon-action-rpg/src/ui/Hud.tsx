import { useRef } from 'react';
import { useHud, useStore } from '../game/store';
import { SKILL_BY_ID, skillScale } from '../game/data';
import { getGame } from '../game/engine';
import { fmtTime } from '../game/util';
import type { Act } from '../game/input';

const pct = (a: number, b: number) => `${Math.max(0, Math.min(100, (a / Math.max(1, b)) * 100))}%`;

export function Hud() {
  const h = useHud(); const save = useStore((s) => s.save); const touch = useStore((s) => s.touch); const scene = useStore((s) => s.scene);
  const g = getGame(); const hub = scene === 'hub';
  const slots = save.slots;
  return (
    <div className="hud">
      <div className="obj">
        {h.floor > 0 || !hub ? <div className="fl">{hub ? 'HUB' : h.wave || `FLOOR ${h.floor}`}</div> : <div className="fl">HUB</div>}
        <div className="rg">{h.region}{!hub && h.floorName ? ` · ${h.floorName}` : ''}</div>
        {!hub && <div className="rg" style={{ color: '#ffd860' }}>{h.type}</div>}
        {!hub && h.obj && (
          <div className="ob">{h.obj}{h.objG > 1 && h.type !== 'ENDLESS' ? <span className="gold"> {h.objP}/{h.objG}</span> : null}
            {h.objG > 1 && <div className="bar xp" style={{ height: 5, marginTop: 4, transform: 'none' }}><i style={{ width: pct(h.objP, h.objG) }} /></div>}</div>)}
        {hub && <div className="ob">Walk to a station and press {touch ? 'Interact' : 'E'} · Enter the Tower Gate to climb</div>}
        {!hub && (h.timeLeft > 0 ? <div className="ob" style={{ color: h.timeLeft < 15 ? '#ff6a6a' : '#fff', fontSize: 22, fontFamily: 'var(--font-h)' }}>⏱ {fmtTime(h.timeLeft)}</div> : <div className="rg" style={{ marginTop: 4 }}>⏱ {fmtTime(h.time)}</div>)}
      </div>

      <div style={{ right: 14, top: 12, textAlign: 'right' }}>
        <div className="row" style={{ justifyContent: 'flex-end', pointerEvents: 'auto' }}>
          <span className="chip">🪙 {save.gold}</span>
          <button className="xbtn" aria-label="Menu" onPointerDown={(e) => { e.stopPropagation(); g?.openPanel('menu', 'inventory'); }}>☰</button>
          <button className="xbtn" aria-label="Pause" onPointerDown={(e) => { e.stopPropagation(); g?.togglePause(true); }}>❚❚</button>
        </div>
        {!hub && <div className="h gold" style={{ fontSize: 26, textShadow: '0 0 10px rgba(255,190,40,.5), 0 2px 0 #000', marginTop: 6 }}>{h.score.toLocaleString()}</div>}
        {!hub && <div className="muted" style={{ fontSize: 11, letterSpacing: '0.2em' }}>SCORE{h.mult > 1.05 ? ` ×${h.mult.toFixed(2)}` : ''}</div>}
      </div>

      {h.combo >= 2 && !hub && <div className="combo"><div className="n" key={Math.floor(h.combo / 1)}>{h.combo}</div><div className="gold" style={{ fontSize: 14, letterSpacing: '0.3em' }}>HITS</div></div>}

      {h.boss ? (
        <div className="bossbar">
          <div className="bn">{h.boss.name}{h.boss.atk ? <span style={{ color: '#ffd860', fontSize: '0.6em', marginLeft: 10 }}>⟫ {h.boss.atk}</span> : null}</div>
          <div className="bar hpb"><i style={{ width: pct(h.boss.hp, h.boss.max) }} /><b>{Math.ceil(h.boss.hp).toLocaleString()}</b></div>
          <div className="bar post" title="Posture"><i style={{ width: pct(h.boss.posture, 100) }} /></div>
          <div className="pips">{[1, 2, 3].map((i) => <span key={i} className={i <= h.boss!.phase ? 'on' : ''} />)}</div>
          {h.boss.stunned && <div className="gold h" style={{ fontSize: 14, letterSpacing: '0.3em' }}>POSTURE BROKEN — ATTACK!</div>}
        </div>
      ) : h.target ? (
        <div className="bossbar" style={{ width: 'min(360px, 60vw)', top: 12 }}>
          <div className="bn" style={{ fontSize: 14, color: h.target.elite ? '#ffd860' : '#fff' }}>{h.target.name}{h.lock ? <span className="lockmark"> ◉ LOCKED</span> : null}</div>
          <div className="bar hpb" style={{ height: 10 }}><i style={{ width: pct(h.target.hp, h.target.max) }} /></div>
        </div>
      ) : null}

      {h.callout && <div key={h.callout.id} className="callout" style={{ color: h.callout.color }}>{h.callout.text}</div>}
      {h.counterReady && <div className="callout" style={{ top: '62%', fontSize: 16, color: '#ffe27a', animation: 'none' }}>⚡ COUNTER READY — ATTACK ⚡</div>}
      {h.barrier > 0 && <div className="chip" style={{ left: 14, bottom: 128, color: '#66ccff' }}>🛡 Barrier {Math.round(h.barrier)}</div>}

      {/* resources */}
      <div style={{ left: 14, bottom: 14, width: touch ? 230 : 300, pointerEvents: 'none' }}>
        <div className="row" style={{ gap: 8, marginBottom: 4 }}>
          <div className="h" style={{ width: 44, height: 44, borderRadius: '50%', border: `2px solid ${h.awakened ? '#ffe27a' : '#ffd860'}`, background: h.awakened ? 'radial-gradient(#fff4b0,#c08a20)' : 'radial-gradient(#3a2e7a,#120d30)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: h.awakened ? '#2a1a00' : '#ffd860', boxShadow: h.awakened ? '0 0 18px #ffd860' : 'none' }}>{h.level}</div>
          <div style={{ flex: 1 }} className="col">
            <div className="bar hp" style={{ height: 18 }}><i style={{ width: pct(h.hp, h.maxHp) }} /><b>{Math.ceil(h.hp)} / {h.maxHp}</b></div>
            <div className="bar sta" style={{ height: 10 }}><i style={{ width: pct(h.sta, h.maxSta) }} /></div>
          </div>
        </div>
        <div className="bar mp" style={{ height: 11, marginBottom: 3 }}><i style={{ width: pct(h.mp, h.maxMp) }} /><b>{Math.floor(h.mp)}</b></div>
        <div className="bar xp" style={{ height: 6 }}><i style={{ width: pct(h.xp, h.xpNeed) }} /></div>
      </div>

      {/* skills + meters */}
      <div style={{ left: '50%', bottom: 12, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div className="row" style={{ gap: 10, pointerEvents: 'none' }}>
          <div className="col" style={{ gap: 3, alignItems: 'center' }}>
            <div className={`meter ${h.ult >= 100 ? 'ready' : ''}`}><i style={{ width: `${h.ult}%`, background: 'linear-gradient(90deg,#ffb020,#ffe9a0)' }} /></div>
            <span style={{ fontSize: 10, letterSpacing: '0.2em', color: h.ult >= 100 ? '#ffe9a0' : '#9a90c0' }}>{h.ult >= 100 ? (touch ? 'ULT READY' : '[V] ULT READY') : 'ULTIMATE'}</span>
          </div>
          <div className="col" style={{ gap: 3, alignItems: 'center' }}>
            <div className={`meter ${h.awk >= 100 && !h.awakened ? 'ready' : ''}`}><i style={{ width: `${h.awakened ? 100 : h.awk}%`, background: h.awakened ? 'linear-gradient(90deg,#ff9a20,#fff4b0)' : 'linear-gradient(90deg,#b06aff,#66ddff)' }} /></div>
            <span style={{ fontSize: 10, letterSpacing: '0.2em', color: h.awk >= 100 ? '#ffe9a0' : '#9a90c0' }}>{h.awakened ? 'AWAKENED' : h.awk >= 100 ? (touch ? 'AWAKEN READY' : '[T] AWAKEN READY') : 'AWAKENING'}</span>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {!hub && slots.map((id, i) => {
            const def = id ? SKILL_BY_ID[id] : null; const lv = def ? save.skills[id] || 0 : 0; const cd = h.cds[i] || 0; const mana = def && lv ? skillScale(def, lv).mana : 0;
            const key = i === h.sel ? 'E' : i === (h.sel + 1) % 4 ? 'R' : String(i + 1);
            return (
              <div key={i} className={`skill ${i === h.sel ? 'sel' : ''}`} onPointerDown={(e) => { e.stopPropagation(); if (!g) return; if (touch && id) g.player.tryCast(id); else g.player.selected = i; }} title={def?.name} style={{ borderColor: i === h.sel || i === (h.sel + 1) % 4 ? '#ffd860' : undefined, opacity: h.mp < mana ? 0.55 : 1 }}>
                <span className="k">{touch ? '' : key}</span>{def ? def.icon : '—'}{cd > 0 && <div className="cd">{cd.toFixed(1)}</div>}{mana > 0 && <span className="mc">{mana}</span>}
              </div>);
          })}
        </div>
      </div>

      {!hub && h.floor === 1 && h.type !== 'ENDLESS' && h.time < 45 && <div className="callout" style={{ top: '70%', fontSize: 'clamp(11px,1.6vw,15px)', color: '#cfc4f5', animation: 'none', opacity: 0.9 }}>{touch ? 'Attack · Guard (time it as the enemy flashes!) · Dodge' : 'LMB attack · RMB deflect on the flash · Q dodge · E/R skills · F heavy'}</div>}
      {h.prompt && hub && <div className="prompt">{h.prompt}</div>}
      {h.training && (
        <div className="panel" style={{ right: 14, top: 120, padding: '8px 14px', fontSize: 14 }}>
          <div className="h gold" style={{ fontSize: 12 }}>TRAINING</div>
          <div>Perfect deflections: <b>{h.training.perfect}</b></div><div>Damage dealt: <b>{h.training.dmg.toLocaleString()}</b></div><div>Best combo: <b>{h.training.combo}</b></div>
          <button className="btn sm red" style={{ marginTop: 6, pointerEvents: 'auto' }} onPointerDown={() => g?.quitToHub()}>Exit to Hub</button>
        </div>)}
      {!touch && !hub && <div className="reticle" style={{ opacity: h.lock ? 0 : 0.6 }} />}
    </div>
  );
}

export function Banners() {
  const b = useStore((s) => s.banners); const t = useStore((s) => s.toasts);
  return (<>
    <div className="layer" style={{ zIndex: 11 }}>
      {b.map((x) => (<div key={x.id} className="banner" style={{ color: x.color || '#ffd860', pointerEvents: 'none' }}><div className="bt">{x.title}</div><div className="line" />{x.sub && <div className="bs">{x.sub}</div>}</div>))}
    </div>
    <div className="layer" style={{ zIndex: 11 }}><div className="toasts" style={{ position: 'absolute' }}>{t.map((x) => <div key={x.id} className="toast" style={{ color: x.color }}><span style={{ color: '#fff' }}>{x.text}</span></div>)}</div></div>
  </>);
}

// ---------------- touch ----------------
const BTN: { a: Act; l: string; r: number; b: number; s: number }[] = [
  { a: 'attack', l: '⚔', r: 22, b: 22, s: 94 }, { a: 'heavy', l: 'HEAVY', r: 124, b: 26, s: 62 }, { a: 'guard', l: 'GUARD', r: 22, b: 126, s: 64 },
  { a: 'dodge', l: 'DODGE', r: 112, b: 104, s: 62 }, { a: 'jump', l: 'JUMP', r: 192, b: 70, s: 54 },
];
export function TouchControls() {
  const g = getGame(); const scene = useStore((s) => s.scene); const hud = useHud((s) => s.prompt); const ult = useHud((s) => s.ult); const awk = useHud((s) => s.awk); const aw = useHud((s) => s.awakened);
  const base = useRef<HTMLDivElement>(null), knob = useRef<HTMLDivElement>(null), st = useRef<{ id: number; x: number; y: number } | null>(null), lk = useRef<{ id: number; x: number; y: number } | null>(null);
  if (!g) return null; const hub = scene === 'hub';
  const down = (a: Act) => (e: React.PointerEvent) => { e.stopPropagation(); e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); g.input.press(a); };
  const up = (a: Act) => (e: React.PointerEvent) => { e.stopPropagation(); g.input.release(a); };
  const sd = (e: React.PointerEvent) => { if (st.current) return; st.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); if (base.current && knob.current) { base.current.style.display = 'block'; base.current.style.left = e.clientX + 'px'; base.current.style.top = e.clientY + 'px'; knob.current.style.transform = 'translate(0,0)'; } };
  const sm = (e: React.PointerEvent) => { const s = st.current; if (!s || s.id !== e.pointerId) return; let dx = e.clientX - s.x, dy = e.clientY - s.y; const m = Math.hypot(dx, dy), R = 56; if (m > R) { dx = (dx / m) * R; dy = (dy / m) * R; } if (knob.current) knob.current.style.transform = `translate(${dx}px,${dy}px)`; const k = Math.min(1, Math.hypot(dx, dy) / R); const n = Math.hypot(dx, dy) || 1; g.input.stick = [(dx / n) * (k < 0.12 ? 0 : k), (-dy / n) * (k < 0.12 ? 0 : k)]; };
  const su = (e: React.PointerEvent) => { if (st.current?.id === e.pointerId) { st.current = null; g.input.stick = [0, 0]; if (base.current) base.current.style.display = 'none'; } };
  const ld = (e: React.PointerEvent) => { if (lk.current) return; lk.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); };
  const lm = (e: React.PointerEvent) => { const s = lk.current; if (!s || s.id !== e.pointerId) return; g.input.look(e.clientX - s.x, e.clientY - s.y); s.x = e.clientX; s.y = e.clientY; };
  const lu = (e: React.PointerEvent) => { if (lk.current?.id === e.pointerId) lk.current = null; };
  return (
    <div className="layer" style={{ zIndex: 12, touchAction: 'none' }}>
      <div style={{ position: 'fixed', left: 0, top: 0, width: '46%', height: '100%', touchAction: 'none' }} onPointerDown={sd} onPointerMove={sm} onPointerUp={su} onPointerCancel={su} />
      <div style={{ position: 'fixed', right: 0, top: 0, width: '54%', height: '100%', touchAction: 'none' }} onPointerDown={ld} onPointerMove={lm} onPointerUp={lu} onPointerCancel={lu} />
      <div ref={base} className="stick-base" style={{ display: 'none' }}><div ref={knob} className="stick-knob" /></div>
      {BTN.map((b) => (!hub || b.a === 'jump' || b.a === 'dodge' || b.a === 'attack') ? <div key={b.a} className="tbtn" style={{ right: b.r, bottom: b.b, width: b.s, height: b.s, fontSize: b.a === 'attack' ? 38 : 12 }} onPointerDown={down(b.a)} onPointerUp={up(b.a)} onPointerCancel={up(b.a)}>{b.l}</div> : null)}
      {!hub && <>
        <div className={`tbtn ${ult >= 100 ? 'on' : ''}`} style={{ left: 'calc(50% - 150px)', bottom: 84, width: 52, height: 52, opacity: ult >= 100 ? 1 : 0.5 }} onPointerDown={down('ult')} onPointerUp={up('ult')}>ULT</div>
        <div className={`tbtn ${awk >= 100 && !aw ? 'on' : ''}`} style={{ left: 'calc(50% + 98px)', bottom: 84, width: 52, height: 52, opacity: awk >= 100 && !aw ? 1 : 0.5 }} onPointerDown={down('awaken')} onPointerUp={up('awaken')}>AWAKE</div>
        <div className="tbtn" style={{ right: 14, top: 62, width: 48, height: 48 }} onPointerDown={down('lock')} onPointerUp={up('lock')}>LOCK</div>
        <div className="tbtn" style={{ right: 70, top: 62, width: 48, height: 48 }} onPointerDown={down('swap')} onPointerUp={up('swap')}>SWAP</div>
      </>}
      {hub && hud && <div className="tbtn on" style={{ right: 26, bottom: 130, width: 84, height: 84, fontSize: 14 }} onPointerDown={down('interact')} onPointerUp={up('interact')}>INTERACT</div>}
    </div>
  );
}
