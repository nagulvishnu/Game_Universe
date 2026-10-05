import { useEffect, useMemo, useState } from "react";
import { CARS, PAINTS, THEMES, TRACKS, type CarDef, type Difficulty, type TrackDef } from "../game/data";
import { fmt } from "../game/Game";
import CarPreview from "./CarPreview";
import TrackMap, { trackLengthKm } from "./TrackMap";
import { loadBest, type Prefs } from "./storage";

export const THEME_STYLE: Record<string, { grad: string; label: string; icon: string; accent: string }> = {
  coast: { grad: "from-orange-400 via-pink-500 to-indigo-700", label: "Golden sunset", icon: "🌅", accent: "#ff9d5c" },
  alpine: { grad: "from-sky-300 via-blue-400 to-slate-700", label: "Snowfall", icon: "❄️", accent: "#7dd3fc" },
  city: { grad: "from-fuchsia-600 via-purple-800 to-slate-950", label: "Night city", icon: "🌃", accent: "#e879f9" },
  desert: { grad: "from-amber-300 via-orange-500 to-red-800", label: "Desert heat", icon: "🏜️", accent: "#fbbf24" },
  forest: { grad: "from-emerald-400 via-teal-700 to-slate-900", label: "Heavy rain", icon: "🌧️", accent: "#34d399" },
};

const Btn = ({
  children,
  onClick,
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "ghost";
  className?: string;
}) => (
  <button
    onClick={onClick}
    className={
      "group relative overflow-hidden rounded-xl px-7 py-3.5 font-black uppercase italic tracking-widest transition active:scale-95 " +
      (variant === "primary"
        ? "bg-gradient-to-r from-cyan-400 via-sky-500 to-fuchsia-500 text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.45)] hover:shadow-[0_0_44px_rgba(217,70,239,0.6)] hover:brightness-110 "
        : "border border-white/20 bg-white/5 text-white/80 hover:bg-white/15 hover:text-white ") +
      className
    }
  >
    {children}
  </button>
);

const Stars = ({ n }: { n: number }) => (
  <span className="tracking-widest">
    {[1, 2, 3, 4, 5].map((i) => (
      <span key={i} className={i <= n ? "text-amber-300" : "text-white/20"}>
        ★
      </span>
    ))}
  </span>
);

function Header({ step, onBack }: { step: number; onBack: () => void }) {
  const steps = ["Circuit", "Garage"];
  return (
    <div className="flex items-center justify-between gap-4 px-5 pt-5 sm:px-10">
      <button onClick={onBack} className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white/80 hover:bg-white/15">
        ← Back
      </button>
      <div className="flex items-center gap-3">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <div
              className={
                "flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-black uppercase italic tracking-widest " +
                (i === step ? "bg-cyan-400 text-slate-950" : i < step ? "bg-white/15 text-white" : "bg-white/5 text-white/40")
              }
            >
              <span>{i + 1}</span>
              <span className="hidden sm:inline">{s}</span>
            </div>
            {i < steps.length - 1 && <div className="h-px w-8 bg-white/20" />}
          </div>
        ))}
      </div>
      <div className="w-[84px]" />
    </div>
  );
}

/* ------------------------------------------------------------------ title */

export function Title({ onStart }: { onStart: () => void }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % CARS.length), 4200);
    return () => clearInterval(t);
  }, []);
  const car = CARS[idx];
  const color = PAINTS[(idx * 3) % PAINTS.length];
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#05060d] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(217,70,239,0.28),transparent_55%),radial-gradient(ellipse_at_20%_80%,rgba(34,211,238,0.22),transparent_50%)]" />
      <div className="grid-floor absolute inset-x-0 bottom-0 h-1/2 opacity-60" />
      <CarPreview def={car} color={color} className="absolute inset-0 sm:left-[22%]" zoom={1.05} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#05060d] via-[#05060d]/60 to-transparent" />

      <div className="relative z-10 flex h-full flex-col justify-between p-6 sm:p-12">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.4em] text-cyan-300/80">
          <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" /> Season 2026 · Open Championship
        </div>

        <div className="max-w-2xl">
          <h1 className="text-6xl font-black uppercase italic leading-[0.9] tracking-tight sm:text-8xl">
            <span className="block bg-gradient-to-r from-white via-cyan-200 to-sky-400 bg-clip-text text-transparent">Turbo</span>
            <span className="block bg-gradient-to-r from-fuchsia-400 via-pink-400 to-orange-300 bg-clip-text text-transparent">Horizon</span>
          </h1>
          <p className="mt-5 max-w-lg text-base text-white/70 sm:text-lg">
            Full-throttle 3D arcade racing. Five circuits across the world, six hand-built machines, rain, snow, sunsets and neon nights.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wider">
            {["5 tracks", "6 cars", "AI rivals", "Nitro boost", "Drift & handbrake", "Dynamic weather"].map((c) => (
              <span key={c} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white/75">
                {c}
              </span>
            ))}
          </div>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Btn onClick={onStart} className="text-xl">
              Start engine ▶
            </Btn>
            <div className="text-sm text-white/50">
              Now showing: <span className="font-bold text-white/90">{car.name}</span>
            </div>
          </div>
        </div>

        <div className="hidden flex-wrap gap-x-6 gap-y-2 text-xs text-white/55 sm:flex">
          {[
            ["W A S D / ↑ ← ↓ →", "Drive"],
            ["Space", "Handbrake"],
            ["Shift", "Nitro"],
            ["C", "Camera"],
            ["R", "Reset"],
            ["P", "Pause"],
            ["M / N", "Sound / Music"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center gap-2">
              <kbd className="rounded border border-white/25 bg-white/10 px-2 py-0.5 font-mono text-white/90">{k}</kbd>
              <span>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ track select */

export function TrackSelect({
  prefs,
  setPrefs,
  onNext,
  onBack,
}: {
  prefs: Prefs;
  setPrefs: (p: Prefs) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const track = TRACKS.find((t) => t.id === prefs.trackId) ?? TRACKS[0];
  const style = THEME_STYLE[track.theme];
  const lengths = useMemo(() => Object.fromEntries(TRACKS.map((t) => [t.id, trackLengthKm(t)])), []);
  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#05060d] text-white">
      <div className={"pointer-events-none fixed inset-0 bg-gradient-to-br opacity-35 transition-all duration-700 " + style.grad} />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-t from-[#05060d] via-[#05060d]/70 to-[#05060d]/30" />
      <div className="relative z-10 flex min-h-full flex-col pb-8">
        <Header step={0} onBack={onBack} />
        <div className="px-5 pt-6 sm:px-10">
          <h2 className="text-4xl font-black uppercase italic tracking-tight sm:text-5xl">Choose your circuit</h2>
          <p className="mt-1 text-white/60">Every track has its own weather, scenery and surface grip.</p>
        </div>

        <div className="mt-6 grid gap-4 px-5 sm:grid-cols-2 sm:px-10 xl:grid-cols-5">
          {TRACKS.map((t) => {
            const st = THEME_STYLE[t.theme];
            const sel = t.id === track.id;
            const best = loadBest(t.id);
            return (
              <button
                key={t.id}
                onClick={() => setPrefs({ ...prefs, trackId: t.id, laps: t.laps === prefs.laps ? prefs.laps : prefs.laps })}
                className={
                  "group relative flex flex-col overflow-hidden rounded-2xl border text-left transition duration-300 " +
                  (sel
                    ? "scale-[1.02] border-white/70 shadow-[0_0_40px_rgba(255,255,255,0.18)]"
                    : "border-white/10 opacity-80 hover:-translate-y-1 hover:opacity-100")
                }
              >
                <div className={"relative flex h-44 items-center justify-center bg-gradient-to-br " + st.grad}>
                  <div className="absolute inset-0 bg-black/25" />
                  <div className="relative">
                    <TrackMap def={t} color="#ffffff" size={150} />
                  </div>
                  <div className="absolute left-3 top-3 rounded-full bg-black/50 px-3 py-1 text-xs font-bold backdrop-blur">
                    {st.icon} {st.label}
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2 bg-slate-900/90 p-4">
                  <div>
                    <div className="text-xl font-black uppercase italic leading-tight">{t.name}</div>
                    <div className="text-xs uppercase tracking-widest text-white/50">{t.location}</div>
                  </div>
                  <p className="text-xs leading-relaxed text-white/65">{t.blurb}</p>
                  <div className="mt-auto flex items-center justify-between pt-2 text-xs">
                    <div className="text-white/60">
                      {lengths[t.id].toFixed(2)} km
                    </div>
                    <Stars n={t.difficulty} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-1.5 text-xs">
                    <span className="text-white/50">Best lap</span>
                    <span className="font-mono font-bold text-cyan-300">{isFinite(best) ? fmt(best) : "—"}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 px-5 sm:flex-row sm:px-10">
          <div className="text-sm text-white/60">
            Selected: <span className="font-black uppercase italic text-white">{track.name}</span> — {THEMES[track.theme].weather === "clear" ? "clear skies" : THEMES[track.theme].weather}
            {THEMES[track.theme].night ? ", night race" : ""}
          </div>
          <Btn onClick={onNext}>Choose car ▶</Btn>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ car select */

const STATS: { key: string; label: string; val: (c: CarDef) => number }[] = [
  { key: "speed", label: "Top speed", val: (c) => c.maxSpeed / 80 },
  { key: "accel", label: "Acceleration", val: (c) => c.accel / 22 },
  { key: "handling", label: "Handling", val: (c) => c.handling / 2.8 },
  { key: "brake", label: "Braking", val: (c) => c.brake / 38 },
  { key: "off", label: "Off-road", val: (c) => 0.15 + c.offroad * 0.85 },
  { key: "weight", label: "Toughness", val: (c) => Math.min(1, c.mass / 1.9) },
];

const TYPE_LABEL: Record<string, string> = {
  coupe: "GT Coupe",
  muscle: "Muscle",
  super: "Hypercar",
  rally: "Rally",
  formula: "Open-wheel",
  truck: "Off-road truck",
};

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-white/15">
      {options.map((o) => (
        <button
          key={String(o.v)}
          onClick={() => onChange(o.v)}
          className={
            "flex-1 px-3 py-2 text-xs font-black uppercase tracking-wider transition " +
            (o.v === value ? "bg-cyan-400 text-slate-950" : "bg-white/5 text-white/70 hover:bg-white/15")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function CarSelect({
  prefs,
  setPrefs,
  onStart,
  onBack,
}: {
  prefs: Prefs;
  setPrefs: (p: Prefs) => void;
  onStart: () => void;
  onBack: () => void;
}) {
  const car = CARS.find((c) => c.id === prefs.carId) ?? CARS[0];
  const track: TrackDef = TRACKS.find((t) => t.id === prefs.trackId) ?? TRACKS[0];
  const st = THEME_STYLE[track.theme];
  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#05060d] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_30%_30%,rgba(34,211,238,0.18),transparent_60%),radial-gradient(ellipse_at_80%_70%,rgba(217,70,239,0.18),transparent_55%)]" />
      <div className="relative z-10 flex min-h-full flex-col pb-8">
        <Header step={1} onBack={onBack} />
        <div className="grid flex-1 gap-6 px-5 pt-5 sm:px-10 lg:grid-cols-[1.25fr_1fr]">
          {/* left: preview */}
          <div className="flex flex-col">
            <div className="relative h-[340px] flex-1 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent lg:min-h-[480px]">
              <CarPreview def={car} color={prefs.color} className="absolute inset-0 cursor-grab active:cursor-grabbing" accent={parseInt(st.accent.slice(1), 16)} />
              <div className="pointer-events-none absolute left-5 top-4">
                <div className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">{car.maker}</div>
                <div className="text-4xl font-black uppercase italic leading-none sm:text-5xl">{car.name}</div>
                <div className="mt-1 inline-block rounded-full bg-white/10 px-3 py-0.5 text-xs font-bold uppercase tracking-wider">{TYPE_LABEL[car.type]}</div>
              </div>
              <div className="pointer-events-none absolute bottom-3 left-5 text-xs text-white/40">Drag to rotate</div>
              <div className="absolute bottom-4 right-4 flex gap-2 rounded-full bg-black/40 p-2 backdrop-blur">
                {PAINTS.map((c) => (
                  <button
                    key={c}
                    aria-label="paint"
                    onClick={() => setPrefs({ ...prefs, color: c })}
                    className={"h-6 w-6 rounded-full border-2 transition hover:scale-125 " + (c === prefs.color ? "scale-125 border-white" : "border-white/20")}
                    style={{ background: "#" + c.toString(16).padStart(6, "0") }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* right: selection + settings */}
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2">
              {CARS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setPrefs({ ...prefs, carId: c.id })}
                  className={
                    "rounded-xl border px-3 py-2.5 text-left transition " +
                    (c.id === car.id ? "border-cyan-300 bg-cyan-400/15 shadow-[0_0_20px_rgba(34,211,238,0.3)]" : "border-white/10 bg-white/5 hover:bg-white/10")
                  }
                >
                  <div className="text-[10px] uppercase tracking-widest text-white/45">{TYPE_LABEL[c.type]}</div>
                  <div className="text-sm font-black uppercase italic leading-tight">{c.name}</div>
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="mb-3 text-sm text-white/70">{car.blurb}</p>
              <div className="grid gap-2.5">
                {STATS.map((s) => (
                  <div key={s.key} className="flex items-center gap-3 text-xs">
                    <div className="w-24 uppercase tracking-wider text-white/55">{s.label}</div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 transition-all duration-500"
                        style={{ width: Math.round(Math.min(1, s.val(car)) * 100) + "%" }}
                      />
                    </div>
                    <div className="w-8 text-right font-mono text-white/70">{Math.round(Math.min(1, s.val(car)) * 100)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between border-t border-white/10 pt-3 text-xs text-white/50">
                <span>Top speed {Math.round(car.maxSpeed * 3.6)} km/h</span>
                <span>0–100 in {(27.8 / car.accel + 0.6).toFixed(1)}s</span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-widest text-white/50">Race setup</div>
                <div className="text-xs font-black uppercase italic" style={{ color: st.accent }}>
                  {st.icon} {track.name}
                </div>
              </div>
              <div className="grid gap-3 text-xs">
                <div>
                  <div className="mb-1 uppercase tracking-wider text-white/50">Laps</div>
                  <Segmented value={prefs.laps} onChange={(v) => setPrefs({ ...prefs, laps: v })} options={[1, 2, 3, 5, 8].map((v) => ({ v, label: String(v) }))} />
                </div>
                <div>
                  <div className="mb-1 uppercase tracking-wider text-white/50">Opponents</div>
                  <Segmented value={prefs.aiCount} onChange={(v) => setPrefs({ ...prefs, aiCount: v })} options={[0, 3, 5, 7].map((v) => ({ v, label: String(v) }))} />
                </div>
                <div>
                  <div className="mb-1 uppercase tracking-wider text-white/50">AI difficulty</div>
                  <Segmented<Difficulty>
                    value={prefs.difficulty}
                    onChange={(v) => setPrefs({ ...prefs, difficulty: v })}
                    options={[
                      { v: "easy", label: "Rookie" },
                      { v: "medium", label: "Pro" },
                      { v: "hard", label: "Legend" },
                    ]}
                  />
                </div>
              </div>
            </div>

            <Btn onClick={onStart} className="text-lg">
              Go to the grid 🏁
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
