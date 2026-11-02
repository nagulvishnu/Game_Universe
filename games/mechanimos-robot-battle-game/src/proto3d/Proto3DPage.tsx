// Phase 7 — 3D vertical slice UI.
import { useEffect, useRef, useState, useCallback } from 'react';
import { Proto3DApp, type ProtoState } from './proto3d';
import { CARDS, CARD_IDS } from '../game/data';
import type { CardId } from '../game/types';

// ---------- Card selection overlay (pick exactly 3 of 6) ----------
function CardSelectOverlay({ onConfirm }: { onConfirm: (cards: CardId[]) => void }) {
  const [selected, setSelected] = useState<CardId[]>([]);
  const toggle = (id: CardId) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
      <div className="rounded-xl border border-cyan-500/50 bg-[#0a0618]/95 p-6 w-[480px] max-w-full font-mono">
        <div className="mb-4 text-center text-[13px] font-bold tracking-widest text-cyan-300">
          SELECT 3 BATTLE CARDS
        </div>
        <div className="mb-2 text-center text-[11px] text-cyan-400/70">
          {selected.length}/3 selected — cards are locked for the entire battle but reusable
        </div>
        <div className="grid grid-cols-3 gap-3 mb-5">
          {CARD_IDS.map((id) => {
            const card = CARDS[id];
            const sel = selected.includes(id);
            const disabled = !sel && selected.length >= 3;
            return (
              <button
                key={id}
                onClick={() => toggle(id)}
                disabled={disabled}
                className={[
                  'rounded-lg border p-3 text-left transition-all',
                  sel
                    ? 'border-cyan-400 bg-cyan-900/40 shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                    : disabled
                    ? 'border-white/10 bg-white/5 opacity-40 cursor-not-allowed'
                    : 'border-white/20 bg-white/5 hover:border-cyan-500/60 hover:bg-cyan-900/20 cursor-pointer',
                ].join(' ')}
              >
                <div className="text-[11px] font-bold tracking-wide" style={{ color: card.color }}>
                  {card.name}
                </div>
                <div className="mt-1 text-[10px] text-white/60">{card.tag}</div>
                <div className="mt-1 text-[9px] text-white/40 leading-tight">{card.desc}</div>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => selected.length === 3 && onConfirm(selected)}
          disabled={selected.length !== 3}
          className="w-full rounded-lg border border-cyan-500 bg-cyan-900/40 py-2 text-[12px] font-bold tracking-widest text-cyan-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-cyan-800/50 transition-colors"
        >
          CONFIRM SELECTION
        </button>
      </div>
    </div>
  );
}

// ---------- HP bar ----------
function HpBar({ label, hp, maxHp, color }: { label: string; hp: number; maxHp: number; color: string }) {
  const pct = maxHp > 0 ? Math.max(0, hp / maxHp) : 0;
  return (
    <div className="min-w-[140px]">
      <div className="flex justify-between text-[10px] mb-1">
        <span className="font-bold tracking-wide" style={{ color }}>{label}</span>
        <span className="text-white/70">{hp}/{maxHp}</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${(pct * 100).toFixed(1)}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ---------- Locked card bar ----------
function LockedCardBar({
  cards,
  cooldowns,
  playerTurn,
  busy,
  onPlay,
}: {
  cards: CardId[];
  cooldowns: [number, number, number];
  playerTurn: boolean;
  busy: boolean;
  onPlay: (idx: number) => void;
}) {
  return (
    <div className="flex gap-3 justify-center">
      {cards.map((id, i) => {
        const card = CARDS[id];
        const cd = cooldowns[i] ?? 0;
        const canPlay = playerTurn && !busy && cd === 0;
        return (
          <button
            key={i}
            onClick={() => canPlay && onPlay(i)}
            disabled={!canPlay}
            className={[
              'relative rounded-lg border p-3 w-[130px] text-left transition-all font-mono',
              canPlay
                ? 'border-cyan-400/80 bg-cyan-900/30 hover:bg-cyan-800/40 cursor-pointer shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                : 'border-white/15 bg-white/5 opacity-60 cursor-not-allowed',
            ].join(' ')}
          >
            <div className="text-[10px] font-bold tracking-wide" style={{ color: card.color }}>{card.name}</div>
            <div className="mt-1 text-[9px] text-white/60">{card.tag}</div>
            {cd > 0 && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/60">
                <span className="text-[13px] font-bold text-amber-300">CD {cd}</span>
              </div>
            )}
            <div className="mt-1 text-[9px] text-cyan-400/60">[ {i + 1} ]</div>
          </button>
        );
      })}
    </div>
  );
}

// ---------- Encounter intro panel ----------
function EncounterIntroPanel({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
      <div className="rounded-xl border border-orange-500/60 bg-[#0a0618]/95 p-6 w-[360px] max-w-full font-mono text-center">
        <div className="text-[11px] text-orange-400/80 tracking-widest mb-1">OPPONENT DETECTED</div>
        <div className="text-[20px] font-bold tracking-widest text-orange-300 mb-1">SENTINEL-X</div>
        <div className="text-[11px] text-white/50 mb-4">PROTOTYPE ADVERSARY · NOT CANON</div>
        <div className="text-[11px] text-white/70 mb-5 leading-relaxed">
          A hostile prototype blocks your path.<br />
          Transform and engage, or retreat.
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onConfirm}
            className="rounded-lg border border-orange-500 bg-orange-900/30 px-5 py-2 text-[12px] font-bold tracking-widest text-orange-200 hover:bg-orange-800/40 transition-colors"
          >
            [ E ] TRANSFORM &amp; FIGHT
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-[12px] tracking-widest text-white/60 hover:bg-white/10 transition-colors"
          >
            [ ESC ] RETREAT
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Battle result panel ----------
function BattleResultPanel({ outcome, onContinue }: { outcome: 'victory' | 'defeat'; onContinue: () => void }) {
  const win = outcome === 'victory';
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/75 z-20">
      <div className={[
        'rounded-xl border p-8 w-[340px] max-w-full font-mono text-center',
        win ? 'border-yellow-400/60 bg-[#0a0618]/95' : 'border-red-500/60 bg-[#0a0618]/95',
      ].join(' ')}>
        <div className={['text-[28px] font-bold tracking-widest mb-2', win ? 'text-yellow-300' : 'text-red-400'].join(' ')}>
          {win ? 'VICTORY!' : 'DEFEATED'}
        </div>
        <div className="text-[12px] text-white/60 mb-6">
          {win ? 'SENTINEL-X has been neutralised.' : 'AURORA-01 systems critical.'}
        </div>
        <button
          onClick={onContinue}
          className={[
            'w-full rounded-lg border py-2 text-[12px] font-bold tracking-widest transition-colors',
            win
              ? 'border-yellow-400 bg-yellow-900/30 text-yellow-200 hover:bg-yellow-800/40'
              : 'border-cyan-500 bg-cyan-900/30 text-cyan-200 hover:bg-cyan-800/40',
          ].join(' ')}
        >
          [ E ] TRANSFORM BACK &amp; CONTINUE
        </button>
      </div>
    </div>
  );
}

// ---------- Main page ----------
export default function Proto3DPage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Proto3DApp | null>(null);
  const [state, setState] = useState<ProtoState | null>(null);
  const [cardSelectOpen, setCardSelectOpen] = useState(false);

  const refresh = useCallback(() => {
    const app = appRef.current;
    if (!app) return;
    setState(app.getState());
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const app = new Proto3DApp(host);
    appRef.current = app;
    app.onStateChange = refresh;
    (window as unknown as { __proto3d: Proto3DApp }).__proto3d = app;
    const ui = window.setInterval(refresh, 150);
    return () => {
      window.clearInterval(ui);
      app.dispose();
      appRef.current = null;
      delete (window as unknown as { __proto3d?: Proto3DApp }).__proto3d;
    };
  }, [refresh]);

  // Open card selection when battle phase begins and no cards locked yet
  useEffect(() => {
    if (state?.slicePhase === 'battle' && !state.lockedCards) {
      setCardSelectOpen(true);
    } else if (state?.slicePhase !== 'battle') {
      setCardSelectOpen(false);
    }
  }, [state?.slicePhase, state?.lockedCards]);

  const handleCardConfirm = useCallback((cards: CardId[]) => {
    setCardSelectOpen(false);
    appRef.current?.startBattleWithCards(cards);
  }, []);

  const handlePlayCard = useCallback((idx: number) => {
    appRef.current?.playCard(idx);
  }, []);

  const sp = state?.slicePhase ?? 'explore';
  const inBattle = sp === 'battle';
  const showBattleHud = inBattle && state?.lockedCards != null;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <div ref={hostRef} className="absolute inset-0" />

      {/* Encounter intro */}
      {sp === 'encounterIntro' && (
        <EncounterIntroPanel
          onConfirm={() => appRef.current?.confirmEncounter()}
          onCancel={() => appRef.current?.cancelEncounter()}
        />
      )}

      {/* Card selection */}
      {cardSelectOpen && <CardSelectOverlay onConfirm={handleCardConfirm} />}

      {/* Battle result */}
      {sp === 'battleResult' && state?.battleOutcome && (
        <BattleResultPanel
          outcome={state.battleOutcome}
          onContinue={() => appRef.current?.continueAfterBattle()}
        />
      )}

      {/* Battle HUD — HP bars */}
      {showBattleHud && state && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3 font-mono">
          <div className="flex justify-between gap-4">
            <HpBar label="AURORA-01" hp={state.playerHp} maxHp={state.playerMaxHp} color="#22d3ee" />
            <div className="text-[11px] text-white/40 self-center tracking-widest">VS</div>
            <HpBar label="SENTINEL-X" hp={state.opponentHp} maxHp={state.opponentMaxHp} color="#ff6a00" />
          </div>
          {state.playerTurn && !state.battleBusy && (
            <div className="text-center text-[11px] text-cyan-300 animate-pulse tracking-widest">
              YOUR MOVE — PICK A CARD &nbsp;[ 1 ] [ 2 ] [ 3 ]
            </div>
          )}
          {!state.playerTurn && !state.battleBusy && (
            <div className="text-center text-[11px] text-orange-400/80 tracking-widest">
              SENTINEL-X IS ACTING…
            </div>
          )}
        </div>
      )}

      {/* Locked card bar */}
      {showBattleHud && state?.lockedCards && (
        <div className="pointer-events-auto absolute inset-x-0 bottom-16 z-10 flex justify-center">
          <LockedCardBar
            cards={state.lockedCards as CardId[]}
            cooldowns={state.cardCooldowns}
            playerTurn={state.playerTurn}
            busy={state.battleBusy}
            onPlay={handlePlayCard}
          />
        </div>
      )}

      {/* Main HUD overlay */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 font-mono text-cyan-200 select-none">
        <div className="flex items-start justify-between">
          <div className="rounded border border-cyan-500/40 bg-black/60 p-3 text-[11px] leading-5 backdrop-blur-sm">
            <div className="mb-1 text-[13px] font-bold tracking-widest text-cyan-300">
              MECHANIMOS · 3D SLICE
            </div>
            <div className="text-amber-200/90">AURORA-01 · PROTOTYPE — NOT CANON</div>
            {sp === 'explore' && (
              <div className="mt-2 text-cyan-100/90">
                W/A/S/D — drive &amp; steer<br />
                DRAG — orbit · WHEEL — zoom<br />
                T — transform to robot · G — return<br />
                J — attack · Q — quality · B — bench<br />
                <span className="text-orange-300">Approach SENTINEL-X to encounter</span>
              </div>
            )}
            {sp === 'toRobot' && (
              <div className="mt-2 text-fuchsia-300 animate-pulse">TRANSFORMING…</div>
            )}
            {sp === 'toCar' && (
              <div className="mt-2 text-fuchsia-300 animate-pulse">REVERTING…</div>
            )}
            {inBattle && !state?.lockedCards && (
              <div className="mt-2 text-yellow-300 animate-pulse">SELECT YOUR 3 BATTLE CARDS</div>
            )}
            {state?.encounterInRange && sp === 'explore' && (
              <div className="mt-2 text-orange-300 animate-pulse">SENTINEL-X IN RANGE — APPROACHING…</div>
            )}
          </div>
          <a
            href="./"
            className="pointer-events-auto rounded border border-cyan-500/50 bg-black/60 px-3 py-2 text-[11px] tracking-widest text-cyan-200 hover:bg-cyan-900/40"
          >
            ← BACK TO 2D GAME
          </a>
        </div>

        <div className="flex items-end justify-between">
          <div className="rounded border border-cyan-500/40 bg-black/60 px-3 py-2 text-[11px] leading-5 backdrop-blur-sm">
            {state ? (
              <>
                <div>
                  MODE:{' '}
                  <span className="text-cyan-300">
                    {state.t >= 0.999 ? 'ROBOT' : state.t <= 0.001 ? 'CAR' : 'TRANSFORMING'}
                  </span>
                </div>
                <div>STAGE: <span className="text-fuchsia-300">{state.stage}</span></div>
                <div className="mt-1 border-t border-cyan-500/30 pt-1">
                  FPS: <span className="text-emerald-300">{state.fps.toFixed(0)}</span>
                  {' · '}FRAME: {state.frameMs.toFixed(1)}ms (p95 {state.p95Ms.toFixed(1)})
                </div>
                <div>
                  CALLS: <span className="text-amber-200">{state.drawCalls}</span>
                  {' · '}TRIS: {(state.triangles / 1000).toFixed(1)}k
                  {' · '}Q: {state.quality.toUpperCase()}
                </div>
                <div className="text-cyan-400/80">
                  SHADOWS: {state.shadows ? 'ON' : 'OFF'} · DPR: {state.dpr.toFixed(2)}
                </div>
                {state.benchRunning && (
                  <div className="mt-1 animate-pulse text-amber-300">● BENCHMARK RUNNING…</div>
                )}
              </>
            ) : (
              <div>LOADING…</div>
            )}
          </div>
          <div className="text-right text-[10px] text-cyan-400/70">
            proto3d · phase 7 · three.js slice
          </div>
        </div>
      </div>
    </div>
  );
}
