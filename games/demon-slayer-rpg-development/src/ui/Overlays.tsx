import { useEffect, useState } from 'react';
import { useStore, type MenuTab } from '../game/store';
import { CharacterPanel, InventoryPanel, SkillsPanel, SmithPanel } from './panels';
import { CorpsPanel, JournalPanel, MapPanel } from './panels2';
import { ControlsList, Portrait, SettingsPanel, speakerLook } from './common';
import { audio } from '../game/audio';

const TABS: [MenuTab, string, string][] = [['character', 'Character', 'Tab'], ['skills', 'Skills', 'K'], ['inventory', 'Inventory', 'I'], ['smith', 'Smith & Shop', 'B'], ['journal', 'Journal', 'J'], ['corps', 'Corps', 'N'], ['map', 'World Map', 'M']];

export function GameMenu() {
  const tab = useStore((s) => s.menuTab); const setTab = useStore((s) => s.setTab); const close = useStore((s) => s.closeOverlay);
  return (
    <div className="gm">
      <div className="gm-tabs">{TABS.map(([k, n, key]) => <button key={k} className={`gm-tab ${tab === k ? 'on' : ''}`} onClick={() => { audio.sfx('ui'); setTab(k); }}>{n} <span className="dim small">[{key}]</span></button>)}<button className="btn sm" style={{ marginLeft: 'auto' }} onClick={close}>Close [Esc]</button></div>
      <div className="gm-body">
        {tab === 'character' && <CharacterPanel />}{tab === 'skills' && <SkillsPanel />}{tab === 'inventory' && <InventoryPanel />}{tab === 'smith' && <SmithPanel />}{tab === 'journal' && <JournalPanel />}{tab === 'corps' && <CorpsPanel />}{tab === 'map' && <MapPanel />}
      </div>
    </div>
  );
}

export function Dialogue() {
  const d = useStore((s) => s.dialogue); const advance = useStore((s) => s.advance); const [n, setN] = useState(0);
  const line = d?.lines[d.i]; const text = line?.text ?? '';
  useEffect(() => { setN(0); if (!text) return; const id = setInterval(() => setN((v) => { if (v >= text.length) { clearInterval(id); return v; } return v + 1; }), 22); return () => clearInterval(id); }, [text, d?.i]);
  useEffect(() => {
    const kd = (e: KeyboardEvent) => { if (['Space', 'Enter', 'KeyG', 'KeyE'].includes(e.code)) { e.preventDefault(); if (n < text.length) setN(text.length); else advance(); } };
    window.addEventListener('keydown', kd); return () => window.removeEventListener('keydown', kd);
  }, [n, text, advance]);
  if (!d || !line) return null; const sp = speakerLook(line.who); const showTitle = d.title && d.i === 0;
  return (
    <>
      {showTitle && <div className="chapter-card" key={d.title}><div /><h1>{d.title}</h1><div /></div>}
      <div className="dlg" onClick={() => { if (n < text.length) setN(text.length); else advance(); }}>
        {sp ? <div className="dlg-port"><Portrait look={sp.look} color={sp.color} size={130} /></div> : <div style={{ width: 20 }} />}
        <div className="dlg-box"><div className="dlg-name">{line.who}</div><div className="dlg-text">{text.slice(0, n)}</div><div className="dlg-next">{n >= text.length ? '▼ Space / Click' : ''}</div></div>
      </div>
    </>
  );
}

export function PauseMenu() {
  const [view, setView] = useState<'main' | 'settings' | 'controls'>('main'); const close = useStore((s) => s.closeOverlay); const quest = useStore((s) => s.activeQuest); const save = useStore((s) => s.save); const cmd = useStore((s) => s.cmd); const openMenu = useStore((s) => s.openMenu); const exit = useStore((s) => s.exitToMenu);
  return (
    <div className="modal"><div className="box">
      <h1>{view === 'main' ? 'PAUSED' : view === 'settings' ? 'SETTINGS' : 'CONTROLS'}</h1>
      {view === 'main' && <div className="pause-list">
        <button className="btn gold" onClick={close}>Resume</button>
        <button className="btn" onClick={() => openMenu('character')}>Character & Inventory</button>
        <button className="btn" onClick={() => save(true)}>Save game</button>
        <button className="btn" onClick={() => setView('settings')}>Settings</button>
        <button className="btn" onClick={() => setView('controls')}>Controls</button>
        {quest && <button className="btn" onClick={() => { cmd({ type: 'abandon' }); close(); }}>{quest.kind === 'training' ? 'Leave training' : 'Abandon mission'}</button>}
        <button className="btn" onClick={exit}>Save & return to title</button>
      </div>}
      {view === 'settings' && <><SettingsPanel /><button className="btn" style={{ marginTop: '1rem' }} onClick={() => setView('main')}>Back</button></>}
      {view === 'controls' && <><ControlsList /><button className="btn" style={{ marginTop: '1rem' }} onClick={() => setView('main')}>Back</button></>}
    </div></div>
  );
}

export function DeathScreen() {
  const cmd = useStore((s) => s.cmd); const exit = useStore((s) => s.exitToMenu);
  return <div className="modal" style={{ background: 'rgba(40,0,8,.78)' }}><div className="box" style={{ textAlign: 'center' }}><h1 style={{ color: 'var(--red)', fontSize: '2.4rem' }}>SLAIN</h1><p className="dim">Your breathing falters... but the resolve of a Demon Slayer never breaks.</p><div className="pause-list"><button className="btn gold" onClick={() => cmd({ type: 'respawn' })}>Rise again</button><button className="btn" onClick={exit}>Return to title</button></div></div></div>;
}

export function ResultScreen() {
  const r = useStore((s) => s.result); const set = useStore((s) => s.setResult); const profile = useStore((s) => s.profile);
  useEffect(() => { if (r) { audio.sfx('complete'); } }, [r]);
  if (!r) return null; const next = profile.chapter < 12;
  return (
    <div className="modal"><div className="box" style={{ textAlign: 'center' }}>
      <div className="small gold" style={{ letterSpacing: '.4em' }}>{r.title.toUpperCase()}</div><h1 style={{ fontSize: '1.8rem' }}>{r.sub}</h1>
      <div style={{ margin: '.8rem 0', textAlign: 'left' }}>{r.lines.map((l, i) => <div key={i} className="stat"><span>{l}</span></div>)}</div>
      {r.title.startsWith('Chapter 12') && <p className="gold">The night is over. Thank you for playing — free roam and side missions remain available.</p>}
      <div className="pause-list"><button className="btn gold" onClick={() => set(null)}>Continue</button>{next && <button className="btn" onClick={() => { set(null); useStore.getState().openMenu('journal'); }}>Open Journal</button>}</div>
    </div></div>
  );
}
