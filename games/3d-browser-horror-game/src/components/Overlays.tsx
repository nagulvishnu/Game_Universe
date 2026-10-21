import type { PhaseInfo } from '../game/game';

const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
};

export function PausedOverlay({ onResume }: { onResume: () => void }) {
  return (
    <div onClick={onResume} className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center bg-black/75 backdrop-blur-[3px]">
      <div className="font-horror blood-text text-6xl">Paused</div>
      <div className="mt-6 text-sm uppercase tracking-[0.35em] text-stone-300 anim-flicker">Click to return to the dark</div>
      <div className="mt-10 grid grid-cols-2 gap-x-10 gap-y-1 text-xs text-stone-500">
        <span>WASD — move</span>
        <span>Shift — run</span>
        <span>C — crouch</span>
        <span>E — interact / hide</span>
        <span>F — flashlight</span>
        <span>Click / Q — throw bottle</span>
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

export function GameOver({ info, onRetry }: { info: PhaseInfo; onRetry: () => void }) {
  return (
    <div className="anim-fadein absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,#2a0505_0%,#000_75%)]">
      <div className="film-grain" style={{ opacity: 0.12 }} />
      <div className="text-xs uppercase tracking-[0.6em] text-stone-500">Five days passed</div>
      <h2 className="font-horror blood-text anim-flicker mt-4 text-center text-7xl md:text-8xl">You never left</h2>
      <p className="mt-6 max-w-md text-center text-sm leading-7 text-stone-400">
        The house is quiet again. Somewhere below, an old woman hums a lullaby and sets the table for one more guest.
      </p>
      <div className="mt-4 text-xs uppercase tracking-[0.3em] text-stone-600">Time survived {fmtTime(info.time ?? 0)}</div>
      <button
        onClick={onRetry}
        className="mt-10 rounded-sm border border-red-700/70 bg-red-950/60 px-10 py-3 uppercase tracking-[0.35em] text-red-100 shadow-[0_0_30px_rgba(160,0,0,0.35)] transition-all hover:bg-red-800/70"
      >
        <span className="font-horror text-2xl tracking-[0.25em]">Try again</span>
      </button>
    </div>
  );
}

export function WinScreen({ info, onRetry }: { info: PhaseInfo; onRetry: () => void }) {
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
      <button
        onClick={onRetry}
        className="mt-10 rounded-sm border border-[#3a321c] bg-[#2c2415] px-10 py-3 uppercase tracking-[0.35em] text-[#efe6c8] transition-all hover:bg-[#4a3d22]"
      >
        <span className="font-horror text-2xl tracking-[0.25em]">Play again</span>
      </button>
    </div>
  );
}
