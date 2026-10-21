import { useState } from 'react';
import { useGame } from '../stores/gameStore';
import { ScreenShell, Panel, Button, Stat, Tag, hexStr } from './shared';
import { levelFromXp, type KeyBindings } from '../save/save';
import { ACHIEVEMENTS } from '../data/achievements';
import { SKILL_BY_ID, SKILLS } from '../data/skills';
import { WEAPON_BY_ID, WEAPONS } from '../data/weapons';
import { EQUIPMENT } from '../data/equipment';
import { keyLabel } from '../game/input/InputManager';

export function ProfileScreen() {
  const setScreen = useGame((s) => s.setScreen);
  const profile = useGame((s) => s.profile);
  const renameProfile = useGame((s) => s.renameProfile);
  const [name, setName] = useState(profile.name);
  const lvl = levelFromXp(profile.xp);

  const stats = {
    wins: profile.stats.wins, losses: profile.stats.losses, matches: profile.stats.matches,
    totalDamage: profile.stats.totalDamage, highestCombo: profile.stats.highestCombo,
    hardWins: profile.stats.hardWins, bossWins: profile.stats.bossWins,
    weaponsUnlocked: profile.unlockedWeapons.length, skillsUnlocked: profile.unlockedSkills.length,
    skillUpgrades: profile.skillUpgradesPurchased, equipmentUnlocked: profile.unlockedEquipment.length,
    level: profile.level, perfectWins: profile.stats.perfectWins, skillsUsed: profile.stats.skillsUsed,
  };

  const topWeapons = Object.entries(profile.weaponUsage).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topSkills = Object.entries(profile.skillUsage).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <ScreenShell title="Profile" subtitle="Progression, statistics and achievements" onBack={() => setScreen('menu')}>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Fighter" className="space-y-3 p-4">
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={14}
              className="min-w-0 flex-1 border border-white/15 bg-black/50 px-2 py-1 text-sm outline-none focus:border-cyan-300/60" />
            <Button onClick={() => renameProfile(name)}>Rename</Button>
          </div>
          <Stat label="Level" value={lvl.level} color="#b06bff" />
          <div className="h-2 border border-white/10 bg-black/60">
            <div className="h-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${(lvl.into / lvl.need) * 100}%` }} />
          </div>
          <Stat label="XP" value={`${lvl.into} / ${lvl.need}`} />
          <Stat label="Shadow shards" value={profile.shards.toLocaleString()} color="#ffb000" />
          <Stat label="Playtime" value={`${Math.round(profile.stats.playtimeMs / 60000)} min`} />
        </Panel>

        <Panel title="Combat record" className="p-4">
          <Stat label="Matches" value={profile.stats.matches} />
          <Stat label="Wins" value={profile.stats.wins} color="#55d68a" />
          <Stat label="Losses" value={profile.stats.losses} color="#ff5a7a" />
          <Stat label="Win rate" value={`${profile.stats.matches ? Math.round((profile.stats.wins / profile.stats.matches) * 100) : 0}%`} />
          <Stat label="Hard-mode wins" value={profile.stats.hardWins} color="#ffb000" />
          <Stat label="Boss wins" value={profile.stats.bossWins} color="#ff3b8d" />
          <Stat label="Perfect wins" value={profile.stats.perfectWins} />
          <Stat label="Total damage" value={Math.round(profile.stats.totalDamage).toLocaleString()} color="#ff8a3a" />
          <Stat label="Highest combo" value={profile.stats.highestCombo} color="#ffd34a" />
          <Stat label="Skills used" value={profile.stats.skillsUsed} />
        </Panel>

        <Panel title="Collection" className="p-4">
          <Stat label="Weapons" value={`${profile.unlockedWeapons.length} / ${WEAPONS.length}`} />
          <Stat label="Skills" value={`${profile.unlockedSkills.length} / ${SKILLS.length}`} />
          <Stat label="Skill upgrades" value={profile.skillUpgradesPurchased} />
          <Stat label="Equipment" value={`${profile.unlockedEquipment.length} / ${EQUIPMENT.length}`} />
          <div className="mt-3 text-[10px] uppercase tracking-widest text-slate-500">Most used weapons</div>
          {topWeapons.length === 0 && <p className="text-xs text-slate-500">No matches recorded yet.</p>}
          {topWeapons.map(([id, n]) => (
            <div key={id} className="flex justify-between text-xs"><span>{WEAPON_BY_ID[id]?.name ?? id}</span><span className="text-slate-400">{n}</span></div>
          ))}
          <div className="mt-3 text-[10px] uppercase tracking-widest text-slate-500">Most used skills</div>
          {topSkills.length === 0 && <p className="text-xs text-slate-500">No skills used yet.</p>}
          {topSkills.map(([id, n]) => (
            <div key={id} className="flex justify-between text-xs">
              <span style={{ color: SKILL_BY_ID[id] ? hexStr(SKILL_BY_ID[id].color) : undefined }}>{SKILL_BY_ID[id]?.name ?? id}</span>
              <span className="text-slate-400">{n}</span>
            </div>
          ))}
        </Panel>
      </div>

      <Panel title="Achievements" className="mt-4 grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
        {ACHIEVEMENTS.map((a) => {
          const done = profile.achievements.includes(a.id);
          const p = a.progress(stats);
          return (
            <div key={a.id} className={`border p-2 ${done ? 'border-amber-300/40 bg-amber-400/5' : 'border-white/10'}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{a.name}</span>
                {done ? <Tag color="#ffb000">unlocked</Tag> : <span className="text-[10px] text-slate-500">{p.value}/{p.target}</span>}
              </div>
              <p className="text-[11px] text-slate-400">{a.description}</p>
              <div className="mt-1 h-1 bg-black/60">
                <div className="h-full bg-amber-400/70" style={{ width: `${(p.value / p.target) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </Panel>
    </ScreenShell>
  );
}

const ACTION_LABELS: { key: keyof KeyBindings; label: string }[] = [
  { key: 'left', label: 'Move left' }, { key: 'right', label: 'Move right' },
  { key: 'jump', label: 'Jump' }, { key: 'crouch', label: 'Crouch / fast-fall' },
  { key: 'attack', label: 'Attack (hold = charge)' },
  { key: 'skill1', label: 'Skill 1' }, { key: 'skill2', label: 'Skill 2' }, { key: 'skill3', label: 'Skill 3' },
  { key: 'dodge', label: 'Dodge / dash' }, { key: 'block', label: 'Guard' },
];

export function SettingsScreen() {
  const setScreen = useGame((s) => s.setScreen);
  const settings = useGame((s) => s.settings);
  const updateSettings = useGame((s) => s.updateSettings);
  const setBinding = useGame((s) => s.setBinding);
  const resetBindings = useGame((s) => s.resetBindings);
  const resetProfile = useGame((s) => s.resetProfile);
  const [listening, setListening] = useState<{ p: 1 | 2; action: keyof KeyBindings } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const captureKey = (p: 1 | 2, action: keyof KeyBindings) => {
    setListening({ p, action });
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      window.removeEventListener('keydown', handler, true);
      setListening(null);
      if (e.code !== 'Escape') setBinding(p, action, e.code);
    };
    window.addEventListener('keydown', handler, true);
  };

  const slider = (key: 'masterVolume' | 'musicVolume' | 'sfxVolume', label: string) => (
    <label className="block text-sm text-slate-300">
      <span className="flex justify-between"><span>{label}</span><span className="text-slate-500">{Math.round(settings[key] * 100)}%</span></span>
      <input type="range" min={0} max={1} step={0.05} value={settings[key]}
        onChange={(e) => updateSettings({ [key]: Number(e.target.value) })} className="w-full accent-violet-500" />
    </label>
  );

  const toggle = (key: 'screenShake' | 'reducedMotion' | 'damageNumbers', label: string, desc: string) => (
    <button onClick={() => updateSettings({ [key]: !settings[key] })}
      className={`flex w-full items-start gap-3 border p-2 text-left ${settings[key] ? 'border-cyan-300/50 bg-cyan-500/10' : 'border-white/10'}`}>
      <span className={`mt-1 h-3.5 w-3.5 shrink-0 border ${settings[key] ? 'border-cyan-300 bg-cyan-400' : 'border-white/30'}`} />
      <span><span className="block text-sm text-white">{label}</span><span className="block text-[11px] text-slate-400">{desc}</span></span>
    </button>
  );

  return (
    <ScreenShell title="Settings" subtitle="Audio, controls and accessibility" onBack={() => setScreen('menu')}>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Audio" className="space-y-3 p-4">
          {slider('masterVolume', 'Master volume')}
          {slider('musicVolume', 'Music volume')}
          {slider('sfxVolume', 'SFX volume')}
        </Panel>

        <Panel title="Display" className="space-y-2 p-4">
          {toggle('screenShake', 'Screen shake', 'Camera shake on impacts')}
          {toggle('reducedMotion', 'Reduced motion', 'Fewer particles, no flashes or shake')}
          {toggle('damageNumbers', 'Damage numbers', 'Floating damage values on hit')}
          <div className="pt-2">
            <span className="text-[11px] uppercase tracking-widest text-slate-500">Effect quality</span>
            <div className="mt-1 flex gap-1">
              {(['low', 'medium', 'high'] as const).map((q) => (
                <button key={q} onClick={() => updateSettings({ quality: q })}
                  className={`flex-1 border px-2 py-1 text-xs capitalize ${settings.quality === q ? 'border-cyan-300/60 bg-cyan-500/10 text-white' : 'border-white/10 text-slate-400'}`}>{q}</button>
              ))}
            </div>
          </div>
          <Button full variant="ghost" onClick={() => {
            const el = document.documentElement;
            if (document.fullscreenElement) void document.exitFullscreen();
            else void el.requestFullscreen?.();
          }}>Toggle fullscreen</Button>
        </Panel>

        <Panel title="Save data" className="space-y-2 p-4">
          <p className="text-xs leading-relaxed text-slate-400">
            Progress is stored in this browser using versioned localStorage. It works offline, but it is
            <b className="text-amber-300"> not tamper-proof</b> — anyone with access to this browser can edit it.
          </p>
          {!confirmReset ? (
            <Button full variant="danger" onClick={() => setConfirmReset(true)}>Reset profile…</Button>
          ) : (
            <div className="space-y-2 border border-red-400/40 p-2">
              <p className="text-xs text-red-200">This permanently deletes all progress. Are you sure?</p>
              <div className="flex gap-2">
                <Button variant="danger" onClick={() => { resetProfile(); setConfirmReset(false); }}>Yes, erase</Button>
                <Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {([1, 2] as const).map((p) => (
          <Panel key={p} title={`Player ${p} controls`} className="p-3">
            <div className="grid gap-1">
              {ACTION_LABELS.map(({ key, label }) => {
                const code = p === 1 ? settings.bindingsP1[key] : settings.bindingsP2[key];
                const active = listening?.p === p && listening.action === key;
                return (
                  <button key={key} onClick={() => captureKey(p, key)}
                    className={`flex items-center justify-between border px-3 py-1.5 text-sm ${active ? 'border-cyan-300 bg-cyan-500/20' : 'border-white/10 hover:bg-white/5'}`}>
                    <span className="text-slate-300">{label}</span>
                    <span className="font-mono text-xs text-cyan-200">{active ? 'press a key…' : keyLabel(code)}</span>
                  </button>
                );
              })}
            </div>
            <Button className="mt-2" variant="ghost" onClick={() => resetBindings(p)}>Reset to defaults</Button>
          </Panel>
        ))}
      </div>
    </ScreenShell>
  );
}
