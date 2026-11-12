import { useState } from 'react';
import { useGame } from '../game/store';
import { WEAPONS } from '../game/data/weapons';
import { ARENAS, MODES, CHALLENGES } from '../game/data/world';
import { startRun } from '../game/modes';
import { lockPointer } from '../game/input';
import { initAudio, setMusic, sfx } from '../game/audio';
import { Armory, ArenaCards, ControlsPanel, ModeCards, ScoreTable, SettingsPanel, TrainingPanel, hex } from './common';
import { ModeId } from '../game/types';

let splashDone = false;
const TABS = [['play', 'Battle'], ['armory', 'Armory'], ['scores', 'Records'], ['settings', 'Settings'], ['controls', 'Controls']] as const;

export default function Hub() {
  const st = useGame(); const [splash, setSplashRaw] = useState(!splashDone); const setSplash = (v: boolean) => { splashDone = !v; setSplashRaw(v); }; const [sm, setSm] = useState<ModeId | 'all'>('survival');
  const go = (mode = st.mode, arena = st.arena) => { splashDone = true; initAudio(); sfx.start(); startRun(mode, arena); lockPointer(); };
  const w = WEAPONS[st.weapon];
  if (splash) return (
    <div className="absolute inset-0 flex flex-col justify-between p-5 md:p-10 pointer-events-none" style={{ background: 'linear-gradient(90deg, rgba(5,2,8,.92) 0%, rgba(5,2,8,.55) 45%, transparent 75%)' }}>
      <div className="pointer-events-auto max-w-xl fade-in">
        <p className="disp text-[11px] md:text-xs tracking-[.5em] text-amber-300/90">Anime weapon-combat arena</p>
        <h1 className="title-main text-5xl sm:text-6xl md:text-8xl mt-2">CHAOS<br />BREAKER</h1>
        <p className="mt-4 text-sm md:text-base text-zinc-300 max-w-md">Six legendary weapons. Five fighting styles. One rule: <b className="text-amber-300">deflect at the last instant</b> and turn every enemy blow into your counter.</p>
        <div className="mt-6 flex flex-col gap-3 w-72">
          <button className="btn primary text-lg" onClick={() => go('survival', 'citadel')}>⚔ Quick Battle</button>
          <button className="btn" onClick={() => { initAudio(); setMusic(0, 1); sfx.ui(); setSplash(false); }}>Combat Hub</button>
          <button className="btn" onClick={() => { initAudio(); sfx.ui(); st.set({ hubTab: 'scores' }); setSplash(false); }}>High Scores</button>
        </div>
        <div className="mt-6 panel p-3 text-xs text-zinc-300 max-w-md leading-6">
          <div className="disp text-amber-300 mb-1 text-[11px]">Quick controls</div>
          <span className="key">WASD</span> move · <span className="key">LMB</span> light · <span className="key">F</span> heavy (hold = charge) · <span className="key">RMB</span> <b className="text-amber-300">deflect</b><br />
          <span className="key">Q</span> dodge · <span className="key">E</span><span className="key">R</span> specials · <span className="key">V</span> ultimate · <span className="key">T</span> awaken · <span className="key">1-6</span> weapons<br />
          <span className="key">Tab</span> combat menu · <span className="key">M</span> arenas · <span className="key">C</span> lock-on · <span className="key">Esc</span> pause · touch controls appear on mobile
        </div>
      </div>
      <div className="pointer-events-none text-[11px] text-zinc-500 tracking-widest uppercase">Master your weapon · Perfect your deflection · Break the limits of combat</div>
    </div>
  );
  const wide = st.hubTab !== 'play';
  return (
    <div className="absolute inset-0 flex pointer-events-none">
      <div className={`pointer-events-auto h-full flex flex-col fade-in ${wide ? 'w-full md:w-[min(1100px,96vw)]' : 'w-full md:w-[min(760px,62vw)]'}`} style={{ background: 'linear-gradient(90deg, rgba(5,3,10,.94), rgba(5,3,10,.82) 80%, rgba(5,3,10,.0))' }}>
        <div className="flex items-center gap-2 px-4 pt-3 border-b border-white/10 overflow-x-auto shrink-0">
          <button className="disp font-black text-amber-300 mr-3 text-lg whitespace-nowrap" onClick={() => setSplash(true)}>CHAOS BREAKER</button>
          {TABS.map(([k, l]) => <button key={k} className={`tab whitespace-nowrap ${st.hubTab === k ? 'on' : ''}`} onClick={() => { sfx.ui(); st.set({ hubTab: k }); }}>{l}</button>)}
        </div>
        <div className="flex-1 scroll p-4 space-y-4">
          {st.hubTab === 'play' && <>
            <div className="flex gap-3 items-center panel p-2">
              <div className="w-1.5 self-stretch" style={{ background: hex(w.color), boxShadow: `0 0 12px ${hex(w.color)}` }} />
              <div className="flex-1 text-sm"><span className="disp font-bold" style={{ color: hex(w.color2) }}>{w.name}</span> · <span className="text-zinc-300">{st.style.toUpperCase()}</span><div className="text-[11px] text-zinc-500">Change loadout in the Armory - the hero on the right shows your weapon.</div></div>
              <button className="btn sm" onClick={() => st.set({ hubTab: 'armory' })}>Armory</button>
            </div>
            <h3 className="disp text-sm text-amber-300">Game mode</h3><ModeCards />
            {st.mode === 'training' && <TrainingPanel />}
            {st.mode === 'mastery' && <div className="panel p-3 text-xs space-y-1"><div className="disp text-amber-300">{w.name} challenges</div>{CHALLENGES[w.id].map(c => <div key={c.id}>{st.save.done[c.id] ? '✓' : '○'} {c.label} — <span className="text-zinc-500">{c.rewardLabel}</span></div>)}</div>}
            <h3 className="disp text-sm text-amber-300">Arena</h3><ArenaCards />
            <div className="text-[11px] text-zinc-500">Best {MODES.find(m => m.id === st.mode)?.name}: <b className="text-amber-300">{(st.save.best[st.mode] ?? 0).toLocaleString()}</b></div>
          </>}
          {st.hubTab === 'armory' && <Armory />}
          {st.hubTab === 'scores' && <div className="panel p-4"><div className="flex gap-1 flex-wrap mb-3">{(['all', ...MODES.map(m => m.id)] as const).filter(m => m !== 'training').map(m => <button key={m} className={`tab ${sm === m ? 'on' : ''}`} onClick={() => setSm(m as ModeId | 'all')}>{m}</button>)}</div><ScoreTable mode={sm} /></div>}
          {st.hubTab === 'settings' && <SettingsPanel />}
          {st.hubTab === 'controls' && <ControlsPanel />}
        </div>
        <div className="shrink-0 p-3 border-t border-white/10 flex items-center gap-3 bg-black/40">
          <button className="btn primary flex-1 md:flex-none md:min-w-[340px]" onClick={() => go()}>Enter {ARENAS[st.arena].name} · {MODES.find(m => m.id === st.mode)?.name}</button>
          <span className="text-[11px] text-zinc-500 hidden md:block">Press to start - pointer locks for mouse-look (Esc to release)</span>
        </div>
      </div>
    </div>
  );
}
