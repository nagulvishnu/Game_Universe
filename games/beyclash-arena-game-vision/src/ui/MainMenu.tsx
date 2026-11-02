import { useState } from 'react';
import { PLAYER_LOOKS } from '../data/player';
import { useGame } from '../game/store';
import { audio } from '../game/audio/audio';
import { Btn, Modal, Portrait } from './ui';

export function MainMenu() {
  const g = useGame();
  const [showNew, setShowNew] = useState(false);
  const overlay = g.overlay;
  if (overlay) return null;
  const tiles: { label: string; onClick: () => void; disabled?: boolean; kind?: string }[] = [
    { label: 'Continue', onClick: () => g.continueGame(), disabled: !g.hasSave, kind: 'gold' },
    { label: 'New Game', onClick: () => setShowNew(true), kind: 'pink' },
    { label: 'Explore City', onClick: () => g.exploreCity() },
    { label: 'Quick Battle', onClick: () => g.openOverlay('quick', {}) },
    { label: 'Training', onClick: () => g.openOverlay('training') },
    { label: 'Beyblade Customization', onClick: () => g.openOverlay('customize') },
    { label: 'Player Profile', onClick: () => g.openOverlay('profile') },
    { label: 'Settings', onClick: () => g.openOverlay('settings') },
  ];
  return (
    <div className="absolute inset-0 z-20 flex">
      <div className="speedlines pointer-events-none absolute inset-0" />
      <div className="relative z-10 flex w-[520px] flex-col justify-center gap-3 bg-gradient-to-r from-black/80 via-black/50 to-transparent p-12">
        <div>
          <div className="title-font text-6xl leading-[0.9] text-white drop-shadow-[0_4px_0_#ff3d9a]">Bey<span className="text-cyan-300">clash</span></div>
          <div className="title-font shine-text text-5xl leading-none">Arena</div>
          <div className="mt-2 text-sm font-semibold tracking-widest text-yellow-200">BECOME THE ULTIMATE BEYBLADE CHAMPION</div>
        </div>
        <div className="mt-4 flex flex-col items-start gap-3">
          {tiles.map((t) => <Btn key={t.label} kind={t.kind} disabled={t.disabled} onClick={t.onClick}>{t.label}</Btn>)}
        </div>
        {g.hasSave && <div className="mt-2 text-xs text-cyan-200/70">Save found: {g.save.profile.name} · Lv {g.save.level} · {g.save.points.toLocaleString()} pts</div>}
        {g.loadError && (
          <div className="panel mt-2 max-w-sm p-3 text-xs text-rose-200">
            ⚠ {g.loadError}
            <div className="mt-2"><Btn kind="sm ghost" onClick={() => g.clearLoadError()}>Dismiss</Btn></div>
          </div>
        )}
      </div>
      <div className="absolute bottom-3 right-4 text-right text-[11px] text-white/50">WASD move · Mouse camera · Shift sprint · Space jump · E interact · Esc pause</div>
      {showNew && <NewGame onClose={() => setShowNew(false)} />}
    </div>
  );
}

function NewGame({ onClose }: { onClose: () => void }) {
  const g = useGame();
  const [name, setName] = useState('Rookie');
  const [outfit, setOutfit] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const start = () => { audio.confirm(); g.startNew(name, outfit); onClose(); };
  return (
    <Modal title="New Challenger" sub="Choose your blader. Everyone starts as an unknown beginner." onClose={onClose} width="min(720px, 94vw)">
      <div className="flex flex-wrap gap-6">
        <div className="flex gap-2">
          {PLAYER_LOOKS.map((p, i) => (
            <button key={p.name} onClick={() => { audio.click(); setOutfit(i); }} className={`rounded-lg border-2 p-1 transition ${i === outfit ? 'border-yellow-300 bg-white/10' : 'border-transparent opacity-70 hover:opacity-100'}`}>
              <Portrait look={p.look} size={120} />
              <div className="title-font text-center text-sm">{p.name}</div>
            </button>
          ))}
        </div>
        <div className="flex min-w-[200px] flex-1 flex-col justify-center gap-3">
          <label className="text-xs font-bold uppercase tracking-widest text-cyan-200">Blader name</label>
          <input value={name} maxLength={16} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.stopPropagation()} className="rounded border-2 border-cyan-400/60 bg-black/50 px-3 py-2 text-lg font-bold text-white outline-none focus:border-yellow-300" />
          {g.hasSave && !confirm && <div className="text-xs text-rose-300">⚠ Starting a new game will overwrite your existing save (a deliberate reset).</div>}
          {g.hasSave && !confirm ? <Btn kind="pink" onClick={() => setConfirm(true)}>Overwrite save…</Btn> : <Btn kind="gold" onClick={start}>{g.hasSave ? 'Yes, erase & start' : "Let's go!"}</Btn>}
        </div>
      </div>
    </Modal>
  );
}
