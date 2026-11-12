import { useEffect, useState } from 'react';
import { useGame } from '../store';
import { ACTION_LABELS, GRAPHICS, DEFAULT_BINDINGS, type Action } from '../config';
import { keyLabel } from '../systems/hud';
import { input } from '../input';
import { audio } from '../audio';

const Slider = ({ label, value, onChange, min = 0, max = 1, step = 0.01 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) => (
  <label className="flex items-center gap-3 py-1.5">
    <span className="w-40 text-sm font-bold text-slate-200">{label}</span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="flex-1" />
    <span className="w-12 text-right text-xs tabular-nums text-orange-300">{Math.round((value / max) * 100)}%</span>
  </label>
);

export function ControlsTable() {
  const bindings = useGame((s) => s.settings.bindings); const rebind = useGame((s) => s.rebind); const reset = useGame((s) => s.resetBindings);
  const [cap, setCap] = useState<Action | null>(null);
  useEffect(() => {
    if (!cap) return; input.capturing = true;
    const h = (e: KeyboardEvent) => { e.preventDefault(); e.stopPropagation(); if (e.code !== 'Escape') rebind(cap, e.code); setCap(null); };
    window.addEventListener('keydown', h, true);
    return () => { window.removeEventListener('keydown', h, true); setTimeout(() => { input.capturing = false; }, 50); };
  }, [cap, rebind]);
  const fixed: [string, string][] = [['Left Mouse', 'Basic attack combo (air: dive slam)'], ['Right Mouse', 'Heavy attack'], ['Mouse', 'Camera'], ['Esc', 'Pause menu']];
  return (
    <div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
        {fixed.map(([k, d]) => (<div key={k} className="flex items-center justify-between border-b border-white/10 py-1 text-sm"><span className="text-slate-300">{d}</span><span className="chip text-sky-300">{k}</span></div>))}
        {(Object.keys(ACTION_LABELS) as Action[]).filter((a) => a !== 'pause').map((a) => (
          <div key={a} className="flex items-center justify-between border-b border-white/10 py-1 text-sm">
            <span className="text-slate-300">{ACTION_LABELS[a]}</span>
            <button className={`chip cursor-pointer ${cap === a ? 'animate-pulse bg-orange-500 text-black' : 'text-orange-300'}`} onClick={() => { audio.sfx('ui'); setCap(a); }}>{cap === a ? 'press a key…' : keyLabel(bindings[a])}</button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3"><button className="btn btn-sm" onClick={reset}><span>Reset to defaults</span></button><span className="text-xs text-slate-400">Space dodges in combat and jumps otherwise (Shift+Space always jumps). Defaults: {keyLabel(DEFAULT_BINDINGS.forward)}{keyLabel(DEFAULT_BINDINGS.left)}{keyLabel(DEFAULT_BINDINGS.back)}{keyLabel(DEFAULT_BINDINGS.right)}.</span></div>
    </div>
  );
}

export function SettingsPanel() {
  const s = useGame((g) => g.settings); const up = useGame((g) => g.updateSettings);
  const [tab, setTab] = useState<'audio' | 'gfx' | 'controls'>('audio');
  return (
    <div>
      <div className="mb-3 flex gap-1 border-b border-white/10">
        {(['audio', 'gfx', 'controls'] as const).map((t) => <button key={t} className={`tabbtn ${tab === t ? 'on' : ''}`} onClick={() => { audio.sfx('ui'); setTab(t); }}>{t === 'gfx' ? 'Graphics & Camera' : t}</button>)}
      </div>
      {tab === 'audio' && (<div>
        <Slider label="Master Volume" value={s.master} onChange={(v) => up({ master: v })} />
        <Slider label="Music" value={s.music} onChange={(v) => up({ music: v })} />
        <Slider label="Sound Effects" value={s.sfx} onChange={(v) => { up({ sfx: v }); audio.sfx('hit', 0.6); }} />
        <Slider label="Ambience" value={s.ambience} onChange={(v) => up({ ambience: v })} />
      </div>)}
      {tab === 'gfx' && (<div>
        <div className="mb-3 flex flex-wrap items-center gap-2"><span className="w-40 text-sm font-bold text-slate-200">Graphics Preset</span>
          {(Object.keys(GRAPHICS) as (keyof typeof GRAPHICS)[]).map((g) => <button key={g} className={`btn btn-sm ${s.graphics === g ? 'btn-primary' : ''}`} onClick={() => up({ graphics: g })}><span>{GRAPHICS[g].label}</span></button>)}
        </div>
        <p className="mb-3 text-xs text-slate-400">Low: no shadows, 0.85× resolution, sparse forest. Medium: 1K shadows. High: 2K shadows, full foliage and particles. Tuned for a laptop RTX 3050 at Medium/High.</p>
        <Slider label="Mouse Sensitivity" value={s.sensitivity} min={0.2} max={3} step={0.05} onChange={(v) => up({ sensitivity: v })} />
        <Slider label="Camera Shake" value={s.shake} min={0} max={1.5} step={0.05} onChange={(v) => up({ shake: v })} />
        <label className="flex items-center gap-3 py-1.5 text-sm font-bold text-slate-200"><input type="checkbox" checked={s.invertY} onChange={(e) => up({ invertY: e.target.checked })} /> Invert camera Y</label>
        <label className="flex items-center gap-3 py-1.5 text-sm font-bold text-slate-200"><input type="checkbox" checked={s.showFps} onChange={(e) => up({ showFps: e.target.checked })} /> Show FPS counter</label>
      </div>)}
      {tab === 'controls' && <ControlsTable />}
    </div>
  );
}
