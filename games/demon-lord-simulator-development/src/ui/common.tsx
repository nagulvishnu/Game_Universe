import type { ReactNode } from 'react';
import type { ItemDef, Res, ResKey, Stats } from '../game/data';
import { REGIONS, TERRITORIES } from '../game/data';
import { regionAt, terrainHeight } from '../game/terrain';

export const RES_ICON: Record<ResKey, { icon: string; color: string; name: string }> = {
  gold: { icon: '⛁', color: '#ffd24a', name: 'Gold' }, crystals: { icon: '◆', color: '#c04bff', name: 'Demon Crystals' }, mana: { icon: '✦', color: '#4aa8ff', name: 'Mana' }, food: { icon: '❦', color: '#8aff6a', name: 'Food' }, supplies: { icon: '⚔', color: '#ff9a5a', name: 'Supplies' },
};
export const fmt = (n: number) => (Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : Math.abs(n) >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : Math.floor(n).toLocaleString());
export function CostChips({ cost, have }: { cost: Partial<Res>; have?: Res }) {
  return <span className="inline-flex flex-wrap gap-x-2 text-[11px]">{(Object.keys(cost) as ResKey[]).filter((k) => (cost[k] ?? 0) > 0).map((k) => <span key={k} style={{ color: have && have[k] < (cost[k] ?? 0) ? '#ff6a6a' : RES_ICON[k].color }}>{RES_ICON[k].icon}{fmt(cost[k]!)}</span>)}</span>;
}
export function Bar({ v, max, color, h = 12 }: { v: number; max: number; color: string; h?: number }) {
  return <div className="bar" style={{ height: h }}><i style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)`, boxShadow: `0 0 10px ${color}` }} /></div>;
}
export function Panel({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) { return <div className={`panel ${className}`} style={style}>{children}</div>; }
export function Title({ children, sub }: { children: ReactNode; sub?: string }) { return <div className="mb-2"><div className="gold-text text-xl tracking-[.18em] uppercase font-bold">{children}</div>{sub && <div className="text-[11px] text-stone-400 tracking-wider">{sub}</div>}</div>; }
export const STAT_LABEL: Record<keyof Stats, string> = { atk: 'Attack', def: 'Defense', hp: 'Max HP', mana: 'Max Mana', crit: 'Crit %', speed: 'Speed %', regen: 'Mana Regen' };
export const RAR_COLOR = { epic: '#a56bff', legendary: '#ff9a2a', mythic: '#ff4fd0' };

export function Portrait({ id, color, glow, size = 96 }: { id: string; color: string; glow: string; size?: number }) {
  const dark = '#120a14';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ filter: `drop-shadow(0 0 8px ${color}88)` }}>
      <defs><radialGradient id={'bg' + id} cx="50%" cy="40%" r="70%"><stop offset="0" stopColor={color} stopOpacity=".5" /><stop offset="1" stopColor="#0a0610" /></radialGradient></defs>
      <rect width="100" height="100" fill={`url(#bg${id})`} />
      {id === 'infernos' && [0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${34 + i * 8} 40 Q${30 + i * 9} ${14 - (i % 2) * 8} ${40 + i * 6} 6 Q${44 + i * 6} 24 ${42 + i * 8} 40`} fill={i % 2 ? '#ffd04a' : '#ff6a1a'} />)}
      {(id === 'behemoth' || id === 'infernos' || id === 'drakmor') && <><path d="M26 40 Q4 38 8 12 Q22 26 34 30Z" fill="#e8d8b0" /><path d="M74 40 Q96 38 92 12 Q78 26 66 30Z" fill="#e8d8b0" /></>}
      {id === 'nyxara' && <><path d="M30 36 Q6 30 12 2 Q24 22 36 28Z" fill={color} /><path d="M70 36 Q94 30 88 2 Q76 22 64 28Z" fill={color} /><path d="M28 40 Q16 70 24 96 L36 70Z" fill="#3a0a3a" /><path d="M72 40 Q84 70 76 96 L64 70Z" fill="#3a0a3a" /></>}
      {id === 'glacius' && [0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${30 + i * 10} 34 L${34 + i * 10} ${8 + (i % 2) * 8} L${38 + i * 10} 34Z`} fill="#e8fbff" />)}
      {id === 'umbra' && <path d="M22 96 L26 40 Q50 4 74 40 L78 96 Z" fill="#1a0a2a" />}
      {id === 'drakmor' && <><path d="M20 70 L0 40 L16 44 L10 20 L30 50Z" fill="#c8901a" /><path d="M80 70 L100 40 L84 44 L90 20 L70 50Z" fill="#c8901a" /></>}
      <path d="M12 100 Q16 70 50 66 Q84 70 88 100Z" fill={dark} stroke={color} strokeWidth="1.5" /><path d="M20 100 Q24 76 50 72 Q76 76 80 100" fill="none" stroke={glow} strokeOpacity=".5" />
      <rect x="44" y="56" width="12" height="14" fill={id === 'mortis' ? '#d8d0b8' : '#7a5a60'} />
      <ellipse cx="50" cy="42" rx="19" ry="22" fill={id === 'mortis' ? '#e8e0c8' : id === 'glacius' ? '#9ad4f0' : id === 'umbra' ? '#2a1a3a' : id === 'infernos' ? '#c84a1a' : id === 'nyxara' ? '#c07ab0' : '#b88a6a'} />
      {id === 'umbra' && <path d="M26 48 Q50 10 74 48 Q50 30 26 48Z" fill="#150a24" />}
      <path d="M33 38 L45 41 L33 44Z" fill={glow} /><path d="M67 38 L55 41 L67 44Z" fill={glow} />
      {id === 'mortis' ? <><rect x="40" y="56" width="20" height="4" fill="#222" /><path d="M46 52 L50 48 L54 52Z" fill="#333" /></> : <path d="M42 56 Q50 60 58 56" stroke="#2a0a10" strokeWidth="1.8" fill="none" />}
    </svg>
  );
}

const darker = (c: string) => c + '55';
export function ItemArt({ item, size = 64 }: { item: ItemDef; size?: number }) {
  const c = item.color, c2 = item.color2 === '#300' || item.color2.length < 7 ? '#2a1a2a' : item.color2; const w = item.wtype;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ filter: `drop-shadow(0 0 6px ${c}aa)` }}>
      <defs><radialGradient id={'ia' + item.id} cx="50%" cy="50%" r="60%"><stop offset="0" stopColor={c} stopOpacity=".35" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient></defs>
      <circle cx="32" cy="32" r="30" fill={`url(#ia${item.id})`} />
      {item.slot === 'weapon' && w === 'sword' && <g transform="rotate(45 32 32)"><rect x="29" y="4" width="6" height="38" fill={c2} stroke={c} strokeWidth="1" /><rect x="31" y="6" width="2" height="34" fill={c} /><rect x="22" y="42" width="20" height="4" fill="#c8a040" /><rect x="30" y="46" width="4" height="10" fill="#222" /><circle cx="32" cy="58" r="2.5" fill={c} /></g>}
      {item.slot === 'weapon' && w === 'greatsword' && <g transform="rotate(45 32 32)"><path d="M24 4 L40 4 L38 40 L26 40Z" fill={c2} stroke={c} strokeWidth="1.2" /><rect x="30" y="5" width="4" height="34" fill={c} /><rect x="17" y="40" width="30" height="5" fill="#c8a040" /><rect x="29" y="45" width="6" height="12" fill="#222" /></g>}
      {item.slot === 'weapon' && w === 'spear' && <g transform="rotate(45 32 32)"><rect x="31" y="14" width="2.5" height="48" fill="#4a2a1a" /><path d="M32 0 L38 16 L32 20 L26 16Z" fill={c2} stroke={c} /><rect x="31" y="2" width="2" height="14" fill={c} /><rect x="24" y="19" width="16" height="2" fill="#c8a040" /></g>}
      {item.slot === 'weapon' && w === 'dual' && <><g transform="rotate(35 32 32)"><rect x="30" y="6" width="4" height="30" fill={c2} stroke={c} /><rect x="25" y="36" width="14" height="3" fill="#c8a040" /><rect x="30.5" y="39" width="3" height="9" fill="#222" /></g><g transform="rotate(-35 32 32)"><rect x="30" y="6" width="4" height="30" fill={c2} stroke={c} /><rect x="25" y="36" width="14" height="3" fill="#c8a040" /><rect x="30.5" y="39" width="3" height="9" fill="#222" /></g></>}
      {item.slot === 'weapon' && w === 'staff' && <g transform="rotate(30 32 32)"><rect x="30.5" y="14" width="3" height="48" fill="#2a1a3a" stroke="#c8a040" strokeWidth=".6" /><circle cx="32" cy="10" r="7" fill={c} /><circle cx="32" cy="10" r="11" fill="none" stroke="#c8a040" strokeWidth="1.5" /><circle cx="30" cy="8" r="2" fill="#fff" fillOpacity=".8" /></g>}
      {item.slot === 'armor' && <><path d="M12 18 L24 12 L32 16 L40 12 L52 18 L48 34 L42 56 L22 56 L16 34Z" fill={c2} stroke={c} strokeWidth="1.5" /><path d="M32 16 L32 56" stroke={c} strokeWidth="1" /><path d="M20 30 L44 30" stroke={c} strokeWidth="1" /><circle cx="32" cy="28" r="3.5" fill={c} /><path d="M12 18 L6 24 L14 26Z M52 18 L58 24 L50 26Z" fill={c} /></>}
      {item.slot === 'ring' && <><circle cx="32" cy="38" r="15" fill="none" stroke="#c8a040" strokeWidth="6" /><circle cx="32" cy="38" r="15" fill="none" stroke="#fff3c0" strokeWidth="1" strokeOpacity=".6" /><path d="M32 12 L40 20 L32 28 L24 20Z" fill={c} stroke="#fff" strokeOpacity=".6" /></>}
      {item.slot === 'artifact' && <><path d="M32 6 L52 24 L32 58 L12 24Z" fill={c2} stroke={c} strokeWidth="1.5" /><path d="M32 6 L32 58 M12 24 L52 24" stroke={c} strokeOpacity=".7" /><circle cx="32" cy="28" r="7" fill={c} /><circle cx="29" cy="25" r="2" fill="#fff" fillOpacity=".8" /></>}
      {item.slot === 'dragon' && <><path d="M10 50 Q14 20 32 8 Q50 20 54 50 Q40 40 32 44 Q24 40 10 50Z" fill={c2} stroke={c} strokeWidth="1.5" />{[0, 1, 2, 3].map((i) => <path key={i} d={`M${18 + i * 9} ${36 - (i % 2) * 6} l5 7 l-5 7 l-5 -7Z`} fill={c} fillOpacity=".8" />)}<path d="M32 8 L28 2 M32 8 L36 2" stroke={c} strokeWidth="2" /></>}
      <circle cx="32" cy="32" r="31" fill="none" stroke={darker(c)} strokeWidth="1" />
    </svg>
  );
}

let mapCv: HTMLCanvasElement | null = null;
export const MAP_SIZE = 512; export const WORLD_SPAN = 1500;
const regCol: Record<string, [number, number, number]> = { capital: [60, 40, 70], bloodfire: [110, 50, 30], human: [80, 140, 60], shadow: [40, 40, 70], ruins: [170, 140, 90], ocean: [50, 90, 110], dragon: [110, 105, 98], frozen: [200, 225, 245], celestial: [240, 230, 190] };
export function worldMapCanvas() {
  if (mapCv) return mapCv; const cv = document.createElement('canvas'); cv.width = cv.height = MAP_SIZE; const c = cv.getContext('2d')!; const id = c.createImageData(MAP_SIZE, MAP_SIZE);
  for (let j = 0; j < MAP_SIZE; j++) for (let i = 0; i < MAP_SIZE; i++) {
    const x = (i / MAP_SIZE - 0.5) * WORLD_SPAN, z = (j / MAP_SIZE - 0.5) * WORLD_SPAN; const h = terrainHeight(x, z); const reg = regionAt(x, z); let [r, g, b] = regCol[reg]; const k = 0.7 + Math.max(-0.2, Math.min(0.45, h / 160));
    if (reg === 'ocean' && h < 0) { r = 20; g = 70 + h * 0.5; b = 110 + h * 0.8; } else if (reg === 'bloodfire' && h < -1) { r = 255; g = 90; b = 20; } else { r *= k; g *= k; b *= k; }
    if (Math.hypot(x, z) > 700) { r = g = b = 8; }
    const o = (j * MAP_SIZE + i) * 4; id.data[o] = r; id.data[o + 1] = g; id.data[o + 2] = b; id.data[o + 3] = 255;
  }
  c.putImageData(id, 0, 0); mapCv = cv; return cv;
}
export const w2m = (x: number, z: number, size = MAP_SIZE): [number, number] => [(x / WORLD_SPAN + 0.5) * size, (z / WORLD_SPAN + 0.5) * size];
export { REGIONS, TERRITORIES };
