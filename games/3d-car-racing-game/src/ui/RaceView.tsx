import { useCallback, useEffect, useRef, useState } from "react";
import { CARS, type CarDef, type Difficulty, type TrackDef } from "../game/data";
import { Game, fmt, type HudState } from "../game/Game";
import { THEME_STYLE } from "./Menus";
import { loadBest, saveBest } from "./storage";

export interface RaceConfig {
  track: TrackDef;
  car: CarDef;
  color: number;
  laps: number;
  aiCount: number;
  difficulty: Difficulty;
}

interface Toast {
  id: number;
  text: string;
  kind: "info" | "good" | "warn";
}

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/* ------------------------------------------------------------------ speedometer */

function Speedo({ hud }: { hud: HudState }) {
  const R = 100;
  const cx = 130;
  const cy = 130;
  const ticks = [];
  for (let i = 0; i <= 20; i++) {
    const a = ((135 + (i / 20) * 270) * Math.PI) / 180;
    const major = i % 5 === 0;
    const r1 = R + 8;
    const r2 = R + (major ? 20 : 14);
    ticks.push(
      <line
        key={i}
        x1={cx + Math.cos(a) * r1}
        y1={cy + Math.sin(a) * r1}
        x2={cx + Math.cos(a) * r2}
        y2={cy + Math.sin(a) * r2}
        stroke={i >= 17 ? "#ff3b5c" : "rgba(255,255,255,0.55)"}
        strokeWidth={major ? 2.5 : 1.2}
      />,
    );
  }
  const gear = hud.gear === 0 ? "R" : hud.speed < 1 ? "N" : String(hud.gear);
  return (
    <div className="relative h-[260px] w-[260px] select-none">
      <svg viewBox="0 0 260 260" className="absolute inset-0 drop-shadow-[0_0_14px_rgba(0,0,0,0.7)]">
        <circle cx={cx} cy={cy} r={R + 24} fill="rgba(6,8,18,0.62)" />
        <circle cx={cx} cy={cy} r={R + 24} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
        {ticks}
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="12" pathLength={100} strokeDasharray="75 100" transform={`rotate(135 ${cx} ${cy})`} strokeLinecap="round" />
        <defs>
          <linearGradient id="rpmg" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="60%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#ff3b5c" />
          </linearGradient>
        </defs>
        <circle
          cx={cx}
          cy={cy}
          r={R}
          fill="none"
          stroke={hud.nitroOn ? "#60d5ff" : "url(#rpmg)"}
          strokeWidth="12"
          pathLength={100}
          strokeDasharray={`${Math.max(0.5, 75 * Math.min(1, hud.rpm))} 100`}
          transform={`rotate(135 ${cx} ${cy})`}
          strokeLinecap="round"
          style={{ filter: hud.nitroOn ? "drop-shadow(0 0 8px #38bdf8)" : undefined }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
        <div className="font-mono text-[64px] font-black leading-none tabular-nums text-white [text-shadow:0_0_18px_rgba(34,211,238,0.6)]">{Math.round(hud.speed)}</div>
        <div className="-mt-0.5 text-xs font-bold uppercase tracking-[0.35em] text-white/60">km/h</div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-white/40">Gear</span>
          <span className="rounded bg-white/90 px-2.5 py-0.5 font-mono text-xl font-black leading-none text-slate-900">{gear}</span>
        </div>
      </div>
      {/* nitro */}
      <div className="absolute -bottom-1 left-1/2 w-[200px] -translate-x-1/2">
        <div className="mb-1 flex justify-between text-[10px] font-black uppercase tracking-widest">
          <span className={hud.nitroOn ? "text-sky-300" : "text-white/60"}>Nitro</span>
          <span className="font-mono text-white/50">{Math.round(hud.nitro)}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full border border-white/20 bg-black/50">
          <div
            className={"h-full rounded-full transition-[width] duration-100 " + (hud.nitroOn ? "bg-gradient-to-r from-sky-300 to-white" : hud.nitro > 99 ? "bg-gradient-to-r from-sky-400 to-cyan-200" : "bg-gradient-to-r from-sky-600 to-sky-400")}
            style={{ width: hud.nitro + "%" }}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ touch controls */

function TouchBtn({
  label,
  className = "",
  onDown,
  onUp,
}: {
  label: React.ReactNode;
  className?: string;
  onDown: () => void;
  onUp: () => void;
}) {
  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        onDown();
      }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={onUp}
      onContextMenu={(e) => e.preventDefault()}
      className={"touch-none select-none rounded-2xl border border-white/30 bg-white/15 font-black uppercase text-white backdrop-blur active:bg-white/40 " + className}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ race view */

export default function RaceView({ config, onExit, onRestart }: { config: RaceConfig; onExit: () => void; onRestart: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const mini = useRef<HTMLCanvasElement>(null);
  const game = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [count, setCount] = useState<{ text: string; key: number } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finish, setFinish] = useState<{ place: number; time: number; best: number; record: boolean } | null>(null);
  const [audioState, setAudioState] = useState({ muted: false, music: true });
  const [touchUI] = useState(() => typeof window !== "undefined" && (navigator.maxTouchPoints > 0 || "ontouchstart" in window));
  const toastId = useRef(0);

  const pushToast = useCallback((text: string, kind: Toast["kind"]) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  useEffect(() => {
    let g: Game | null = null;
    let cancelled = false;
    const record = loadBest(config.track.id);
    const timer = setTimeout(() => {
      if (cancelled || !host.current) return;
      try {
        g = new Game(host.current, {
          track: config.track,
          car: config.car,
          color: config.color,
          laps: config.laps,
          aiCount: config.aiCount,
          difficulty: config.difficulty,
          recordLap: record,
          minimap: mini.current,
          onHud: setHud,
          onCountdown: (text) => {
            setCount({ text, key: Date.now() });
            setTimeout(() => setCount((c) => (c && c.text === text ? null : c)), 950);
          },
          onMessage: pushToast,
          onPauseChange: setPaused,
          onFinish: (place, time, best) => {
            const isRec = isFinite(best) && best < record;
            if (isRec) saveBest(config.track.id, best);
            setFinish({ place, time, best, record: isRec });
          },
          onReady: () => setLoading(false),
        });
        game.current = g;
        g.start();
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "Failed to start the race (WebGL unavailable?)");
        setLoading(false);
      }
    }, 80);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      g?.dispose();
      game.current = null;
    };
  }, [config, pushToast]);

  const st = THEME_STYLE[config.track.theme];
  const phase = hud?.phase;
  const touch = (t: Parameters<Game["setTouch"]>[0]) => game.current?.setTouch(t);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white select-none">
      <div ref={host} className="absolute inset-0" />

      {/* nitro speed lines */}
      <div className={"pointer-events-none absolute inset-0 transition-opacity duration-300 " + (hud?.nitroOn ? "opacity-100" : "opacity-0")} style={{ background: "radial-gradient(ellipse at center, transparent 45%, rgba(80,190,255,0.28) 100%)" }} />
      {hud?.offRoad && <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(255,160,40,0.25)]" />}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_160px_rgba(0,0,0,0.5)]" />

      {hud && phase !== "finished" && !error && (
        <>
          {/* top-left: position + lap */}
          <div className="pointer-events-none absolute left-4 top-4 flex items-start gap-3 sm:left-8 sm:top-6">
            <div className="rounded-2xl border border-white/10 bg-slate-950/65 px-5 py-3 backdrop-blur">
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">Position</div>
              <div className="font-mono text-5xl font-black italic leading-none">
                {hud.place}
                <span className="text-2xl text-white/50">/{hud.total}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/65 px-5 py-3 backdrop-blur">
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">Lap</div>
              <div className="font-mono text-5xl font-black italic leading-none">
                {hud.lap}
                <span className="text-2xl text-white/50">/{hud.laps}</span>
              </div>
            </div>
          </div>

          {/* top-center: times */}
          <div className="pointer-events-none absolute left-1/2 top-4 hidden -translate-x-1/2 sm:top-6 md:block">
            <div className="rounded-2xl border border-white/10 bg-slate-950/65 px-6 py-2.5 text-center backdrop-blur">
              <div className="font-mono text-3xl font-black tabular-nums">{fmt(hud.lapTime)}</div>
              <div className="mt-0.5 flex justify-center gap-5 font-mono text-xs text-white/60">
                <span>
                  LAST <span className="text-white/90">{fmt(hud.lastLap)}</span>
                </span>
                <span>
                  BEST <span className="text-cyan-300">{fmt(hud.bestLap)}</span>
                </span>
              </div>
            </div>
          </div>

          {/* top-right: leaderboard + buttons */}
          <div className="absolute right-4 top-4 flex flex-col items-end gap-2 sm:right-8 sm:top-6">
            <div className="flex gap-2">
              {[
                { l: "Camera (C)", i: "CAM", f: () => game.current?.cycleCamera() },
                { l: "Sound (M)", i: audioState.muted ? "OFF" : "SND", f: () => setAudioState({ ...audioState, muted: game.current!.toggleMute() }) },
                { l: "Music (N)", i: audioState.music ? "MUS" : "MUS×", f: () => setAudioState({ ...audioState, music: game.current!.toggleMusic() }) },
                { l: "Pause (P)", i: "II", f: () => game.current?.setPaused(true) },
              ].map((b) => (
                <button key={b.l} title={b.l} onClick={b.f} className="h-10 min-w-10 rounded-xl border border-white/15 bg-slate-950/65 px-2 text-[11px] font-black tracking-wider backdrop-blur transition hover:bg-white/20">
                  {b.i}
                </button>
              ))}
            </div>
            <div className="pointer-events-none hidden w-56 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/65 backdrop-blur lg:block">
              {hud.board.slice(0, 8).map((e) => (
                <div key={e.id} className={"flex items-center gap-2 px-3 py-1 text-xs " + (e.isPlayer ? "bg-cyan-400/25 font-black" : "")}>
                  <span className="w-4 text-right font-mono text-white/60">{e.place}</span>
                  <span className="h-3 w-1 rounded-full" style={{ background: "#" + e.color.toString(16).padStart(6, "0") }} />
                  <span className="flex-1 truncate">{e.name}</span>
                  <span className="font-mono text-white/50">{e.isPlayer || e.place === 1 ? (e.finished ? "🏁" : "") : "+" + e.gap.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* speedo */}
          <div className="pointer-events-none absolute bottom-3 right-2 origin-bottom-right scale-[0.72] sm:bottom-6 sm:right-8 sm:scale-100">
            <Speedo hud={hud} />
          </div>

          {/* wrong way */}
          {hud.wrongWay && (
            <div className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 animate-pulse rounded-xl border-2 border-red-400 bg-red-600/80 px-8 py-3 text-3xl font-black uppercase italic tracking-widest shadow-[0_0_40px_rgba(255,0,0,0.6)]">
              ⚠ Wrong way
            </div>
          )}
          {hud.drift && hud.phase === "racing" && <div className="pointer-events-none absolute bottom-[34%] left-1/2 -translate-x-1/2 text-xl font-black uppercase italic tracking-[0.4em] text-amber-300 [text-shadow:0_0_14px_rgba(251,191,36,0.9)]">Drift!</div>}
        </>
      )}

      {/* minimap (always mounted so the game can grab the canvas) */}
      <div className={"pointer-events-none absolute bottom-4 left-4 sm:bottom-6 sm:left-8 " + (hud && phase !== "finished" && !error ? "" : "invisible")}>
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-2 backdrop-blur">
          <canvas ref={mini} width={200} height={200} className="h-[130px] w-[130px] sm:h-[190px] sm:w-[190px]" />
          <div className="px-1 text-center text-[10px] font-bold uppercase italic tracking-widest" style={{ color: st.accent }}>
            {config.track.name}
          </div>
        </div>
      </div>

      {/* toasts */}
      <div className="pointer-events-none absolute left-1/2 top-24 flex -translate-x-1/2 flex-col items-center gap-2 sm:top-32">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              "toast rounded-full border px-6 py-2 text-sm font-black uppercase italic tracking-widest backdrop-blur sm:text-base " +
              (t.kind === "good" ? "border-emerald-300/60 bg-emerald-500/30 text-emerald-100" : t.kind === "warn" ? "border-amber-300/70 bg-amber-500/35 text-amber-50" : "border-white/25 bg-slate-950/70 text-white")
            }
          >
            {t.text}
          </div>
        ))}
      </div>

      {/* countdown */}
      {count && (
        <div key={count.key} className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={"count-pop font-black italic " + (count.text === "GO!" ? "text-[9rem] text-emerald-300 [text-shadow:0_0_60px_rgba(52,211,153,0.9)]" : "text-[10rem] text-white [text-shadow:0_0_60px_rgba(34,211,238,0.8)]")}
          >
            {count.text}
          </div>
        </div>
      )}

      {/* touch controls */}
      {touchUI && hud && phase !== "finished" && !paused && (
        <>
          <div className="absolute bottom-[200px] left-4 flex gap-3 sm:bottom-6 sm:left-1/2 sm:-translate-x-[calc(100%+20px)]">
            <TouchBtn label="◀" className="h-20 w-20 text-3xl" onDown={() => touch({ left: true })} onUp={() => touch({ left: false })} />
            <TouchBtn label="▶" className="h-20 w-20 text-3xl" onDown={() => touch({ right: true })} onUp={() => touch({ right: false })} />
          </div>
          <div className="absolute bottom-[230px] right-4 flex flex-col items-end gap-3 sm:bottom-[300px]">
            <TouchBtn label="NOS" className="h-14 w-20 bg-sky-500/30 text-lg" onDown={() => touch({ nitro: true })} onUp={() => touch({ nitro: false })} />
            <TouchBtn label="Drift" className="h-12 w-20 text-sm" onDown={() => touch({ hand: true })} onUp={() => touch({ hand: false })} />
          </div>
          <div className="absolute bottom-4 right-4 flex gap-3 sm:hidden">
            <TouchBtn label="Brake" className="h-16 w-20 text-sm" onDown={() => touch({ brake: true })} onUp={() => touch({ brake: false })} />
            <TouchBtn label="Gas" className="h-16 w-24 bg-emerald-500/30 text-lg" onDown={() => touch({ gas: true })} onUp={() => touch({ gas: false })} />
          </div>
          <div className="absolute bottom-6 right-[300px] hidden gap-3 sm:flex">
            <TouchBtn label="Brake" className="h-20 w-24 text-sm" onDown={() => touch({ brake: true })} onUp={() => touch({ brake: false })} />
            <TouchBtn label="Gas" className="h-20 w-28 bg-emerald-500/30 text-lg" onDown={() => touch({ gas: true })} onUp={() => touch({ gas: false })} />
          </div>
        </>
      )}

      {/* loading */}
      {loading && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-[#05060d]">
          <div className={"absolute inset-0 bg-gradient-to-br opacity-30 " + st.grad} />
          <div className="relative text-center">
            <div className="text-xs font-bold uppercase tracking-[0.5em] text-white/60">Loading circuit</div>
            <div className="mt-2 text-5xl font-black uppercase italic">{config.track.name}</div>
            <div className="mt-1 text-sm text-white/50">{config.track.location}</div>
            <div className="mx-auto mt-6 h-1.5 w-64 overflow-hidden rounded-full bg-white/10">
              <div className="load-bar h-full w-1/3 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500" />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-[#05060d] p-8 text-center">
          <div className="text-3xl font-black uppercase italic text-red-400">Could not start race</div>
          <div className="max-w-md text-white/70">{error}</div>
          <button onClick={onExit} className="rounded-xl bg-white/10 px-6 py-3 font-bold uppercase hover:bg-white/20">
            Back to menu
          </button>
        </div>
      )}

      {/* pause */}
      {paused && !finish && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-[min(92vw,520px)] rounded-3xl border border-white/15 bg-slate-950/90 p-8 text-center">
            <div className="text-xs font-bold uppercase tracking-[0.4em] text-cyan-300">Paused</div>
            <div className="mt-1 text-4xl font-black uppercase italic">{config.track.name}</div>
            <div className="mt-6 grid gap-3">
              <button onClick={() => game.current?.setPaused(false)} className="rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 py-3 font-black uppercase italic tracking-widest text-slate-950 hover:brightness-110">
                Resume
              </button>
              <button onClick={onRestart} className="rounded-xl border border-white/20 bg-white/5 py-3 font-bold uppercase tracking-widest hover:bg-white/15">
                Restart race
              </button>
              <button onClick={onExit} className="rounded-xl border border-white/20 bg-white/5 py-3 font-bold uppercase tracking-widest hover:bg-white/15">
                Quit to garage
              </button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-1.5 text-left text-xs text-white/60">
              {[
                ["↑ / W", "Accelerate"],
                ["↓ / S", "Brake / reverse"],
                ["← → / A D", "Steer"],
                ["Space", "Handbrake drift"],
                ["Shift / E", "Nitro boost"],
                ["C", "Change camera"],
                ["R", "Reset to track"],
                ["M / N", "Sound / music"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <kbd className="rounded border border-white/25 bg-white/10 px-1.5 py-0.5 font-mono text-white/90">{k}</kbd>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* results */}
      {finish && hud && (
        <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-[min(96vw,680px)] rounded-3xl border border-white/15 bg-slate-950/92 p-6 sm:p-8">
            <div className="text-center">
              <div className="text-xs font-bold uppercase tracking-[0.5em] text-cyan-300">Race complete</div>
              <div className={"mt-1 text-7xl font-black italic leading-none " + (finish.place === 1 ? "bg-gradient-to-b from-yellow-200 to-amber-500 bg-clip-text text-transparent" : finish.place <= 3 ? "text-slate-200" : "text-white/80")}>
                {ordinal(finish.place)}
              </div>
              <div className="mt-2 text-sm text-white/60">
                {finish.place === 1 ? "🏆 Victory! You won the race." : finish.place <= 3 ? "🥈 Podium finish — great driving." : "Keep pushing — the next one is yours."}
              </div>
              <div className="mt-4 flex justify-center gap-6 font-mono text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40">Total time</div>
                  <div className="text-xl font-black">{fmt(finish.time)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40">Best lap</div>
                  <div className="text-xl font-black text-cyan-300">{fmt(finish.best)}</div>
                </div>
              </div>
              {finish.record && <div className="mt-3 inline-block rounded-full border border-emerald-300/60 bg-emerald-500/25 px-4 py-1 text-xs font-black uppercase italic tracking-widest text-emerald-100">★ New track record</div>}
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
              {hud.board.map((e) => (
                <div key={e.id} className={"flex items-center gap-3 px-4 py-2 text-sm " + (e.isPlayer ? "bg-cyan-400/20 font-black" : "odd:bg-white/[0.03]")}>
                  <span className="w-6 text-right font-mono text-white/60">{e.place}</span>
                  <span className="h-4 w-1.5 rounded-full" style={{ background: "#" + e.color.toString(16).padStart(6, "0") }} />
                  <span className="flex-1 truncate">
                    {e.name} <span className="text-xs font-normal text-white/40">{e.car}</span>
                  </span>
                  <span className="font-mono text-xs text-white/70">{e.finished ? fmt(e.finishTime) : "racing…"}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button onClick={onRestart} className="rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 py-3 font-black uppercase italic tracking-widest text-slate-950 hover:brightness-110">
                Race again
              </button>
              <button onClick={onExit} className="rounded-xl border border-white/20 bg-white/5 py-3 font-bold uppercase tracking-widest hover:bg-white/15">
                Garage
              </button>
            </div>
          </div>
        </div>
      )}

      {/* hint */}
      {hud && phase === "racing" && hud.raceTime < 9 && !paused && !touchUI && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 rounded-full border border-white/10 bg-slate-950/60 px-5 py-2 text-xs text-white/70 backdrop-blur md:block">
          <b>↑↓←→</b> drive · <b>Space</b> drift · <b>Shift</b> nitro · <b>C</b> camera · <b>R</b> reset
        </div>
      )}
      <span className="hidden">{CARS.length}</span>
    </div>
  );
}
