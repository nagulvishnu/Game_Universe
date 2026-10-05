import type { Result } from '../game/game';
import { ScoreTable } from './Menu';

export function Pause({ onResume, onRestart, onQuit, muted, onMute, isTouch }: { onResume: () => void; onRestart: () => void; onQuit: () => void; muted: boolean; onMute: () => void; isTouch: boolean }) {
  return (
    <div className="absolute inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 z-20">
      <div className="panel p-6 w-full max-w-sm menu-in text-center">
        <div className="font-display font-black text-3xl text-amber-300 mb-1">PAUSED</div>
        <div className="text-xs text-slate-400 tracking-widest mb-5">{isTouch ? 'TAP RESUME TO CONTINUE' : 'CLICK RESUME OR PRESS P / ESC'}</div>
        <div className="flex flex-col gap-2.5">
          <button onClick={onResume} className="btn-primary py-3 font-display text-lg">RESUME</button>
          <button onClick={onRestart} className="btn-ghost py-2.5 rounded">↻ RESTART MATCH</button>
          <button onClick={onMute} className="btn-ghost py-2.5 rounded">{muted ? '🔇 SOUND OFF' : '🔊 SOUND ON'}</button>
          <button onClick={onQuit} className="btn-ghost py-2.5 rounded text-red-300">QUIT TO MENU</button>
        </div>
      </div>
    </div>
  );
}

export function GameOver({ r, rank, onRestart, onMenu }: { r: Result; rank: number; onRestart: () => void; onMenu: () => void }) {
  const mm = `${Math.floor(r.time / 60)}:${String(r.time % 60).padStart(2, '0')}`;
  return (
    <div className="absolute inset-0 overflow-y-auto bg-black/70 backdrop-blur-sm z-20">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="panel w-full max-w-lg p-5 sm:p-6 menu-in text-center">
          {r.win ? (
            <>
              <div className="text-5xl float-slow">🏆</div>
              <div className="font-display font-black text-3xl sm:text-4xl text-amber-300" style={{ textShadow: '0 0 28px rgba(251,191,36,0.6)' }}>WINNER WINNER!</div>
              <div className="text-slate-300 tracking-widest text-sm mt-1">LAST ONE STANDING</div>
            </>
          ) : (
            <>
              <div className="font-display font-black text-3xl sm:text-4xl text-red-400">ELIMINATED</div>
              <div className="text-slate-300 tracking-widest text-sm mt-1">YOU PLACED <b className="text-white text-xl font-display">#{r.place}</b> OF {r.total}</div>
            </>
          )}
          {rank === 0 && <div className="mt-2 pulse-text text-amber-300 font-display font-bold tracking-widest">★ NEW HIGH SCORE ★</div>}
          <div className="grid grid-cols-4 gap-2 mt-4">
            {[['KILLS', r.kills], ['DAMAGE', r.dmg], ['HEADSHOTS', r.hs], ['SURVIVED', mm]].map(([k, v]) => (
              <div key={k as string} className="bg-white/5 rounded py-2">
                <div className="font-display text-xl font-extrabold">{v}</div>
                <div className="text-[9px] tracking-widest text-slate-400">{k}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 bg-gradient-to-r from-amber-500/10 via-amber-400/25 to-amber-500/10 rounded py-3 border border-amber-400/30">
            <div className="text-[11px] tracking-[0.3em] text-amber-200">TOTAL SCORE</div>
            <div className="font-display text-4xl font-black text-amber-300">{r.score}</div>
            {rank >= 0 && <div className="text-xs text-slate-300">Rank #{rank + 1} on your local leaderboard</div>}
          </div>
          <div className="mt-4 text-left">
            <div className="text-[11px] tracking-[0.25em] text-slate-400 mb-1">🏆 HIGH SCORES</div>
            <ScoreTable highlight={rank} compact />
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={onMenu} className="btn-ghost px-5 py-3 rounded">MENU</button>
            <button onClick={onRestart} className="btn-primary flex-1 py-3 font-display text-lg">PLAY AGAIN ▶ <span className="text-xs opacity-70 hidden sm:inline">[ENTER]</span></button>
          </div>
        </div>
      </div>
    </div>
  );
}
