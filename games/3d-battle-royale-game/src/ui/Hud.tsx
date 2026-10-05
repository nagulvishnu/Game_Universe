import { WEAPONS } from '../game/data';
import type { Hud as HudData, Game } from '../game/game';

export interface FeedItem { id: number; text: string; kind: string }
export interface PickItem { id: number; text: string; color: number }
export interface ToastItem { id: number; t: string; sub: string; kind: string }

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

const WICON: Record<string, string> = { knife: '🔪', axe: '🪓', pistol: '🔫', smg: '🔫', ar: '🔫', shotgun: '🔫', sniper: '🎯' };

interface Props {
  hud: HudData;
  game: Game | null;
  feed: FeedItem[];
  picks: PickItem[];
  toast: ToastItem | null;
  hit: { k: number; kill: boolean; head: boolean };
  hurt: { k: number };
  isTouch: boolean;
  muted: boolean;
  onMute: () => void;
  onPause: () => void;
}

export default function Hud({ hud, game, feed, picks, toast, hit, hurt, isTouch, muted, onMute, onPause }: Props) {
  const inVeh = hud.phase === 'vehicle';
  const showCross = hud.phase === 'ground' && !hud.scoped;
  const zoneCol = hud.zoneKind === 'shrink' ? '#f87171' : '#38bdf8';
  const toastCol = toast?.kind === 'kill' ? '#f87171' : toast?.kind === 'dead' ? '#ef4444' : toast?.kind === 'win' ? '#fbbf24' : toast?.kind === 'zone' ? '#38bdf8' : '#ffffff';

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* feedback layers */}
      {hud.phase === 'fall' && <div className="absolute inset-0 speedlines opacity-70" />}
      {!hud.inZone && hud.hp > 0 && <div className="absolute inset-0 zone-vignette" />}
      {hurt.k > 0 && <div key={hurt.k} className="absolute inset-0 hurt-vignette" />}
      {hud.hp > 0 && hud.hp < 30 && <div className="absolute inset-0 zone-vignette" style={{ background: 'radial-gradient(ellipse at center, transparent 45%, rgba(200,0,0,0.45) 100%)' }} />}
      {hud.scoped && (
        <div className="absolute inset-0">
          <div className="absolute inset-0 scope-mask" />
          <div className="absolute left-0 right-0 top-1/2 h-px bg-black/80" />
          <div className="absolute top-0 bottom-0 left-1/2 w-px bg-black/80" />
          <div className="absolute left-1/2 top-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500" />
        </div>
      )}

      {/* top-left stats */}
      <div className="absolute left-3 top-3 flex flex-col gap-2" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex gap-2">
          <div className="panel clip-tag px-3 py-1.5 flex items-center gap-2">
            <span className="text-lg">👥</span>
            <span className="font-display text-xl font-extrabold leading-none">{hud.alive}</span>
            <span className="text-[10px] text-slate-400 tracking-widest">ALIVE</span>
          </div>
          <div className="panel clip-tag px-3 py-1.5 flex items-center gap-2">
            <span className="text-lg">☠️</span>
            <span className="font-display text-xl font-extrabold leading-none text-amber-300">{hud.kills}</span>
          </div>
        </div>
        <div className="panel px-3 py-1 text-xs text-slate-300 tracking-widest w-fit">
          SCORE <span className="font-display text-amber-300 text-sm ml-1">{hud.score}</span>
        </div>
        <div className="flex flex-col gap-1 mt-1">
          {feed.map((f) => {
            const [a, w, b] = f.text.split('|');
            return (
              <div key={f.id} className={`feed-in panel px-2 py-0.5 text-[13px] w-fit max-w-[60vw] truncate ${f.kind === 'mine' ? 'border-amber-400/70' : f.kind === 'dead' ? 'border-red-500/70' : ''}`}>
                <span className={f.kind === 'mine' ? 'text-amber-300 font-bold' : 'text-slate-100'}>{a}</span>
                <span className="text-slate-400 mx-1.5 text-[11px]">[{w}]</span>
                <span className={f.kind === 'dead' ? 'text-red-400 font-bold' : 'text-slate-100'}>{b}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* top-center zone timer */}
      <div className="absolute left-1/2 -translate-x-1/2 top-3 flex flex-col items-center gap-1" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="panel px-4 py-1 flex items-center gap-3" style={{ borderColor: zoneCol + '99' }}>
          <span className="text-[10px] sm:text-[11px] tracking-[0.2em]" style={{ color: zoneCol }}>{hud.zoneLabel}</span>
          {hud.zoneKind !== 'final' && <span className="font-display text-lg font-extrabold">{fmt(hud.zoneTime)}</span>}
        </div>
        {!hud.inZone && hud.hp > 0 && <div className="pulse-text text-sm font-bold text-sky-300 tracking-widest bg-black/40 px-3 rounded">OUTSIDE SAFE ZONE — RUN!</div>}
      </div>

      {/* top-right minimap + buttons */}
      <div className="absolute right-3 top-3 flex flex-col items-end gap-2" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex gap-2 pointer-events-auto">
          <button className="panel w-9 h-9 text-lg" onClick={onMute} aria-label="mute">{muted ? '🔇' : '🔊'}</button>
          <button className="panel w-9 h-9 text-lg" onClick={onPause} aria-label="pause">⏸</button>
        </div>
        <div id="minimap-slot" style={{ width: 150, height: 150 }} />
      </div>

      {/* center */}
      {showCross && (
        <div className="absolute left-1/2 top-1/2">
          <div className="absolute -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-white shadow-[0_0_4px_#000]" />
          {[0, 90, 180, 270].map((r) => (
            <div key={r} className="absolute w-[2px] h-[7px] bg-white/90 shadow-[0_0_3px_#000]" style={{ transform: `translate(-50%, -50%) rotate(${r}deg) translateY(-13px)` }} />
          ))}
        </div>
      )}
      {hit.k > 0 && (
        <div key={hit.k} className="absolute left-1/2 top-1/2 hitmarker" style={{ width: 26, height: 26 }}>
          <div className="absolute inset-0" style={{ border: `3px solid ${hit.kill ? '#ef4444' : hit.head ? '#fde047' : '#fff'}`, boxShadow: '0 0 6px #000' }} />
          <div className="absolute bg-black" style={{ left: '50%', top: -4, width: 8, height: 34, transform: 'translateX(-50%)', mixBlendMode: 'normal' }} />
          <div className="absolute bg-black" style={{ top: '50%', left: -4, height: 8, width: 34, transform: 'translateY(-50%)' }} />
        </div>
      )}
      {toast && (
        <div key={toast.id} className="absolute left-1/2 top-[22%] -translate-x-1/2 text-center toast-in">
          <div className="font-display font-black text-3xl sm:text-5xl" style={{ color: toastCol, textShadow: '0 0 20px ' + toastCol + '88, 0 3px 0 #000' }}>{toast.t}</div>
          {toast.sub && <div className="text-sm sm:text-lg text-slate-100 tracking-wider mt-1" style={{ textShadow: '0 2px 4px #000' }}>{toast.sub}</div>}
        </div>
      )}
      {hud.hint && (
        <div className="absolute left-1/2 bottom-[22%] -translate-x-1/2 pulse-text font-display font-bold text-sm sm:text-xl text-amber-300 text-center px-3" style={{ textShadow: '0 2px 6px #000' }}>
          {hud.hint}
        </div>
      )}
      {hud.phase !== 'plane' && hud.phase !== 'fall' && hud.phase !== 'chute' && hud.alt > 0 && null}
      {(hud.phase === 'fall' || hud.phase === 'chute') && (
        <div className="absolute left-1/2 top-[40%] -translate-x-1/2 translate-y-[120px] panel px-3 py-1 font-display text-lg text-sky-200">
          ALT <span className="text-white font-extrabold">{hud.alt}</span> m
        </div>
      )}
      {hud.prompt && !inVeh && (
        <div className="absolute left-1/2 bottom-[28%] -translate-x-1/2 panel px-4 py-1.5 font-display font-bold text-amber-300 text-sm sm:text-base border-amber-400/60 whitespace-nowrap">
          {hud.prompt}
        </div>
      )}
      {hud.reload > 0 && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-10 w-24 h-1.5 bg-black/60 rounded">
          <div className="h-full bg-amber-300 rounded" style={{ width: `${hud.reload * 100}%` }} />
        </div>
      )}
      {hud.heal > 0 && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-10 w-32 text-center">
          <div className="text-xs text-green-300 tracking-widest mb-1">HEALING</div>
          <div className="h-1.5 bg-black/60 rounded"><div className="h-full bg-green-400 rounded" style={{ width: `${hud.heal * 100}%` }} /></div>
        </div>
      )}

      {/* bottom-left: health */}
      <div className="absolute left-3 bottom-3 w-[min(46vw,300px)]" style={{ marginBottom: isTouch ? 0 : 0, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex flex-col gap-1 mb-2">
          {picks.map((p) => (
            <div key={p.id} className="pick-in text-sm font-bold w-fit px-2 rounded bg-black/45" style={{ color: hex(p.color), borderLeft: `3px solid ${hex(p.color)}` }}>
              + {p.text}
            </div>
          ))}
        </div>
        <div className="panel p-2">
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-lg">✚</span>
            <div className="flex-1 h-3.5 bg-black/60 rounded-sm overflow-hidden relative">
              <div className="h-full transition-[width] duration-150" style={{ width: `${hud.hp}%`, background: hud.hp > 50 ? 'linear-gradient(90deg,#16a34a,#4ade80)' : hud.hp > 25 ? 'linear-gradient(90deg,#d97706,#fbbf24)' : 'linear-gradient(90deg,#b91c1c,#ef4444)' }} />
            </div>
            <span className="font-display font-extrabold w-9 text-right">{hud.hp}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sky-400 text-lg">🛡</span>
            <div className="flex-1 h-2 bg-black/60 rounded-sm overflow-hidden">
              <div className="h-full bg-gradient-to-r from-sky-600 to-sky-300 transition-[width] duration-150" style={{ width: `${hud.armor}%` }} />
            </div>
            <span className="font-display text-sm w-9 text-right text-sky-200">{hud.armor}</span>
          </div>
          <div className="flex gap-3 mt-1.5 text-xs text-slate-300 pointer-events-auto">
            <button className="flex items-center gap-1" onClick={() => game?.useMedkit()}>🩹 <b className="text-white">{hud.medkits}</b> <span className="text-slate-500 hidden sm:inline">[H]</span></button>
            <button className="flex items-center gap-1" onClick={() => game?.throwPlayer('grenade')}>💣 <b className="text-white">{hud.gren}</b> <span className="text-slate-500 hidden sm:inline">[G]</span></button>
            <button className="flex items-center gap-1" onClick={() => game?.throwPlayer('bomb')}>🧨 <b className="text-white">{hud.bomb}</b> <span className="text-slate-500 hidden sm:inline">[B]</span></button>
          </div>
        </div>
      </div>

      {/* bottom-right: weapons */}
      {!inVeh && (
        <div className={`absolute right-3 ${isTouch ? 'bottom-[44%] sm:bottom-3' : 'bottom-3'} flex flex-col items-end gap-1.5`} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="panel px-3 py-1.5 text-right min-w-[150px]">
            <div className="text-[11px] tracking-widest text-slate-400 uppercase">{hud.weapon}</div>
            {hud.isGun ? (
              <div className="font-display leading-none">
                <span className={`text-3xl font-black ${hud.mag === 0 ? 'text-red-400' : 'text-white'}`}>{hud.mag}</span>
                <span className="text-slate-400 text-lg"> / {hud.reserve}</span>
              </div>
            ) : (
              <div className="font-display text-xl font-black text-amber-300">MELEE</div>
            )}
          </div>
          <div className="flex gap-1.5 pointer-events-auto">
            {hud.slots.map((s, i) => (
              <button
                key={i}
                onClick={() => game?.selectSlot(i)}
                className={`panel w-12 h-12 flex flex-col items-center justify-center relative ${s.active ? 'border-amber-400 bg-amber-400/20 slot-pop' : ''} ${!s.id ? 'opacity-35' : ''}`}
              >
                <span className="text-lg leading-none">{s.id ? WICON[s.id] : ''}</span>
                <span className="text-[9px] text-slate-300 leading-none mt-0.5 uppercase">{s.id ? WEAPONS[s.id].name.split(' ')[0] : '—'}</span>
                <span className="absolute left-1 top-0.5 text-[9px] text-slate-500">{i + 1}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* vehicle */}
      {inVeh && (
        <div className="absolute left-1/2 bottom-4 -translate-x-1/2 panel px-5 py-2 text-center min-w-[180px]">
          <div className="font-display text-4xl font-black leading-none">{hud.speed}<span className="text-xs text-slate-400 ml-1">km/h</span></div>
          <div className="text-[10px] tracking-widest text-slate-400 mt-1">{hud.vehicle?.toUpperCase()} · {isTouch ? 'EXIT BUTTON' : '[E] EXIT'}</div>
          <div className="h-1.5 bg-black/60 rounded mt-1"><div className="h-full rounded" style={{ width: `${hud.vehHp * 100}%`, background: hud.vehHp > 0.4 ? '#4ade80' : '#ef4444' }} /></div>
        </div>
      )}
    </div>
  );
}
