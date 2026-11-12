import { useState } from 'react';
import { useStore, setSettings, startNewGame, loadGame, persist, clearScores, toast, hasSave, type Settings } from '../game/store';
import { RARITY, rankFor } from '../game/data';
import { getGame } from '../game/engine';
import { initAudio, sfx } from '../game/audio';
import { fmtTime } from '../game/util';
import { ItemCard, TowerSelect } from './Panels';

const OV = () => useStore.setState({ overlay: null });
function Modal({ title, onClose, children, w = 720 }: { title: string; onClose: () => void; children: React.ReactNode; w?: number }) {
  return (<div className="modal" onPointerDown={(e) => e.stopPropagation()}><div className="panel" style={{ width: `min(${w}px, 98vw)` }}><div className="ptitle"><span>{title}</span><button className="xbtn" onClick={onClose} aria-label="Close">✕</button></div><div className="pbody">{children}</div></div></div>);
}

export function Title() {
  const has = useStore((s) => s.hasSave); const [confirm, setConfirm] = useState(false); const g = { startTower: (n: number) => getGame()?.startTower(n), enterHub: () => getGame()?.enterHub() };
  const go = (fn: () => void) => () => { initAudio(); sfx('click'); fn(); };
  return (
    <div className="title-wrap" onPointerDown={() => initAudio()}>
      <div className="logo floatemo">TOWER OF INFINITY<small>CLIMB HIGHER · FIGHT STRONGER</small></div>
      <div className="tag">3D anime dungeon action · 100 floors · 10 guardians</div>
      {!confirm ? (
        <div className="menu-col">
          <button className="btn gold" onClick={go(() => { if (has) setConfirm(true); else { startNewGame(); g?.startTower(1); } })}>New Game</button>
          <button className="btn" disabled={!has} onClick={go(() => { if (loadGame()) g?.enterHub(); })}>Continue</button>
          <button className="btn" onClick={go(() => { if (has) loadGame(); useStore.setState({ overlay: 'floorselect' }); })}>Floor Select</button>
          <button className="btn" onClick={go(() => useStore.setState({ overlay: 'scores' }))}>High Scores</button>
          <button className="btn" onClick={go(() => useStore.setState({ overlay: 'settings' }))}>Settings</button>
          <button className="btn" onClick={go(() => useStore.setState({ overlay: 'help' }))}>How to Play</button>
          <button className="btn" onClick={go(() => useStore.setState({ overlay: 'exit' }))}>Exit</button>
        </div>
      ) : (
        <div className="panel menu-col" style={{ padding: 16, alignItems: 'stretch' }}>
          <div className="gold h">Overwrite your saved climb?</div><div className="muted" style={{ fontSize: 13 }}>Starting a new game replaces the current save.</div>
          <button className="btn red" onClick={go(() => { setConfirm(false); startNewGame(); g?.startTower(1); })}>Yes, start over</button><button className="btn" onClick={() => setConfirm(false)}>Cancel</button>
        </div>)}
      <div className="muted" style={{ marginTop: 18, fontSize: 12, letterSpacing: '0.18em' }}>{has ? 'SAVE FOUND' : 'NO SAVE DATA'} · PRESS NEW GAME TO DROP STRAIGHT INTO FLOOR 1</div>
    </div>
  );
}

export function Overlays() {
  const o = useStore((s) => s.overlay); const g = getGame();
  if (o === 'settings') return <SettingsPanel />;
  if (o === 'scores') return <ScoresPanel />;
  if (o === 'help') return <HelpPanel />;
  if (o === 'floorselect') return <Modal title="FLOOR SELECT" onClose={OV} w={960}><TowerSelect onStart={(n) => { OV(); g?.startTower(n); }} /></Modal>;
  if (o === 'exit') return <Modal title="LEAVE THE TOWER?" onClose={OV} w={480}><div className="col" style={{ alignItems: 'center', textAlign: 'center' }}><div className="muted">Your progress is saved automatically after every floor.<br />Browsers can’t close this tab for you — you can safely close it now.</div><div className="h gold" style={{ fontSize: 20 }}>Until we climb again…</div><button className="btn gold" onClick={OV}>Return to Title</button></div></Modal>;
  return null;
}

function Slider({ l, v, min = 0, max = 1, step = 0.05, on }: { l: string; v: number; min?: number; max?: number; step?: number; on: (n: number) => void }) {
  return <label className="col" style={{ gap: 2 }}><span className="row" style={{ justifyContent: 'space-between' }}><span>{l}</span><b className="gold">{Math.round(v * 100) / 100}</b></span><input type="range" min={min} max={max} step={step} value={v} onChange={(e) => on(parseFloat(e.target.value))} /></label>;
}
export function SettingsPanel() {
  const s = useStore((x) => x.settings); const g = getGame();
  const set = (p: Partial<Settings>) => { setSettings(p); g?.applySettings(); };
  return (
    <Modal title="SETTINGS" onClose={OV} w={760}>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14 }}>
        <div className="col"><div className="h gold" style={{ fontSize: 13 }}>AUDIO</div>
          <Slider l="Master volume" v={s.master} on={(v) => set({ master: v })} /><Slider l="Music" v={s.music} on={(v) => set({ music: v })} /><Slider l="Sound effects" v={s.sfx} on={(v) => set({ sfx: v })} />
          <div className="h gold" style={{ fontSize: 13, marginTop: 8 }}>CONTROLS</div>
          <Slider l="Camera sensitivity" v={s.sens} min={0.3} max={2.5} on={(v) => set({ sens: v })} /><Slider l="Screen shake" v={s.shake} on={(v) => set({ shake: v })} />
          <label className="col" style={{ gap: 2 }}>Touch controls<select value={s.touch} onChange={(e) => set({ touch: e.target.value as Settings['touch'] })}><option value="auto">Auto-detect</option><option value="on">Always on</option><option value="off">Off</option></select></label>
          <label className="col" style={{ gap: 2 }}>Player name (high scores)<input type="text" maxLength={14} value={s.name} onChange={(e) => set({ name: e.target.value })} /></label>
        </div>
        <div className="col"><div className="h gold" style={{ fontSize: 13 }}>GRAPHICS</div>
          <Slider l="Resolution scale" v={s.res} min={0.5} max={1} step={0.05} on={(v) => set({ res: v })} />
          <label className="col" style={{ gap: 2 }}>Shadow quality (applies next floor)<select value={s.shadows} onChange={(e) => set({ shadows: +e.target.value })}><option value={0}>Off</option><option value={1}>Low</option><option value={2}>Medium</option><option value={3}>High</option></select></label>
          <Slider l="Particle density" v={s.particles} min={0.2} max={1} on={(v) => set({ particles: v })} />
          <label className="col" style={{ gap: 2 }}>Effects quality (bloom)<select value={s.effects} onChange={(e) => set({ effects: +e.target.value })}><option value={0}>Off (fastest)</option><option value={1}>Low bloom</option><option value={2}>High bloom</option></select></label>
          <Slider l="View distance (applies next floor)" v={s.view} min={0.5} max={1.5} on={(v) => set({ view: v })} />
          <div className="muted" style={{ fontSize: 12 }}>The renderer also scales resolution dynamically to hold 60 FPS.</div>
        </div>
      </div>
    </Modal>
  );
}
export function ScoresPanel() {
  const sc = useStore((s) => s.scores);
  return (
    <Modal title="HIGH SCORES — LOCAL TOP 10" onClose={OV} w={760}>
      {sc.length ? <table className="scoretbl"><thead><tr><th>#</th><th>Climber</th><th>Score</th><th>Floor / Wave</th><th>Mode</th><th>Date</th></tr></thead><tbody>{sc.map((e, i) => <tr key={i}><td>{i + 1}</td><td>{e.name}</td><td className="gold">{e.score.toLocaleString()}</td><td>{e.floor}</td><td style={{ textTransform: 'capitalize' }}>{e.mode}</td><td className="muted">{e.date}</td></tr>)}</tbody></table> : <div className="muted">No runs recorded yet. Climb the tower — every run is scored when it ends!</div>}
      <div style={{ marginTop: 10 }}><button className="btn sm red" disabled={!sc.length} onClick={() => clearScores()}>Clear table</button></div>
    </Modal>
  );
}
export function HelpPanel() {
  const rows: [string, string][] = [['W A S D', 'Move'], ['Mouse', 'Rotate camera (click to capture)'], ['Left Click', 'Light attack combo (hold F to charge heavy)'], ['Right Click', 'DEFLECT — tap right as an enemy’s attack flashes for a PERFECT deflection, then counter!'], ['F', 'Heavy / charged attack (in air: dive slam)'], ['Q', 'Dodge (invincible dash) — required against RED unblockable attacks'], ['Space / Shift', 'Jump / Sprint'], ['E / R', 'Cast selected skill / next skill'], ['1 – 4', 'Select active skill slot'], ['V', 'Ultimate (weapon-specific)'], ['T', 'Awakening transformation'], ['Z / X', 'Lock-on / swap weapon'], ['I / Tab / M', 'Inventory / Character / Tower map'], ['Esc', 'Pause']];
  return (
    <Modal title="HOW TO PLAY" onClose={OV} w={760}>
      <div className="col"><div className="muted">Orange telegraphs can be deflected; <b className="rd">red telegraphs are unblockable</b> — dodge them. A perfect deflection staggers enemies, reflects projectiles and opens a counter-attack window. Bosses have a posture gauge: deflect their attacks to break it.</div>
        {rows.map(([k, v]) => <div key={k} className="stat"><b className="gold">{k}</b><span style={{ textAlign: 'right' }}>{v}</span></div>)}
        <div className="muted" style={{ fontSize: 13 }}>Touch: left thumb moves, right thumb drags the camera; use the on-screen buttons, tap skill icons to cast.</div></div>
    </Modal>
  );
}

export function Pause() {
  const paused = useStore((s) => s.paused); const scene = useStore((s) => s.scene); const g = getGame(); const training = useStore((s) => s.training);
  if (!paused || scene === 'title') return null;
  const resume = () => g?.togglePause(false);
  return (
    <div className="modal"><div className="panel" style={{ width: 'min(380px, 94vw)' }}>
      <div className="ptitle"><span>PAUSED</span></div>
      <div className="pbody col">
        <button className="btn gold" onClick={resume}>Resume</button>
        <button className="btn" onClick={() => { useStore.setState({ paused: false }); g?.openPanel('menu', 'inventory'); }}>Inventory / Skills</button>
        <button className="btn" onClick={() => useStore.setState({ overlay: 'settings' })}>Settings</button>
        <div className="row"><button className="btn" style={{ flex: 1 }} onClick={() => { persist(); toast('Game saved', '#7f9'); }}>Save</button><button className="btn" style={{ flex: 1 }} disabled={!hasSave()} onClick={() => { if (loadGame()) { toast('Save loaded', '#7f9'); g?.enterHub(); } }}>Load</button></div>
        {scene === 'floor' && <button className="btn" onClick={() => { useStore.setState({ paused: false }); g?.retry(); }}>Restart {training ? 'Training' : 'Floor'}</button>}
        {scene === 'floor' && <button className="btn" onClick={() => g?.quitToHub()}>Return to Hub</button>}
        <button className="btn red" onClick={() => { persist(); g?.showTitle(); }}>Main Menu</button>
      </div></div></div>
  );
}

export function Loading() { const l = useStore((s) => s.loading); return l ? <div className="loading"><div className="spinner" /><div>ASCENDING…</div></div> : null; }

export function Results() {
  const r = useStore((s) => s.results); const g = getGame(); const save = useStore((s) => s.save);
  if (!r) return null; const col = { S: '#ffd860', A: '#7dff9a', B: '#66ddff', C: '#c0a0ff', D: '#aaa' }[r.rank] || '#fff';
  const next = r.spec.mode === 'tower' && (r.spec.type === 'secret' ? (r.spec.returnTo ?? r.spec.n) : r.spec.n) < 100;
  return (
    <div className="modal" style={{ background: 'radial-gradient(ellipse at center, rgba(20,16,50,.75), rgba(4,3,14,.95))' }}>
      <div className="panel" style={{ width: 'min(900px, 98vw)' }}>
        <div className="ptitle"><span>{r.spec.mode === 'tower' ? `FLOOR ${r.spec.n} CLEARED` : 'COMPLETE'} — {r.spec.name}</span></div>
        <div className="pbody row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
          <div className="col" style={{ alignItems: 'center', flex: '0 0 190px' }}><div className="rank" style={{ color: col }}>{r.rank}</div><div className="muted" style={{ letterSpacing: '0.3em', fontSize: 12 }}>COMBAT RANK</div>{r.noHit && <div className="chip cy">★ NO HIT</div>}{r.first && <div className="chip gold">First clear bonus!</div>}</div>
          <div className="col" style={{ flex: '1 1 260px' }}>
            <div className="stat"><span>Score</span><b className="gold">{r.score.toLocaleString()}</b></div><div className="stat"><span>Time</span><b>{fmtTime(r.time)}</b></div><div className="stat"><span>Enemies defeated</span><b>{r.kills}</b></div>
            <div className="stat"><span>Perfect deflections</span><b>{r.perfect}</b></div><div className="stat"><span>Best combo</span><b>{r.maxCombo}</b></div><div className="stat"><span>Damage taken</span><b>{r.damage}</b></div>
            <div className="stat"><span>Gold earned</span><b className="gold">🪙 {r.gold}</b></div><div className="stat"><span>XP earned</span><b className="cy">{r.xp}</b></div>
            <div className="muted" style={{ fontSize: 12 }}>Level {save.level} · {rankFor(0) && ''}Highest floor {save.highest}</div>
          </div>
          <div className="col" style={{ flex: '1 1 260px', maxHeight: 260, overflow: 'auto' }}><div className="h gold" style={{ fontSize: 13 }}>LOOT ({r.loot.length})</div>{r.loot.map((it, i) => <ItemCard key={i} it={it} />)}{!r.loot.length && <div className="muted">No equipment this time.</div>}</div>
        </div>
        <div className="row" style={{ padding: '0 18px 16px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => g?.openPanel('menu', 'skills')}>Loadout & Skills</button>
          <button className="btn" onClick={() => g?.replayFloor()}>Replay</button>
          <button className="btn" onClick={() => g?.quitToHub()}>Hub</button>
          <button className="btn gold" onClick={() => g?.nextFloor()}>{next ? 'Next Floor ▶  [Enter]' : 'Continue ▶'}</button>
        </div>
      </div>
    </div>
  );
}

export function GameOver() {
  const d = useStore((s) => s.gameover); const sc = useStore((s) => s.scores); const g = getGame();
  if (!d) return null; const rc = RARITY.legendary.color; void rc;
  return (
    <div className="gameover">
      <div className="panel" style={{ width: 'min(620px, 98vw)', padding: 22, textAlign: 'center', background: 'rgba(8,4,16,.92)' }}>
        <div className="go-title" style={d.won ? { color: '#ffd860', textShadow: '0 0 30px #fa0, 0 4px 0 #000' } : undefined}>{d.won ? 'VICTORY' : 'DEFEATED'}</div>
        <div className="muted" style={{ letterSpacing: '0.2em', marginTop: 4, textTransform: 'uppercase' }}>{d.mode === 'endless' ? `Reached wave ${d.wave}` : d.mode === 'training' ? 'Training ended' : `${d.spec.name} · floor ${d.floor}`}</div>
        <div className="h gold" style={{ fontSize: 44, margin: '10px 0 0' }}>{d.score.toLocaleString()}</div><div className="muted" style={{ fontSize: 12, letterSpacing: '0.3em' }}>FINAL SCORE</div>
        {d.place >= 0 && <div className={d.place === 0 ? 'gold h' : 'cy'} style={{ marginTop: 6 }}>{d.place === 0 ? '★ NEW HIGH SCORE! ★' : `High-score table: #${d.place + 1}`}</div>}
        {sc.length > 0 && <table className="scoretbl" style={{ marginTop: 10 }}><tbody>{sc.slice(0, 5).map((e, i) => <tr key={i} className={i === d.place ? 'me' : ''}><td>{i + 1}</td><td>{e.name}</td><td style={{ textAlign: 'right' }}>{e.score.toLocaleString()}</td><td className="muted">{e.mode}</td></tr>)}</tbody></table>}
        <div className="row" style={{ justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
          <button className="btn gold" style={{ fontSize: 18, padding: '12px 26px' }} onClick={() => g?.retry()}>↻ Retry  [R]</button>
          <button className="btn" onClick={() => g?.quitToHub()}>Return to Hub</button><button className="btn" onClick={() => g?.showTitle()}>Main Menu</button>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Press R, Enter or Space to restart instantly. Your progress is kept.</div>
      </div>
    </div>
  );
}
