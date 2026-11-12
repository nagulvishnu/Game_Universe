import { useEffect, useRef, useSyncExternalStore } from 'react';
import { film } from '../film/runtime';
import { estimateFilm } from '../story/orchestrator';
import { audio } from '../audio/audio';
import { recorder } from '../film/recorder';

export const useFilm = () => useSyncExternalStore(film.subscribe, film.getVersion);
const ACT = ['', 'ACT I', 'ACT II', 'ACT III', 'ACT IV'];
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const EMO_COLOR: Record<string, string> = { anger: '#ff7a7a', fear: '#c9a8ff', sorrow: '#8fb8ff', joy: '#ffe08a', resolve: '#ffcf7a', tender: '#ffb8d0' };

export function Letterbox() {
  return (<>
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-black" style={{ height: '9.5%' }} />
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-black" style={{ height: '9.5%' }} />
  </>);
}

export function FadeLayer() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => { if (ref.current) ref.current.style.opacity = String(film.status === 'idle' ? 1 : film.fade); raf = requestAnimationFrame(loop); };
    loop(); return () => cancelAnimationFrame(raf);
  }, []);
  return <div ref={ref} className="pointer-events-none absolute inset-0 z-20 bg-black" />;
}

export function Captions({ enabled }: { enabled: boolean }) {
  useFilm();
  const c = film.caption;
  if (!enabled || !c || film.status === 'idle') return null;
  const color = EMO_COLOR[c.emo] ?? '#ffffff';
  return (
    <div className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-8" style={{ bottom: '12%' }}>
      <div className="max-w-3xl rounded-lg bg-black/55 px-5 py-3 text-center shadow-lg backdrop-blur-sm">
        <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.25em]" style={{ color }}>
          {c.off ? `${c.name} (voice)` : c.name}
        </div>
        <div className={`text-lg leading-snug text-white ${c.off ? 'italic' : ''}`} style={{ textShadow: '0 1px 4px #000' }}>{c.text}</div>
      </div>
    </div>
  );
}

export function TitleCard() {
  useFilm();
  const t = film.title;
  if (!t || film.status === 'idle') return null;
  const isMain = t.text === 'ECLIPSE';
  return (
    <div key={t.text + t.sub} className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center" style={{ animation: `titleFade ${t.dur}s ease-in-out forwards` }}>
      <div className={`font-light text-white ${isMain ? 'text-8xl tracking-[0.6em] pl-[0.6em]' : 'text-5xl tracking-[0.5em] pl-[0.5em]'}`} style={{ textShadow: '0 0 40px rgba(255,200,120,0.6)' }}>{t.text}</div>
      {t.sub && <div className="mt-5 text-xl tracking-[0.55em] pl-[0.55em] text-amber-200/90">{t.sub}</div>}
    </div>
  );
}

const CREDITS: [string, string[]][] = [
  ['CAST (autonomous NPC agents)', ['Kael Vireon', 'Lyra Ashenvale', 'Master Orrin', 'Seren Vael', 'Regent Malachar', 'Umbral Soldiers', 'The people of Hollow\'s End']],
  ['SYSTEMS', ['Story Orchestrator & Continuity Engine', 'Utility-AI Character Agents', 'A* Navigation', 'Choreographed Combat Controller', 'Cinematic Camera Director', 'Procedural Animation & Lip-Sync', 'Generative Score & Sound Synthesis']],
  ['TECHNOLOGY', ['React · TypeScript · Vite', 'Three.js · React Three Fiber · Drei', 'Postprocessing', 'Web Audio · Web Speech · IndexedDB · MediaRecorder']],
  ['', ['ECLIPSE: THE LAST AWAKENING']],
];
export function Credits() {
  useFilm();
  if (film.scene?.id !== 'credits' || film.status === 'idle') return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      <div className="absolute inset-x-0 text-center text-white" style={{ animation: 'creditRoll 36s linear forwards', top: '100%' }}>
        {CREDITS.map(([h, items], i) => (
          <div key={i} className="mb-16">
            {h && <div className="mb-4 text-sm tracking-[0.5em] text-amber-300">{h}</div>}
            {items.map((x) => <div key={x} className="my-1 text-2xl font-light tracking-widest">{x}</div>)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SceneBanner() {
  useFilm();
  const s = film.scene;
  if (!s || film.status === 'idle' || film.sceneT > 4.5 || film.sceneT < 0.8 || s.id === 'credits' || s.id === 'a1_prologue') return null;
  return (
    <div key={s.id} className="pointer-events-none absolute left-10 z-30" style={{ top: '13%', animation: 'bannerFade 4s ease forwards' }}>
      <div className="text-xs tracking-[0.4em] text-amber-300">{ACT[s.act]} · SCENE {film.sceneIdx + 1}</div>
      <div className="text-2xl font-light tracking-wider text-white" style={{ textShadow: '0 2px 8px #000' }}>{s.title}</div>
      <div className="text-xs tracking-widest text-white/60">{film.envData.name}</div>
    </div>
  );
}

export function Controls({ visible, onConsole, subs, setSubs, quality, setQuality }: {
  visible: boolean; onConsole: () => void; subs: boolean; setSubs: (b: boolean) => void; quality: string; setQuality: (q: 'cinematic' | 'performance') => void;
}) {
  useFilm();
  const playing = film.status === 'playing';
  const est = estimateFilm();
  const rec = recorder.recording;
  const btn = 'rounded-md px-3 py-1.5 text-sm text-white/90 hover:bg-white/15 transition';
  return (
    <div className={`absolute inset-x-0 bottom-0 z-40 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="mx-auto max-w-5xl rounded-xl bg-black/70 px-2 py-2 backdrop-blur-md sm:px-4">
        <div className="mb-2 flex h-2.5 w-full gap-[2px]">
          {film.scenes.map((s, i) => {
            const r = film.report[s.id]; const done = r?.completed; const cur = i === film.sceneIdx;
            const w = film.runtimeReport().rows[i].estimated;
            const frac = cur ? Math.min(1, film.sceneT / Math.max(1, w)) : done ? 1 : 0;
            return (
              <button key={s.id} title={`${i + 1}. ${s.title}`} onClick={() => film.jump(i)} className="relative h-full overflow-hidden rounded-sm bg-white/15 hover:bg-white/30" style={{ flexGrow: w }}>
                <span className="absolute inset-y-0 left-0" style={{ width: `${frac * 100}%`, background: ['', '#f5b73b', '#7ab8ff', '#ff7a8a', '#d58bff'][s.act] }} />
              </button>
            );
          })}
        </div>
        <div className="eclipse-controls flex items-center gap-1">
          <button className={btn} onClick={() => film.prev()} title="Previous scene">⏮</button>
          <button className={btn + ' text-lg'} onClick={() => film.toggle()}>{playing ? '⏸' : '▶'}</button>
          <button className={btn} onClick={() => film.next()} title="Next scene">⏭</button>
          <div className="mx-3 min-w-0 flex-1 truncate text-xs text-white/70">
            <span className="text-amber-300">{ACT[film.scene?.act ?? 1]}</span> · {film.scene?.title} · <span className="tabular-nums">{fmt(film.totalT)}</span> played / ~{fmt(est)} scripted
          </div>
          <button className={btn} onClick={() => setSubs(!subs)}>{subs ? 'CC ●' : 'CC ○'}</button>
          <button className={btn} onClick={() => { audio.setMuted(!audio.muted); film.bump(); }}>{audio.muted ? '🔇' : '🔊'}</button>
          <input type="range" min={0} max={1} step={0.05} defaultValue={audio.musicVol} onChange={(e) => audio.setMusicVol(+e.target.value)} className="w-20 accent-amber-400" title="Music volume" />
          <button className={btn} onClick={() => setQuality(quality === 'cinematic' ? 'performance' : 'cinematic')} title="Post-processing quality">{quality === 'cinematic' ? 'FX ●' : 'FX ○'}</button>
          <button className={btn + (rec ? ' bg-red-600/70' : '')} onClick={() => { if (rec) recorder.stop(); else recorder.start(document.getElementById('film-canvas') as HTMLCanvasElement); film.bump(); }} title="Record to WebM (real time)">{rec ? '■ REC' : '● REC'}</button>
          <button className={btn} onClick={onConsole}>Production ☰</button>
          <button className={btn} onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}>⛶</button>
        </div>
      </div>
    </div>
  );
}
