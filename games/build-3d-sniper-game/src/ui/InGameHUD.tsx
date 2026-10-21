import React, { useEffect, useRef, useState } from 'react';
import {
  Crosshair,
  Eye,
  Heart,
  Pause,
  Radio,
  RotateCcw,
  ShieldAlert,
  Smartphone,
  Target,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react';
import { AMMO_TYPES, getEquipmentById } from '../data/customization';
import { liveInput } from '../game/inputState';
import { GameSettings, HudSnapshot, MissionDefinition } from '../types/game';

interface InGameHUDProps {
  hud: HudSnapshot;
  mission: MissionDefinition;
  settings: GameSettings;
  onPause: () => void;
  onToggleMute: () => void;
}

export const InGameHUD: React.FC<InGameHUDProps> = ({
  hud,
  mission,
  settings,
  onPause,
  onToggleMute,
}) => {
  const [manualTouchShow, setManualTouchShow] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const showTouch =
    settings.showTouchControls === 'always' ||
    manualTouchShow ||
    (settings.showTouchControls === 'auto' && isTouchDevice);

  const hitAge = hud.hitMarker ? Date.now() - hud.hitMarker.timestamp : 9999;
  const showHitMarker = hitAge < 280;

  // Compute screen-space pixel offset for ballistic drop + windage reticle helper inside scope
  // FOV vertical rad = (65 / zoom) * PI / 180
  const fovRad = ((65 / Math.max(1, hud.currentZoom)) * Math.PI) / 180;
  const viewH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const radDrop = hud.dropCompensationMils / 1000;
  const radWind = hud.windDriftMils / 1000;
  const dropPx = Math.min(220, (radDrop / Math.tan(fovRad / 2)) * (viewH / 2));
  const windPx = Math.max(-180, Math.min(180, (radWind / Math.tan(fovRad / 2)) * (viewH / 2)));

  // Touch thumbstick state refs
  const moveTouchId = useRef<number | null>(null);
  const moveOrigin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [stickOffset, setStickOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  return (
    <div className="fixed inset-0 pointer-events-none select-none z-20 overflow-hidden">
      {/* Low-Light NVG / Thermal Fullscreen Filter Tint when Scoped */}
      {hud.isScoped && hud.opticType === 'lowlight' && (
        <div className="fixed inset-0 bg-emerald-500/18 mix-blend-screen scanline-overlay" />
      )}
      {hud.isScoped && hud.opticType === 'thermal' && (
        <div className="fixed inset-0 bg-indigo-950/25 scanline-overlay" />
      )}

      {/* Red Damage Vignette Flash */}
      {hud.damageFlashTime > 0 && (
        <div
          className="fixed inset-0 transition-opacity duration-150"
          style={{
            background:
              'radial-gradient(circle at center, transparent 52%, rgba(220, 38, 38, 0.55) 100%)',
            opacity: Math.min(1, hud.damageFlashTime * 2.4),
          }}
        />
      )}

      {/* === RECON BINOCULARS OVERLAY === */}
      {hud.isBinoculars && (
        <div className="fixed inset-0 flex items-center justify-center">
          <div
            className="w-[min(86vw,780px)] h-[min(72vh,500px)] rounded-[140px] border-2 border-emerald-400/50 relative flex items-center justify-center"
            style={{
              boxShadow: '0 0 0 9999px rgba(4, 9, 14, 0.88)',
            }}
          >
            <div className="w-8 h-8 border border-emerald-400/80 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
            </div>
            <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-6 text-xs font-mono text-emerald-300 bg-black/60 px-4 py-1.5 rounded-full border border-emerald-500/30">
              <span>RECON OPTIC 10.0x</span>
              <span>RANGE: {hud.rangefinderMeters}M</span>
              <span>AUTO-TAGGING ACTIVE</span>
            </div>
            <div className="absolute bottom-6 text-[11px] font-mono text-emerald-300/80">
              SWEEP HOSTILES TO PERMANENTLY MARK ON TACTICAL RADAR • PRESS [Q] TO EXIT
            </div>
          </div>
        </div>
      )}

      {/* === SNIPER SCOPE RETICLE OVERLAY === */}
      {hud.isScoped && !hud.killcamActive && (
        <div className="fixed inset-0 flex items-center justify-center">
          <div
            className="relative rounded-full border-2 border-zinc-600/80 flex items-center justify-center"
            style={{
              width: 'min(88vh, 88vw)',
              height: 'min(88vh, 88vw)',
              boxShadow: '0 0 0 9999px rgba(3, 5, 8, 0.94), inset 0 0 48px rgba(0,0,0,0.85)',
            }}
          >
            {/* Thin Horizontal & Vertical Stadia Hairlines */}
            <div className="absolute inset-x-0 h-[1px] bg-zinc-200/75" />
            <div className="absolute inset-y-0 w-[1px] bg-zinc-200/75" />

            {/* Mil-Dot Calibration Ticks */}
            {[-120, -90, -60, -30, 30, 60, 90, 120].map((offset) => (
              <React.Fragment key={offset}>
                <div
                  className="absolute w-1.5 h-1.5 rounded-full bg-zinc-100/80 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `calc(50% + ${offset}px)`, top: '50%' }}
                />
                <div
                  className="absolute w-2.5 h-[1px] bg-zinc-100/80 -translate-x-1/2"
                  style={{ left: '50%', top: `calc(50% + ${offset}px)` }}
                />
              </React.Fragment>
            ))}

            {/* Horus Grid Extra Holdover Matrix */}
            {hud.reticleStyle === 'horus_grid' &&
              [40, 80, 120].map((rowY) =>
                [-60, -30, 30, 60].map((colX) => (
                  <div
                    key={`${rowY}_${colX}`}
                    className="absolute w-1 h-1 rounded-full bg-amber-400/70 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `calc(50% + ${colX}px)`, top: `calc(50% + ${rowY}px)` }}
                  />
                ))
              )}

            {/* Center Aim Point per Reticle Style */}
            {hud.reticleStyle === 'chevron' ? (
              <div className="w-3 h-3 border-t-2 border-l-2 border-red-500 rotate-45 translate-y-1" />
            ) : (
              <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
            )}

            {/* Dynamic Ballistic Impact Diamond (Shows true bullet drop + wind impact point!) */}
            {(settings.showTrajectoryHelper ||
              hud.isHoldingBreath ||
              hud.currentAmmoType === 'training') &&
              hud.rangefinderMeters > 35 && (
                <div
                  className="w-3.5 h-3.5 border-2 border-rose-500 rotate-45 -translate-x-1/2 -translate-y-1/2 transition-transform duration-75 shadow-[0_0_8px_rgba(244,63,94,0.85)]"
                  style={{
                    position: 'absolute',
                    left: `calc(50% + ${windPx}px)`,
                    top: `calc(50% + ${dropPx}px)`,
                  }}
                  title="Ballistic Impact Point"
                />
              )}

            {/* Digital Telemetry Readouts Inside Scope Rim */}
            <div className="absolute top-[14%] flex items-center gap-4 bg-zinc-950/80 border border-zinc-700/60 px-3.5 py-1 rounded text-[11px] font-mono text-amber-300">
              <span>DIST: {hud.rangefinderMeters}M</span>
              <span>ZOOM: {hud.currentZoom}x</span>
              <span>
                WIND: {hud.windX >= 0 ? '+' : ''}
                {hud.windX.toFixed(1)} m/s {hud.windX >= 0 ? '→' : '←'}
              </span>
              <span className="text-white">
                AMMO: {hud.isReloading ? 'RLD' : `${hud.ammoInMag} / ${hud.reserveAmmo}`}
              </span>
            </div>

            <div className="absolute bottom-[13%] flex flex-col items-center gap-1">
              <div className="text-[11px] font-mono text-zinc-300 bg-black/70 px-3 py-0.5 rounded border border-zinc-800">
                {hud.isHoldingBreath ? (
                  <span className="text-cyan-400 font-semibold">
                    ● LUNGS STEADIED ({hud.stamina}%) — DIAMOND SHOWS EXACT IMPACT
                  </span>
                ) : (
                  <span>HOLD [SHIFT] OR [SPACE] TO STEADY BREATH • SCROLL WHEEL ZOOM</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unscoped Center Crosshair */}
      {!hud.isScoped && !hud.isBinoculars && !hud.killcamActive && (
        <div className="fixed inset-0 flex items-center justify-center">
          <div className="relative w-7 h-7 flex items-center justify-center opacity-80">
            <div className="w-1 h-1 bg-amber-400 rounded-full" />
            <div className="absolute top-0 w-[1.5px] h-2 bg-white/80" />
            <div className="absolute bottom-0 w-[1.5px] h-2 bg-white/80" />
            <div className="absolute left-0 h-[1.5px] w-2 bg-white/80" />
            <div className="absolute right-0 h-[1.5px] w-2 bg-white/80" />
          </div>
        </div>
      )}

      {/* Dynamic Hit Marker */}
      {showHitMarker && hud.hitMarker && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
          <Crosshair
            className={`w-9 h-9 transition-transform scale-110 ${
              hud.hitMarker.type === 'headshot'
                ? 'text-red-500 drop-shadow-[0_0_10px_#ef4444]'
                : hud.hitMarker.type === 'armor'
                ? 'text-sky-400'
                : 'text-amber-300'
            }`}
          />
          {hud.hitMarker.type === 'headshot' && (
            <span className="absolute mt-14 text-xs font-black tracking-widest text-red-400 bg-black/75 px-2.5 py-0.5 rounded border border-red-500/40">
              CRITICAL HEADSHOT!
            </span>
          )}
        </div>
      )}

      {/* Bullet-Time Cinematic Killcam Banner */}
      {hud.killcamActive && (
        <div className="fixed inset-x-0 top-10 flex flex-col items-center pointer-events-none">
          <div className="bg-red-950/85 border border-red-500/60 px-6 py-2 rounded-md shadow-2xl text-center">
            <div className="text-[11px] font-mono tracking-[0.25em] text-red-300">
              BULLET-TIME BALLISTIC REPLAY
            </div>
            <div className="text-lg font-black tracking-wider text-white">
              LETHAL IMPACT — {hud.killcamDistance} METERS
            </div>
          </div>
        </div>
      )}

      {/* === TOP BAR: STEALTH DETECTION METER, COMPASS, TIMER & CONTROLS === */}
      <div className="fixed top-3 inset-x-4 flex items-start justify-between gap-4">
        {/* Top-Left: Minimap Radar + Active Mission Objectives */}
        <div className="flex flex-col gap-2.5 max-w-xs">
          <div className="flex items-center gap-3">
            {/* Circular Tactical Radar Minimap */}
            <div className="w-28 h-28 rounded-full bg-zinc-950/85 border border-zinc-700/80 relative overflow-hidden shrink-0 shadow-lg">
              <div className="absolute inset-3 rounded-full border border-zinc-800" />
              <div className="absolute inset-7 rounded-full border border-zinc-800/70" />
              {/* Player Center Arrow */}
              <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_6px_#22d3ee]" />
              {hud.minimapBlips.map((b) => {
                // Relative offset rotated into player camera space
                const dx = b.x - hud.playerX;
                const dz = b.z - hud.playerZ;
                const cos = Math.cos(-hud.playerYaw);
                const sin = Math.sin(-hud.playerYaw);
                const rx = dx * cos - dz * sin;
                const rz = dx * sin + dz * cos;
                const scale = 0.24; // 200m fits inside radius 48px
                const px = Math.max(-46, Math.min(46, rx * scale));
                const py = Math.max(-46, Math.min(46, rz * scale));
                const color =
                  b.type === 'extraction'
                    ? 'bg-emerald-400'
                    : b.type === 'hostage'
                    ? 'bg-sky-400'
                    : b.type === 'intel'
                    ? 'bg-cyan-300'
                    : b.type === 'priority'
                    ? 'bg-amber-400'
                    : 'bg-red-500';
                return (
                  <div
                    key={b.id}
                    className={`w-2 h-2 rounded-full ${color} absolute -translate-x-1/2 -translate-y-1/2`}
                    style={{
                      left: `calc(50% + ${px}px)`,
                      top: `calc(50% + ${py}px)`,
                    }}
                  />
                );
              })}
              <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] font-mono text-zinc-400">
                N
              </span>
            </div>

            {/* Mission Objectives Card */}
            {!hud.isScoped && (
              <div className="bg-zinc-950/80 backdrop-blur-md border border-zinc-800/90 rounded-lg px-3.5 py-2.5 shadow-xl min-w-[215px]">
                <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400 flex items-center justify-between">
                  <span>{mission.codeName}</span>
                  {hud.totalWaves > 1 && (
                    <span className="text-cyan-400">
                      WAVE {hud.currentWave}/{hud.totalWaves}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 space-y-1">
                  {hud.objectives.map((obj) => (
                    <div
                      key={obj.id}
                      className={`text-xs flex items-center justify-between gap-2 ${
                        obj.completed
                          ? 'text-emerald-400 line-through opacity-80'
                          : obj.failed
                          ? 'text-red-400 line-through'
                          : obj.optional
                          ? 'text-zinc-300'
                          : 'text-zinc-100 font-medium'
                      }`}
                    >
                      <span className="truncate">{obj.title}</span>
                      <span className="font-mono text-[11px] shrink-0">
                        {obj.current}/{obj.target}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top-Center: Detection Status, Wind & Boss Bar */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-3 bg-zinc-950/85 border border-zinc-800 px-4 py-1.5 rounded-full shadow-lg">
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <ShieldAlert
                className={`w-4 h-4 ${
                  hud.alertStatusLabel === 'COMBAT ALERT'
                    ? 'text-red-500 animate-pulse'
                    : hud.alertStatusLabel === 'SEARCHING'
                    ? 'text-amber-400'
                    : hud.alertStatusLabel === 'SUSPICIOUS'
                    ? 'text-yellow-300'
                    : 'text-emerald-400'
                }`}
              />
              <span
                className={
                  hud.alertStatusLabel === 'COMBAT ALERT'
                    ? 'text-red-400 font-bold'
                    : hud.alertStatusLabel === 'UNAWARE'
                    ? 'text-emerald-400'
                    : 'text-amber-300'
                }
              >
                {hud.alertStatusLabel} ({hud.globalAlertLevel}%)
              </span>
            </div>

            <div className="h-3 w-[1px] bg-zinc-700" />

            <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-300">
              <Wind className="w-3.5 h-3.5 text-sky-400" />
              <span>
                {hud.windX >= 0 ? '+' : ''}
                {hud.windX.toFixed(1)}m/s
              </span>
            </div>

            {hud.remainingSeconds !== null && (
              <>
                <div className="h-3 w-[1px] bg-zinc-700" />
                <div
                  className={`text-xs font-mono font-bold ${
                    hud.remainingSeconds < 25 ? 'text-red-400 animate-pulse' : 'text-amber-300'
                  }`}
                >
                  DEADLINE: {Math.floor(hud.remainingSeconds / 60)}:
                  {String(Math.floor(hud.remainingSeconds % 60)).padStart(2, '0')}
                </div>
              </>
            )}
          </div>

          {/* Boss Encounter Health Bar */}
          {hud.bossBar && (
            <div className="w-72 bg-zinc-950/90 border border-red-500/50 rounded-md px-3 py-1.5 shadow-lg">
              <div className="flex justify-between text-[11px] font-mono text-red-200 mb-1">
                <span className="font-bold">{hud.bossBar.name}</span>
                <span className="text-amber-400">{hud.bossBar.stageText}</span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-amber-500 transition-all duration-150"
                  style={{ width: `${(hud.bossBar.hp / hud.bossBar.maxHp) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Top-Right: Live Score, Kill Feed & Quick Buttons */}
        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          <div className="flex items-center gap-2">
            <div className="bg-zinc-950/85 border border-zinc-800 rounded-lg px-3.5 py-1.5 text-right">
              <div className="text-[10px] font-mono text-zinc-400">SCORE</div>
              <div className="text-base font-black font-mono text-amber-400">
                {hud.score.toLocaleString()}
              </div>
            </div>

            <button
              onClick={() => setManualTouchShow((v) => !v)}
              title="Toggle On-Screen Touch Pad"
              className={`p-2.5 rounded-lg border transition ${
                showTouch
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'bg-zinc-900/85 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <Smartphone className="w-4 h-4" />
            </button>

            <button
              onClick={onToggleMute}
              title="Mute / Unmute Audio"
              className="p-2.5 rounded-lg bg-zinc-900/85 border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition"
            >
              {settings.muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onPause}
              title="Pause Menu (Esc)"
              className="px-3 py-2 rounded-lg bg-zinc-900/90 border border-zinc-700 hover:border-amber-500/60 text-xs font-mono text-zinc-100 flex items-center gap-1.5 transition"
            >
              <Pause className="w-4 h-4 text-amber-400" />
              <span>PAUSE</span>
            </button>
          </div>

          {/* Kill Feed */}
          <div className="flex flex-col items-end gap-1 pointer-events-none">
            {hud.killFeed.map((kf) => (
              <div
                key={kf.id}
                className={`px-3 py-1 rounded border text-xs font-mono backdrop-blur-sm ${
                  kf.isHeadshot
                    ? 'bg-red-950/80 border-red-500/50 text-red-200'
                    : 'bg-zinc-950/80 border-zinc-700/70 text-zinc-200'
                }`}
              >
                <span className="font-bold">{kf.text}</span>{' '}
                <span className="text-amber-400">{kf.subtext}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Contextual Interaction Prompt */}
      {hud.interactionPrompt && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 pointer-events-auto">
          <button
            onClick={() => {
              liveInput.interactRequested = true;
            }}
            className="bg-cyan-950/90 border border-cyan-400/70 text-cyan-200 px-5 py-2 rounded-lg font-mono text-xs font-bold shadow-lg animate-bounce"
          >
            {hud.interactionPrompt}
          </button>
        </div>
      )}

      {/* === TAB TACTICAL OVERVIEW OVERLAY === */}
      {hud.tacticalMapOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6 pointer-events-none">
          <div className="bg-zinc-900 border border-amber-500/40 rounded-xl p-6 max-w-xl w-full space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <div>
                <div className="text-xs font-mono text-amber-400">{mission.codeName}</div>
                <h3 className="text-xl font-bold text-white">{mission.title}</h3>
              </div>
              <div className="text-right text-xs font-mono text-zinc-400">
                <div>SHOTS: {hud.shotsFired} | HITS: {hud.shotsHit}</div>
                <div>LONGEST: {hud.longestShot}M</div>
              </div>
            </div>
            <p className="text-sm text-zinc-300">{mission.briefingText}</p>
            <div className="space-y-1.5">
              {hud.objectives.map((o) => (
                <div
                  key={o.id}
                  className="flex justify-between text-xs font-mono bg-zinc-950 px-3 py-2 rounded border border-zinc-800"
                >
                  <span className={o.completed ? 'text-emerald-400' : 'text-zinc-200'}>
                    {o.completed ? '✓ ' : '○ '}
                    {o.title}
                  </span>
                  <span className="text-amber-400">
                    {o.current}/{o.target}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* === BOTTOM HUD BAR: HEALTH, STAMINA, EQUIPMENT, WEAPON & AMMO === */}
      {!hud.killcamActive && (
        <div className="fixed bottom-3 inset-x-4 flex items-end justify-between gap-4">
          {/* Bottom-Left: Health, Breath Stamina & Posture */}
          <div className="bg-zinc-950/85 backdrop-blur-md border border-zinc-800 rounded-xl p-3.5 w-64 shadow-xl pointer-events-auto">
            <div className="flex items-center justify-between text-xs font-mono mb-1">
              <span className="flex items-center gap-1.5 text-zinc-200 font-bold">
                <Heart className="w-3.5 h-3.5 text-red-500" /> HP {hud.health}/{hud.maxHealth}
              </span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => {
                    liveInput.crouchToggleRequested = true;
                  }}
                  className={`px-1.5 py-0.5 rounded text-[10px] border ${
                    hud.isCrouching
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                  }`}
                >
                  {hud.isCrouching ? 'CROUCHED' : 'STANDING'}
                </button>
                <button
                  onClick={() => {
                    liveInput.cameraModeToggleRequested = true;
                  }}
                  className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-900 border border-zinc-700 text-zinc-300 hover:border-amber-500"
                >
                  {hud.isThirdPerson ? '3PP [V]' : '1PP [V]'}
                </button>
              </div>
            </div>

            <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full transition-all duration-150 ${
                  hud.health > 40 ? 'bg-emerald-500' : 'bg-red-500'
                }`}
                style={{ width: `${(hud.health / hud.maxHealth) * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mb-1">
              <span>LUNG / SPRINT STAMINA</span>
              <span>{hud.stamina}%</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-400 transition-all duration-100"
                style={{ width: `${hud.stamina}%` }}
              />
            </div>
          </div>

          {/* Bottom-Center Quick Controls Hint Strip (Desktop) */}
          {!showTouch && !hud.isScoped && (
            <div className="hidden lg:flex items-center gap-3 bg-zinc-950/75 border border-zinc-800/80 px-4 py-2 rounded-lg text-[11px] font-mono text-zinc-400">
              <span>[RMB] Scope</span>
              <span>•</span>
              <span>[LMB] Fire</span>
              <span>•</span>
              <span>[Shift] Steady Breath / Sprint</span>
              <span>•</span>
              <span>[Q] Binoculars</span>
              <span>•</span>
              <span>[1 / 2] Gadgets</span>
              <span>•</span>
              <span>[B] Ammo</span>
            </div>
          )}

          {/* Bottom-Right: Equipment Slots + Weapon & Ammunition Readout */}
          <div className="flex items-end gap-2.5 pointer-events-auto">
            {/* Secondary Equipment Buttons */}
            <div className="flex gap-1.5">
              <button
                onClick={() => {
                  liveInput.binocularsToggleRequested = true;
                }}
                className="bg-zinc-950/85 border border-zinc-800 hover:border-emerald-500 rounded-lg px-2.5 py-2 text-center min-w-[64px]"
              >
                <Eye className="w-4 h-4 mx-auto text-emerald-400" />
                <div className="text-[10px] font-mono text-zinc-300 mt-0.5">[Q] BINO</div>
              </button>

              {hud.activeEquipmentSlots.map((slotId, idx) => {
                const def = getEquipmentById(slotId);
                const charges = hud.equipmentCharges[slotId];
                const cd = Math.ceil(hud.equipmentCooldowns[slotId]);
                return (
                  <button
                    key={slotId}
                    onClick={() => {
                      if (idx === 0) liveInput.equipment1Requested = true;
                      else liveInput.equipment2Requested = true;
                    }}
                    disabled={charges <= 0 || cd > 0}
                    className={`bg-zinc-950/85 border rounded-lg px-2.5 py-2 text-center min-w-[74px] transition ${
                      charges > 0 && cd <= 0
                        ? 'border-zinc-700 hover:border-amber-400 text-zinc-200'
                        : 'border-zinc-900 opacity-50 text-zinc-500'
                    }`}
                  >
                    <Radio className="w-4 h-4 mx-auto text-amber-400" />
                    <div className="text-[10px] font-mono truncate max-w-[68px] mt-0.5">
                      [{idx + 1}] {cd > 0 ? `${cd}s` : `x${charges}`}
                    </div>
                    <div className="text-[9px] text-zinc-400 truncate max-w-[68px]">
                      {def.name.split(' ')[0]}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Weapon & Magazine Card */}
            <div className="bg-zinc-950/85 backdrop-blur-md border border-zinc-800 rounded-xl px-4 py-2.5 min-w-[215px] shadow-xl">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-white truncate">{hud.weaponName}</span>
                {hud.isSuppressed && (
                  <span className="text-[9px] font-mono bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">
                    SUPPRESSED
                  </span>
                )}
              </div>

              <div className="flex items-baseline justify-between mt-1">
                <div className="font-mono">
                  {hud.isReloading ? (
                    <span className="text-sm font-bold text-amber-400 animate-pulse">
                      RELOADING...
                    </span>
                  ) : (
                    <>
                      <span
                        className={`text-2xl font-black ${
                          hud.ammoInMag <= 1 ? 'text-red-400' : 'text-amber-400'
                        }`}
                      >
                        {hud.ammoInMag}
                      </span>
                      <span className="text-sm text-zinc-400"> / {hud.reserveAmmo}</span>
                    </>
                  )}
                </div>

                <button
                  onClick={() => {
                    liveInput.ammoCycleRequested = true;
                  }}
                  className="text-[10px] font-mono bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 px-2 py-1 rounded text-cyan-300"
                  title="Cycle Ammunition Type [B]"
                >
                  [B] {AMMO_TYPES[hud.currentAmmoType]?.shortName ?? 'STD'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === RESPONSIVE TOUCH VIRTUAL CONTROLS (MOBILE & TABLET READY) === */}
      {showTouch && (
        <div className="fixed inset-x-0 bottom-24 pointer-events-none flex items-center justify-between px-6 z-30">
          {/* Left Virtual Thumbstick: Movement */}
          <div
            className="w-32 h-32 rounded-full bg-zinc-900/50 border-2 border-zinc-600/60 pointer-events-auto relative flex items-center justify-center touch-none"
            onTouchStart={(e) => {
              const t = e.changedTouches[0];
              moveTouchId.current = t.identifier;
              moveOrigin.current = { x: t.clientX, y: t.clientY };
            }}
            onTouchMove={(e) => {
              for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if (t.identifier === moveTouchId.current) {
                  const dx = Math.max(-44, Math.min(44, t.clientX - moveOrigin.current.x));
                  const dy = Math.max(-44, Math.min(44, t.clientY - moveOrigin.current.y));
                  setStickOffset({ x: dx, y: dy });
                  liveInput.touchMoveX = dx / 44;
                  liveInput.touchMoveY = -dy / 44;
                  liveInput.touchSprint = Math.hypot(dx, dy) > 38;
                }
              }
            }}
            onTouchEnd={() => {
              moveTouchId.current = null;
              setStickOffset({ x: 0, y: 0 });
              liveInput.touchMoveX = 0;
              liveInput.touchMoveY = 0;
              liveInput.touchSprint = false;
            }}
          >
            <div
              className="w-12 h-12 rounded-full bg-amber-500/70 border border-amber-300 shadow-lg"
              style={{
                transform: `translate(${stickOffset.x}px, ${stickOffset.y}px)`,
              }}
            />
          </div>

          {/* Right Touch Aim Pad + Tactical Action Buttons */}
          <div className="flex items-center gap-3 pointer-events-auto">
            <div className="flex flex-col gap-2">
              <button
                onTouchStart={(e) => {
                  e.preventDefault();
                  liveInput.toggleScopeRequested = true;
                }}
                onClick={() => {
                  liveInput.toggleScopeRequested = true;
                }}
                className="w-16 h-16 rounded-full bg-sky-600/80 border-2 border-sky-300 text-white font-mono text-xs font-bold flex flex-col items-center justify-center shadow-lg active:scale-95"
              >
                <Target className="w-5 h-5" />
                <span>SCOPE</span>
              </button>

              <button
                onTouchStart={() => {
                  liveInput.touchBreathHold = true;
                }}
                onTouchEnd={() => {
                  liveInput.touchBreathHold = false;
                }}
                onMouseDown={() => {
                  liveInput.touchBreathHold = true;
                }}
                onMouseUp={() => {
                  liveInput.touchBreathHold = false;
                }}
                className="px-3 py-2 rounded-lg bg-cyan-800/80 border border-cyan-400 text-[10px] font-mono text-white font-bold"
              >
                STEADY
              </button>

              <button
                onClick={() => {
                  liveInput.reloadRequested = true;
                }}
                className="px-3 py-2 rounded-lg bg-zinc-800/90 border border-zinc-600 text-[10px] font-mono text-amber-300 flex items-center justify-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> RLD
              </button>
            </div>

            {/* Right Swipe Look Zone + Giant FIRE Trigger */}
            <div
              className="w-36 h-36 rounded-2xl bg-zinc-900/40 border border-zinc-700/60 flex items-center justify-center relative touch-none"
              onTouchStart={(e) => {
                const t = e.changedTouches[0];
                lookTouchId.current = t.identifier;
                lastLookPos.current = { x: t.clientX, y: t.clientY };
              }}
              onTouchMove={(e) => {
                for (let i = 0; i < e.changedTouches.length; i++) {
                  const t = e.changedTouches[i];
                  if (t.identifier === lookTouchId.current) {
                    liveInput.lookDeltaX += (t.clientX - lastLookPos.current.x) * 2.2;
                    liveInput.lookDeltaY += (t.clientY - lastLookPos.current.y) * 2.2;
                    lastLookPos.current = { x: t.clientX, y: t.clientY };
                  }
                }
              }}
              onTouchEnd={() => {
                lookTouchId.current = null;
              }}
            >
              <button
                onTouchStart={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  liveInput.fireRequested = true;
                }}
                onClick={() => {
                  liveInput.fireRequested = true;
                }}
                className="w-20 h-20 rounded-full bg-red-600/90 border-2 border-red-300 text-white font-black tracking-wider text-sm shadow-[0_0_20px_rgba(220,38,38,0.6)] active:scale-90 transition"
              >
                FIRE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
