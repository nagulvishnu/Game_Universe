import { useEffect, useRef, useState } from 'react';
import { useHud, useStore } from '../game/store';
import { CHAR_BY_ID } from '../game/data/characters';
import { STYLES, ALL_SKILLS } from '../game/data/styles';
import { Portrait } from './common';
import { rt } from '../game/runtime';

function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!; const g = cv.getContext('2d')!; const S = 1.7; const C = cv.width / 2;
    const id = setInterval(() => {
      const p = rt.player; if (!p) return; g.clearRect(0, 0, cv.width, cv.height);
      g.fillStyle = '#16213a'; g.fillRect(0, 0, cv.width, cv.height);
      const yaw = rt.camYaw; const fx = Math.sin(yaw); const fz = Math.cos(yaw); const rx = -Math.cos(yaw); const rz = Math.sin(yaw);
      const pt = (x: number, z: number) => { const dx = x - p.pos.x; const dz = z - p.pos.z; return [C + (dx * rx + dz * rz) * S, C - (dx * fx + dz * fz) * S]; };
      // bounds
      g.strokeStyle = 'rgba(232,199,119,.5)'; g.lineWidth = 2; g.beginPath(); for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2; const [x, y] = pt(Math.cos(a) * rt.bounds.hx, Math.sin(a) * rt.bounds.hz); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      g.fillStyle = 'rgba(80,110,90,.5)'; rt.colliders.forEach((c) => { if (c.r > 1.2) { const [x, y] = pt(c.x, c.z); g.beginPath(); g.arc(x, y, c.r * S * 0.8, 0, 7); g.fill(); } });
      rt.gates.forEach((q) => { const [x, y] = pt(q.pos.x, q.pos.z); g.fillStyle = '#9a8aff'; g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-4, -4, 8, 8); g.restore(); });
      rt.pickups.forEach((k) => { const [x, y] = pt(k.pos.x, k.pos.z); g.fillStyle = '#7fe8ff'; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); });
      rt.npcs.forEach((n) => { const [x, y] = pt(n.pos.x, n.pos.z); g.fillStyle = n.questTalk ? '#ffe14a' : '#e8e8a0'; g.beginPath(); g.arc(x, y, n.questTalk ? 5 : 3.5, 0, 7); g.fill(); });
      rt.enemies.forEach((e) => { if (e.state === 'dead' || e.state === 'hidden' || e.def.flags.static) return; const [x, y] = pt(e.pos.x, e.pos.z); g.fillStyle = e.boss ? '#ff2a4a' : '#e0344a'; g.beginPath(); g.arc(x, y, e.boss ? 6 : 3.2, 0, 7); g.fill(); if (e.boss) { g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke(); } });
      const m = rt.qrt?.marker; if (m) { let [x, y] = pt(m.x, m.z); const dx = x - C; const dy = y - C; const d = Math.hypot(dx, dy); if (d > C - 12) { x = C + (dx / d) * (C - 12); y = C + (dy / d) * (C - 12); } g.fillStyle = '#ffe14a'; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 4 : 9; const a = (i / 10) * Math.PI * 2 - Math.PI / 2; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.fill(); }
      g.save(); g.translate(C, C); g.rotate(p.yaw - yaw); g.fillStyle = '#7fe8ff'; g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(0, 8); g.lineTo(6, -7); g.lineTo(0, -3); g.lineTo(-6, -7); g.closePath(); g.fill(); g.stroke(); g.restore();
    }, 100);
    return () => clearInterval(id);
  }, []);
  return <div className="minimap"><canvas ref={ref} width={170} height={170} /></div>;
}

export function HUD() {
  const h = useHud(); const prof = useStore((s) => s.profile); const toasts = useStore((s) => s.toasts); const quest = useStore((s) => s.activeQuest); const overlay = useStore((s) => s.overlay);
  const def = CHAR_BY_ID[prof.activeChar]; const st = STYLES[def.style]; const col = '#' + st.color.toString(16).padStart(6, '0');
  const [help, setHelp] = useState(true); useEffect(() => { const t = setTimeout(() => setHelp(false), 30000); return () => clearTimeout(t); }, []);
  const story = prof.chapter < 12 ? `Chapter ${prof.chapter + 1} awaits — press J` : 'Story complete — enjoy free roam!';
  const lowHp = h.hp / h.maxHp < 0.28;
  return (
    <div className="layer" style={{ zIndex: 2 }}>
      {lowHp && <div className="vig" />}
      <div className="crosshair" />
      <div className="hud-tl">
        <div className="hud-portrait"><Portrait look={def.look} color={st.color} size={84} /><div className="hud-lv">Lv.{h.level}</div></div>
        <div className="hud-bars">
          <div className="name">{def.name.split(' ')[0]} <span className="dim small" style={{ letterSpacing: '.1em' }}>· {st.name}</span></div>
          <div className="hbar"><u style={{ width: `${(h.hp / h.maxHp) * 100}%` }} /><i style={{ width: `${(h.hp / h.maxHp) * 100}%`, background: 'linear-gradient(90deg,#c42a3e,#ff5a6e)' }} /><em>{Math.ceil(h.hp)} / {h.maxHp}</em></div>
          <div className="hbar s"><i style={{ width: `${(h.sta / h.maxSta) * 100}%`, background: 'linear-gradient(90deg,#2fa84a,#a6ff6a)' }} /></div>
          <div className="hbar s"><i style={{ width: `${(h.breath / h.maxBreath) * 100}%`, background: `linear-gradient(90deg,${col}aa,${col})` }} /><em>BREATH</em></div>
          <div className="hbar xp"><i style={{ width: `${(h.xp / h.xpNeed) * 100}%`, background: '#e8c777' }} /></div>
          {h.buffs.length > 0 && <div className="small gold">{h.buffs.join(' · ')}</div>}
        </div>
      </div>
      <Minimap />
      <div className="region-tag"><div className="gold">{h.region}</div><div className="dim">{h.time} {h.night ? '🌙' : '☀'}{h.weather !== 'none' ? ` · ${h.weather}` : ''}</div></div>
      <div className="objective"><div className="t">{quest ? (quest.kind === 'story' ? quest.title.toUpperCase() : quest.title) : 'FREE ROAM'}</div><div className="o">{quest ? quest.obj : story}</div></div>
      {h.boss && <div className="bossbar"><div className="n" style={{ color: '#fff' }}>{h.boss.name}</div><div className="p">{h.boss.title}{h.boss.phase ? ` — ${h.boss.phase}` : ''}</div><div className="hbar"><u style={{ width: `${(h.boss.hp / h.boss.max) * 100}%` }} /><i style={{ width: `${(h.boss.hp / h.boss.max) * 100}%`, background: `linear-gradient(90deg,#8a1020,#${h.boss.color.toString(16).padStart(6, '0')})` }} /></div></div>}
      {h.target && !h.boss && <div className="targetbar"><div>{h.target.name} <span className="dim">Lv.{h.target.level}</span></div><div className="hbar s" style={{ height: 10 }}><i style={{ width: `${(h.target.hp / h.target.max) * 100}%`, background: '#e0344a' }} /></div><div className="hbar xp"><i style={{ width: `${(h.target.posture / h.target.maxPosture) * 100}%`, background: '#ffd040' }} /></div></div>}
      {h.dps !== null && <div className="dps">Training DPS: {h.dps}</div>}
      {h.lock && <div className="lockmark" style={{ left: `${h.lock.x}%`, top: `${h.lock.y}%` }} />}
      {h.combo > 1 && <div className="combo">{h.combo}<small>HITS</small></div>}
      {h.prompt && overlay === null && <div className="prompt"><b>G</b>{h.prompt}</div>}
      <div className="toasts">{toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}</div>
      <div className="skillbar">
        {h.cds.slice(0, 4).map((c) => { const sk = c.id ? ALL_SKILLS[c.id] : null; return (
          <div key={c.key} className={`sk ${c.ok && c.cd <= 0 ? '' : 'off'}`} title={c.name} style={sk ? { borderColor: col } : undefined}><b>{c.key}</b><div className="in">{c.name}</div>{c.cd > 0 && <div className="cd" style={{ height: `${(c.cd / c.max) * 100}%` }} />}</div>); })}
        {h.cds.slice(4).map((c, i) => (
          <div key={c.key} className={`sk big ${i === 2 ? 'ult' : ''} ${i === 2 && c.ok ? 'ready' : ''} ${c.ok && c.cd <= 0 ? '' : 'off'}`} title={c.name}><b>{c.key}</b><div className="in">{i === 2 ? <>{c.name}<div className="hbar xp ultbar"><i style={{ width: `${h.ult}%`, background: '#ff3a4e' }} /></div></> : c.name}</div>{c.cd > 0 && <div className="cd" style={{ height: `${(c.cd / c.max) * 100}%` }} />}</div>))}
      </div>
      {help && <div className="help"><b>WASD</b> move · <b>Shift</b> sprint<br /><b>LMB/RMB</b> light/heavy · <b>Space</b> dodge<br /><b>C</b> guard (parry!) · <b>1-4</b> forms<br /><b>Q</b> focus · <b>E</b> special · <b>R</b> ultimate<br /><b>F</b> lock · <b>G</b> interact · <b>Esc</b> pause</div>}
      {prof.settings.showFps && <div style={{ position: 'absolute', right: 8, bottom: 6, fontSize: 12, color: '#9f9' }}>{h.fps} FPS</div>}
      <div className="letter top" style={{ transform: h.cin ? 'none' : 'translateY(-100%)' }} /><div className="letter bot" style={{ transform: h.cin ? 'none' : 'translateY(100%)' }} />
      {h.fade > 0 && <div className="fade" style={{ opacity: h.fade }} />}
    </div>
  );
}
