import { useState } from 'react';
import { PARTS, PART_MAP, type PartSlot } from '../data/parts';
import { beyType, computeStats, power } from '../game/customization/stats';
import { useGame } from '../game/store';
import { audio } from '../game/audio/audio';
import { Btn, StatRows } from './ui';

const SLOTS: [PartSlot, string][] = [['layer', 'Energy Layer'], ['disc', 'Disc'], ['driver', 'Driver'], ['accessory', 'Accessory']];
const SWATCH = ['#ff4d6d', '#35d0ff', '#ffd24a', '#7aff9a', '#b57cff', '#ff7a3a', '#ffffff', '#2a6af0'];
const MOD_LABEL: Record<string, string> = { atk: 'ATK', def: 'DEF', sta: 'STA', bal: 'BAL', spd: 'SPD', wt: 'WT', brs: 'BRS' };

export function Workshop() {
  const g = useGame();
  const shop = g.overlay === 'shop';
  const [slot, setSlot] = useState<PartSlot>((g.overlayData?.tab as PartSlot) ?? 'layer');
  const saved = g.save.config;
  const draft = g.draftConfig ?? saved;
  const set = (p: Partial<typeof draft>) => g.setDraft({ ...draft, ...p });
  const stats = computeStats(draft), base = computeStats(saved);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const parts = PARTS.filter((p) => p.slot === slot).sort((a, b) => a.unlockLevel - b.unlockLevel || a.cost - b.cost);
  const owned = new Set(g.save.owned);
  const close = () => { audio.back(); g.closeOverlay(); };

  return (
    <div className="absolute inset-y-0 left-0 z-30 flex w-[min(700px,96vw)] p-3" onPointerDown={(e) => e.stopPropagation()}>
      <div className="panel slide-in flex h-full w-full flex-col">
        <div className="flex items-center justify-between border-b border-cyan-400/30 px-5 py-3">
          <div>
            <div className="title-font shine-text text-3xl leading-none">{shop ? (g.overlayData?.name ?? 'Bey Shop') : 'Beyblade Workshop'}</div>
            <div className="text-xs text-cyan-200/70">Parts change real battle stats · Balance {g.save.points.toLocaleString()} pts · Lv {g.save.level}</div>
          </div>
          <Btn kind="pink sm" onClick={close}>Close ✕</Btn>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_250px] gap-4 p-4">
          <div className="flex min-h-0 flex-col">
            <div className="mb-2 flex gap-2">
              {SLOTS.map(([s, label]) => (
                <button key={s} onClick={() => { audio.click(); setSlot(s); }} className={`flex-1 skew-x-[-10deg] border-2 px-2 py-1 text-xs font-extrabold uppercase ${slot === s ? 'border-yellow-300 bg-yellow-300/20 text-yellow-200' : 'border-white/20 bg-white/5 text-white/70 hover:bg-white/10'}`}>{label}</button>
              ))}
            </div>
            <div className="scroll min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {parts.map((p) => {
                const has = owned.has(p.id);
                const equipped = draft[p.slot] === p.id;
                const lockedLevel = !has && !p.reward && g.save.level < p.unlockLevel;
                return (
                  <div key={p.id} className={`flex items-center gap-3 rounded-lg border-2 p-2 ${equipped ? 'border-yellow-300 bg-yellow-300/10' : 'border-white/15 bg-black/30'} ${lockedLevel ? 'opacity-60' : ''}`}>
                    <div className="h-10 w-10 shrink-0 rounded-full border-2 border-white/50" style={{ background: `radial-gradient(circle at 30% 30%, #fff, ${p.color} 50%, #111)` }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><b className="text-sm">{p.name}</b>{has && <span className="chip">Owned</span>}</div>
                      <div className="text-[11px] text-white/60">{p.desc}</div>
                      <div className="mt-0.5 flex flex-wrap gap-1.5 text-[10px] font-bold">
                        {Object.entries(p.mods).map(([k, v]) => <span key={k} className={(v as number) >= 0 ? (k === 'wt' ? 'text-white/70' : 'text-emerald-300') : 'text-rose-300'}>{MOD_LABEL[k]} {(v as number) > 0 ? '+' : ''}{v}</span>)}
                      </div>
                    </div>
                    {has ? <Btn kind="sm" disabled={equipped} onClick={() => set({ [p.slot]: p.id } as any)}>{equipped ? 'Equipped' : 'Equip'}</Btn>
                      : p.reward ? <span className="chip">Champion reward</span>
                      : lockedLevel ? <span className="chip" style={{ color: '#ff9d9d' }}>🔒 Lv {p.unlockLevel}</span>
                      : <Btn kind="gold sm" disabled={g.save.points < p.cost} onClick={() => g.buyPart(p.id)}>Buy {p.cost.toLocaleString()}</Btn>}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto scroll text-xs">
            <div>
              <label className="font-bold uppercase tracking-widest text-cyan-200">Name</label>
              <input value={draft.name} maxLength={18} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => set({ name: e.target.value })} className="mt-1 w-full rounded border-2 border-cyan-400/60 bg-black/50 px-2 py-1 font-bold text-white outline-none focus:border-yellow-300" />
            </div>
            <div>
              <label className="font-bold uppercase tracking-widest text-cyan-200">Main color</label>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {SWATCH.map((c) => <button key={c} onClick={() => set({ color: c })} className={`h-6 w-6 rounded-full border-2 ${draft.color === c ? 'border-white' : 'border-black/40'}`} style={{ background: c }} />)}
                <input type="color" value={draft.color} onChange={(e) => set({ color: e.target.value })} className="h-6 w-8 cursor-pointer bg-transparent" />
              </div>
            </div>
            <div className="rounded-lg border border-white/15 bg-black/30 p-2">
              <div className="mb-1 flex items-center justify-between"><b className="title-font text-base text-yellow-300">Stats</b><span className="chip">{beyType(stats)}</span></div>
              <StatRows stats={stats} compare={dirty ? base : undefined} />
              <div className="mt-1 text-white/60">Power {power(stats)} {dirty && `(was ${power(base)})`}</div>
            </div>
            <div className="text-[11px] text-white/60">
              {SLOTS.map(([s, label]) => <div key={s}>{label}: <b className="text-white">{PART_MAP[draft[s]]?.name}</b></div>)}
            </div>
            <div className="mt-auto flex flex-col gap-2">
              <Btn kind="gold" disabled={!dirty} onClick={() => g.applyConfig(draft)}>Save configuration</Btn>
              <Btn kind="ghost sm" disabled={!dirty} onClick={() => g.setDraft(saved)}>Revert changes</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
