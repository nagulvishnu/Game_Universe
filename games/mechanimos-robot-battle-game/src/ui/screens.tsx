import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ChevronsRight, Rocket, Flame, Zap, Shield, HeartPulse, Play, Pause, Volume2, VolumeX,
  Trophy, RotateCcw, Home, Swords, Wrench, Car, Layers, Sparkles, Crosshair, Gamepad2,
  Bot, Crown, Timer, Star, HelpCircle, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { BattleCardsSnap, CardId, DraftRequest, HudSnap, RunStats, SpeciesDef } from '../game/types';
import { CARDS, SPECIES } from '../game/data';
import type { HiScoreEntry } from './scores';

// Poster lives in `public/images/` so it is served at the root URL.
// (There is no `src/assets/poster.jpg`; importing it would break the build.)
const posterUrl = 'images/poster.jpg';

// ---------------- shared bits ----------------

const CARD_ICONS: Record<CardId, LucideIcon> = {
  ram: ChevronsRight,
  punch: Rocket,
  flame: Flame,
  volt: Zap,
  aegis: Shield,
  nanite: HeartPulse,
};

function KeyCap({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-md border border-cyan-300/40 bg-cyan-400/10 text-cyan-200 text-[11px] font-bold font-display">
      {children}
    </span>
  );
}

function SpeciesOrb({ sp, size = 72 }: { sp: SpeciesDef; size?: number }) {
  return (
    <div
      className="relative rounded-full anim-floaty"
      style={{
        width: size, height: size,
        background: `radial-gradient(circle at 32% 28%, ${sp.glass}, ${sp.body} 45%, ${sp.dark} 100%)`,
        boxShadow: `0 0 ${size * 0.5}px ${sp.body}88, inset 0 -6px 14px rgba(0,0,0,.4)`,
      }}
    >
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: size * 0.34, height: size * 0.2, background: sp.accent, boxShadow: `0 0 14px ${sp.accent}` }}
      />
      <Bot className="absolute -bottom-1 -right-1 text-white/80" size={size * 0.34} />
    </div>
  );
}

// ---------------- START SCREEN ----------------

export function StartScreen(props: {
  scores: HiScoreEntry[];
  best: number;
  onStart: () => void;
}) {
  const [help, setHelp] = useState(false);
  return (
    <div className="absolute inset-0 z-40 overflow-hidden bg-[#070313]">
      <img
        src={posterUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-45"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#070313]/60 via-[#070313]/40 to-[#070313]" />
      <div className="absolute inset-0 scanlines" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 py-6 overflow-y-auto nice-scroll">
        <div className="anim-pop flex flex-col items-center max-w-3xl w-full">
          <div className="flex items-center gap-3 mb-2">
            <Car className="text-orange-400" size={30} />
            <span className="h-px w-16 shimmer-line" />
            <Bot className="text-cyan-300" size={38} />
            <span className="h-px w-16 shimmer-line" />
            <Layers className="text-fuchsia-400" size={30} />
          </div>
          <h1 className="font-display text-center font-black tracking-[0.12em] text-5xl md:text-7xl leading-none">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-cyan-300 text-glow-blaze">MECHA</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-purple-400 text-glow-cyan">NIMOS</span>
          </h1>
          <p className="mt-3 font-body text-cyan-200/90 tracking-[0.35em] text-xs md:text-sm uppercase">
            Tiny Cars · Giant Robots · Tame Them All
          </p>
          {props.best > 0 && (
            <p className="mt-2 font-display text-amber-300/90 text-xs tracking-widest flex items-center gap-2">
              <Crown size={14} /> BEST SCORE {props.best.toLocaleString()}
            </p>
          )}

          <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button
              onClick={props.onStart}
              className="anim-ring group relative px-10 py-4 rounded-xl font-display font-bold tracking-[0.2em] text-sm md:text-base text-[#0a0618] bg-gradient-to-r from-cyan-300 to-fuchsia-400 hover:brightness-110 active:scale-95 transition shadow-[0_0_40px_rgba(34,211,238,.45)]"
            >
              <span className="flex items-center justify-center gap-3"><Play size={20} className="fill-current" /> START ENGINE</span>
            </button>
            <button
              onClick={() => setHelp((h) => !h)}
              className="px-8 py-4 rounded-xl font-display font-bold tracking-[0.2em] text-sm text-cyan-200 border border-cyan-400/40 bg-cyan-400/5 hover:bg-cyan-400/15 active:scale-95 transition"
            >
              <span className="flex items-center justify-center gap-2">{help ? <X size={18} /> : <HelpCircle size={18} />} HOW TO PLAY</span>
            </button>
          </div>

          {help && (
            <div className="anim-slide-up mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
              {[
                { icon: Crosshair, title: '1 · EXPLORE', body: 'Roam the neon wastes. Wild Mechanimos rev and bolt — chase them down and ENGAGE. Grab crystals and spare tame cards.' },
                { icon: Layers, title: '2 · DRAFT 3 CARDS', body: 'Before each battle pick 3 of your 6 battle cards. Rams, rockets, burns, stuns, shields and repairs — build your combo.' },
                { icon: Swords, title: '3 · TRANSFORM & TAME', body: 'Your car unfolds into a giant mech. Win the duel, then hurl a Tame Card. Lose to a rival rider and they tame YOURS.' },
              ].map((s) => (
                <div key={s.title} className="rounded-xl border border-cyan-400/25 bg-[#0d0722]/80 backdrop-blur p-4 text-left">
                  <s.icon className="text-fuchsia-300 mb-2" size={22} />
                  <h3 className="font-display text-cyan-100 text-sm tracking-widest">{s.title}</h3>
                  <p className="font-body text-slate-300/90 text-sm leading-snug mt-1">{s.body}</p>
                </div>
              ))}
            </div>
          )}

          {props.scores.length > 0 && (
            <div className="mt-6 w-full max-w-md rounded-xl border border-amber-300/25 bg-[#0d0722]/80 backdrop-blur p-4">
              <h3 className="font-display text-amber-300 text-xs tracking-[0.3em] flex items-center gap-2 justify-center"><Trophy size={14} /> HALL OF FAME</h3>
              <div className="mt-2 space-y-1">
                {props.scores.map((s, i) => (
                  <div key={i} className="flex items-center justify-between font-body text-sm text-slate-200">
                    <span className="w-8 font-display text-cyan-300">{i + 1}.</span>
                    <span className="flex-1 font-display tracking-widest">{s.name}</span>
                    <span className="text-slate-400 text-xs mr-3">{s.tames} tamed · {s.wins} wins</span>
                    <span className="font-display text-amber-300">{s.score.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-body text-slate-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5"><KeyCap>W</KeyCap><KeyCap>A</KeyCap><KeyCap>S</KeyCap><KeyCap>D</KeyCap> move</span>
            <span className="flex items-center gap-1.5"><KeyCap>E</KeyCap> engage</span>
            <span className="flex items-center gap-1.5"><KeyCap>1</KeyCap><KeyCap>2</KeyCap><KeyCap>3</KeyCap> cards</span>
            <span className="flex items-center gap-1.5"><KeyCap>P</KeyCap> pause</span>
            <span className="flex items-center gap-1.5"><Gamepad2 size={14} /> touch: drag left side to move</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10 border-t border-cyan-400/15 bg-[#070313]/85 overflow-hidden whitespace-nowrap">
        <div className="inline-block py-2 font-display text-[10px] tracking-[0.4em] text-cyan-300/50" style={{ animation: 'marquee 22s linear infinite' }}>
          {'TAME · BATTLE · COLLECT · TRANSFORM · '.repeat(6)}
          {'TAME · BATTLE · COLLECT · TRANSFORM · '.repeat(6)}
        </div>
      </div>
    </div>
  );
}

// ---------------- HUD ----------------

export function Hud(props: {
  snap: HudSnap;
  muted: boolean;
  paused: boolean;
  inBattle: boolean;
  onPause: () => void;
  onMute: () => void;
  onEngage: () => void;
}) {
  const { snap } = props;
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {/* top-left score block */}
      <div className="absolute left-3 top-3 md:left-5 md:top-5">
        <div className="-skew-x-6 rounded-lg border border-cyan-400/40 bg-[#0d0722]/85 px-4 py-2 backdrop-blur shadow-[0_0_24px_rgba(34,211,238,.15)]">
          <div className="skew-x-6">
            <div className="font-display text-[9px] tracking-[0.35em] text-cyan-300/80">SCORE</div>
            <div className="font-display text-2xl md:text-3xl font-black text-white leading-none tabular-nums">
              {snap.score.toLocaleString()}
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-[11px] font-body font-semibold text-slate-300">
              <span className="flex items-center gap-1"><Wrench size={12} className="text-amber-300" /><span className="text-amber-200">{snap.lives}</span></span>
              <span className="flex items-center gap-1"><Car size={12} className="text-cyan-300" /><span className="text-cyan-200">{snap.teamCount}</span></span>
              <span className="flex items-center gap-1"><Layers size={12} className="text-fuchsia-300" /><span className="text-fuchsia-200">{snap.tameCards}</span></span>
              <span className="flex items-center gap-1"><Swords size={12} className="text-emerald-300" /><span className="text-emerald-200">{snap.wins}</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* top-right buttons */}
      <div className="pointer-events-auto absolute right-3 top-3 md:right-5 md:top-5 flex gap-2">
        <button onClick={props.onMute} className="rounded-lg border border-cyan-400/40 bg-[#0d0722]/85 p-2.5 text-cyan-200 backdrop-blur hover:bg-cyan-400/15 active:scale-90 transition">
          {props.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <button onClick={props.onPause} className="rounded-lg border border-cyan-400/40 bg-[#0d0722]/85 p-2.5 text-cyan-200 backdrop-blur hover:bg-cyan-400/15 active:scale-90 transition">
          {props.paused ? <Play size={18} /> : <Pause size={18} />}
        </button>
      </div>

      {/* hint bar */}
      {!props.inBattle && snap.hint && (
        <div className="absolute left-1/2 top-3 md:top-5 -translate-x-1/2 max-w-[46vw]">
          <div className="rounded-full border border-fuchsia-400/30 bg-[#0d0722]/80 px-4 py-1.5 backdrop-blur text-center">
            <span className="font-body text-xs md:text-sm font-semibold text-fuchsia-200/90 tracking-wide truncate block">{snap.hint}</span>
          </div>
        </div>
      )}

      {/* engage button */}
      {!props.inBattle && snap.engageName && !props.paused && (
        <button
          onClick={props.onEngage}
          className="pointer-events-auto anim-pop absolute bottom-[max(24px,env(safe-area-inset-bottom))] right-4 md:right-8 flex flex-col items-center gap-1 rounded-2xl border-2 border-amber-300/70 bg-gradient-to-br from-amber-400/25 to-orange-500/25 px-6 py-4 backdrop-blur shadow-[0_0_36px_rgba(251,191,36,.35)] hover:from-amber-400/40 hover:to-orange-500/40 active:scale-95 transition"
        >
          <span className="flex items-center gap-2 font-display text-base md:text-lg font-bold tracking-[0.2em] text-amber-200">
            <Crosshair size={20} /> ENGAGE
          </span>
          <span className="font-body text-[11px] font-semibold uppercase tracking-widest text-amber-100/80">
            {snap.engageName} · <KeyCap>E</KeyCap>
          </span>
        </button>
      )}

      {/* bottom-left controls hint (desktop) */}
      {!props.inBattle && (
        <div className="absolute bottom-[max(16px,env(safe-area-inset-bottom))] left-4 hidden md:flex items-center gap-3 text-[10px] font-body uppercase tracking-widest text-slate-500">
          <span className="flex items-center gap-1.5"><KeyCap>WASD</KeyCap> drive</span>
          <span className="flex items-center gap-1.5"><KeyCap>E</KeyCap> battle</span>
          <span className="flex items-center gap-1.5"><KeyCap>M</KeyCap> mute</span>
        </div>
      )}
    </div>
  );
}

// ---------------- BATTLE CARD BAR ----------------

export function BattleCardBar(props: { snap: BattleCardsSnap; onPlay: (i: number) => void }) {
  const { snap } = props;
  if (snap.cards.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="flex flex-col items-center gap-2">
        <div className={`anim-flicker rounded-full px-4 py-1 font-display text-[10px] tracking-[0.35em] border ${snap.yourTurn ? 'border-cyan-300/60 bg-cyan-400/10 text-cyan-200' : 'border-rose-400/50 bg-rose-500/10 text-rose-200'}`}>
          {snap.yourTurn ? 'YOUR TURN' : snap.locked ? '· · ·' : 'ENEMY TURN'}
        </div>
        <div className="flex items-end justify-center gap-2 md:gap-3 px-2">
          {snap.cards.map((cid, i) => {
            const c = CARDS[cid];
            const Icon = CARD_ICONS[cid];
            const cd = snap.cooldowns[i] ?? 0;
            const disabled = cd > 0 || !snap.yourTurn || snap.locked;
            return (
              <button
                key={`${cid}-${i}`}
                onClick={() => props.onPlay(i)}
                disabled={disabled}
                className="pointer-events-auto group relative w-[104px] md:w-[136px] rounded-xl border-2 bg-[#0d0722]/90 backdrop-blur px-2.5 md:px-3 py-2.5 md:py-3 text-left transition active:scale-95 disabled:opacity-45 disabled:saturate-50 enabled:hover:-translate-y-1.5"
                style={{ borderColor: c.color, boxShadow: disabled ? 'none' : `0 0 18px ${c.glow}` }}
              >
                <span className="absolute -top-2 left-2 rounded bg-[#0a0618] px-1.5 font-display text-[9px] text-slate-400 border border-slate-600/60">{i + 1}</span>
                {cd > 0 ? (
                  <span className="absolute -top-2 right-2 rounded bg-rose-500/90 px-1.5 font-display text-[9px] font-bold text-white">CD {cd}</span>
                ) : (
                  <span className="absolute -top-2 right-2 rounded px-1.5 font-display text-[9px] font-bold" style={{ background: c.color, color: '#0a0618' }}>
                    {c.kind === 'attack' ? 'ATK' : c.kind === 'heal' ? 'HP' : 'DEF'}
                  </span>
                )}
                <Icon size={20} style={{ color: c.color }} />
                <div className="mt-1 font-display text-[10px] md:text-[11px] font-bold tracking-wider text-white leading-tight">{c.name}</div>
                <div className="font-body text-[10px] font-semibold uppercase tracking-wide" style={{ color: c.color }}>{c.tag}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------- DRAFT OVERLAY ----------------

export function DraftOverlay(props: {
  req: DraftRequest;
  onConfirm: (cards: CardId[], teamIdx: number) => void;
  onCancel: () => void;
}) {
  const { req } = props;
  const [picked, setPicked] = useState<CardId[]>([]);
  const [teamIdx, setTeamIdx] = useState(0);

  useEffect(() => {
    setPicked([]);
    setTeamIdx(0);
  }, [req]);

  const toggle = (id: CardId) => {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? p : [...p, id]));
  };

  const ready = picked.length === 3 && req.team.length > 0;
  const foeSp = req.enemySpecies;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#05020f]/82 backdrop-blur-sm p-3 overflow-y-auto nice-scroll">
      <div className="anim-pop w-full max-w-4xl my-auto rounded-2xl border border-cyan-400/30 bg-[#0b0620]/95 shadow-[0_0_80px_rgba(34,211,238,.15)]">
        {/* header */}
        <div className="flex items-center justify-between border-b border-cyan-400/20 px-5 py-3">
          <div className="flex items-center gap-2 font-display text-sm md:text-base tracking-[0.25em] text-rose-300">
            <Swords size={18} /> {req.isTrainer ? 'RIVAL RIDER CHALLENGE' : 'WILD MECHANIMO DETECTED'}
          </div>
          <button onClick={props.onCancel} className="rounded-lg border border-slate-500/40 px-3 py-1.5 font-display text-[10px] tracking-widest text-slate-300 hover:bg-white/5 active:scale-95 transition">
            RETREAT
          </button>
        </div>

        <div className="grid gap-4 p-4 md:p-5 md:grid-cols-[240px_1fr]">
          {/* enemy panel */}
          <div className="rounded-xl border p-4 flex md:flex-col items-center gap-4" style={{ borderColor: `${foeSp.body}66`, background: `linear-gradient(160deg, ${foeSp.dark}33, transparent)` }}>
            <SpeciesOrb sp={foeSp} size={76} />
            <div className="text-center md:mt-2">
              <div className="font-display text-lg font-black tracking-widest" style={{ color: foeSp.accent }}>
                {req.isTrainer ? `${req.trainerName}'S ${foeSp.name}` : `WILD ${foeSp.name}`}
              </div>
              <div className="font-body text-xs uppercase tracking-widest text-slate-400">{foeSp.sub} · LV {req.enemyLevel}</div>
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 font-body text-[11px] font-semibold text-slate-200">HP {foeSp.hp}</span>
                <span className="rounded-full border px-2.5 py-0.5 font-body text-[11px] font-semibold" style={{ borderColor: `${foeSp.accent}55`, color: foeSp.accent }}>
                  {'★'.repeat(foeSp.rarity)}{'☆'.repeat(3 - foeSp.rarity)}
                </span>
              </div>
              <p className="mt-2 font-body text-xs leading-snug text-slate-300/85"><Sparkles size={11} className="inline mr-1" style={{ color: foeSp.accent }} />{foeSp.traitDesc}</p>
              {req.isTrainer && (
                <p className="mt-2 font-body text-[11px] font-semibold uppercase tracking-widest text-rose-300/90">Lose and they tame your newest Mechanimo!</p>
              )}
            </div>
          </div>

          {/* pickers */}
          <div className="min-w-0">
            {/* team */}
            <div className="font-display text-[10px] tracking-[0.3em] text-cyan-300/80 mb-1.5">YOUR FIGHTER</div>
            <div className="flex gap-2 overflow-x-auto nice-scroll pb-1">
              {req.team.map((t, i) => {
                const sp = SPECIES[t.species];
                const sel = i === teamIdx;
                return (
                  <button
                    key={t.uid}
                    onClick={() => setTeamIdx(i)}
                    className={`shrink-0 rounded-xl border-2 px-3 py-2 flex items-center gap-2 transition active:scale-95 ${sel ? 'bg-white/10' : 'bg-white/[.03] opacity-70 hover:opacity-100'}`}
                    style={{ borderColor: sel ? sp.accent : 'rgba(148,163,184,.25)', boxShadow: sel ? `0 0 16px ${sp.body}66` : 'none' }}
                  >
                    <Car size={18} style={{ color: sp.body }} />
                    <span className="text-left">
                      <span className="block font-display text-[11px] font-bold tracking-wider text-white">{sp.name}</span>
                      <span className="block font-body text-[10px] uppercase tracking-widest text-slate-400">LV {t.level} · {sp.trait}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* cards */}
            <div className="mt-3 font-display text-[10px] tracking-[0.3em] text-cyan-300/80">
              DRAFT 3 BATTLE CARDS <span className="text-fuchsia-300">({picked.length}/3)</span>
            </div>
            <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(CARDS) as CardId[]).map((id) => {
                const c = CARDS[id];
                const Icon = CARD_ICONS[id];
                const selIdx = picked.indexOf(id);
                const sel = selIdx >= 0;
                return (
                  <button
                    key={id}
                    onClick={() => toggle(id)}
                    className={`relative rounded-xl border-2 p-2.5 text-left transition active:scale-95 ${sel ? '-translate-y-0.5 bg-white/10' : 'bg-white/[.03] opacity-80 hover:opacity-100'}`}
                    style={{ borderColor: sel ? c.color : 'rgba(148,163,184,.22)', boxShadow: sel ? `0 0 18px ${c.glow}` : 'none' }}
                  >
                    {sel && (
                      <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full font-display text-[10px] font-black text-[#0a0618]" style={{ background: c.color }}>
                        {selIdx + 1}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Icon size={16} style={{ color: c.color }} />
                      <span className="font-display text-[11px] font-bold tracking-wider text-white">{c.name}</span>
                    </div>
                    <div className="mt-0.5 font-body text-[10px] font-bold uppercase tracking-wide" style={{ color: c.color }}>{c.tag}</div>
                    <p className="mt-1 font-body text-[11px] leading-tight text-slate-300/85">{c.desc}</p>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => ready && props.onConfirm(picked, teamIdx)}
              disabled={!ready}
              className="mt-4 w-full rounded-xl py-3.5 font-display text-sm font-bold tracking-[0.25em] transition active:scale-[0.98] disabled:opacity-35 disabled:saturate-50 bg-gradient-to-r from-orange-400 via-amber-300 to-cyan-300 text-[#0a0618] shadow-[0_0_30px_rgba(251,191,36,.35)] enabled:hover:brightness-110"
            >
              {ready ? 'LAUNCH MECHANIMO' : `PICK ${3 - picked.length} MORE CARD${picked.length === 2 ? '' : 'S'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- TAME PROMPT ----------------

export function TamePrompt(props: {
  species: SpeciesDef;
  tameCards: number;
  onTame: () => void;
  onRelease: () => void;
}) {
  const sp = props.species;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center pb-[max(18px,env(safe-area-inset-bottom))] px-3">
      <div className="pointer-events-auto anim-slide-up w-full max-w-md rounded-2xl border-2 p-4 backdrop-blur-md bg-[#0d0722]/92" style={{ borderColor: sp.accent, boxShadow: `0 0 40px ${sp.body}55` }}>
        <div className="flex items-center gap-3">
          <SpeciesOrb sp={sp} size={48} />
          <div className="flex-1 min-w-0">
            <div className="font-display text-sm font-black tracking-widest text-white">WILD {sp.name} IS DOWN!</div>
            <div className="font-body text-xs uppercase tracking-widest" style={{ color: sp.accent }}>
              {'★'.repeat(sp.rarity)} {sp.sub} — tame it to keep it
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={props.onTame}
            className="flex-1 rounded-xl bg-gradient-to-r from-fuchsia-400 to-purple-400 py-3 font-display text-xs md:text-sm font-bold tracking-[0.2em] text-[#0a0618] hover:brightness-110 active:scale-95 transition shadow-[0_0_24px_rgba(232,121,249,.4)]"
          >
            THROW TAME CARD ({props.tameCards})
          </button>
          <button
            onClick={props.onRelease}
            className="rounded-xl border border-slate-500/50 px-4 font-display text-xs tracking-[0.2em] text-slate-300 hover:bg-white/5 active:scale-95 transition"
          >
            LET GO
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- PAUSE ----------------

export function PauseOverlay(props: {
  muted: boolean;
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
  onMute: () => void;
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#05020f]/78 backdrop-blur-sm p-4">
      <div className="anim-pop w-full max-w-sm rounded-2xl border border-cyan-400/30 bg-[#0b0620]/95 p-6 text-center shadow-[0_0_60px_rgba(34,211,238,.15)]">
        <h2 className="font-display text-3xl font-black tracking-[0.3em] text-cyan-200 text-glow-cyan">PAUSED</h2>
        <div className="mt-6 flex flex-col gap-2.5">
          <button onClick={props.onResume} className="rounded-xl bg-gradient-to-r from-cyan-300 to-fuchsia-400 py-3 font-display text-sm font-bold tracking-[0.25em] text-[#0a0618] hover:brightness-110 active:scale-[0.98] transition">
            <span className="flex items-center justify-center gap-2"><Play size={16} className="fill-current" /> RESUME</span>
          </button>
          <button onClick={props.onRestart} className="rounded-xl border border-amber-300/50 bg-amber-400/10 py-3 font-display text-sm font-bold tracking-[0.25em] text-amber-200 hover:bg-amber-400/20 active:scale-[0.98] transition">
            <span className="flex items-center justify-center gap-2"><RotateCcw size={16} /> RESTART RUN</span>
          </button>
          <button onClick={props.onMenu} className="rounded-xl border border-slate-500/50 py-3 font-display text-sm font-bold tracking-[0.25em] text-slate-300 hover:bg-white/5 active:scale-[0.98] transition">
            <span className="flex items-center justify-center gap-2"><Home size={16} /> MAIN MENU</span>
          </button>
          <button onClick={props.onMute} className="rounded-xl border border-slate-500/40 py-2.5 font-body text-sm font-semibold tracking-widest text-slate-300 hover:bg-white/5 active:scale-[0.98] transition">
            <span className="flex items-center justify-center gap-2">{props.muted ? <VolumeX size={16} /> : <Volume2 size={16} />} {props.muted ? 'SOUND OFF' : 'SOUND ON'}</span>
          </button>
        </div>
        <p className="mt-4 font-body text-[11px] uppercase tracking-widest text-slate-500">P / ESC to resume</p>
      </div>
    </div>
  );
}

// ---------------- GAME OVER ----------------

export function GameOverOverlay(props: {
  stats: RunStats;
  isNewBest: boolean;
  canSubmit: boolean;
  scores: HiScoreEntry[];
  submitted: boolean;
  onSubmit: (name: string) => void;
  onRestart: () => void;
  onMenu: () => void;
}) {
  const [name, setName] = useState('ACE');
  const mins = Math.floor(props.stats.timeMs / 60000);
  const secs = Math.floor((props.stats.timeMs % 60000) / 1000);

  const statCells = useMemo(
    () => [
      { icon: Star, label: 'SCORE', value: props.stats.score.toLocaleString(), color: '#ffd166' },
      { icon: Bot, label: 'TAMED', value: String(props.stats.tames), color: '#e879f9' },
      { icon: Swords, label: 'WINS', value: String(props.stats.wins), color: '#4ade80' },
      { icon: Timer, label: 'SURVIVED', value: `${mins}:${String(secs).padStart(2, '0')}`, color: '#22d3ee' },
    ],
    [props.stats, mins, secs],
  );

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#05020f]/82 backdrop-blur-sm p-3 overflow-y-auto nice-scroll">
      <div className="anim-pop w-full max-w-lg my-auto rounded-2xl border border-rose-400/40 bg-[#0b0620]/95 p-6 text-center shadow-[0_0_70px_rgba(255,84,112,.2)]">
        <h2 className="font-display text-4xl md:text-5xl font-black tracking-[0.18em] text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-orange-300">
          WRECKED
        </h2>
        <p className="mt-1 font-body text-xs uppercase tracking-[0.3em] text-slate-400">The crew is out of repair wrenches</p>
        {props.isNewBest && (
          <div className="anim-flicker mx-auto mt-3 w-fit rounded-full border border-amber-300/60 bg-amber-400/15 px-4 py-1 font-display text-[11px] font-bold tracking-[0.3em] text-amber-300">
            NEW HIGH SCORE
          </div>
        )}

        <div className="mt-5 grid grid-cols-4 gap-2">
          {statCells.map((c) => (
            <div key={c.label} className="rounded-xl border border-white/10 bg-white/[.04] px-1 py-3">
              <c.icon size={16} className="mx-auto" style={{ color: c.color }} />
              <div className="mt-1 font-display text-sm md:text-base font-bold text-white tabular-nums">{c.value}</div>
              <div className="font-body text-[9px] uppercase tracking-[0.2em] text-slate-500">{c.label}</div>
            </div>
          ))}
        </div>

        {props.canSubmit && !props.submitted && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-400/10 p-2">
            <span className="pl-2 font-display text-[10px] tracking-[0.25em] text-amber-300">TAG:</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'A')}
              maxLength={3}
              className="w-16 rounded-lg border border-amber-300/50 bg-[#0a0618] px-2 py-2 text-center font-display text-lg font-black tracking-[0.3em] text-white outline-none focus:border-amber-300"
            />
            <button
              onClick={() => props.onSubmit(name.padEnd(3, '·'))}
              className="flex-1 rounded-lg bg-gradient-to-r from-amber-300 to-orange-400 py-2 font-display text-xs font-bold tracking-[0.25em] text-[#0a0618] hover:brightness-110 active:scale-95 transition"
            >
              SAVE SCORE
            </button>
          </div>
        )}

        {props.scores.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-300/25 bg-white/[.03] p-3 text-left">
            <h3 className="font-display text-[10px] tracking-[0.3em] text-amber-300 flex items-center gap-2 justify-center"><Trophy size={12} /> HALL OF FAME</h3>
            <div className="mt-2 space-y-1">
              {props.scores.map((s, i) => (
                <div key={i} className={`flex items-center justify-between font-body text-sm ${props.submitted && i === 0 ? 'text-amber-200' : 'text-slate-300'}`}>
                  <span className="w-7 font-display text-cyan-300/80">{i + 1}.</span>
                  <span className="flex-1 font-display tracking-widest text-xs">{s.name}</span>
                  <span className="mr-3 text-[10px] text-slate-500 uppercase">{s.tames} tamed · {s.wins} wins</span>
                  <span className="font-display text-amber-300 tabular-nums">{s.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex gap-2.5">
          <button onClick={props.onRestart} className="flex-1 rounded-xl bg-gradient-to-r from-cyan-300 to-fuchsia-400 py-3.5 font-display text-sm font-bold tracking-[0.25em] text-[#0a0618] hover:brightness-110 active:scale-[0.98] transition shadow-[0_0_30px_rgba(34,211,238,.35)]">
            <span className="flex items-center justify-center gap-2"><RotateCcw size={16} /> RESTART <KeyCap>R</KeyCap></span>
          </button>
          <button onClick={props.onMenu} className="rounded-xl border border-slate-500/50 px-5 font-display text-sm font-bold tracking-[0.25em] text-slate-300 hover:bg-white/5 active:scale-[0.98] transition">
            <Home size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- TOASTS ----------------

export interface ToastMsg {
  id: number;
  msg: string;
  color: string;
}

export function Toasts({ list }: { list: ToastMsg[] }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-16 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      {list.map((t) => (
        <div
          key={t.id}
          className="anim-pop rounded-full border px-4 py-1.5 backdrop-blur bg-[#0d0722]/90 font-display text-[11px] font-bold tracking-[0.2em]"
          style={{ borderColor: `${t.color}88`, color: t.color, boxShadow: `0 0 18px ${t.color}44` }}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}
