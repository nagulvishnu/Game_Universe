import { useEffect, useState } from 'react';
import { useStore, QUALITY_PRESETS } from '../game/store';
import { BIND_LABELS, DEFAULT_BINDS } from '../game/data';
import { input } from '../game/input';
import { audio } from '../game/audio';
import { Btn, Panel } from './common';

export const keyName = (c: string) => c.replace('Key', '').replace('Digit', '').replace('Left', '').replace('Right', '').replace('Space', 'SPACE').replace('Shift', 'SHIFT').replace('Control', 'CTRL').replace('Arrow', '↑').toUpperCase();

function Slider({ label, value, min, max, step = 0.05, onChange, fmt }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return <div data-ui><div className="flex justify-between h-label mb-1"><span>{label}</span><span className="text-cyan-200">{fmt ? fmt(value) : value.toFixed(2)}</span></div><input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} /></div>;
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return <div data-ui className="flex items-center justify-between"><span className="h-label">{label}</span><Btn sm variant={value ? 'amber' : ''} onClick={() => onChange(!value)}>{value ? 'ON' : 'OFF'}</Btn></div>;
}

export function ControlsPanel() {
  const binds = useStore(s => s.settings.binds); const set = useStore(s => s.setSettings); const [wait, setWait] = useState<string | null>(null);
  useEffect(() => () => { input.rebinding = null; }, []);
  const start = (a: string) => { setWait(a); input.rebinding = (code: string) => { if (code !== 'Escape') { set({ binds: { ...useStore.getState().settings.binds, [a]: code } }); input.rebuild(); } setWait(null); }; };
  return <div data-ui className="grid gap-1.5">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">{Object.keys(BIND_LABELS).map(a => <button key={a} data-ui onClick={() => start(a)} className="flex items-center justify-between px-3 py-1.5 border border-cyan-400/20 hover:border-cyan-300 bg-black/30 text-left"><span className="h-label !text-[.65rem]">{BIND_LABELS[a]}</span><span className={`px-2 py-0.5 text-xs font-black border ${wait === a ? 'border-amber-400 text-amber-300 pulse' : 'border-cyan-300/60 text-cyan-100'}`}>{wait === a ? 'PRESS KEY…' : keyName(binds[a])}</span></button>)}</div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2 text-[.7rem] opacity-80"><span>🖱 LMB — Attack</span><span>🖱 RMB — Aim / Lock</span><span>🖱 Mouse — Camera</span><span>ESC — Pause</span></div>
    <div className="mt-2"><Btn sm onClick={() => { set({ binds: { ...DEFAULT_BINDS } }); input.rebuild(); }}>Reset Keys</Btn></div>
  </div>;
}

export function SettingsPanel({ compact }: { compact?: boolean }) {
  const s = useStore(st => st.settings); const set = useStore(st => st.setSettings); const q = useStore(st => st.setQuality); const unlock = useStore(st => st.unlockAll); const reset = useStore(st => st.resetSave); const reset2 = useStore(st => st.resetSettings); const toast = useStore(st => st.toast);
  useEffect(() => { audio.setVolumes(s.master, s.music, s.sfx); }, [s.master, s.music, s.sfx]);
  const [confirm, setConfirm] = useState(false);
  return <div data-ui className={`grid gap-4 ${compact ? '' : 'md:grid-cols-2'}`}>
    <Panel title="Graphics">
      <div className="grid gap-3">
        <div><div className="h-label mb-1">Quality Preset</div><div className="grid grid-cols-4 gap-1.5">{Object.keys(QUALITY_PRESETS).map(k => <Btn key={k} sm center variant={s.quality === k ? 'amber' : ''} onClick={() => q(k)}>{QUALITY_PRESETS[k].label}</Btn>)}</div><div className="text-[.65rem] opacity-60 mt-1">Applies on next deployment. Low is recommended for mobile.</div></div>
        <Slider label="Resolution Scale" value={s.res} min={0.5} max={1.5} onChange={v => set({ res: v })} fmt={v => `${Math.round(v * 100)}%`} />
        <div className="flex items-center justify-between"><span className="h-label">Shadow Quality</span><select value={s.shadows} onChange={e => set({ shadows: parseInt(e.target.value) })}>{['Off', 'Low', 'Medium', 'High'].map((n, i) => <option key={i} value={i}>{n}</option>)}</select></div>
        <Slider label="Particle Limit" value={s.particles} min={300} max={5000} step={100} onChange={v => set({ particles: v })} fmt={v => `${v}`} />
        <Slider label="Field of View" value={s.fov} min={50} max={95} step={1} onChange={v => set({ fov: v })} fmt={v => `${v}°`} />
        <Slider label="Camera Shake" value={s.shake} min={0} max={1.5} onChange={v => set({ shake: v })} fmt={v => `${Math.round(v * 100)}%`} />
        <Toggle label="Show FPS" value={s.fps} onChange={v => set({ fps: v })} />
      </div>
    </Panel>
    <div className="grid gap-4 content-start">
      <Panel title="Audio"><div className="grid gap-3"><Slider label="Master" value={s.master} min={0} max={1} onChange={v => set({ master: v })} fmt={v => `${Math.round(v * 100)}%`} /><Slider label="Music" value={s.music} min={0} max={1} onChange={v => set({ music: v })} fmt={v => `${Math.round(v * 100)}%`} /><Slider label="Effects" value={s.sfx} min={0} max={1} onChange={v => set({ sfx: v })} fmt={v => `${Math.round(v * 100)}%`} /></div></Panel>
      <Panel title="Controls"><div className="grid gap-3"><Slider label="Mouse Sensitivity" value={s.sens} min={0.2} max={3} onChange={v => set({ sens: v })} /><Toggle label="Invert Y Axis" value={s.invertY} onChange={v => set({ invertY: v })} />
        <div className="h-label pt-2 border-t border-cyan-400/20">Touch Controls</div><Slider label="Button Size" value={s.touchScale} min={0.7} max={1.5} onChange={v => set({ touchScale: v })} fmt={v => `${Math.round(v * 100)}%`} /><Slider label="Look Sensitivity" value={s.touchSens} min={0.3} max={3} onChange={v => set({ touchSens: v })} />
        <Toggle label="Edit Button Layout (drag in-game)" value={s.editTouch} onChange={v => set({ editTouch: v })} />{s.editTouch && <Btn sm onClick={() => set({ touchLayout: {} })}>Reset Layout</Btn>}</div></Panel>
    </div>
    {!compact && <Panel title="Keyboard Bindings" className="md:col-span-2"><ControlsPanel /></Panel>}
    {!compact && <Panel title="Save Data" className="md:col-span-2"><div className="flex flex-wrap gap-3 items-center"><Btn variant="amber" onClick={() => { unlock(); toast('CHEAT', 'All mechs, missions, levels unlocked (+50,000 credits).'); }}>Unlock Everything (Debug)</Btn><Btn onClick={() => { reset2(); toast('SETTINGS', 'Settings reset to defaults.'); }}>Reset Settings</Btn>
      {confirm ? <><span className="text-red-300 text-sm">Erase ALL progress?</span><Btn variant="red" onClick={() => { reset(); setConfirm(false); toast('SAVE ERASED', 'Progress reset.'); }}>Confirm Erase</Btn><Btn onClick={() => setConfirm(false)}>Cancel</Btn></> : <Btn variant="red" onClick={() => setConfirm(true)}>Erase Save</Btn>}<span className="text-xs opacity-60">Progress is saved automatically in your browser (LocalStorage).</span></div></Panel>}
  </div>;
}
