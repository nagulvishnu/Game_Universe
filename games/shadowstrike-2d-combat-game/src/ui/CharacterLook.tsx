/**
 * SHADOWSTRIKE — CHARACTER LOOK.
 *
 * Two body variants (light / dark) with accent swatches. Purely cosmetic:
 * the fighter's power is identical whichever silhouette you pick.
 */

import { useGame } from '../stores/gameStore';
import { LOOK_SWATCHES } from '../save/save';
import { FighterPreview } from './FighterPreview';
import { audio } from '../game/audio/AudioManager';

function hex(n: number) {
  return '#' + n.toString(16).padStart(6, '0');
}

interface ColumnProps {
  variant: 'light' | 'dark';
  title: string;
  caption: string;
  active: boolean;
  accent: number;
  onSelect: () => void;
  onAccent: (color: number) => void;
  weaponId: string;
  equipment: string[];
}

function Column({ variant, title, caption, active, accent, onSelect, onAccent, weaponId, equipment }: ColumnProps) {
  const bodyColor = variant === 'light' ? 0xdcdce8 : 0x0e0e18;
  const swatches = LOOK_SWATCHES[variant];

  return (
    <div
      className="ss-panel flex flex-col items-center p-4 transition"
      style={active ? { borderColor: 'rgba(168,85,247,0.8)', boxShadow: '0 0 26px rgba(168,85,247,0.28)' } : undefined}
    >
      <button onClick={onSelect} className="text-center">
        <div
          className="text-[15px] font-extrabold uppercase tracking-[0.18em]"
          style={{ color: active ? '#e9d5ff' : '#cbd5e1' }}
        >
          {title}
        </div>
        <div className="mt-0.5 text-[10px] text-slate-500">{caption}</div>
      </button>

      <div
        className="relative mt-3 grid h-[190px] w-full place-items-center overflow-hidden rounded"
        style={{
          background: variant === 'light'
            ? 'radial-gradient(circle at 50% 35%, rgba(34,211,238,0.12), rgba(6,6,14,0.9) 70%)'
            : 'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.07), rgba(6,6,14,0.95) 70%)',
        }}
      >
        <FighterPreview
          weaponId={weaponId}
          bodyColor={bodyColor}
          eyeColor={accent}
          equipment={equipment}
          fighterId="kage"
          width={170}
          height={180}
        />
      </div>

      <div className="mt-3 flex items-center gap-3">
        {swatches.map((c) => (
          <button
            key={c}
            onClick={() => { audio.play('ui'); onAccent(c); }}
            title={`Accent ${hex(c)}`}
            className="h-6 w-6 rounded-full border-2 transition hover:scale-110"
            style={{
              background: hex(c),
              borderColor: accent === c ? '#ffffff' : 'rgba(255,255,255,0.25)',
              boxShadow: accent === c ? `0 0 12px ${hex(c)}` : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function CharacterLook() {
  const profile = useGame((s) => s.profile);
  const setLook = useGame((s) => s.setLook);
  const look = profile.look;

  return (
    <div className="ss-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="ss-panel-title text-sm">Character Look</h2>
        <span className="text-[10px] uppercase tracking-widest text-slate-500">Cosmetic · no stat change</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Column
          variant="light"
          title="Light Mode"
          caption="For dark backgrounds"
          active={look.variant === 'light'}
          accent={look.accent}
          onSelect={() => setLook({ variant: 'light' })}
          onAccent={(color) => setLook({ accent: color })}
          weaponId={profile.loadout.weapon}
          equipment={Object.values(profile.loadout.equipment)}
        />
        <Column
          variant="dark"
          title="Dark Mode"
          caption="For bright backgrounds"
          active={look.variant === 'dark'}
          accent={look.accent}
          onSelect={() => setLook({ variant: 'dark' })}
          onAccent={(color) => setLook({ accent: color })}
          weaponId={profile.loadout.weapon}
          equipment={Object.values(profile.loadout.equipment)}
        />
      </div>

      <p className="mt-3 text-center text-[12px] italic text-cyan-300/90">
        Same power. Different shadows.
      </p>
    </div>
  );
}
