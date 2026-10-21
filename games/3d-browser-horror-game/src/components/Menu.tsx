import type { Settings } from '../game/game';
import { cn } from '../utils/cn';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onPlay: () => void;
}

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex justify-between text-[11px] uppercase tracking-[0.2em] text-stone-400">
        <span>{label}</span>
        <span className="text-stone-300">{fmt(value)}</span>
      </div>
      <input type="range" className="w-full" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  );
}

const KEYS: [string, string][] = [
  ['W A S D', 'Move'],
  ['Mouse', 'Look'],
  ['Shift', 'Run (uses stamina)'],
  ['C / Ctrl', 'Crouch (silent)'],
  ['E', 'Interact / hide'],
  ['F', 'Flashlight'],
  ['Click / Q', 'Throw a bottle'],
  ['Esc', 'Pause'],
];

export function Menu({ settings, onChange, onPlay }: Props) {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.93)_75%)]">
      <div className="film-grain" style={{ opacity: 0.12 }} />
      <div className="relative mx-auto grid w-full max-w-5xl gap-10 px-8 py-6 md:py-10 md:grid-cols-[1.15fr_1fr]">
        <div className="flex flex-col justify-center">
          <div className="anim-fadein mb-2 text-xs uppercase tracking-[0.5em] text-stone-500">A 3D survival horror</div>
          <h1 className="font-horror blood-text anim-flicker text-6xl leading-[0.95] md:text-8xl">
            Granny&apos;s
            <br />
            House
          </h1>
          <p className="anim-rise mt-6 max-w-md text-[15px] leading-7 text-stone-300/90" style={{ animationDelay: '0.3s' }}>
            You wake up in a stranger&apos;s house on a stormy night. The doors are locked. Something shuffles in the dark below — and
            <span className="text-red-400"> she hears everything</span>.
          </p>
          <ul className="anim-rise mt-5 space-y-1.5 text-sm text-stone-400" style={{ animationDelay: '0.5s' }}>
            <li><span className="mr-2 text-red-600">✦</span>Find the keys and unlock the front door</li>
            <li><span className="mr-2 text-red-600">✦</span>Hide in wardrobes &amp; under beds — but not where she can see</li>
            <li><span className="mr-2 text-red-600">✦</span>Throw bottles to lure her away</li>
            <li><span className="mr-2 text-red-600">✦</span>You have <b className="text-stone-200">5 days</b>. Each time she catches you, a day is lost</li>
          </ul>
          <div className="mt-8 flex items-center gap-5">
            <button
              onClick={onPlay}
              className="group relative rounded-sm border border-red-700/70 bg-red-950/60 px-10 py-3.5 text-lg uppercase tracking-[0.35em] text-red-100 shadow-[0_0_30px_rgba(160,0,0,0.35)] transition-all hover:bg-red-800/70 hover:shadow-[0_0_44px_rgba(220,0,0,0.55)]"
            >
              <span className="font-horror text-2xl tracking-[0.25em]">Enter</span>
            </button>
            <span className="text-xs uppercase tracking-[0.25em] text-stone-500">🎧 Headphones recommended</span>
          </div>
        </div>

        <div className="anim-rise space-y-6 rounded-lg border border-white/10 bg-black/55 p-6 backdrop-blur-md" style={{ animationDelay: '0.4s' }}>
          <div>
            <div className="mb-3 text-[11px] uppercase tracking-[0.3em] text-red-500">Controls</div>
            <div className="grid grid-cols-[110px_1fr] gap-y-1.5 text-sm">
              {KEYS.map(([k, v]) => (
                <div key={k} className="contents">
                  <span className="font-semibold text-amber-200/90">{k}</span>
                  <span className="text-stone-400">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4 border-t border-white/10 pt-5">
            <div className="text-[11px] uppercase tracking-[0.3em] text-red-500">Settings</div>
            <Slider label="Volume" value={settings.volume} min={0} max={1} step={0.05} onChange={(v) => onChange({ ...settings, volume: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
            <Slider label="Brightness" value={settings.brightness} min={0.5} max={2.2} step={0.05} onChange={(v) => onChange({ ...settings, brightness: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
            <Slider label="Mouse sensitivity" value={settings.sensitivity} min={0.3} max={2.5} step={0.05} onChange={(v) => onChange({ ...settings, sensitivity: v })} fmt={(v) => v.toFixed(2)} />
            <div>
              <div className="mb-1.5 text-[11px] uppercase tracking-[0.2em] text-stone-400">Graphics</div>
              <div className="flex gap-2">
                {(['high', 'low'] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => onChange({ ...settings, quality: q })}
                    className={cn(
                      'flex-1 rounded border px-3 py-1.5 text-xs uppercase tracking-widest transition-colors',
                      settings.quality === q ? 'border-red-600/70 bg-red-900/40 text-red-100' : 'border-white/10 text-stone-400 hover:border-white/30',
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
