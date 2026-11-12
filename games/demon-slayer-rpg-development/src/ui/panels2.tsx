import { useState } from 'react';
import { useStore } from '../game/store';
import { ALL_QUESTS, SIDE, STORY, TRIALS, QUEST_BY_ID } from '../game/data/quests';
import { REGIONS, REGION_BY_ID } from '../game/data/regions';
import { RANKS, rankIndex, CHAR_BY_ID } from '../game/data/characters';
import { BOSSES } from '../game/data/enemies';
import { ITEMS } from '../game/data/items';
import { Bar } from './common';
import { audio } from '../game/audio';
import type { Profile, Quest } from '../game/types';

export function questStatus(p: Profile, q: Quest): { done: boolean; ok: boolean; why: string } {
  const reg = REGION_BY_ID[q.region];
  if (q.kind === 'story') { const done = p.chapter >= q.chapter!; const ok = q.chapter! <= p.chapter + 1; return { done, ok, why: ok ? '' : `Complete Chapter ${q.chapter! - 1} first` }; }
  if (q.kind === 'training') return { done: false, ok: true, why: '' };
  if (q.kind === 'trial') { const done = p.unlockedChars.includes(q.reward.unlockChar![0]); const ok = p.chapter >= (q.req?.chapter ?? 0) && reg.unlock <= p.chapter; return { done, ok, why: ok ? '' : `Reach Chapter ${q.req?.chapter}` }; }
  const done = !!q.once && p.questsDone.includes(q.id); let why = '';
  if (q.req?.chapter && p.chapter < q.req.chapter) why = `Complete Chapter ${q.req.chapter}`; else if (q.req?.char && !p.unlockedChars.includes(q.req.char)) why = `Unlock ${CHAR_BY_ID[q.req.char].name.split(' ')[0]}`; else if (reg.unlock > p.chapter) why = `Region locked`;
  return { done, ok: !why, why };
}

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

function QuestCard({ q }: { q: Quest }) {
  const prof = useStore((s) => s.profile); const active = useStore((s) => s.activeQuest); const start = useStore((s) => s.startQuestFromMenu); const { done, ok, why } = questStatus(prof, q); const r = q.reward;
  const isActive = active?.id === q.id;
  return (
    <div className={`card ${done ? '' : ok ? '' : 'locked'} ${isActive ? 'sel' : ''}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}><div style={{ fontFamily: 'var(--font)' }}>{q.kind === 'story' ? `Ch.${q.chapter} — ` : ''}{q.title}</div><div className="gold small">{stars(q.diff)}</div></div>
      <div className="small"><span className="tag blue">{q.cat}</span><span className="tag dim">{REGION_BY_ID[q.region].name}</span><span className="tag dim">Rec. Lv.{q.level}</span></div>
      <div className="small dim" style={{ margin: '.3rem 0' }}>{q.desc}</div>
      <div className="small">{r.xp} EXP · 💴{r.sen} · {r.cp} CP{r.items ? ' · ' + Object.entries(r.items).map(([k, n]) => `${ITEMS[k]?.icon ?? ''}×${n}`).join(' ') : ''}{r.unlockChar ? ' · ★ ' + r.unlockChar.map((c) => CHAR_BY_ID[c].name.split(' ')[0]).join(', ') : ''}</div>
      <div style={{ marginTop: '.4rem', display: 'flex', gap: '.5rem', alignItems: 'center' }}>
        <button className="btn sm gold" disabled={!ok || isActive} onClick={() => { audio.sfx('uiok'); start(q.id); }}>{isActive ? 'In progress' : done ? (q.kind === 'story' ? 'Replay chapter' : 'Replay') : q.kind === 'story' ? 'Begin chapter' : 'Accept & depart'}</button>
        {done && <span className="ok small">✔ Completed</span>}{!ok && <span className="red small">🔒 {why}</span>}
      </div>
    </div>
  );
}

export function JournalPanel() {
  const prof = useStore((s) => s.profile); const active = useStore((s) => s.activeQuest); const cmd = useStore((s) => s.cmd); const [tab, setTab] = useState<'story' | 'side' | 'trial'>('story');
  const next = STORY.find((q) => q.chapter === prof.chapter + 1);
  const cats = Array.from(new Set(SIDE.map((q) => q.cat)));
  return (
    <div>
      <div className="card" style={{ marginBottom: '.8rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ fontSize: '2rem' }}>🐦‍⬛</div>
        <div style={{ flex: 1 }}><div className="gold small" style={{ letterSpacing: '.12em' }}>KASUGAI CROW — MISSION DISPATCH</div>
          {active ? <div><b>{active.title}</b> — {active.obj}</div> : <div>{next ? <>Next orders: <b>Chapter {next.chapter} — {next.title}</b></> : 'All chapters complete. Hunt, train and explore freely.'}</div>}</div>
        {active && <button className="btn sm" onClick={() => { cmd({ type: 'abandon' }); }}>Abandon</button>}
      </div>
      <div className="seg" style={{ marginBottom: '.8rem' }}>{([['story', 'Story Chapters'], ['side', 'Corps Missions'], ['trial', 'Hashira Trials']] as const).map(([k, n]) => <button key={k} className={`btn sm ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{n}</button>)}</div>
      {tab === 'story' && <div className="grid cols-2">{STORY.map((q) => <QuestCard key={q.id} q={q} />)}</div>}
      {tab === 'side' && cats.map((c) => <div key={c}><div className="small gold" style={{ letterSpacing: '.15em', margin: '.6rem 0 .3rem' }}>{c.toUpperCase()}</div><div className="grid cols-2">{SIDE.filter((q) => q.cat === c).map((q) => <QuestCard key={q.id} q={q} />)}</div></div>)}
      {tab === 'trial' && <div className="grid cols-2">{TRIALS.map((q) => <QuestCard key={q.id} q={q} />)}</div>}
    </div>
  );
}

export function CorpsPanel() {
  const prof = useStore((s) => s.profile); const save = useStore((s) => s.save); const ri = rankIndex(prof.cp); const cur = RANKS[ri]; const nx = RANKS[ri + 1];
  const mins = Math.floor(prof.playtime / 60);
  return (
    <div className="grid cols-2" style={{ gap: '1.2rem' }}>
      <div className="card">
        <div className="gold small" style={{ letterSpacing: '.15em' }}>DEMON SLAYER CORPS RANK</div>
        <div style={{ fontFamily: 'var(--font)', fontSize: '2.2rem' }}>{cur.name} <span style={{ color: 'var(--red)' }}>{cur.jp}</span></div>
        <div className="small dim">{nx ? `${prof.cp} / ${nx.cp} CP to ${nx.name}` : 'Highest rank achieved'}</div><Bar v={prof.cp - cur.cp} max={nx ? nx.cp - cur.cp : 1} color="#e8c777" />
        <div style={{ marginTop: '1rem' }}>{RANKS.map((r, i) => <div key={r.name} className="stat" style={{ opacity: i <= ri ? 1 : 0.45 }}><span>{r.jp} {r.name}</span><span className={i <= ri ? 'ok' : 'dim'}>{i <= ri ? '✔' : `${r.cp} CP`}</span></div>)}</div>
      </div>
      <div className="card">
        <div className="gold small" style={{ letterSpacing: '.15em' }}>SERVICE RECORD</div>
        {[['Story progress', `Chapter ${prof.chapter} / 12`], ['Demons slain', String(prof.kills)], ['Bosses defeated', String(prof.bosses.length)], ['Missions completed', String(prof.questsDone.length)], ['World discoveries', String(prof.discoveries.length)], ['Collectibles found', String(prof.collectibles.length)], ['Characters unlocked', `${prof.unlockedChars.length} / 12`], ['Play time', `${mins} min`], ['Sen', String(prof.sen)]].map(([k, v]) => <div className="stat" key={k}><span className="dim">{k}</span><b>{v}</b></div>)}
        <div className="small dim" style={{ margin: '.6rem 0 .2rem' }}>Bosses: {prof.bosses.map((b) => BOSSES[b]?.name).filter(Boolean).join(', ') || '—'}</div>
        <button className="btn gold" onClick={() => save(true)}>Save game</button><span className="small dim"> Autosaves every 45 seconds and on mission completion.</span>
      </div>
    </div>
  );
}

export function MapPanel() {
  const prof = useStore((s) => s.profile); const cmd = useStore((s) => s.cmd); const closeOverlay = useStore((s) => s.closeOverlay); const [sel, setSel] = useState(prof.region); const r = REGION_BY_ID[sel];
  const unlocked = (id: string) => REGION_BY_ID[id].unlock <= prof.chapter; const here = prof.region;
  const lines: [string, string][] = []; REGIONS.forEach((a) => a.gates.forEach((b) => { if (REGION_BY_ID[b] && a.id < b) lines.push([a.id, b]); }));
  return (
    <div className="split" style={{ gridTemplateColumns: '1fr 320px' }}>
      <div className="mapbox">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <path d="M5 15 C20 5 40 12 55 8 C75 4 92 20 95 40 C98 60 88 80 80 92 C60 98 40 90 25 94 C10 90 3 60 8 40Z" fill="#1c3040" stroke="#e8c77755" strokeWidth=".4" />
          <path d="M10 70 L22 48 L30 62 L42 36 L54 64 L66 44 L78 70Z" fill="#14202e" opacity=".8" /><path d="M30 28 L40 14 L50 30Z M60 22 L70 10 L82 28Z" fill="#101a28" opacity=".9" />
          {lines.map(([a, b]) => <line key={a + b} x1={REGION_BY_ID[a].map[0]} y1={REGION_BY_ID[a].map[1]} x2={REGION_BY_ID[b].map[0]} y2={REGION_BY_ID[b].map[1]} stroke={unlocked(a) && unlocked(b) ? '#e8c777' : '#555'} strokeWidth=".3" strokeDasharray="1 1" opacity=".6" />)}
        </svg>
        {REGIONS.map((g) => <div key={g.id} className={`node ${unlocked(g.id) ? '' : 'locked'} ${here === g.id ? 'here' : ''} ${sel === g.id ? 'sel' : ''}`} style={{ left: `${g.map[0]}%`, top: `${g.map[1]}%` }} onClick={() => { setSel(g.id); audio.sfx('ui'); }}><div className="dot" /><span>{g.name}</span></div>)}
      </div>
      <div className="card">
        <div style={{ fontFamily: 'var(--font)', fontSize: '1.3rem' }}>{r.name}</div><div className="gold">{r.jp}</div><div className="small dim">{r.sub}</div>
        <p className="small">{r.desc}</p>
        <div className="stat"><span className="dim">Recommended level</span><b>{r.level}</b></div><div className="stat"><span className="dim">Weather</span><b>{r.weather}</b></div><div className="stat"><span className="dim">Connected to</span><b>{r.gates.map((g) => REGION_BY_ID[g].name).join(', ')}</b></div>
        <div className="stat"><span className="dim">Status</span><b className={unlocked(r.id) ? 'ok' : 'red'}>{unlocked(r.id) ? (here === r.id ? 'You are here' : 'Unlocked') : `Locked (Chapter ${r.unlock})`}</b></div>
        <button className="btn gold" style={{ marginTop: '.8rem' }} disabled={!unlocked(r.id) || here === r.id} onClick={() => { closeOverlay(); cmd({ type: 'travel', region: r.id }); }}>Fast travel</button>
        <p className="small dim" style={{ marginTop: '.6rem' }}>Fast travel abandons any active mission. Torii gates at region edges link neighbouring areas.</p>
      </div>
    </div>
  );
}

export const _all = ALL_QUESTS; export const _q = QUEST_BY_ID;
