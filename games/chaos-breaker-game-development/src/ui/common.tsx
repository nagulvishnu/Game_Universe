import { useMemo } from 'react';
import { ACTIONS, ACTION_LABELS, useGame } from '../game/store';
import { WEAPON_ORDER, WEAPONS } from '../game/data/weapons';
import { ARENAS, ARENA_ORDER, BOSSES, CHALLENGES, ENEMIES, MODES, STYLES, STYLE_ORDER } from '../game/data/world';
import { ModeId, StyleId, WeaponId } from '../game/types';
import { weaponArt } from './weaponArt';
import { demoAttack } from '../game/engine';
import { sfx } from '../game/audio';

export const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
export function keyLabel(code: string) {
  if (code.startsWith('Mouse')) return ['LMB', 'MMB', 'RMB'][+code.slice(5)] ?? code;
  return code.replace('Key', '').replace('Digit', '').replace('Left', '').replace('Right', code.startsWith('Arrow') ? '' : ' R').replace('Arrow', '↔').replace('Space', 'SPACE').replace('Shift', 'SHIFT').replace('Control', 'CTRL').toUpperCase();
}
export const Stat = ({ label, v, c }: { label: string; v: number; c: string }) => (
  <div className="flex items-center gap-2 text-[10px] tracking-widest uppercase text-zinc-400"><span className="w-12">{label}</span>
    <div className="h-1.5 flex-1 bg-black/60 rounded"><div className="h-full rounded" style={{ width: v * 10 + '%', background: c, boxShadow: `0 0 8px ${c}` }} /></div></div>
);

export function WeaponCard({ id, sel, onClick, compact }: { id: WeaponId; sel: boolean; onClick: () => void; compact?: boolean }) {
  const w = WEAPONS[id], save = useGame(s => s.save), idx = WEAPON_ORDER.indexOf(id);
  const art = useMemo(() => weaponArt(id, save.skin[id] && save.done[id + (save.skin[id] === 1 ? '1' : '3')] ? save.skin[id] : 0), [id, save.skin, save.done]);
  const done = CHALLENGES[id].filter(c => save.done[c.id]).length;
  return (
    <div className={`card ${sel ? 'sel' : ''} flex flex-col`} onClick={() => { sfx.ui(); onClick(); }} style={{ minWidth: compact ? 130 : 150 }}>
      <div className="relative" style={{ aspectRatio: '360/520', background: '#07070d' }}>
        {art ? <img src={art} alt={w.name} className="absolute inset-0 w-full h-full object-cover" draggable={false} /> : <div className="absolute inset-0 grid place-items-center text-5xl">⚔</div>}
        <span className="absolute top-1 left-1 key">{idx + 1}</span>
        <span className="absolute top-1 right-1 text-[10px] px-1 rounded bg-black/70" style={{ color: hex(w.color) }}>{done}/3 ★</span>
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black via-black/70 to-transparent">
          <div className="disp text-[11px] font-bold leading-tight" style={{ color: hex(w.color2), textShadow: `0 0 10px ${hex(w.color)}` }}>{w.name}</div>
          <div className="text-[9px] tracking-widest text-zinc-400 uppercase">{w.title}</div>
        </div>
      </div>
      {!compact && <div className="p-2 space-y-1">
        <Stat label="Power" v={w.stats.power} c={hex(w.color)} /><Stat label="Speed" v={w.stats.speed} c={hex(w.color)} /><Stat label="Reach" v={w.stats.reach} c={hex(w.color)} /><Stat label="Guard" v={w.stats.defense} c={hex(w.color)} />
      </div>}
    </div>
  );
}

export function StyleCard({ id, sel, onClick }: { id: StyleId; sel: boolean; onClick: () => void }) {
  const s = STYLES[id];
  return (
    <div className={`card ${sel ? 'sel' : ''} p-3`} onClick={() => { sfx.ui(); onClick(); }}>
      <div className="flex items-center gap-2"><span className="text-xl" style={{ filter: `drop-shadow(0 0 6px ${hex(s.color)})` }}>{s.icon}</span><span className="disp text-sm font-bold" style={{ color: hex(s.color) }}>{s.name}</span></div>
      <p className="text-[11px] text-zinc-400 mt-1 leading-snug">{s.desc}</p>
      <ul className="mt-1.5 text-[10.5px] text-zinc-300 space-y-0.5">{s.perks.map(p => <li key={p}>▸ {p}</li>)}</ul>
    </div>
  );
}

export function Armory({ compact }: { compact?: boolean }) {
  const st = useGame(); const w = WEAPONS[st.weapon], hub = st.screen === 'hub';
  const prog = st.save.progress[w.id], done = st.save.done;
  const moves = [...w.light.map((l, i) => ({ k: `L${i + 1}`, a: l })), { k: 'F', a: w.heavy }, { k: 'F+', a: w.charged }, { k: 'AIR', a: w.air[0] }, { k: 'AIR F', a: w.airHeavy }, { k: st.save.swap ? 'R' : 'E', a: w.spec1 }, { k: st.save.swap ? 'E' : 'R', a: w.spec2 }, { k: 'V', a: w.ult }, { k: 'CTR', a: w.counter }];
  return (
    <div className="space-y-4">
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 125 : 150}px, 1fr))` }}>
        {WEAPON_ORDER.map(id => <WeaponCard key={id} id={id} sel={st.weapon === id} compact={compact} onClick={() => st.set({ weapon: id })} />)}
      </div>
      <div className="panel p-4 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="disp text-lg font-black" style={{ color: hex(w.color2), textShadow: `0 0 14px ${hex(w.color)}` }}>{w.name}</h3>
          <p className="text-sm text-zinc-300 mt-1">{w.desc}</p>
          <div className="mt-3 text-xs space-y-1 text-zinc-300">
            <p><span className="text-amber-300">DEFLECTION ·</span> {w.deflectName} — perfect window {(w.pw * 1000) | 0}ms, re-parry in {(w.lock * 500) | 0}ms</p>
            <p><span className="text-pink-300">COUNTER ·</span> {w.counterName}</p>
            <p><span className="text-cyan-300">AWAKENING (T) ·</span> {w.awakenName}: {w.awakenDesc}</p>
          </div>
          <h4 className="disp text-xs text-amber-300 mt-4 mb-1">Mastery challenges</h4>
          <div className="space-y-1.5">
            {CHALLENGES[w.id].map(c => { const p = Math.min(prog[c.stat], c.target), ok = done[c.id]; return (
              <div key={c.id} className="text-[11px]"><div className="flex justify-between"><span className={ok ? 'text-emerald-300' : 'text-zinc-200'}>{ok ? '✓' : '○'} {c.label}</span><span className="text-zinc-400">{p}/{c.target}</span></div>
                <div className="h-1 bg-black/60 rounded"><div className="h-full rounded" style={{ width: (p / c.target) * 100 + '%', background: ok ? '#4dff9a' : hex(w.color) }} /></div>
                <div className="text-[10px] text-zinc-500">Reward: {c.rewardLabel}</div></div>); })}
          </div>
        </div>
        <div>
          <h4 className="disp text-xs text-amber-300 mb-1">Moveset {hub && <span className="text-zinc-500 normal-case tracking-normal">(click to preview)</span>}</h4>
          <div className="grid grid-cols-2 gap-1">
            {moves.map(m => (
              <button key={m.k + m.a.id} disabled={!hub} className={`text-left text-[11px] px-2 py-1 border border-white/10 bg-black/30 flex items-center gap-1.5 ${hub ? 'hover:border-amber-300/70' : 'cursor-default'}`} onClick={() => { if (hub) demoAttack(m.a); }}>
                <span className="key shrink-0">{m.k}</span><span className="truncate">{m.a.name}</span></button>))}
          </div>
          <h4 className="disp text-xs text-amber-300 mt-4 mb-1">Appearance</h4>
          <div className="flex gap-2 flex-wrap">
            {w.skins.map((s, i) => { const un = i === 0 || (i === 1 && done[w.id + '1']) || (i === 2 && done[w.id + '3']); return (
              <button key={i} disabled={!un} onClick={() => st.setSave({ skin: { ...st.save.skin, [w.id]: i } })} className={`px-2 py-1 text-[11px] border ${st.save.skin[w.id] === i && un ? 'border-amber-300 bg-amber-300/10' : 'border-white/15'} ${un ? '' : 'opacity-40'}`}>
                <span className="inline-block w-3 h-3 rounded-full mr-1 align-middle" style={{ background: hex(s.color), boxShadow: `0 0 8px ${hex(s.color)}` }} />{un ? s.name : '🔒 ' + s.name}{i === 2 && un ? ' (awakening)' : ''}</button>); })}
          </div>
          <label className={`flex items-center gap-2 mt-3 text-xs ${done[w.id + '2'] ? '' : 'opacity-40'}`}>
            <input type="checkbox" disabled={!done[w.id + '2']} checked={done[w.id + '2'] ? st.save.extraOn[w.id] !== false : false} onChange={e => st.setSave({ extraOn: { ...st.save.extraOn, [w.id]: e.target.checked } })} />
            Combo extension: {w.extra.name} {done[w.id + '2'] ? '' : '🔒'}</label>
          <label className="flex items-center gap-2 mt-2 text-xs"><input type="checkbox" checked={st.save.swap} onChange={e => st.setSave({ swap: e.target.checked })} />Swap special slots (E ↔ R)</label>
        </div>
      </div>
      <div>
        <h3 className="disp text-sm text-amber-300 mb-2">Combat style</h3>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>{STYLE_ORDER.map(id => <StyleCard key={id} id={id} sel={st.style === id} onClick={() => st.set({ style: id })} />)}</div>
      </div>
    </div>
  );
}

export function TrainingPanel() {
  const t = useGame(s => s.save.training), set = useGame(s => s.setSave);
  const up = (p: Partial<typeof t>) => set({ training: { ...t, ...p } });
  return (
    <div className="panel p-3 text-xs space-y-2">
      <h4 className="disp text-amber-300">Training dummy</h4>
      <label className="flex items-center justify-between gap-2">Enemy<select value={t.enemy} onChange={e => up({ enemy: e.target.value })}>
        {Object.values(ENEMIES).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}{Object.values(BOSSES).map(e => <option key={e.id} value={e.id}>★ {e.name}</option>)}</select></label>
      <label className="flex items-center justify-between gap-2">Behaviour<select value={t.behavior} onChange={e => up({ behavior: e.target.value as typeof t.behavior })}>
        <option value="passive">Passive (no attacks)</option><option value="slow">Slow telegraphs</option><option value="normal">Normal</option><option value="aggressive">Aggressive</option></select></label>
      <label className="flex items-center justify-between gap-2">Count {t.count}<input type="range" min={1} max={4} value={t.count} onChange={e => up({ count: +e.target.value })} /></label>
      <label className="flex items-center justify-between gap-2">Parry window ×{t.pw.toFixed(1)}<input type="range" min={.6} max={2.5} step={.1} value={t.pw} onChange={e => up({ pw: +e.target.value })} /></label>
      <p className="text-zinc-500">Changes apply instantly - the dummy respawns as needed. Ult & awakening charge 2.5× faster here.</p>
    </div>
  );
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="flex items-center justify-between gap-3 py-1.5 text-sm border-b border-white/5"><span className="text-zinc-300">{label}</span>{children}</label>;
export function SettingsPanel() {
  const s = useGame(x => x.settings), set = useGame(x => x.setSettings);
  const R = (k: 'sens' | 'camDist' | 'fov' | 'master' | 'music' | 'sfx' | 'shake' | 'fx', min: number, max: number, step: number) => <div className="flex items-center gap-2"><input type="range" min={min} max={max} step={step} value={s[k]} onChange={e => set({ [k]: +e.target.value })} /><span className="w-10 text-right text-xs text-zinc-400">{s[k].toFixed(step < 1 ? 2 : 0)}</span></div>;
  return (
    <div className="panel p-4 grid md:grid-cols-2 gap-x-8">
      <div>
        <h4 className="disp text-amber-300 mb-1">Graphics</h4>
        <Row label="Quality (low = mobile)"><select value={s.quality} onChange={e => set({ quality: e.target.value as typeof s.quality })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High (bloom)</option></select></Row>
        <Row label="Shadows"><input type="checkbox" checked={s.shadows} onChange={e => set({ shadows: e.target.checked })} /></Row>
        <Row label="Effects density">{R('fx', .3, 1, .05)}</Row>
        <Row label="Field of view">{R('fov', 50, 90, 1)}</Row>
        <h4 className="disp text-amber-300 mt-3 mb-1">Camera & feel</h4>
        <Row label="Mouse / touch sensitivity">{R('sens', .3, 2.5, .05)}</Row>
        <Row label="Camera distance">{R('camDist', .7, 1.6, .05)}</Row>
        <Row label="Screen shake">{R('shake', 0, 1.5, .05)}</Row>
        <Row label="Vibration / rumble"><input type="checkbox" checked={s.vibrate} onChange={e => set({ vibrate: e.target.checked })} /></Row>
      </div>
      <div>
        <h4 className="disp text-amber-300 mb-1">Gameplay</h4>
        <Row label="Difficulty (enemy damage, parry window)"><select value={s.difficulty} onChange={e => set({ difficulty: e.target.value as typeof s.difficulty })}><option value="easy">Easy</option><option value="normal">Normal</option><option value="hard">Hard</option></select></Row>
        <Row label="Touch controls"><select value={s.touch} onChange={e => set({ touch: e.target.value as typeof s.touch })}><option value="auto">Auto</option><option value="on">Always on</option><option value="off">Off</option></select></Row>
        <h4 className="disp text-amber-300 mt-3 mb-1">Audio</h4>
        <Row label="Master">{R('master', 0, 1, .05)}</Row><Row label="Music">{R('music', 0, 1, .05)}</Row><Row label="Effects">{R('sfx', 0, 1, .05)}</Row>
      </div>
    </div>
  );
}

export function ControlsPanel() {
  const keys = useGame(s => s.settings.keys), rebinding = useGame(s => s.rebinding), set = useGame(s => s.set), reset = useGame(s => s.resetKeys);
  return (
    <div className="panel p-4">
      <div className="flex justify-between items-center mb-2"><h4 className="disp text-amber-300">Controls - click a binding, then press a key or mouse button</h4><button className="btn sm" onClick={reset}>Reset defaults</button></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6">
        {ACTIONS.map(a => (
          <div key={a} className="flex items-center justify-between py-1 border-b border-white/5 text-sm"><span className="text-zinc-300">{ACTION_LABELS[a]}</span>
            <button className={`key min-w-[4.5rem] ${rebinding === a ? 'animate-pulse !bg-amber-400/40 !border-amber-300' : ''}`} onClick={() => set({ rebinding: rebinding === a ? null : a })}>{rebinding === a ? 'PRESS…' : keyLabel(keys[a])}</button></div>))}
        <div className="flex items-center justify-between py-1 text-sm text-zinc-500"><span>Pause</span><span className="key">ESC / P</span></div>
        <div className="flex items-center justify-between py-1 text-sm text-zinc-500"><span>Camera (no mouse)</span><span className="key">← → ↑ ↓</span></div>
        <div className="flex items-center justify-between py-1 text-sm text-zinc-500"><span>Instant restart (game over)</span><span className="key">ENTER</span></div>
      </div>
      <p className="text-xs text-zinc-500 mt-2">Gamepad: A jump · X light · Y heavy · RB deflect · B dodge · LB/LT specials · RT ultimate · R3 lock · sticks move/camera.</p>
    </div>
  );
}

export function ScoreTable({ mode, hl, limit = 10 }: { mode: ModeId | 'all'; hl?: number; limit?: number }) {
  const scores = useGame(s => s.save.scores); const list = scores.filter(s => mode === 'all' || s.mode === mode).slice(0, limit);
  return (
    <table className="w-full text-sm"><thead><tr className="text-[10px] tracking-widest uppercase text-zinc-500 text-left"><th className="py-1 w-8">#</th><th>Name</th><th>Score</th><th>Weapon</th><th>Wave</th>{mode === 'all' && <th>Mode</th>}</tr></thead>
      <tbody>{list.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-zinc-500">No records yet - go set one!</td></tr>}
        {list.map((s, i) => <tr key={s.date + '' + i} className={`border-t border-white/5 ${hl === i + 1 ? 'text-amber-300 font-bold bg-amber-300/10' : ''}`}><td className="py-1">{i + 1}</td><td>{s.name}</td><td className="tabular-nums">{s.score.toLocaleString()}</td><td style={{ color: hex(WEAPONS[s.weapon].color) }}>{WEAPONS[s.weapon].name.split(' ')[0]}</td><td>{s.wave || '-'}</td>{mode === 'all' && <td className="text-zinc-400">{s.mode}</td>}</tr>)}</tbody></table>
  );
}
export const ModeCards = ({ onPick }: { onPick?: () => void }) => { const st = useGame(); return (
  <div className="grid gap-2 sm:grid-cols-2">{MODES.map(m => <div key={m.id} className={`card p-3 ${st.mode === m.id ? 'sel' : ''}`} onClick={() => { sfx.ui(); st.set({ mode: m.id }); onPick?.(); }}>
    <div className="flex items-center gap-2"><span className="text-xl">{m.icon}</span><span className="disp text-sm font-bold text-amber-200">{m.name}</span></div><p className="text-[11px] text-zinc-400 mt-1">{m.desc}</p></div>)}</div>); };
export const ArenaCards = () => { const st = useGame(); return (
  <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">{ARENA_ORDER.map(id => { const a = ARENAS[id]; return (
    <div key={id} className={`card p-2 ${st.arena === id ? 'sel' : ''}`} onClick={() => { sfx.ui(); st.set({ arena: id }); }}>
      <div className="h-14 rounded mb-1.5" style={{ background: `radial-gradient(circle at 70% 25%, ${hex(a.accent)}aa, transparent 45%), linear-gradient(180deg, ${hex(a.sky[0])}, ${hex(a.sky[1])})`, boxShadow: `inset 0 -14px 24px ${hex(a.accent)}33` }} />
      <div className="disp text-[11px] font-bold" style={{ color: hex(a.accent) }}>{a.name}</div><p className="text-[10px] text-zinc-400 leading-snug">{a.desc}</p></div>); })}</div>); };
