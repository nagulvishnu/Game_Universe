import { useMemo, useState } from 'react';
import { film } from '../film/runtime';
import { useFilm } from './Overlays';
import { CHARACTERS, CHAR_MAP } from '../story/characters';
import { buildRegistry, registrySummary } from '../production/registry';
import { renderScene, renderScreenplay, renderSpec } from '../production/screenplay';
import { FEATURES } from '../production/status';
import { estimateFilm, estimateScene } from '../story/orchestrator';
import { llmStats } from '../ai/llm';
import { audio } from '../audio/audio';

const TABS = ['Runtime', 'Minds', 'Screenplay', 'Scene spec', 'Assets', 'Status', 'Log'] as const;
type Tab = (typeof TABS)[number];
const mm = (s: number) => `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, '0')}s`;
const Bar = ({ v, c = '#f5b73b' }: { v: number; c?: string }) => (<div className="h-1.5 w-full rounded bg-white/10"><div className="h-full rounded" style={{ width: `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`, background: c }} /></div>);

function download(name: string, text: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = name; a.click();
}

function RuntimeTab() {
  const r = film.runtimeReport(); const est = estimateFilm();
  return (<div className="space-y-3 text-xs">
    <div className="rounded bg-white/5 p-3 leading-relaxed">
      <div>Scripted estimate: <b>{mm(est)}</b> · Rendered playback so far: <b>{mm(r.actual)}</b> · Scenes completed: <b>{r.completed}/{r.rows.length}</b></div>
      <div className="mt-1 text-amber-300">Target 60–90 min — {est < 3600 ? `NOT MET: shortfall of about ${mm(3600 - est)}.` : 'met by estimate.'}</div>
      <div className="mt-1 text-white/50">Rendered duration is measured from real playback (includes speech waits and pauses excluded).</div>
    </div>
    <table className="w-full text-left"><thead className="text-white/50"><tr><th>#</th><th>Scene</th><th>Est</th><th>Actual</th><th>Warn</th><th>Nav</th></tr></thead>
      <tbody>{r.rows.map((x, i) => (
        <tr key={x.id} className={`cursor-pointer hover:bg-white/10 ${i === film.sceneIdx ? 'text-amber-300' : ''}`} onClick={() => film.jump(i)}>
          <td>{i + 1}</td><td className="truncate">{x.title}</td><td>{Math.round(x.estimated)}s</td><td>{x.completed || i === film.sceneIdx ? Math.round(x.actual) + 's' : '—'}</td><td>{x.warnings}</td><td>{x.navFallbacks}</td>
        </tr>))}</tbody></table>
    <div className="rounded bg-white/5 p-3">Audio: music cue <b>{audio.cueName}</b> · TTS voices {audio.voicesAvailable ? 'available' : <b className="text-red-300">unavailable (timer-only dialogue)</b>} · LLM {llmStats.enabled ? `on (${llmStats.ok}/${llmStats.requests} ok)` : 'off (local fallbacks)'}</div>
  </div>);
}

function MindsTab() {
  const [sel, setSel] = useState('kael');
  const a = film.agents.get(sel)!; const d = CHAR_MAP[sel];
  const active = CHARACTERS.filter((c) => film.agents.get(c.id)?.active);
  return (<div className="space-y-3 text-xs">
    <div className="flex flex-wrap gap-1">{CHARACTERS.map((c) => (
      <button key={c.id} onClick={() => setSel(c.id)} className={`rounded px-2 py-1 ${sel === c.id ? 'bg-amber-500 text-black' : 'bg-white/10'} ${active.includes(c) ? '' : 'opacity-40'}`}>{c.name.split(' ')[0]}</button>))}</div>
    <div className="rounded bg-white/5 p-3">
      <div className="font-semibold text-amber-300">{d.name}</div><div className="text-white/60">{d.role}</div>
      <div className="mt-2">{a.active ? <>State: <b>{a.state}</b> · stance <b>{a.stance}</b> · HP {Math.round(a.hp * 100)}% · goal: <i>{a.goalText}</i></> : 'Not on stage in this scene.'}</div>
    </div>
    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
      <div className="col-span-2 text-white/50">Personality</div>
      {Object.entries(d.personality).map(([k, v]) => <div key={k}><div className="flex justify-between"><span>{k}</span><span>{v}</span></div><Bar v={v} c="#7ab8ff" /></div>)}
      <div className="col-span-2 mt-2 text-white/50">Emotion (live)</div>
      {Object.entries(a.emo).map(([k, v]) => <div key={k}><div className="flex justify-between"><span>{k}</span><span>{v.toFixed(2)}</span></div><Bar v={v} c="#ff8a7a" /></div>)}
    </div>
    <div><div className="text-white/50">Long-term goals</div><ul className="list-disc pl-4">{d.goals.map((g) => <li key={g}>{g}</li>)}</ul></div>
    <div><div className="text-white/50">Relationships</div>{Object.entries(a.relationships).map(([k, r]) => <div key={k} className="flex items-center gap-2"><span className="w-16">{k}</span><div className="flex-1"><Bar v={r.trust} c="#8fd0a0" /></div><div className="flex-1"><Bar v={r.affection} c="#ffb8d0" /></div></div>)}<div className="text-white/40">green = trust · pink = affection</div></div>
    <div><div className="text-white/50">Knowledge ({a.knowledge.size})</div><div className="flex flex-wrap gap-1">{[...a.knowledge].map((k) => <span key={k} className="rounded bg-white/10 px-1.5 py-0.5">{k}</span>)}</div></div>
    <div><div className="text-white/50">Recent memory</div>{a.memory.slice(-6).reverse().map((m, i) => <div key={i} className="truncate text-white/70">[{m.kind}{m.from ? ' ' + m.from : ''}] {m.text}</div>)}</div>
  </div>);
}

function Pre({ text }: { text: string }) { return <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-white/80">{text}</pre>; }

function AssetsTab() {
  const reg = useMemo(buildRegistry, []); const sum = registrySummary(reg);
  const [cat, setCat] = useState('all');
  const cats = ['all', ...new Set(reg.map((a) => a.category))];
  const col: Record<string, string> = { planned: '#ff9a7a', generated: '#ffd27a', imported: '#8fd0ff', validated: '#8fe0a0', 'production-ready': '#6fff9a' };
  return (<div className="space-y-2 text-xs">
    <div className="rounded bg-white/5 p-2">{Object.entries(sum).map(([k, v]) => <span key={k} className="mr-3"><b style={{ color: col[k] }}>{v}</b> {k}</span>)}</div>
    <div className="text-amber-300">No asset is production-ready. “generated” = procedural stand-in.</div>
    <div className="flex flex-wrap gap-1">{cats.map((c) => <button key={c} onClick={() => setCat(c)} className={`rounded px-2 py-0.5 ${cat === c ? 'bg-amber-500 text-black' : 'bg-white/10'}`}>{c}</button>)}</div>
    {reg.filter((a) => cat === 'all' || a.category === cat).map((a) => (
      <div key={a.id} className="rounded bg-white/5 p-2"><div className="flex justify-between"><b>{a.name}</b><span style={{ color: col[a.status] }}>{a.status}</span></div><div className="text-white/50">{a.id}{a.usedIn.length ? ` · ${a.usedIn.length} scene(s)` : ''}</div><div className="text-white/70">{a.notes}</div></div>))}
  </div>);
}

function StatusTab() {
  const col = { working: '#8fe0a0', partial: '#ffd27a', missing: '#ff9a7a' };
  return (<div className="space-y-2 text-xs">
    <div className="rounded bg-red-500/10 p-2 text-red-200">This build is NOT the finished 60–90 minute feature. The ledger below lists what exists, its limits and what remains.</div>
    {FEATURES.map((f) => (<div key={f.name} className="rounded bg-white/5 p-2">
      <div className="flex justify-between"><b>{f.name}</b><span style={{ color: col[f.state] }}>{f.state.toUpperCase()}</span></div>
      <div className="text-white/80">{f.status}</div><div className="text-white/50">Limits: {f.limits}</div><div className="text-white/50">Needs: {f.needs}</div></div>))}
  </div>);
}

export function Console({ onClose }: { onClose: () => void }) {
  useFilm();
  const [tab, setTab] = useState<Tab>('Runtime');
  const s = film.scene;
  return (
    <div className="absolute bottom-24 right-4 top-16 z-50 flex w-[440px] flex-col rounded-xl bg-neutral-950/92 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2"><div className="text-sm font-semibold tracking-widest text-amber-300">PRODUCTION CONSOLE</div><button onClick={onClose} className="px-2 text-white/60 hover:text-white">✕</button></div>
      <div className="flex flex-wrap gap-1 border-b border-white/10 p-2">{TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded px-2 py-1 text-xs ${tab === t ? 'bg-amber-500 text-black' : 'bg-white/10 hover:bg-white/20'}`}>{t}</button>)}</div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === 'Runtime' && <RuntimeTab />}
        {tab === 'Minds' && <MindsTab />}
        {tab === 'Screenplay' && (<div className="space-y-2"><button className="rounded bg-amber-500 px-3 py-1 text-xs font-semibold text-black" onClick={() => download('eclipse-screenplay.txt', renderScreenplay())}>Download full screenplay (.txt)</button>{s && <Pre text={renderScene(s, film.sceneIdx)} />}</div>)}
        {tab === 'Scene spec' && s && (<div className="space-y-2"><div className="text-xs text-white/50">Estimated {Math.round(estimateScene(s))}s</div><Pre text={renderSpec(s)} /></div>)}
        {tab === 'Assets' && <AssetsTab />}
        {tab === 'Status' && <StatusTab />}
        {tab === 'Log' && <Pre text={film.log.slice(-120).join('\n')} />}
      </div>
    </div>
  );
}
