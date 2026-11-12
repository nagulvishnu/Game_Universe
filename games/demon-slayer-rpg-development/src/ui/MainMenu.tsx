import { useEffect, useRef, useState } from 'react';
import { useStore } from '../game/store';
import { audio } from '../game/audio';
import { CharacterDetail, Roster } from './panels';
import { questStatus } from './panels2';
import { STORY, TRAINING, TRIALS, SIDE } from '../game/data/quests';
import { SettingsPanel } from './common';
import { REGION_BY_ID } from '../game/data/regions';

function MenuBackground() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!; const g = cv.getContext('2d')!; let raf = 0; let t = 0;
    const petals = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), s: 2 + Math.random() * 4, v: 0.02 + Math.random() * 0.05, r: Math.random() * 6, w: Math.random() * 2 }));
    const stars = Array.from({ length: 120 }, () => ({ x: Math.random(), y: Math.random() * 0.6, s: Math.random() * 1.6 + 0.3, p: Math.random() * 6 }));
    const resize = () => { cv.width = cv.clientWidth; cv.height = cv.clientHeight; }; resize(); window.addEventListener('resize', resize);
    const ridge = (base: number, amp: number, f: number, off: number, col: string, W: number, H: number) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 8) g.lineTo(x, H * base + Math.sin(x * f + off) * amp + Math.sin(x * f * 2.3 + off * 1.7) * amp * 0.45 + Math.sin(x * f * 5 + off) * amp * 0.15); g.lineTo(W, H); g.fill(); };
    const loop = () => {
      t += 0.016; const W = cv.width; const H = cv.height;
      const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#04050f'); sky.addColorStop(0.5, '#1a1840'); sky.addColorStop(0.8, '#5a2a5a'); sky.addColorStop(1, '#c0485a'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
      stars.forEach((s) => { g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + s.p); g.fillStyle = '#fff'; g.fillRect(s.x * W, s.y * H, s.s, s.s); }); g.globalAlpha = 1;
      const mx = W * 0.72; const my = H * 0.28; const mr = Math.min(W, H) * 0.12; const mg = g.createRadialGradient(mx, my, mr * 0.2, mx, my, mr * 3); mg.addColorStop(0, 'rgba(255,240,220,.55)'); mg.addColorStop(1, 'rgba(255,240,220,0)'); g.fillStyle = mg; g.fillRect(0, 0, W, H);
      g.fillStyle = '#fff4e0'; g.beginPath(); g.arc(mx, my, mr, 0, 7); g.fill(); g.fillStyle = 'rgba(200,190,170,.4)'; g.beginPath(); g.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.25, 0, 7); g.arc(mx + mr * 0.35, my + mr * 0.3, mr * 0.18, 0, 7); g.fill();
      ridge(0.55, H * 0.07, 0.004, 1 + t * 0.02, '#2a2048', W, H); ridge(0.66, H * 0.06, 0.006, 4 - t * 0.03, '#1c1636', W, H); ridge(0.78, H * 0.05, 0.009, 9 + t * 0.05, '#120e26', W, H);
      // torii
      const tx = W * 0.62; const ty = H * 0.62; const ts = H * 0.0016; g.fillStyle = '#0a0612'; g.fillRect(tx - 90 * ts, ty - 30 * ts, 14 * ts, 160 * ts); g.fillRect(tx + 76 * ts, ty - 30 * ts, 14 * ts, 160 * ts); g.fillRect(tx - 120 * ts, ty - 50 * ts, 240 * ts, 18 * ts); g.fillRect(tx - 100 * ts, ty - 10 * ts, 200 * ts, 10 * ts);
      // water breathing ribbons
      for (let k = 0; k < 4; k++) { g.strokeStyle = `rgba(${90 + k * 30},${170 + k * 20},255,${0.5 - k * 0.1})`; g.lineWidth = 6 - k; g.beginPath(); for (let x = 0; x <= W; x += 10) { const y = H * (0.82 + k * 0.035) + Math.sin(x * 0.012 + t * (1.2 + k * 0.3) + k) * 14 * (1 + k * 0.4); x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
      ridge(0.92, H * 0.03, 0.01, 2, '#07050f', W, H);
      // petals & embers
      petals.forEach((p, i) => { p.y += p.v * 0.016 * 3; p.x += Math.sin(t + p.w) * 0.0006 + 0.0004; if (p.y > 1.05) { p.y = -0.05; p.x = Math.random(); } if (p.x > 1.05) p.x = -0.05; g.save(); g.translate(p.x * W, p.y * H); g.rotate(p.r + t * p.w); g.fillStyle = i % 5 === 0 ? 'rgba(255,150,80,.9)' : 'rgba(255,190,210,.85)'; g.beginPath(); g.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, 7); g.fill(); g.restore(); });
      raf = requestAnimationFrame(loop);
    };
    loop(); return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} className="bg" />;
}

export function MainMenu() {
  const s = useStore(); const [confirm, setConfirm] = useState(false); const [sel, setSel] = useState(s.profile.activeChar);
  useEffect(() => { const f = () => { audio.ensure(); audio.setMode('menu'); audio.setAmbience('wind', true, 'none'); audio.setVolumes(useStore.getState().profile.settings); }; window.addEventListener('pointerdown', f, { once: true }); window.addEventListener('keydown', f, { once: true }); return () => { window.removeEventListener('pointerdown', f); window.removeEventListener('keydown', f); }; }, []);
  const panel = s.mainPanel; const open = (p: typeof panel) => { audio.sfx('uiok'); s.setMainPanel(panel === p ? null : p); };
  const startChapter = (id: string) => { if (!s.saveExists && id === 'ch1') s.newGame(); else s.startQuestFromMenu(id); };
  return (
    <div className="menu">
      <MenuBackground />
      <div className="menu-left">
        <p className="title-a">鬼滅の刃 · EXPANDED EDITION</p>
        <h1 className="title-b">DEMON SLAYER<br />THE BREATHING WORLD</h1>
        <div className="title-c">MASTER THE BREATHING STYLES · BECOME LEGENDARY</div>
        <div className="menu-list" role="menu">
          {!confirm ? <button className="btn" onClick={() => { audio.sfx('uiok'); if (s.saveExists) setConfirm(true); else s.newGame(); }}>New Game</button>
            : <div className="card" style={{ maxWidth: 320 }}><div className="small">Starting a new game will overwrite your existing save. Continue?</div><div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem' }}><button className="btn sm gold" onClick={() => { setConfirm(false); s.newGame(); }}>Overwrite</button><button className="btn sm" onClick={() => setConfirm(false)}>Cancel</button></div></div>}
          <button className="btn" disabled={!s.saveExists} onClick={() => { audio.sfx('uiok'); s.continueGame(); }}>Continue {s.saveExists ? `· Ch.${s.profile.chapter} · Lv.${s.profile.chars[s.profile.activeChar].level}` : ''}</button>
          <button className="btn" onClick={() => open('chars')}>Character Selection</button>
          <button className="btn" onClick={() => open('chapters')}>Story Chapters</button>
          <button className="btn" onClick={() => open('training')}>Training</button>
          <button className="btn" onClick={() => open('settings')}>Settings</button>
          <button className="btn" onClick={() => open('credits')}>Credits</button>
        </div>
      </div>
      <div className="menu-right">
        {panel === 'chars' && <div className="sub"><h2>CHARACTER SELECTION <button className="btn sm" onClick={() => s.setMainPanel(null)}>Close</button></h2>
          <div className="small dim" style={{ marginBottom: '.6rem' }}>{s.saveExists ? 'Choose your active character. Unlock the rest through story chapters and Hashira trials.' : 'Start a new game to begin. Roster preview:'}</div>
          <div className="split" style={{ gridTemplateColumns: '300px 1fr' }}><Roster sel={sel} onSel={(id) => { setSel(id); }} cols={3} /><div className="card"><CharacterDetail id={sel} /></div></div></div>}
        {panel === 'chapters' && <div className="sub"><h2>STORY CHAPTERS <button className="btn sm" onClick={() => s.setMainPanel(null)}>Close</button></h2><div className="grid cols-2">{STORY.map((q) => { const st = questStatus(s.profile, q); return (
          <div key={q.id} className={`card ${st.ok ? '' : 'locked'}`}><div style={{ fontFamily: 'var(--font)' }}>Ch.{q.chapter} — {q.title}</div><div className="small dim">{REGION_BY_ID[q.region].name} · {q.desc}</div><div style={{ marginTop: '.4rem', display: 'flex', gap: '.5rem', alignItems: 'center' }}><button className="btn sm gold" disabled={!st.ok} onClick={() => startChapter(q.id)}>{st.done ? 'Replay' : 'Play'}</button>{st.done && <span className="ok small">✔ Complete</span>}{!st.ok && <span className="red small">🔒 {st.why}</span>}</div></div>); })}</div></div>}
        {panel === 'training' && <div className="sub"><h2>TRAINING <button className="btn sm" onClick={() => s.setMainPanel(null)}>Close</button></h2>
          <div className="small dim" style={{ marginBottom: '.5rem' }}>Pick a fighter, then enter the dojo to practise combos, dodges, parries and breathing forms against dummies (DPS is shown on screen).</div>
          <div className="split" style={{ gridTemplateColumns: '300px 1fr' }}><Roster sel={s.profile.activeChar} onSel={(id) => { if (s.profile.unlockedChars.includes(id)) s.switchChar(id); }} cols={3} />
            <div className="grid" style={{ alignContent: 'start' }}>
              <div className="card"><div style={{ fontFamily: 'var(--font)' }}>Free Training — Mount Sagiri Dojo</div><div className="small dim">Unlimited dummies, no risk. Open the pause menu to leave.</div><button className="btn sm gold" style={{ marginTop: '.4rem' }} onClick={() => s.startQuestFromMenu(TRAINING.id)}>Start training</button></div>
              {[SIDE.find((q) => q.id === 's_train')!, ...TRIALS].map((q) => { const st = questStatus(s.profile, q); return <div key={q.id} className={`card ${st.ok ? '' : 'locked'}`}><div style={{ fontFamily: 'var(--font)' }}>{q.title}</div><div className="small dim">{q.desc}</div><button className="btn sm" style={{ marginTop: '.4rem' }} disabled={!st.ok || !s.saveExists} onClick={() => s.startQuestFromMenu(q.id)}>{st.ok ? 'Begin challenge' : st.why}</button></div>; })}
            </div></div></div>}
        {panel === 'settings' && <div className="sub"><h2>SETTINGS <button className="btn sm" onClick={() => s.setMainPanel(null)}>Close</button></h2><SettingsPanel /></div>}
        {panel === 'credits' && <div className="sub"><h2>CREDITS <button className="btn sm" onClick={() => s.setMainPanel(null)}>Close</button></h2>
          <p>An unofficial fan-made tribute inspired by <i>Demon Slayer: Kimetsu no Yaiba</i> by Koyoharu Gotouge. Not affiliated with or endorsed by the rights holders. All characters, names and the world belong to their respective owners.</p>
          <p className="dim small">Engineering & design: React, TypeScript, Three.js / React Three Fiber, Zustand, IndexedDB persistence. All 3D models, effects, music and sound effects are generated procedurally in code — no ripped assets, no external audio files. Original dialogue and side-story content written for this edition.</p></div>}
      </div>
      <div className="ver">v1.0 · Expanded Edition · Best experienced in Chrome, fullscreen, mouse + keyboard</div>
    </div>
  );
}
