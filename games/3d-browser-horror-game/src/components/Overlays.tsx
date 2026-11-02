import type { PhaseInfo, Settings } from '../game/game';
import { KEYS, Slider } from './Menu';

const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
};

export function PausedOverlay({
  onResume,
  onQuit,
  settings,
  onChange,
}: {
  onResume: () => void;
  onQuit: () => void;
  settings: Settings;
  onChange: (s: Settings) => void;
}) {
  return (
    <div onClick={onResume} className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/75 p-6 backdrop-blur-[3px]">
      <div
        onClick={(e) => e.stopPropagation()}
        className="anim-rise w-full max-w-2xl cursor-default rounded-lg border border-white/10 bg-black/70 p-7 shadow-[0_30px_80px_rgba(0,0,0,0.7)] backdrop-blur-md"
      >
        <div className="flex items-end justify-between">
          <div className="font-horror blood-text text-5xl">Paused</div>
          <div className="anim-flicker text-[11px] uppercase tracking-[0.3em] text-stone-500">Click the dark to return</div>
        </div>

        <div className="mt-6 grid gap-7 md:grid-cols-2">
          <div className="space-y-4">
            <div className="text-[11px] uppercase tracking-[0.3em] text-red-500">Settings</div>
            <Slider label="Volume" value={settings.volume} min={0} max={1} step={0.05} onChange={(v) => onChange({ ...settings, volume: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
            <Slider label="Brightness" value={settings.brightness} min={0.5} max={2.2} step={0.05} onChange={(v) => onChange({ ...settings, brightness: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
            <Slider label="Mouse sensitivity" value={settings.sensitivity} min={0.3} max={2.5} step={0.05} onChange={(v) => onChange({ ...settings, sensitivity: v })} fmt={(v) => v.toFixed(2)} />
            <div className="text-[10px] uppercase tracking-[0.25em] text-stone-600">
              Graphics: {settings.quality} — change it from the main menu
            </div>
          </div>
          <div>
            <div className="mb-3 text-[11px] uppercase tracking-[0.3em] text-red-500">Controls</div>
            <div className="grid grid-cols-[105px_1fr] gap-y-1.5 text-[13px]">
              {KEYS.map(([k, v]) => (
                <div key={k} className="contents">
                  <span className="font-semibold text-amber-200/90">{k}</span>
                  <span className="text-stone-400">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-7 flex items-center justify-between gap-4 border-t border-white/10 pt-5">
          <button
            onClick={onQuit}
            className="rounded-sm border border-white/15 px-6 py-2.5 text-xs uppercase tracking-[0.3em] text-stone-400 transition-colors hover:border-white/40 hover:text-stone-200"
          >
            Quit to menu
          </button>
          <button
            onClick={onResume}
            className="rounded-sm border border-red-700/70 bg-red-950/60 px-9 py-2.5 uppercase tracking-[0.3em] text-red-100 transition-all hover:bg-red-800/70"
          >
            <span className="font-horror text-xl tracking-[0.2em]">Resume</span>
          </button>
        </div>
        <div className="mt-3 text-center text-[10px] uppercase tracking-[0.3em] text-stone-600">P or Esc also resumes</div>
      </div>
    </div>
  );
}

export function CaughtOverlay({ info }: { info: PhaseInfo }) {
  return (
    <div className="absolute inset-0">
      <div className="anim-redflash absolute inset-0 bg-red-700" />
      <div className="anim-blackin absolute inset-0 flex flex-col items-center justify-center bg-black">
        <div className="font-horror blood-text text-6xl md:text-7xl">Granny got you</div>
        <div className="mt-4 text-sm uppercase tracking-[0.4em] text-stone-500">
          {info.day ? `Day ${info.day} is over` : ''}
        </div>
        {info.room && (
          <div className="mt-2 text-xs uppercase tracking-[0.45em] text-stone-600">Caught in the {info.room}</div>
        )}
      </div>
    </div>
  );
}

export function DayCard({ day, maxDays }: { day: number; maxDays: number }) {
  return (
    <div className="anim-dayfade pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black">
      <div className="text-xs uppercase tracking-[0.6em] text-stone-500">{day === 1 ? 'The first night' : 'She is waiting'}</div>
      <div className="font-horror blood-text mt-3 text-8xl">Day {day}</div>
      <div className="mt-3 text-sm uppercase tracking-[0.4em] text-stone-500">{maxDays - day + 1} {maxDays - day + 1 === 1 ? 'chance' : 'chances'} left</div>
    </div>
  );
}

export function GameOver({ info, onRetry, onMenu }: { info: PhaseInfo; onRetry: () => void; onMenu: () => void }) {
  return (
    <div className="anim-fadein absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,#2a0505_0%,#000_75%)]">
      <div className="film-grain" style={{ opacity: 0.12 }} />
      <div className="text-xs uppercase tracking-[0.6em] text-stone-500">Five days passed</div>
      <h2 className="font-horror blood-text anim-flicker mt-4 text-center text-7xl md:text-8xl">You never left</h2>
      <p className="mt-6 max-w-md text-center text-sm leading-7 text-stone-400">
        The house is quiet again. Somewhere below, an old woman hums a lullaby and sets the table for one more guest.
      </p>
      <div className="mt-4 text-xs uppercase tracking-[0.3em] text-stone-600">Time survived {fmtTime(info.time ?? 0)}</div>
      <div className="mt-10 flex items-center gap-4">
        <button
          onClick={onRetry}
          className="rounded-sm border border-red-700/70 bg-red-950/60 px-10 py-3 uppercase tracking-[0.35em] text-red-100 shadow-[0_0_30px_rgba(160,0,0,0.35)] transition-all hover:bg-red-800/70"
        >
          <span className="font-horror text-2xl tracking-[0.25em]">Try again</span>
        </button>
        <button
          onClick={onMenu}
          className="rounded-sm border border-white/15 px-7 py-3 text-xs uppercase tracking-[0.3em] text-stone-400 transition-colors hover:border-white/40 hover:text-stone-200"
        >
          Main menu
        </button>
      </div>
    </div>
  );
}

export function WinScreen({ info, onRetry, onMenu }: { info: PhaseInfo; onRetry: () => void; onMenu: () => void }) {
  const daysUsed = info.day ?? 1;
  return (
    <div className="anim-fadein absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,#f4efe0_0%,#c9c2a8_60%,#8e866c_100%)] text-[#1d1a12]">
      <div className="text-xs uppercase tracking-[0.6em] text-[#5a5238]">Dawn breaks</div>
      <h2 className="font-horror mt-4 text-center text-7xl text-[#2c2415] md:text-8xl">You escaped!</h2>
      <p className="mt-6 max-w-md text-center text-[15px] leading-7 text-[#4a4228]">
        Cold rain on your face. Behind you, the front door creaks shut — and an old lady's lullaby fades into the storm.
      </p>
      <div className="mt-6 flex gap-10 text-center">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#6a6244]">Time</div>
          <div className="font-horror text-4xl">{fmtTime(info.time ?? 0)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#6a6244]">Day escaped</div>
          <div className="font-horror text-4xl">{daysUsed} / {info.maxDays ?? 5}</div>
        </div>
      </div>
      <div className="mt-10 flex items-center gap-4">
        <button
          onClick={onRetry}
          className="rounded-sm border border-[#3a321c] bg-[#2c2415] px-10 py-3 uppercase tracking-[0.35em] text-[#efe6c8] transition-all hover:bg-[#4a3d22]"
        >
          <span className="font-horror text-2xl tracking-[0.25em]">Play again</span>
        </button>
        <button
          onClick={onMenu}
          className="rounded-sm border border-[#6a6244]/60 px-7 py-3 text-xs uppercase tracking-[0.3em] text-[#5a5238] transition-colors hover:border-[#3a321c] hover:text-[#2c2415]"
        >
          Main menu
        </button>
      </div>
    </div>
  );
}
