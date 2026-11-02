import { useState } from 'react';
import { TOURNAMENTS, TOURNAMENT_MAP, type TournamentDef } from '../data/tournaments';
import { STADIUM_MAP } from '../data/stadiums';
import { PART_MAP } from '../data/parts';
import { useGame, type Fighter } from '../game/store';
import { checkTournament } from '../game/progression/rewards';
import { getCompetitor } from '../game/tournaments/competitors';
import { champion, isEliminated, matchPair, nextPlayerMatch, roundName, type ActiveTournament } from '../game/tournaments/bracket';
import { audio } from '../game/audio/audio';
import { Btn, Modal } from './ui';

function nameOf(id: string, playerName: string) { return id === 'player' ? playerName : getCompetitor(id).name; }

function Bracket({ a, playerName }: { a: ActiveTournament; playerName: string }) {
  const size = a.entrants.length;
  const rounds = a.winners.length;
  return (
    <div className="scroll flex gap-3 overflow-x-auto pb-2">
      {Array.from({ length: rounds }, (_, r) => (
        <div key={r} className="flex min-w-[170px] flex-col justify-around gap-2">
          <div className="title-font text-center text-sm text-yellow-300">{roundName(size, r)}</div>
          {a.winners[r].map((w, m) => {
            const [x, y] = matchPair(a, r, m);
            return (
              <div key={m} className="rounded border border-white/20 bg-black/40 text-xs">
                {[x, y].map((idx, k) => {
                  const nm = idx === null ? 'TBD' : nameOf(a.entrants[idx], playerName);
                  const win = w !== null && w === idx;
                  const lose = w !== null && idx !== null && w !== idx;
                  const me = idx !== null && a.entrants[idx] === 'player';
                  return <div key={k} className={`flex justify-between px-2 py-1 ${k === 0 ? 'border-b border-white/10' : ''} ${win ? 'bg-emerald-500/25 font-bold' : ''} ${lose ? 'text-white/35 line-through' : ''} ${me ? 'text-cyan-300' : ''}`}><span className="truncate">{nm}</span>{win && <span>✔</span>}</div>;
                })}
                {a.finishes[r][m] && <div className="px-2 pb-0.5 text-right text-[9px] text-pink-300">{a.finishes[r][m]!.replace('_', ' ')}</div>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function TournamentUI() {
  const g = useGame();
  const venue = g.overlayData?.venue as string | undefined;
  const list = TOURNAMENTS;
  const firstOpen = list.find((t) => g.save.tournaments[t.id].wins < 1) ?? list[list.length - 1];
  const [sel, setSel] = useState<string>(firstOpen.id);
  const t = TOURNAMENT_MAP[sel];
  const rec = g.save.tournaments[t.id];
  const act = rec.active;
  const missing = checkTournament(t, g.save);
  const playerName = g.save.profile.name;

  const play = (def: TournamentDef, a: ActiveTournament) => {
    const nm = nextPlayerMatch(a);
    if (!nm) return;
    const [x, y] = matchPair(a, nm.round, nm.match);
    const p = a.entrants.indexOf('player');
    const opp = getCompetitor(a.entrants[x === p ? y! : x!]);
    const f: Fighter = { id: opp.id, name: opp.name, title: opp.title, look: opp.look, bey: opp.bey, strategy: opp.strategy, difficulty: opp.difficulty };
    g.startBattle({ mode: 'tournament', tournamentId: def.id, opponent: f, stadium: def.stadium, round: `${def.name} — ${roundName(def.size, nm.round)}` });
  };

  const status = (d: TournamentDef) => {
    const r = g.save.tournaments[d.id];
    if (r.active?.status === 'active') return ['In progress', '#ffd24a'];
    if (r.wins > 0) return [`Champion ×${r.wins}`, '#38e08c'];
    return checkTournament(d, g.save).filter((m) => !m.startsWith('Entry')).length ? ['Locked', '#ff9d9d'] : ['Open', '#35d0ff'];
  };
  const nm = act && act.status === 'active' ? nextPlayerMatch(act) : null;
  const opp = act && nm ? getCompetitor(act.entrants[matchPair(act, nm.round, nm.match)[0] === act.entrants.indexOf('player') ? matchPair(act, nm.round, nm.match)[1]! : matchPair(act, nm.round, nm.match)[0]!]) : null;
  const champIdx = act ? champion(act) : null;

  return (
    <Modal title="Tournament Registration" sub={venue ?? 'Official competitions'} onClose={() => g.closeOverlay()} width="min(1120px,95vw)">
      <div className="grid gap-4 md:grid-cols-[250px_1fr]">
        <div className="space-y-2">
          {list.map((d) => {
            const [label, color] = status(d);
            return (
              <button key={d.id} onClick={() => { audio.click(); setSel(d.id); }} className={`w-full skew-x-[-6deg] border-2 p-2 text-left ${sel === d.id ? 'border-yellow-300 bg-yellow-300/10' : 'border-white/15 bg-black/30 hover:bg-white/10'}`}>
                <div className="title-font text-sm">{d.tier}. {d.name}</div>
                <div className="flex justify-between text-[10px]"><span>{d.size} bladers</span><b style={{ color }}>{label}</b></div>
              </button>
            );
          })}
        </div>
        <div>
          <div className="flex flex-wrap items-baseline gap-3"><span className="title-font text-3xl text-white">{t.name}</span><span className="chip">{t.size} competitors</span><span className="chip">{t.difficulty}</span><span className="chip">{STADIUM_MAP[t.stadium].name}</span></div>
          <p className="mt-1 text-sm text-cyan-100/80">{t.intro}</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-white/15 bg-black/30 p-3 text-sm">
              <div className="title-font text-lg text-yellow-300">Entry Requirements</div>
              {[
                [`Level ${t.req.level}`, g.save.level >= t.req.level],
                ...(t.req.prev ? [[`Win the ${TOURNAMENT_MAP[t.req.prev].name}`, g.save.tournaments[t.req.prev].wins > 0] as [string, boolean]] : []),
                [`Defeat ${t.req.rivals} rivals`, Object.values(g.save.rivals).filter((r) => r.defeated).length >= t.req.rivals],
                ...(t.req.points ? [[`Hold ${t.req.points.toLocaleString()} points (qualification target)`, g.save.points >= t.req.points] as [string, boolean]] : []),
                [`Entry fee ${t.fee.toLocaleString()} pts`, g.save.points >= t.fee],
              ].map(([txt, ok]) => <div key={txt as string} className={ok ? 'text-emerald-300' : 'text-rose-300'}>{ok ? '✔' : '✘'} {txt as string}</div>)}
              <div className="mt-2 text-xs text-white/70">Prize: <b className="text-yellow-200">{t.prize.toLocaleString()} pts</b> · XP {t.xp} · Rep +{t.rep}{t.rewardPart && <> · Reward part: <b>{PART_MAP[t.rewardPart]?.name}</b></>}</div>
              <div className="text-xs text-white/50">Each round win also pays {100 * t.tier} pts. Tournament matches carry no point transfer.</div>
            </div>
            <div className="rounded-lg border border-white/15 bg-black/30 p-3 text-sm">
              <div className="title-font text-lg text-pink-300">Your Run</div>
              {!act || act.status === 'active' && !nm ? <div className="text-white/60">{act ? 'Waiting for the bracket…' : 'You have not registered yet.'}</div> : null}
              {act && act.status === 'active' && nm && opp && (
                <div>
                  <div className="text-yellow-200">Next: {roundName(t.size, nm.round)}</div>
                  <div>vs <b>{opp.name}</b> · <span className="chip">{opp.difficulty}</span> <span className="chip">{opp.strategy}</span></div>
                  <div className="text-xs text-white/60">Top: {opp.bey.name}</div>
                </div>
              )}
              {act && act.status === 'won' && <div className="title-font text-xl text-emerald-300">Champion! 🏆</div>}
              {act && act.status === 'eliminated' && <div className="text-rose-300">Eliminated{isEliminated(act) ? '' : ''}. {champIdx !== null && <>Champion: <b>{nameOf(act.entrants[champIdx], playerName)}</b></>}</div>}
              <div className="mt-3 flex flex-wrap gap-2">
                {act && act.status === 'active' && nm && <Btn kind="gold" onClick={() => play(t, act)}>Play next match</Btn>}
                {(!act || act.status !== 'active') && <Btn kind="pink" disabled={missing.length > 0} onClick={() => g.registerTournament(t.id)}>{act ? 'Register again' : 'Register'} ({t.fee.toLocaleString()} pts)</Btn>}
              </div>
              {missing.length > 0 && (!act || act.status !== 'active') && <div className="mt-2 text-xs text-rose-200">Missing: {missing.join(' · ')}</div>}
              <div className="mt-2 text-[11px] text-white/50">Career: {rec.wins} title(s) · entered {rec.entered}× {rec.history.slice(-1)[0] && `· ${rec.history.slice(-1)[0].result}`}</div>
            </div>
          </div>
          {act && (
            <div className="mt-4">
              <div className="title-font text-lg text-cyan-300">Bracket</div>
              <Bracket a={act} playerName={playerName} />
              <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-white/60">Competitors: {act.entrants.map((id) => <span key={id} className="chip">{nameOf(id, playerName)}</span>)}</div>
            </div>
          )}
          {!act && (
            <div className="mt-4 text-xs text-white/60">Bracket is generated when you register. AI competitors fight each other with the same battle simulation — you must win every match yourself.</div>
          )}
        </div>
      </div>
    </Modal>
  );
}
