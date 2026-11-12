import { useCallback, useEffect, useRef, useState } from 'react';
import { audio } from './game/audio';
import { courtById, type CourtId, type MatchConfig, type ModeId } from './game/constants';
import { input } from './game/input';
import { STAGES, arcadeScore, buildMatch, finishRound, newTournament, simulateRest, stageMatch, tournamentMatchConfig, type Setup, type Tournament } from './game/modes';
import type { SimEvent } from './game/sim';
import { addScore, getData, update, useData } from './game/store';
import { GameView } from './game/view/gameView';
import { Hud, PauseMenu, Results, TouchControls, type Rect, type ResultData } from './ui/Hud';
import { Garage, Menu, SetupScreen, type ScreenName } from './ui/screens1';
import { ChampScreen, HelpScreen, ScoresScreen, SettingsScreen, StatsScreen, TournamentScreen } from './ui/screens2';

type Screen = ScreenName | 'playing' | 'results';

export default function App() {
  const data = useData();
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<GameView | null>(null);
  const bus = useRef(new Set<(e: SimEvent) => void>()).current;
  const [screen, setScreen] = useState<Screen>('menu');
  const [setupMode, setSetupMode] = useState<ModeId>('quick');
  const [paused, setPaused] = useState(false);
  const [rects, setRects] = useState<Rect[]>([]);
  const [result, setResult] = useState<ResultData | null>(null);
  const [tour, setTour] = useState<Tournament | null>(null);
  const [helpFrom, setHelpFrom] = useState<Screen>('menu');
  const [, force] = useState(0);
  const pausedRef = useRef(false);
  const screenRef = useRef<Screen>('menu');
  const resultDone = useRef(false);
  const lastSim = useRef<unknown>(null);

  const touch = data.settings.touch === 'on' || (data.settings.touch === 'auto' && typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);
  screenRef.current = screen;

  const go = useCallback((s: Screen) => {
    audio.click();
    setScreen(s);
  }, []);

  // --- create the 3D view once
  useEffect(() => {
    const v = new GameView(hostRef.current!);
    viewRef.current = v;
    v.onLayout = (r) => setRects(r);
    v.onEvent = (e) => {
      bus.forEach((f) => f(e));
      if (e.type === 'matchover') handleMatchOver();
    };
    v.onPause = () => togglePause();
    setRects(v.getRects());
    const initAudio = () => {
      audio.apply(getData().settings);
      audio.init();
      audio.apply(getData().settings);
      audio.startCrowd();
      if (screenRef.current !== 'playing') audio.startMusic('menu');
    };
    window.addEventListener('pointerdown', initAudio, { once: true });
    window.addEventListener('keydown', initAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', initAudio);
      window.removeEventListener('keydown', initAudio);
      v.dispose();
      viewRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- apply settings
  const prevQ = useRef(data.settings.quality);
  useEffect(() => {
    const v = viewRef.current;
    const s = data.settings;
    if (v) {
      v.settings = s;
      if (prevQ.current !== s.quality) {
        prevQ.current = s.quality;
        v.applyQuality();
      }
    }
    audio.apply(s);
    input.pad = s.pad;
    input.padFor = s.padFor;
  }, [data.settings]);

  const setPause = (p: boolean) => {
    pausedRef.current = p;
    setPaused(p);
    const v = viewRef.current;
    if (v) v.paused = p;
  };
  const togglePause = () => {
    if (screenRef.current !== 'playing') return;
    setPause(!pausedRef.current);
  };

  // --- launching matches
  const launch = (cfg: MatchConfig) => {
    const v = viewRef.current;
    if (!v) return;
    audio.init();
    audio.apply(getData().settings);
    resultDone.current = false;
    setResult(null);
    setPause(false);
    v.startMatch(cfg);
    lastSim.current = v.sim;
    setRects(v.getRects());
    setScreen('playing');
    force((n) => n + 1);
  };
  const startSetup = (s: Setup) => {
    if (s.mode === 'tournament') {
      setTour(newTournament(s, getData()));
      setScreen('tournament');
      return;
    }
    launch(buildMatch(s, getData()));
  };
  const openSetup = (m: ModeId) => {
    audio.click();
    setSetupMode(m);
    viewRef.current?.setCourt('neon');
    setScreen('setup');
  };
  const rematch = () => {
    const v = viewRef.current;
    if (!v || !v.sim) return;
    resultDone.current = false;
    setResult(null);
    setPause(false);
    v.restart();
    lastSim.current = v.sim;
    setScreen('playing');
    force((n) => n + 1);
  };
  const toMenu = (to: Screen = 'menu') => {
    const v = viewRef.current;
    setPause(false);
    setResult(null);
    v?.leaveMatch();
    setScreen(to);
  };

  // --- end of match: scoring, stats, high scores
  const handleMatchOver = () => {
    const v = viewRef.current;
    const sim = v?.sim;
    if (!v || !sim || sim.cfg.mode === 'demo' || resultDone.current) return;
    resultDone.current = true;
    const cfg = sim.cfg;
    const humans = sim.humans();
    const humanTeams: number[] = [...new Set(humans.map((h) => h.team as number))];
    const w = sim.playerWinner;
    let score = 0;
    let rank = -1;
    let won = humanTeams.includes(w);
    let title: string;
    if (sim.drill) {
      score = sim.drill.score;
      won = true;
      title = cfg.mode === 'challenge' ? "Time's Up!" : 'Session Complete';
      const p1 = getData().p1.name;
      if (score > 0) rank = addScore({ name: p1, score, mode: cfg.label, detail: `${sim.drill.hits} returns · ${sim.drill.perfects} perfect` });
    } else {
      const versus = humanTeams.length > 1;
      const winnerHuman = sim.teamPlayers(w).find((p) => p.human);
      title = versus ? `${winnerHuman?.spec.name ?? 'Player'} wins!` : won ? 'Victory!' : 'Defeat';
      for (const t of humanTeams) {
        const sc = arcadeScore(sim.stats[t], t === w, sim.maxRally, cfg.multiplier);
        const nm = sim.teamPlayers(t).filter((p) => p.human).map((p) => p.spec.name).join(' & ');
        const r = addScore({ name: nm, score: sc, mode: cfg.label, detail: `${sim.score.sets.map((s) => s.join('-')).join(' ')} ${t === w ? 'W' : 'L'}` });
        if (t === 0 || humanTeams.length === 1) {
          score = sc;
          rank = r;
        }
      }
    }
    // career stats
    update((d) => {
      const st = sim.stats[humanTeams[0] ?? 0];
      d.stats.matches += sim.drill ? 0 : 1;
      if (won && !sim.drill) d.stats.wins++;
      d.stats.points += sim.drill ? sim.drill.hits : st.points;
      d.stats.aces += st.aces;
      d.stats.winners += st.winners;
      d.stats.perfects += sim.drill ? sim.drill.perfects : st.perfects;
      d.stats.maxRally = Math.max(d.stats.maxRally, sim.maxRally);
      d.stats.seconds += Math.round(sim.time);
    });
    setResult({ won, humanTeams, title, score, rank, newBest: rank === 0 });
    setScreen('results');
  };

  // --- tournament & championship continuation
  const continueAfter = () => {
    const v = viewRef.current;
    const sim = v?.sim;
    if (!sim) return toMenu();
    const cfg = sim.cfg;
    const won = result?.won ?? false;
    if (cfg.mode === 'tournament' && tour) {
      const text = sim.score.sets.map((s) => `${s[0]}-${s[1]}`).join(' ') || '—';
      const next = finishRound(tour, won, text);
      if (next.champion === 0) update((d) => (d.stats.trophies += 1));
      setTour(next);
      toMenu('tournament');
    } else if (cfg.mode === 'champ') {
      const idx = Number(cfg.meta?.stage ?? 0);
      if (won) {
        const oppGames = sim.score.sets.reduce((a, s) => a + s[1], 0);
        const stars = 1 + (oppGames <= 2 ? 1 : 0) + (sim.stats[0].perfects >= 8 ? 1 : 0);
        update((d) => {
          d.champ.stage = Math.max(d.champ.stage, idx + 1);
          d.champ.stars[idx] = Math.max(d.champ.stars[idx] ?? 0, stars);
          if (idx === STAGES.length - 1) {
            d.stats.trophies += 1;
            d.stats.champWins += 1;
          }
        });
      }
      toMenu('champ');
    } else toMenu();
  };

  // --- keyboard shortcuts for overlays
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const sc = screenRef.current;
      if (sc === 'results' && !e.repeat && (e.code === 'KeyR' || e.code === 'Enter' || e.code === 'NumpadEnter')) {
        const cfg = viewRef.current?.sim?.cfg;
        if (cfg?.mode === 'tournament') return;
        e.preventDefault();
        rematch();
      } else if (sc === 'playing' && pausedRef.current && !e.repeat && e.code === 'KeyR') {
        rematch();
      } else if (!['menu', 'playing', 'results'].includes(sc) && e.code === 'Escape') {
        leaveSub();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const leaveSub = () => {
    if (screenRef.current === 'garage') viewRef.current?.exitGarage();
    setScreen(screenRef.current === 'help' && helpFrom !== 'menu' ? helpFrom : 'menu');
  };

  const sim = viewRef.current?.sim;
  const inMatch = screen === 'playing' || screen === 'results';
  const view = viewRef.current;

  // when a screen changes to a non-match screen, make sure we don't leave the garage preview stuck
  useEffect(() => {
    if (screen === 'garage') {
      const d = getData();
      viewRef.current?.setGarage(d.p1.name, d.p1.look);
    }
  }, [screen]);

  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ background: '#070a1c' }}>
      <div ref={hostRef} className="absolute inset-0" />

      {screen === 'menu' && <Menu go={(s) => go(s)} startMode={openSetup} />}
      {screen === 'setup' && (
        <SetupScreen
          key={setupMode}
          mode={setupMode}
          touch={touch}
          champStage={data.champ.stage}
          onBack={() => go('menu')}
          onStart={startSetup}
          onCourt={(id: CourtId) => view?.setCourt(id)}
        />
      )}
      {screen === 'garage' && (
        <Garage
          onBack={() => {
            view?.exitGarage();
            go('menu');
          }}
          onPreview={(n, l) => view?.setGarage(n, l)}
          onSwing={() => view?.garageSwing()}
        />
      )}
      {screen === 'stats' && <StatsScreen onBack={() => go('menu')} />}
      {screen === 'scores' && <ScoresScreen onBack={() => go('menu')} />}
      {screen === 'settings' && <SettingsScreen onBack={() => go(screenRef.current === 'settings' && inMatch ? 'playing' : 'menu')} />}
      {screen === 'help' && <HelpScreen onBack={() => go(helpFrom === 'playing' ? 'playing' : 'menu')} />}
      {screen === 'tournament' &&
        (tour ? (
          <TournamentScreen
            t={tour}
            onBack={() => go('menu')}
            onPlay={() => launch(tournamentMatchConfig(tour, getData()))}
            onSimRest={() => {
              const n = simulateRest(tour);
              setTour(n);
            }}
            onNew={() => {
              setTour(null);
              openSetup('tournament');
            }}
          />
        ) : (
          <SetupScreen key="tour" mode="tournament" touch={touch} champStage={data.champ.stage} onBack={() => go('menu')} onStart={startSetup} onCourt={(id) => view?.setCourt(id)} />
        ))}
      {screen === 'champ' && (
        <ChampScreen
          onBack={() => go('menu')}
          onPlay={(i) => {
            launch(stageMatch(i, getData()));
          }}
        />
      )}

      {screen === 'playing' && sim && view && (
        <>
          <Hud view={view} sim={sim} rects={rects} bus={bus} touch={touch} onPause={togglePause} />
          {touch && !paused && <TouchControls />}
          {rects.length > 1 && <SplitDivider rects={rects} />}
          {paused && (
            <PauseMenu
              view={view}
              isDrill={!!sim.drill}
              onResume={() => setPause(false)}
              onRestart={rematch}
              onFinish={sim.drill ? () => { setPause(false); sim.endSession(); } : undefined}
              onQuit={() => toMenu('menu')}
            />
          )}
        </>
      )}
      {screen === 'results' && sim && result && (
        <Results
          sim={sim}
          data={result}
          onRematch={rematch}
          noRematch={sim.cfg.mode === 'tournament'}
          onMenu={() => toMenu('menu')}
          onContinue={sim.cfg.mode === 'tournament' || sim.cfg.mode === 'champ' ? continueAfter : undefined}
          continueLabel={sim.cfg.mode === 'tournament' ? 'Back to bracket' : 'Back to championship'}
        />
      )}
      {screen === 'playing' && (
        <div className="hidden">{courtById(view?.courtId ?? 'neon').name}</div>
      )}
      {screen === 'menu' && (
        <button className="chip absolute right-3 bottom-3 z-30 opacity-80" onClick={() => { setHelpFrom('menu'); go('help'); }}>
          ⌨ Controls
        </button>
      )}
    </div>
  );
}

function SplitDivider({ rects }: { rects: Rect[] }) {
  const a = rects[0];
  const b = rects[1];
  const vertical = b.x > a.x;
  return <div className="absolute z-20 pointer-events-none" style={vertical ? { left: a.x + a.w, top: 0, width: b.x - (a.x + a.w), bottom: 0, background: '#c6ff3a', boxShadow: '0 0 12px #c6ff3a' } : { top: a.y + a.h, left: 0, height: b.y - (a.y + a.h), right: 0, background: '#c6ff3a', boxShadow: '0 0 12px #c6ff3a' }} />;
}
