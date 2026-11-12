import { useEffect, useState } from 'react';
import { COURTS } from '../game/constants';
import { input } from '../game/input';
import { ROUND_NAMES, STAGES, courtUnlocked, type Tournament } from '../game/modes';
import { resetAll, update, useData, type PadMap } from '../game/store';
import { DEFAULT_PAD } from '../game/store';
import { Btn, Chips, Screen, Section } from './kit';

const fmtTime = (s: number) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;

export function StatsScreen({ onBack }: { onBack: () => void }) {
  const d = useData();
  const s = d.stats;
  const cards: [string, string | number][] = [
    ['Matches', s.matches],
    ['Wins', s.wins],
    ['Win rate', s.matches ? Math.round((s.wins / s.matches) * 100) + '%' : '—'],
    ['Points won', s.points],
    ['Aces', s.aces],
    ['Winners', s.winners],
    ['Perfect hits', s.perfects],
    ['Longest rally', s.maxRally],
    ['Time played', fmtTime(s.seconds)],
    ['Trophies', s.trophies],
    ['Championship stages', `${d.champ.stage}/6`],
    ['Stars', d.champ.stars.reduce((a, b) => a + b, 0)],
  ];
  return (
    <Screen title="Statistics" sub="Career totals saved on this device" onBack={onBack} width={640} footer={<Btn ghost onClick={() => window.confirm('Erase all stats, scores and progress?') && resetAll()}>Reset all progress</Btn>}>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-white/10 bg-white/5 p-3 fade-up">
            <div className="text-[11px] uppercase tracking-widest opacity-60">{k}</div>
            <div className="title-font text-3xl" style={{ color: '#c6ff3a' }}>{v}</div>
          </div>
        ))}
      </div>
    </Screen>
  );
}

export function ScoresScreen({ onBack }: { onBack: () => void }) {
  const d = useData();
  return (
    <Screen title="High Scores" sub="Local leaderboard — top 20" onBack={onBack} width={680} footer={<Btn ghost onClick={() => window.confirm('Clear the high-score table?') && update((x) => (x.scores = []))}>Clear table</Btn>}>
      {d.scores.length === 0 && <div className="opacity-70 py-8 text-center">No scores yet. Play a match or a Time Challenge!</div>}
      <div className="flex flex-col gap-2">
        {d.scores.map((s, i) => (
          <div key={s.date + '-' + i} className="flex items-center gap-3 rounded-xl px-4 py-2.5 border border-white/10" style={{ background: i === 0 ? 'linear-gradient(90deg, rgba(255,210,63,.25), rgba(255,255,255,.04))' : 'rgba(255,255,255,.05)' }}>
            <div className="title-font text-xl w-8" style={{ color: i < 3 ? '#ffd23f' : '#fff' }}>{i + 1}</div>
            <div className="flex-1 min-w-0">
              <div className="font-extrabold truncate">{s.name}</div>
              <div className="text-xs opacity-60 truncate">{s.mode} · {s.detail}</div>
            </div>
            <div className="title-font text-xl">{s.score.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </Screen>
  );
}

const PAD_ACTIONS: { k: keyof PadMap; label: string }[] = [
  { k: 'long', label: 'Long shot' },
  { k: 'short', label: 'Short shot' },
  { k: 'right', label: 'Short → right' },
  { k: 'left', label: 'Short → left' },
  { k: 'special', label: 'Special / perfect' },
  { k: 'sprint', label: 'Sprint (hold)' },
  { k: 'camera', label: 'Change camera' },
  { k: 'pause', label: 'Pause' },
];
const PAD_NAMES = ['A / ✕', 'B / ○', 'X / □', 'Y / △', 'LB / L1', 'RB / R1', 'LT / L2', 'RT / R2', 'Back / Share', 'Start / Options', 'L3', 'R3', 'D-Up', 'D-Down', 'D-Left', 'D-Right'];

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const d = useData();
  const s = d.settings;
  const [pads, setPads] = useState(0);
  const [listen, setListen] = useState<keyof PadMap | null>(null);
  useEffect(() => {
    const id = setInterval(() => setPads(input.padCount()), 600);
    return () => clearInterval(id);
  }, []);
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => update((x) => (x.settings[k] = v));
  const slider = (label: string, k: 'master' | 'music' | 'sfx' | 'crowd') => (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="opacity-80">{label}</span>
        <span className="opacity-60">{Math.round(s[k] * 100)}%</span>
      </div>
      <input type="range" min={0} max={1} step={0.05} value={s[k]} onChange={(e) => set(k, +e.target.value)} aria-label={label} />
    </div>
  );
  return (
    <Screen title="Settings" sub="Saved automatically" onBack={onBack} width={640}>
      <Section label="Audio">
        {slider('Master volume', 'master')}
        {slider('Music', 'music')}
        {slider('Sound effects', 'sfx')}
        {slider('Crowd', 'crowd')}
        <div className="flex flex-wrap gap-2 mt-2">
          <button className="chip" data-on={s.musicOn} onClick={() => set('musicOn', !s.musicOn)}>🎵 Music {s.musicOn ? 'On' : 'Off'}</button>
          <button className="chip" data-on={s.sfxOn} onClick={() => set('sfxOn', !s.sfxOn)}>🔊 Sound FX {s.sfxOn ? 'On' : 'Off'}</button>
          <button className="chip" data-on={s.speech} onClick={() => set('speech', !s.speech)}>🗣 Score calls {s.speech ? 'On' : 'Off'}</button>
        </div>
      </Section>
      <Section label="Camera & feedback">
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="opacity-80">Camera sensitivity (follow speed & ball assist)</span>
            <span className="opacity-60">{s.camSens.toFixed(1)}x</span>
          </div>
          <input type="range" min={0.4} max={1.6} step={0.1} value={s.camSens} onChange={(e) => set('camSens', +e.target.value)} aria-label="Camera sensitivity" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="chip" data-on={s.shake} onClick={() => set('shake', !s.shake)}>Camera impact {s.shake ? 'On' : 'Off'}</button>
          <button className="chip" data-on={s.slowmo} onClick={() => set('slowmo', !s.slowmo)}>Slow-motion {s.slowmo ? 'On' : 'Off'}</button>
          <button className="chip" data-on={s.hints} onClick={() => set('hints', !s.hints)}>On-screen hints {s.hints ? 'On' : 'Off'}</button>
        </div>
      </Section>
      <Section label="Graphics quality">
        <Chips value={s.quality} onChange={(v) => set('quality', v)} options={[{ v: 'auto', label: 'Auto (adaptive)' }, { v: 'low', label: 'Low' }, { v: 'medium', label: 'Medium' }, { v: 'high', label: 'High' }]} />
      </Section>
      <Section label="Touch controls">
        <Chips value={s.touch} onChange={(v) => set('touch', v)} options={[{ v: 'auto', label: 'Auto' }, { v: 'on', label: 'Always on' }, { v: 'off', label: 'Off' }]} />
      </Section>
      <Section label={`Gamepad (${pads} connected)`}>
        <div className="text-xs opacity-70 mb-2">Left stick / D-pad moves. First pad controls:</div>
        <Chips value={s.padFor} onChange={(v) => set('padFor', v)} options={[{ v: 1, label: 'Player 1' }, { v: 2, label: 'Player 2' }]} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          {PAD_ACTIONS.map((a) => (
            <div key={a.k} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
              <span>{a.label}</span>
              <button
                className="chip"
                data-on={listen === a.k}
                onClick={async () => {
                  setListen(a.k);
                  const b = await input.captureButton();
                  setListen(null);
                  if (b >= 0) update((x) => (x.settings.pad[a.k] = b));
                }}
              >
                {listen === a.k ? 'Press a button…' : PAD_NAMES[s.pad[a.k]] ?? `Button ${s.pad[a.k]}`}
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Btn ghost onClick={() => update((x) => (x.settings.pad = { ...DEFAULT_PAD }))}>Reset gamepad mapping</Btn>
        </div>
      </Section>
    </Screen>
  );
}

const Key = ({ children }: { children: React.ReactNode }) => (
  <kbd className="inline-block min-w-[26px] text-center rounded-md border border-white/30 bg-white/10 px-1.5 py-0.5 text-xs font-bold mx-0.5">{children}</kbd>
);
export function HelpScreen({ onBack }: { onBack: () => void }) {
  const rows: [string, React.ReactNode, React.ReactNode][] = [
    ['Move', <><Key>W</Key><Key>A</Key><Key>S</Key><Key>D</Key></>, <><Key>↑</Key><Key>←</Key><Key>↓</Key><Key>→</Key></>],
    ['Long shot', <Key>1</Key>, <Key>Num 1</Key>],
    ['Short shot (lob vs net-rushers)', <Key>2</Key>, <Key>Num 2</Key>],
    ['Short → right side of screen', <Key>3</Key>, <Key>Num 3</Key>],
    ['Short → left side of screen', <Key>4</Key>, <Key>Num 4</Key>],
    ['Special / perfect-hit / super rally', <Key>Space</Key>, <Key>R-Shift</Key>],
    ['Sprint (drains stamina)', <Key>Shift</Key>, <Key>Enter</Key>],
    ['Change camera', <Key>C</Key>, <Key>O</Key>],
    ['Pause', <Key>Esc</Key>, <Key>P</Key>],
  ];
  return (
    <Screen title="Controls" sub="Keyboard · gamepad · touch" onBack={onBack} width={760}>
      <div className="rounded-xl border border-white/10 overflow-hidden mb-5">
        <div className="grid grid-cols-[1.4fr_1fr_1fr] bg-white/10 text-[11px] font-extrabold uppercase tracking-widest px-3 py-2">
          <div>Action</div><div>Player 1</div><div>Player 2</div>
        </div>
        {rows.map(([a, p1, p2]) => (
          <div key={a} className="grid grid-cols-[1.4fr_1fr_1fr] px-3 py-2 text-sm border-t border-white/5 items-center">
            <div>{a}</div><div>{p1}</div><div>{p2}</div>
          </div>
        ))}
      </div>
      <Section label="How to play">
        <ul className="text-sm space-y-2 opacity-90 list-disc pl-5">
          <li><b>Serve:</b> tap a shot key (1-4) to toss, then tap again when the ring closes at the top of the toss. 1 = power, 2 = kick, 3 / 4 = slice right / left. Space = risky power serve.</li>
          <li><b>Rally:</b> a ring appears on the ball when it is coming to you. Press a shot key as the ring closes on the white target. Ring colour tells your positioning: <span style={{ color: '#ff5a5a' }}>poor</span> · <span style={{ color: '#ffd23f' }}>normal</span> · <span style={{ color: '#6aff8a' }}>good</span> · <span style={{ color: '#5af0ff' }}>perfect</span>.</li>
          <li><b>Steer:</b> hold a direction while hitting to aim sideways; hold forward for shorter, back for deeper. A white marker on the court shows where the incoming ball will bounce.</li>
          <li><b>Perfect hits</b> unleash specials: Power Serve, Topspin, Cross-Court, Drop Shot and the cinematic Smash. Perfect timing builds the Super Rally meter — press Space with a full meter to fire a signature shot (still returnable!).</li>
          <li><b>Overheads:</b> high balls trigger a jump smash automatically. Players cannot cross the net.</li>
          <li><b>Touch:</b> left thumb = joystick, right thumb = shot buttons, hold SPRINT.</li>
        </ul>
      </Section>
    </Screen>
  );
}

export function TournamentScreen({ t, onBack, onPlay, onSimRest, onNew }: { t: Tournament; onBack: () => void; onPlay: () => void; onSimRest: () => void; onNew: () => void }) {
  const done = t.champion >= 0;
  const humanChamp = done && t.champion === 0;
  const colTitle = ['Quarterfinals', 'Semifinals', 'Final', 'Champion'];
  const entryName = (id: number) => (id < 0 ? 'TBD' : t.entries[id].name);
  return (
    <Screen
      title={t.doubles ? 'Doubles Tournament' : 'Singles Tournament'}
      sub={done ? (humanChamp ? 'You are the champion!' : `${entryName(t.champion)} won the trophy`) : t.eliminated ? 'You were eliminated' : `Next: ${ROUND_NAMES[t.round]}`}
      onBack={onBack}
      width={980}
      footer={
        <div className="flex flex-wrap gap-2">
          {!done && !t.eliminated && <div className="flex-1 min-w-[200px]"><Btn primary icon="▶" onClick={onPlay}>Play {ROUND_NAMES[t.round]}</Btn></div>}
          {!done && t.eliminated && <div className="flex-1 min-w-[200px]"><Btn primary icon="⏩" onClick={onSimRest}>Simulate remaining rounds</Btn></div>}
          <div className="flex-1 min-w-[160px]"><Btn ghost onClick={onNew}>New tournament</Btn></div>
        </div>
      }
    >
      {done && (
        <div className="text-center mb-6 fade-up">
          <div className="text-7xl logo-float">🏆</div>
          <div className="title-font text-3xl shimmer-text">{humanChamp ? 'Trophy Ceremony' : 'Champion'}</div>
          <div className="text-lg font-bold">{entryName(t.champion)}</div>
        </div>
      )}
      <div className="grid grid-cols-4 gap-3 min-w-[700px]">
        {t.rounds.map((r, ri) => (
          <div key={ri} className="flex flex-col justify-around gap-3">
            <div className="lbl text-center">{colTitle[ri]}</div>
            {Array.from({ length: Math.ceil(r.length / 2) }, (_, m) => (ri === 3 ? [r[0]] : [r[m * 2], r[m * 2 + 1]])).map((pair, m) => {
              const pl = t.played[ri]?.find((p) => p.a === pair[0] && p.b === pair[1]);
              const current = ri === t.round && !t.eliminated && pair.includes(0) && !done;
              return (
                <div key={m} className="rounded-xl border p-2 text-sm" style={{ borderColor: current ? '#c6ff3a' : 'rgba(255,255,255,.14)', background: current ? 'rgba(198,255,58,.1)' : 'rgba(255,255,255,.05)', boxShadow: current ? '0 0 18px rgba(198,255,58,.3)' : 'none' }}>
                  {pair.map((id, k) => (
                    <div key={k} className="flex items-center justify-between gap-2 py-0.5" style={{ fontWeight: pl && pl.w === id ? 900 : 500, opacity: pl && pl.w !== id ? 0.5 : 1, color: id === 0 ? '#c6ff3a' : '#fff' }}>
                      <span className="truncate">{entryName(id)}</span>
                      {pl && pl.w === id && <span className="text-[10px] opacity-80">{pl.text}</span>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Screen>
  );
}

export function ChampScreen({ onBack, onPlay }: { onBack: () => void; onPlay: (stage: number) => void }) {
  const d = useData();
  const stage = d.champ.stage;
  const stars = d.champ.stars.reduce((a, b) => a + b, 0);
  return (
    <Screen title="Championship" sub={`${stars} / 18 stars · stage ${Math.min(stage + 1, 6)} of 6 · Trophies: ${d.stats.trophies}`} onBack={onBack} width={760}>
      <div className="flex flex-col gap-3">
        {STAGES.map((st, i) => {
          const open = i <= stage;
          const court = COURTS.find((c) => c.id === st.courtId)!;
          return (
            <div key={st.name} className="flex items-center gap-3 rounded-xl border p-3 fade-up" style={{ borderColor: i === stage ? '#c6ff3a' : 'rgba(255,255,255,.14)', background: i === stage ? 'rgba(198,255,58,.1)' : 'rgba(255,255,255,.05)', opacity: open ? 1 : 0.5, animationDelay: `${i * 50}ms` }}>
              <div className="title-font text-3xl w-10 text-center" style={{ color: '#ffd23f' }}>{i + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="font-extrabold">{st.name}</div>
                <div className="text-xs opacity-70 truncate">vs {st.opponent} · {st.personality} · {court.name}</div>
                <div className="text-xs opacity-50">{st.blurb}</div>
              </div>
              <div className="text-lg tracking-widest" aria-label="stars">{[0, 1, 2].map((k) => <span key={k} style={{ opacity: (d.champ.stars[i] ?? 0) > k ? 1 : 0.2 }}>★</span>)}</div>
              <div className="w-24"><Btn primary={i === stage} ghost disabled={!open} onClick={() => onPlay(i)}>{i < stage ? 'Replay' : 'Play'}</Btn></div>
            </div>
          );
        })}
      </div>
      <Section label="Unlockable courts">
        <div className="flex flex-wrap gap-2 mt-3">
          {COURTS.map((c) => (
            <span key={c.id} className="chip" data-on={courtUnlocked(c.id, stage)} style={{ cursor: 'default' }}>
              {courtUnlocked(c.id, stage) ? '✔' : '🔒'} {c.name}
            </span>
          ))}
        </div>
      </Section>
    </Screen>
  );
}
