import { useEffect, useState } from 'react';
import { CHARACTERS } from '../game/data/characters';
import { MODES, GFX_PRESETS, GfxPreset, MatchMode } from '../game/data/config';
import { WEAPONS } from '../game/data/weapons';
import { CharacterPreview } from '../game/render/CharacterPreview';
import { useStore } from '../game/state/store';
import { audio } from '../game/audio/audio';
import { formatTime } from '../game/util';

export function Logo({ size = 'text-7xl' }: { size?: string }) {
  return (
    <div>
      <div className={`logo ${size} leading-none`}>LAST DROP</div>
      <div className="mt-2 text-sm tracking-[0.5em] text-sky-200/80 font-bold">50 ENTER. ONE SURVIVES.</div>
    </div>
  );
}

export function MainMenu() {
  const { profile, setScreen, startGame } = useStore();
  const ch = CHARACTERS.find((c) => c.id === profile.charId)!;
  useEffect(() => { const h = () => { audio.init(); audio.startMusic('menu'); window.removeEventListener('pointerdown', h); }; window.addEventListener('pointerdown', h); return () => window.removeEventListener('pointerdown', h); }, []);
  return (
    <div className="absolute inset-0">
      <div className="bgfx" />
      <CharacterPreview charId={profile.charId} skin={profile.skin} className="absolute right-[4vw] top-0 h-full w-[46vw]" pose="idle" />
      <div className="absolute left-[6vw] top-[10vh] anim-slide"><Logo /></div>
      <div className="absolute left-[6vw] top-[34vh] flex flex-col gap-4 w-[26rem]">
        <button className="btn hot" onClick={() => setScreen('lobby')}><span>▶ Play</span></button>
        <button className="btn" onClick={() => setScreen('select')}><span>Characters</span></button>
        <button className="btn" onClick={() => startGame('training')}><span>Training Ground</span></button>
        <button className="btn" onClick={() => setScreen('settings')}><span>Settings</span></button>
        <button className="btn" onClick={() => setScreen('stats')}><span>Statistics</span></button>
      </div>
      <div className="absolute right-[8vw] bottom-[8vh] text-right pointer-events-none">
        <div className="text-5xl font-black italic tracking-wider" style={{ textShadow: '0 4px 0 rgba(0,0,0,.5)' }}>{ch.name}</div>
        <div className="text-sky-300 font-bold tracking-widest">{ch.title.toUpperCase()}</div>
        <div className="text-xs text-white/60 mt-1">{ch.outfit} · {ch.skins[profile.skin]?.name}</div>
      </div>
      <div className="absolute left-[6vw] bottom-5 text-[11px] text-white/45 tracking-wider">WASD move · MOUSE aim · LMB fire · RMB aim · SPACE jump · SHIFT sprint · C crouch · Z prone · R reload · F interact · G grenade · 1-4 items · TAB inventory · M map</div>
    </div>
  );
}

export function CharacterSelect() {
  const { profile, setProfile, setScreen } = useStore();
  const ch = CHARACTERS.find((c) => c.id === profile.charId)!;
  return (
    <div className="absolute inset-0">
      <div className="bgfx" />
      <div className="absolute left-8 top-6"><div className="logo text-4xl">SELECT FIGHTER</div></div>
      <div className="absolute left-8 top-28 flex flex-col gap-3 w-72">
        {CHARACTERS.map((c) => (
          <button key={c.id} onClick={() => setProfile({ charId: c.id, skin: 0 })} className={`sk text-left border-2 p-3 transition ${c.id === profile.charId ? 'border-sky-300 bg-sky-500/25' : 'border-white/15 bg-black/40 hover:border-white/50'}`}>
            <div><div className="text-xl font-black italic tracking-wider">{c.name}</div><div className="text-xs text-white/70">{c.title}</div></div>
          </button>
        ))}
      </div>
      <CharacterPreview charId={profile.charId} skin={profile.skin} className="absolute left-[24vw] top-0 h-full w-[40vw]" pose="aim" />
      <div className="absolute right-8 top-24 w-[25rem] panel p-5 anim-pop">
        <div className="text-4xl font-black italic">{ch.name}</div>
        <div className="text-sky-300 font-bold tracking-widest text-sm">{ch.title.toUpperCase()}</div>
        <p className="mt-3 text-sm text-white/80">{ch.desc}</p>
        <p className="mt-2 text-xs text-pink-300 italic">“{ch.personality}”</p>
        <div className="mt-4 text-xs tracking-widest text-white/60">OUTFIT / SKIN</div>
        <div className="mt-2 flex flex-col gap-2">
          {ch.skins.map((s, i) => (
            <button key={s.name} onClick={() => setProfile({ skin: i })} className={`text-left px-3 py-2 border ${profile.skin === i ? 'border-sky-300 bg-sky-500/20' : 'border-white/15 hover:border-white/50'}`}>
              <span className="font-bold">{s.name}</span> <span className="chip ml-2">{i === 0 ? 'default' : 'unlocked'}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 chip inline-block">Cosmetic only — no gameplay advantage</div>
        <div className="mt-5 flex gap-3"><button className="btn hot sm" onClick={() => setScreen('menu')}><span>✔ Confirm</span></button><button className="btn sm" onClick={() => { setScreen('lobby'); }}><span>To Lobby</span></button></div>
      </div>
    </div>
  );
}

export function Lobby() {
  const { profile, setProfile, setScreen, startGame, ready } = useStore();
  const [rdy, setRdy] = useState(ready);
  const ch = CHARACTERS.find((c) => c.id === profile.charId)!;
  const [seedTxt, setSeedTxt] = useState(profile.seed ? String(profile.seed) : '');
  return (
    <div className="absolute inset-0">
      <div className="bgfx" />
      <div className="absolute left-8 top-6"><div className="logo text-4xl">MATCH LOBBY</div><div className="text-xs tracking-[0.4em] text-white/60 mt-1">VANTARA ISLAND · SOLO · OFFLINE</div></div>
      <CharacterPreview charId={profile.charId} skin={profile.skin} className="absolute left-[2vw] top-[12vh] h-[78vh] w-[34vw]" pose="idle" />
      <div className="absolute left-[34vw] top-[16vh] w-[34rem] flex flex-col gap-4">
        <div className="panel p-4">
          <div className="text-xs tracking-widest text-white/60">FIGHTER</div>
          <div className="text-2xl font-black italic">{ch.name} <span className="text-sm text-sky-300 not-italic">{ch.skins[profile.skin].name}</span></div>
          <input value={profile.name} maxLength={14} onChange={(e) => setProfile({ name: e.target.value })} className="mt-2 w-full bg-black/40 border border-white/20 px-3 py-1 text-sm outline-none focus:border-sky-300" placeholder="Callsign" />
        </div>
        <div className="panel p-4">
          <div className="text-xs tracking-widest text-white/60 mb-2">MATCH MODE</div>
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(MODES) as MatchMode[]).map((m) => (
              <button key={m} onClick={() => setProfile({ mode: m })} className={`p-3 text-left border-2 ${profile.mode === m ? 'border-amber-300 bg-amber-500/15' : 'border-white/15 hover:border-white/40'}`}>
                <div className="font-black italic">{MODES[m].name}</div><div className="text-xs text-white/65">{MODES[m].desc}</div>
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs"><span className="text-white/60 tracking-widest">MATCH SEED</span>
            <input value={seedTxt} onChange={(e) => { setSeedTxt(e.target.value.replace(/\D/g, '')); setProfile({ seed: parseInt(e.target.value.replace(/\D/g, '') || '0', 10) }); }} placeholder="random" className="bg-black/40 border border-white/20 px-2 py-1 w-36 outline-none focus:border-sky-300" />
            <span className="text-white/40">same seed = same loot, route & zones</span>
          </div>
        </div>
        <div className="panel p-4 flex items-center justify-between">
          <div><div className="text-xs tracking-widest text-white/60">LOBBY</div><div className="font-bold">1 player + 49 AI fighters</div><div className={`text-xs mt-1 ${rdy ? 'text-emerald-300' : 'text-amber-300'}`}>{rdy ? '● READY — waiting for launch' : '○ Not ready'}</div></div>
          <button className={`btn sm ${rdy ? '' : 'hot'}`} onClick={() => { setRdy(!rdy); useStore.setState({ ready: !rdy }); }}><span>{rdy ? 'Cancel' : 'Ready'}</span></button>
        </div>
        <div className="flex gap-4">
          <button className="btn hot" disabled={!rdy} onClick={() => startGame(profile.mode)}><span>Start Match</span></button>
          <button className="btn" onClick={() => setScreen('select')}><span>Change Fighter</span></button>
          <button className="btn" onClick={() => setScreen('menu')}><span>Back</span></button>
        </div>
      </div>
    </div>
  );
}

export function Loading() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <div className="bgfx" />
      <div className="relative z-10 text-center"><Logo size="text-6xl" />
        <div className="mt-10 mx-auto w-12 h-12 border-4 border-sky-300 border-t-transparent rounded-full" style={{ animation: 'spin 0.9s linear infinite' }} />
        <div className="mt-4 text-sm tracking-[0.4em] text-sky-100/80">GENERATING VANTARA ISLAND…</div></div>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <label className="block"><div className="flex justify-between text-xs tracking-widest text-white/70 mb-1"><span>{label}</span><span>{fmt ? fmt(value) : value}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} /></label>
  );
}

export function SettingsPanel({ compact = false }: { compact?: boolean }) {
  const { settings, setSettings, setGfx, setGfxPreset } = useStore();
  const g = settings.gfx;
  return (
    <div className={`grid ${compact ? 'grid-cols-1' : 'grid-cols-2'} gap-x-10 gap-y-4`}>
      <div className="space-y-4">
        <div className="text-sky-300 font-black tracking-widest">CONTROLS & AUDIO</div>
        <Slider label="CAMERA SENSITIVITY" value={settings.sens} min={0.2} max={3} step={0.05} onChange={(v) => setSettings({ sens: v })} fmt={(v) => v.toFixed(2)} />
        <Slider label="MUSIC VOLUME" value={settings.music} min={0} max={1} step={0.05} onChange={(v) => setSettings({ music: v })} fmt={(v) => Math.round(v * 100) + '%'} />
        <Slider label="SOUND EFFECTS VOLUME" value={settings.sfx} min={0} max={1} step={0.05} onChange={(v) => setSettings({ sfx: v })} fmt={(v) => Math.round(v * 100) + '%'} />
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={settings.autoPickup} onChange={(e) => setSettings({ autoPickup: e.target.checked })} /> Auto-pickup ammo, healing & throwables</label>
      </div>
      <div className="space-y-4">
        <div className="text-sky-300 font-black tracking-widest">GRAPHICS <span className="text-white/40 text-[10px]">(applies next match)</span></div>
        <div className="flex gap-2">{(['low', 'medium', 'high'] as GfxPreset[]).map((p) => (
          <button key={p} onClick={() => setGfxPreset(p)} className={`flex-1 py-2 text-xs font-bold tracking-widest border ${g.preset === p ? 'border-sky-300 bg-sky-500/25' : 'border-white/20 hover:border-white/50'}`}>{p.toUpperCase()}</button>
        ))}</div>
        <Slider label="RESOLUTION SCALE" value={g.resolution} min={0.5} max={1} step={0.05} onChange={(v) => setGfx({ resolution: v })} fmt={(v) => Math.round(v * 100) + '%'} />
        <Slider label="VIEW DISTANCE" value={g.viewDist} min={250} max={800} step={50} onChange={(v) => setGfx({ viewDist: v })} fmt={(v) => v + ' m'} />
        <Slider label="EFFECTS QUALITY" value={g.effects} min={0.3} max={1} step={0.1} onChange={(v) => setGfx({ effects: v })} fmt={(v) => Math.round(v * 100) + '%'} />
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={g.shadows} onChange={(e) => setGfx({ shadows: e.target.checked })} /> Shadows</label>
        <div className="text-[11px] text-white/45">Presets: {Object.values(GFX_PRESETS).map((p) => p.preset).join(' / ')} — tuned for RTX 3050-class GPUs at 60 FPS on Medium.</div>
      </div>
    </div>
  );
}

export function SettingsScreen() {
  const setScreen = useStore((s) => s.setScreen);
  return (
    <div className="absolute inset-0">
      <div className="bgfx" />
      <div className="absolute left-8 top-6 logo text-4xl">SETTINGS</div>
      <div className="absolute left-[8vw] right-[8vw] top-28 panel p-8 anim-pop"><SettingsPanel /></div>
      <button className="btn absolute left-8 bottom-8" onClick={() => setScreen('menu')}><span>Back</span></button>
    </div>
  );
}

export function StatsScreen() {
  const { stats, setScreen, resetStats } = useStore();
  const cards: [string, string][] = [
    ['MATCHES', String(stats.matches)], ['WINS', String(stats.wins)], ['ELIMINATIONS', String(stats.kills)], ['TOTAL DAMAGE', Math.round(stats.damage).toLocaleString()],
    ['HEADSHOTS', String(stats.headshots)], ['SURVIVAL TIME', formatTime(stats.survival)], ['BEST PLACEMENT', stats.bestPlacement ? '#' + stats.bestPlacement : '—'], ['DISTANCE', (stats.distance / 1000).toFixed(2) + ' km'],
  ];
  const ws = Object.entries(stats.weaponShots).sort((a, b) => b[1] - a[1]);
  const max = ws[0]?.[1] || 1;
  return (
    <div className="absolute inset-0">
      <div className="bgfx" />
      <div className="absolute left-8 top-6 logo text-4xl">MATCH STATISTICS</div>
      <div className="absolute left-[8vw] right-[8vw] top-24 grid grid-cols-4 gap-4">
        {cards.map(([k, v]) => <div key={k} className="panel p-4 anim-pop"><div className="text-[10px] tracking-[0.3em] text-white/55">{k}</div><div className="text-3xl font-black italic text-sky-200">{v}</div></div>)}
      </div>
      <div className="absolute left-[8vw] right-[8vw] top-[44vh] panel p-5">
        <div className="text-xs tracking-widest text-white/60 mb-3">WEAPON USAGE (shots fired)</div>
        {ws.length === 0 && <div className="text-white/40 text-sm">Play a match to record weapon usage.</div>}
        <div className="space-y-2">{ws.slice(0, 8).map(([id, n]) => (
          <div key={id} className="flex items-center gap-3 text-sm"><div className="w-28 font-bold">{WEAPONS[id]?.name ?? id}</div><div className="flex-1 h-3 bg-white/10"><div className="h-full bg-gradient-to-r from-sky-400 to-pink-400" style={{ width: `${(n / max) * 100}%` }} /></div><div className="w-14 text-right">{n}</div></div>
        ))}</div>
      </div>
      <div className="absolute left-8 bottom-8 flex gap-4"><button className="btn" onClick={() => setScreen('menu')}><span>Back</span></button><button className="btn sm" onClick={() => { if (confirm('Reset all saved statistics?')) resetStats(); }}><span>Reset Stats</span></button></div>
    </div>
  );
}
