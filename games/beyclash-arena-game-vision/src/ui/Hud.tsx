import { useEffect, useRef, useState } from 'react';
import { RIVALS } from '../data/rivals';
import { DISTRICT_CENTERS } from '../data/rivals';
import { getObjective, useGame } from '../game/store';
import { repTitle, xpForLevel } from '../game/progression/rewards';
import { QUALIFY_TARGET } from '../game/economy/economy';
import { runtime } from '../game/runtime';
import { DISTRICTS, DISTRICT_MAP } from '../game/world/layout';
import { Bar, Btn, Modal } from './ui';
import { audio } from '../game/audio/audio';

const PADS: Record<string, [number, number, number, number]> = {
  residential: [-110, -45, -72, -11], shopping: [-31, 31, -72, -11], training: [45, 110, -72, -11],
  competition: [45, 110, 11, 72], elite: [-31, 31, 11, 72], championship: [-110, -45, 11, 72],
};

export function drawMap(c: HTMLCanvasElement, big: boolean) {
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const w = c.width, h = c.height;
  const sx = (x: number) => ((x + 112) / 224) * w;
  const sz = (z: number) => ((z + 74) / 148) * h;
  const st = useGame.getState();
  ctx.fillStyle = '#0d1b2a'; ctx.fillRect(0, 0, w, h);
  for (const d of DISTRICTS) {
    const [x1, x2, z1, z2] = PADS[d.id];
    ctx.fillStyle = d.color + '40'; ctx.fillRect(sx(x1), sz(z1), sx(x2) - sx(x1), sz(z2) - sz(z1));
    ctx.strokeStyle = d.color; ctx.lineWidth = 1; ctx.strokeRect(sx(x1), sz(z1), sx(x2) - sx(x1), sz(z2) - sz(z1));
    if (big) { ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(d.name, sx(DISTRICT_CENTERS[d.id].x), sz(PADS[d.id][2] + 6)); ctx.font = '10px sans-serif'; ctx.fillStyle = d.color; ctx.fillText(d.tagline, sx(DISTRICT_CENTERS[d.id].x), sz(PADS[d.id][2] + 11)); }
  }
  ctx.strokeStyle = '#7d8aa8'; ctx.lineWidth = big ? 5 : 3;
  for (const z of [-40, 0, 40]) { ctx.beginPath(); ctx.moveTo(0, sz(z)); ctx.lineTo(w, sz(z)); ctx.stroke(); }
  for (const x of [-76, -38, 0, 38, 76]) { ctx.beginPath(); ctx.moveTo(sx(x), 0); ctx.lineTo(sx(x), h); ctx.stroke(); }
  for (const d of DISTRICTS) { const c0 = DISTRICT_CENTERS[d.id]; ctx.fillStyle = d.color; ctx.beginPath(); ctx.arc(sx(c0.x), sz(c0.z), big ? 7 : 4, 0, 7); ctx.fill(); }
  const p = runtime.pos;
  for (const r of RIVALS) {
    const prog = st.save.rivals[r.id];
    const near = Math.hypot(r.home.x - p.x, r.home.z - p.z) < 40;
    if (!prog.met && !near && !big) continue;
    if (!prog.met && big) { ctx.fillStyle = '#ffffff55'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('?', sx(r.home.x), sz(r.home.z) + 4); continue; }
    ctx.fillStyle = prog.defeated ? '#38e08c' : '#ff4d6d';
    ctx.beginPath(); ctx.arc(sx(r.home.x), sz(r.home.z), big ? 4 : 2.5, 0, 7); ctx.fill();
    if (big) { ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(r.name.split(' ')[0], sx(r.home.x), sz(r.home.z) - 7); }
  }
  const obj = getObjective(st.save).target;
  if (obj) {
    ctx.fillStyle = '#ffd24a'; ctx.beginPath();
    const ox = sx(obj.x), oz = sz(obj.z), s = big ? 9 : 6;
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? s * 0.45 : s; ctx.lineTo(ox + Math.cos(a) * rr, oz + Math.sin(a) * rr); }
    ctx.fill();
  }
  ctx.save(); ctx.translate(sx(p.x), sz(p.z)); ctx.rotate(Math.PI - runtime.yaw);
  ctx.fillStyle = '#35d0ff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -(big ? 9 : 6)); ctx.lineTo(big ? 6 : 4, big ? 7 : 5); ctx.lineTo(0, big ? 3 : 2); ctx.lineTo(big ? -6 : -4, big ? 7 : 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function MapCanvas({ big }: { big?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const id = setInterval(() => { if (ref.current) drawMap(ref.current, !!big); }, 120);
    if (ref.current) drawMap(ref.current, !!big);
    return () => clearInterval(id);
  }, [big]);
  return <canvas ref={ref} width={big ? 896 : 224} height={big ? 592 : 148} className={`rounded-md border-2 border-cyan-300/60 ${big ? 'w-full' : 'w-[224px]'}`} />;
}

export function MapOverlay() {
  const g = useGame();
  return (
    <Modal title="City Map" sub="Red = rivals · Green = defeated · ★ = current objective · ? = undiscovered" onClose={() => g.closeOverlay()} width="min(980px,94vw)">
      <MapCanvas big />
    </Modal>
  );
}

export function CityHud() {
  const save = useGame((s) => s.save);
  const prompt = useGame((s) => s.prompt);
  const toasts = useGame((s) => s.toasts);
  const overlay = useGame((s) => s.overlay);
  const [, tick] = useState(0);
  const [banner, setBanner] = useState<{ id: string; k: number } | null>(null);
  const lastD = useRef('');
  useEffect(() => {
    const id = setInterval(() => {
      tick((n) => n + 1);
      if (runtime.district && runtime.district !== lastD.current) { lastD.current = runtime.district; setBanner({ id: runtime.district, k: Date.now() }); }
    }, 250);
    return () => clearInterval(id);
  }, []);
  const obj = getObjective(save);
  const hrs = Math.floor(runtime.clock * 24), mins = Math.floor((runtime.clock * 24 - hrs) * 60);
  const need = xpForLevel(save.level);
  const dist = obj.target ? Math.round(Math.hypot(obj.target.x - runtime.pos.x, obj.target.z - runtime.pos.z)) : 0;
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="panel absolute left-4 top-4 w-72 p-3">
        <div className="flex items-baseline justify-between">
          <div className="title-font text-xl">{save.profile.name}</div>
          <div className="title-font text-2xl text-yellow-300">Lv {save.level}</div>
        </div>
        <Bar value={save.xp} max={need} color="#ffd24a" className="mt-1" />
        <div className="mt-0.5 text-right text-[10px] text-white/60">XP {save.xp}/{need}</div>
        <div className="mt-1 flex justify-between text-sm font-bold">
          <span className="text-cyan-200">◆ {save.points.toLocaleString()} pts</span>
          <span className="text-pink-300">★ {repTitle(save.reputation)} ({save.reputation})</span>
        </div>
        <div className="mt-1 text-[10px] text-white/60">Qualification: {Math.min(100, Math.floor((save.points / QUALIFY_TARGET) * 100))}% of {QUALIFY_TARGET.toLocaleString()} pts</div>
      </div>
      <div className="panel absolute left-1/2 top-4 w-[420px] -translate-x-1/2 px-4 py-2 text-center">
        <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-yellow-300">Current Objective</div>
        <div className="text-sm font-semibold">{obj.text}</div>
        {obj.target && <div className="text-[11px] text-cyan-200">{dist} m away · see map ★</div>}
      </div>
      <div className="absolute right-4 top-4 flex flex-col items-end gap-1">
        <MapCanvas />
        <div className="panel px-3 py-1 text-xs font-bold">{String(hrs).padStart(2, '0')}:{String(mins).padStart(2, '0')} {runtime.night > 0.6 ? '🌙' : '☀'} · M: map</div>
      </div>
      {banner && (
        <div key={banner.k} className="absolute left-0 top-28 w-full" style={{ animation: 'bannerIn 3s ease-out forwards' }}>
          <div className="mx-auto w-fit px-10 py-2" style={{ background: `linear-gradient(90deg, transparent, ${DISTRICT_MAP[banner.id as keyof typeof DISTRICT_MAP].color}cc, transparent)` }}>
            <div className="title-font text-4xl text-white drop-shadow-[0_3px_0_rgba(0,0,0,.6)]">{DISTRICT_MAP[banner.id as keyof typeof DISTRICT_MAP].name}</div>
            <div className="text-center text-xs font-bold uppercase tracking-[0.4em]">{DISTRICT_MAP[banner.id as keyof typeof DISTRICT_MAP].tagline}</div>
          </div>
        </div>
      )}
      {prompt && !overlay && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 slide-up">
          <div className="panel flex items-center gap-3 px-5 py-2">
            <span className="rounded border-2 border-yellow-300 bg-yellow-300/20 px-3 py-0.5 title-font text-xl text-yellow-200 pulse">E</span>
            <div><div className="title-font text-lg">Press E to Interact</div><div className="text-xs text-cyan-200">{prompt}</div></div>
          </div>
        </div>
      )}
      <div className="absolute bottom-3 left-4 text-[11px] text-white/60">
        WASD move · Shift sprint · Ctrl walk · Space jump · Wheel zoom · E interact · M map · Esc pause
        {!runtime.locked && !overlay && <div className="text-yellow-200">Click the game to capture the mouse (or drag to rotate the camera)</div>}
      </div>
      <div className="absolute bottom-3 right-4 flex flex-col items-end gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`slide-in panel px-4 py-2 text-sm font-bold ${t.kind === 'level' ? 'text-yellow-200' : t.kind === 'warn' ? 'text-rose-200' : t.kind === 'good' ? 'text-emerald-200' : ''}`}>{t.text}</div>
        ))}
      </div>
    </div>
  );
}

export function ToastLayer() {
  const toasts = useGame((s) => s.toasts);
  const scene = useGame((s) => s.scene);
  if (scene === 'city') return null;
  return (
    <div className="pointer-events-none absolute bottom-3 right-4 z-40 flex flex-col items-end gap-2">
      {toasts.map((t) => <div key={t.id} className="slide-in panel px-4 py-2 text-sm font-bold">{t.text}</div>)}
    </div>
  );
}

export function PauseMenu() {
  const g = useGame();
  const inBattle = g.scene === 'battle';
  return (
    <Modal title="Paused" width="min(420px,92vw)">
      <div className="flex flex-col items-stretch gap-3">
        <Btn kind="gold" onClick={() => g.closeOverlay()}>Resume</Btn>
        {!inBattle && <Btn onClick={() => { g.persist(); g.notify('Game saved.', 'good'); }}>Save Game</Btn>}
        {!inBattle && <Btn onClick={() => g.openOverlay('map')}>City Map</Btn>}
        {!inBattle && <Btn onClick={() => g.openOverlay('profile')}>Player Profile</Btn>}
        {!inBattle && <Btn onClick={() => g.openOverlay('customize')}>Beyblade Workshop</Btn>}
        <Btn onClick={() => g.openOverlay('settings', { back: 'pause' })}>Settings</Btn>
        {inBattle ? (
          <Btn kind="pink" onClick={() => {
            const b = g.battle!;
            g.closeOverlay();
            if (b.setup.mode === 'rival' || b.setup.mode === 'tournament') { audio.lose(); g.finishBattle({ winner: 1, loser: 0, finish: 'SPIN', time: 0, stamina: [0, 100] }); }
            else g.leaveBattle();
          }}>{g.battle?.setup.mode === 'rival' || g.battle?.setup.mode === 'tournament' ? 'Forfeit (counts as a loss)' : 'Leave Battle'}</Btn>
        ) : <Btn kind="pink" onClick={() => g.toMenu()}>Save & Quit to Menu</Btn>}
      </div>
    </Modal>
  );
}
