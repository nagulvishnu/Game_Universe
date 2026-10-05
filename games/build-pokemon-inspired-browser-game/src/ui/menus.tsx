import { useState } from 'react';
import {
  ITEMS, SHOP_CONSUMABLES, SHOP_HELD, SPECIES, STONE_PRICE, calcStats, maxHp, rootOf, stoneName, type Mon,
} from '../game/data';
import { HpBar, MonCanvas, Modal, TypeChip, useG } from './common';

function StatLine({ m }: { m: Mon }) {
  const s = calcStats(m);
  return (
    <div className="flex flex-wrap gap-x-2 text-[10px] font-bold text-[#9aa0d8]">
      <span>ATK {s.atk}</span><span>DEF {s.def}</span><span>SPA {s.spa}</span><span>SPD {s.spd}</span><span>SPE {s.spe}</span>
    </div>
  );
}

export function TeamMenu() {
  const g = useG(); const p = g.p!;
  const [tab, setTab] = useState<'party' | 'bag' | 'box'>('party');
  const [sel, setSel] = useState<string | null>(null);
  const owned = Object.keys(p.items).filter((k) => p.items[k] > 0 && ITEMS[k]);
  const order = ['orb', 'heal', 'revive', 'candy', 'held'];
  owned.sort((a, b) => order.indexOf(ITEMS[a].kind) - order.indexOf(ITEMS[b].kind));
  const selItem = sel ? ITEMS[sel] : null;
  const heldChoices = owned.filter((k) => ITEMS[k].kind === 'held');

  const tabBtn = (id: typeof tab, label: string) => (
    <button key={id} className={`btn flex-1 text-sm ${tab === id ? 'btn-gold' : 'btn-dark'}`} onClick={() => { setTab(id); setSel(null); }}>{label}</button>
  );
  return (
    <Modal title="TEAM & BAG" onClose={() => g.closeMenu()} wide footer={<div className="flex items-center justify-between text-xs font-bold"><span>💰 ${p.money.toLocaleString()}</span><span>Score {p.score.toLocaleString()}</span></div>}>
      <div className="mb-2 flex gap-2">{tabBtn('party', `Party ${p.party.length}/6`)}{tabBtn('bag', 'Bag')}{tabBtn('box', `Box ${p.box.length}`)}</div>

      {tab === 'party' && (
        <div className="flex flex-col gap-2">
          {p.party.map((m, i) => {
            const sp = SPECIES[m.sp];
            return (
              <div key={m.uid} className={`flex items-center gap-2 rounded-xl border-2 border-[#0b0a1e] bg-[#12102f] p-2 ${m.hp <= 0 ? 'opacity-60' : ''}`}>
                <MonCanvas sp={m.sp} size={52} dim={m.hp <= 0} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <b className="truncate text-sm">{i === 0 && '⭐ '}{sp.name}</b><span className="text-xs font-bold text-[#cfd6ff]">Lv.{m.level}</span>
                    {sp.types.map((t) => <TypeChip key={t} t={t} small />)}
                  </div>
                  <HpBar mon={m} className="mt-1" />
                  <StatLine m={m} />
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {m.item ? (
                      <button className="rounded-full bg-[#2c2870] px-2 py-0.5 text-[10px] font-bold hover:bg-[#3a35a0]" onClick={() => g.unequip(m.uid)}>{ITEMS[m.item].icon} {ITEMS[m.item].name} ✕</button>
                    ) : <span className="text-[10px] font-semibold text-[#6c72b0]">No held item</span>}
                    {p.stones.includes(rootOf(m.sp)) && <span className="rounded-full bg-gradient-to-r from-[#ff6fb5] to-[#ffd23f] px-2 py-0.5 text-[10px] font-extrabold text-[#1d1a33]">✨ {stoneName(rootOf(m.sp))}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button className="btn btn-blue !px-2 !py-1 text-xs" disabled={i === 0} onClick={() => g.setLead(m.uid)}>Lead</button>
                  <button className="btn btn-dark !px-2 !py-1 text-xs" disabled={p.party.length <= 1} onClick={() => g.deposit(m.uid)}>Box</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'bag' && (
        <div className="flex flex-col gap-2">
          {!owned.length && <p className="py-3 text-center text-sm text-[#9aa0d8]">Your bag is empty. Visit a Mart!</p>}
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {owned.map((k) => {
              const it = ITEMS[k]; const usable = it.kind !== 'orb';
              return (
                <button
                  key={k} disabled={!usable} onClick={() => setSel(sel === k ? null : k)}
                  className={`flex items-center gap-2 rounded-xl border-2 p-2 text-left ${sel === k ? 'border-[#ffd23f] bg-[#2c2870]' : 'border-[#0b0a1e] bg-[#12102f]'} ${usable ? 'hover:bg-[#2c2870]' : 'opacity-80'}`}
                >
                  <span className="text-2xl">{it.icon}</span>
                  <span className="min-w-0 flex-1"><b className="text-sm">{it.name}</b><span className="block truncate text-[10px] text-[#9aa0d8]">{it.desc}</span></span>
                  <b className="pixel text-[10px] text-[#ffd23f]">×{p.items[k]}</b>
                </button>
              );
            })}
          </div>
          {p.stones.length > 0 && (
            <div className="rounded-xl border-2 border-[#0b0a1e] bg-[#12102f] p-2">
              <div className="mb-1 text-xs font-extrabold text-[#ffd23f]">✨ Mega Stones</div>
              <div className="flex flex-wrap gap-1.5">{p.stones.map((r) => <span key={r} className="rounded-full bg-gradient-to-r from-[#ff6fb5] to-[#ffd23f] px-2 py-0.5 text-[11px] font-extrabold text-[#1d1a33]">💠 {stoneName(r)}</span>)}</div>
            </div>
          )}
          {selItem && (
            <div className="anim-pop rounded-xl border-2 border-[#ffd23f] bg-[#1d1a50] p-2">
              <div className="mb-1 text-xs font-bold">{selItem.icon} Use <b>{selItem.name}</b> on:</div>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {p.party.map((m) => {
                  const cur = m.item ? ITEMS[m.item] : null;
                  return (
                    <button key={m.uid} className="btn btn-dark flex items-center gap-2 !p-1.5 text-left text-xs"
                      onClick={() => { if (selItem.kind === 'held') g.equip(selItem.id, m.uid); else g.useItem(selItem.id, m.uid); if ((g.p!.items[selItem.id] || 0) <= 0) setSel(null); }}>
                      <MonCanvas sp={m.sp} size={34} dim={m.hp <= 0} />
                      <span className="min-w-0 flex-1"><b>{SPECIES[m.sp].name}</b> Lv.{m.level}<span className="block text-[10px] text-[#9aa0d8]">HP {m.hp}/{maxHp(m)}{cur ? ` · ${cur.icon}` : ''}</span></span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {heldChoices.length > 0 && !selItem && <p className="text-center text-[10px] text-[#9aa0d8]">Tap a held item, then a monster, to equip it.</p>}
        </div>
      )}

      {tab === 'box' && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {!p.box.length && <p className="col-span-full py-3 text-center text-sm text-[#9aa0d8]">The Box is empty. Extra caught monsters are stored here.</p>}
          {p.box.map((m) => (
            <div key={m.uid} className="flex items-center gap-2 rounded-xl border-2 border-[#0b0a1e] bg-[#12102f] p-2">
              <MonCanvas sp={m.sp} size={44} />
              <div className="min-w-0 flex-1"><b className="text-sm">{SPECIES[m.sp].name}</b> <span className="text-xs text-[#cfd6ff]">Lv.{m.level}</span><div className="flex gap-1">{SPECIES[m.sp].types.map((t) => <TypeChip key={t} t={t} small />)}</div></div>
              <button className="btn btn-green !px-2 !py-1 text-xs" disabled={p.party.length >= 6} onClick={() => g.withdraw(m.uid)}>Take</button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function Shop() {
  const g = useG(); const p = g.p!;
  const [tab, setTab] = useState<'supplies' | 'held' | 'stones'>('supplies');
  const roots = Array.from(new Set([...p.party, ...p.box].map((m) => rootOf(m.sp))));
  const row = (id: string) => {
    const it = ITEMS[id]; const can = p.money >= it.price;
    return (
      <div key={id} className="flex items-center gap-2 rounded-xl border-2 border-[#0b0a1e] bg-[#12102f] p-2">
        <span className="text-2xl">{it.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5"><b className="text-sm">{it.name}</b><span className="rounded bg-[#0b0a1e] px-1 text-[10px] font-bold text-[#9aa0d8]">own {p.items[id] || 0}</span></div>
          <div className="text-[10px] text-[#9aa0d8]">{it.desc}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button className={`btn !px-3 !py-1 text-xs ${can ? 'btn-gold' : 'btn-dark'}`} onClick={() => g.buy(id)}>${it.price}</button>
          {(it.kind === 'orb' || it.kind === 'heal') && <button className="btn btn-dark !px-2 !py-0.5 text-[10px]" disabled={p.money < it.price * 5} onClick={() => g.buy(id, 5)}>×5</button>}
        </div>
      </div>
    );
  };
  const tabBtn = (id: typeof tab, label: string) => (
    <button key={id} className={`btn flex-1 text-xs sm:text-sm ${tab === id ? 'btn-gold' : 'btn-dark'}`} onClick={() => setTab(id)}>{label}</button>
  );
  return (
    <Modal title="🛒 MONSTER MART" onClose={() => g.closeMenu()} wide footer={<div className="flex items-center justify-between text-sm font-extrabold"><span className="text-[#ffd23f]">💰 ${p.money.toLocaleString()}</span><button className="btn btn-red !py-1 text-xs" onClick={() => g.closeMenu()}>Leave</button></div>}>
      <div className="mb-2 flex gap-2">{tabBtn('supplies', 'Supplies')}{tabBtn('held', 'Held Items')}{tabBtn('stones', '✨ Mega Stones')}</div>
      {tab === 'supplies' && <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">{SHOP_CONSUMABLES.map(row)}</div>}
      {tab === 'held' && <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">{SHOP_HELD.map(row)}</div>}
      {tab === 'stones' && (
        <div className="flex flex-col gap-2">
          <p className="rounded-lg bg-[#0f0d2c] p-2 text-[11px] text-[#cfd6ff]">A Mega Stone lets its monster line <b>Mega Evolve once per battle</b>: new look, +40% attack, +25% defense for 3 turns. Buy it, then press <b>MEGA</b> in battle.</p>
          {roots.map((r) => {
            const have = p.stones.includes(r); const can = p.money >= STONE_PRICE;
            return (
              <div key={r} className="flex items-center gap-2 rounded-xl border-2 border-[#0b0a1e] bg-[#12102f] p-2">
                <MonCanvas sp={r} size={46} mega={have} />
                <div className="min-w-0 flex-1"><b className="text-sm">💠 {stoneName(r)}</b><div className="flex gap-1">{SPECIES[r].types.map((t) => <TypeChip key={t} t={t} small />)}</div><div className="text-[10px] text-[#9aa0d8]">For the {SPECIES[r].name} family</div></div>
                {have ? <span className="rounded-full bg-[#5fe070] px-2 py-1 text-[10px] font-extrabold text-[#1d1a33]">OWNED</span>
                  : <button className={`btn !px-3 !py-1 text-xs ${can ? 'btn-gold' : 'btn-dark'}`} onClick={() => g.buyStone(r)}>${STONE_PRICE}</button>}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
