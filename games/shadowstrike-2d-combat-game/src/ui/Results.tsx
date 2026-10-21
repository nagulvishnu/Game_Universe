import { useGame } from '../stores/gameStore';
import { Button, Panel, Stat } from './shared';
import { OPPONENT_BY_ID } from '../data/fighters';
import { levelFromXp } from '../save/save';

export function ResultsScreen() {
  const result = useGame((s) => s.result);
  const profile = useGame((s) => s.profile);
  const rematch = useGame((s) => s.rematch);
  const exitToMenu = useGame((s) => s.exitToMenu);

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center">
        <Button onClick={exitToMenu}>Return to menu</Button>
      </div>
    );
  }

  const won = result.winner === 'p1';
  const draw = result.winner === 'draw';
  const opp = OPPONENT_BY_ID[result.opponentId];
  const lvl = levelFromXp(profile.xp);

  return (
    <div className="ss-grid-bg flex h-full w-full items-center justify-center overflow-auto bg-[#05050a] p-6">
      <div className="ss-fade w-full max-w-3xl space-y-4">
        <div className="text-center">
          <h1 className={`ss-title text-7xl ${won ? 'text-emerald-300' : draw ? 'text-slate-200' : 'text-rose-400'} drop-shadow-[0_0_28px_rgba(138,90,255,0.5)]`}>
            {draw ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT'}
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.4em] text-slate-400">
            {result.mode === 'fight' ? `${opp?.name ?? 'Opponent'} · ${result.difficulty}` : result.mode === 'pvp' ? 'Local Versus' : 'Training'}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Panel title="Performance" className="p-4">
            <Stat label="Rounds won" value={`${result.rounds[0]} — ${result.rounds[1]}`} />
            <Stat label="Damage dealt" value={Math.round(result.damageDealt)} color="#ff8a3a" />
            <Stat label="Damage taken" value={Math.round(result.damageTaken)} color="#ff5a7a" />
            <Stat label="Highest combo" value={`${result.highestCombo} hits`} color="#ffd34a" />
            <Stat label="Duration" value={`${(result.durationMs / 1000).toFixed(1)}s`} />
          </Panel>

          <Panel title="Rewards" className="p-4">
            {result.rewarded ? (
              <>
                <Stat label="Experience" value={`+${result.rewards.xp}`} color="#66e0ff" />
                <Stat label="Shadow shards" value={`+${result.rewards.shards}`} color="#ffb000" />
                <Stat label="Levels gained" value={result.rewards.levelUps} color="#b06bff" />
                <Stat label="Current level" value={`${lvl.level} (${lvl.into}/${lvl.need} XP)`} />
                <div className="mt-2 h-2 border border-white/10 bg-black/60">
                  <div className="h-full bg-gradient-to-r from-violet-500 to-cyan-400"
                    style={{ width: `${(lvl.into / lvl.need) * 100}%` }} />
                </div>
                {result.rewards.unlocked.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="text-[10px] uppercase tracking-widest text-amber-300">Unlocked</div>
                    {result.rewards.unlocked.map((u) => (
                      <div key={u} className="ss-slide border border-amber-300/30 bg-amber-400/10 px-2 py-1 text-xs text-amber-100">{u}</div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm leading-relaxed text-slate-400">
                {result.mode === 'training'
                  ? 'Training sessions never award XP, shards or achievements.'
                  : 'Local versus matches are friendly — no competitive rewards are granted so progression cannot be farmed.'}
              </p>
            )}
          </Panel>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={rematch}>↻ Rematch</Button>
          <Button variant="ghost" onClick={() => useGame.getState().setScreen('fight-select')}>Change opponent</Button>
          <Button variant="ghost" onClick={exitToMenu}>Main menu</Button>
        </div>
      </div>
    </div>
  );
}
