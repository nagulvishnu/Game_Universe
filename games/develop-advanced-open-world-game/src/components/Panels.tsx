import { useState, type ComponentType, type ReactNode } from "react";
import {
  ArrowRight,
  Bike,
  Boxes,
  Building2,
  Car,
  Check,
  ChevronRight,
  CircleDollarSign,
  Coins,
  Compass,
  Crosshair,
  Fan,
  Flag,
  Gamepad2,
  Gauge,
  Gem,
  Heart,
  HelpCircle,
  LogOut,
  MapPin,
  Navigation,
  Pause,
  Plane,
  RotateCcw,
  Shield,
  Sparkles,
  Star,
  Target,
  Timer,
  Trophy,
  Volume2,
  VolumeX,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import {
  DISTRICTS,
  GARAGE_KINDS,
  MISSIONS,
  UPGRADES,
  VEHICLES,
  WEAPONS,
  districtById,
  type HudState,
  type UpgradeId,
  type VehicleKind,
  type WeaponId,
} from "../game/data";
import type { GameApi } from "../game/Game";
import Minimap from "./Minimap";

export type Overlay = "missions" | "map" | "garage" | "loadout" | "pause" | "help" | null;

type IconType = ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number }>;

const vehicleIcon: Record<VehicleKind, IconType> = {
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

const upgradeIcon: Record<UpgradeId, IconType> = {
  ironSkin: Heart,
  gunslinger: Crosshair,
  wheelman: Gauge,
  scavenger: Coins,
  extendedMag: Boxes,
  armorPlating: Shield,
  nitroKit: Zap,
  scope: Target,
};

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

function Meter({ value, max, color = "#c8ff3d", height = 4 }: { value: number; max: number; color?: string; height?: number }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className="w-full overflow-hidden bg-white/10" style={{ height }}>
      <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  variant = "acid",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "acid" | "ghost" | "danger";
  className?: string;
}) {
  const base = "cut-corner-sm inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-35";
  if (variant === "acid") return <button onClick={onClick} disabled={disabled} className={`${base} btn-acid ${className}`}>{children}</button>;
  if (variant === "danger")
    return (
      <button onClick={onClick} disabled={disabled} className={`${base} border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 ${className}`}>
        {children}
      </button>
    );
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} btn-ghost ${className}`}>
      {children}
    </button>
  );
}

export function Panel({
  title,
  eyebrow,
  icon: Icon,
  onClose,
  children,
  wide,
  aside,
}: {
  title: string;
  eyebrow: string;
  icon: IconType;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  aside?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-5">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className={`animate-fade-up relative z-10 flex max-h-[94vh] w-full ${wide ? "max-w-[1240px]" : "max-w-[1020px]"} flex-col overflow-hidden border border-white/10 bg-[#080b0d] hud-shadow`}>
        <div className="relative flex shrink-0 items-center gap-4 border-b border-white/10 bg-[#0a0e10] px-4 py-4 sm:px-6">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-acid via-acid/20 to-transparent" />
          <div className="flex h-10 w-10 items-center justify-center border border-acid/30 bg-acid/10 text-acid">
            <Icon className="h-5 w-5" strokeWidth={1.6} />
          </div>
          <div className="min-w-0">
            <div className="label-xs text-acid">{eyebrow}</div>
            <h2 className="truncate font-display text-2xl font-bold uppercase leading-none tracking-wide sm:text-3xl">{title}</h2>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {aside}
            <button onClick={onClose} className="flex h-9 w-9 items-center justify-center border border-white/15 text-zinc-400 transition hover:border-white/35 hover:text-white" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color = "#c8ff3d", sub }: { label: string; value: string; icon: IconType; color?: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 border border-white/10 bg-white/[0.02] px-4 py-3">
      <Icon className="h-4 w-4 shrink-0" style={{ color }} />
      <div className="min-w-0">
        <div className="label-xs">{label}</div>
        <div className="truncate font-display text-xl font-bold leading-tight">{value}</div>
        {sub && <div className="text-[10px] text-zinc-500">{sub}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Missions / contract board
// ---------------------------------------------------------------------------

const difficultyColor = ["", "#7dffb0", "#c8ff3d", "#ffd23d", "#ff8c1a", "#ff3d5a"];

export function MissionsPanel({ hud, api, onClose }: { hud: HudState | null; api: GameApi | null; onClose: () => void }) {
  const [selected, setSelected] = useState(hud?.mission?.id ?? "welcome");
  const mission = MISSIONS.find((m) => m.id === selected) ?? MISSIONS[0];
  const district = districtById(mission.district);
  const isActive = hud?.mission?.id === mission.id;
  const isComplete = hud?.completed.includes(mission.id);
  const [filter, setFilter] = useState<"All" | "Mission" | "Quest" | "Heist">("All");
  const list = MISSIONS.filter((m) => filter === "All" || m.category === filter);

  return (
    <Panel
      wide
      title="Contract board"
      eyebrow={`Havoc City underworld · ${hud?.completed.length ?? 0}/10 complete`}
      icon={Crosshair}
      onClose={onClose}
      aside={
        <div className="hidden items-center gap-2 border border-white/10 bg-white/[0.03] px-3 py-2 sm:flex">
          <Wallet className="h-3.5 w-3.5 text-acid" />
          <span className="font-mono-ui text-xs font-bold text-acid">{money(hud?.cash ?? 0)}</span>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["All", "Mission", "Quest", "Heist"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`border px-3 py-1.5 font-mono-ui text-[10px] uppercase tracking-[0.14em] transition ${
              filter === f ? "border-acid/50 bg-acid/10 text-acid" : "border-white/10 text-zinc-400 hover:text-white"
            }`}
          >
            {f}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-[10px] text-zinc-500">
          <Sparkles className="h-3.5 w-3.5 text-acid" /> {hud?.skillPoints ?? 0} skill points available
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
          {list.map((m) => {
            const d = districtById(m.district);
            const active = hud?.mission?.id === m.id;
            const done = hud?.completed.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => setSelected(m.id)}
                className={`group flex w-full items-center gap-3 border px-3 py-3 text-left transition ${
                  selected === m.id ? "border-acid/40 bg-acid/[0.06]" : "border-white/[0.07] bg-white/[0.015] hover:border-white/20"
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border" style={{ borderColor: `${d.color}40`, color: d.color, background: `${d.color}0e` }}>
                  {done ? <Check className="h-4 w-4" /> : <Target className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-display text-lg font-semibold uppercase leading-none">{m.title}</span>
                    {active && <span className="shrink-0 border border-acid/40 px-1.5 py-0.5 font-mono-ui text-[8px] uppercase tracking-wider text-acid">Tracked</span>}
                  </div>
                  <div className="mt-1 flex items-center gap-2 font-mono-ui text-[9px] uppercase tracking-wider text-zinc-500">
                    <span style={{ color: d.color }}>{d.short}</span>
                    <span>·</span>
                    <span>{m.category}</span>
                    <span>·</span>
                    <span>{m.steps.length} steps</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono-ui text-xs font-bold text-acid">{money(m.reward)}</div>
                  <div className="mt-1 flex justify-end gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className="h-1 w-1.5" style={{ background: i < m.difficulty ? difficultyColor[m.difficulty] : "rgba(255,255,255,0.15)" }} />
                    ))}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600 transition group-hover:text-acid" />
              </button>
            );
          })}
        </div>

        <div className="relative overflow-hidden border border-white/10 bg-[#0b0f12]">
          <div className="absolute inset-x-0 top-0 h-28 opacity-60" style={{ background: `radial-gradient(100% 100% at 20% 0%, ${district.color}26, transparent 70%)` }} />
          <div className="relative p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 font-mono-ui text-[9px] uppercase tracking-[0.18em]" style={{ color: district.color }}>
                  <MapPin className="h-3 w-3" /> {district.name} · {mission.category}
                </div>
                <h3 className="mt-2 font-display text-4xl font-black uppercase leading-none">{mission.title}</h3>
                <div className="mt-1.5 text-[11px] text-zinc-500">Contact: {mission.giver}</div>
              </div>
              <div className="text-right">
                <div className="label-xs">Payout</div>
                <div className="font-display text-2xl font-bold leading-none text-acid">{money(mission.reward)}</div>
                <div className="font-mono-ui text-[10px] text-zinc-500">+{mission.xp} XP</div>
              </div>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-zinc-400">{mission.brief}</p>
            <div className="mt-4 flex items-center gap-4 border-y border-white/10 py-3">
              <div>
                <div className="label-xs">Threat</div>
                <div className="mt-1 flex items-center gap-1.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className="h-1.5 w-4" style={{ background: i < mission.difficulty ? difficultyColor[mission.difficulty] : "rgba(255,255,255,0.13)" }} />
                  ))}
                </div>
              </div>
              <div>
                <div className="label-xs">Objectives</div>
                <div className="font-mono-ui text-sm font-bold">{mission.steps.length}</div>
              </div>
              <div>
                <div className="label-xs">Status</div>
                <div className={`font-mono-ui text-sm font-bold ${isComplete ? "text-emerald-400" : "text-zinc-300"}`}>{isComplete ? "COMPLETE" : isActive ? "ACTIVE" : "OPEN"}</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="label-xs mb-2">Objective chain</div>
              <div className="space-y-2">
                {mission.steps.map((s, i) => {
                  const done = isActive && hud?.mission ? i < hud.mission.stepIndex : false;
                  const current = isActive && hud?.mission?.stepIndex === i;
                  return (
                    <div key={i} className={`flex items-center gap-3 border px-3 py-2 ${current ? "border-acid/40 bg-acid/[0.06]" : "border-white/[0.06]"}`}>
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono-ui text-[9px] ${done ? "border-emerald-400/50 text-emerald-400" : current ? "border-acid/60 text-acid" : "border-white/20 text-zinc-500"}`}>
                        {done ? <Check className="h-3 w-3" /> : i + 1}
                      </div>
                      <span className={`text-[11px] ${current ? "text-white" : "text-zinc-400"}`}>{s.text}</span>
                      <span className="ml-auto shrink-0 font-mono-ui text-[8px] uppercase tracking-wider text-zinc-600">{s.kind}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {isActive ? (
                <>
                  <Btn
                    variant="danger"
                    onClick={() => {
                      api?.abandonMission();
                      onClose();
                    }}
                  >
                    <X className="h-3.5 w-3.5" /> Abandon contract
                  </Btn>
                  <div className="flex items-center gap-2 px-2 text-[10px] text-acid">
                    <Navigation className="h-3.5 w-3.5" /> GPS marker active
                  </div>
                </>
              ) : (
                <Btn
                  onClick={() => {
                    api?.startMission(mission.id);
                    onClose();
                  }}
                >
                  <Flag className="h-3.5 w-3.5" /> Accept & deploy <ArrowRight className="h-3.5 w-3.5" />
                </Btn>
              )}
              <div className="ml-auto flex items-center gap-2 self-center font-mono-ui text-[9px] uppercase tracking-wider text-zinc-600">
                <Zap className="h-3 w-3 text-acid" /> Deploy includes travel
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border border-white/10 bg-white/[0.02] px-4 py-3 text-[10px] text-zinc-500">
        <span className="flex items-center gap-2"><Compass className="h-3.5 w-3.5 text-acid" /> Follow the acid-green beacon. You can swap vehicles at any time.</span>
        <span className="font-mono-ui uppercase tracking-wider">Tab closes the board</span>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Garage
// ---------------------------------------------------------------------------

export function GaragePanel({ hud, api, onClose }: { hud: HudState | null; api: GameApi | null; onClose: () => void }) {
  const [selected, setSelected] = useState<VehicleKind>(hud?.inVehicle?.kind ?? "sports");
  const spec = VEHICLES[selected];
  const Icon = vehicleIcon[selected];
  return (
    <Panel
      wide
      title="Havoc garage"
      eyebrow="Vehicle delivery · insured, allegedly"
      icon={Car}
      onClose={onClose}
      aside={<div className="hidden font-mono-ui text-[10px] uppercase tracking-wider text-zinc-500 sm:block">{GARAGE_KINDS.length} vehicle types</div>}
    >
      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {GARAGE_KINDS.map((kind) => {
            const v = VEHICLES[kind];
            const I = vehicleIcon[kind];
            const selectedCard = selected === kind;
            return (
              <button
                key={kind}
                onClick={() => setSelected(kind)}
                className={`group relative overflow-hidden border p-3 text-left transition ${selectedCard ? "border-acid/50 bg-acid/[0.06]" : "border-white/[0.08] bg-white/[0.02] hover:border-white/25"}`}
              >
                <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-20 blur-2xl" style={{ background: v.color }} />
                <I className="h-5 w-5" style={{ color: selectedCard ? "#c8ff3d" : v.color }} strokeWidth={1.5} />
                <div className="mt-4 font-display text-base font-semibold uppercase leading-none">{v.name}</div>
                <div className="mt-1 font-mono-ui text-[8px] uppercase tracking-wider text-zinc-500">{v.brand} · {v.cls}</div>
                <div className="mt-2 h-1 w-full bg-white/10">
                  <div className="h-full" style={{ width: `${(v.maxSpeed / 86) * 100}%`, background: v.color }} />
                </div>
              </button>
            );
          })}
        </div>

        <div className="relative overflow-hidden border border-white/10 bg-[#0b0f12]">
          <div className="absolute inset-0" style={{ background: `radial-gradient(75% 60% at 70% 10%, ${spec.color}22, transparent 65%)` }} />
          <div className="grid-bg absolute inset-0 opacity-[0.12]" />
          <div className="relative p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono-ui text-[9px] uppercase tracking-[0.2em]" style={{ color: spec.color }}>{spec.brand} · {spec.cls}</div>
                <h3 className="mt-1 font-display text-4xl font-black uppercase leading-none">{spec.name}</h3>
              </div>
              <Icon className="h-9 w-9 text-white/80" strokeWidth={1.2} />
            </div>
            <p className="mt-3 min-h-[40px] text-[12px] leading-relaxed text-zinc-400">{spec.desc}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                ["Top speed", `${Math.round(spec.maxSpeed * 3.6)} km/h`, Math.min(100, (spec.maxSpeed / 86) * 100), spec.color],
                ["Acceleration", `${spec.accel}`, Math.min(100, spec.accel * 3), "#2ad9ff"],
                ["Armor", `${spec.health}`, Math.min(100, (spec.health / 2400) * 100), "#ffd23d"],
                ["Handling", `${Math.round(spec.handling * 10)}`, Math.min(100, spec.handling * 30), "#ff3d8b"],
              ].map(([label, val, pct, color]) => (
                <div key={label as string} className="border border-white/10 bg-black/25 p-2.5">
                  <div className="flex items-baseline justify-between">
                    <span className="label-xs">{label as string}</span>
                    <span className="font-mono-ui text-[11px] font-bold">{val as string}</span>
                  </div>
                  <div className="mt-2"><Meter value={pct as number} max={100} color={color as string} height={3} /></div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 border border-white/10 bg-black/20 px-3 py-2 text-[10px] text-zinc-500">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-acid" /> Delivered free to the nearest clear street. Special vehicles handle best on open ground.
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Btn
                onClick={() => {
                  api?.spawnVehicle(selected);
                  onClose();
                }}
              >
                <Navigation className="h-3.5 w-3.5" /> Deliver to street
              </Btn>
              <div className="flex items-center gap-2 self-center font-mono-ui text-[10px] uppercase tracking-wider text-zinc-500">
                <Coins className="h-3.5 w-3.5 text-acid" /> Free in free roam
              </div>
            </div>
            {hud?.inVehicle && (
              <div className="mt-4 border-t border-white/10 pt-3 font-mono-ui text-[10px] uppercase tracking-wider text-zinc-500">
                Currently driving: <span className="text-acid">{hud.inVehicle.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Loadout / skills
// ---------------------------------------------------------------------------

export function LoadoutPanel({ hud, api, onClose }: { hud: HudState | null; api: GameApi | null; onClose: () => void }) {
  const [tab, setTab] = useState<"combat" | "gear" | "weapons">("combat");
  const owned = hud?.ownedUpgrades ?? {};
  const upgrades = UPGRADES.filter((u) => (tab === "combat" ? u.category === "Combat" : tab === "gear" ? u.category === "Gear" : false));

  return (
    <Panel
      wide
      title="Loadout & skills"
      eyebrow={`Operator level ${hud?.level ?? 1} · ${hud?.skillPoints ?? 0} skill points`}
      icon={Zap}
      onClose={onClose}
      aside={
        <div className="hidden items-center gap-3 sm:flex">
          <div className="flex items-center gap-1.5 border border-white/10 bg-white/[0.03] px-2.5 py-1.5"><Wallet className="h-3.5 w-3.5 text-acid" /><span className="font-mono-ui text-xs font-bold">{money(hud?.cash ?? 0)}</span></div>
          <div className="flex items-center gap-1.5 border border-white/10 bg-white/[0.03] px-2.5 py-1.5"><Gem className="h-3.5 w-3.5 text-[#c47dff]" /><span className="font-mono-ui text-xs font-bold">{hud?.skillPoints ?? 0} SP</span></div>
        </div>
      }
    >
      <div className="mb-5 grid gap-2 sm:grid-cols-4">
        <StatCard label="Level" value={String(hud?.level ?? 1)} icon={Star} sub={`${hud?.xp ?? 0} / ${hud?.xpNext ?? 500} XP`} />
        <StatCard label="Max health" value={String(hud?.maxHealth ?? 100)} icon={Heart} color="#ff5a7a" />
        <StatCard label="Max armor" value={String(hud?.maxArmor ?? 50)} icon={Shield} color="#2ad9ff" />
        <StatCard label="Contracts" value={`${hud?.completed.length ?? 0} / 10`} icon={Trophy} color="#ffd23d" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {([
          ["combat", "Combat skills", Crosshair],
          ["gear", "Field gear", Shield],
          ["weapons", "Weapons", Target],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 border px-3.5 py-2 font-mono-ui text-[10px] uppercase tracking-[0.14em] transition ${
              tab === id ? "border-acid/50 bg-acid/10 text-acid" : "border-white/10 text-zinc-400 hover:text-white"
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 self-center text-[10px] text-zinc-500">
          <Sparkles className="h-3.5 w-3.5 text-[#c47dff]" /> Skill shards grant +1 SP in the city
        </div>
      </div>

      {tab !== "weapons" ? (
        <div className="grid gap-2 md:grid-cols-2">
          {upgrades.map((u) => {
            const Icon = upgradeIcon[u.id];
            const rank = owned[u.id] ?? 0;
            const maxed = rank >= u.max;
            const currency = u.currency === "cash" ? hud?.cash ?? 0 : hud?.skillPoints ?? 0;
            const affordable = currency >= u.cost;
            return (
              <div key={u.id} className={`relative overflow-hidden border p-4 ${maxed ? "border-emerald-400/20 bg-emerald-400/[0.03]" : "border-white/10 bg-white/[0.02]"}`}>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-white/10 text-acid" style={{ background: "rgba(200,255,61,0.06)" }}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-display text-lg font-semibold uppercase leading-none">{u.name}</h4>
                      <span className="border border-white/10 px-1.5 py-0.5 font-mono-ui text-[8px] uppercase tracking-wider text-zinc-500">{u.category}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">{u.desc}</p>
                    <div className="mt-3 flex items-center gap-1.5">
                      {Array.from({ length: u.max }).map((_, i) => (
                        <span key={i} className={`h-1.5 flex-1 ${i < rank ? "bg-acid" : "bg-white/10"}`} />
                      ))}
                      <span className="ml-1 font-mono-ui text-[9px] text-zinc-500">{rank}/{u.max}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-3">
                  <div className="font-mono-ui text-[10px] uppercase tracking-wider text-zinc-500">{u.effect}</div>
                  <button
                    disabled={maxed || !affordable}
                    onClick={() => api?.buyUpgrade(u.id)}
                    className={`cut-corner-sm px-3 py-1.5 font-mono-ui text-[10px] font-bold uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-35 ${
                      maxed ? "bg-emerald-400/10 text-emerald-300" : "btn-acid"
                    }`}
                  >
                    {maxed ? "Maxed" : u.currency === "cash" ? `Buy $${u.cost.toLocaleString()}` : `Buy ${u.cost} SP`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-2">
            {(["pistol", "smg", "shotgun", "rifle", "rocket"] as WeaponId[]).map((id) => {
              const w = WEAPONS[id];
              const ammo = hud?.weapon === id ? { mag: hud.ammo, reserve: hud.reserve } : null;
              const equipped = hud?.weapon === id;
              return (
                <div key={id} className={`flex flex-wrap items-center gap-3 border px-4 py-3 ${equipped ? "border-acid/40 bg-acid/[0.05]" : "border-white/10 bg-white/[0.02]"}`}>
                  <div className="flex h-9 w-9 items-center justify-center border border-white/10" style={{ color: w.color }}>
                    <Crosshair className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-lg font-semibold uppercase leading-none">{w.name}</span>
                      {equipped && <span className="border border-acid/40 px-1.5 py-0.5 font-mono-ui text-[8px] uppercase tracking-wider text-acid">Equipped</span>}
                    </div>
                    <div className="mt-1 text-[10px] text-zinc-500">{w.desc}</div>
                    <div className="mt-2 flex items-center gap-2"><Meter value={w.damage * w.pellets} max={240} color={w.color} height={3} /><span className="font-mono-ui text-[9px] text-zinc-500">{w.damage * w.pellets} DMG</span></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right font-mono-ui text-[10px] text-zinc-500">
                      <div className="text-zinc-200">{ammo ? (ammo.mag < 0 ? "∞" : ammo.mag) : w.mag === Infinity ? "∞" : w.mag}</div>
                      <div>MAG</div>
                    </div>
                    <Btn variant="ghost" onClick={() => api?.selectWeapon(id)} className="!px-3 !py-2 !text-[9px]">Equip</Btn>
                    <Btn variant="ghost" onClick={() => api?.buyAmmo(id)} className="!px-3 !py-2 !text-[9px]">$600</Btn>
                  </div>
                </div>
              );
            })}
          </div>
          <div>
            <div className="border border-white/10 bg-white/[0.02] p-4">
              <div className="label-xs flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-hot" /> Active powerups</div>
              {hud?.boosts.length ? (
                <div className="mt-3 space-y-2">
                  {hud.boosts.map((b) => (
                    <div key={b.name} className="flex items-center justify-between border border-hot/25 bg-hot/[0.06] px-3 py-2">
                      <span className="font-display text-lg font-semibold uppercase text-hot">{b.name}</span>
                      <span className="font-mono-ui text-xs text-zinc-300">{b.seconds}s</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
                  No active effects. Pink nitro pickups grant 20 seconds of Overdrive: +50% damage and faster movement.
                </p>
              )}
            </div>
            <div className="mt-3 border border-white/10 bg-white/[0.02] p-4">
              <div className="label-xs flex items-center gap-2"><Gem className="h-3.5 w-3.5 text-[#c47dff]" /> How to earn</div>
              <ul className="mt-3 space-y-2 text-[11px] text-zinc-400">
                <li className="flex gap-2"><Check className="mt-0.5 h-3 w-3 shrink-0 text-acid" /> Complete contracts for cash and XP.</li>
                <li className="flex gap-2"><Check className="mt-0.5 h-3 w-3 shrink-0 text-acid" /> Every level grants one skill point.</li>
                <li className="flex gap-2"><Check className="mt-0.5 h-3 w-3 shrink-0 text-acid" /> Purple skill shards are scattered around the districts.</li>
                <li className="flex gap-2"><Check className="mt-0.5 h-3 w-3 shrink-0 text-acid" /> Gunfire, vehicles and chaos also pay — until the police arrive.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
      <div className="mt-4 flex items-center justify-between border border-white/10 bg-white/[0.02] px-4 py-3 font-mono-ui text-[10px] uppercase tracking-wider text-zinc-500">
        <span className="flex items-center gap-2"><Target className="h-3.5 w-3.5 text-acid" /> Press 1–6 in combat to switch weapons</span>
        <span className="hidden sm:block">I closes loadout</span>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------

export function MapPanel({ hud, api, onClose }: { hud: HudState | null; api: GameApi | null; onClose: () => void }) {
  return (
    <Panel wide title="City map" eyebrow="Havoc City municipal grid · live tracking" icon={Compass} onClose={onClose}>
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="relative overflow-hidden border border-white/10 bg-[#061720]">
          <div className="aspect-square w-full">
            <Minimap hud={hud} size={660} full />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-3 bg-gradient-to-t from-black/85 to-transparent px-3 pb-3 pt-8 text-[9px] uppercase tracking-wider text-zinc-300">
            {[
              ["#c8ff3d", "Contract"],
              ["#ff3d4d", "Hostile"],
              ["#3d9bff", "Police"],
              ["#42ffab", "Pickup"],
              ["#ffb03d", "Garage"],
              ["#2ad9ff", "Hospital"],
            ].map(([c, label]) => (
              <span key={label} className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />{label}</span>
            ))}
          </div>
        </div>
        <div className="flex flex-col">
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Cash" value={money(hud?.cash ?? 0)} icon={CircleDollarSign} />
            <StatCard label="Where" value={hud ? districtById(hud.district).short : "—"} icon={MapPin} />
            <StatCard label="Wanted" value={`${hud?.wanted ?? 0}/5`} icon={Star} color="#ff5a5a" />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="label-xs flex items-center gap-2"><Navigation className="h-3.5 w-3.5 text-acid" /> Fast travel</div>
            {hud?.quickTravelLocked && <span className="font-mono-ui text-[9px] uppercase tracking-wider text-amber-400">Locked during contract</span>}
          </div>
          <div className="mt-2 space-y-2">
            {DISTRICTS.map((d) => (
              <div key={d.id} className="flex items-center gap-3 border border-white/10 bg-white/[0.02] p-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center border" style={{ borderColor: `${d.color}40`, color: d.color, background: `${d.color}0e` }}>
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base font-semibold uppercase leading-none">{d.short}</div>
                  <div className="mt-0.5 truncate text-[10px] text-zinc-500">{d.tagline}</div>
                </div>
                <button
                  disabled={hud?.quickTravelLocked}
                  onClick={() => {
                    api?.fastTravel(d.id);
                    onClose();
                  }}
                  className="cut-corner-sm border border-white/15 px-2.5 py-1.5 font-mono-ui text-[9px] uppercase tracking-wider text-zinc-300 transition hover:border-acid/50 hover:text-acid disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Travel
                </button>
              </div>
            ))}
          </div>
          <div className="mt-auto pt-3">
            <div className="border border-white/10 bg-white/[0.02] p-3 text-[10px] leading-relaxed text-zinc-500">
              <span className="flex items-center gap-1.5 text-zinc-300"><Target className="h-3 w-3 text-acid" /> Active GPS</span>
              {hud?.mission ? (
                <p className="mt-1">{hud.mission.title} — {hud.mission.step}</p>
              ) : (
                <p className="mt-1">No active contract. Open the board with Tab to pick one up.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Pause / help
// ---------------------------------------------------------------------------

export function PausePanel({
  hud,
  api,
  onClose,
  onHelp,
  onExit,
}: {
  hud: HudState | null;
  api: GameApi | null;
  onClose: () => void;
  onHelp: () => void;
  onExit: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <Panel title="Paused" eyebrow="Havoc City · session menu" icon={Pause} onClose={onClose}>
      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <div className="space-y-2">
          <Btn onClick={onClose} className="w-full !py-3.5">
            <Pause className="h-4 w-4" /> Resume game
          </Btn>
          <Btn variant="ghost" onClick={onHelp} className="w-full !py-3.5">
            <HelpCircle className="h-4 w-4" /> Field manual & controls
          </Btn>
          <Btn variant="ghost" onClick={() => api?.toggleMute()} className="w-full !py-3.5">
            {hud?.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />} Sound: {hud?.muted ? "off" : "on"}
          </Btn>
          <Btn
            variant="ghost"
            onClick={() => api?.setQuality(hud?.quality === "high" ? "performance" : "high")}
            className="w-full !py-3.5"
          >
            <Gauge className="h-4 w-4" /> Graphics: {hud?.quality === "high" ? "high fidelity" : "performance"}
          </Btn>
          <Btn variant={confirm ? "danger" : "ghost"} onClick={() => (confirm ? (api?.resetProgress(), setConfirm(false)) : setConfirm(true))} className="w-full !py-3.5">
            <RotateCcw className="h-4 w-4" /> {confirm ? "Confirm full progress reset" : "Reset progress"}
          </Btn>
          <Btn variant="ghost" onClick={onExit} className="w-full !py-3.5">
            <LogOut className="h-4 w-4" /> Exit to main menu
          </Btn>
        </div>
        <div className="space-y-3">
          <div className="border border-white/10 bg-white/[0.02] p-4">
            <div className="label-xs flex items-center gap-2"><Trophy className="h-3.5 w-3.5 text-acid" /> Session overview</div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {[
                ["Level", String(hud?.level ?? 1)],
                ["Cash", money(hud?.cash ?? 0)],
                ["Contracts", `${hud?.completed.length ?? 0}/10`],
                ["District", hud ? districtById(hud.district).short : "—"],
                ["Wanted", `${hud?.wanted ?? 0} / 5`],
                ["FPS", String(hud?.fps ?? 0)],
              ].map(([l, v]) => (
                <div key={l} className="border border-white/[0.06] bg-black/20 px-3 py-2">
                  <div className="label-xs">{l}</div>
                  <div className="font-display text-xl font-bold leading-none">{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="border border-white/10 bg-white/[0.02] p-4 text-[11px] leading-relaxed text-zinc-400">
            <div className="label-xs mb-2 text-acid">Controls</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {[
                [["WASD"], "Move"],
                [["LMB"], "Fire"],
                [["E"], "Vehicle"],
                [["Tab"], "Contracts"],
                [["M"], "Map"],
                [["G"], "Garage"],
                [["I"], "Loadout"],
                [["H"], "Medkit"],
              ].map(([keys, label]) => (
                <div key={label as string} className="flex items-center gap-2">
                  <span className="border border-white/15 bg-white/[0.04] px-1.5 py-0.5 font-mono-ui text-[9px] text-zinc-200">{(keys as string[])[0]}</span>
                  <span>{label as string}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="font-mono-ui text-[9px] uppercase tracking-[0.18em] text-zinc-600">Progress saves automatically to this device.</div>
        </div>
      </div>
    </Panel>
  );
}

export function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <Panel title="Field manual" eyebrow="Survive the city · controls & tips" icon={HelpCircle} onClose={onClose}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="border border-white/10 bg-white/[0.02] p-4">
            <div className="label-xs mb-3 flex items-center gap-2 text-acid"><Gamepad2 className="h-3.5 w-3.5" /> On foot</div>
            <div className="space-y-2">
              {[
                ["W A S D", "Move relative to camera"],
                ["Mouse", "Look · click viewport to capture"],
                ["Left click", "Fire equipped weapon"],
                ["Shift", "Sprint (stamina)"],
                ["Space", "Jump"],
                ["E", "Enter / exit vehicle"],
                ["1 – 6", "Weapon slots · Q cycles"],
                ["R / H", "Reload · medkit"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-white/[0.06] pb-2 text-[11px]">
                  <span className="border border-white/15 bg-white/[0.05] px-2 py-1 font-mono-ui text-[9px] text-zinc-200">{k}</span>
                  <span className="text-zinc-400">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="border border-white/10 bg-white/[0.02] p-4">
            <div className="label-xs mb-3 flex items-center gap-2 text-acid"><Car className="h-3.5 w-3.5" /> Vehicles</div>
            <div className="space-y-2">
              {[
                ["W / S", "Throttle / brake"],
                ["A / D", "Steer"],
                ["Shift", "Nitro"],
                ["Space", "Handbrake · helicopter up"],
                ["Ctrl", "Helicopter down"],
                ["Space", "Plane: pitch up at speed"],
                ["F", "Tank cannon"],
              ].map(([k, v]) => (
                <div key={v} className="flex items-center justify-between border-b border-white/[0.06] pb-2 text-[11px]">
                  <span className="border border-white/15 bg-white/[0.05] px-2 py-1 font-mono-ui text-[9px] text-zinc-200">{k}</span>
                  <span className="text-zinc-400">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border border-white/10 bg-white/[0.02] p-4">
            <div className="label-xs mb-2 flex items-center gap-2 text-acid"><Timer className="h-3.5 w-3.5" /> Field tips</div>
            <ul className="space-y-2 text-[11px] leading-relaxed text-zinc-400">
              <li>• Planes need speed before Space lifts the nose. The Foundry airfield has the longest run.</li>
              <li>• Armor absorbs 70% of incoming fire. Keep it topped up with blue pickups.</li>
              <li>• Killing civilians or cops raises your wanted level. Lose the heat by breaking line of sight.</li>
              <li>• The Rhino is slow but its cannon solves most problems — including property values.</li>
              <li>• Click the city viewport once to lock the mouse. Esc pauses at any time.</li>
            </ul>
          </div>
        </div>
      </div>
    </Panel>
  );
}
