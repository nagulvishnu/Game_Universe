import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, Play, Shield, Sparkles, TriangleAlert } from "lucide-react";
import Landing from "./components/Landing";
import GameCanvas from "./components/GameCanvas";
import HUD, { type Splash, type ToastItem } from "./components/HUD";
import type { Overlay } from "./components/Panels";
import type { GameApi, GameEvent } from "./game/Game";
import type { DistrictId, HudState } from "./game/data";
import { districtById } from "./game/data";

type Phase = "landing" | "game";

const BOOT_TIPS = [
  "Click the viewport to capture the mouse. Esc always gets you out.",
  "Planes need speed before they need altitude. The Foundry runway is longest.",
  "Pink pickups grant Overdrive. Purple shards grant permanent skill points.",
  "The Rhino is parked in the Foundry. Nobody has ever asked for permission.",
  "Killing civilians brings police. Losing the heat takes patience.",
  "Every district has a garage hotkey — press G anywhere for a delivery.",
];

export default function App() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [hud, setHud] = useState<HudState | null>(null);
  const [api, setApi] = useState<GameApi | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [hitAt, setHitAt] = useState(0);
  const [damageAt, setDamageAt] = useState(0);
  const [splash, setSplash] = useState<Splash | null>(null);
  const [booting, setBooting] = useState(false);
  const [bootPct, setBootPct] = useState(0);
  const [bootTip, setBootTip] = useState(0);
  const pendingDistrict = useRef<DistrictId | null>(null);
  const district = pendingDistrict.current ?? "downtown";
  const toastId = useRef(0);
  const splashTimer = useRef<number | null>(null);

  const pushToast = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { ...toast, id }].slice(-4));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5200);
  }, []);

  const onHud = useCallback((state: HudState) => setHud(state), []);

  const onToast = useCallback(
    (toast: { title: string; body?: string; tone?: ToastItem["tone"] }) => {
      pushToast(toast);
    },
    [pushToast]
  );

  const onEvent = useCallback(
    (event: GameEvent) => {
      switch (event.type) {
        case "hitmarker":
          setHitAt(Date.now());
          break;
        case "damage":
          setDamageAt(Date.now());
          break;
        case "wasted":
          setOverlay(null);
          break;
        case "missionComplete":
          if (splashTimer.current) window.clearTimeout(splashTimer.current);
          setSplash({ title: "Contract complete", body: event.title, value: event.value, kind: "mission" });
          splashTimer.current = window.setTimeout(() => setSplash(null), 4600);
          break;
        case "levelUp":
          if (splashTimer.current) window.clearTimeout(splashTimer.current);
          setSplash({ title: `Level ${event.value}`, body: event.body, kind: "level" });
          splashTimer.current = window.setTimeout(() => setSplash(null), 3600);
          break;
        default:
          break;
      }
    },
    []
  );

  const onReady = useCallback((gameApi: GameApi) => setApi(gameApi), []);

  const startGame = useCallback((chosen?: DistrictId) => {
    pendingDistrict.current = chosen ?? null;
    setPhase("game");
    setBooting(true);
    setBootPct(6);
    setBootTip(Math.floor(Math.random() * BOOT_TIPS.length));
    setOverlay(null);
    setSplash(null);
    setHud(null);
    setToasts([]);
  }, []);

  const exitGame = useCallback(() => {
    setPhase("landing");
    setOverlay(null);
    setBooting(false);
    setHud(null);
    setApi(null);
    setSplash(null);
    setToasts([]);
    if (splashTimer.current) window.clearTimeout(splashTimer.current);
  }, []);

  // pause whenever an overlay / boot screen is up
  useEffect(() => {
    api?.setPaused(phase !== "game" || booting || overlay !== null);
  }, [api, phase, booting, overlay]);

  // fast-travel to the district chosen on the landing page once the city is ready
  useEffect(() => {
    if (!api || booting || !pendingDistrict.current) return;
    const target = pendingDistrict.current;
    pendingDistrict.current = null;
    api.fastTravel(target);
  }, [api, booting]);

  // boot progress
  useEffect(() => {
    if (!booting) return;
    let pct = 6;
    const interval = window.setInterval(() => {
      pct = Math.min(94, pct + 3 + Math.random() * 9);
      setBootPct(pct);
    }, 130);
    const finish = window.setTimeout(() => setBootPct(100), 2250);
    const done = window.setTimeout(() => setBooting(false), 2800);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(finish);
      window.clearTimeout(done);
    };
  }, [booting]);

  // keyboard shortcuts for city interfaces
  useEffect(() => {
    if (phase !== "game") return;
    const handler = (e: KeyboardEvent) => {
      if (hud?.dead) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Escape") {
        e.preventDefault();
        setOverlay((current) => (current ? null : "pause"));
        return;
      }
      if (booting) return;
      if (e.code === "Tab") {
        e.preventDefault();
        setOverlay((current) => (current === "missions" ? null : "missions"));
      } else if (e.code === "KeyM") {
        setOverlay((current) => (current === "map" ? null : "map"));
      } else if (e.code === "KeyG") {
        setOverlay((current) => (current === "garage" ? null : "garage"));
      } else if (e.code === "KeyI") {
        setOverlay((current) => (current === "loadout" ? null : "loadout"));
      } else if (e.code === "Slash" || e.code === "F1") {
        e.preventDefault();
        setOverlay((current) => (current === "help" ? null : "help"));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, booting, hud?.dead]);

  useEffect(() => {
    return () => {
      if (splashTimer.current) window.clearTimeout(splashTimer.current);
    };
  }, []);

  if (phase === "landing") {
    return <Landing onPlay={startGame} />;
  }

  const bootDistrict = districtById(district);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#07090b]">
      <GameCanvas onHud={onHud} onToast={onToast} onEvent={onEvent} onReady={onReady} />
      <HUD
        hud={hud}
        api={api}
        toasts={toasts}
        overlay={overlay}
        setOverlay={setOverlay}
        onExit={exitGame}
        hitAt={hitAt}
        damageAt={damageAt}
        splash={splash}
      />

      {booting && (
        <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#07090b]">
          <img src="/images/hero.jpg" alt="" className="absolute inset-0 h-full w-full scale-105 object-cover opacity-30 blur-[2px]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#07090b_0%,rgba(7,9,11,.86)_45%,rgba(7,9,11,.7)_100%)]" />
          <div className="pointer-events-none absolute inset-0 noise" />
          <div className="relative flex flex-1 flex-col justify-between px-6 py-8 sm:px-10 lg:px-16">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center bg-acid clip-corner-sm">
                  <span className="font-display text-2xl font-black text-[#0a0e07]">H</span>
                </div>
                <div>
                  <div className="font-display text-xl font-extrabold uppercase leading-none tracking-[0.16em]">Havoc City</div>
                  <div className="mt-1 font-mono-ui text-[8px] uppercase tracking-[0.3em] text-zinc-500">Open world sandbox</div>
                </div>
              </div>
              <div className="flex items-center gap-2 font-mono-ui text-[9px] uppercase tracking-[0.2em] text-zinc-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-acid" /> Streaming district grid
              </div>
            </div>

            <div className="mx-auto w-full max-w-[620px]">
              <div className="flex items-center gap-2 font-mono-ui text-[9px] uppercase tracking-[0.26em] text-acid">
                <span className="h-px w-8 bg-acid" /> Deploying operator
              </div>
              <h1 className="mt-4 font-display text-[clamp(52px,9vw,110px)] font-black uppercase leading-[0.84]">
                Entering
                <br />
                <span style={{ color: bootDistrict.color }}>{bootDistrict.short}.</span>
              </h1>
              <p className="mt-4 max-w-md text-sm text-zinc-400">{bootDistrict.tagline}</p>
              <div className="mt-8 flex items-center justify-between font-mono-ui text-[9px] uppercase tracking-[0.2em] text-zinc-500">
                <span>Building city · spawning traffic · arming NPCs</span>
                <span className="text-white">{Math.round(bootPct)}%</span>
              </div>
              <div className="mt-2 h-1 w-full overflow-hidden bg-white/10">
                <div className="h-full bg-acid transition-all duration-300" style={{ width: `${bootPct}%`, boxShadow: "0 0 18px #c8ff3d" }} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  ["District", bootDistrict.short],
                  ["Time", "21:40 · Dusk"],
                  ["Weather", "Clear, 24°C"],
                ].map(([k, v]) => (
                  <div key={k} className="border border-white/10 bg-white/[0.03] px-3 py-2">
                    <div className="font-mono-ui text-[8px] uppercase tracking-[0.18em] text-zinc-500">{k}</div>
                    <div className="mt-1 truncate font-display text-base font-semibold uppercase">{v}</div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-start gap-3 border border-white/10 bg-black/40 px-4 py-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-acid" />
                <div>
                  <div className="font-mono-ui text-[8px] uppercase tracking-[0.2em] text-zinc-500">Field note</div>
                  <div className="mt-1 text-xs text-zinc-300">{BOOT_TIPS[bootTip]}</div>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setBooting(false)}
                  className="btn-acid cut-corner-sm px-5 py-2.5 text-[11px] uppercase tracking-[0.14em]"
                >
                  <Play className="h-3.5 w-3.5 fill-current" /> Skip intro
                </button>
                <div className="flex items-center gap-2 font-mono-ui text-[9px] uppercase tracking-[0.16em] text-zinc-500">
                  <Shield className="h-3.5 w-3.5 text-acid" /> Progress auto-saves to this device
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 font-mono-ui text-[9px] uppercase tracking-[0.18em] text-zinc-600">
              <span className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-400" /> Renderer ready · WebGL</span>
              <span className="flex items-center gap-2"><TriangleAlert className="h-3 w-3 text-amber-400" /> Fictional city. Fictional crimes.</span>
              <span>Build 1.0.4</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
