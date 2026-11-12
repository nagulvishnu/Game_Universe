import { useState } from 'react';
import { DIFFICULTIES, FX_NAMES, OUTFIT_NAMES, PALETTE, PERSONALITIES, RACKET_COLORS, RULE_PRESETS, SKIN_TONES, TRAIL_NAMES, type CourtId, type ModeId, type Personality } from '../game/constants';
import { CHALLENGE_DRILLS, DRILLS, defaultSetup, type Setup } from '../game/modes';
import { update, useData } from '../game/store';
import { Btn, Chips, CourtPicker, Logo, Screen, Section } from './kit';

const hexCss = (c: number) => '#' + c.toString(16).padStart(6, '0');
export type ScreenName = 'menu' | 'setup' | 'garage' | 'stats' | 'scores' | 'settings' | 'help' | 'tournament' | 'champ';

export function Menu({ go, startMode }: { go: (s: ScreenName) => void; startMode: (m: ModeId) => void }) {
  const d = useData();
  const best = d.scores[0];
  const items: { icon: string; label: string; sub: string; on: () => void }[] = [
    { icon: '⚡', label: 'Quick Match', sub: 'Singles or doubles — start immediately', on: () => startMode('quick') },
    { icon: '🎮', label: 'Local Multiplayer', sub: '2 players · split-screen versus', on: () => startMode('versus') },
    { icon: '🤖', label: 'Play Against AI', sub: '6 difficulty levels · 4 personalities', on: () => startMode('solo') },
    { icon: '🤝', label: 'Doubles Co-op', sub: 'You + a friend vs 2 AI', on: () => startMode('coop') },
    { icon: '🏆', label: 'Tournaments', sub: '8-entry bracket · trophy ceremony', on: () => go('tournament') },
    { icon: '🎯', label: 'Practice', sub: 'Serve, target, perfect-hit, movement', on: () => startMode('practice') },
    { icon: '⏱️', label: 'Time Challenge', sub: '60 s score attack · local high scores', on: () => startMode('challenge') },
    { icon: '🌟', label: 'Championship', sub: `Stage ${Math.min(d.champ.stage + 1, 6)} / 6 · unlock courts`, on: () => go('champ') },
    { icon: '👕', label: 'Garage', sub: 'Colors, outfits, rackets, trails', on: () => go('garage') },
    { icon: '📊', label: 'Statistics', sub: `${d.stats.matches} matches · ${d.stats.wins} wins`, on: () => go('stats') },
    { icon: '🥇', label: 'High Scores', sub: best ? `Best: ${best.score.toLocaleString()}` : 'Local leaderboard', on: () => go('scores') },
    { icon: '⚙️', label: 'Settings', sub: 'Audio, camera, quality, gamepad', on: () => go('settings') },
    { icon: '❓', label: 'Controls', sub: 'Keyboard · gamepad · touch', on: () => go('help') },
  ];
  return (
    <div className="absolute inset-0 flex items-stretch pointer-events-none">
      <div className="pointer-events-auto flex flex-col w-full sm:w-[400px] p-4 sm:p-6 slide-in" style={{ background: 'linear-gradient(90deg, rgba(5,7,24,.92), rgba(5,7,24,.55) 80%, transparent)' }}>
        <Logo />
        <div className="scroll flex-1 min-h-0 pr-1 grid grid-cols-1 gap-2 content-start">
          {items.map((it, i) => (
            <div key={it.label} className="fade-up" style={{ animationDelay: `${i * 35}ms` }}>
              <Btn icon={it.icon} sub={it.sub} onClick={it.on}>
                {it.label}
              </Btn>
            </div>
          ))}
        </div>
        <div className="text-[11px] opacity-60 pt-2">Tip: P1 = WASD · 1-4 shots · Space special · Shift sprint</div>
      </div>
    </div>
  );
}

const MODE_INFO: Record<string, { title: string; desc: string }> = {
  quick: { title: 'Quick Match', desc: 'Choose format, court and rules — then play.' },
  versus: { title: 'Local Multiplayer', desc: 'Two humans, split-screen. P1: WASD · P2: Arrow keys.' },
  solo: { title: 'Play Against AI', desc: 'A physically moving opponent that reads the ball.' },
  coop: { title: 'Doubles Co-op', desc: 'Two humans share a side against two AI. Split-screen.' },
  tournament: { title: 'AI Tournament', desc: 'Win the Quarterfinal, Semifinal and Final for the trophy.' },
  practice: { title: 'Practice', desc: 'Pick a drill. No pressure.' },
  challenge: { title: 'Time Challenge', desc: 'Beat the clock and post a high score.' },
};

export function SetupScreen({ mode, onBack, onStart, onCourt, touch, champStage }: { mode: ModeId; onBack: () => void; onStart: (s: Setup) => void; onCourt: (id: CourtId) => void; touch: boolean; champStage: number }) {
  const [s, setS] = useState<Setup>(() => defaultSetup(mode));
  const info = MODE_INFO[mode] ?? MODE_INFO.quick;
  const set = (p: Partial<Setup>) => setS((o) => ({ ...o, ...p }));
  const drill = mode === 'practice' || mode === 'challenge';
  const diffOptions = mode === 'coop' ? [3, 4, 5].map((i) => ({ v: i + 1, label: DIFFICULTIES[i] })) : DIFFICULTIES.map((n, i) => ({ v: i + 1, label: n }));
  const rulesCustom = RULE_PRESETS.find((p) => p.id === s.rulePreset) === undefined;
  return (
    <Screen
      title={info.title}
      sub={info.desc}
      onBack={onBack}
      footer={
        <Btn primary onClick={() => onStart(s)} icon="▶">
          {mode === 'tournament' ? 'Create Bracket' : drill ? 'Start Session' : 'Start Match'}
        </Btn>
      }
    >
      {(mode === 'versus' || mode === 'coop') && touch && <div className="mb-4 text-sm text-amber-300">⚠ Two-player split-screen needs two keyboards sets or gamepads. Player 2 uses the arrow keys / second gamepad.</div>}
      {drill && (
        <Section label={mode === 'practice' ? 'Drill' : 'Challenge'}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DRILLS.filter((x) => mode === 'practice' || CHALLENGE_DRILLS.includes(x.id)).map((x) => (
              <button key={x.id} onClick={() => set({ drill: x.id })} className="text-left rounded-xl p-3 border transition-all hover:scale-[1.02]" style={{ borderColor: s.drill === x.id ? '#c6ff3a' : 'rgba(255,255,255,.15)', background: s.drill === x.id ? 'rgba(198,255,58,.14)' : 'rgba(255,255,255,.04)' }}>
                <div className="font-extrabold">{mode === 'challenge' ? x.challenge.split(':')[0] : x.name}</div>
                <div className="text-xs opacity-70">{mode === 'challenge' ? x.challenge.split(':').slice(1).join(':').trim() : x.desc}</div>
              </button>
            ))}
          </div>
        </Section>
      )}
      {!drill && (mode === 'quick' || mode === 'versus' || mode === 'tournament') && (
        <Section label="Format">
          <Chips value={s.doubles} onChange={(v) => set({ doubles: v })} options={[{ v: false, label: 'Singles' }, { v: true, label: 'Doubles' }]} />
        </Section>
      )}
      {mode === 'tournament' && s.doubles && !touch && (
        <Section label="Partner">
          <Chips value={s.coopTournament} onChange={(v) => set({ coopTournament: v })} options={[{ v: false, label: 'CPU partner' }, { v: true, label: 'Player 2 (co-op)' }]} />
        </Section>
      )}
      {!drill && mode !== 'versus' && (
        <Section label={mode === 'coop' ? 'AI Difficulty' : 'Difficulty'}>
          <Chips value={s.level} onChange={(v) => set({ level: v })} options={diffOptions} />
        </Section>
      )}
      {!drill && mode === 'versus' && s.doubles && (
        <Section label="CPU partner level">
          <Chips value={s.level} onChange={(v) => set({ level: v })} options={DIFFICULTIES.slice(0, 5).map((n, i) => ({ v: i + 1, label: n }))} />
        </Section>
      )}
      {(mode === 'solo' || mode === 'quick') && (
        <Section label="AI Personality">
          <Chips<string> value={s.personality} onChange={(v) => set({ personality: v as Personality | 'random' })} options={[{ v: 'random', label: 'Random' }, ...PERSONALITIES.map((p) => ({ v: p, label: p[0].toUpperCase() + p.slice(1) }))]} />
        </Section>
      )}
      {!drill && (
        <Section label="Match Rules">
          <Chips<string>
            value={rulesCustom ? 'custom' : s.rulePreset}
            onChange={(v) => {
              const p = RULE_PRESETS.find((r) => r.id === v);
              if (p) set({ rulePreset: v, rules: { ...p.rules } });
              else set({ rulePreset: 'custom' });
            }}
            options={[...RULE_PRESETS.map((p) => ({ v: p.id, label: p.name })), { v: 'custom', label: 'Custom' }]}
          />
          <div className="text-xs opacity-70 mt-2">{RULE_PRESETS.find((p) => p.id === s.rulePreset)?.desc ?? 'Arcade rules — tune below'}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-3">
            <div>
              <div className="text-xs opacity-70 mb-1">Sets to win</div>
              <Chips value={s.rules.setsToWin} onChange={(v) => set({ rulePreset: 'custom', rules: { ...s.rules, setsToWin: v } })} options={[1, 2, 3].map((n) => ({ v: n, label: String(n) }))} />
            </div>
            <div>
              <div className="text-xs opacity-70 mb-1">Games per set</div>
              <Chips value={s.rules.games} onChange={(v) => set({ rulePreset: 'custom', rules: { ...s.rules, games: v } })} options={[2, 3, 4, 5, 6].map((n) => ({ v: n, label: String(n) }))} />
            </div>
            <div>
              <div className="text-xs opacity-70 mb-1">Tie-break</div>
              <Chips value={s.rules.tiebreak} onChange={(v) => set({ rulePreset: 'custom', rules: { ...s.rules, tiebreak: v } })} options={[{ v: true, label: 'On' }, { v: false, label: 'Off' }]} />
            </div>
            <div>
              <div className="text-xs opacity-70 mb-1">Scoring</div>
              <Chips value={s.rules.noAd} onChange={(v) => set({ rulePreset: 'custom', rules: { ...s.rules, noAd: v } })} options={[{ v: false, label: 'Deuce / Adv' }, { v: true, label: 'No-Ad' }]} />
            </div>
            <div>
              <div className="text-xs opacity-70 mb-1">Ball speed</div>
              <Chips value={s.rules.pace} onChange={(v) => set({ rulePreset: 'custom', rules: { ...s.rules, pace: v } })} options={[{ v: 0.87, label: 'Relaxed' }, { v: 1, label: 'Normal' }, { v: 1.15, label: 'Fast' }]} />
            </div>
          </div>
        </Section>
      )}
      <Section label="Court">
        <CourtPicker
          value={s.courtId}
          champStage={champStage}
          onChange={(id) => {
            set({ courtId: id });
            onCourt(id);
          }}
        />
      </Section>
    </Screen>
  );
}

export function Garage({ onBack, onPreview, onSwing }: { onBack: () => void; onPreview: (name: string, look: import('../game/constants').Look) => void; onSwing: () => void }) {
  const d = useData();
  const [who, setWho] = useState<'p1' | 'p2'>('p1');
  const pr = d[who];
  const edit = (fn: (p: typeof pr) => void) => {
    update((x) => fn(x[who]));
    const next = { ...pr, look: { ...pr.look } };
    fn(next);
    onPreview(next.name, next.look);
  };
  const sw = (colors: number[], key: 'color' | 'racket') => (
    <div className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <button key={c} aria-label={`color ${hexCss(c)}`} onClick={() => edit((p) => (p.look[key] = c))} className="rounded-full transition-transform hover:scale-110" style={{ width: 34, height: 34, background: hexCss(c), border: pr.look[key] === c ? '3px solid #fff' : '2px solid rgba(255,255,255,.25)', boxShadow: pr.look[key] === c ? `0 0 14px ${hexCss(c)}` : 'none' }} />
      ))}
    </div>
  );
  return (
    <Screen title="Garage" sub="Cosmetic only — never changes gameplay" onBack={onBack} width={520} footer={<Btn ghost onClick={onSwing} icon="🎾">Test swing</Btn>}>
      <Section label="Profile">
        <Chips value={who} onChange={(v) => { setWho(v); onPreview(d[v].name, d[v].look); }} options={[{ v: 'p1', label: 'Player 1' }, { v: 'p2', label: 'Player 2' }]} />
      </Section>
      <Section label="Name">
        <input type="text" maxLength={12} value={pr.name} onChange={(e) => edit((p) => (p.name = e.target.value))} onFocus={() => undefined} />
      </Section>
      <Section label="Outfit color">{sw(PALETTE, 'color')}</Section>
      <Section label="Outfit style">
        <Chips value={pr.look.outfit} onChange={(v) => edit((p) => (p.look.outfit = v))} options={OUTFIT_NAMES.map((n, i) => ({ v: i, label: n }))} />
      </Section>
      <Section label="Skin tone">
        <div className="flex gap-2">
          {SKIN_TONES.map((c, i) => (
            <button key={c} aria-label={`skin ${i}`} onClick={() => edit((p) => (p.look.skin = i))} className="rounded-full" style={{ width: 30, height: 30, background: hexCss(c), border: pr.look.skin === i ? '3px solid #fff' : '2px solid rgba(255,255,255,.25)' }} />
          ))}
        </div>
      </Section>
      <Section label="Racket skin">{sw(RACKET_COLORS, 'racket')}</Section>
      <Section label="Racket effect">
        <Chips value={pr.look.racketFx} onChange={(v) => { edit((p) => (p.look.racketFx = v)); onSwing(); }} options={FX_NAMES.map((n, i) => ({ v: i, label: n }))} />
      </Section>
      <Section label="Ball trail">
        <Chips value={pr.look.trail} onChange={(v) => edit((p) => (p.look.trail = v))} options={TRAIL_NAMES.map((n, i) => ({ v: i, label: n }))} />
      </Section>
    </Screen>
  );
}
