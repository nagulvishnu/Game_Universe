import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHud, useStore } from '../game/store';
import { WEAPONS } from '../game/data';
import { input } from '../game/input';
import { gameRef } from '../game/engine';
import { Btn, Bar, fmtTime, Panel } from './common';
import { keyName, SettingsPanel, ControlsPanel } from './Settings';

function Ability({ k, name, p, color, icon, sub }: { k: string; name: string; p: number; color: string; icon: string; sub?: string }) {
  const ready = p >= 1;
  return <div className="flex flex-col items-center gap-1" style={{ width: 64 }}>
    <div className="relative cut-sm" style={{ width: 54, height: 54, background: `conic-gradient(${color} ${p * 360}deg, rgba(255,255,255,.1) 0)`, padding: 3, boxShadow: ready ? `0 0 14px ${color}` : 'none' }}>
      <div className="w-full h-full cut-sm flex items-center justify-center text-xl" style={{ background: '#06101e', opacity: ready ? 1 : 0.6 }}>{icon}</div>
      <div className="absolute -top-1 -right-1 text-[.6rem] font-black px-1 bg-black/80 border border-cyan-300/60">{k}</div>
    </div>
    <div className="text-[.55rem] tracking-wider text-center opacity-80 leading-tight truncate w-full">{sub || name}</div>
  </div>;
}

export function Hud() {
  const h = useHud(); const s = useStore(st => st.settings); const setPaused = useStore(st => st.setPaused); const [flash, setFlash] = useState(0); const [hit, setHit] = useState<{ k: string; n: number } | null>(null); const touch = 'ontouchstart' in window;
  useEffect(() => { const a = (e: Event) => { setFlash(f => f + 1); void e; }; const b = (e: Event) => setHit({ k: (e as CustomEvent).detail, n: Math.random() }); window.addEventListener('hurt', a); window.addEventListener('hitmark', b); return () => { window.removeEventListener('hurt', a); window.removeEventListener('hitmark', b); }; }, []);
  const b = s.binds; const lowHp = h.hp / h.maxHp < 0.25; const hp = h.hp / h.maxHp; const hidden = h.cine ? { opacity: 0, transition: 'opacity .3s' } : { opacity: 1, transition: 'opacity .3s' };
  const wcol = { dash: '#4fd8ff' };
  return <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
    {/* letterbox */}
    <div className="absolute left-0 right-0 top-0 bg-black z-30" style={{ height: h.cine ? '11vh' : 0, transition: 'height .5s' }} /><div className="absolute left-0 right-0 bottom-0 bg-black z-30" style={{ height: h.cine ? '11vh' : 0, transition: 'height .5s' }} />
    {/* damage flash & low hp */}
    <div key={flash} className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(255,30,50,.65))', animation: flash ? 'flashRed .5s ease-out forwards' : 'none', opacity: 0 }} />
    {lowHp && <div className="absolute inset-0 pulse" style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(255,0,30,.35))' }} />}
    {/* crosshair */}
    <div className="absolute left-1/2 top-1/2" style={{ transform: 'translate(-50%,-50%)', ...hidden }}>
      <div className="w-7 h-7 rounded-full border border-cyan-200/70" style={{ boxShadow: '0 0 8px rgba(79,216,255,.6)' }} /><div className="absolute left-1/2 top-1/2 w-1 h-1 rounded-full bg-cyan-100" style={{ transform: 'translate(-50%,-50%)' }} />
      {hit && <div key={hit.n} className="absolute left-1/2 top-1/2 w-10 h-10" style={{ animation: 'hitpop .35s ease-out forwards', color: hit.k === 'weak' ? '#ff4a4a' : hit.k === 'crit' ? '#ffe070' : hit.k === 'dodge' ? '#7dff9a' : '#fff' }}><div className="absolute inset-0 border-2 rotate-45" style={{ borderColor: 'currentColor' }} /></div>}
    </div>
    <div id="lock-reticle" className="absolute left-0 top-0 hidden" style={{ width: 70, height: 70 }}><div className="absolute inset-0 border-2 border-red-400 rotate-45 pulse" /><div className="absolute inset-3 border border-red-300/70 rotate-45" /><div className="absolute left-1/2 -top-5 -translate-x-1/2 text-[.6rem] font-black text-red-300 tracking-widest">LOCKED</div></div>
    <div id="weak-marker" className="absolute left-0 top-0 hidden" style={{ width: 54, height: 54 }}><div className="absolute inset-0 rounded-full border-2 border-amber-300 pulse" /><div className="absolute left-1/2 top-1/2 w-2 h-2 bg-red-500 rounded-full -translate-x-1/2 -translate-y-1/2" /><div className="absolute left-1/2 -top-5 -translate-x-1/2 text-[.6rem] font-black text-amber-300 tracking-widest whitespace-nowrap">WEAK POINT</div></div>

    {/* top center: objective + boss */}
    <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[min(92vw,720px)] flex flex-col items-center gap-2" style={hidden}>
      <div className="text-center"><div className="h-label">{h.mode === 'campaign' ? 'MISSION OBJECTIVE' : h.mode.toUpperCase()}</div><div className="text-sm md:text-base font-bold tracking-widest uppercase glow-text">{h.objective}</div>
        <div className="text-xs opacity-80 tracking-widest">{h.waves ? `WAVE ${Math.min(h.wave, h.waves)} / ${h.waves}` : `WAVE ${h.wave}`} · HOSTILES {h.enemies}{h.bonus ? <span className="text-amber-300"> · BONUS: {h.bonus}</span> : null}</div></div>
      {h.boss && <div className="w-full slide-up"><div className="flex justify-between items-end mb-1"><span className="font-black tracking-[.25em] text-lg text-red-200" style={{ textShadow: '0 0 12px rgba(255,60,60,.8)' }}>{h.boss.name}</span><span className="h-label">{h.boss.phases > 1 ? `PHASE ${h.boss.phase + 1}/${h.boss.phases}` : ''}{h.boss.vuln ? <span className="text-amber-300 pulse"> · CORE EXPOSED</span> : ''}</span></div>
        <div className="relative cut-sm" style={{ height: 16, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,90,90,.6)' }}><div style={{ width: `${(h.boss.hp / h.boss.max) * 100}%`, height: '100%', background: h.boss.vuln ? 'linear-gradient(90deg,#ffb23a,#ff4a30)' : 'linear-gradient(90deg,#ff3a50,#a01030)', transition: 'width .15s', boxShadow: '0 0 12px rgba(255,60,80,.7)' }} />
          {Array.from({ length: h.boss.phases - 1 }).map((_, i) => <div key={i} className="absolute top-0 bottom-0 w-px bg-white/60" style={{ left: `${[62, 30, 18][i] ?? 30}%` }} />)}</div></div>}
      {h.integrity < 100 && (h.mode === 'city' || h.waves === 1 || h.mode === 'campaign') && (h.mode === 'city' || h.objective.includes('integrity')) && <div className="w-64"><Bar value={h.integrity} max={100} color={h.integrity < 40 ? '#ff4a66' : '#6dff9a'} label="CITY INTEGRITY" text={`${Math.round(h.integrity)}%`} h={7} /></div>}
      {h.beacon >= 0 && <div className="w-64"><Bar value={h.beacon} max={1} color="#ffc84a" label="BEACON INTEGRITY" text={`${Math.round(h.beacon * 100)}%`} h={7} /></div>}
    </div>

    {/* top right */}
    <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
      <div className="flex gap-2 items-center pointer-events-auto" data-ui><div className="text-right panel cut-sm px-3 py-1"><div className="text-lg font-black tabular-nums leading-none">{h.score.toLocaleString()}</div><div className="h-label !text-[.55rem]">SCORE · {fmtTime(h.time)} · KILLS {h.kills}</div></div>
        <button data-ui className="w-10 h-10 panel cut-sm text-lg hover:bg-cyan-400/30" onClick={() => setPaused(true)}>❚❚</button></div>
      {s.fps && <div className="text-xs text-lime-300">{h.fps} FPS</div>}
      {h.combo > 2 && <div className="text-right"><div className="text-3xl font-black text-amber-300 italic" style={{ textShadow: '0 0 12px rgba(255,170,0,.8)' }}>{h.combo} HIT</div><div className="h-label !text-[.55rem]">DAMAGE +{Math.min(25, h.combo)}%</div></div>}
    </div>

    {/* bottom left vitals */}
    <div className="absolute left-3 bottom-3 w-[min(46vw,330px)] panel cut p-3 grid gap-2" style={hidden}>
      <div className="flex justify-between items-center"><span className="font-black tracking-[.2em] text-sm">{h.mechName}</span>{h.alt && <span className="text-[.6rem] font-black text-amber-300 pulse tracking-widest">{h.alt.toUpperCase()} {Math.ceil(h.transformT)}s</span>}</div>
      <Bar value={h.hp} max={h.maxHp} color={hp < 0.3 ? '#ff4a66' : '#6dff9a'} label="HULL" text={`${Math.ceil(h.hp)}/${Math.ceil(h.maxHp)}`} h={9} />
      <Bar value={h.armor} max={h.maxArmor} color="#ffc84a" label="ARMOR" text={`${Math.ceil(h.armor)}`} h={6} />
      <Bar value={h.en} max={h.maxEn} color="#4fd8ff" label="ENERGY" text={`${Math.ceil(h.en)}`} h={6} />
      {h.shield > 0 && <Bar value={h.shield} max={1} color="#8bffb0" label="BARRIER" text="" h={5} />}
    </div>

    {/* bottom center weapons + abilities */}
    {!touch && <div className="absolute left-1/2 bottom-3 -translate-x-1/2 flex items-end gap-3 max-w-[96vw]" style={hidden}>
      <div className="grid gap-1 w-44">{h.weapons.map((w, i) => <div key={i} className={`px-2 py-1 cut-sm text-[.65rem] font-bold tracking-wider flex justify-between ${i === h.wi ? 'bg-amber-400/30 border border-amber-300' : 'panel opacity-70'}`}><span className="truncate">{WEAPONS[w]?.name}</span>{i === h.wi && <span className="text-amber-200">◄</span>}</div>)}<div className="h-1 bg-white/10"><div className="h-full bg-amber-300" style={{ width: `${h.wcd * 100}%` }} /></div><div className="text-[.55rem] opacity-60 text-center">[{keyName(b.switch)}] SWITCH WEAPON</div></div>
      <Ability k="⇧" name="Dash" p={h.dashCd} color="#4fd8ff" icon="⚡" sub="DASH" />
      <Ability k={keyName(b.guard)} name="Guard" p={1} color={h.guardCd ? '#ffb23a' : '#6dff9a'} icon="◈" sub="GUARD / PARRY" />
      <Ability k={keyName(b.special)} name={h.specialName} p={h.special} color="#ffb23a" icon="✦" sub={h.specialName} />
      <Ability k={keyName(b.transform)} name={h.altName} p={h.transformT > 0 ? 1 : h.transformCd} color="#d27bff" icon="✺" sub={h.altName} />
      <div className="flex flex-col items-center gap-1" style={{ width: 70 }}><div className="relative cut-sm" style={{ width: 62, height: 62, background: `conic-gradient(#ff4a66 ${h.ult * 3.6}deg, rgba(255,255,255,.1) 0)`, padding: 3, boxShadow: h.ult >= 100 ? '0 0 22px #ff4a66' : 'none', animation: h.ult >= 100 ? 'pulse .6s infinite' : 'none' }}><div className="w-full h-full cut-sm flex items-center justify-center text-2xl" style={{ background: '#150a10' }}>☄</div><div className="absolute -top-1 -right-1 text-[.6rem] font-black px-1 bg-black/80 border border-red-300/60">{keyName(b.ultimate)}</div></div><div className="text-[.55rem] tracking-wider text-center opacity-90 leading-tight">{h.ult >= 100 ? 'ULTIMATE READY' : `${Math.floor(h.ult)}%`}</div></div>
    </div>}
    {touch && <div className="absolute left-3 bottom-[7.5rem] w-44 grid gap-1" style={hidden}>{h.weapons.map((w, i) => <div key={i} className={`px-2 py-0.5 cut-sm text-[.6rem] font-bold ${i === h.wi ? 'bg-amber-400/30 border border-amber-300' : 'panel opacity-60'}`}>{WEAPONS[w]?.name}</div>)}<div className="h-1 bg-white/10"><div className="h-full bg-red-400" style={{ width: `${h.ult}%` }} /></div></div>}

    {/* messages */}
    {h.msg && <div key={h.msg} className="absolute left-1/2 top-[28%] -translate-x-1/2 msg-in text-center"><div className="text-xl md:text-3xl font-black tracking-[.2em] glow-text px-4" style={{ color: /DESTROY|LOST|WARNING|DOWN/.test(h.msg) ? '#ff6a80' : '#e8fbff' }}>{h.msg}</div></div>}
    {h.countdown > 0 && <div className="absolute left-1/2 top-[40%] -translate-x-1/2 text-center"><div className="h-label">NEXT WAVE IN</div><div className="text-6xl font-black">{h.countdown}</div></div>}
    <AnimatePresence>{h.title && <motion.div key={h.title.t} className="absolute left-0 right-0 top-[38%] text-center z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><div className="h-label !text-sm">{h.title.s}</div><div className="text-4xl md:text-7xl font-black uppercase" style={{ animation: 'titleIn 1.6s ease both', textShadow: '0 0 30px rgba(79,216,255,.8), 0 4px 0 #012' }}>{h.title.t}</div><div className="mx-auto mt-3 h-[2px] w-[40%] bg-gradient-to-r from-transparent via-cyan-300 to-transparent" /></motion.div>}</AnimatePresence>
    {h.choices && <ChoicePicker choices={h.choices} />}
    <div className="absolute inset-0 vignette" />
    {void wcol}
  </div>;
}

function ChoicePicker({ choices }: { choices: { id: string; name: string; desc: string }[] }) {
  return <div className="absolute inset-0 flex items-center justify-center bg-black/55 pointer-events-auto z-40" data-ui>
    <div className="slide-up w-[min(94vw,900px)]"><div className="text-center mb-4"><div className="h-label">INTERMISSION</div><div className="text-3xl font-black tracking-[.2em] glow-text">CHOOSE AN UPGRADE</div></div>
      <div className="grid md:grid-cols-3 gap-3">{choices.map(c => <button key={c.id} data-ui className="card panel cut p-5 text-left" onClick={() => { gameRef.g?.applyUpgrade(c.id); }}><div className="text-lg font-black tracking-wider text-amber-300">{c.name}</div><div className="text-sm opacity-80 mt-2">{c.desc}</div></button>)}</div>
      <div className="text-center mt-3 text-xs opacity-60">Auto-selects the first option in 30 seconds</div></div></div>;
}

export function PauseMenu() {
  const paused = useStore(s => s.paused); const setPaused = useStore(s => s.setPaused); const go = useStore(s => s.go); const launch = useStore(s => s.launch); const cfg = useStore(s => s.cfg); const [view, setView] = useState('main');
  useEffect(() => { if (paused) { input.exitLock(); setView('main'); } }, [paused]);
  if (!paused) return null;
  return <div className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center pointer-events-auto p-4" data-ui>
    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-[min(96vw,820px)] max-h-[92vh] scrollable">
      <div className="text-center mb-4"><div className="h-label">SYSTEM</div><div className="text-4xl font-black tracking-[.3em] glow-text">PAUSED</div></div>
      {view === 'main' && <div className="grid gap-2 max-w-sm mx-auto"><Btn variant="amber" onClick={() => setPaused(false)}>▶ Resume</Btn><Btn onClick={() => setView('controls')}>Controls</Btn><Btn onClick={() => setView('settings')}>Settings</Btn><Btn onClick={() => { setPaused(false); if (cfg) launch({ ...cfg }); }}>↻ Restart</Btn><Btn variant="red" onClick={() => go('menu')}>⏏ Abort to Main Menu</Btn><div className="text-center text-xs opacity-60 mt-2">Click the screen to recapture the mouse after resuming.</div></div>}
      {view === 'controls' && <Panel title="Controls"><ControlsPanel /><div className="mt-3"><Btn onClick={() => setView('main')}>◂ Back</Btn></div></Panel>}
      {view === 'settings' && <div><SettingsPanel compact /><div className="mt-3"><Btn onClick={() => setView('main')}>◂ Back</Btn></div></div>}
    </motion.div>
  </div>;
}

// ----------------------------------------------------------- touch controls
const BTNS: { id: string; label: string; r: number; b: number; size: number; act: string }[] = [
  { id: 'attack', label: 'FIRE', r: 24, b: 28, size: 96, act: 'attack' }, { id: 'jump', label: 'JUMP', r: 136, b: 34, size: 64, act: 'jump' }, { id: 'dash', label: 'DASH', r: 30, b: 140, size: 64, act: 'dash' },
  { id: 'special', label: 'SPEC', r: 108, b: 118, size: 62, act: 'special' }, { id: 'ult', label: 'ULT', r: 190, b: 100, size: 62, act: 'ultimate' }, { id: 'switch', label: 'WPN', r: 22, b: 220, size: 54, act: 'switch' },
  { id: 'lock', label: 'LOCK', r: 92, b: 205, size: 54, act: 'lock' }, { id: 'guard', label: 'GUARD', r: 172, b: 182, size: 54, act: 'guard' }, { id: 'tf', label: 'MODE', r: 240, b: 30, size: 54, act: 'transform' }, { id: 'vent', label: 'VENT', r: 250, b: 100, size: 48, act: 'reload' },
];
export function TouchControls() {
  const s = useStore(st => st.settings); const set = useStore(st => st.setSettings); const paused = useStore(st => st.paused); const [act, setAct] = useState<Record<string, boolean>>({}); const joyRef = useRef<HTMLDivElement>(null); const [knob, setKnob] = useState({ x: 0, y: 0 });
  const joyId = useRef<number | null>(null); const lookId = useRef<number | null>(null); const last = useRef({ x: 0, y: 0 }); const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  useEffect(() => { input.joy.x = 0; input.joy.y = 0; return () => { input.joy.x = 0; input.joy.y = 0; input.attack = false; }; }, []);
  if (paused) return null;
  const press = (b: typeof BTNS[0], on: boolean) => { setAct(a => ({ ...a, [b.id]: on })); if (b.act === 'attack') input.attack = on; else if (on) input.press(b.act); else input.release(b.act); };
  const joyMove = (e: React.PointerEvent) => { const r = joyRef.current!.getBoundingClientRect(); let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } setKnob({ x, y }); input.joy.x = Math.abs(x) < 0.12 ? 0 : x; input.joy.y = Math.abs(y) < 0.12 ? 0 : -y; };
  return <div className="absolute inset-0 z-30 pointer-events-none" style={{ touchAction: 'none' }}>
    <div className="absolute top-0 bottom-0 right-0 w-1/2 pointer-events-auto" style={{ touchAction: 'none' }} data-ui
      onPointerDown={e => { if (lookId.current === null) { lookId.current = e.pointerId; last.current = { x: e.clientX, y: e.clientY }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } }}
      onPointerMove={e => { if (e.pointerId === lookId.current) { input.mdx += (e.clientX - last.current.x) * 1.4 * s.touchSens; input.mdy += (e.clientY - last.current.y) * 1.4 * s.touchSens; last.current = { x: e.clientX, y: e.clientY }; } }}
      onPointerUp={e => { if (e.pointerId === lookId.current) lookId.current = null; }} onPointerCancel={() => { lookId.current = null; }} />
    <div ref={joyRef} className="absolute left-5 bottom-5 rounded-full pointer-events-auto" style={{ width: 150 * s.touchScale, height: 150 * s.touchScale, background: 'radial-gradient(circle, rgba(79,216,255,.12), rgba(10,30,60,.4))', border: '2px solid rgba(120,220,255,.5)', touchAction: 'none', transform: `translate(${(s.touchLayout.joy?.x ?? 0)}px, ${(s.touchLayout.joy?.y ?? 0)}px)` }} data-ui
      onPointerDown={e => { if (s.editTouch) { drag.current = { id: 'joy', sx: e.clientX, sy: e.clientY, ox: s.touchLayout.joy?.x ?? 0, oy: s.touchLayout.joy?.y ?? 0 }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); return; } joyId.current = e.pointerId; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); joyMove(e); }}
      onPointerMove={e => { if (drag.current?.id === 'joy') { set({ touchLayout: { ...s.touchLayout, joy: { x: drag.current.ox + e.clientX - drag.current.sx, y: drag.current.oy + e.clientY - drag.current.sy } } }); return; } if (e.pointerId === joyId.current) joyMove(e); }}
      onPointerUp={e => { drag.current = null; if (e.pointerId === joyId.current) { joyId.current = null; setKnob({ x: 0, y: 0 }); input.joy.x = 0; input.joy.y = 0; } }} onPointerCancel={() => { joyId.current = null; setKnob({ x: 0, y: 0 }); input.joy.x = 0; input.joy.y = 0; }}>
      <div className="absolute rounded-full" style={{ width: 62 * s.touchScale, height: 62 * s.touchScale, left: '50%', top: '50%', transform: `translate(calc(-50% + ${knob.x * 44 * s.touchScale}px), calc(-50% + ${knob.y * 44 * s.touchScale}px))`, background: 'radial-gradient(circle at 35% 30%, rgba(160,235,255,.8), rgba(40,120,190,.7))', border: '2px solid #bfeaff' }} />
    </div>
    {BTNS.map(b => { const o = s.touchLayout[b.id] || { x: 0, y: 0 }; const sz = b.size * s.touchScale; return <div key={b.id} data-ui className={`touch-btn ${act[b.id] ? 'active' : ''}`} style={{ width: sz, height: sz, right: b.r, bottom: b.b, transform: `translate(${o.x}px, ${o.y}px)`, outline: s.editTouch ? '2px dashed #ffb23a' : 'none' }}
      onPointerDown={e => { e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); if (s.editTouch) { drag.current = { id: b.id, sx: e.clientX, sy: e.clientY, ox: o.x, oy: o.y }; return; } press(b, true); }}
      onPointerMove={e => { if (drag.current?.id === b.id) set({ touchLayout: { ...s.touchLayout, [b.id]: { x: drag.current.ox + e.clientX - drag.current.sx, y: drag.current.oy + e.clientY - drag.current.sy } } }); }}
      onPointerUp={() => { if (drag.current?.id === b.id) { drag.current = null; return; } if (!s.editTouch) press(b, false); }} onPointerCancel={() => { drag.current = null; press(b, false); }}>{b.label}</div>; })}
    {s.editTouch && <div className="absolute top-16 left-1/2 -translate-x-1/2 panel px-4 py-2 text-xs text-amber-300 pointer-events-auto">LAYOUT EDIT MODE — drag buttons to reposition. Disable in Settings.</div>}
  </div>;
}

export function ToastLayer() {
  const toasts = useStore(s => s.toasts); const dismiss = useStore(s => s.dismissToast);
  return <div className="fixed top-3 left-3 z-[100] grid gap-2 w-[min(92vw,340px)] pointer-events-none"><AnimatePresence>{toasts.map(t => <motion.div key={t.id} initial={{ x: -320, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -320, opacity: 0 }} className="panel cut-sm p-3 pointer-events-auto" style={{ borderColor: t.kind === 'ach' ? '#ffb23a' : undefined, boxShadow: t.kind === 'ach' ? '0 0 22px rgba(255,178,58,.4)' : undefined }} onClick={() => dismiss(t.id)}>
    <div className={`h-label ${t.kind === 'ach' ? '!text-amber-300' : ''}`}>{t.kind === 'ach' ? '★ ' : ''}{t.title}</div><div className="text-sm">{t.text}</div></motion.div>)}</AnimatePresence></div>;
}
