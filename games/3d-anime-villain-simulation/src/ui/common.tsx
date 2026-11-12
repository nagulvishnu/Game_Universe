import type { ReactNode } from 'react';
import { RCOL, OUTFITS, CAT_COL, type Item, type Skill, type Rarity } from '../game/data';

export const Btn = ({ children, onClick, primary, disabled, big, className = '', title }: { children: ReactNode; onClick?: () => void; primary?: boolean; disabled?: boolean; big?: boolean; className?: string; title?: string }) => (
  <button title={title} className={`btn ${primary ? 'primary' : ''} ${big ? 'big' : ''} ${className}`} disabled={disabled} onClick={onClick}>{children}</button>
);
export const Chip = ({ on, children, onClick }: { on?: boolean; children: ReactNode; onClick?: () => void }) => <span className={`chip ${on ? 'on' : ''}`} onClick={onClick}>{children}</span>;
export const Bar = ({ v, max = 1, color, h = 8, label }: { v: number; max?: number; color: string; h?: number; label?: string }) => (
  <div className="relative w-full overflow-hidden rounded-sm bg-black/60 border border-white/10" style={{ height: h }}>
    <div className="h-full transition-all" style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)`, boxShadow: `0 0 10px ${color}` }} />
    {label && <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tracking-wider text-white/90">{label}</span>}
  </div>
);
export const Rb = ({ r }: { r: Rarity }) => <span className="text-[9px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ color: '#000', background: RCOL[r] }}>{r}</span>;
export const money = (n: number) => '$' + Math.round(n).toLocaleString();

const ST = '#dfe6f2', GOLD = '#d4af37', DK = '#1c1a24';
export function ItemArt({ item, size = 96, anim = false }: { item: Item; size?: number; anim?: boolean }) {
  const c = item.color; const rc = RCOL[item.rarity]; const id = 'g' + item.id;
  const o = item.outfit ? OUTFITS[item.outfit] : null;
  let g: ReactNode = null;
  switch (item.icon) {
    case 'dagger': g = <g transform="rotate(40 50 50)"><polygon points="50,14 57,52 50,58 43,52" fill={ST} /><polygon points="50,14 53,52 50,58" fill={c} opacity=".7" /><rect x="38" y="56" width="24" height="5" fill={GOLD} /><rect x="46" y="61" width="8" height="18" fill={DK} /><circle cx="50" cy="82" r="4" fill={GOLD} /></g>; break;
    case 'sword': g = <g transform="rotate(40 50 50)"><polygon points="50,4 55,62 50,66 45,62" fill={ST} /><polygon points="50,4 53,62 50,66" fill={c} opacity=".75" /><rect x="39" y="64" width="22" height="4" rx="2" fill={GOLD} /><rect x="47" y="68" width="6" height="18" fill={DK} /><circle cx="50" cy="89" r="3.5" fill={GOLD} /></g>; break;
    case 'dual': g = <g><g transform="rotate(38 50 50) translate(-8 0)"><polygon points="50,12 56,56 50,60 44,56" fill={ST} /><polygon points="50,12 53,56 50,60" fill={c} opacity=".8" /><rect x="40" y="58" width="20" height="4" fill={GOLD} /><rect x="47" y="62" width="6" height="14" fill={DK} /></g><g transform="rotate(-38 50 50) translate(8 0)"><polygon points="50,12 56,56 50,60 44,56" fill={ST} /><polygon points="50,12 53,56 50,60" fill={c} opacity=".8" /><rect x="40" y="58" width="20" height="4" fill={GOLD} /><rect x="47" y="62" width="6" height="14" fill={DK} /></g></g>; break;
    case 'greatsword': g = <g transform="rotate(40 50 50)"><polygon points="50,0 65,56 50,64 35,56" fill={ST} /><polygon points="50,0 58,56 50,64" fill="#9aa5ba" /><rect x="48" y="8" width="4" height="48" fill={c} /><rect x="30" y="62" width="40" height="6" rx="2" fill={GOLD} /><rect x="46" y="68" width="8" height="20" fill={DK} /></g>; break;
    case 'spear': g = <g transform="rotate(38 50 50)"><rect x="48.5" y="16" width="3" height="80" fill="#3a2a22" /><polygon points="50,-6 58,20 50,16 42,20" fill={c} /><polygon points="50,-6 53,18 50,16" fill="#fff" opacity=".5" /><circle cx="50" cy="26" r="3.5" fill="#d4143a" /></g>; break;
    case 'scythe': g = <g transform="rotate(30 50 50)"><rect x="48.5" y="10" width="3" height="88" fill="#2a2030" /><path d="M50 10 C95 2 96 48 62 60 C82 40 76 24 50 22Z" fill={c} /><path d="M50 10 C85 6 88 38 66 52" fill="none" stroke="#fff" strokeWidth="1.5" opacity=".6" /></g>; break;
    case 'energy': g = <g transform="rotate(-8 50 50)"><rect x="18" y="38" width="46" height="18" rx="4" fill="#2a2f3a" /><rect x="60" y="42" width="30" height="8" rx="3" fill={ST} /><circle cx="40" cy="47" r="6" fill={c} /><rect x="30" y="54" width="14" height="26" rx="3" fill="#1c1f27" /><rect x="86" y="43" width="8" height="6" fill={c} /><rect x="22" y="40" width="30" height="3" fill={c} opacity=".8" /></g>; break;
    case 'special': g = <g><circle cx="50" cy="50" r="22" fill={c} opacity=".9" /><circle cx="50" cy="50" r="30" fill="none" stroke={c} strokeWidth="2" strokeDasharray="4 4" /><circle cx="50" cy="50" r="12" fill="#fff" opacity=".8" /><circle cx="80" cy="50" r="5" fill={c} /><circle cx="26" cy="30" r="4" fill={c} /><circle cx="30" cy="76" r="4" fill={c} /></g>; break;
    case 'jacket': g = <g><path d="M30 20 L42 14 L50 24 L58 14 L70 20 L84 58 L72 62 L68 46 L68 88 L32 88 L32 46 L28 62 L16 58Z" fill={c} stroke="#000" strokeOpacity=".5" /><path d="M50 24 L50 88" stroke="#000" strokeOpacity=".5" /><path d="M42 14 L50 30 L58 14" fill="#000" opacity=".35" /></g>; break;
    case 'armor': g = <g><circle cx="24" cy="30" r="13" fill={c} stroke="#000" strokeOpacity=".5" /><circle cx="76" cy="30" r="13" fill={c} stroke="#000" strokeOpacity=".5" /><path d="M28 22 L72 22 L68 70 L50 90 L32 70Z" fill={c} stroke="#000" strokeOpacity=".5" /><path d="M50 26 L50 84" stroke="#000" strokeOpacity=".4" /><circle cx="50" cy="42" r="6" fill="#fff" opacity=".85" /></g>; break;
    case 'cape': g = <g><path d="M36 12 Q50 20 64 12 L88 90 Q50 76 12 90Z" fill={c} stroke="#000" strokeOpacity=".5" /><path d="M50 18 Q52 50 50 80" stroke="#fff" strokeOpacity=".2" fill="none" /><circle cx="50" cy="16" r="5" fill={GOLD} /></g>; break;
    case 'outfit': g = <g><path d="M30 14 L42 10 Q50 18 58 10 L70 14 L82 44 L70 48 L68 38 L68 58 L32 58 L32 38 L30 48 L18 44Z" fill={o?.top ?? c} stroke="#000" strokeOpacity=".5" /><rect x="32" y="54" width="36" height="5" fill={o?.belt ?? '#333'} /><path d="M32 58 L68 58 L64 92 L53 92 L50 66 L47 92 L36 92Z" fill={o?.bottom ?? '#222'} stroke="#000" strokeOpacity=".5" /><path d="M42 10 Q50 18 58 10" fill="none" stroke={o?.trim ?? c} strokeWidth="3" /><rect x="34" y="24" width="3" height="28" fill={o?.trim ?? c} /></g>; break;
    case 'mask': g = <g><ellipse cx="50" cy="46" rx="26" ry="30" fill={c} /><ellipse cx="39" cy="42" rx="7" ry="9" fill="#111" /><ellipse cx="61" cy="42" rx="7" ry="9" fill="#111" /><path d="M48 54 L50 62 L52 54Z" fill="#111" /><rect x="34" y="68" width="32" height="10" fill="#111" /><path d="M40 68 V78 M46 68 V78 M54 68 V78 M60 68 V78" stroke={c} strokeWidth="2" /></g>; break;
    case 'goggles': g = <g><path d="M8 50 Q50 36 92 50" stroke="#333" strokeWidth="6" fill="none" /><circle cx="34" cy="50" r="17" fill="#222" /><circle cx="66" cy="50" r="17" fill="#222" /><circle cx="34" cy="50" r="12" fill={c} /><circle cx="66" cy="50" r="12" fill={c} /><circle cx="30" cy="46" r="4" fill="#fff" opacity=".7" /><circle cx="62" cy="46" r="4" fill="#fff" opacity=".7" /></g>; break;
    case 'scarf': g = <g><path d="M12 36 Q50 60 88 36 L88 54 Q50 78 12 54Z" fill={c} /><path d="M64 60 L74 92 L58 88 L56 64Z" fill={c} stroke="#000" strokeOpacity=".3" /><path d="M22 44 Q50 62 78 44" stroke="#fff" strokeOpacity=".25" fill="none" /></g>; break;
    case 'headband': g = <g><ellipse cx="50" cy="52" rx="38" ry="16" fill="none" stroke={c} strokeWidth="9" /><rect x="36" y="58" width="28" height="14" rx="3" fill="#c8ced8" stroke="#000" strokeOpacity=".4" /><path d="M42 66 H58" stroke="#333" strokeWidth="2" /></g>; break;
    case 'earring': g = <g><circle cx="50" cy="34" r="20" fill="none" stroke="#d4af37" strokeWidth="4" /><polygon points="50,54 60,66 50,82 40,66" fill={c} /><polygon points="50,54 55,66 50,82" fill="#fff" opacity=".35" /></g>; break;
    case 'halo': g = <g><ellipse cx="50" cy="50" rx="36" ry="13" fill="none" stroke={c} strokeWidth="7" /><ellipse cx="50" cy="50" rx="36" ry="13" fill="none" stroke="#fff" strokeWidth="2" opacity=".7" /></g>; break;
    case 'potion': g = <g><rect x="42" y="8" width="16" height="16" fill="#8a6a4a" /><path d="M42 24 L24 66 Q22 90 50 90 Q78 90 76 66 L58 24Z" fill="#cfe8ff" opacity=".35" stroke="#fff" strokeOpacity=".6" /><path d="M30 60 Q50 52 70 60 Q74 88 50 88 Q26 88 30 60Z" fill={c} /></g>; break;
    case 'cell': g = <g><rect x="28" y="22" width="44" height="64" rx="6" fill="#1d2230" stroke={c} strokeWidth="3" /><rect x="40" y="14" width="20" height="8" fill={c} /><path d="M54 32 L40 58 H50 L46 80 L62 50 H52Z" fill={c} /></g>; break;
    case 'scrap': g = <g><circle cx="50" cy="50" r="26" fill="#6b7280" stroke="#9ca3af" strokeWidth="4" strokeDasharray="8 5" /><circle cx="50" cy="50" r="10" fill="#1f2937" /><rect x="64" y="64" width="26" height="8" fill="#9ca3af" transform="rotate(30 64 64)" /></g>; break;
    case 'chip': g = <g><rect x="26" y="26" width="48" height="48" fill="#0b4a2a" stroke={c} strokeWidth="3" />{[0, 1, 2, 3, 4].map((i) => <g key={i}><rect x={30 + i * 9} y="14" width="4" height="12" fill={ST} /><rect x={30 + i * 9} y="74" width="4" height="12" fill={ST} /></g>)}<rect x="38" y="38" width="24" height="24" fill="#111" /><path d="M32 32 H40 V44 M68 68 H60" stroke={c} fill="none" strokeWidth="2" /></g>; break;
    case 'crystal': g = <g><polygon points="50,6 78,34 66,92 34,92 22,34" fill={c} opacity=".9" /><polygon points="50,6 78,34 50,44" fill="#fff" opacity=".4" /><polygon points="50,44 78,34 66,92" fill="#000" opacity=".25" /><polygon points="22,34 50,44 34,92" fill="#fff" opacity=".15" /></g>; break;
    case 'data': g = <g><rect x="16" y="24" width="68" height="52" rx="5" fill="#122" stroke={c} strokeWidth="3" />{[0, 1, 2, 3].map((i) => <rect key={i} x="24" y={32 + i * 10} width={40 - i * 6} height="4" fill={c} opacity={0.9 - i * 0.15} />)}<circle cx="72" cy="64" r="5" fill={c} /></g>; break;
    case 'watch': g = <g><rect x="38" y="4" width="24" height="26" fill="#3a2a1a" /><rect x="38" y="70" width="24" height="26" fill="#3a2a1a" /><circle cx="50" cy="50" r="24" fill={c} stroke="#7a5a10" strokeWidth="4" /><circle cx="50" cy="50" r="18" fill="#fff8d6" /><path d="M50 50 V36 M50 50 L60 56" stroke="#222" strokeWidth="3" strokeLinecap="round" /></g>; break;
    case 'ring': g = <g><circle cx="50" cy="60" r="24" fill="none" stroke="#d4af37" strokeWidth="8" /><polygon points="50,12 62,24 50,40 38,24" fill={c} /><polygon points="50,12 56,24 50,40" fill="#fff" opacity=".5" /></g>; break;
    case 'painting': g = <g><rect x="12" y="18" width="76" height="64" fill="#5a3a1a" stroke={GOLD} strokeWidth="5" /><rect x="20" y="26" width="60" height="48" fill="#6aa0d8" /><path d="M20 74 L40 50 L54 64 L66 46 L80 74Z" fill="#4a6a3a" /><circle cx="68" cy="38" r="6" fill="#ffd54a" /></g>; break;
    case 'vase': g = <g><path d="M38 8 H62 L58 24 Q80 40 74 70 Q70 92 50 92 Q30 92 26 70 Q20 40 42 24Z" fill={c} stroke="#fff" strokeOpacity=".6" strokeWidth="2" /><path d="M32 52 Q50 60 68 52 M30 66 Q50 74 70 66" stroke="#fff" fill="none" strokeWidth="2" opacity=".8" /></g>; break;
    case 'box': g = <g><rect x="18" y="40" width="64" height="40" rx="4" fill={c} /><path d="M18 40 L28 22 H72 L82 40Z" fill={c} opacity=".75" /><polygon points="50,46 58,56 50,68 42,56" fill="#fff" opacity=".85" /></g>; break;
    case 'laptop': g = <g><path d="M24 24 H76 V62 H24Z" fill="#1a1d26" stroke="#9ca3af" strokeWidth="3" /><rect x="29" y="29" width="42" height="28" fill="#0e3b5a" /><path d="M10 66 H90 L82 80 H18Z" fill="#6b7280" /><path d="M34 38 H56 M34 46 H48" stroke="#4df0ff" strokeWidth="2" /></g>; break;
    case 'core': g = <g><circle cx="50" cy="50" r="22" fill={c} /><circle cx="50" cy="50" r="12" fill="#fff" opacity=".9" /><circle cx="50" cy="50" r="34" fill="none" stroke={c} strokeWidth="3" strokeDasharray="6 6" /><circle cx="50" cy="50" r="42" fill="none" stroke={c} strokeWidth="1.5" opacity=".6" /></g>; break;
    case 'artifact': g = <g><path d="M8 50 Q50 12 92 50 Q50 88 8 50Z" fill="#14101e" stroke={c} strokeWidth="4" /><circle cx="50" cy="50" r="17" fill={c} /><ellipse cx="50" cy="50" rx="5" ry="14" fill="#000" /><circle cx="44" cy="44" r="4" fill="#fff" opacity=".8" /><circle cx="50" cy="50" r="40" fill="none" stroke={c} strokeWidth="1.5" strokeDasharray="3 5" /></g>; break;
    case 'sigil': g = <g><circle cx="50" cy="50" r="38" fill="none" stroke={c} strokeWidth="3" /><circle cx="50" cy="50" r="28" fill="none" stroke={c} strokeWidth="1.5" /><polygon points="50,14 61,42 90,42 66,58 76,86 50,68 24,86 34,58 10,42 39,42" fill={c} opacity=".85" /><circle cx="50" cy="50" r="6" fill="#fff" /></g>; break;
    default: g = <circle cx="50" cy="50" r="24" fill={c} />;
  }
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ overflow: 'visible' }}>
      <defs><radialGradient id={id} cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor={rc} stopOpacity=".5" /><stop offset="100%" stopColor={rc} stopOpacity="0" /></radialGradient></defs>
      <circle cx="50" cy="50" r="48" fill={`url(#${id})`} style={anim ? { animation: 'flicker 2s infinite' } : undefined} />
      {anim && <circle cx="50" cy="50" r="46" fill="none" stroke={rc} strokeWidth="1" strokeDasharray="3 7" style={{ transformOrigin: '50px 50px', animation: 'spin 14s linear infinite' }} />}
      <g style={{ filter: `drop-shadow(0 0 4px ${c}88)` }}>{g}</g>
    </svg>
  );
}

export function ItemCard({ item, qty, equipped, sel, onClick, lvl }: { item: Item; qty?: number; equipped?: boolean; sel?: boolean; onClick?: () => void; lvl?: number }) {
  const rc = RCOL[item.rarity]; const hi = item.rarity === 'Legendary' || item.rarity === 'Mythic' || item.rarity === 'Divine';
  return (
    <button type="button" onClick={onClick} disabled={!onClick} aria-pressed={onClick ? !!sel : undefined} aria-label={`${item.name}${equipped ? ', equipped' : ''}${qty ? `, quantity ${qty}` : ''}`} className={`card text-left ${sel ? 'sel' : ''} ${hi ? 'glow' : ''} ${item.rarity === 'Mythic' ? 'mythic' : ''} ${item.rarity === 'Divine' ? 'divine' : ''} p-2 pop ${onClick ? 'cursor-pointer' : 'cursor-default'}`} style={{ ['--rc' as any]: rc }}>
      <div className="shine" />
      <div className="flex justify-center py-1"><ItemArt item={item} size={74} /></div>
      <div className="text-[11px] font-bold leading-tight truncate text-center" style={{ color: rc }}>{item.name}{lvl ? ` +${lvl}` : ''}</div>
      <div className="text-[9px] text-center text-white/50 uppercase tracking-wider">{item.cat}</div>
      {qty && qty > 1 ? <div className="absolute top-1 right-1 text-[10px] font-black bg-black/70 px-1.5 rounded border border-white/20">×{qty}</div> : null}
      {equipped && <div className="absolute top-1 left-1 text-[8px] font-black bg-emerald-500 text-black px-1 rounded">EQUIPPED</div>}
    </button>
  );
}

export function SkillGlyph({ s, size = 64 }: { s: Skill; size?: number }) {
  const a = s.c1, b = s.c2; const id = 'sg' + s.id;
  let g: ReactNode;
  switch (s.fx) {
    case 'bolt': g = <g><path d="M8 50 Q40 40 62 50 Q40 60 8 50Z" fill={a} opacity=".35" /><circle cx="68" cy="50" r="15" fill={b === '#000' ? a : b} stroke={a} strokeWidth="4" /><circle cx="68" cy="50" r="7" fill="#fff" opacity=".85" /></g>; break;
    case 'beam': g = <g><rect x="6" y="42" width="88" height="16" rx="8" fill={a} opacity=".5" /><rect x="6" y="46" width="88" height="8" rx="4" fill="#fff" /><circle cx="12" cy="50" r="10" fill={a} /></g>; break;
    case 'burst': g = <g><circle cx="50" cy="50" r="14" fill="#fff" /><circle cx="50" cy="50" r="26" fill="none" stroke={a} strokeWidth="5" /><circle cx="50" cy="50" r="40" fill="none" stroke={b} strokeWidth="3" opacity=".7" />{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <line key={i} x1={50 + Math.cos(i * 0.785) * 28} y1={50 + Math.sin(i * 0.785) * 28} x2={50 + Math.cos(i * 0.785) * 46} y2={50 + Math.sin(i * 0.785) * 46} stroke={a} strokeWidth="3" />)}</g>; break;
    case 'blade': g = <g><path d="M14 80 Q20 20 84 14 Q40 30 30 80Z" fill={a} /><path d="M20 70 Q30 30 78 18" stroke="#fff" strokeWidth="3" fill="none" /></g>; break;
    case 'dash': g = <g>{[0, 1, 2, 3].map((i) => <rect key={i} x={10 + i * 4} y={28 + i * 12} width={70 - i * 8} height="6" rx="3" fill={i % 2 ? b : a} opacity={0.9 - i * 0.12} />)}<polygon points="96,50 70,36 70,64" fill="#fff" /></g>; break;
    case 'shield': g = <g><path d="M50 8 L86 22 V50 Q86 76 50 92 Q14 76 14 50 V22Z" fill={a} opacity=".35" stroke={a} strokeWidth="4" /><path d="M50 20 L74 30 V50 Q74 68 50 80 Q26 68 26 50 V30Z" fill="none" stroke="#fff" strokeWidth="2" opacity=".8" /></g>; break;
    case 'field': g = <g><ellipse cx="50" cy="72" rx="40" ry="14" fill="none" stroke={a} strokeWidth="4" /><ellipse cx="50" cy="56" rx="30" ry="10" fill="none" stroke={b} strokeWidth="3" /><ellipse cx="50" cy="40" rx="20" ry="7" fill="none" stroke={a} strokeWidth="3" /><ellipse cx="50" cy="26" rx="10" ry="4" fill="none" stroke="#fff" strokeWidth="3" /></g>; break;
    case 'summon': g = <g>{[24, 50, 76].map((x, i) => <g key={x} opacity={1 - i * 0.2}><circle cx={x} cy="34" r="9" fill={a} /><rect x={x - 8} y="44" width="16" height="30" rx="6" fill={a} /></g>)}<circle cx="50" cy="82" r="30" fill="none" stroke={b} strokeWidth="2" strokeDasharray="4 4" /></g>; break;
    case 'rain': g = <g>{[0, 1, 2].map((i) => <g key={i}><line x1={22 + i * 28} y1={8 + i * 6} x2={36 + i * 28} y2={46 + i * 6} stroke={a} strokeWidth="6" strokeLinecap="round" /><circle cx={38 + i * 28} cy={50 + i * 6} r="9" fill={b} /></g>)}<path d="M6 92 H94" stroke={a} strokeWidth="3" /></g>; break;
    case 'pull': g = <g><circle cx="50" cy="50" r="10" fill="#fff" />{[0, 1, 2, 3].map((i) => <path key={i} d={`M${50 + Math.cos(i * 1.57) * 42} ${50 + Math.sin(i * 1.57) * 42} L${50 + Math.cos(i * 1.57) * 18} ${50 + Math.sin(i * 1.57) * 18}`} stroke={a} strokeWidth="5" markerEnd="" />)}<circle cx="50" cy="50" r="30" fill="none" stroke={b} strokeDasharray="5 5" strokeWidth="2" /></g>; break;
    case 'push': g = <g><circle cx="50" cy="50" r="10" fill="#fff" />{[0, 1, 2, 3].map((i) => <path key={i} d={`M${50 + Math.cos(i * 1.57) * 18} ${50 + Math.sin(i * 1.57) * 18} L${50 + Math.cos(i * 1.57) * 44} ${50 + Math.sin(i * 1.57) * 44}`} stroke={a} strokeWidth="5" />)}<circle cx="50" cy="50" r="34" fill="none" stroke={b} strokeWidth="3" /></g>; break;
    case 'nova': g = <g><polygon points="50,2 60,36 96,28 68,52 90,84 56,68 50,98 44,68 10,84 32,52 4,28 40,36" fill={a} opacity=".9" /><circle cx="50" cy="50" r="18" fill="#fff" /><circle cx="50" cy="50" r="28" fill="none" stroke={b} strokeWidth="3" /></g>; break;
    case 'strike': g = <g><path d="M58 4 L32 52 H50 L40 96 L74 40 H54Z" fill={a} stroke="#fff" strokeWidth="2" /><ellipse cx="50" cy="94" rx="30" ry="6" fill={b} opacity=".7" /></g>; break;
    default: g = <g><path d="M42 12 H58 V42 H88 V58 H58 V88 H42 V58 H12 V42 H42Z" fill={a} /><circle cx="50" cy="50" r="12" fill="#fff" opacity=".6" /></g>;
  }
  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <defs><radialGradient id={id}><stop offset="0%" stopColor={a} stopOpacity=".45" /><stop offset="100%" stopColor="#000" stopOpacity="0" /></radialGradient></defs>
      <circle cx="50" cy="50" r="48" fill={`url(#${id})`} /><g style={{ filter: `drop-shadow(0 0 5px ${a})` }}>{g}</g>
    </svg>
  );
}
export const catColor = (c: keyof typeof CAT_COL) => CAT_COL[c];
