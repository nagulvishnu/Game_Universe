import { useState } from 'react';
import { ASSIGNMENTS, DECORS, FACILITIES, HQ_TIERS, ITEMS, REGIONS, ROLE_COL, ROLE_COST, STAGES, type Role } from '../game/data';
import { derive, facLv, hqTier, ownedTerr, rankOf, useGame, type Member } from '../game/store';
import { Bar, Btn, Chip, money } from './common';
import { summonGarageVehicle } from '../game/Game';
import { VSPECS } from '../game/vehicles';
import { seeded } from '../game/runtime';

function Portrait({ seed, role, size = 54 }: { seed: number; role: Role; size?: number }) {
  const r = seeded(seed); const hair = ['#14141c', '#e8e8f2', '#d4143a', '#7c3aed', '#2f6fff', '#f5c542', '#ff7ad9', '#3ddc84'][Math.floor(r() * 8)]; const skin = ['#ffe0cc', '#f5c7a1', '#e0a47c', '#bd7a4f', '#8a5230'][Math.floor(r() * 5)]; const eye = ['#d4143a', '#2fd1ff', '#ffd23f', '#a855f7', '#3ddc84'][Math.floor(r() * 5)]; const st = Math.floor(r() * 3);
  return (
    <svg viewBox="0 0 60 60" width={size} height={size} className="rounded-lg border-2 shrink-0" style={{ borderColor: ROLE_COL[role], background: `radial-gradient(circle, ${ROLE_COL[role]}44, #0b0a14)` }}>
      <path d="M8 60 Q10 40 30 40 Q50 40 52 60Z" fill="#15151f" stroke={ROLE_COL[role]} strokeWidth="1.2" />
      <ellipse cx="30" cy="27" rx="13" ry="15" fill={skin} />
      {st === 0 ? <path d="M15 28 L12 8 L22 16 L26 4 L32 15 L40 5 L42 17 L50 10 L45 28 Q30 12 15 28Z" fill={hair} /> : st === 1 ? <path d="M14 30 Q14 8 30 8 Q46 8 46 30 Q40 16 30 17 Q20 16 14 30Z M14 30 L12 50 L18 40Z M46 30 L48 50 L42 40Z" fill={hair} /> : <path d="M15 26 Q18 6 32 8 Q46 8 45 26 Q38 14 30 20 Q22 12 15 26Z" fill={hair} />}
      <ellipse cx="24" cy="29" rx="3.2" ry="4.2" fill="#fff" /><ellipse cx="36" cy="29" rx="3.2" ry="4.2" fill="#fff" /><ellipse cx="24" cy="29.5" rx="2.2" ry="3.2" fill={eye} /><ellipse cx="36" cy="29.5" rx="2.2" ry="3.2" fill={eye} /><circle cx="23.2" cy="28" r="0.9" fill="#fff" /><circle cx="35.2" cy="28" r="0.9" fill="#fff" />
      <path d="M26 38 Q30 40 34 38" stroke="#7a2a2a" fill="none" strokeWidth="1.2" />
    </svg>
  );
}
export function MemberCard({ m, actions }: { m: Member; actions?: React.ReactNode }) {
  return (
    <div className="flex gap-2 p-2 rounded border border-white/10 bg-white/5 fadein">
      <Portrait seed={m.seed} role={m.role} />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center"><b className="text-sm truncate">{m.name}</b><span className="text-[10px] font-black px-1.5 rounded" style={{ background: ROLE_COL[m.role], color: '#000' }}>{m.role.toUpperCase()}</span></div>
        <div className="text-[10px] text-white/50">Lv {m.lvl} • Strength {m.str} • {m.gear} • {m.skills.join(', ')}</div>
        <div className="my-1"><Bar v={m.loyalty} max={100} color={m.loyalty < 30 ? '#ef4444' : m.loyalty < 60 ? '#f59e0b' : '#34d399'} h={7} label={`Loyalty ${m.loyalty}`} /></div>
        {actions}
      </div>
    </div>
  );
}

export function Org({ initial }: { initial: string }) {
  const s = useGame(); const d = derive(s); const rank = rankOf(s); const tier = hqTier(s);
  const [tab, setTab] = useState(initial === 'hq' ? 'hq' : initial === 'territory' ? 'terr' : initial === 'members' ? 'members' : initial === 'recruit' ? 'recruit' : 'overview');
  const owned = ownedTerr(s); const cmdCount = s.members.filter((m) => m.role === 'Commander').length;
  const reqs = [['Reputation 50', s.rep >= 50], ['Rep 150 & level 3', s.rep >= 150 && s.level >= 3], ['Rep 350 & 3 members', s.rep >= 350 && s.members.length >= 3], ['Rep 700 & HQ tier 2', s.rep >= 700 && tier >= 2], ['Rep 1200 & 1 territory', s.rep >= 1200 && owned >= 1], ['Rep 2000 & 3 territories', s.rep >= 2000 && owned >= 3], ['Rep 3200 & 5 territories', s.rep >= 3200 && owned >= 5], ['Rep 5000 & 7 territories', s.rep >= 5000 && owned >= 7], ['Rep 8000, 9 territories & Solaris defeated', s.rep >= 8000 && owned >= 9 && !!s.bosses.solaris]];
  return (
    <div className="h-full flex flex-col">
      <div className="flex gap-2 mb-3 flex-wrap">{[['overview', 'Overview'], ['members', `Members (${s.members.length}/${d.memberCap})`], ['recruit', 'Recruitment'], ['hq', 'Headquarters'], ['terr', 'Territories & Commanders']].map(([k, l]) => <Chip key={k} on={tab === k} onClick={() => { setTab(k); if (k === 'recruit' && !s.cands.length) s.refreshCands(); }}>{l}</Chip>)}</div>
      <div className="flex-1 scroll overflow-y-auto pr-2 min-h-0">
        {tab === 'overview' && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <div className="text-2xl title-font text-rose-400">{s.name}</div><div className="text-sm text-white/70 mb-2">Stage {rank}/10: <b className="text-white">{STAGES[rank - 1]}</b></div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">{[['Level', s.level], ['Reputation', s.rep.toLocaleString()], ['Money', money(s.money)], ['Members', `${s.members.length} / ${d.memberCap}`], ['HQ', HQ_TIERS[tier - 1]], ['Territories', `${owned} / 9`], ['Research points', s.research], ['Prisoners', s.prisoners], ['Rival strength', '+' + s.rivalGrowth * 2 + '%'], ['Commanders', cmdCount]].map(([a, b]) => <div key={String(a)} className="bg-white/5 rounded px-2 py-1.5 flex justify-between"><span className="text-white/50">{a}</span><b>{b}</b></div>)}</div>
              <div className="text-[11px] text-white/50">Your organization runs autonomously: every 30 seconds members gather resources and research, commanders earn income from territories, and heroes or rivals may counter-attack. Loyalty can break — keep your people happy.</div>
            </div>
            <div><div className="text-xs uppercase tracking-widest text-white/50 mb-1">Path to the ultimate villain</div>
              {STAGES.map((st, i) => <div key={st} className={`flex items-center gap-2 text-xs py-1 border-b border-white/5 ${rank > i ? 'text-emerald-300' : rank === i + 1 ? 'text-white' : 'text-white/40'}`}><span className="w-5 text-center font-black">{rank > i ? '✔' : i + 1}</span><span className="flex-1">{st}</span><span className="text-[10px] text-white/40">{i === 0 ? 'Start' : reqs[i - 1][0] as string}</span></div>)}
            </div>
          </div>
        )}
        {tab === 'members' && (s.members.length ? <div className="grid xl:grid-cols-2 gap-2">{s.members.map((m) => (
          <MemberCard key={m.id} m={m} actions={<div className="flex gap-1 flex-wrap items-center"><select value={m.assign === 'Territory' ? 'Territory' : m.assign} onChange={(e) => s.assign(m.id, e.target.value)} className="text-[11px]">{[...ASSIGNMENTS, 'Territory'].map((a) => <option key={a}>{a}</option>)}</select><Btn onClick={() => s.reward(m.id)}>Reward</Btn><Btn onClick={() => s.fire(m.id)}>Dismiss</Btn></div>} />))}</div> : <div className="text-white/40 p-6">No followers yet. Visit the Recruitment tab to hire henchmen, fighters, assassins and more. “Follow Me” members fight beside you (up to 4).</div>)}
        {tab === 'recruit' && (
          <div>
            <div className="flex items-center gap-2 mb-2"><Btn onClick={() => s.refreshCands(true)}>Scout new recruits ($200)</Btn><span className="text-xs text-white/50">Capacity {s.members.length}/{d.memberCap} • Better recruits with Recruitment Center (Lv {facLv(s, 'recruit')}) and higher stage</span></div>
            <div className="grid xl:grid-cols-2 gap-2">{s.cands.map((m) => <MemberCard key={m.id} m={m} actions={<div className="flex items-center justify-between"><span className="text-amber-300 text-xs font-bold">{money(ROLE_COST[m.role] * (1 + m.lvl / 30))}</span><Btn primary onClick={() => s.recruit(m.id)}>Recruit</Btn></div>} />)}</div>
          </div>
        )}
        {tab === 'hq' && (
          <div>
            <div className="flex items-center gap-3 mb-3"><div className="text-xl title-font text-amber-300">{HQ_TIERS[tier - 1]}</div><span className="text-xs text-white/50">Tier {tier}/5 — visits your HQ in Metro City (enter the glowing door). Upgrade facilities to grow it into a fortress.</span></div>
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))' }}>
              {FACILITIES.map((f) => { const lv = facLv(s, f.id); const cost = Math.round(f.base * Math.pow(lv + 1, 1.5)); return (
                <div key={f.id} className="card p-2" style={{ ['--rc' as any]: lv ? '#fbbf24' : '#555', cursor: 'default' }}>
                  <div className="flex items-center gap-2"><span className="text-2xl">{f.icon}</span><div className="flex-1"><b className="text-sm">{f.name}</b><div className="flex gap-0.5 mt-0.5">{Array.from({ length: f.max }).map((_, i) => <i key={i} className="h-1.5 flex-1 rounded-sm" style={{ background: i < lv ? '#fbbf24' : '#333' }} />)}</div></div></div>
                  <div className="text-[11px] text-white/60 mt-1">{f.desc}</div><div className="text-[11px] text-emerald-300">{f.perk}</div>
                  <div className="flex gap-1 mt-1"><Btn primary className="flex-1" disabled={lv >= f.max || s.money < cost} onClick={() => s.buildFacility(f.id)}>{lv >= f.max ? 'MAX' : `${lv ? 'Upgrade' : 'Build'} ${money(cost)}`}</Btn>
                    {f.id === 'training' && lv > 0 && <Btn onClick={() => s.train()}>Train {money(500 * s.level)}</Btn>}</div>
                </div>); })}
            </div>
            <div className="mt-4 grid lg:grid-cols-2 gap-4">
              <div><div className="text-xs uppercase tracking-widest text-white/50 mb-1">Decoration & security</div>
                <div className="flex gap-1 flex-wrap mb-2">{DECORS.map((dc) => <Chip key={dc.id} on={s.decor === dc.id} onClick={() => s.setDecor(dc.id)}><i className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: dc.color }} />{dc.name}{dc.cost && s.decor !== dc.id ? ` ${money(dc.cost)}` : ''}</Chip>)}</div>
                <div className="flex items-center gap-2 text-xs"><span>Security level {s.security}/5</span><Btn onClick={() => s.upgradeSecurity()} disabled={s.security >= 5}>Upgrade {money(4000 * (s.security + 1))}</Btn></div></div>
              <div><div className="text-xs uppercase tracking-widest text-white/50 mb-1">Garage ({s.vehicles.length} vehicles)</div>
                <div className="flex gap-1 flex-wrap">{s.vehicles.map((v, i) => <Btn key={i} disabled={!facLv(s, 'garage')} onClick={() => { summonGarageVehicle(v.type); s.setOverlay(''); }}><i className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: v.color }} />{VSPECS[v.type].name}</Btn>)}{!s.vehicles.length && <span className="text-xs text-white/40">Steal vehicles and deliver them to the Chop Shop ring near your HQ.</span>}{!facLv(s, 'garage') && s.vehicles.length > 0 && <span className="text-xs text-amber-300">Build a Garage to summon vehicles.</span>}</div></div>
            </div>
            <div className="mt-4"><div className="text-xs uppercase tracking-widest text-white/50 mb-1">Armory — weapon upgrades</div>
              <div className="flex gap-2 flex-wrap">{ITEMS.filter((i) => i.cat === 'Weapons' && s.inv[i.id]).map((w) => <div key={w.id} className="bg-white/5 rounded px-2 py-1 text-xs flex items-center gap-2"><b style={{ color: w.color }}>{w.name}</b> +{s.wlv[w.id] ?? 0}<Btn onClick={() => s.upgradeWeapon(w.id)} disabled={!facLv(s, 'armory') || (s.wlv[w.id] ?? 0) >= 10}>Upgrade</Btn></div>)}</div></div>
          </div>
        )}
        {tab === 'terr' && (
          <div className="grid xl:grid-cols-2 gap-2">
            {REGIONS.map((r) => { const t = s.terr[r.id]; const own = t.state === 'Villain-Controlled' || t.state === 'Fully Conquered'; const cmd = s.members.find((m) => m.id === t.commander); return (
              <div key={r.id} className="p-2 rounded border border-white/10 bg-white/5">
                <div className="flex justify-between"><b className="text-sm" style={{ color: r.accent }}>{r.name}</b><span className="text-[10px] font-bold">{t.state}</span></div>
                {own ? <>
                  <div className="text-xs text-white/60">Income ≈ {money(r.income * 0.05 * (cmd ? 1 + cmd.str / 120 : 0.4) * (t.state === 'Fully Conquered' ? 1.5 : 1))}/cycle • Defense {Math.round(t.defense + (cmd?.str ?? 0) * 0.6 + facLv(s, 'war') * 10 + s.security * 6 + (t.state === 'Fully Conquered' ? 40 : 0))}</div>
                  <div className="flex gap-1 mt-1 items-center flex-wrap"><select value={t.commander} onChange={(e) => e.target.value && s.setCommander(e.target.value, r.id)} className="text-[11px]"><option value="">No commander</option>{s.members.filter((m) => ['Commander', 'Elite Villain', 'Fighter', 'Guard', 'Assassin'].includes(m.role)).map((m) => <option key={m.id} value={m.id}>{m.name} ({m.role}, str {m.str})</option>)}</select>
                    <Btn onClick={() => { if (s.money >= 3000) { s.addMoney(-3000); s.setTerr(r.id, { defense: t.defense + 10 }); } else s.toast('Need $3,000', '#f87171'); }}>Fortify $3k</Btn>
                    {t.state !== 'Fully Conquered' && <Btn primary disabled={!t.commander || t.defense < 40} onClick={() => { if (s.money >= 20000) { s.addMoney(-20000); s.setTerr(r.id, { state: 'Fully Conquered' }); s.toast(`${r.name} is now FULLY CONQUERED`, '#fbbf24'); } else s.toast('Need $20,000', '#f87171'); }} title="Needs a commander and 40+ base defense">Fully conquer $20k</Btn>}</div>
                </> : <div className="text-xs text-white/50">Not yours. Assault the Command Tower (Lv {r.lvl}, boss {r.bossName}).</div>}
              </div>); })}
          </div>
        )}
      </div>
    </div>
  );
}
