import { useEffect, useMemo, useState } from 'react';
import { PLAYER_LOOKS } from '../data/player';
import { TOURNAMENT_MAP } from '../data/tournaments';
import { live } from '../game/battle/live';
import { BATTLE_CFG } from '../game/battle/physics/sim';
import { beyType, computeStats } from '../game/customization/stats';
import { useGame, rivalStatus } from '../game/store';
import { audio } from '../game/audio/audio';
import { Bar, Btn, Portrait, StatRows } from './ui';

const FINISH_LABEL: Record<string, string> = { SPIN: 'SPIN FINISH', RING_OUT: 'RING OUT!', BURST: 'BURST FINISH!!' };

function useLive(ms = 90) {
  const [, setN] = useState(0);
  useEffect(() => { const id = setInterval(() => setN((n) => n + 1), ms); return () => clearInterval(id); }, [ms]);
  return live;
}

export function BattleHud() {
  const battle = useGame((s) => s.battle);
  const save = useGame((s) => s.save);
  const overlay = useGame((s) => s.overlay);
  const L = useLive();
  if (!battle) return null;
  const { setup, phase } = battle;
  const opp = setup.opponent;
  const mine = computeStats(setup.playerBey);
  const theirs = computeStats(opp.bey);
  const playerLook = PLAYER_LOOKS[save.profile.outfit % PLAYER_LOOKS.length].look;
  const rivalProg = setup.rivalId ? save.rivals[setup.rivalId] : null;
  const label = { rival: 'RIVAL ENCOUNTER', tournament: 'TOURNAMENT MATCH', quick: 'QUICK BATTLE', training: 'TRAINING' }[setup.mode];

  return (
    <div className="arena-battle-hud pointer-events-none absolute inset-0 z-10">
      {/* top HUD */}
      {phase !== 'intro' && (
        <div className="arena-battle-top absolute inset-x-0 top-3 flex items-start justify-center gap-4 px-6">
          <div className="arena-battle-player panel w-[min(430px,38vw)] p-3">
            <div className="flex items-baseline justify-between"><span className="title-font text-lg text-cyan-300">{save.profile.name}</span><span className="text-xs text-white/70">{setup.playerBey.name}</span></div>
            <Bar value={L.stamina[0]} color={L.stamina[0] < 25 ? '#ff4d6d' : '#35d0ff'} />
            <div className="mt-1 flex items-center justify-between text-[10px]"><span>STAMINA {Math.round(L.stamina[0])}%</span><span className="flex items-center gap-1">BURST<span className="inline-block w-20"><Bar value={L.burst[0]} max={BATTLE_CFG.burstThreshold} color="#ff9d2e" /></span></span></div>
          </div>
          <div className="panel flex w-40 flex-col items-center px-3 py-1 text-center">
            <div className="text-[9px] font-bold tracking-[0.3em] text-yellow-300">{label}</div>
            <div className="title-font text-3xl tabular-nums">{Math.floor(L.time / 60)}:{String(Math.floor(L.time % 60)).padStart(2, '0')}</div>
            {rivalProg && (
              <div className="flex items-center gap-0.5">{Array.from({ length: 5 }, (_, i) => <span key={i} className={`h-2 w-4 skew-x-[-18deg] border border-white/40 ${i < rivalProg.points ? 'bg-yellow-300' : 'bg-black/40'}`} />)}</div>
            )}
            {setup.round && <div className="text-[10px] text-pink-300">{setup.round}</div>}
          </div>
          <div className="arena-battle-player panel w-[min(430px,38vw)] p-3">
            <div className="flex items-baseline justify-between"><span className="text-xs text-white/70">{opp.bey.name}</span><span className="title-font text-lg text-pink-300">{opp.name}</span></div>
            <Bar value={L.stamina[1]} color={L.stamina[1] < 25 ? '#ff4d6d' : '#ff3d9a'} />
            <div className="mt-1 flex items-center justify-between text-[10px]"><span className="flex items-center gap-1">BURST<span className="inline-block w-20"><Bar value={L.burst[1]} max={BATTLE_CFG.burstThreshold} color="#ff9d2e" /></span></span><span>STAMINA {Math.round(L.stamina[1])}%</span></div>
          </div>
        </div>
      )}

      {phase === 'intro' && (
        <div className="absolute inset-0 flex flex-col">
          <div className="title-font pop mt-6 text-center text-5xl text-white drop-shadow-[0_4px_0_#ff3d9a]">{setup.mode === 'tournament' && setup.round ? setup.round : label}</div>
          <div className="mt-auto flex items-end justify-between gap-4 p-6">
            <IntroCard side="left" name={save.profile.name} title="Challenger" bey={setup.playerBey.name} type={beyType(mine)} stats={mine} look={playerLook} />
            <div className="title-font mb-24 text-8xl text-yellow-300 drop-shadow-[0_6px_0_#c0182e]">VS</div>
            <IntroCard side="right" name={opp.name} title={opp.title} bey={opp.bey.name} type={beyType(theirs)} stats={theirs} look={opp.look} extra={`${opp.difficulty} · ${opp.strategy}`} />
          </div>
          <div className="pb-2 text-center text-xs text-white/70 pulse">Click or press Space to skip</div>
        </div>
      )}

      {phase === 'countdown' && (
        <div className="absolute inset-0 flex flex-col items-center justify-start pt-28">
          {L.count > 0 ? <div key={L.count} className="title-font pop text-[160px] leading-none text-white drop-shadow-[0_8px_0_#ff3d9a]">{L.count}</div> : <div className="title-font pop text-8xl text-yellow-300">LET IT RIP!</div>}
          <div className="panel mt-4 w-[min(560px,90vw)] p-3 text-center">
            <div className="text-xs font-bold uppercase tracking-widest text-cyan-200">Launch Power — press SPACE in the gold zone!</div>
            <div className="relative mt-2 h-6 overflow-hidden rounded border-2 border-white/50 bg-black/60">
              <div className="absolute inset-y-0 bg-gradient-to-r from-rose-600 via-yellow-300 to-rose-600" style={{ left: 0, right: 0, opacity: 0.55 }} />
              <div className="absolute inset-y-0 bg-yellow-200/90" style={{ left: '40%', width: '20%' }} />
              <div className="absolute inset-y-0 w-1.5 bg-white shadow-[0_0_10px_#fff]" style={{ left: `${L.meter * 100}%` }} />
            </div>
            <div className="mt-1 text-sm font-bold">{L.meterLocked ? `Locked! Launch power ${Math.round(L.power * 100)}%` : 'Timing…'}</div>
          </div>
        </div>
      )}

      {phase === 'fight' && (
        <>
          <div className="arena-battle-help absolute inset-x-0 bottom-4 flex flex-col items-center gap-2">
            <div className="panel flex items-center gap-4 px-5 py-2 text-xs">
              <span><b className="text-yellow-300">WASD / Arrows</b> steer</span>
              <span className="flex items-center gap-2"><b className="text-yellow-300">SPACE</b> dash<span className="inline-block w-24"><Bar value={BATTLE_CFG.dashCooldown - L.dashCd} max={BATTLE_CFG.dashCooldown} color={L.dashCd > 0 ? '#888' : '#ffd24a'} /></span></span>
              <span><b className="text-yellow-300">Esc</b> pause</span>
              <span className="text-white/60">Avoid the red gaps · Opp. style: {L.oppStrategy}</span>
            </div>
          </div>
          {L.lowFlash > 0 && <div className="title-font pulse absolute inset-x-0 top-28 text-center text-4xl text-rose-400 drop-shadow-[0_3px_0_#000]">LOW STAMINA!</div>}
          {setup.tutorial && !overlay && <Tutorial />}
        </>
      )}

      {phase === 'finish' && L.finish && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="pop title-font text-[110px] leading-none text-white drop-shadow-[0_8px_0_#c0182e]" style={{ WebkitTextStroke: '3px #14101f' }}>{FINISH_LABEL[L.finish.finish]}</div>
          <div className="title-font mt-2 text-3xl text-yellow-300">{L.finish.winner === 0 ? save.profile.name : opp.name} wins!</div>
        </div>
      )}
    </div>
  );
}

function IntroCard({ side, name, title, bey, type, stats, look, extra }: { side: 'left' | 'right'; name: string; title: string; bey: string; type: string; stats: ReturnType<typeof computeStats>; look: any; extra?: string }) {
  return (
    <div className={`panel w-[min(430px,44vw)] p-4 ${side === 'left' ? 'slide-in' : 'slide-in'} flex gap-3`} style={{ flexDirection: side === 'left' ? 'row' : 'row-reverse' }}>
      <Portrait look={look} size={120} />
      <div className="flex-1">
        <div className={`title-font text-2xl ${side === 'left' ? 'text-cyan-300' : 'text-pink-300'}`}>{name}</div>
        <div className="text-xs text-yellow-200">{title}{extra && ` · ${extra}`}</div>
        <div className="mt-1 text-sm font-bold">⚙ {bey} <span className="chip">{type}</span></div>
        <div className="mt-2"><StatRows stats={stats} /></div>
      </div>
    </div>
  );
}

function Tutorial() {
  const save = useGame((s) => s.save);
  const t = save.training;
  const L = live;
  const items: [string, boolean][] = [
    ['Steer your top with WASD', L.moved], ['Press SPACE to dash (costs stamina)', L.dashed], ['Collide with the opponent', L.collided],
    ['Win by SPIN (opponent runs out of stamina)', t.spin], ['Win by RING_OUT (push them into a red gap)', t.ringOut], ['Win by BURST (accumulate impact damage)', t.burst],
  ];
  return (
    <div className="panel absolute left-4 top-32 w-72 p-3 text-xs">
      <div className="title-font text-lg text-yellow-300">Training Guide</div>
      {items.map(([txt, ok]) => <div key={txt} className={ok ? 'text-emerald-300' : 'text-white/80'}>{ok ? '✔' : '○'} {txt}</div>)}
      <div className="mt-2 text-white/60">Stamina drains over time and from hits. Heavy hits fill the BURST gauge — fill it to burst the enemy top! Training results never affect rival or tournament progress.</div>
    </div>
  );
}

export function ResultScreen() {
  const g = useGame();
  const b = g.battle!;
  const s = b.summary!;
  const setup = b.setup;
  const rivalStat = setup.rivalId ? rivalStatus(g.save, setup.rivalId) : null;
  const confetti = useMemo(() => Array.from({ length: 60 }, (_, i) => ({ l: (i * 37) % 100, d: 1.5 + ((i * 13) % 20) / 6, c: ['#ffd24a', '#35d0ff', '#ff3d9a', '#7aff9a'][i % 4], dl: (i % 10) / 8 })), []);
  const isWorld = s.tournament?.champion && s.tournament.name === 'World Championship';
  useEffect(() => { if (s.levelUps.length) audio.levelUp(); }, [s.levelUps.length]);
  const canRematch = setup.mode === 'quick' || setup.mode === 'training' || (setup.mode === 'rival' && rivalStat?.available);
  const done = () => {
    const venue = setup.tournamentId ? TOURNAMENT_MAP[setup.tournamentId].venue : '';
    g.leaveBattle();
    if (setup.mode === 'tournament') setTimeout(() => useGame.getState().openOverlay('tournament', { venue }), 1600);
  };
  const row = (k: string, v: React.ReactNode, color = '') => <div className="flex justify-between border-b border-white/10 py-1 text-sm"><span className="text-white/70">{k}</span><b className={color}>{v}</b></div>;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60" onPointerDown={(e) => e.stopPropagation()}>
      {s.won && <div className="pointer-events-none absolute inset-0 overflow-hidden">{confetti.map((c, i) => <i key={i} className="absolute -top-4 h-3 w-2" style={{ left: `${c.l}%`, background: c.c, animation: `confetti ${c.d + 2}s linear ${c.dl}s infinite` }} />)}</div>}
      <div className="panel slide-up w-[min(860px,95vw)] p-6">
        <div className={`title-font text-center text-7xl ${s.won ? 'text-yellow-300' : 'text-rose-400'} drop-shadow-[0_5px_0_rgba(0,0,0,.6)]`}>{isWorld ? 'WORLD CHAMPION!' : s.won ? 'VICTORY' : 'DEFEAT'}</div>
        <div className="text-center text-lg"><b className="text-cyan-300">{s.playerName}</b> vs <b className="text-pink-300">{s.opponentName}</b> — <span className="chip">{s.finish.replace('_', ' ')}</span> · {s.time.toFixed(1)}s</div>
        {s.tournament && <div className="mt-1 text-center text-sm text-yellow-200">{s.tournament.name} · {s.tournament.round}{s.tournament.champion ? ' · CHAMPION! 🏆' : s.tournament.eliminated ? ' · Eliminated' : ' · Advanced!'}</div>}
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <div className="title-font text-xl text-cyan-300">Battle Report</div>
            {row('Winner', s.won ? s.playerName : s.opponentName)}
            {row('Finish', s.finish.replace('_', ' '))}
            {row('Duration', `${s.time.toFixed(1)} s`)}
            {row('Your stamina left', `${Math.round(s.stamina[0])}%`)}
            {row('Opponent stamina left', `${Math.round(s.stamina[1])}%`)}
            {s.encounter && (
              <div className="mt-3">
                <div className="title-font text-lg text-yellow-300">Encounter Progress</div>
                <div className="flex items-center gap-1">{Array.from({ length: 5 }, (_, i) => <span key={i} className={`h-4 w-8 skew-x-[-18deg] border border-white/40 ${i < s.encounter!.total ? 'bg-yellow-300' : 'bg-black/40'}`} />)}<b className="ml-2">{s.encounter.total}/5</b></div>
                <div className="text-xs text-white/70">{s.encounter.awarded} point{s.encounter.awarded > 1 ? 's' : ''} for {s.finish.replace('_', ' ')}{s.encounter.excess > 0 && ` (${s.encounter.excess} excess discarded)`}</div>
                {s.encounter.justDefeated && <div className="title-font text-xl text-emerald-300">{s.opponentName} DEFEATED!</div>}
              </div>
            )}
            {setup.mode === 'rival' && !s.won && <div className="mt-2 text-xs text-white/70">Encounter score unchanged on a loss.</div>}
          </div>
          <div>
            <div className="title-font text-xl text-pink-300">Rewards</div>
            {s.note ? <div className="mt-2 rounded border border-white/20 bg-black/30 p-3 text-sm">{s.note}</div> : (
              <>
                {s.transfer && row('Battle transfer', `${s.transfer.direction === 'loss' ? '−' : '+'}${s.transfer.amount.toLocaleString()} pts`, s.transfer.direction === 'loss' ? 'text-rose-300' : 'text-emerald-300')}
                {s.prize > 0 && row(setup.mode === 'tournament' ? 'Match prize' : 'Victory prize', `+${s.prize.toLocaleString()} pts`, 'text-emerald-300')}
                {s.bonus && row('Special challenge bonus!', `+${s.bonus.points.toLocaleString()} pts${s.bonus.part ? ' + new part' : ''}`, 'text-yellow-300')}
                {row('XP gained', `+${s.xp}`)}
                {row('Reputation', `+${s.rep}`)}
                {row('Balance', `${s.pointsAfter.toLocaleString()} pts`, 'text-cyan-200')}
                {row('Level', `${s.levelAfter}`)}
                {s.tournament?.champion && s.tournament.prize ? row('Championship prize', `+${s.tournament.prize.toLocaleString()} pts`, 'text-yellow-300') : null}
                {s.tournament?.part && row('New component unlocked', s.tournament.part.replace(/-/g, ' '), 'text-yellow-300')}
              </>
            )}
            {s.levelUps.length > 0 && <div className="mt-2 rounded border border-yellow-300/60 bg-yellow-300/10 p-2 text-sm"><b className="title-font text-yellow-300">LEVEL UP! → {s.levelUps[s.levelUps.length - 1]}</b>{s.unlocks.length > 0 && <div className="text-xs">Unlocked: {s.unlocks.join(', ')}</div>}</div>}
          </div>
        </div>
        <div className="mt-5 flex justify-center gap-4">
          {canRematch && <Btn kind="pink" onClick={() => g.rematch()}>Rematch</Btn>}
          <Btn kind="gold" onClick={done}>{setup.mode === 'tournament' ? 'Back to Bracket' : setup.returnTo === 'city' ? 'Return to City' : 'Back to Menu'}</Btn>
        </div>
      </div>
    </div>
  );
}
