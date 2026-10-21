import { useEffect, useState } from 'react';
import { useStore } from '../game/store';
import { Shield, Heart, Zap, Rocket, Crosshair, AlertTriangle, Gauge, Flame, Star, Target } from 'lucide-react';

function Bar({ frac, color, glow, h = 'h-2.5' }: { frac: number; color: string; glow: string; h?: string }) {
  return (
    <div className={`w-full ${h} bg-slate-900/80 border border-cyan-400/30 skew-x-[-12deg] overflow-hidden`}>
      <div className="h-full transition-all duration-150" style={{ width: `${Math.max(0, Math.min(100, frac * 100))}%`, background: color, boxShadow: `0 0 12px ${glow}` }} />
    </div>
  );
}

export default function HUD() {
  const hud = useStore(s => s.hud);
  const config = useStore(s => s.config);
  const settings = useStore(s => s.settings);
  const [now, setNow] = useState(0);
  const [showObjectives, setShowObjectives] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 120);
    const kd = (e: KeyboardEvent) => { if (e.code === 'Tab') setShowObjectives(true); };
    const ku = (e: KeyboardEvent) => { if (e.code === 'Tab') setShowObjectives(false); };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { clearInterval(id); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, []);

  const gameT = (window as unknown as { __sfTime?: number }).__sfTime ?? 0;
  const hitActive = gameT - hud.hitmarker < 0.18 && hud.hitmarker > 0;
  const dmgActive = gameT - hud.damageFlash < 0.35 && hud.damageFlash > 0;
  const hullFrac = hud.hull / Math.max(1, hud.maxHull);
  const lowHull = hullFrac < 0.3;
  const mins = Math.floor(hud.elapsed / 60), secs = Math.floor(hud.elapsed % 60);
  const lockPct = hud.lockProgress;
  void now;

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden font-mono">
      {/* damage vignette */}
      {settings.screenEffects && (
        <div className="absolute inset-0 transition-opacity duration-200" style={{ opacity: dmgActive ? 1 : lowHull ? 0.55 + 0.3 * Math.sin(performance.now() / 220) : 0, background: 'radial-gradient(ellipse at center, transparent 52%, rgba(220,38,38,0.5) 100%)' }} />
      )}
      {/* cockpit frame accents */}
      <div className="absolute top-0 left-0 w-56 h-10 border-b border-r border-cyan-400/25 bg-slate-950/30 [clip-path:polygon(0_0,100%_0,82%_100%,0_100%)]" />
      <div className="absolute top-0 right-0 w-56 h-10 border-b border-l border-cyan-400/25 bg-slate-950/30 [clip-path:polygon(0_0,100%_0,100%_100%,18%_100%)]" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[46rem] max-w-[92vw] h-7 border-t border-cyan-400/20 bg-slate-950/30 [clip-path:polygon(4%_100%,12%_0,88%_0,96%_100%)]" />

      {/* ── center reticle ── */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className={`relative w-14 h-14 ${hitActive ? 'scale-110' : ''} transition-transform`}>
          <Crosshair className={`w-14 h-14 ${hitActive ? 'text-red-400' : lockPct >= 0.7 ? 'text-orange-400' : 'text-cyan-300'} opacity-90`} strokeWidth={1.2} />
          {hitActive && <div className="absolute inset-0 flex items-center justify-center text-red-400 text-lg font-bold">✕</div>}
        </div>
        {hud.charge > 0.02 && (
          <div className="absolute left-1/2 top-16 -translate-x-1/2 w-24">
            <div className="h-1.5 bg-slate-900 border border-yellow-300/50"><div className="h-full bg-yellow-300" style={{ width: `${hud.charge * 100}%` }} /></div>
            <div className="text-center text-[9px] text-yellow-300 mt-0.5 tracking-widest">CHARGING</div>
          </div>
        )}
        {lockPct > 0.03 && hud.lockName && (
          <div className="absolute left-1/2 top-[4.5rem] -translate-x-1/2 w-32 text-center">
            <div className="h-1.5 bg-slate-900 border border-orange-400/60"><div className="h-full bg-orange-400" style={{ width: `${lockPct * 100}%` }} /></div>
            <div className={`text-[9px] mt-0.5 tracking-widest ${lockPct >= 1 ? 'text-orange-300 animate-pulse' : 'text-orange-400/80'}`}>{lockPct >= 1 ? '🔒 LOCKED — RELEASE TO FIRE' : `LOCKING: ${hud.lockName}`}</div>
          </div>
        )}
      </div>

      {/* ── target markers ── */}
      {hud.markers.map(m => (
        <div key={m.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${m.x}%`, top: `${m.y}%` }}>
          {m.offscreen ? (
            <div className={`flex flex-col items-center ${m.isAlly ? 'text-lime-300' : 'text-red-400'}`}>
              <div className="text-sm">◆</div>
              <div className="text-[8px] tracking-wider opacity-90">{m.dist}m</div>
            </div>
          ) : (
            <div className="flex flex-col items-center w-16">
              <div className={`relative ${m.isBoss ? 'w-12 h-12' : 'w-9 h-9'} ${m.locked ? 'animate-pulse' : ''}`}>
                <div className={`absolute inset-0 border ${m.isAlly ? 'border-lime-400/80' : m.locked ? 'border-orange-400' : 'border-red-400/80'} rotate-45`} />
                <div className={`absolute inset-[5px] border ${m.isAlly ? 'border-lime-400/40' : 'border-red-400/40'} rotate-45`} />
              </div>
              <div className="w-14 mt-1 space-y-[2px]">
                {m.shieldFrac > 0 && <div className="h-[3px] bg-slate-900/80"><div className="h-full bg-sky-400" style={{ width: `${m.shieldFrac * 100}%` }} /></div>}
                <div className="h-[3px] bg-slate-900/80"><div className={`h-full ${m.isAlly ? 'bg-lime-400' : 'bg-red-500'}`} style={{ width: `${Math.max(0, m.frac * 100)}%` }} /></div>
              </div>
              <div className={`text-[8px] tracking-wider mt-0.5 whitespace-nowrap ${m.isAlly ? 'text-lime-300' : 'text-red-300'}`}>{m.isBoss ? '☠ ' : ''}{m.name} · {m.dist}m</div>
            </div>
          )}
        </div>
      ))}

      {/* ── top left: mission ── */}
      <div className="absolute top-3 left-4 max-w-xs">
        <div className="text-[10px] tracking-[0.25em] text-cyan-400/80">{config?.name?.toUpperCase()}</div>
        <div className="mt-1 bg-slate-950/60 backdrop-blur border border-cyan-400/25 px-3 py-2 [clip-path:polygon(0_0,100%_0,96%_100%,0_100%)]">
          <div className="flex items-center gap-1.5 text-cyan-200 text-xs"><Target className="w-3.5 h-3.5 text-cyan-400" />{config?.objectiveText}</div>
          <div className="text-amber-300 text-[11px] mt-1">{hud.objectiveProgress}</div>
          {hud.timeLeft > 0 && <div className={`text-[11px] mt-0.5 ${hud.timeLeft < 20 ? 'text-red-400 animate-pulse' : 'text-slate-300'}`}>⏱ {Math.ceil(hud.timeLeft)}s remaining</div>}
        </div>
        <div className="text-[10px] text-slate-400 mt-1.5">TIME {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')} · KILLS {hud.kills} · SCORE {hud.score.toLocaleString()}{hud.combo > 2 && <span className="text-amber-300"> · COMBO ×{hud.combo}</span>}{settings.showFps && <span className="text-slate-500"> · {hud.fps} FPS</span>}</div>
      </div>

      {/* ── top right: wave + minimap-ish ── */}
      <div className="absolute top-3 right-4 text-right">
        <div className="bg-slate-950/60 backdrop-blur border border-cyan-400/25 px-3 py-2 inline-block">
          <div className="text-[10px] tracking-[0.25em] text-cyan-400/80">HOSTILES</div>
          <div className="text-2xl font-bold text-red-400 leading-none">{hud.enemiesLeft}{hud.bossName ? ' + ☠' : ''}</div>
          <div className="text-[10px] text-slate-400 mt-1">WAVE {hud.wave}{config && config.waves > 0 && config.kind !== 'survival' && config.kind !== 'endless' ? ` / ${config.waves}` : ''}</div>
        </div>
        {hud.missileWarning && (
          <div className="mt-2 flex items-center gap-1.5 bg-red-950/70 border border-red-500 px-2.5 py-1.5 text-red-300 text-[11px] font-bold animate-pulse">
            <AlertTriangle className="w-4 h-4" /> INCOMING MISSILE
          </div>
        )}
      </div>

      {/* ── boss bar ── */}
      {hud.bossName && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 w-[min(640px,80vw)]">
          <div className="text-center text-red-400 font-bold tracking-[0.3em] text-sm drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">☠ {hud.bossName} {hud.bossPhase > 1 && <span className="text-orange-400">— PHASE {hud.bossPhase}{hud.bossPhase === 3 ? ' · ENRAGED' : ''}</span>}</div>
          <div className="h-2 bg-slate-900/80 border border-sky-400/40 mt-1"><div className="h-full bg-sky-400 transition-all duration-200" style={{ width: `${hud.bossShieldFrac * 100}%` }} /></div>
          <div className="h-3.5 bg-slate-900/80 border border-red-500/60 mt-0.5"><div className="h-full bg-gradient-to-r from-red-700 to-red-400 transition-all duration-200" style={{ width: `${hud.bossFrac * 100}%` }} /></div>
          <div className="flex justify-between text-[9px] text-red-300/70 mt-0.5"><span>WEAK POINT: GLOWING CORE (shield down)</span><span>{Math.round(hud.bossFrac * 100)}%</span></div>
        </div>
      )}

      {/* ── ally bar ── */}
      {hud.allyFrac >= 0 && (
        <div className="absolute top-40 left-4 w-52 bg-slate-950/60 border border-lime-400/30 px-3 py-2">
          <div className="text-[10px] tracking-widest text-lime-300 flex justify-between"><span>{hud.allyName}</span><span>{Math.round(hud.allyFrac * 100)}%</span></div>
          <div className="h-2 bg-slate-900 mt-1"><div className={`h-full ${hud.allyFrac < 0.35 ? 'bg-red-500' : 'bg-lime-400'}`} style={{ width: `${hud.allyFrac * 100}%` }} /></div>
          {hud.allyFrac < 0.35 && <div className="text-[10px] text-red-400 animate-pulse mt-1">⚠ PROTECT IT — CRITICAL</div>}
        </div>
      )}

      {/* ── notifications ── */}
      <div className="absolute top-[30%] left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
        {hud.notifications.map(n => (
          <div key={n.id} className="text-sm font-bold tracking-[0.2em] px-4 py-1 bg-slate-950/50 backdrop-blur border-l-2 border-r-2 animate-[fadeSlide_0.3s_ease]" style={{ color: n.color, borderColor: n.color, textShadow: `0 0 12px ${n.color}` }}>{n.text}</div>
        ))}
      </div>

      {/* ── dialogue ── */}
      {hud.dialogue && (
        <div className="absolute bottom-36 left-1/2 -translate-x-1/2 w-[min(620px,86vw)] bg-slate-950/75 backdrop-blur border border-cyan-400/30 px-4 py-3">
          <div className="text-[10px] tracking-[0.25em] text-cyan-400">{hud.dialogue.speaker.toUpperCase()} ▸ COMMS</div>
          <div className="text-cyan-100 text-sm mt-1 font-sans">{hud.dialogue.text}</div>
        </div>
      )}

      {/* ── bottom left: ship status ── */}
      <div className="absolute bottom-5 left-4 w-72 space-y-1.5">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-sky-400 shrink-0" />
          <Bar frac={hud.shield / Math.max(1, hud.maxShield)} color="linear-gradient(90deg,#0369a1,#38bdf8)" glow="#38bdf8" />
          <span className="text-[10px] text-sky-300 w-12">{hud.shield}/{hud.maxShield}</span>
        </div>
        <div className="flex items-center gap-2">
          <Heart className={`w-4 h-4 shrink-0 ${lowHull ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`} />
          <Bar frac={hullFrac} color={lowHull ? 'linear-gradient(90deg,#991b1b,#ef4444)' : 'linear-gradient(90deg,#065f46,#34d399)'} glow={lowHull ? '#ef4444' : '#34d399'} h="h-3" />
          <span className={`text-[10px] w-12 ${lowHull ? 'text-red-300' : 'text-emerald-300'}`}>{hud.hull}/{hud.maxHull}</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-300 shrink-0" />
          <Bar frac={hud.energy / Math.max(1, hud.maxEnergy)} color="linear-gradient(90deg,#92400e,#fbbf24)" glow="#fbbf24" h="h-1.5" />
          <span className="text-[10px] text-amber-300 w-12">ENRGY</span>
        </div>
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-cyan-300 shrink-0" />
          <Bar frac={hud.boost / 100} color="linear-gradient(90deg,#155e75,#22d3ee)" glow="#22d3ee" h="h-1.5" />
          <span className="text-[10px] text-cyan-300 w-12">{hud.speed} km/h</span>
        </div>
        {lowHull && <div className="text-red-400 text-[11px] font-bold animate-pulse tracking-widest">⚠ HULL CRITICAL</div>}
      </div>

      {/* ── bottom right: weapons + abilities ── */}
      <div className="absolute bottom-5 right-4 w-80 space-y-1.5 text-right">
        <div className="bg-slate-950/60 backdrop-blur border border-cyan-400/25 px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] text-slate-500 border border-slate-700 px-1">LMB · Q</span>
            <span className="text-cyan-200 text-xs font-bold truncate">{hud.primaryName}</span>
            <Crosshair className="w-4 h-4 text-cyan-400 shrink-0" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] text-slate-500 border border-slate-700 px-1">RMB · R</span>
            <span className="text-orange-300 text-xs font-bold truncate">{hud.secondaryName}{hud.ammo >= 0 ? ` · ${hud.ammo}` : ''}</span>
            <Rocket className="w-4 h-4 text-orange-400 shrink-0" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] text-slate-500 border border-slate-700 px-1">E</span>
            <div className="flex-1 mx-1"><Bar frac={1 - hud.abilityCd / Math.max(0.01, hud.abilityMax)} color="linear-gradient(90deg,#6d28d9,#c084fc)" glow="#c084fc" h="h-1.5" /></div>
            <span className={`text-[11px] font-bold ${hud.abilityCd <= 0 ? 'text-purple-300' : 'text-slate-500'}`}>{hud.abilityName}{hud.abilityCd > 0 ? ` ${hud.abilityCd.toFixed(0)}s` : ' READY'}</span>
            <Flame className="w-4 h-4 text-purple-400 shrink-0" />
          </div>
        </div>
        {/* ultimate */}
        <div className={`border px-3 py-2 backdrop-blur ${hud.ult >= 100 ? 'border-yellow-300 bg-yellow-950/50 animate-pulse' : 'border-slate-700 bg-slate-950/60'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-500 border border-slate-700 px-1">F</span>
            <span className={`text-xs font-bold tracking-widest flex items-center gap-1 ${hud.ult >= 100 ? 'text-yellow-300' : 'text-slate-400'}`}><Star className="w-3.5 h-3.5" /> STARFALL PROTOCOL {Math.round(hud.ult)}%</span>
          </div>
          <div className="h-2 bg-slate-900 mt-1.5 border border-yellow-500/30"><div className="h-full bg-gradient-to-r from-amber-600 to-yellow-300 transition-all" style={{ width: `${hud.ult}%`, boxShadow: hud.ult >= 100 ? '0 0 14px #fde047' : undefined }} /></div>
        </div>
      </div>

      {/* objectives overlay (Tab) */}
      {showObjectives && config && (
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center">
          <div className="border border-cyan-400/40 bg-slate-900/90 p-6 w-[min(480px,90vw)]">
            <div className="text-cyan-300 tracking-[0.3em] text-sm font-bold">MISSION OBJECTIVES</div>
            <div className="text-slate-200 mt-3 text-sm">▸ {config.objectiveText}</div>
            <div className="text-amber-300 mt-1 text-sm">{hud.objectiveProgress}</div>
            <div className="text-slate-400 text-xs mt-4 space-y-1">
              <div>W/S thrust · A/D strafe · SPACE/CTRL vertical · SHIFT boost</div>
              <div>MOUSE steer · LMB fire · RMB hold = missile lock, release = fire</div>
              <div>Q/R cycle weapons · E ability · F ultimate · ESC pause</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
