import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TIPS } from '../game/data';
import { sfx, audio } from '../game/audio';
import { INTRO_LEN, startGame } from '../game/control';
import { G, input } from '../game/runtime';
import { useStore } from '../game/store';
import { useTick } from './hooks';
import { Collection } from './Workshop';
import { SettingsPanel } from './Overlays';

const LINES: [number, number, string][] = [[3.5, 7, 'Once, there was one sky.'], [7.5, 11, 'AETHERIA — a kingdom of light, bound by the Sky Heart.'], [11.5, 16, 'Then came the Shattering...'], [16.5, 21, 'Rivers fell into oceans of cloud. Waterfalls without end.'], [21.5, 26.5, 'Castles slept in silence, their kings long forgotten.'], [27, 31, 'But the sky is not empty.'], [31.5, 34.5, 'Something ancient stirs...']];

export function Loading({ progress }: { progress: number }) {
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  return (
    <div className="absolute inset-0 bg-[#02030a] flex flex-col items-center justify-center z-50 pointer-events-auto" data-ui>
      <div className="font-title text-2xl sm:text-4xl shimmer font-black mb-6">SKYBREAKERS</div>
      <div className="w-[min(80vw,420px)] bar" style={{ height: 8 }}><i style={{ width: `${progress * 100}%`, background: 'linear-gradient(90deg,#a46bff,#5ae6ff,#e8c46a)' }} /></div>
      <div className="mt-4 text-xs sm:text-sm text-slate-300 text-center px-6 max-w-[520px]">✦ {tip}</div>
      <div className="mt-2 text-[10px] tracking-[.3em] text-slate-500">GENERATING FLOATING WORLD…</div>
    </div>
  );
}

export function IntroOverlay() {
  useTick(80); const t = G.cam.introT; const s = useStore();
  useEffect(() => { if (t > INTRO_LEN) { s.setScreen('menu'); G.cam.introT = 0; } }, [t > INTRO_LEN]);
  const fadeIn = t < 4 ? 1 - Math.max(0, (t - 1) / 3) : 0; const fadeOut = t > INTRO_LEN - 1.5 ? (t - (INTRO_LEN - 1.5)) / 1.5 : 0; const line = LINES.find(l => t >= l[0] && t < l[1]);
  const title = t > 34.5 ? Math.min(1, (t - 34.5) / 1.8) : 0; const sub = t > 37 ? Math.min(1, (t - 37) / 1.5) : 0;
  return (
    <div className="absolute inset-0 pointer-events-auto z-40" data-ui>
      <div className="absolute inset-0 bg-black" style={{ opacity: Math.max(fadeIn, fadeOut), transition: 'opacity .3s' }} />
      <div className="absolute inset-x-0 top-0 h-[10vh] bg-black" /><div className="absolute inset-x-0 bottom-0 h-[10vh] bg-black" />
      <AnimatePresence mode="wait">{line && <motion.div key={line[2]} className="absolute inset-x-0 bottom-[18vh] text-center font-title text-lg sm:text-3xl text-[#fff3cf] px-6" style={{ textShadow: '0 2px 20px #000' }} initial={{ opacity: 0, y: 8, letterSpacing: '.3em' }} animate={{ opacity: 1, y: 0, letterSpacing: '.12em' }} exit={{ opacity: 0 }} transition={{ duration: 1 }}>{line[2]}</motion.div>}</AnimatePresence>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="font-title font-black text-4xl sm:text-8xl shimmer" style={{ opacity: title, transform: `scale(${0.9 + title * 0.1})`, letterSpacing: '.12em' }}>SKYBREAKERS</div>
        <div className="font-title text-lg sm:text-4xl text-cyan-100 mt-3 tracking-[.5em]" style={{ opacity: sub, textShadow: '0 0 30px #5ae6ff' }}>LOST KINGDOMS</div>
      </div>
      <button className="btn btn-sm absolute right-4 bottom-[12vh]" onClick={() => { sfx('click'); s.setScreen('menu'); G.cam.introT = 0; }}>Skip ▸▸</button>
      <div className="absolute left-4 bottom-[12vh] text-[10px] sm:text-xs text-slate-400 max-w-[50vw]">✦ {TIPS[Math.floor(t / 6) % TIPS.length]}</div>
    </div>
  );
}

export function MainMenu() {
  const s = useStore(); const [view, setView] = useState<'main' | 'collection' | 'settings'>('main');
  useEffect(() => { if (s.saveExists) s.load(); }, []);
  const go = (mode: 'new' | 'continue') => { audio.init(); sfx('open'); startGame(mode); if (!input.touch) { try { document.getElementById('game-root')?.requestPointerLock?.(); } catch { /* */ } } };
  const hover = () => sfx('hover');
  return (
    <div className="absolute inset-0 z-30 pointer-events-auto" data-ui onMouseDown={() => audio.init()}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(5,8,24,.75), rgba(5,8,24,.1) 70%), linear-gradient(0deg, rgba(2,3,10,.7), transparent 40%)' }} />
      <div className="absolute inset-0 flex flex-col lg:flex-row items-center justify-center lg:justify-start px-6 sm:px-16 gap-6 lg:gap-24">
        <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1 }} className="text-center lg:text-left">
          <div className="font-title font-black text-4xl sm:text-7xl shimmer leading-none">SKYBREAKERS</div>
          <div className="font-title text-base sm:text-2xl text-cyan-100 tracking-[.45em] mt-2" style={{ textShadow: '0 0 24px #5ae6ff' }}>LOST KINGDOMS</div>
          <div className="mt-3 text-xs sm:text-sm text-slate-300 max-w-[420px] hidden sm:block">Explore the shattered skies of Aetheria. Pilot airships, hunt colossal monsters, recover ancient artifacts and raise a new kingdom among the clouds.</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1, delay: 0.3 }} className="flex flex-col gap-2.5 w-[min(86vw,320px)]">
          <button className="btn btn-gold text-base py-3" onMouseEnter={hover} onClick={() => go(s.saveExists ? 'continue' : 'new')}>▶ Play</button>
          <button className="btn" disabled={!s.saveExists} onMouseEnter={hover} onClick={() => go('continue')}>Continue</button>
          <button className="btn" onMouseEnter={hover} onClick={() => { if (!s.saveExists || confirm('Start a new adventure? Your existing save will be overwritten.')) go('new'); }}>New Adventure</button>
          <button className="btn" onMouseEnter={hover} onClick={() => { sfx('click'); setView('collection'); }}>Airship Collection</button>
          <button className="btn" onMouseEnter={hover} onClick={() => { sfx('click'); setView('settings'); }}>Settings</button>
          <div className="text-[10px] text-slate-500 text-center mt-1">v1.0 · Keyboard & mouse, gamepad-free touch controls supported</div>
        </motion.div>
      </div>
      {view === 'collection' && <Collection onClose={() => setView('main')} />}{view === 'settings' && <SettingsPanel onClose={() => setView('main')} />}
    </div>
  );
}
