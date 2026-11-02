import React from 'react';
import { Item, RARITY_COLOR, itemStats, Stats, itemScore, PASSIVES, RAR } from '../game/data';

export const SLOT_ICON: Record<string, string> = { helmet: '🪖', chest: '🛡️', gloves: '🧤', boots: '🥾', accessory: '📿' };
export const WT_ICON: Record<string, string> = { sword: '🗡️', greatsword: '⚔️', dual: '🔪', spear: '🔱', staff: '🪄', gauntlets: '🥊' };
export const itemIcon = (it: Item) => (it.slot === 'weapon' ? WT_ICON[it.wtype || 'sword'] : SLOT_ICON[it.slot]);
export const STAT_LABEL: Record<keyof Stats, string> = { atk: 'Attack', def: 'Defense', hp: 'Health', crit: 'Crit Chance %', critDmg: 'Crit Damage %', regen: 'Energy Regen', en: 'Max Energy' };
export const ELEM_ICON: Record<string, string> = { fire: '🔥', ice: '❄️', shadow: '🌑', poison: '☠️', abyss: '🕳️', none: '' };

export function ItemChip({ item, onClick, selected, small, badge }: { item: Item; onClick?: () => void; selected?: boolean; small?: boolean; badge?: string }) {
  const c = RARITY_COLOR[item.rarity];
  return (
    <button onClick={onClick} title={item.name} className={`relative flex items-center justify-center rounded-lg transition-all hover:scale-105 ${small ? 'h-12 w-12 text-2xl' : 'h-16 w-16 text-3xl'}`}
      style={{ border: `2px solid ${c}`, background: `radial-gradient(circle at 30% 25%, ${c}44, #120d22 70%)`, boxShadow: selected ? `0 0 14px 3px ${c}` : RAR.indexOf(item.rarity) >= 4 ? `0 0 10px ${c}88` : 'none', outline: selected ? '2px solid #fff' : 'none' }}>
      <span>{itemIcon(item)}</span>
      {item.up > 0 && <span className="absolute right-0.5 top-0 text-[10px] font-black text-yellow-300">+{item.up}</span>}
      {badge && <span className="absolute bottom-0 left-0.5 text-[9px] font-bold text-sky-300">{badge}</span>}
    </button>
  );
}

export function ItemDetail({ item, equipped, extra }: { item: Item; equipped?: Item; extra?: React.ReactNode }) {
  const s = itemStats(item); const e = equipped && equipped.id !== item.id ? itemStats(equipped) : null; const c = RARITY_COLOR[item.rarity];
  const keys = Array.from(new Set([...Object.keys(s), ...(e ? Object.keys(e) : [])])) as (keyof Stats)[];
  return (
    <div className="rounded-xl p-4" style={{ border: `1px solid ${c}88`, background: `linear-gradient(160deg, ${c}18, rgba(10,8,20,.9))` }}>
      <div className="flex items-start gap-3">
        <div className="text-4xl">{itemIcon(item)}</div>
        <div className="flex-1">
          <div className="text-lg font-black leading-tight" style={{ color: c }}>{item.name}{item.up > 0 ? ` +${item.up}` : ''}</div>
          <div className="text-xs uppercase tracking-wider text-zinc-400">{item.rarity} {item.slot === 'weapon' ? item.wtype : item.slot} · Req Lv {item.lvl}</div>
        </div>
        <div className="text-right text-[11px] text-zinc-400">Score<div className="text-base font-bold text-amber-300">{itemScore(item)}</div></div>
      </div>
      <div className="mt-3 space-y-1 text-sm">
        {keys.map((k) => { const v = s[k] || 0; const o = e ? e[k] || 0 : 0; const d = e ? +(v - o).toFixed(1) : 0; return (
          <div key={k} className="flex justify-between"><span className="text-zinc-300">{STAT_LABEL[k]}</span><span className="font-bold text-white">+{v}{e && d !== 0 && <span className={`ml-2 text-xs ${d > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{d > 0 ? '▲' : '▼'}{Math.abs(d)}</span>}</span></div>); })}
        {item.element && item.element !== 'none' && <div className="flex justify-between"><span className="text-zinc-300">{ELEM_ICON[item.element]} {item.element} damage</span><span className="font-bold text-orange-300">+{item.elemDmg || 0}</span></div>}
        {item.passive && <div className="mt-2 rounded bg-black/40 p-2 text-xs text-fuchsia-300">✦ {PASSIVES[item.passive]}</div>}
        {item.unique && <div className="text-xs font-bold text-amber-300">★ Boss Legendary</div>}
      </div>
      {extra && <div className="mt-3 flex flex-wrap gap-2">{extra}</div>}
    </div>
  );
}

export function Bar({ v, max, color, h = 10, label, glow }: { v: number; max: number; color: string; h?: number; label?: string; glow?: boolean }) {
  const p = Math.max(0, Math.min(1, v / Math.max(1, max)));
  return (
    <div className="relative overflow-hidden rounded-sm bg-black/60 ring-1 ring-white/20" style={{ height: h, boxShadow: glow ? `0 0 12px ${color}` : undefined }}>
      <div className="h-full transition-[width] duration-150" style={{ width: `${p * 100}%`, background: `linear-gradient(180deg, ${color}, ${color}aa)` }} />
      {label && <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow">{label}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children, wide, tabs }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; tabs?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-4" onMouseDown={(e) => e.stopPropagation()}>
      <div className={`glass relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl ${wide ? 'max-w-6xl' : 'max-w-3xl'}`} style={{ animation: 'fadeUp .25s' }}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <div className="text-xl font-black tracking-[.18em] text-violet-200">{title.toUpperCase()}</div>
          {tabs}
          <button className="btn !px-3 !py-1" onClick={onClose}>✕ Close</button>
        </div>
        <div className="scroll flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
