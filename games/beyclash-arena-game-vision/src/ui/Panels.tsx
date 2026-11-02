import { useMemo, useState } from 'react';
import { PLAYER_LOOKS } from '../data/player';
import { RIVALS } from '../data/rivals';
import { STADIUMS, STADIUM_MAP } from '../data/stadiums';
import { TOURNAMENTS } from '../data/tournaments';
import { beyType, computeStats, power } from '../game/customization/stats';
import { QUALIFY_TARGET } from '../game/economy/economy';
import { repTitle, xpForLevel, unlocksAtLevel } from '../game/progression/rewards';
import { useGame, rivalStatus, type Fighter } from '../game/store';
import { audio } from '../game/audio/audio';
import { DIFFICULTIES, type BeyConfig, type Difficulty } from '../game/types';
import { checkTournament } from '../game/progression/rewards';
import { DISTRICT_MAP } from '../game/world/layout';
import { Bar, Btn, Modal, Portrait, StatRows } from './ui';
import { rivalFighter } from './Dialogue';

// ---------------- Profile ----------------
export function Profile() {
  const g = useGame();
  const s = g.save;
  const look = PLAYER_LOOKS[s.profile.outfit % PLAYER_LOOKS.length].look;
  const defeated = RIVALS.filter((r) => s.rivals[r.id].defeated).length;
  const stats = computeStats(s.config);
  const cell = (k: string, v: React.ReactNode) => <div className="flex justify-between border-b border-white/10 py-1 text-sm"><span className="text-white/60">{k}</span><b>{v}</b></div>;
  return (
    <Modal title="Player Profile" onClose={() => g.closeOverlay()} width="min(1000px,95vw)">
      <div className="grid gap-5 md:grid-cols-[180px_1fr_1fr]">
        <div className="text-center">
          <Portrait look={look} size={170} />
          <div className="title-font mt-2 text-2xl">{s.profile.name}</div>
          <div className="text-yellow-200">Level {s.level} · {repTitle(s.reputation)}</div>
          <Bar value={s.xp} max={xpForLevel(s.level)} color="#ffd24a" className="mt-2" />
          <div className="text-[10px] text-white/60">{s.xp}/{xpForLevel(s.level)} XP</div>
          <div className="mt-2 text-xs text-cyan-200">Next unlocks (Lv {s.level + 1}): {unlocksAtLevel(s.level + 1).join(', ') || '—'}</div>
        </div>
        <div>
          <div className="title-font text-lg text-cyan-300">Career</div>
          {cell('Points', `${s.points.toLocaleString()} pts`)}
          {cell('Qualification target', `${s.points.toLocaleString()} / ${QUALIFY_TARGET.toLocaleString()}`)}
          {cell('Reputation', s.reputation)}
          {cell('Battles', `${s.stats.battles} (${s.stats.wins}W / ${s.stats.losses}L)`)}
          {cell('Win finishes', `SPIN ${s.stats.finishes.SPIN} · RING_OUT ${s.stats.finishes.RING_OUT} · BURST ${s.stats.finishes.BURST}`)}
          {cell('Points won / lost (transfers)', `${s.stats.pointsWon.toLocaleString()} / ${s.stats.pointsLost.toLocaleString()}`)}
          {cell('Rivals defeated', `${defeated} / ${RIVALS.length}`)}
          {cell('Training learned', `${s.training.spin ? '✔' : '○'} SPIN ${s.training.ringOut ? '✔' : '○'} RING_OUT ${s.training.burst ? '✔' : '○'} BURST`)}
          <div className="title-font mt-3 text-lg text-pink-300">Tournaments</div>
          {TOURNAMENTS.map((t) => <div key={t.id} className="flex justify-between text-xs"><span>{t.name}</span><b className={s.tournaments[t.id].wins ? 'text-emerald-300' : 'text-white/40'}>{s.tournaments[t.id].wins ? `Champion ×${s.tournaments[t.id].wins}` : '—'}</b></div>)}
        </div>
        <div>
          <div className="title-font text-lg text-yellow-300">{s.config.name}</div>
          <div className="mb-1"><span className="chip">{beyType(stats)}</span> <span className="text-xs text-white/60">Power {power(stats)}</span></div>
          <StatRows stats={stats} />
          <div className="title-font mt-3 text-lg text-cyan-300">Rival Encounters</div>
          <div className="scroll max-h-44 overflow-y-auto pr-1">
            {RIVALS.map((r) => { const p = s.rivals[r.id]; return (
              <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
                <span className={p.met ? '' : 'text-white/30'}>{p.met ? r.name : '???'}</span>
                <span className="flex gap-0.5">{Array.from({ length: 5 }, (_, i) => <i key={i} className={`h-2 w-3 skew-x-[-18deg] border border-white/30 ${i < p.points ? 'bg-yellow-300' : ''}`} />)}</span>
              </div>); })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---------------- Settings ----------------
export function SettingsPanel() {
  const g = useGame();
  const st = g.settings;
  const [confirm, setConfirm] = useState(false);
  const slider = (label: string, key: 'sfx' | 'music' | 'mouseSens' | 'camSens' | 'resolution', min: number, max: number, step: number, fmt: (v: number) => string) => (
    <div className="grid grid-cols-[160px_1fr_60px] items-center gap-3 text-sm"><span>{label}</span><input type="range" min={min} max={max} step={step} value={st[key]} onChange={(e) => { g.setSettings({ [key]: Number(e.target.value) } as any); if (key === 'sfx' || key === 'music') { audio.setVolumes(key === 'sfx' ? Number(e.target.value) : st.sfx, key === 'music' ? Number(e.target.value) : st.music); } }} /><b className="font-mono">{fmt(st[key])}</b></div>
  );
  const back = g.overlayData?.back === 'pause' ? () => g.openOverlay('pause') : () => g.closeOverlay();
  return (
    <Modal title="Settings" onClose={back} width="min(760px,95vw)">
      <div className="space-y-4">
        <div className="grid grid-cols-[160px_1fr] items-center gap-3 text-sm">
          <span>Graphics quality</span>
          <div className="flex gap-2">{(['low', 'medium', 'high'] as const).map((q) => <Btn key={q} kind={st.quality === q ? 'gold sm' : 'ghost sm'} onClick={() => g.setSettings({ quality: q })}>{q}</Btn>)}</div>
        </div>
        <div className="text-[11px] text-white/50">Low: no shadows, shorter fog. Medium: 1K shadows. High: 2K shadows. Quality changes apply immediately.</div>
        {slider('Resolution scaling', 'resolution', 0.5, 1, 0.05, (v) => `${Math.round(v * 100)}%`)}
        {slider('Sound volume', 'sfx', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`)}
        {slider('Music volume', 'music', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`)}
        {slider('Mouse sensitivity', 'mouseSens', 0.2, 3, 0.1, (v) => v.toFixed(1))}
        {slider('Camera sensitivity', 'camSens', 0.2, 3, 0.1, (v) => v.toFixed(1))}
        <div className="grid grid-cols-[160px_1fr] items-center gap-3 text-sm"><span>Invert camera Y</span><div><Btn kind={st.invertY ? 'gold sm' : 'ghost sm'} onClick={() => g.setSettings({ invertY: !st.invertY })}>{st.invertY ? 'On' : 'Off'}</Btn></div></div>
        <div className="grid grid-cols-[160px_1fr] items-center gap-3 text-sm"><span>Fullscreen</span><div><Btn kind="sm" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen().catch(() => g.notify('Fullscreen was blocked by the browser.', 'warn')); }}>Toggle fullscreen</Btn></div></div>
        <div className="rounded-lg border border-white/15 bg-black/30 p-3 text-xs leading-relaxed">
          <div className="title-font text-base text-yellow-300">Controls</div>
          <b>City:</b> WASD move · Mouse rotate camera · Wheel zoom · Shift sprint · Ctrl walk · Space jump · E interact · M map · Esc pause<br />
          <b>Battle:</b> WASD / Arrows steer your top · Space dash (and to lock launch power in the countdown) · Esc pause
        </div>
        <div className="border-t border-white/15 pt-3">
          <div className="title-font text-base text-rose-300">Danger zone</div>
          {!confirm ? <Btn kind="pink sm" onClick={() => setConfirm(true)}>Erase save data…</Btn> : (
            <div className="flex items-center gap-3 text-sm"><span>This permanently deletes all progress. Sure?</span><Btn kind="pink sm" onClick={() => { g.resetSave(); setConfirm(false); }}>Yes, erase</Btn><Btn kind="ghost sm" onClick={() => setConfirm(false)}>Cancel</Btn></div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ---------------- Quick battle + Training ----------------
const DUMMY_BEY: BeyConfig = { name: 'Training Dummy', color: '#9aa7b8', layer: 'iron-bulwark', disc: 'standard-disc', driver: 'sharp-driver', accessory: 'no-accessory' };
const BOTS: { id: string; name: string; desc: string; bey: BeyConfig; strategy: Fighter['strategy']; difficulty: Difficulty }[] = [
  { id: 'dummy', name: 'Training Dummy', desc: 'Barely moves. Perfect for learning finishes.', bey: DUMMY_BEY, strategy: 'stamina', difficulty: 'Beginner' },
  { id: 'striker', name: 'Striker Bot', desc: 'Charges you repeatedly. Practise dodging and counters.', bey: { ...DUMMY_BEY, name: 'Striker Bot', color: '#ff5a36', layer: 'ember-fang', driver: 'flat-driver' }, strategy: 'aggressive', difficulty: 'Easy' },
  { id: 'guard', name: 'Guard Bot', desc: 'Holds the centre. Learn to break a defence.', bey: { ...DUMMY_BEY, name: 'Guard Bot', color: '#6f8bb5', layer: 'iron-bulwark', disc: 'heavy-disc', driver: 'grip-driver' }, strategy: 'defensive', difficulty: 'Normal' },
  { id: 'endure', name: 'Endurance Bot', desc: 'Conserves stamina. Learn stamina management.', bey: { ...DUMMY_BEY, name: 'Endurance Bot', color: '#38e08c', layer: 'gale-ring', driver: 'ball-driver' }, strategy: 'stamina', difficulty: 'Normal' },
];

export function BattleSetup({ training }: { training: boolean }) {
  const g = useGame();
  const [who, setWho] = useState<string>(training ? 'dummy' : RIVALS[0].id);
  const defaultStadium = training ? 'dojo' : ({ residential: 'park', shopping: 'park', training: 'dojo', competition: 'arena', elite: 'neon', championship: 'gold' } as Record<string, string>)[g.overlayData?.district ?? ''] ?? 'arena';
  const [stadium, setStadium] = useState(defaultStadium);
  const bot = BOTS.find((b) => b.id === who);
  const rival = RIVALS.find((r) => r.id === who);
  const [diff, setDiff] = useState<Difficulty | 'default'>('default');
  const fighter: Fighter = useMemo(() => {
    if (bot) return { id: bot.id, name: bot.name, title: 'Practice opponent', look: RIVALS[0].look, bey: bot.bey, strategy: bot.strategy, difficulty: diff === 'default' ? bot.difficulty : diff };
    const f = rivalFighter(rival!);
    return { ...f, difficulty: diff === 'default' ? f.difficulty : diff };
  }, [who, diff, bot, rival]);
  const mine = computeStats(g.save.config);
  const theirs = computeStats(fighter.bey);
  const t = g.save.training;
  const start = () => g.startBattle({ mode: training ? 'training' : 'quick', opponent: fighter, stadium, tutorial: training });
  return (
    <Modal title={training ? 'Training Grounds' : 'Quick Battle'} sub={training ? 'Practice stadium · results never affect rival or tournament progress' : 'Exhibition match · no official rewards, encounter points or tournament progress'} onClose={() => g.closeOverlay()} width="min(1080px,96vw)"
      footer={<div className="flex items-center justify-between"><div className="text-xs text-white/60">{training && `Learned: ${t.spin ? '✔' : '○'} SPIN  ${t.ringOut ? '✔' : '○'} RING_OUT  ${t.burst ? '✔' : '○'} BURST`}</div><Btn kind="gold" onClick={start}>Start {training ? 'Practice' : 'Battle'}</Btn></div>}>
      <div className="grid gap-4 md:grid-cols-[250px_1fr_1fr]">
        <div>
          <div className="title-font text-lg text-cyan-300">Opponent</div>
          <div className="scroll max-h-[46vh] space-y-1 overflow-y-auto pr-1">
            {(training ? BOTS.map((b) => ({ id: b.id, name: b.name, sub: b.difficulty })) : [...BOTS.map((b) => ({ id: b.id, name: b.name, sub: 'Practice bot' })), ...RIVALS.map((r) => ({ id: r.id, name: r.name, sub: `${r.difficulty} · ${r.strategy}` }))]).map((o) => (
              <button key={o.id} onClick={() => { audio.click(); setWho(o.id); }} className={`flex w-full items-center justify-between border-2 px-2 py-1 text-left text-sm ${who === o.id ? 'border-yellow-300 bg-yellow-300/10' : 'border-white/15 bg-black/30 hover:bg-white/10'}`}><b>{o.name}</b><span className="text-[10px] text-white/60">{o.sub}</span></button>
            ))}
          </div>
          {training && bot && <div className="mt-2 text-xs text-white/70">{bot.desc}</div>}
        </div>
        <div>
          <div className="title-font text-lg text-yellow-300">Match setup</div>
          <div className="mb-1 text-xs font-bold uppercase text-cyan-200">Difficulty (AI behaviour — never hidden stat boosts)</div>
          <div className="flex flex-wrap gap-1">
            <Btn kind={diff === 'default' ? 'gold sm' : 'ghost sm'} onClick={() => setDiff('default')}>Default</Btn>
            {DIFFICULTIES.map((d) => <Btn key={d} kind={diff === d ? 'gold sm' : 'ghost sm'} onClick={() => setDiff(d)}>{d}</Btn>)}
          </div>
          <div className="mb-1 mt-3 text-xs font-bold uppercase text-cyan-200">Stadium</div>
          <div className="space-y-1">
            {STADIUMS.map((s) => <button key={s.id} onClick={() => { audio.click(); setStadium(s.id); }} className={`flex w-full justify-between border-2 px-2 py-1 text-left text-xs ${stadium === s.id ? 'border-yellow-300 bg-yellow-300/10' : 'border-white/15 bg-black/30 hover:bg-white/10'}`}><b>{s.name}</b><span className="text-white/60">{s.pockets} ring-out gaps · pull {s.pull}</span></button>)}
          </div>
          <div className="mt-1 text-[11px] text-white/50">{STADIUM_MAP[stadium].desc}</div>
        </div>
        <div className="space-y-3">
          <div className="rounded-lg border border-white/15 bg-black/30 p-3">
            <div className="flex items-center justify-between"><b className="title-font text-cyan-300">{g.save.config.name}</b><Btn kind="sm" onClick={() => g.openOverlay('customize')}>Edit parts</Btn></div>
            <StatRows stats={mine} />
          </div>
          <div className="rounded-lg border border-white/15 bg-black/30 p-3">
            <div className="flex items-center justify-between"><b className="title-font text-pink-300">{fighter.bey.name}</b><span className="chip">{beyType(theirs)} · {fighter.strategy} · {fighter.difficulty}</span></div>
            <StatRows stats={theirs} compare={mine} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---------------- Boards ----------------
export function Board() {
  const g = useGame();
  const d = g.overlayData as { id: string; district: keyof typeof DISTRICT_MAP; name: string };
  const info = DISTRICT_MAP[d.district];
  const hall = d.id === 'ch-board';
  const avail = RIVALS.filter((r) => r.district === d.district);
  return (
    <Modal title={d.name} sub={`${info.name} — ${info.tagline}`} onClose={() => g.closeOverlay()} width="min(820px,95vw)">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <div className="title-font text-lg text-yellow-300">Tournament Announcements</div>
          {TOURNAMENTS.map((t) => {
            const rec = g.save.tournaments[t.id];
            const miss = checkTournament(t, g.save).filter((m) => !m.startsWith('Entry'));
            return (
              <div key={t.id} className="border-b border-white/10 py-1 text-xs">
                <div className="flex justify-between"><b>{t.name}</b><span className={rec.wins ? 'text-emerald-300' : miss.length ? 'text-rose-300' : 'text-cyan-300'}>{rec.wins ? 'Champion ✔' : miss.length ? 'Locked' : 'Registration open'}</span></div>
                <div className="text-white/50">{t.size} bladers · fee {t.fee.toLocaleString()} · prize {t.prize.toLocaleString()} · {t.venue}</div>
              </div>
            );
          })}
        </div>
        <div>
          <div className="title-font text-lg text-cyan-300">{hall ? 'Hall of Champions' : 'Local Notices'}</div>
          {hall ? (
            <div className="text-sm">
              {g.save.stats.wins} career wins · {RIVALS.filter((r) => g.save.rivals[r.id].defeated).length}/{RIVALS.length} rivals defeated.
              {TOURNAMENTS.filter((t) => g.save.tournaments[t.id].wins > 0).map((t) => <div key={t.id} className="text-yellow-200">🏆 {t.name} ×{g.save.tournaments[t.id].wins}</div>)}
              {g.save.tournaments.world.wins > 0 && <div className="title-font mt-2 text-2xl text-yellow-300">★ World Champion: {g.save.profile.name} ★</div>}
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div>Bladers seen in {info.name}:</div>
              {avail.map((r) => { const s = rivalStatus(g.save, r.id); return <div key={r.id} className="flex justify-between text-xs"><span>{g.save.rivals[r.id].met ? r.name : '??? (undiscovered)'}</span><span className={s.defeated ? 'text-emerald-300' : s.locked ? 'text-rose-300' : 'text-yellow-200'}>{s.defeated ? 'Defeated' : s.locked ? 'Locked' : 'Challengeable'}</span></div>; })}
              <div className="text-[11px] text-white/50">Tip: Win by BURST for 3 encounter points. Rivals are defeated at 5 points.</div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

