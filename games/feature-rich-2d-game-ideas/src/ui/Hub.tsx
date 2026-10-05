import { useState } from 'react';
import {
  CHARS, CHAR_ORDER, WEAPONS, WEAPON_ORDER, LEVELS, UPGRADES, VEHICLES, ENEMIES, MAX_UPGRADE,
  type Save, type CharId, type WeaponId, type UpgradeId,
} from '../game/data';
import { sfx } from '../game/audio';

type Tab = 'missions' | 'operatives' | 'armory' | 'upgrades' | 'garage';

interface Props {
  save: Save;
  setSave: (s: Save) => void;
  onDeploy: (levelIdx: number) => void;
  onBack: () => void;
  initialLevel: number;
}

function Stat({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-slate-400">
      <span className="w-14 shrink-0 uppercase tracking-wider">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

export default function Hub({ save, setSave, onDeploy, onBack, initialLevel }: Props) {
  const [tab, setTab] = useState<Tab>('missions');
  const [sel, setSel] = useState(Math.min(initialLevel, save.unlocked));
  const char = CHARS[save.char];

  const update = (s: Save) => {
    setSave(s);
  };

  const buyChar = (id: CharId) => {
    const c = CHARS[id];
    if (save.credits < c.cost || save.chars.includes(id)) return;
    sfx('pickup');
    update({ ...save, credits: save.credits - c.cost, chars: [...save.chars, id], char: id });
  };
  const buyWeapon = (id: WeaponId) => {
    const w = WEAPONS[id];
    if (save.credits < w.cost || save.weapons.includes(id)) return;
    sfx('pickup');
    update({ ...save, credits: save.credits - w.cost, weapons: [...save.weapons, id] });
  };
  const buyUpgrade = (id: UpgradeId) => {
    const u = UPGRADES.find(x => x.id === id)!;
    const lvl = save.upgrades[id];
    if (lvl >= MAX_UPGRADE) return;
    const cost = u.base * (lvl + 1);
    if (save.credits < cost) return;
    sfx('pickup');
    update({ ...save, credits: save.credits - cost, upgrades: { ...save.upgrades, [id]: lvl + 1 } });
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'missions', label: 'Missions', icon: '🗺️' },
    { id: 'operatives', label: 'Operatives', icon: '🧑‍🚀' },
    { id: 'armory', label: 'Armory', icon: '🔫' },
    { id: 'upgrades', label: 'Upgrades', icon: '⚙️' },
    { id: 'garage', label: 'Garage', icon: '🚙' },
  ];

  const lvl = LEVELS[sel];
  const enemyIds = Array.from(new Set(lvl.enemies.map(e => e[0])));
  const enemyIcon: Record<string, string> = { grunt: '👹', gunner: '🔫', runner: '💣', brute: '🦍', sniper: '🎯', drone: '🛸', turret: '🗼' };

  return (
    <div className="fixed inset-0 overflow-auto bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 20% 10%, rgba(34,211,238,0.18), transparent 40%), radial-gradient(circle at 85% 90%, rgba(217,70,239,0.18), transparent 40%)' }} />
      <div className="relative mx-auto flex min-h-full max-w-6xl flex-col px-4 py-4">
        {/* header */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">← Title</button>
            <h1 className="text-2xl font-black tracking-widest">
              <span className="text-cyan-300">NEON</span> <span className="text-fuchsia-400">FRONT</span>
              <span className="ml-2 text-xs font-semibold tracking-widest text-slate-500">HQ</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-sm">
              Operative: <b style={{ color: char.color }}>{char.icon} {char.name}</b>
            </div>
            <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-1.5 text-lg font-bold text-amber-300">💰 {save.credits.toLocaleString()}</div>
          </div>
        </header>

        {/* tabs */}
        <nav className="mt-4 flex flex-wrap gap-2">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { sfx('click'); setTab(t.id); }}
              className={`rounded-lg px-4 py-2 text-sm font-bold tracking-wide transition ${tab === t.id ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/30' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </nav>

        <main className="mt-4 flex-1 pb-8">
          {/* ----------- MISSIONS ----------- */}
          {tab === 'missions' && (
            <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
              <div className="space-y-2">
                {LEVELS.map((l, i) => {
                  const locked = i > save.unlocked;
                  return (
                    <button
                      key={l.id}
                      disabled={locked}
                      onClick={() => { sfx('click'); setSel(i); }}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${sel === i ? 'border-cyan-400 bg-cyan-400/10' : 'border-slate-800 bg-slate-900/70 hover:border-slate-600'} ${locked ? 'opacity-40' : ''}`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg font-black" style={{ background: l.theme.wall, color: l.theme.accent }}>
                        {locked ? '🔒' : i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold">{l.name}</div>
                        <div className="truncate text-xs text-slate-400">{l.subtitle}</div>
                      </div>
                      {save.best[i] ? <div className="text-right text-[10px] text-amber-300">BEST<br />{save.best[i].toLocaleString()}</div> : i < save.unlocked ? <span className="text-emerald-400">✔</span> : null}
                    </button>
                  );
                })}
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
                <div className="p-6" style={{ background: `linear-gradient(135deg, ${lvl.theme.bg2}, ${lvl.theme.wall}66)`, borderBottom: `3px solid ${lvl.theme.accent}` }}>
                  <div className="text-xs font-bold tracking-[0.3em]" style={{ color: lvl.theme.accent }}>MISSION {sel + 1} • {lvl.subtitle.toUpperCase()}</div>
                  <h2 className="mt-1 text-4xl font-black tracking-wide">{lvl.name}</h2>
                  <p className="mt-2 max-w-xl text-slate-300">{lvl.desc}</p>
                </div>
                <div className="grid gap-5 p-6 md:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-xs font-bold tracking-widest text-slate-500">OBJECTIVE</h3>
                    <p className="text-sm text-slate-200">Eliminate <b className="text-white">{lvl.goal}</b> hostiles to draw out the boss, then destroy <b style={{ color: lvl.theme.accent }}>{lvl.boss.name}</b> ({lvl.boss.title}).</p>
                    <h3 className="mb-2 mt-4 text-xs font-bold tracking-widest text-slate-500">EXPECTED HOSTILES</h3>
                    <div className="flex flex-wrap gap-2">
                      {enemyIds.map(id => (
                        <span key={id} className="rounded-full bg-slate-800 px-3 py-1 text-xs" style={{ borderLeft: `3px solid ${ENEMIES[id].color}` }}>
                          {enemyIcon[id]} {ENEMIES[id].name}
                        </span>
                      ))}
                      {lvl.turrets > 0 && <span className="rounded-full bg-slate-800 px-3 py-1 text-xs">🗼 ×{lvl.turrets} Turret nests</span>}
                    </div>
                    {lvl.hazard && (
                      <p className="mt-3 text-xs text-orange-300">
                        ⚠ Hazard: {lvl.hazard.type === 'lava' ? 'Lava pools burn anything that touches them.' : lvl.hazard.type === 'toxic' ? 'Toxic pools poison and slow.' : 'Pulsing energy fields damage on contact.'}
                      </p>
                    )}
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-bold tracking-widest text-slate-500">VEHICLES ON MAP</h3>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(new Set(lvl.vehicles)).map(v => (
                        <span key={v} className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-200">{VEHICLES[v].icon} {VEHICLES[v].name}</span>
                      ))}
                    </div>
                    <h3 className="mb-2 mt-4 text-xs font-bold tracking-widest text-slate-500">YOUR LOADOUT</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {WEAPON_ORDER.filter(w => save.weapons.includes(w) || w === 'pistol').map(w => (
                        <span key={w} title={WEAPONS[w].name} className="rounded-md bg-slate-800 px-2 py-1 text-sm">{WEAPONS[w].icon}</span>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-slate-400">Find more weapons as drops in the field. Buy permanent ones in the Armory.</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 text-3xl" style={{ borderColor: char.color, background: char.color2 }}>{char.icon}</div>
                    <div>
                      <div className="font-bold" style={{ color: char.color }}>{char.name}</div>
                      <button onClick={() => setTab('operatives')} className="text-xs text-slate-400 underline hover:text-white">change operative</button>
                    </div>
                  </div>
                  <button
                    onClick={() => { sfx('ult'); onDeploy(sel); }}
                    className="rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-10 py-4 text-xl font-black tracking-widest text-slate-950 shadow-xl shadow-fuchsia-500/30 transition hover:scale-105"
                  >
                    ▶ DEPLOY
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ----------- OPERATIVES ----------- */}
          {tab === 'operatives' && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {CHAR_ORDER.map(id => {
                const c = CHARS[id];
                const owned = save.chars.includes(id);
                const active = save.char === id;
                return (
                  <div key={id} className={`flex flex-col rounded-2xl border p-4 ${active ? 'bg-slate-900' : 'bg-slate-900/60'}`} style={{ borderColor: active ? c.color : '#1e293b', boxShadow: active ? `0 0 24px ${c.color}44` : undefined }}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 text-4xl" style={{ borderColor: c.color, background: c.color2 }}>{c.icon}</div>
                      <div>
                        <div className="text-xl font-black tracking-wider" style={{ color: c.color }}>{c.name}</div>
                        <div className="text-xs text-slate-400">{c.title}</div>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">{c.desc}</p>
                    <div className="mt-3 space-y-1">
                      <Stat label="Health" value={c.hp} max={200} color="#4aff7a" />
                      <Stat label="Speed" value={c.speed} max={300} color="#4fd2ff" />
                      <Stat label="Crit" value={c.crit * 100} max={30} color="#ffd24a" />
                    </div>
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="rounded-lg bg-slate-800/70 p-2"><b className="text-emerald-300">Passive:</b> {c.passive}</div>
                      <div className="rounded-lg bg-slate-800/70 p-2"><b style={{ color: c.color }}>[Q] {c.skill.name}</b> <span className="text-slate-500">({c.skill.cd}s)</span><br />{c.skill.desc}</div>
                      <div className="rounded-lg bg-slate-800/70 p-2"><b className="text-fuchsia-300">[SPACE] {c.ult.name}</b><br />{c.ult.desc}</div>
                    </div>
                    <div className="mt-auto pt-4">
                      {owned ? (
                        <button onClick={() => { sfx('click'); update({ ...save, char: id }); }} disabled={active} className={`w-full rounded-lg py-2.5 font-bold ${active ? 'bg-slate-700 text-slate-400' : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'}`}>
                          {active ? '✔ SELECTED' : 'SELECT'}
                        </button>
                      ) : (
                        <button onClick={() => buyChar(id)} disabled={save.credits < c.cost} className="w-full rounded-lg bg-amber-400 py-2.5 font-bold text-slate-950 hover:bg-amber-300 disabled:bg-slate-700 disabled:text-slate-500">
                          🔓 UNLOCK — 💰 {c.cost.toLocaleString()}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ----------- ARMORY ----------- */}
          {tab === 'armory' && (
            <div>
              <p className="mb-3 text-sm text-slate-400">Weapons you buy are part of your starting loadout on every mission. Weapon drops found in the field are temporary.</p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {WEAPON_ORDER.map(id => {
                  const w = WEAPONS[id];
                  const owned = save.weapons.includes(id) || id === 'pistol';
                  const dps = w.kind === 'arc' ? w.dmg * w.rate * 2.5 : w.dmg * w.rate * w.pellets;
                  return (
                    <div key={id} className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-4" style={{ borderTop: `3px solid ${w.color}` }}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-800 text-2xl">{w.icon}</div>
                        <div>
                          <div className="font-black tracking-wide" style={{ color: w.color }}>{w.name}</div>
                          <div className="text-[11px] uppercase tracking-widest text-slate-500">{w.kind}</div>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-slate-300">{w.desc}</p>
                      <div className="mt-3 space-y-1">
                        <Stat label="DPS" value={dps} max={450} color={w.color} />
                        <Stat label="Rate" value={w.rate} max={32} color="#4fd2ff" />
                        <Stat label="Magazine" value={w.mag} max={110} color="#ffd24a" />
                      </div>
                      <div className="mt-auto pt-3">
                        {owned ? (
                          <div className="rounded-lg bg-emerald-500/15 py-2 text-center text-sm font-bold text-emerald-300">✔ OWNED</div>
                        ) : (
                          <button onClick={() => buyWeapon(id)} disabled={save.credits < w.cost} className="w-full rounded-lg bg-amber-400 py-2 font-bold text-slate-950 hover:bg-amber-300 disabled:bg-slate-700 disabled:text-slate-500">
                            BUY — 💰 {w.cost.toLocaleString()}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ----------- UPGRADES ----------- */}
          {tab === 'upgrades' && (
            <div className="grid gap-4 md:grid-cols-2">
              {UPGRADES.map(u => {
                const lvl = save.upgrades[u.id];
                const maxed = lvl >= MAX_UPGRADE;
                const cost = u.base * (lvl + 1);
                return (
                  <div key={u.id} className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-3xl">{u.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold">{u.name}</div>
                      <div className="text-xs text-slate-400">{u.desc}</div>
                      <div className="mt-2 flex gap-1">
                        {Array.from({ length: MAX_UPGRADE }).map((_, i) => (
                          <div key={i} className={`h-2 flex-1 rounded-full ${i < lvl ? 'bg-cyan-400' : 'bg-slate-700'}`} />
                        ))}
                      </div>
                    </div>
                    <button onClick={() => buyUpgrade(u.id)} disabled={maxed || save.credits < cost} className="shrink-0 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:bg-slate-700 disabled:text-slate-500">
                      {maxed ? 'MAX' : `💰 ${cost}`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* ----------- GARAGE ----------- */}
          {tab === 'garage' && (
            <div>
              <p className="mb-3 text-sm text-slate-400">Vehicles are found on every battlefield (and dropped in when none remain). Walk up and press <kbd className="rounded bg-slate-700 px-1.5 text-xs">E</kbd> to hop in.</p>
              <div className="grid gap-4 md:grid-cols-2">
                {Object.values(VEHICLES).map(v => (
                  <div key={v.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl text-3xl" style={{ background: v.color2 }}>{v.icon}</div>
                      <div>
                        <div className="text-lg font-black" style={{ color: v.color }}>{v.name}</div>
                        <div className="text-[11px] uppercase tracking-widest text-slate-500">{v.flying ? 'Aerial' : 'Ground'} vehicle</div>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{v.desc}</p>
                    <div className="mt-3 space-y-1">
                      <Stat label="Armor" value={v.hp} max={900} color="#4aff7a" />
                      <Stat label="Speed" value={v.speed} max={500} color="#4fd2ff" />
                      <Stat label="Firepower" value={v.dmg * v.fireRate} max={160} color="#ff7a4a" />
                      <Stat label="Ram" value={v.ram} max={90} color="#ffd24a" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
