import type { HudState } from '../game/game';
import { cn } from '../utils/cn';
import { BottleIcon, EarIcon, KeyIcon, PadlockIcon, SkullIcon, TorchIcon } from './Icons';

export interface Msg {
  id: number;
  text: string;
  tone: 'info' | 'warn' | 'good' | 'bad';
}

interface Props {
  hud: HudState;
  messages: Msg[];
  note: { title: string; text: string } | null;
  showControls: boolean;
}

function Slot({ owned, label, sub, children, tint }: { owned: boolean; label: string; sub?: string; children: React.ReactNode; tint: string }) {
  return (
    <div className={cn('flex w-[68px] flex-col items-center transition-opacity duration-300', owned ? 'opacity-100' : 'opacity-35')}>
      <div
        className="flex h-12 w-12 items-center justify-center rounded-md border bg-black/55 backdrop-blur-sm transition-all duration-300"
        style={{
          borderColor: owned ? tint : 'rgba(255,255,255,0.12)',
          boxShadow: owned ? `0 0 14px ${tint}55, inset 0 0 8px ${tint}22` : 'none',
        }}
      >
        {children}
      </div>
      <span className="mt-1 text-center text-[9px] font-semibold uppercase leading-tight tracking-wider text-stone-300/85">{label}</span>
      {sub && <span className="text-center text-[9px] uppercase tracking-wider text-emerald-400/90">{sub}</span>}
    </div>
  );
}

export function Hud({ hud, messages, note, showControls }: Props) {
  const danger = Math.min(1, hud.fear * 0.7 + hud.damage * 0.6);
  const noiseBars = 6;
  const lit = Math.round(hud.noise * noiseBars);
  const noiseLabel = hud.noise < 0.12 ? 'Silent' : hud.noise < 0.4 ? 'Quiet' : hud.noise < 0.7 ? 'Noisy' : 'LOUD';
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* fear vignette */}
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 42%, rgba(110,0,0,${(danger * 0.75).toFixed(3)}) 100%)` }}
      />
      {hud.damage > 0.02 && <div className="absolute inset-0 bg-red-900" style={{ opacity: Math.min(0.55, hud.damage * 0.5) }} />}
      <div className="film-grain" />

      {/* crosshair */}
      {!hud.hidden && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div
            className={cn(
              'rounded-full border transition-all duration-150',
              hud.prompt ? (hud.promptTone === 'locked' ? 'h-3 w-3 border-red-400/90' : 'h-3 w-3 border-amber-200/90') : 'h-1 w-1 border-white/50 bg-white/50',
            )}
          />
        </div>
      )}

      {/* prompt */}
      {hud.prompt && (
        <div className="absolute left-1/2 top-[56%] -translate-x-1/2">
          <div
            className={cn(
              'flex items-center gap-2 rounded-md border bg-black/60 px-3 py-1.5 text-sm tracking-wide backdrop-blur-sm',
              hud.promptTone === 'locked' ? 'border-red-500/40 text-red-300' : 'border-amber-200/30 text-amber-100',
            )}
          >
            <span className="rounded border border-current px-1.5 py-[1px] text-xs font-bold">E</span>
            <span>{hud.prompt}</span>
          </div>
        </div>
      )}

      {/* hidden banner */}
      {hud.hidden && (
        <div className="absolute inset-x-0 top-[14%] flex justify-center">
          <div className="font-type rounded bg-black/50 px-4 py-1 text-xs uppercase tracking-[0.35em] text-stone-300/80 anim-flicker">
            {hud.hideType === 'bed' ? 'Under the bed' : 'In the wardrobe'} — stay quiet
          </div>
        </div>
      )}

      {/* trapped banner */}
      {hud.trapped && (
        <div className="absolute inset-x-0 top-[22%] flex justify-center">
          <div className="font-horror anim-shiver text-3xl text-red-500 drop-shadow-[0_0_12px_rgba(255,0,0,0.6)]">STUCK IN A TRAP!</div>
        </div>
      )}

      {/* top-left: day */}
      <div className="absolute left-5 top-5">
        <div className="flex items-center gap-3 rounded-md border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-sm">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-stone-400">Day</div>
            <div className="font-horror text-3xl leading-none text-red-600">
              {hud.day}
              <span className="text-lg text-stone-500"> / {hud.maxDays}</span>
            </div>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: hud.maxDays }).map((_, i) => (
              <SkullIcon key={i} color={i < hud.day - 1 ? '#7a1010' : i === hud.day - 1 ? '#e8e0d0' : '#444'} className={cn('h-4 w-4', i < hud.day - 1 && 'opacity-60')} />
            ))}
          </div>
        </div>
        {hud.room && <div className="mt-1 pl-1 text-[10px] uppercase tracking-[0.3em] text-stone-500">{hud.room}</div>}
      </div>

      {/* top-center: objective */}
      <div className="absolute inset-x-0 top-5 flex justify-center px-40">
        <div className="max-w-xl rounded-md border border-white/5 bg-black/40 px-4 py-1.5 text-center text-[11px] uppercase tracking-[0.18em] text-stone-300/80 backdrop-blur-sm">
          <span className="mr-2 text-red-500">Objective</span>
          {hud.objective}
        </div>
      </div>

      {/* top-right: controls */}
      {showControls && (
        <div className="anim-fadein absolute right-5 top-5 rounded-md border border-white/10 bg-black/55 p-3 text-[11px] leading-6 text-stone-300 backdrop-blur-sm">
          <div className="mb-1 text-[10px] uppercase tracking-[0.3em] text-stone-500">Controls</div>
          <div><b className="text-amber-200">WASD</b> move · <b className="text-amber-200">Mouse</b> look</div>
          <div><b className="text-amber-200">Shift</b> run · <b className="text-amber-200">C</b> crouch</div>
          <div><b className="text-amber-200">E</b> interact · <b className="text-amber-200">F</b> flashlight</div>
          <div><b className="text-amber-200">Click / Q</b> throw bottle</div>
          <div><b className="text-amber-200">Esc</b> pause</div>
        </div>
      )}

      {/* bottom-left: inventory */}
      <div className="absolute bottom-5 left-5 flex items-end gap-2 rounded-lg border border-white/10 bg-black/45 p-2.5 backdrop-blur-sm">
        <Slot owned={hud.brass} label="Brass Key" sub={hud.studyOpen ? 'Study open' : undefined} tint="#d4a72c">
          <KeyIcon color="#d4a72c" />
        </Slot>
        <Slot owned={hud.silver} label="Silver Key" sub={hud.masterOpen ? 'Master open' : undefined} tint="#cfd8e0">
          <KeyIcon color="#cfd8e0" />
        </Slot>
        <Slot owned={hud.padlock} label="Padlock Key" tint="#e5484d">
          <PadlockIcon color="#e5484d" />
        </Slot>
        <Slot owned={hud.doorKey} label="Door Key" tint="#4aa3ff">
          <KeyIcon color="#4aa3ff" />
        </Slot>
        <div className="mx-1 h-12 w-px bg-white/10" />
        <Slot owned={hud.bottles > 0} label={`Bottles ${hud.bottles}/3`} tint="#5fbf7a">
          <div className="relative">
            <BottleIcon color="#5fbf7a" />
            {hud.bottles > 0 && (
              <span className="absolute -bottom-1 -right-2 rounded-full bg-emerald-700 px-1.5 text-[10px] font-bold text-white">{hud.bottles}</span>
            )}
          </div>
        </Slot>
      </div>

      {/* bottom-center: stamina + messages */}
      <div className="absolute inset-x-0 bottom-5 flex flex-col items-center gap-2">
        <div className="flex flex-col items-center gap-2">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                'anim-toast max-w-xl rounded-md border bg-black/65 px-4 py-2 text-center text-sm tracking-wide backdrop-blur-sm',
                m.tone === 'bad' && 'border-red-600/50 text-red-300',
                m.tone === 'warn' && 'border-amber-500/40 text-amber-200',
                m.tone === 'good' && 'border-emerald-500/40 text-emerald-200',
                m.tone === 'info' && 'border-white/15 text-stone-200',
              )}
            >
              {m.text}
            </div>
          ))}
        </div>
        <div className="h-1.5 w-56 overflow-hidden rounded-full bg-white/10">
          <div
            className={cn('h-full rounded-full transition-[width] duration-100', hud.exhausted ? 'bg-red-600' : 'bg-stone-300/80')}
            style={{ width: `${Math.round(hud.stamina * 100)}%` }}
          />
        </div>
      </div>

      {/* bottom-right: noise + torch */}
      <div className="absolute bottom-5 right-5 flex flex-col items-end gap-2">
        <div className="flex items-center gap-3 rounded-md border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-sm">
          <EarIcon color={hud.noise > 0.55 ? '#ff5a5a' : '#aaa'} />
          <div className="flex items-end gap-[3px]">
            {Array.from({ length: noiseBars }).map((_, i) => (
              <div
                key={i}
                className="w-1.5 rounded-sm transition-colors duration-100"
                style={{
                  height: 6 + i * 3,
                  background: i < lit ? (i < 2 ? '#7bd88f' : i < 4 ? '#f1c453' : '#ff4d4d') : 'rgba(255,255,255,0.12)',
                }}
              />
            ))}
          </div>
          <span className={cn('w-12 text-[10px] font-semibold uppercase tracking-widest', hud.noise > 0.7 ? 'text-red-400' : 'text-stone-400')}>{noiseLabel}</span>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/50 px-3 py-1.5 text-[11px] uppercase tracking-widest text-stone-400 backdrop-blur-sm">
          <TorchIcon color={hud.flashlight ? '#ffe9a8' : '#666'} />
          <span className={hud.flashlight ? 'text-amber-200' : 'text-stone-500'}>[F] Torch {hud.flashlight ? 'On' : 'Off'}</span>
          {hud.crouch && <span className="ml-2 text-emerald-300">Crouching</span>}
        </div>
      </div>

      {/* note */}
      {note && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div
            className="anim-rise relative max-w-md -rotate-1 rounded-sm px-8 py-7 shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
            style={{ background: 'linear-gradient(135deg,#d9d0ad 0%,#bfb28a 60%,#a89a72 100%)', color: '#2b2013' }}
          >
            <div className="absolute inset-0 rounded-sm opacity-30" style={{ background: 'radial-gradient(circle at 80% 90%, rgba(90,20,10,0.6), transparent 30%)' }} />
            <div className="font-type relative mb-3 text-xs uppercase tracking-[0.3em] text-[#6b4a2b]">{note.title}</div>
            <p className="font-type relative text-[15px] leading-7">{note.text}</p>
            <div className="font-type relative mt-5 text-right text-[11px] uppercase tracking-widest text-[#7a5a3a]">Press E to put it down</div>
          </div>
        </div>
      )}
    </div>
  );
}
