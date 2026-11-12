import { useRef, useState, type ComponentType } from "react";
import {
  ArrowRight,
  Car,
  ChevronUp,
  Crosshair,
  Fan,
  Gauge,
  Gem,
  Heart,
  HelpCircle,
  Map as MapIcon,
  MapPin,
  Menu,
  MousePointer2,
  Navigation,
  Plane,
  Rocket,
  Shield,
  Skull,
  Sparkles,
  Star,
  Target,
  Timer,
  Volume2,
  VolumeX,
  Wrench,
  Zap,
} from "lucide-react";
import {
  DISTRICTS,
  VEHICLES,
  WEAPONS,
  WEAPON_ORDER,
  districtById,
  type HudState,
  type VehicleKind,
  type WeaponId,
} from "../game/data";
import type { GameApi } from "../game/Game";
import Minimap from "./Minimap";
import { GaragePanel, HelpPanel, LoadoutPanel, MapPanel, MissionsPanel, PausePanel, type Overlay } from "./Panels";

export interface ToastItem {
  id: number;
  title: string;
  body?: string;
  tone?: "info" | "success" | "danger" | "reward" | "mission";
}

export interface Splash {
  title: string;
  body?: string;
  value?: number;
  kind: "mission" | "level";
}

type IconType = ComponentType<{ className?: string; style?: React.CSSProperties }>;

const vehicleIcon: Record<VehicleKind, IconType> = {
  sports: Car,
  muscle: Car,
  suv: Car,
  taxi: Car,
  police: Car,
  truck: Car,
  bike: Car,
  sportbike: Car,
  plane: Plane,
  heli: Fan,
  tank: Shield,
};

const weaponIcon: Record<WeaponId, IconType> = {
  fists: Zap,
  pistol: Crosshair,
  smg: Zap,
  shotgun: Target,
  rifle: Crosshair,
  rocket: Rocket,
};

const toneMap: Record<string, { color: string; bg: string; border: string }> = {
  info: { color: "#e8eef1", bg: "rgba(16,22,26,0.92)", border: "rgba(255,255,255,0.14)" },
  success: { color: "#c8ff3d", bg: "rgba(14,22,12,0.94)", border: "rgba(200,255,61,0.3)" },
  danger: { color: "#ff6b7a", bg: "rgba(26,12,14,0.94)", border: "rgba(255,61,90,0.32)" },
  reward: { color: "#ffd23d", bg: "rgba(24,20,10,0.94)", border: "rgba(255,210,61,0.32)" },
  mission: { color: "#c8ff3d", bg: "rgba(12,18,14,0.95)", border: "rgba(200,255,61,0.4)" },
};

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

function Meter({ value, max, color = "#c8ff3d", className = "", height = 5 }: { value: number; max: number; color?: string; className?: string; height?: number }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className={`w-full overflow-hidden bg-white/10 ${className}`} style={{ height }}>
      <div className="h-full transition-all duration-300" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 12px ${color}66` }} />
    </div>
  );
}

function WantedStars({ wanted, reason }: { wanted: number; reason: string }) {
  if (wanted <= 0) return null;
  return (
    <div className="glass-soft cut-corner-sm pointer-events-none mt-2 px-3 py-2">
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={`h-4 w-4 ${i < wanted ? "fill-[#ffd23d] text-[#ffd23d]" : "text-white/20"}`} style={i < wanted ? { filter: "drop-shadow(0 0 6px rgba(255,210,61,.7))" } : undefined} />
        ))}
        <span className="ml-1 font-mono-ui text-[9px] uppercase tracking-[0.16em] text-amber-300">Wanted</span>
      </div>
      {reason && <div className="mt-1 max-w-[150px] truncate font-mono-ui text-[8px] uppercase tracking-wider text-zinc-500">{reason}</div>}
    </div>
  );
}

function CrosshairView({ hitAt }: { hitAt: number }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
      <div className="relative flex h-8 w-8 items-center justify-center">
        <span className="absolute h-1 w-1 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,.8)]" />
        <span className="absolute left-1/2 top-0 h-1.5 w-px -translate-x-1/2 bg-white/70" />
        <span className="absolute bottom-0 left-1/2 h-1.5 w-px -translate-x-1/2 bg-white/70" />
        <span className="absolute left-0 top-1/2 h-px w-1.5 -translate-y-1/2 bg-white/70" />
        <span className="absolute right-0 top-1/2 h-px w-1.5 -translate-y-1/2 bg-white/70" />
        <span key={hitAt} className={`absolute inset-0 ${hitAt ? "animate-hit" : "opacity-0"}`}>
          <span className="absolute left-1/2 top-1/2 h-px w-6 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-acid" />
          <span className="absolute left-1/2 top-1/2 h-px w-6 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-acid" />
        </span>
      </div>
    </div>
  );
}

function Joystick({ api }: { api: GameApi | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef(false);
  const update = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = clientX - (r.left + r.width / 2);
    const dy = clientY - (r.top + r.height / 2);
    const max = r.width / 2 - 16;
    const len = Math.hypot(dx, dy);
    const k = len > max ? max / len : 1;
    const x = dx * k;
    const y = dy * k;
    setKnob({ x, y });
    api?.setMoveAxis(x / max, -y / max);
  };
  const end = () => {
    active.current = false;
    setKnob({ x: 0, y: 0 });
    api?.setMoveAxis(0, 0);
  };
  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        active.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => active.current && update(e.clientX, e.clientY)}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={() => active.current && end()}
      className="pointer-events-auto relative h-24 w-24 touch-none rounded-full border border-white/20 bg-black/40 backdrop-blur-sm"
    >
      <div className="absolute inset-3 rounded-full border border-white/10" />
      <div className="absolute left-1/2 top-1/2 h-px w-full -translate-x-1/2 -translate-y-1/2 bg-white/10" />
      <div className="absolute left-1/2 top-1/2 h-full w-px -translate-x-1/2 -translate-y-1/2 bg-white/10" />
      <div
        className="absolute left-1/2 top-1/2 flex h-12 w-12 items-center justify-center rounded-full border border-acid/40 bg-acid/15"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      >
        <ChevronUp className="h-4 w-4 text-acid" />
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onDown,
  onUp,
  big,
  active,
}: {
  icon: IconType;
  label: string;
  onDown: () => void;
  onUp?: () => void;
  big?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        onDown();
      }}
      onPointerUp={() => onUp?.()}
      onPointerCancel={() => onUp?.()}
      onPointerLeave={() => onUp?.()}
      className={`pointer-events-auto flex touch-none flex-col items-center justify-center rounded-full border font-mono-ui uppercase transition ${
        big ? "h-16 w-16" : "h-11 w-11"
      } ${active ? "border-acid/60 bg-acid/20 text-acid" : "border-white/25 bg-black/45 text-white/85 backdrop-blur-sm active:bg-white/20"}`}
      aria-label={label}
    >
      <Icon className={big ? "h-6 w-6" : "h-4 w-4"} />
      <span className="mt-0.5 text-[7px] tracking-wider opacity-70">{label}</span>
    </button>
  );
}

function WeaponHud({ hud, api }: { hud: HudState; api: GameApi | null }) {
  const weapon = WEAPONS[hud.weapon];
  const Icon = weaponIcon[hud.weapon];
  const infinite = hud.ammo < 0;
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="pointer-events-auto flex items-center gap-1">
        {WEAPON_ORDER.map((id) => {
          const w = WEAPONS[id];
          const active = id === hud.weapon;
          const I = weaponIcon[id];
          return (
            <button
              key={id}
              onClick={() => api?.selectWeapon(id)}
              className={`relative flex h-8 w-8 items-center justify-center border transition ${
                active ? "border-acid/70 bg-acid/15 text-acid" : "border-white/10 bg-black/45 text-zinc-500 hover:text-white"
              }`}
              title={w.name}
            >
              <I className="h-3.5 w-3.5" />
              <span className="absolute -bottom-1 -right-1 bg-[#0a0d0f] px-0.5 font-mono-ui text-[7px] text-zinc-500">{w.slot}</span>
            </button>
          );
        })}
      </div>
      <div className="glass cut-corner-sm min-w-[186px] px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: weapon.color }} />
          <span className="font-display text-lg font-semibold uppercase leading-none">{weapon.name}</span>
        </div>
        <div className="mt-2 flex items-end justify-between">
          <div className="font-mono-ui text-[9px] uppercase tracking-wider text-zinc-500">{hud.reloading ? "Reloading…" : "Ammo"}</div>
          <div className="font-display text-2xl font-bold leading-none">
            <span className={infinite ? "text-acid" : hud.ammo === 0 ? "text-red-400" : ""}>{infinite ? "∞" : hud.ammo}</span>
            <span className="ml-1 font-mono-ui text-[10px] font-normal text-zinc-500">/ {hud.reserve < 0 ? "∞" : hud.reserve}</span>
          </div>
        </div>
        <div className="mt-2"><Meter value={infinite ? 100 : hud.ammo} max={infinite ? 1 : WEAPONS[hud.weapon].mag} color={weapon.color} height={3} /></div>
        {hud.reloading && <div className="mt-1 font-mono-ui text-[8px] uppercase tracking-wider text-amber-300">Reloading · R</div>}
      </div>
    </div>
  );
}

function VehicleHud({ hud }: { hud: HudState }) {
  if (!hud.inVehicle) return null;
  const v = hud.inVehicle;
  const Icon = vehicleIcon[v.kind] ?? Car;
  const pct = Math.min(100, (v.speed / (VEHICLES[v.kind].maxSpeed * 3.6)) * 100);
  return (
    <div className="glass cut-corner-sm w-[230px] px-4 py-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-acid" />
        <span className="truncate font-display text-base font-semibold uppercase leading-none">{v.name}</span>
        {v.airborne && <span className="ml-auto border border-cyan-400/40 px-1.5 py-0.5 font-mono-ui text-[7px] uppercase tracking-wider text-cyan-300">Air</span>}
      </div>
      <div className="mt-2 flex items-end justify-between">
        <div>
          <div className="font-display text-3xl font-bold leading-none">{Math.round(v.speed)}</div>
          <div className="font-mono-ui text-[8px] uppercase tracking-wider text-zinc-500">km/h</div>
        </div>
        <div className="w-24 space-y-1.5">
          <div>
            <div className="flex justify-between font-mono-ui text-[7px] uppercase tracking-wider text-zinc-500"><span>Hull</span><span>{Math.round((v.health / v.maxHealth) * 100)}%</span></div>
            <Meter value={v.health} max={v.maxHealth} color="#ffd23d" height={3} />
          </div>
          <div>
            <div className="flex justify-between font-mono-ui text-[7px] uppercase tracking-wider text-zinc-500"><span>Nitro</span><span>Shift</span></div>
            <Meter value={v.nitro} max={100} color="#ff3d8b" height={3} />
          </div>
        </div>
      </div>
      <div className="mt-2 h-1 w-full bg-white/10"><div className="h-full bg-acid" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function Toasts({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="pointer-events-none absolute left-3 top-[218px] z-30 flex w-[min(300px,74vw)] flex-col gap-2 md:left-5 md:top-[236px]">
      {toasts.slice(-4).map((t) => {
        const tone = toneMap[t.tone ?? "info"];
        return (
          <div key={t.id} className="animate-toast overflow-hidden border bg-black/80" style={{ borderColor: tone.border, background: tone.bg }}>
            <div className="flex">
              <div className="w-0.5 shrink-0" style={{ background: tone.color }} />
              <div className="min-w-0 px-3 py-2.5">
                <div className="flex items-center gap-1.5 font-mono-ui text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: tone.color }}>
                  <span className="h-1 w-1 rounded-full" style={{ background: tone.color }} /> {t.title}
                </div>
                {t.body && <div className="mt-1 text-[11px] leading-snug text-zinc-300">{t.body}</div>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function HUD({
  hud,
  api,
  toasts,
  overlay,
  setOverlay,
  onExit,
  hitAt,
  damageAt,
  splash,
}: {
  hud: HudState | null;
  api: GameApi | null;
  toasts: ToastItem[];
  overlay: Overlay;
  setOverlay: (o: Overlay) => void;
  onExit: () => void;
  hitAt: number;
  damageAt: number;
  splash: Splash | null;
}) {
  const [showLegend, setShowLegend] = useState(false);
  const district = hud ? districtById(hud.district) : DISTRICTS[0];
  const lowHealth = !!hud && hud.health / hud.maxHealth < 0.3;
  const missionDistance = hud?.mission ? Math.round(Math.hypot(hud.x - hud.mission.target[0], hud.z - hud.mission.target[1])) : 0;
  const navButtons: { id: Overlay; label: string; hotkey: string; icon: IconType }[] = [
    { id: "missions", label: "Contracts", hotkey: "TAB", icon: Crosshair },
    { id: "map", label: "Map", hotkey: "M", icon: MapIcon },
    { id: "garage", label: "Garage", hotkey: "G", icon: Car },
    { id: "loadout", label: "Loadout", hotkey: "I", icon: Wrench },
    { id: "help", label: "Manual", hotkey: "?", icon: HelpCircle },
  ];

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-40 select-none font-sans text-white">
        {/* damage flash */}
        {damageAt > 0 && (
          <div
            key={damageAt}
            className="animate-damage pointer-events-none absolute inset-0 z-50"
            style={{ background: "radial-gradient(80% 80% at 50% 50%, transparent 35%, rgba(190,10,20,0.55) 100%)" }}
          />
        )}

        {/* map + district */}
        <div className="absolute left-3 top-3 md:left-5 md:top-5">
          <div className="relative h-[100px] w-[100px] rounded-full border border-white/20 bg-black/60 p-[4px] shadow-[0_10px_40px_-12px_rgba(0,0,0,.9)] md:h-[172px] md:w-[172px] md:p-[5px]">
            <div className="absolute inset-0 rounded-full border border-acid/20" />
            <Minimap hud={hud} size={172} />
            <div className="absolute inset-x-1.5 bottom-1 flex items-center justify-between md:inset-x-3 md:bottom-2">
              <span className="rounded-sm bg-black/70 px-1 py-0.5 font-mono-ui text-[7px] font-bold uppercase tracking-[0.16em] text-white md:px-1.5 md:text-[8px]">N</span>
              <span className="hidden rounded-sm bg-black/70 px-1.5 py-0.5 font-mono-ui text-[8px] uppercase tracking-wider md:block" style={{ color: district.color }}>{district.short}</span>
            </div>
            {hud && hud.wanted > 0 && (
              <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-amber-400 bg-black text-[10px] font-bold text-amber-300">
                {hud.wanted}
              </div>
            )}
          </div>
          <div className="glass-soft cut-corner-sm mt-2 hidden max-w-[230px] items-center gap-2 px-2.5 py-1.5 md:flex">
            <div className="min-w-0">
              <div className="truncate font-mono-ui text-[8px] uppercase tracking-[0.18em]" style={{ color: district.color }}>{district.name}</div>
              <div className="flex items-center gap-2 font-mono-ui text-[8px] text-zinc-500">
                <span className="flex items-center gap-1"><Timer className="h-2.5 w-2.5" /> {hud?.clock ?? "21:40"}</span>
                <span className="h-1 w-1 rounded-full bg-zinc-600" />
                <span>DUSK</span>
                <span className="h-1 w-1 rounded-full bg-zinc-600" />
                <span>{hud?.fps ?? 60} FPS</span>
              </div>
            </div>
            <button onClick={() => setShowLegend((s) => !s)} className="pointer-events-auto ml-auto flex h-6 w-6 shrink-0 items-center justify-center border border-white/10 text-zinc-400 hover:text-white" aria-label="Map legend">
              <MapPin className="h-3 w-3" />
            </button>
          </div>
          {showLegend && (
            <div className="hidden md:block">
            <div className="glass-soft cut-corner-sm mt-1 w-[190px] p-2">
              {[
                ["#c8ff3d", "Contract"],
                ["#ff3d4d", "Hostile"],
                ["#3d9bff", "Police"],
                ["#42ffab", "Pickups"],
                ["#8d9aa3", "Vehicles"],
              ].map(([c, l]) => (
                <div key={l} className="flex items-center gap-2 py-0.5 font-mono-ui text-[8px] uppercase tracking-wider text-zinc-400">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} /> {l}
                </div>
              ))}
            </div>
            </div>
          )}
        </div>

        {/* money + level + nav */}
        <div className="absolute right-3 top-3 flex flex-col items-end md:right-5 md:top-5">
          <div className="glass cut-corner-sm flex items-center gap-2 px-2.5 py-1.5 md:gap-3 md:px-4 md:py-2">
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5">
                <span className="font-display text-xl font-bold leading-none text-acid md:text-3xl">{money(hud?.cash ?? 0)}</span>
              </div>
              <div className="mt-1 hidden items-center justify-end gap-1.5 md:flex">
                <span className="font-mono-ui text-[8px] uppercase tracking-wider text-zinc-500">LVL {hud?.level ?? 1}</span>
                <div className="h-1 w-16 overflow-hidden bg-white/10 md:w-24"><div className="h-full bg-acid" style={{ width: `${Math.min(100, ((hud?.xp ?? 0) / (hud?.xpNext ?? 500)) * 100)}%` }} /></div>
                {hud && hud.skillPoints > 0 && (
                  <span className="flex items-center gap-0.5 border border-[#c47dff]/40 px-1 py-0.5 font-mono-ui text-[7px] text-[#c47dff]"><Gem className="h-2 w-2" />{hud.skillPoints}</span>
                )}
              </div>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-acid/40 bg-acid/10 font-display text-sm font-bold text-acid md:h-9 md:w-9 md:text-lg">
              {hud?.level ?? 1}
            </div>
          </div>
          <WantedStars wanted={hud?.wanted ?? 0} reason={hud?.wantedReason ?? ""} />
          <div className="pointer-events-auto mt-2 hidden items-center gap-1 md:flex">
            {navButtons.map((b) => (
              <button
                key={b.id}
                onClick={() => setOverlay(b.id)}
                title={`${b.label} (${b.hotkey})`}
                className="group relative flex h-8 w-8 items-center justify-center border border-white/10 bg-black/50 text-zinc-400 backdrop-blur-sm transition hover:border-acid/50 hover:text-acid md:h-9 md:w-9"
              >
                <b.icon className="h-3.5 w-3.5" />
                <span className="absolute -bottom-3 hidden font-mono-ui text-[7px] text-zinc-600 group-hover:block">{b.hotkey}</span>
              </button>
            ))}
            <button onClick={() => setOverlay("pause")} title="Pause (Esc)" className="flex h-8 w-8 items-center justify-center border border-white/10 bg-black/50 text-zinc-400 transition hover:border-white/40 hover:text-white md:h-9 md:w-9">
              <Menu className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => api?.toggleMute()} title="Sound" className="flex h-8 w-8 items-center justify-center border border-white/10 bg-black/50 text-zinc-400 transition hover:text-white md:h-9 md:w-9">
              {hud?.muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="pointer-events-auto mt-2 flex items-center gap-1 md:hidden">
            <button onClick={() => setOverlay("loadout")} className="flex h-8 w-8 items-center justify-center border border-white/10 bg-black/55 text-zinc-300" aria-label="Loadout">
              <Wrench className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setOverlay("loadout")} className="flex h-8 items-center gap-1 border border-[#c47dff]/30 bg-black/55 px-2 text-[#c47dff]" aria-label="Skill points">
              <Gem className="h-3 w-3" /><span className="font-mono-ui text-[9px] font-bold">{hud?.skillPoints ?? 0}</span>
            </button>
            <button onClick={() => setOverlay("pause")} className="flex h-8 w-8 items-center justify-center border border-white/10 bg-black/55 text-zinc-300" aria-label="Pause">
              <Menu className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* mission tracker / free roam hint */}
        <div className={`absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 ${hud?.mission ? "top-[104px] w-[min(430px,calc(100vw-1.5rem))] md:top-5 md:w-[min(460px,52vw)]" : "top-3 hidden w-[min(440px,calc(100vw-10rem))] md:top-5 md:flex"}`}>
          {hud?.mission ? (
            <div className="glass relative w-full overflow-hidden border-acid/25 px-3.5 py-2.5 shadow-[0_10px_40px_-16px_rgba(0,0,0,.9)]">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-acid via-acid/40 to-transparent" />
              <div className="flex items-center gap-2">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-acid text-[8px] font-black text-black">
                  {hud.mission.stepIndex + 1}
                </span>
                <span className="truncate font-display text-base font-bold uppercase leading-none tracking-wide">{hud.mission.title}</span>
                <span className="ml-auto flex shrink-0 items-center gap-1 font-mono-ui text-[8px] uppercase tracking-wider text-acid">
                  <Navigation className="h-2.5 w-2.5" /> {missionDistance}m
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="truncate text-[11px] text-zinc-300">{hud.mission.step}</span>
                <span className="ml-auto shrink-0 font-mono-ui text-[8px] uppercase tracking-wider text-zinc-500">
                  {hud.mission.kind === "eliminate" || hud.mission.kind === "collect"
                    ? `${Math.round(hud.mission.progress)}/${Math.round(hud.mission.progressMax)}`
                    : hud.mission.kind === "survive"
                    ? `${Math.max(0, Math.ceil(hud.mission.progressMax - hud.mission.progress))}s`
                    : `STEP ${hud.mission.stepIndex + 1}/${hud.mission.stepCount}`}
                </span>
              </div>
              <div className="mt-2 h-0.5 w-full bg-white/10">
                <div className="h-full bg-acid" style={{ width: `${Math.min(100, (hud.mission.progress / Math.max(1, hud.mission.progressMax)) * 100)}%`, boxShadow: "0 0 8px #c8ff3d" }} />
              </div>
            </div>
          ) : (
            <div className="glass-soft hidden items-center gap-2 px-3 py-1.5 font-mono-ui text-[8px] uppercase tracking-[0.16em] text-zinc-400 md:flex">
              <Sparkles className="h-3 w-3 text-acid" /> Free roam · <span className="text-white">Tab</span> for contracts
            </div>
          )}
          {hud && hud.boosts.length > 0 && (
            <div className="flex gap-1.5">
              {hud.boosts.map((b) => (
                <div key={b.name} className="flex items-center gap-1.5 border border-hot/40 bg-hot/10 px-2 py-1 font-mono-ui text-[8px] uppercase tracking-wider text-hot">
                  <Zap className="h-2.5 w-2.5" /> {b.name} {b.seconds}s
                </div>
              ))}
            </div>
          )}
        </div>

        {/* interaction prompt */}
        {hud?.interaction && (
          <div className="absolute bottom-[196px] left-1/2 w-[min(300px,calc(100vw-2rem))] -translate-x-1/2 md:bottom-[112px] md:w-auto">
            <button onClick={() => api?.interact()} className="pointer-events-auto cut-corner-sm flex w-full items-center gap-2 border border-white/20 bg-black/75 px-3 py-2 backdrop-blur-sm transition hover:border-acid/60 md:w-auto md:gap-2.5 md:px-4 md:py-2.5">
              <span className="flex h-6 w-6 items-center justify-center border border-acid/50 bg-acid/15 font-mono-ui text-[10px] font-bold text-acid">E</span>
              <span className="font-mono-ui text-[10px] uppercase tracking-[0.14em] text-zinc-200">{hud.interaction.replace("E — ", "")}</span>
              <ArrowRight className="h-3.5 w-3.5 text-zinc-500" />
            </button>
          </div>
        )}

        {/* vitals */}
        <div className={`absolute bottom-[142px] left-2.5 w-[134px] md:bottom-5 md:left-5 md:top-auto md:w-auto ${hud?.inVehicle ? "md:bottom-[92px]" : ""}`}>
          <div className={`glass cut-corner-sm w-full px-2.5 py-2 md:w-[230px] md:px-3 md:py-2.5 ${lowHealth ? "border-red-500/40" : ""}`}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-mono-ui text-[9px] uppercase tracking-[0.16em] text-zinc-500"><Heart className={`h-3 w-3 ${lowHealth ? "text-red-400" : "text-acid"}`} /> Health</span>
              <span className={`font-mono-ui text-[10px] font-bold ${lowHealth ? "text-red-400" : "text-white"}`}>{hud?.health ?? 100}</span>
            </div>
            <Meter value={hud?.health ?? 100} max={hud?.maxHealth ?? 100} color={lowHealth ? "#ff4d5e" : "#c8ff3d"} className="mt-1" />
            <div className="mt-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-mono-ui text-[9px] uppercase tracking-[0.16em] text-zinc-500"><Shield className="h-3 w-3 text-cyan-300" /> Armor</span>
              <span className="font-mono-ui text-[10px] font-bold text-cyan-200">{hud?.armor ?? 0}</span>
            </div>
            <Meter value={hud?.armor ?? 0} max={hud?.maxArmor ?? 50} color="#2ad9ff" className="mt-1" height={4} />
            <div className="mt-2 hidden items-center gap-2 md:flex">
              <button onClick={() => api?.useMedkit()} className="pointer-events-auto flex items-center gap-1 border border-white/10 bg-white/[0.04] px-1.5 py-1 transition hover:border-acid/40">
                <Crosshair className="h-2.5 w-2.5 text-acid" />
                <span className="font-mono-ui text-[8px] font-bold text-zinc-300">{hud?.medkits ?? 0} MED</span>
                <span className="border-l border-white/15 pl-1 font-mono-ui text-[7px] text-zinc-500">H</span>
              </button>
              <button onClick={() => setOverlay("loadout")} className="pointer-events-auto flex items-center gap-1 border border-white/10 bg-white/[0.04] px-1.5 py-1 transition hover:border-acid/40">
                <Gem className="h-2.5 w-2.5 text-[#c47dff]" />
                <span className="font-mono-ui text-[8px] font-bold text-zinc-300">{hud?.skillPoints ?? 0} SP</span>
              </button>
              <span className="ml-auto font-mono-ui text-[7px] uppercase tracking-wider text-zinc-600">Squad {hud?.enemiesRemaining ?? 0}</span>
            </div>
          </div>
        </div>

        {/* weapons + vehicle */}
        <div className="absolute bottom-3 right-3 hidden flex-col items-end gap-2 md:bottom-5 md:right-5 md:flex">
          {hud && <VehicleHud hud={hud} />}
          {hud && <WeaponHud hud={hud} api={api} />}
        </div>

        {/* crosshair & centre hints */}
        <CrosshairView hitAt={hitAt} />
        <div className="absolute bottom-3 left-1/2 hidden -translate-x-1/2 items-center gap-3 font-mono-ui text-[8px] uppercase tracking-[0.14em] text-white/25 lg:flex">
          <span className="flex items-center gap-1"><MousePointer2 className="h-2.5 w-2.5" /> Click to capture mouse</span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <span>Esc menu</span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <span>V {VEHICLES[hud?.inVehicle?.kind ?? "sports"].cls}</span>
        </div>

        {/* mobile controls */}
        <div className="ow-mobile-controls md:hidden">
          <div className="absolute bottom-3 left-2.5">
            <div className="ow-joystick"><Joystick api={api} /></div>
          </div>
          <div className="ow-action-stack absolute bottom-3 right-3 flex flex-col items-end gap-2">
            {hud && (
              <div className="pointer-events-auto mb-1 flex items-center gap-1">
                <span className="border border-white/15 bg-black/60 px-2 py-1 font-mono-ui text-[9px] text-zinc-300">
                  {hud.ammo < 0 ? "∞" : hud.ammo} / {hud.reserve < 0 ? "∞" : hud.reserve}
                </span>
                <button onClick={() => setOverlay("missions")} className="flex h-8 w-8 items-center justify-center border border-white/15 bg-black/60 text-acid" aria-label="Contracts"><Crosshair className="h-4 w-4" /></button>
                <button onClick={() => setOverlay("garage")} className="flex h-8 w-8 items-center justify-center border border-white/15 bg-black/60 text-zinc-300" aria-label="Garage"><Car className="h-4 w-4" /></button>
                <button onClick={() => setOverlay("map")} className="flex h-8 w-8 items-center justify-center border border-white/15 bg-black/60 text-zinc-300" aria-label="Map"><MapIcon className="h-4 w-4" /></button>
                
                <button onClick={() => setOverlay("loadout")} className="flex h-8 w-8 items-center justify-center border border-white/15 bg-black/60 text-zinc-300" aria-label="Weapons"><Target className="h-4 w-4" /></button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-2">
                <ActionButton icon={ChevronUp} label="Jump" onDown={() => api?.setVirtualInput("Space", true)} onUp={() => api?.setVirtualInput("Space", false)} />
                <ActionButton icon={Wrench} label="Use" onDown={() => api?.interact()} />
              </div>
              <div className="flex flex-col gap-2">
                <ActionButton icon={Gauge} label="Boost" onDown={() => api?.setVirtualInput("ShiftLeft", true)} onUp={() => api?.setVirtualInput("ShiftLeft", false)} />
                <ActionButton icon={Target} label="Reload" onDown={() => api?.setVirtualInput("KeyR", true)} onUp={() => api?.setVirtualInput("KeyR", false)} />
              </div>
              <ActionButton icon={Crosshair} label="Fire" big onDown={() => api?.fireDown()} onUp={() => api?.fireUp()} active />
            </div>
          </div>
        </div>
      </div>

      <Toasts toasts={toasts} />

      {/* mission / level splash */}
      {splash && (
        <div className="pointer-events-none fixed inset-x-0 top-[22%] z-[65] flex justify-center">
          <div className="animate-fade-up relative overflow-hidden border border-acid/30 bg-black/85 px-8 py-5 text-center backdrop-blur-md">
            <div className="absolute inset-x-0 top-0 h-px bg-acid" />
            <div className="font-mono-ui text-[9px] uppercase tracking-[0.32em] text-acid">{splash.kind === "mission" ? "Contract complete" : "Level up"}</div>
            <div className="mt-2 font-display text-4xl font-black uppercase leading-none tracking-wide md:text-5xl">{splash.title}</div>
            {splash.body && <div className="mt-2 font-mono-ui text-sm text-zinc-300">{splash.body}</div>}
            {splash.value !== undefined && <div className="mt-1 font-display text-3xl font-bold text-acid">{money(splash.value)}</div>}
          </div>
        </div>
      )}

      {overlay === "missions" && <MissionsPanel hud={hud} api={api} onClose={() => setOverlay(null)} />}
      {overlay === "map" && <MapPanel hud={hud} api={api} onClose={() => setOverlay(null)} />}
      {overlay === "garage" && <GaragePanel hud={hud} api={api} onClose={() => setOverlay(null)} />}
      {overlay === "loadout" && <LoadoutPanel hud={hud} api={api} onClose={() => setOverlay(null)} />}
      {overlay === "help" && <HelpPanel onClose={() => setOverlay(null)} />}
      {overlay === "pause" && (
        <PausePanel hud={hud} api={api} onClose={() => setOverlay(null)} onHelp={() => setOverlay("help")} onExit={onExit} />
      )}

      {hud?.dead && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-black/80">
          <div className="pointer-events-none absolute inset-0 noise" style={{ background: "radial-gradient(80% 80% at 50% 45%, rgba(120,10,15,.4), rgba(0,0,0,.94))" }} />
          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(to_bottom,transparent,transparent_3px,rgba(255,255,255,.02)_3px,rgba(255,255,255,.02)_4px)]" />
          <div className="relative flex flex-col items-center px-6 text-center">
            <Skull className="mb-4 h-10 w-10 text-red-500/70" />
            <div className="animate-wasted font-display text-[clamp(64px,14vw,140px)] font-black uppercase leading-none tracking-[0.12em] text-red-500" style={{ textShadow: "0 0 60px rgba(255,20,40,.45)" }}>
              Wasted
            </div>
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-zinc-400">
              The city keeps a tab. St. Jude will patch you up, but the medical fee comes out of your pocket.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => {
                  setOverlay(null);
                  api?.respawn();
                }}
                className="pointer-events-auto btn-acid cut-corner px-8 py-3.5 text-xs uppercase tracking-[0.16em]"
              >
                <Heart className="h-4 w-4" /> Respawn at hospital
              </button>
              <button onClick={onExit} className="pointer-events-auto btn-ghost cut-corner px-6 py-3.5 text-xs uppercase tracking-[0.14em]">
                Exit to menu
              </button>
            </div>
            <div className="mt-5 font-mono-ui text-[9px] uppercase tracking-[0.2em] text-zinc-600">10% cash penalty · stash keeps skills & gear</div>
          </div>
        </div>
      )}
    </>
  );
}
