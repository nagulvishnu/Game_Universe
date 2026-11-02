import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Bike,
  Car,
  Crosshair,
  Fan,
  Flame,
  Fuel,
  Gauge,
  Gem,
  MapPin,
  Menu,
  MousePointer2,
  Navigation,
  Play,
  Plane,
  Radar,
  Shield,
  Sparkles,
  Star,
  Target,
  Timer,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useState, type ComponentType } from "react";
import { DISTRICTS, MISSIONS, UPGRADES, VEHICLES, WEAPONS, type DistrictId, type VehicleKind } from "../game/data";

const vehicleIcon: Record<VehicleKind, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  sports: Car,
  muscle: Car,
  suv: Car,
  taxi: Car,
  police: Car,
  truck: Car,
  bike: Bike,
  sportbike: Bike,
  plane: Plane,
  heli: Fan,
  tank: Shield,
};

const featured: VehicleKind[] = ["sports", "sportbike", "plane", "heli", "tank"];

const missionPicks = ["debt", "ironfist", "skyline", "kingpin"];

function difficulty(n: number) {
  return Array.from({ length: 5 }, (_, i) => (
    <span key={i} className={`h-1 w-4 rounded-full ${i < n ? "bg-acid" : "bg-white/15"}`} />
  ));
}

function Skyline({ color }: { color: string }) {
  const towers = [
    [8, 62, 16],
    [28, 38, 12],
    [44, 80, 14],
    [62, 52, 18],
    [84, 96, 12],
    [100, 44, 16],
    [120, 70, 13],
    [138, 32, 18],
    [160, 58, 12],
    [176, 88, 14],
    [194, 46, 16],
    [214, 66, 13],
    [232, 36, 16],
  ];
  return (
    <svg viewBox="0 0 260 120" className="h-full w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`sky-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.55" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
        <pattern id={`win-${color.replace("#", "")}`} width="8" height="10" patternUnits="userSpaceOnUse">
          <rect width="3" height="2" x="2" y="3" fill={color} opacity="0.6" />
        </pattern>
      </defs>
      {towers.map(([x, h, w], i) => (
        <g key={i}>
          <rect x={x} y={120 - h} width={w} height={h} fill={`url(#sky-${color.replace("#", "")})`} />
          <rect x={x} y={120 - h} width={w} height={h} fill={`url(#win-${color.replace("#", "")})`} opacity="0.7" />
        </g>
      ))}
    </svg>
  );
}

function ContractCard({ onPlay }: { onPlay: () => void }) {
  const mission = MISSIONS[2];
  return (
    <div className="animate-float relative w-full max-w-[380px]">
      <div className="absolute -inset-px rounded-[4px] bg-gradient-to-b from-acid/50 via-white/10 to-transparent" />
      <div className="cut-corner relative overflow-hidden border border-white/10 bg-[#0a0e10]/95 p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="label-xs text-acid">Tonight&apos;s contract</div>
            <div className="mt-2 font-display text-3xl font-bold uppercase leading-none tracking-wide">{mission.title}</div>
            <div className="mt-1 text-xs text-zinc-400">
              {mission.giver} · {mission.category}
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center border border-acid/40 bg-acid/10">
            <Crosshair className="h-5 w-5 text-acid" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs">
          <span className="border border-hot/40 bg-hot/10 px-2 py-1 font-semibold uppercase tracking-wider text-hot">Neon Mile</span>
          <span className="border border-white/10 bg-white/5 px-2 py-1 text-zinc-300">5 targets</span>
          <span className="ml-auto font-mono-ui text-acid">+$4,800</span>
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-zinc-400">{mission.brief}</p>
        <div className="mt-4 space-y-2">
          {mission.steps.map((s, i) => (
            <div key={i} className="flex items-center gap-3 border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-acid/50 font-mono-ui text-[10px] text-acid">
                {i + 1}
              </span>
              <span className="truncate text-[11px] text-zinc-300">{s.text}</span>
            </div>
          ))}
        </div>
        <button onClick={onPlay} className="btn-acid cut-corner-sm mt-5 w-full py-3 text-xs uppercase tracking-[0.16em]">
          <Play className="h-4 w-4" /> Accept & enter city
        </button>
        <div className="mt-3 flex items-center justify-between font-mono-ui text-[10px] uppercase tracking-wider text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Contract live
          </span>
          <span>21:40 · Dusk</span>
        </div>
      </div>
    </div>
  );
}

export default function Landing({ onPlay }: { onPlay: (district?: DistrictId) => void }) {
  const [navOpen, setNavOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleKind>("sports");
  const v = VEHICLES[selectedVehicle];
  const WeaponIcon = Crosshair;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#07090b] text-white">
      {/* header */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-[#07090b]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-6 px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center bg-acid clip-corner-sm">
              <span className="font-display text-xl font-black text-[#0a0e07]">H</span>
            </div>
            <div className="leading-none">
              <div className="font-display text-lg font-extrabold uppercase tracking-[0.14em]">Havoc City</div>
              <div className="mt-1 font-mono-ui text-[8px] uppercase tracking-[0.3em] text-zinc-500">Open world sandbox</div>
            </div>
          </div>
          <nav className="ml-8 hidden items-center gap-7 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400 lg:flex">
            <a href="#city" className="transition hover:text-acid">The City</a>
            <a href="#arsenal" className="transition hover:text-acid">Arsenal</a>
            <a href="#contracts" className="transition hover:text-acid">Contracts</a>
            <a href="#controls" className="transition hover:text-acid">Controls</a>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[0.18em] text-zinc-400 md:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,.6)]" />
              District network online
            </div>
            <button onClick={() => onPlay()} className="btn-acid cut-corner-sm px-5 py-2.5 text-[11px] uppercase tracking-[0.14em]">
              <Play className="h-3.5 w-3.5 fill-current" /> Play now
            </button>
            <button
              onClick={() => setNavOpen((s) => !s)}
              className="flex h-10 w-10 items-center justify-center border border-white/15 text-zinc-300 lg:hidden"
              aria-label="Menu"
            >
              {navOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {navOpen && (
          <div className="border-t border-white/10 bg-[#080b0d] px-5 py-4 lg:hidden">
            <div className="flex flex-col gap-4 text-sm font-semibold uppercase tracking-widest text-zinc-300">
              {[
                ["The City", "#city"],
                ["Arsenal", "#arsenal"],
                ["Contracts", "#contracts"],
                ["Controls", "#controls"],
              ].map(([label, href]) => (
                <a key={href} href={href} onClick={() => setNavOpen(false)} className="flex items-center justify-between border-b border-white/5 pb-3">
                  {label} <ArrowUpRight className="h-4 w-4 text-acid" />
                </a>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* hero */}
      <section className="noise scanlines relative min-h-[100svh] overflow-hidden pt-16">
        <img src="/images/hero.jpg" alt="Havoc City skyline at dusk" className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#07090b_0%,rgba(7,9,11,0.92)_30%,rgba(7,9,11,0.55)_55%,rgba(7,9,11,0.25)_78%,rgba(7,9,11,0.75)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,#07090b_0%,rgba(7,9,11,0.1)_35%,rgba(7,9,11,0.2)_100%)]" />
        <div className="absolute -left-40 top-1/3 h-[420px] w-[420px] rounded-full bg-acid/10 blur-[130px]" />
        <div className="relative mx-auto flex min-h-[calc(100svh-64px)] max-w-[1400px] flex-col justify-center px-5 py-14 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="max-w-[720px]">
              <div className="animate-fade-up flex items-center gap-3" style={{ animationDelay: "40ms" }}>
                <span className="h-px w-8 bg-acid" />
                <span className="font-mono-ui text-[10px] uppercase tracking-[0.34em] text-acid">Havoc City // Season One</span>
                <span className="hidden border border-white/15 px-2 py-0.5 font-mono-ui text-[9px] uppercase tracking-[0.2em] text-zinc-400 sm:block">
                  3D Open World
                </span>
              </div>
              <h1
                className="animate-fade-up mt-5 font-display text-[clamp(64px,10.5vw,150px)] font-black uppercase leading-[0.82] tracking-[0.01em]"
                style={{ animationDelay: "120ms" }}
              >
                Own the
                <br />
                <span className="text-acid text-glow">night.</span>
              </h1>
              <p className="animate-fade-up mt-6 max-w-[520px] text-[15px] leading-relaxed text-zinc-300" style={{ animationDelay: "200ms" }}>
                Five districts. Skyscrapers that scrape the smog. Cars, bikes, planes, helicopters and a tank with your
                name on the barrel. Take contracts, stack cash and build a legend across a living city full of NPCs.
              </p>
              <div className="animate-fade-up mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: "280ms" }}>
                <button onClick={() => onPlay()} className="btn-acid cut-corner px-8 py-4 text-sm uppercase tracking-[0.16em]">
                  <Play className="h-4 w-4 fill-current" /> Enter Havoc City
                </button>
                <a href="#city" className="btn-ghost cut-corner px-6 py-4 text-sm">
                  Explore the districts <ArrowRight className="h-4 w-4" />
                </a>
                <div className="flex items-center gap-2 pl-1 text-[11px] text-zinc-500">
                  <MousePointer2 className="h-4 w-4" /> Keyboard + mouse
                </div>
              </div>
              <div className="animate-fade-up mt-10 grid max-w-[600px] grid-cols-2 gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-4" style={{ animationDelay: "340ms" }}>
                {[
                  ["5", "Districts", MapPin],
                  ["11", "Vehicle types", Car],
                  ["60+", "Living NPCs", Users],
                  ["10", "Contracts", Crosshair],
                ].map(([value, label, Icon]) => {
                  const I = Icon as ComponentType<{ className?: string }>;
                  return (
                    <div key={label as string} className="bg-[#0a0d0f]/90 px-4 py-4">
                      <I className="mb-2 h-4 w-4 text-acid" />
                      <div className="font-display text-3xl font-bold leading-none">{value as string}</div>
                      <div className="label-xs mt-1">{label as string}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="hidden justify-end lg:flex">
              <ContractCard onPlay={() => onPlay()} />
            </div>
          </div>

          <div className="mt-auto flex flex-wrap items-end justify-between gap-6 pt-12">
            <div className="flex flex-wrap gap-2 lg:hidden">
              <ContractCard onPlay={() => onPlay()} />
            </div>
            <div className="hidden items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[0.18em] text-zinc-500 lg:flex">
              <Navigation className="h-3.5 w-3.5 text-acid" /> 26.4223° N · 102.8841° W · Port of Havoc
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {DISTRICTS.map((d) => (
                <button key={d.id} onClick={() => onPlay(d.id)} className="group flex items-center gap-2 text-left">
                  <span className="h-1.5 w-1.5 rounded-full transition group-hover:scale-150" style={{ background: d.color }} />
                  <span className="font-mono-ui text-[9px] uppercase tracking-[0.2em] text-zinc-400 transition group-hover:text-white">{d.short}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* marquee */}
      <div className="relative overflow-hidden border-y border-white/10 bg-[#080b0d] py-3">
        <div className="animate-marquee flex w-max items-center gap-10 whitespace-nowrap">
          {Array.from({ length: 2 }).map((_, r) => (
            <div key={r} className="flex items-center gap-10">
              {["Obsidian Heights", "Neon Mile", "Killick Harbor", "The Foundry", "Palmwash", "Havoc Spire", "St. Jude", "Frogger Air Ops"].map((t) => (
                <span key={t + r} className="flex items-center gap-10 font-display text-sm font-semibold uppercase tracking-[0.28em] text-zinc-500">
                  {t} <Sparkles className="h-3 w-3 text-acid/70" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* city / districts */}
      <section id="city" className="relative mx-auto max-w-[1400px] px-5 py-24 lg:px-8">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <div className="label-xs flex items-center gap-2 text-acid">
              <MapPin className="h-3.5 w-3.5" /> The city / 01
            </div>
            <h2 className="mt-4 max-w-[720px] font-display text-5xl font-black uppercase leading-[0.9] md:text-7xl">
              Five regions.
              <br />
              <span className="text-zinc-500">One bad idea at a time.</span>
            </h2>
          </div>
          <p className="max-w-[360px] text-sm leading-relaxed text-zinc-400">
            Every district has its own skyline, traffic, nightlife and neighborhood watch. Tall towers cast long shadows —
            especially over people who owe you money.
          </p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {DISTRICTS.map((d, i) => (
            <button
              key={d.id}
              onClick={() => onPlay(d.id)}
              className={`group relative overflow-hidden border border-white/10 bg-[#0b0f11] text-left transition duration-300 hover:-translate-y-1 hover:border-white/25 ${
                i === 0 ? "lg:col-span-2" : ""
              }`}
            >
              <div className="absolute inset-x-0 top-0 h-40 opacity-70 transition duration-500 group-hover:opacity-100" style={{ background: `radial-gradient(120% 100% at 50% 100%, ${d.color}22, transparent 70%)` }}>
                <div className="absolute inset-x-0 bottom-0 h-36 opacity-80">
                  <Skyline color={d.color} />
                </div>
              </div>
              <div className="relative flex h-full min-h-[240px] flex-col justify-between p-5">
                <div className="flex items-start justify-between">
                  <span className="font-mono-ui text-[10px] uppercase tracking-[0.24em] text-zinc-500">Region 0{i + 1}</span>
                  <div className="flex items-center gap-1.5 border border-white/10 bg-black/40 px-2 py-1">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: d.color }} />
                    <span className="font-mono-ui text-[9px] uppercase tracking-wider text-zinc-300">Danger {d.danger}/5</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-display text-3xl font-bold uppercase leading-none">{d.name}</h3>
                  <p className="mt-2 max-w-[340px] text-xs leading-relaxed text-zinc-400">{d.description}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {d.tags.map((t) => (
                      <span key={t} className="border border-white/10 bg-white/[0.03] px-2 py-1 font-mono-ui text-[9px] uppercase tracking-wider text-zinc-400">
                        {t}
                      </span>
                    ))}
                    <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider opacity-0 transition group-hover:opacity-100" style={{ color: d.color }}>
                      Deploy here <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* arsenal */}
      <section id="arsenal" className="relative border-y border-white/10 bg-[#090c0e]">
        <div className="mx-auto max-w-[1400px] px-5 py-24 lg:px-8">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div>
              <div className="label-xs flex items-center gap-2 text-acid">
                <Car className="h-3.5 w-3.5" /> The arsenal / 02
              </div>
              <h2 className="mt-4 font-display text-5xl font-black uppercase leading-[0.9] md:text-7xl">
                Steal it.
                <br />
                <span className="text-zinc-500">Then upgrade it.</span>
              </h2>
            </div>
            <div className="flex items-center gap-6 font-mono-ui text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              <span className="flex items-center gap-2"><Fuel className="h-3.5 w-3.5 text-acid" /> Full city traffic</span>
              <span className="flex items-center gap-2"><Gauge className="h-3.5 w-3.5 text-acid" /> Arcade handling</span>
            </div>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="relative overflow-hidden border border-white/10 bg-[#0b0f11]">
              <div className="absolute inset-0 bg-[radial-gradient(80%_80%_at_80%_20%,#c8ff3d22,transparent_65%)]" />
              <div className="grid-bg absolute inset-0 opacity-[0.18]" />
              <div className="relative flex flex-col justify-between gap-8 p-6 md:p-8">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="label-xs" style={{ color: v.color }}>{v.brand} · {v.cls}</div>
                    <h3 className="mt-2 font-display text-5xl font-black uppercase leading-none md:text-6xl">{v.name}</h3>
                    <p className="mt-3 max-w-[400px] text-sm text-zinc-400">{v.desc}</p>
                  </div>
                  <div className="hidden h-16 w-16 items-center justify-center border border-white/15 bg-black/40 md:flex">
                    {(() => {
                      const Icon = vehicleIcon[selectedVehicle];
                      return <Icon className="h-8 w-8" strokeWidth={1.3} />;
                    })()}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Top speed", Math.round(v.maxSpeed * 3.6), "km/h"],
                    ["Acceleration", v.accel * 4, "pt"],
                    ["Armor", Math.round((v.health / 2400) * 100), "%"],
                    ["Handling", Math.round((v.handling / 3) * 100), "%"],
                  ].map(([label, value, unit]) => (
                    <div key={label as string} className="border border-white/10 bg-black/30 p-3">
                      <div className="label-xs">{label as string}</div>
                      <div className="mt-1 font-display text-2xl font-bold leading-none">
                        {value as number} <span className="font-sans text-[10px] font-medium text-zinc-500">{unit as string}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {featured.map((k) => {
                    const ItemIcon = vehicleIcon[k];
                    const active = k === selectedVehicle;
                    return (
                      <button
                        key={k}
                        onClick={() => setSelectedVehicle(k)}
                        className={`flex items-center gap-2 border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition ${
                          active ? "border-acid/60 bg-acid/10 text-acid" : "border-white/10 bg-white/[0.02] text-zinc-400 hover:text-white"
                        }`}
                      >
                        <ItemIcon className="h-3.5 w-3.5" /> {VEHICLES[k].cls}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {(["tank", "heli", "bike", "police"] as VehicleKind[]).map((k) => {
                const spec = VEHICLES[k];
                const Icon = vehicleIcon[k];
                return (
                  <button
                    key={k}
                    onClick={() => setSelectedVehicle(k)}
                    className="group relative overflow-hidden border border-white/10 bg-[#0b0f11] p-5 text-left transition hover:border-white/25"
                  >
                    <div className="absolute -right-5 -top-5 h-24 w-24 rounded-full opacity-20 blur-2xl transition group-hover:opacity-40" style={{ background: spec.color }} />
                    <Icon className="h-6 w-6 text-zinc-400 transition group-hover:text-white" strokeWidth={1.4} />
                    <div className="mt-6 font-display text-xl font-bold uppercase leading-none">{spec.name}</div>
                    <div className="mt-1 font-mono-ui text-[9px] uppercase tracking-[0.16em] text-zinc-500">{spec.cls} · {Math.round(spec.maxSpeed * 3.6)} km/h</div>
                    <div className="mt-4 h-1 w-full bg-white/10">
                      <div className="h-full transition-all" style={{ width: `${(spec.maxSpeed / 86) * 100}%`, background: spec.color }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* combat */}
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="border border-white/10 bg-[#0b0f11] p-6 lg:col-span-2">
              <div className="flex items-center justify-between">
                <div className="label-xs flex items-center gap-2 text-acid"><Crosshair className="h-3.5 w-3.5" /> Combat loadout</div>
                <span className="font-mono-ui text-[9px] uppercase tracking-wider text-zinc-500">6 slots · infinite fists</span>
              </div>
              <div className="mt-5 space-y-3">
                {(["pistol", "smg", "shotgun", "rifle", "rocket"] as const).map((id) => {
                  const w = WEAPONS[id];
                  return (
                    <div key={id} className="flex items-center gap-4 border border-white/[0.07] bg-white/[0.02] px-4 py-3">
                      <WeaponIcon className="h-4 w-4 shrink-0" style={{ color: w.color }} />
                      <div className="w-36 shrink-0 font-display text-lg font-semibold uppercase leading-none">{w.name}</div>
                      <div className="hidden flex-1 sm:block">
                        <div className="h-1 w-full bg-white/10">
                          <div className="h-full" style={{ width: `${Math.min(100, (w.damage * w.pellets) / 2.3)}%`, background: w.color }} />
                        </div>
                      </div>
                      <div className="ml-auto font-mono-ui text-[10px] uppercase tracking-wider text-zinc-400">{w.mag === Infinity ? "∞" : w.mag} MAG</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="border border-white/10 bg-[#0b0f11] p-6">
              <div className="label-xs flex items-center gap-2 text-acid"><Zap className="h-3.5 w-3.5" /> Powerups & gear</div>
              <div className="mt-5 space-y-3">
                {[
                  { icon: Flame, name: "Overdrive", desc: "20s damage + speed boost", color: "#ff3d8b" },
                  { icon: Shield, name: "Armor cache", desc: "+30 armor on pickup", color: "#3dd6ff" },
                  { icon: Gem, name: "Skill shard", desc: "+1 permanent skill point", color: "#c47dff" },
                  { icon: Fuel, name: "Nitro kit", desc: "Hold Shift to hammer it", color: "#ffb03d" },
                ].map((p) => (
                  <div key={p.name} className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-white/10 bg-white/[0.03]" style={{ color: p.color }}>
                      <p.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-zinc-100">{p.name}</div>
                      <div className="text-[11px] text-zinc-500">{p.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hairline my-5" />
              <div className="space-y-2">
                {UPGRADES.slice(0, 4).map((u) => (
                  <div key={u.id} className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-300">{u.name}</span>
                    <span className="font-mono-ui text-[9px] uppercase tracking-wider text-zinc-500">{u.effect}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* contracts */}
      <section id="contracts" className="mx-auto max-w-[1400px] px-5 py-24 lg:px-8">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <div className="label-xs flex items-center gap-2 text-acid"><Target className="h-3.5 w-3.5" /> Contracts / 03</div>
            <h2 className="mt-4 font-display text-5xl font-black uppercase leading-[0.9] md:text-7xl">
              Work for
              <br />
              <span className="text-zinc-500">whoever pays.</span>
            </h2>
          </div>
          <div className="flex items-center gap-3 border border-white/10 bg-[#0b0f11] px-4 py-3">
            <Trophy className="h-5 w-5 text-acid" />
            <div>
              <div className="label-xs">Total contract value</div>
              <div className="font-display text-2xl font-bold leading-none">$81,300</div>
            </div>
          </div>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {MISSIONS.filter((m) => missionPicks.includes(m.id)).map((m) => {
            const d = DISTRICTS.find((x) => x.id === m.district)!;
            return (
              <button
                key={m.id}
                onClick={() => onPlay(m.district)}
                className="group relative flex flex-col border border-white/10 bg-[#0b0f11] p-5 text-left transition hover:-translate-y-1 hover:border-white/25"
              >
                <div className="flex items-center justify-between">
                  <span className="border px-2 py-1 font-mono-ui text-[9px] uppercase tracking-[0.14em]" style={{ borderColor: `${d.color}55`, color: d.color, background: `${d.color}12` }}>
                    {d.short}
                  </span>
                  <span className="font-mono-ui text-[9px] uppercase tracking-wider text-zinc-500">{m.category}</span>
                </div>
                <h3 className="mt-6 font-display text-3xl font-bold uppercase leading-none">{m.title}</h3>
                <p className="mt-1 text-[11px] text-zinc-500">Contact: {m.giver}</p>
                <p className="mt-4 flex-1 text-xs leading-relaxed text-zinc-400">{m.brief}</p>
                <div className="mt-5 flex items-center gap-1.5">{difficulty(m.difficulty)}</div>
                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                  <div>
                    <div className="label-xs">Payout</div>
                    <div className="font-mono-ui text-sm font-bold text-acid">${m.reward.toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 transition group-hover:text-white">
                    Brief <ArrowUpRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border border-white/10 bg-[#0b0f11] px-5 py-4">
          <div className="flex items-center gap-3">
            <Boxes className="h-5 w-5 text-acid" />
            <div className="text-xs text-zinc-400">
              <span className="font-semibold text-white">10 contracts across 5 districts.</span> Heists, eliminations, collections and survival — plus free-roam chaos.
            </div>
          </div>
          <button onClick={() => onPlay()} className="btn-acid cut-corner-sm px-5 py-2.5 text-[11px] uppercase tracking-[0.14em]">
            Open the contract board <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>

      {/* controls */}
      <section id="controls" className="border-y border-white/10 bg-[#090c0e]">
        <div className="mx-auto grid max-w-[1400px] gap-12 px-5 py-24 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <div className="label-xs flex items-center gap-2 text-acid"><Radar className="h-3.5 w-3.5" /> Field manual / 04</div>
            <h2 className="mt-4 font-display text-5xl font-black uppercase leading-[0.9] md:text-6xl">
              Learn the
              <br />
              <span className="text-zinc-500">controls.</span>
            </h2>
            <p className="mt-5 max-w-[380px] text-sm leading-relaxed text-zinc-400">
              Click the viewport to capture the mouse. Everything else is muscle memory. On mobile, use the on-screen
              stick and action buttons.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="border border-white/10 bg-white/[0.03] px-3 py-2 font-mono-ui text-[9px] uppercase tracking-wider text-zinc-400">Keyboard + mouse</span>
              <span className="border border-white/10 bg-white/[0.03] px-3 py-2 font-mono-ui text-[9px] uppercase tracking-wider text-zinc-400">Touch controls</span>
              <span className="border border-white/10 bg-white/[0.03] px-3 py-2 font-mono-ui text-[9px] uppercase tracking-wider text-zinc-400">Progress auto-saves</span>
            </div>
          </div>
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <div className="label-xs mb-3">On foot</div>
              <div className="space-y-2">
                {[
                  [["W", "A", "S", "D"], "Move around the city"],
                  [["Mouse"], "Orbit camera · drag / lock"],
                  [["LMB"], "Fire weapon"],
                  [["Shift"], "Sprint"],
                  [["Space"], "Jump"],
                  [["E"], "Enter / exit vehicles"],
                  [["1–6"], "Select weapon"],
                  [["R"], "Reload"],
                  [["H"], "Use medkit"],
                ].map(([keys, label]) => (
                  <div key={label as string} className="flex items-center justify-between gap-4 border-b border-white/[0.06] py-2">
                    <div className="flex items-center gap-1">
                      {(keys as string[]).map((k) => (
                        <span key={k} className="min-w-6 border border-white/15 bg-white/[0.05] px-1.5 py-1 text-center font-mono-ui text-[10px] text-zinc-200">
                          {k}
                        </span>
                      ))}
                    </div>
                    <span className="text-[11px] text-zinc-400">{label as string}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="label-xs mb-3">In a vehicle</div>
              <div className="space-y-2">
                {[
                  [["W / S"], "Throttle / brake"],
                  [["A / D"], "Steer / yaw"],
                  [["Shift"], "Nitro boost"],
                  [["Space"], "Handbrake · climb"],
                  [["Ctrl"], "Descend (aircraft)"],
                  [["F"], "Tank cannon"],
                  [["E"], "Exit vehicle"],
                ].map(([keys, label]) => (
                  <div key={label as string} className="flex items-center justify-between gap-4 border-b border-white/[0.06] py-2">
                    <div className="flex items-center gap-1">
                      {(keys as string[]).map((k) => (
                        <span key={k} className="border border-white/15 bg-white/[0.05] px-1.5 py-1 text-center font-mono-ui text-[10px] text-zinc-200">
                          {k}
                        </span>
                      ))}
                    </div>
                    <span className="text-[11px] text-zinc-400">{label as string}</span>
                  </div>
                ))}
              </div>
              <div className="label-xs mb-3 mt-7">City interfaces</div>
              <div className="flex flex-wrap gap-2">
                {[
                  ["Tab", "Contracts"],
                  ["M", "City map"],
                  ["G", "Garage"],
                  ["I", "Loadout"],
                  ["Esc", "Pause"],
                ].map(([k, label]) => (
                  <div key={k} className="flex items-center gap-2 border border-white/10 bg-white/[0.03] px-2.5 py-2">
                    <span className="font-mono-ui text-[10px] text-acid">{k}</span>
                    <span className="text-[10px] text-zinc-400">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* final cta */}
      <section className="relative overflow-hidden">
        <img src="/images/hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-bottom opacity-35" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#07090b_10%,rgba(7,9,11,0.7)_55%,rgba(7,9,11,0.9))]" />
        <div className="noise relative mx-auto flex max-w-[1400px] flex-col items-start gap-8 px-5 py-24 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <div className="label-xs flex items-center gap-2 text-acid"><Star className="h-3.5 w-3.5" /> Your move</div>
            <h2 className="mt-4 max-w-[720px] font-display text-5xl font-black uppercase leading-[0.86] md:text-8xl">
              The city is
              <br />
              <span className="text-acid text-glow">already awake.</span>
            </h2>
            <p className="mt-4 max-w-[460px] text-sm text-zinc-400">
              Enter as a nobody with a pistol, two medkits and a contact named Rue. Leave as the reason the skyline has a new owner.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3">
            <button onClick={() => onPlay()} className="btn-acid cut-corner px-10 py-5 text-base uppercase tracking-[0.16em]">
              <Play className="h-5 w-5 fill-current" /> Enter Havoc City
            </button>
            <div className="flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <Timer className="h-3.5 w-3.5 text-acid" /> Loads in seconds · no download
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#060809]">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-5 py-10 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center bg-acid clip-corner-sm">
                <span className="font-display text-lg font-black text-[#0a0e07]">H</span>
              </div>
              <div>
                <div className="font-display text-base font-extrabold uppercase tracking-[0.16em]">Havoc City</div>
                <div className="font-mono-ui text-[8px] uppercase tracking-[0.26em] text-zinc-600">A 3D open world sandbox</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-5 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <a href="#city" className="transition hover:text-acid">Districts</a>
              <a href="#arsenal" className="transition hover:text-acid">Arsenal</a>
              <a href="#contracts" className="transition hover:text-acid">Contracts</a>
              <a href="#controls" className="transition hover:text-acid">Controls</a>
              <button onClick={() => onPlay()} className="flex items-center gap-1 text-acid">Play <ArrowRight className="h-3 w-3" /></button>
            </div>
          </div>
          <div className="hairline" />
          <div className="flex flex-col gap-2 text-[10px] leading-relaxed text-zinc-600 md:flex-row md:items-center md:justify-between">
            <p>
              HAVOC CITY is an original fictional sandbox. All districts, brands, people and crimes are invented. Not affiliated with any existing game franchise.
            </p>
            <p className="font-mono-ui uppercase tracking-[0.18em]">© 2026 Havoc City Works · Build 1.0.4</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
