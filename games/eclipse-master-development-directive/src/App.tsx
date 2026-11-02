import { useEffect, useRef, useState } from 'react';
import Stage from './Stage';
import { film } from './film/runtime';
import { audio } from './audio/audio';
import { loadProgress, type SavedProgress } from './film/persistence';
import { Captions, Controls, Credits, FadeLayer, Letterbox, SceneBanner, TitleCard, useFilm } from './ui/Overlays';
import { Console } from './ui/Console';
import { SCENES } from './story/orchestrator';

export default function App() {
  const [quality, setQuality] = useState<'cinematic' | 'performance'>('cinematic');
  const [subs, setSubs] = useState(true);
  const [panel, setPanel] = useState(false);
  const [ui, setUi] = useState(true);
  const [saved, setSaved] = useState<SavedProgress | undefined>();
  const [pick, setPick] = useState(0);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);
  useFilm();
  (window as unknown as { __film: typeof film }).__film = film; // test hook
  const idle = film.status === 'idle';

  useEffect(() => { loadProgress().then(setSaved).catch(() => undefined); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (film.status === 'idle') return;
      if (e.code === 'Space') { e.preventDefault(); film.toggle(); }
      else if (e.code === 'ArrowRight') film.next();
      else if (e.code === 'ArrowLeft') film.prev();
      else if (e.key === 'c') setPanel((p) => !p);
      else if (e.key === 'm') { audio.setMuted(!audio.muted); film.bump(); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  const poke = () => { setUi(true); if (hide.current) clearTimeout(hide.current); hide.current = setTimeout(() => setUi(false), 3500); };
  const begin = (i: number) => { film.start(i); poke(); };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black select-none" onMouseMove={poke} style={{ cursor: ui || idle ? 'default' : 'none' }}>
      <style>{`
        @keyframes titleFade { 0% {opacity:0; transform:scale(.97)} 18% {opacity:1; transform:scale(1)} 82% {opacity:1} 100% {opacity:0; transform:scale(1.03)} }
        @keyframes bannerFade { 0% {opacity:0; transform:translateX(-12px)} 15% {opacity:1; transform:none} 80% {opacity:1} 100% {opacity:0} }
        @keyframes creditRoll { from { transform: translateY(0) } to { transform: translateY(-190%) } }
      `}</style>
      <div className="absolute inset-0"><Stage quality={quality} /></div>
      {!idle && <Letterbox />}
      <Captions enabled={subs} />
      <TitleCard />
      <Credits />
      <SceneBanner />
      <FadeLayer />
      {film.status === 'ended' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 text-white">
          <div className="text-5xl font-light tracking-[0.4em]">THE END</div>
          <div className="mt-3 text-sm text-white/60">Rendered playback: {Math.floor(film.totalT / 60)} min {Math.round(film.totalT % 60)} s</div>
          <button className="mt-8 rounded-lg bg-amber-500 px-6 py-2 font-semibold text-black" onClick={() => begin(0)}>Watch again</button>
        </div>
      )}
      {film.status === 'paused' && <div className="pointer-events-none absolute left-1/2 top-[14%] z-40 -translate-x-1/2 rounded bg-black/60 px-4 py-1 text-xs tracking-[0.4em] text-white">PAUSED</div>}
      {!idle && <Controls visible={ui || film.status === 'paused'} onConsole={() => setPanel((p) => !p)} subs={subs} setSubs={setSubs} quality={quality} setQuality={setQuality} />}
      {!idle && panel && <Console onClose={() => setPanel(false)} />}
      {idle && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center text-white" style={{ background: 'radial-gradient(circle at 50% 40%, #2a1650 0%, #0a0714 60%, #000 100%)' }}>
          <div className="absolute h-72 w-72 rounded-full bg-black shadow-[0_0_120px_30px_rgba(255,190,100,0.55)] ring-8 ring-amber-200/60" style={{ top: '9%' }} />
          <div className="z-10 mt-56 text-center">
            <div className="text-7xl font-extralight tracking-[0.55em] pl-[0.55em]">ECLIPSE</div>
            <div className="mt-3 text-lg tracking-[0.6em] pl-[0.6em] text-amber-200">THE LAST AWAKENING</div>
            <div className="mx-auto mt-6 max-w-lg text-sm leading-relaxed text-white/60">An autonomous 3D anime film. There is no player: every character is an independent NPC agent, directed by an automatic camera. You are the audience.</div>
            <div className="mt-8 flex items-center justify-center gap-3">
              <button className="rounded-lg bg-amber-500 px-8 py-3 text-lg font-semibold text-black shadow-lg hover:bg-amber-400" onClick={() => begin(0)}>▶ Play film</button>
              {saved && saved.sceneIdx > 0 && <button className="rounded-lg bg-white/10 px-5 py-3 hover:bg-white/20" onClick={() => begin(saved.sceneIdx)}>Resume · scene {saved.sceneIdx + 1} ({SCENES[saved.sceneIdx]?.title})</button>}
            </div>
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-white/60">
              <span>or start at</span>
              <select value={pick} onChange={(e) => setPick(+e.target.value)} className="rounded bg-white/10 px-2 py-1 text-white">
                {SCENES.map((s, i) => <option key={s.id} value={i} className="text-black">{i + 1}. {s.title}</option>)}
              </select>
              <button className="rounded bg-white/10 px-3 py-1 hover:bg-white/20" onClick={() => begin(pick)}>Go</button>
            </div>
            <div className="mt-6 text-xs text-white/35">Space: pause · ←/→: scene · C: production console · M: mute · Sound on recommended (voices use your browser's speech synthesis)</div>
          </div>
        </div>
      )}
    </div>
  );
}
