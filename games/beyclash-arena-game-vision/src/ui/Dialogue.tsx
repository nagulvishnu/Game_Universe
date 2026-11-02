import { useEffect, useMemo, useState } from 'react';
import { NPCS, RIVAL_MAP } from '../data/rivals';
import { useGame, rivalStatus, type Fighter } from '../game/store';
import { beyType, computeStats, power } from '../game/customization/stats';
import { audio } from '../game/audio/audio';
import { DIFFICULTIES, type RivalDef } from '../game/types';
import { DISTRICT_MAP } from '../game/world/layout';
import { Btn, Portrait, StatRows } from './ui';

const DISTRICT_STADIUM: Record<string, string> = { residential: 'park', shopping: 'park', training: 'dojo', competition: 'arena', elite: 'neon', championship: 'gold' };
const DIFF_COLOR = ['#7ee787', '#a6e22e', '#ffd24a', '#ff9d2e', '#ff4d6d', '#c06bff'];

export const rivalFighter = (r: RivalDef): Fighter => ({ id: r.id, name: r.name, title: r.title, look: r.look, bey: r.bey, strategy: r.strategy, difficulty: r.difficulty });
export const rivalStadium = (r: RivalDef) => DISTRICT_STADIUM[r.district] ?? 'arena';

export function Dialogue() {
  const g = useGame();
  const data = g.overlayData as { kind: 'rival' | 'npc'; id: string; surprise?: boolean };
  const rival = data.kind === 'rival' ? RIVAL_MAP[data.id] : null;
  const npc = data.kind === 'npc' ? NPCS.find((n) => n.id === data.id)! : null;
  const status = rival ? rivalStatus(g.save, rival.id) : null;
  const [mode, setMode] = useState<'talk' | 'challenge'>('talk');
  const [line, setLine] = useState('');
  const [talkIdx, setTalkIdx] = useState(0);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (rival) {
      g.markMet(rival.id);
      setLine(data.surprise && rival.lines.surprise ? rival.lines.surprise : status!.defeated ? rival.lines.defeated : status!.locked ? rival.lines.locked : rival.lines.greet);
    } else if (npc) setLine(npc.lines[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.id]);

  // typewriter effect
  useEffect(() => {
    setShown(0);
    const id = setInterval(() => setShown((n) => { if (n >= line.length) { clearInterval(id); return n; } return n + 2; }), 18);
    return () => clearInterval(id);
  }, [line]);

  const look = (rival ?? npc!).look;
  const name = (rival ?? npc!).name;
  const sub = rival ? rival.title : npc!.role;
  const district = (rival ?? npc!).district;

  const talk = () => {
    audio.click();
    setMode('talk');
    if (rival) {
      const lines = [rival.personality, ...rival.lines.talk];
      const i = talkIdx % lines.length;
      setLine(lines[i]); setTalkIdx(talkIdx + 1);
    } else {
      const i = (talkIdx + 1) % npc!.lines.length;
      setLine(npc!.lines[i]); setTalkIdx(talkIdx + 1);
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex justify-center p-4" onPointerDown={(e) => e.stopPropagation()}>
      <div className="panel slide-up flex w-[min(1000px,96vw)] gap-5 p-4">
        <div className="relative shrink-0">
          <Portrait look={look} size={170} />
          <div className="absolute -bottom-2 left-0 right-0 text-center"><span className="chip" style={{ borderColor: DISTRICT_MAP[district].color, background: DISTRICT_MAP[district].color + '33' }}>{DISTRICT_MAP[district].name}</span></div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <span className="title-font text-3xl text-white">{name}</span>
            <span className="text-sm font-semibold text-yellow-200">{sub}</span>
            {rival && <span className="chip">{rival.category}</span>}
            {rival && <span className="chip" style={{ borderColor: DIFF_COLOR[DIFFICULTIES.indexOf(rival.difficulty)], color: DIFF_COLOR[DIFFICULTIES.indexOf(rival.difficulty)] }}>{rival.difficulty}</span>}
            {data.surprise && <span className="chip pulse" style={{ color: '#ff4d6d', borderColor: '#ff4d6d' }}>Surprise Challenge!</span>}
          </div>
          {mode === 'talk' ? (
            <>
              <div className="mt-2 min-h-[84px] flex-1 rounded-lg border border-white/15 bg-black/35 p-3 text-lg leading-snug">“{line.slice(0, shown)}”</div>
              {rival && status!.locked && (
                <div className="mt-2 text-xs text-rose-200">🔒 Requirements: {status!.missing.join(' · ')}</div>
              )}
              {rival && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="font-bold uppercase tracking-widest text-cyan-200">Encounter</span>
                  {Array.from({ length: 5 }, (_, i) => <span key={i} className={`h-3 w-6 skew-x-[-18deg] border border-white/40 ${i < status!.points ? 'bg-yellow-300' : 'bg-black/40'}`} />)}
                  <span>{status!.points}/5 {status!.defeated && '· DEFEATED'}</span>
                  <span className="ml-3 text-white/50">SPIN +1 · RING_OUT +2 · BURST +3</span>
                </div>
              )}
            </>
          ) : rival ? <ChallengePanel rival={rival} /> : null}
          <div className="mt-3 flex gap-3">
            <Btn onClick={talk}>Talk</Btn>
            {rival && <Btn kind="pink" disabled={!status!.available} title={status!.locked ? 'Requirements not met' : status!.defeated ? 'Already defeated' : ''} onClick={() => setMode(mode === 'challenge' ? 'talk' : 'challenge')}>{status!.defeated ? 'Defeated ✓' : status!.locked ? 'Locked 🔒' : mode === 'challenge' ? 'Back' : 'Challenge'}</Btn>}
            <Btn kind="ghost" onClick={() => { audio.back(); g.closeOverlay(); }}>Leave</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChallengePanel({ rival }: { rival: RivalDef }) {
  const g = useGame();
  const mine = useMemo(() => computeStats(g.save.config), [g.save.config]);
  const theirs = useMemo(() => computeStats(rival.bey), [rival]);
  const p = g.save.rivals[rival.id];
  const sp = power(mine), tp = power(theirs);
  return (
    <div className="mt-2 grid flex-1 grid-cols-[1fr_auto_1fr] gap-4 rounded-lg border border-white/15 bg-black/35 p-3 text-xs">
      <div>
        <div className="title-font text-lg text-cyan-300">{g.save.config.name}</div>
        <StatRows stats={mine} />
      </div>
      <div className="flex flex-col items-center justify-center gap-1 text-center">
        <div className="title-font text-3xl text-pink-400">VS</div>
        <div className="text-[11px] text-white/70">Power {sp} / {tp}</div>
        <div className="text-[11px] text-yellow-200">Prize ≈ {rival.reward.toLocaleString()} pts + 250 transfer</div>
        <div className="text-[11px]">Wager: winner takes up to 250 pts</div>
        <div className="text-[11px]">Rival wallet: {p.wallet.toLocaleString()}</div>
        {rival.special && !p.bonusClaimed && <div className="max-w-[220px] text-[11px] font-bold text-emerald-300">★ {rival.special.desc}</div>}
        <Btn kind="gold" onClick={() => g.startBattle({ mode: 'rival', rivalId: rival.id, opponent: rivalFighter(rival), stadium: rivalStadium(rival) })}>Start Battle!</Btn>
      </div>
      <div>
        <div className="title-font text-lg text-pink-300">{rival.bey.name} <span className="text-xs text-white/60">({beyType(theirs)} · {rival.strategy})</span></div>
        <StatRows stats={theirs} compare={mine} />
      </div>
    </div>
  );
}
