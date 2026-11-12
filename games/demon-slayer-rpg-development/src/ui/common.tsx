import { useId } from 'react';
import { CHARACTERS, NPC_LOOKS } from '../game/data/characters';
import { BOSSES } from '../game/data/enemies';
import { STYLES } from '../game/data/styles';
import { audio } from '../game/audio';
import { useStore } from '../game/store';
import type { Look, Settings } from '../game/types';

const hx = (c: number) => '#' + c.toString(16).padStart(6, '0');

export function Portrait({ look, color = 0x4ab4ff, size = 120, name }: { look: Look; color?: number; size?: number; name?: string }) {
  const id = useId().replace(/:/g, '');
  const L = look; const skin = hx(L.skin); const hair = hx(L.hair); const tip = hx(L.tip ?? L.hair); const eye = hx(L.eye); const ex = (k: string) => L.extras.includes(k);
  const demon = !!L.demon; const bare = ex('bare'); const mask = ex('boarmask'); const tengu = ex('tengu'); const hy = ex('hyottoko');
  const outfit = hx(bare ? L.skin : L.outfit);
  const spikes = L.hairStyle === 'spiky' || L.hairStyle === 'flame' || L.hairStyle === 'wild';
  const tall = L.hairStyle === 'flame' ? 1.5 : 1;
  const pat = L.pattern && L.pattern !== 'none' && L.pattern !== 'plain' ? L.pattern : null; const hc = hx(L.haori ?? 0); const hc2 = hx(L.haori2 ?? 0x111111);
  const haoriFill = L.haori === undefined ? null : pat ? `url(#pt${id})` : hc;
  return (
    <svg viewBox="0 0 200 240" width={size} height={size * 1.2} style={{ display: 'block', background: `radial-gradient(circle at 50% 35%, ${hx(color)}55, #0a0c1a 75%)` }} aria-label={name}>
      <defs>
        {pat === 'checker' && <pattern id={`pt${id}`} width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill={hc} /><rect width="12" height="12" fill={hc2} /><rect x="12" y="12" width="12" height="12" fill={hc2} /></pattern>}
        {pat === 'triangle' && <pattern id={`pt${id}`} width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill={hc} /><path d="M0 0H22L11 20Z" fill={hc2} /></pattern>}
        {pat === 'half' && <linearGradient id={`pt${id}`} x1="0" x2="1"><stop offset="0.5" stopColor={hc} /><stop offset="0.5" stopColor={hc2} /></linearGradient>}
        {pat === 'flame' && <linearGradient id={`pt${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0.45" stopColor={hc} /><stop offset="0.45" stopColor={hc2} /></linearGradient>}
        {pat === 'butterfly' && <linearGradient id={`pt${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0.4" stopColor={hc} /><stop offset="1" stopColor={hc2} /></linearGradient>}
        <radialGradient id={`ir${id}`}><stop offset="0" stopColor="#fff" stopOpacity=".5" /><stop offset="0.5" stopColor={eye} /><stop offset="1" stopColor="#1a0a14" /></radialGradient>
      </defs>
      {/* back hair */}
      {L.hairStyle === 'long' && <path d="M40 104C30 180 36 232 58 240H142C164 232 170 180 160 104Z" fill={hair} />}
      {L.hairStyle === 'long' && L.tip && <path d="M38 200C36 220 44 236 58 240H142C156 236 164 220 162 200Z" fill={tip} />}
      {L.hairStyle === 'pony' && <path d="M140 60C190 40 200 110 176 170C170 120 160 100 140 90Z" fill={hair} />}
      {L.hairStyle === 'bob' && <path d="M44 100C36 150 44 170 60 172H140C156 170 164 150 156 100Z" fill={hair} />}
      {/* body */}
      <path d="M14 240C18 180 50 168 100 168S182 180 186 240Z" fill={outfit} />
      {!bare && !demon && <path d="M82 168L100 200L118 168Z" fill="#f4f4f4" />}
      {haoriFill && <><path d="M14 240C16 190 34 174 56 170L66 240Z" fill={haoriFill} /><path d="M186 240C184 190 166 174 144 170L134 240Z" fill={haoriFill} /></>}
      {ex('beads') && <path d="M66 172Q100 214 134 172" fill="none" stroke="#6a3a1a" strokeWidth="6" strokeDasharray="1 7" strokeLinecap="round" />}
      {ex('scars') && <path d="M70 200L100 226M130 196L108 224" stroke="#a04040" strokeWidth="3" />}
      <rect x="86" y="146" width="28" height="30" fill={skin} />
      {/* face */}
      <ellipse cx="52" cy="124" rx="7" ry="12" fill={skin} /><ellipse cx="148" cy="124" rx="7" ry="12" fill={skin} />
      <ellipse cx="100" cy="116" rx="47" ry="56" fill={skin} stroke="#00000033" strokeWidth="1.5" />
      <path d="M66 156Q100 186 134 156" fill="#00000010" />
      {/* hair front */}
      {L.hairStyle !== 'none' && !mask && <g fill={hair} stroke="#00000044" strokeWidth="1.5">
        <path d="M44 120C40 60 66 24 100 24S160 60 156 120L148 98L140 80L128 104L114 78L100 106L86 78L72 104L60 80L52 98Z" />
        {spikes && <><path d={`M58 56L${46 - tall * 6} ${14 - tall * 14}L84 36Z`} /><path d={`M100 34L${96 - tall * 4} ${-6 - tall * 14}L120 32Z`} /><path d={`M142 56L${156 + tall * 6} ${12 - tall * 14}L118 34Z`} />{L.hairStyle === 'wild' && <><path d="M44 100L14 76L48 70Z" /><path d="M156 100L186 76L152 70Z" /><path d="M46 70L22 44L58 54Z" /><path d="M154 70L178 44L142 54Z" /></>}</>}
        {L.hairStyle === 'flame' && <><path d={`M66 40L58 -14L90 30Z`} fill={tip} /><path d="M134 40L142 -14L110 30Z" fill={tip} /></>}
        {(L.hairStyle === 'long' || L.hairStyle === 'bob') && <><path d="M44 110C38 150 42 170 52 176L58 110Z" /><path d="M156 110C162 150 158 170 148 176L142 110Z" /></>}
      </g>}
      {/* eyes */}
      {!mask && !tengu && !hy && [78, 122].map((x, i) => (
        <g key={x}>
          <ellipse cx={x} cy="122" rx="14" ry="16" fill={demon ? eye : '#fff'} stroke="#1a0a14" strokeWidth="2" />
          <ellipse cx={x} cy="125" rx={demon ? 3 : 10} ry={demon ? 15 : 13} fill={demon ? '#1a0008' : `url(#ir${id})`} />
          {!demon && <ellipse cx={x} cy="126" rx="4" ry="6" fill="#120810" />}
          {!demon && <circle cx={x + (i ? -3 : 3)} cy="118" r="3.4" fill="#fff" />}
          <path d={`M${x - 17} ${i ? 104 : 106}L${x + 15} ${i ? 106 : 104}`} stroke={hair === '#f0f0f6' ? '#aaa' : hair} strokeWidth="4" strokeLinecap="round" />
        </g>
      ))}
      {!mask && !tengu && !hy && <path d="M92 158Q100 162 108 158" stroke="#7a2a2a" strokeWidth="2.5" fill="none" strokeLinecap="round" />}
      {ex('sixeyes') && [78, 122].map((x) => <ellipse key={x} cx={x} cy="95" rx="7" ry="4" fill="#ff2030" />)}
      {/* extras */}
      {ex('scar') && <path d="M114 70L130 96L124 98L110 74Z" fill="#b03030" />}
      {ex('earrings') && <><rect x="46" y="140" width="6" height="18" fill="#d04040" /><rect x="148" y="140" width="6" height="18" fill="#eef" /></>}
      {ex('headband') && <><path d="M54 84Q100 62 146 84L146 94Q100 74 54 94Z" fill="#f4f4f4" /><circle cx="100" cy="78" r="6" fill="#40d0ff" /></>}
      {ex('butterflyclip') && <path d="M138 52l14-8 4 14zM150 56l16 2-6 12z" fill="#d0a0ff" />}
      {ex('bandage') && <rect x="62" y="146" width="76" height="20" fill="#f2f2f2" opacity=".95" />}
      {ex('bamboo') && <rect x="82" y="152" width="36" height="12" rx="6" fill="#6aa84a" />}
      {ex('horns') && <><path d="M72 62L64 20L92 54Z" fill="#ece0c0" /><path d="M128 62L136 20L108 54Z" fill="#ece0c0" /></>}
      {ex('tattoo') && <path d="M62 140H78M122 140H138M60 150H76M124 150H140" stroke="#3a8aff" strokeWidth="3" />}
      {ex('old') && <path d="M80 160Q100 220 120 160Z" fill="#e8e8ee" />}
      {ex('hat') && <><rect x="66" y="12" width="68" height="46" fill="#14141a" /><rect x="46" y="54" width="108" height="8" fill="#14141a" /></>}
      {mask && <><circle cx="100" cy="112" r="64" fill="#6a7a96" stroke="#14141a" strokeWidth="3" /><path d="M40 90L18 40L74 64Z M160 90L182 40L126 64Z" fill="#58688a" /><ellipse cx="100" cy="146" rx="26" ry="22" fill="#58688a" /><ellipse cx="78" cy="106" rx="14" ry="9" fill="#ffe060" /><ellipse cx="122" cy="106" rx="14" ry="9" fill="#ffe060" /><circle cx="90" cy="150" r="3" fill="#222" /><circle cx="110" cy="150" r="3" fill="#222" /><path d="M60 40L100 10L140 40Z" fill="#14141a" /></>}
      {tengu && <><circle cx="100" cy="112" r="62" fill="#c8402a" stroke="#222" strokeWidth="3" /><path d="M92 120L100 190L108 120Z" fill="#c8402a" stroke="#222" strokeWidth="2" /><ellipse cx="76" cy="100" rx="12" ry="7" fill="#fff" /><ellipse cx="124" cy="100" rx="12" ry="7" fill="#fff" /></>}
      {hy && <><circle cx="100" cy="116" r="60" fill="#d8c8a0" stroke="#222" strokeWidth="3" /><circle cx="78" cy="108" r="6" fill="#222" /><circle cx="122" cy="108" r="6" fill="#222" /><ellipse cx="100" cy="148" rx="14" ry="8" fill="#222" /><path d="M90 40L100 0L110 40Z" fill="#c8a070" /></>}
    </svg>
  );
}

export function speakerLook(name: string): { look: Look; color: number } | null {
  const n = name.toLowerCase(); if (n === 'narrator') return null;
  for (const c of CHARACTERS) if (n.includes(c.name.split(' ')[0].toLowerCase()) || n.includes(c.name.split(' ')[1]?.toLowerCase() ?? '@@')) return { look: c.look, color: STYLES[c.style].color };
  const map: [string, string][] = [['urokodaki', 'urokodaki'], ['sakonji', 'urokodaki'], ['hanako', 'child'], ['tamayo', 'tamayo'], ['muzan', 'muzan'], ['stranger', 'muzan'], ['haganezuka', 'smith'], ['hotaru', 'smith'], ['merchant', 'merchant'], ['vendor', 'merchant'], ['nezuko', 'nezuko']];
  for (const [k, v] of map) if (n.includes(k)) return { look: NPC_LOOKS[v], color: 0xc0c0d0 };
  for (const b of Object.values(BOSSES)) if (n.includes(b.name.split(' ')[0].toLowerCase())) return { look: b.look, color: b.color };
  return { look: NPC_LOOKS.villager, color: 0xc0c0d0 };
}

export function Bar({ v, max, color, h = 10 }: { v: number; max: number; color: string; h?: number }) {
  return <div className="bar" style={{ height: h }}><i style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%`, background: color }} /></div>;
}

export const CONTROLS: [string, string][] = [['W A S D', 'Move'], ['Mouse / Arrows', 'Camera'], ['Left Click', 'Light attack combo'], ['Right Click', 'Heavy attack'], ['Space', 'Dodge (perfect dodge = slow-mo)'], ['Shift', 'Sprint (running attack)'],
  ['X', 'Jump (attack midair to plunge)'], ['C (hold)', 'Guard — tap just before impact to Parry'], ['Q', 'Total Concentration Breathing'], ['E', 'Special technique'], ['R', 'Ultimate (needs full gauge)'], ['1 – 4', 'Equipped breathing forms'],
  ['F', 'Target lock'], ['G', 'Interact / Talk / Travel'], ['H', 'Quick-heal'], ['Tab', 'Character'], ['K', 'Skills'], ['I', 'Inventory'], ['B', 'Swordsmith & Shop'], ['J', 'Journal'], ['M', 'World Map'], ['N', 'Corps Rank'], ['Esc', 'Pause']];

export function SettingsPanel() {
  const s = useStore((x) => x.profile.settings); const set = useStore((x) => x.setSettings);
  const presets: Record<Settings['gfx'], Partial<Settings>> = { low: { gfx: 'low', shadows: 'off', renderScale: 0.8 }, medium: { gfx: 'medium', shadows: 'low', renderScale: 1 }, high: { gfx: 'high', shadows: 'low', renderScale: 1 }, ultra: { gfx: 'ultra', shadows: 'high', renderScale: 1 } };
  const apply = (p: Partial<Settings>) => { set(p); const n = { ...s, ...p }; audio.setVolumes(n); };
  const Rng = ({ label, k, min, max, step, fmt }: { label: string; k: keyof Settings; min: number; max: number; step: number; fmt?: (v: number) => string }) => (
    <div className="range"><span>{label}</span><input type="range" min={min} max={max} step={step} value={s[k] as number} onChange={(e) => apply({ [k]: parseFloat(e.target.value) } as Partial<Settings>)} aria-label={label} /><span className="dim">{fmt ? fmt(s[k] as number) : Math.round((s[k] as number) * 100) + '%'}</span></div>
  );
  return (
    <div>
      <div className="small gold" style={{ letterSpacing: '.15em' }}>GRAPHICS</div>
      <div className="seg" style={{ margin: '.4rem 0' }}>{(['low', 'medium', 'high', 'ultra'] as const).map((g) => <button key={g} className={`btn sm ${s.gfx === g ? 'on' : ''}`} onClick={() => apply(presets[g])}>{g}</button>)}</div>
      <div className="range"><span>Shadows</span><div className="seg">{(['off', 'low', 'high'] as const).map((g) => <button key={g} className={`btn sm ${s.shadows === g ? 'on' : ''}`} onClick={() => apply({ shadows: g })}>{g}</button>)}</div><span /></div>
      <Rng label="Render resolution" k="renderScale" min={0.5} max={1.5} step={0.05} />
      <Rng label="Field of view" k="fov" min={50} max={90} step={1} fmt={(v) => `${v}°`} />
      <Rng label="Camera shake" k="shake" min={0} max={1.5} step={0.1} />
      <div className="small gold" style={{ letterSpacing: '.15em', marginTop: '.8rem' }}>AUDIO</div>
      <Rng label="Music" k="music" min={0} max={1} step={0.05} /><Rng label="Sound effects" k="sfx" min={0} max={1} step={0.05} /><Rng label="Ambience" k="ambience" min={0} max={1} step={0.05} />
      <div className="small gold" style={{ letterSpacing: '.15em', marginTop: '.8rem' }}>CONTROLS</div>
      <Rng label="Mouse sensitivity" k="sens" min={0.3} max={2.5} step={0.1} fmt={(v) => v.toFixed(1)} />
      <div className="seg" style={{ marginTop: '.4rem' }}><button className={`btn sm ${s.invertY ? 'on' : ''}`} onClick={() => apply({ invertY: !s.invertY })}>Invert Y: {s.invertY ? 'On' : 'Off'}</button><button className={`btn sm ${s.showFps ? 'on' : ''}`} onClick={() => apply({ showFps: !s.showFps })}>FPS counter: {s.showFps ? 'On' : 'Off'}</button></div>
      <p className="small dim">Changing the graphics preset reloads the current area with the new density settings.</p>
    </div>
  );
}

export function ControlsList() {
  return <div className="keys">{CONTROLS.map(([k, v]) => <><b key={k}>{k}</b><span key={v}>{v}</span></>)}</div>;
}
