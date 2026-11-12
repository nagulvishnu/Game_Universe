import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../store';
import { useHud } from '../hudStore';
import { MISSIONS, RANKS, getMission } from '../data/missions';
import { NPCS, WATER_RECTS, COLLECTIBLES } from '../data/world';
import { ZONES, WORLD } from '../config';
import { missionAvailable } from '../logic/missionLogic';
import { rt } from '../runtime';
import { rankOf, startMission, abandonMission, objectiveMarker } from '../systems/missions';
import { Frame, StatusPanel, InventoryPanel, SkillsPanel, CharactersPanel, ShopPanel, closeOverlay } from './Panels';
import { SettingsPanel, ControlsTable } from './Settings';
import { SlotList } from './MainMenu';
import { saveGame, loadSlot, quitToMenu, respawn } from '../session';
import { audio } from '../audio';
import { input } from '../input';
import { moveXZ } from '../systems/move';
import { CHARACTERS } from '../data/characters';
import { burst, ring } from '../systems/fx';

function MissionsPanel() {
  const prof = useGame((s) => s.profile); const am = useGame((s) => s.profile.activeMission); const hud = useHud();
  const [tab, setTab] = useState<'story' | 'side' | 'log'>(am ? 'log' : 'story');
  const lv = prof.chars[prof.charId].level; const rank = rankOf(); const atBoard = rt.interact?.kind === 'board';
  const row = (m: (typeof MISSIONS)[number]) => {
    const done = prof.completed.includes(m.id); const av = missionAvailable(m, rank, lv, prof.completed); const active = am?.id === m.id;
    const giverName = m.giver === 'board' ? 'Mission Board' : NPCS.find((n) => n.id === m.giver)?.name ?? m.giver;
    return (
      <div key={m.id} className={`slot-cell cursor-default p-3 ${active ? 'sel' : ''} ${m.status === 'planned' ? 'opacity-60' : ''}`}>
        <div className="flex flex-wrap items-center gap-2"><span className="font-black text-white">{m.name}</span>
          {done && <span className="chip text-emerald-300">Complete</span>}{active && <span className="chip text-cyan-300">Active</span>}
          {m.status === 'planned' && <span className="chip text-slate-400">Planned — not yet playable</span>}
          {m.status === 'playable' && !done && !av.ok && <span className="chip text-red-300">{av.reason}</span>}
          <span className="chip text-slate-300">{RANKS[m.minRank].name}+</span>
        </div>
        <div className="mt-1 text-xs text-slate-300">{m.summary}</div>
        {m.status === 'playable' && <div className="mt-1 text-[11px] text-amber-300">Reward: {m.rewards.xp} XP • {m.rewards.ryo} ryo{m.rewards.items?.length ? ` • ${m.rewards.items.map(([i, n]) => `${n}× ${i}`).join(', ')}` : ''}{m.rewards.unlockChars ? ` • unlocks ${m.rewards.unlockChars.map((c) => CHARACTERS[c as keyof typeof CHARACTERS]?.name).join(', ')}` : ''}</div>}
        {m.status === 'playable' && !done && !active && av.ok && (
          m.giver === 'board'
            ? <button className="btn btn-sm btn-primary mt-2" disabled={!!am || !atBoard} onClick={() => { if (startMission(m.id)) { closeOverlay(); } }}><span>{am ? 'Finish current mission first' : atBoard ? 'Accept' : 'Accept at the Mission Board (Konoha)'}</span></button>
            : <div className="mt-1 text-[11px] text-sky-300">Speak to {giverName} to begin.</div>)}
      </div>);
  };
  const story = MISSIONS.filter((m) => m.kind === 'story'); const side = MISSIONS.filter((m) => m.kind === 'side');
  const cur = am ? getMission(am.id) : null;
  return (
    <Frame title="Mission Board & Log" tab="missions">
      <div className="mb-3 flex gap-1 border-b border-white/10">{(['log', 'story', 'side'] as const).map((t) => <button key={t} className={`tabbtn ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>{t === 'log' ? 'Active' : t === 'story' ? 'Story Chapters' : 'Side Missions'}</button>)}<div className="ml-auto self-center text-xs text-slate-300">Rank: <b className="text-yellow-300">{RANKS[rank].badge} {RANKS[rank].name}</b></div></div>
      {tab === 'log' && (cur ? (<div className="slot-cell cursor-default p-4"><div className="anime-title text-xl text-orange-400">{cur.name}</div><div className="my-2 text-sm text-slate-200">{cur.summary}</div>
        <ul className="space-y-1">{hud.objectives.map((o, i) => <li key={i} className={o.done ? 'text-emerald-300 line-through' : 'text-white'}>{o.done ? '✔' : '◆'} {o.text}</li>)}</ul>{hud.hint && <div className="mt-2 text-sm text-sky-300">💡 {hud.hint}</div>}
        {objectiveMarker() && <div className="mt-2 text-xs text-cyan-300">Objective marker is shown on the minimap, world map and as a cyan beam.</div>}
        <button className="btn btn-sm mt-3" onClick={() => { abandonMission(); }}><span>Abandon mission</span></button></div>) : <div className="text-sm text-slate-300">No active mission. Story chapters begin by talking to their NPC (look for the yellow “!”); side missions are accepted at the Mission Board near the Hokage tower.</div>)}
      {tab === 'story' && <div className="flex flex-col gap-2"><div className="text-xs text-slate-400">Chapters 1–3 are fully playable. Later chapters are planned and clearly marked — they cannot be started yet.</div>{story.map(row)}</div>}
      {tab === 'side' && <div className="flex flex-col gap-2">{!atBoard && <div className="text-xs text-amber-300">Stand next to the Mission Board (near the Hokage tower) and press T to accept side missions.</div>}{side.map(row)}</div>}
    </Frame>
  );
}

const FAST: { zone: string; label: string; x: number; z: number }[] = [
  { zone: 'konoha', label: 'Konoha plaza', x: 2, z: 18 }, { zone: 'forest', label: 'Forest of Death gate', x: 0, z: 136 }, { zone: 'waves', label: 'Land of Waves shore', x: -176, z: 14 },
  { zone: 'sand', label: 'Hidden Sand', x: 215, z: 12 }, { zone: 'myoboku', label: 'Mount Myoboku', x: -205, z: -196 }, { zone: 'valley', label: 'Valley of the End', x: 210, z: -196 },
];
function MapPanel() {
  const ref = useRef<HTMLCanvasElement>(null); const [sel, setSel] = useState<string | null>(null);
  const W = 680, H = 640; const sx = (x: number) => ((x - WORLD.minX) / (WORLD.maxX - WORLD.minX)) * W; const sz = (z: number) => ((z - WORLD.minZ) / (WORLD.maxZ - WORLD.minZ)) * H;
  const locked = !!rt.boss && rt.boss.state !== 'dead';
  useEffect(() => {
    const c = ref.current!; const x = c.getContext('2d')!; x.fillStyle = '#16304a'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#2a5a3a'; x.fillRect(sx(-330), sz(-310), sx(330) - sx(-330), sz(320) - sz(-310));
    for (const zn of ZONES) { const g = x.createRadialGradient(sx(zn.center[0]), sz(zn.center[1]), 4, sx(zn.center[0]), sz(zn.center[1]), (zn.radius / 690) * W); g.addColorStop(0, zn.mapColor); g.addColorStop(0.85, zn.mapColor + 'cc'); g.addColorStop(1, zn.mapColor + '00'); x.fillStyle = g; x.beginPath(); x.arc(sx(zn.center[0]), sz(zn.center[1]), (zn.radius / 690) * W * 1.15, 0, 7); x.fill(); }
    x.fillStyle = '#3a8ac0'; for (const r of WATER_RECTS) x.fillRect(sx(r[0]), sz(r[2]), sx(r[1]) - sx(r[0]), sz(r[3]) - sz(r[2]));
    x.strokeStyle = '#d9c9a2'; x.lineWidth = 3; x.beginPath(); x.moveTo(sx(-190), sz(0)); x.lineTo(sx(190), sz(0)); x.moveTo(sx(0), sz(0)); x.lineTo(sx(0), sz(215)); x.stroke();
    x.strokeStyle = '#8a7a5e'; x.lineWidth = 3; x.strokeRect(sx(-77), sz(-77), sx(77) - sx(-77), sz(77) - sz(-77)); x.fillStyle = '#8a7c60'; x.fillRect(sx(-60), sz(-125), sx(60) - sx(-60), sz(-90) - sz(-125));
    x.font = 'bold 13px sans-serif'; x.textAlign = 'center';
    for (const zn of ZONES) { x.fillStyle = '#000a'; x.fillText(zn.name, sx(zn.center[0]) + 1, sz(zn.center[1]) + 1 - (zn.id === 'konoha' ? 0 : 0)); x.fillStyle = sel === zn.id ? '#ffd24a' : '#fff'; x.fillText(zn.name, sx(zn.center[0]), sz(zn.center[1]) - (zn.id === 'konoha' ? 0 : 0)); }
    for (const cl of COLLECTIBLES) { if (cl.mission) continue; const got = useGame.getState().profile.collected.includes(cl.id); x.fillStyle = got ? '#667' : '#ffe14a'; x.beginPath(); x.arc(sx(cl.pos[0]), sz(cl.pos[2]), 3, 0, 7); x.fill(); }
    for (const n of NPCS) { x.fillStyle = '#7cf'; x.fillRect(sx(n.pos[0]) - 2, sz(n.pos[1]) - 2, 4, 4); }
    for (const e of rt.enemies) { if (e.state === 'dead') continue; x.fillStyle = '#f33'; x.fillRect(sx(e.pos.x) - 2, sz(e.pos.z) - 2, 4, 4); }
    const mk = objectiveMarker(); if (mk) { x.fillStyle = '#5ce0ff'; x.beginPath(); x.moveTo(sx(mk.x), sz(mk.z) - 10); x.lineTo(sx(mk.x) + 7, sz(mk.z)); x.lineTo(sx(mk.x), sz(mk.z) + 10); x.lineTo(sx(mk.x) - 7, sz(mk.z)); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.stroke(); }
    const p = rt.player.pos; x.save(); x.translate(sx(p.x), sz(p.z)); x.rotate(Math.PI - rt.player.yaw); x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -9); x.lineTo(6, 7); x.lineTo(-6, 7); x.closePath(); x.fill(); x.stroke(); x.restore();
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps
  const travel = (f: (typeof FAST)[number]) => {
    if (locked) { audio.sfx('error'); return; }
    const p = rt.player; p.pos.x = f.x; p.pos.z = f.z; p.pos.y = 0; p.vel.x = p.vel.z = 0; moveXZ(p.pos, 0, 0, 0.45); rt.lock = null;
    burst(p.pos.x, 1, p.pos.z, { n: 40, color: '#ffffff', speed: 5, life: 0.8 }); ring(p.pos.x, 0.3, p.pos.z, { color: '#9ef', r1: 4, life: 0.6 }); audio.sfx('sub'); closeOverlay();
  };
  return (
    <Frame title="World Map" tab="map" wide>
      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <canvas ref={ref} width={W} height={H} className="max-h-[68vh] max-w-full border-2 border-orange-500/60" style={{ aspectRatio: `${W}/${H}`, height: 'min(68vh,640px)' }}
          onClick={(e) => { const r = ref.current!.getBoundingClientRect(); const wx = WORLD.minX + ((e.clientX - r.left) / r.width) * (WORLD.maxX - WORLD.minX); const wz = WORLD.minZ + ((e.clientY - r.top) / r.height) * (WORLD.maxZ - WORLD.minZ); let best: string | null = null, bd = 1e9; for (const z of ZONES) { const d = Math.hypot(wx - z.center[0], wz - z.center[1]); if (d < z.radius && d < bd) { bd = d; best = z.id; } } setSel(best); }} />
        <div className="flex min-w-[15rem] flex-col gap-2">
          <div className="text-xs font-black uppercase tracking-widest text-orange-300">Fast travel</div>
          {locked && <div className="text-xs text-red-300">Unavailable during a boss fight.</div>}
          {FAST.map((f) => (<button key={f.zone} className={`btn btn-sm justify-start ${sel === f.zone ? 'btn-primary' : ''}`} disabled={locked} onClick={() => travel(f)}><span>➤ {f.label}</span></button>))}
          <div className="mt-2 space-y-1 text-[11px] text-slate-300"><div><span className="text-white">▲</span> You • <span className="text-cyan-300">◆</span> Objective • <span className="text-yellow-300">●</span> Hidden treasure/scroll (grey = found) • <span className="text-sky-300">■</span> NPC • <span className="text-red-400">■</span> Enemy</div>
            <div>Tip: sprint (Shift) along the roads; zones stream in as you approach.</div></div>
        </div>
      </div>
    </Frame>
  );
}

function PausePanel() {
  const setO = useGame((s) => s.setOverlay); const [msg, setMsg] = useState('');
  const b = (label: string, fn: () => void, primary = false) => <button className={`btn ${primary ? 'btn-primary' : ''}`} onClick={() => { audio.sfx('confirm'); fn(); }}><span>{label}</span></button>;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 pointer-events-auto" data-ui>
      <div className="panel w-80 p-6"><h2 className="anime-title mb-4 text-center text-3xl text-orange-400">Paused</h2>
        <div className="flex flex-col gap-3">
          {b('Resume', closeOverlay, true)}
          {b('Save Game', () => setO('save'))}{b('Load Game', () => setO('load'))}{b('Missions', () => setO('missions'))}{b('Settings', () => setO('settings'))}{b('Controls', () => setO('controls'))}
          {b('Quit to Main Menu', () => { setMsg('Saving…'); quitToMenu(); })}
          {msg && <div className="text-center text-xs text-slate-300">{msg}</div>}
        </div></div></div>
  );
}

function SubPanel({ title, children }: { title: string; children: React.ReactNode }) {
  const setO = useGame((s) => s.setOverlay);
  return (<div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 p-3 pointer-events-auto" data-ui><div className="panel max-h-[90vh] w-full max-w-3xl overflow-y-auto p-6"><div className="mb-4 flex items-center justify-between"><h2 className="anime-title text-2xl text-orange-400">{title}</h2><button className="btn btn-sm" onClick={() => { audio.sfx('back'); setO('pause'); }}><span>← Back</span></button></div>{children}</div></div>);
}

function DialoguePanel() {
  const d = useGame((s) => s.dialogue); const adv = useGame((s) => s.advanceDialogue); const [shown, setShown] = useState(0);
  const line = d?.lines[d.idx]; const text = line?.text ?? '';
  useEffect(() => { setShown(0); if (!line) return; const id = setInterval(() => setShown((s) => { if (s >= text.length) { clearInterval(id); return s; } if (s % 3 === 0) audio.sfx('ui', 0.15); return s + 1; }), 18); return () => clearInterval(id); }, [d?.idx, text]); // eslint-disable-line react-hooks/exhaustive-deps
  const speakerColor = useMemo(() => { const n = (line?.portrait ?? '').toLowerCase(); return CHARACTERS[n as keyof typeof CHARACTERS]?.color ?? '#ffd24a'; }, [line?.portrait]);
  if (!d || !line) return null;
  const last = d.idx === d.lines.length - 1;
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex justify-center p-4 pointer-events-auto" data-ui onClick={() => { if (shown < text.length) setShown(text.length); else adv(); }}>
      <div className="panel w-full max-w-4xl p-4" style={{ animation: 'slideUp .25s' }}>
        <div className="flex gap-4">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center text-5xl" style={{ background: `linear-gradient(135deg,${speakerColor}66,#0a0e28)`, border: `2px solid ${speakerColor}` }}>{line.speaker === 'Narrator' || line.speaker === 'System' || !line.speaker ? '📜' : '🥷'}</div>
          <div className="flex-1"><div className="anime-title text-xl" style={{ color: speakerColor }}>{line.speaker}</div><div className="min-h-[3.5rem] text-lg leading-snug text-white">{text.slice(0, shown)}</div></div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex flex-wrap gap-2">{last && shown >= text.length && d.choices?.map((c, i) => <button key={i} className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); audio.sfx('confirm'); c.action(); }}><span>{c.label}</span></button>)}</div>
          <div className="animate-pulse text-xs font-bold uppercase tracking-widest text-orange-300">{d.idx + 1}/{d.lines.length} • Click / Space ▶</div>
        </div>
      </div>
    </div>
  );
}

function GameOver() {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 pointer-events-auto" data-ui style={{ animation: 'fadeIn 1s' }}>
      <div className="text-center"><h1 className="anime-title text-7xl text-red-500">Defeated</h1><p className="mt-2 text-slate-300">Even great shinobi fall. Rise again.</p>
        <div className="mt-6 flex flex-col items-center gap-3"><button className="btn btn-primary" onClick={() => { audio.sfx('confirm'); respawn(false); }}><span>Retry from checkpoint</span></button><button className="btn" onClick={() => { audio.sfx('confirm'); respawn(true); }}><span>Return to Konoha</span></button><button className="btn" onClick={() => quitToMenu()}><span>Main Menu</span></button></div></div></div>
  );
}

export function Overlays() {
  const o = useGame((s) => s.overlay);
  useEffect(() => { if (o) audio.charge(false); }, [o]);
  if (!o) return null;
  switch (o) {
    case 'pause': return <PausePanel />;
    case 'status': return <StatusPanel />;
    case 'inventory': return <InventoryPanel />;
    case 'skills': return <SkillsPanel />;
    case 'characters': return <CharactersPanel />;
    case 'missions': return <MissionsPanel />;
    case 'map': return <MapPanel />;
    case 'shop': return <ShopPanel />;
    case 'dialogue': return <DialoguePanel />;
    case 'gameover': return <GameOver />;
    case 'settings': return <SubPanel title="Settings"><SettingsPanel /></SubPanel>;
    case 'controls': return <SubPanel title="Controls"><ControlsTable /></SubPanel>;
    case 'save': return <SubPanel title="Save Game"><SlotList mode="save" onPick={async (s) => { await saveGame(s); }} /></SubPanel>;
    case 'load': return <SubPanel title="Load Game"><SlotList mode="load" onPick={async (s) => { await loadSlot(s); input.noteOverlayChange(); }} /></SubPanel>;
    default: return null;
  }
}
