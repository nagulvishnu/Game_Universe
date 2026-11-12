import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useHud, ref, hud } from '../game/store';
import type { HudState } from '../game/store';
import {
  CATS, POWERS, FORMS, WEATHERS, BUILDING_KINDS, STRUCTURE_KINDS, VEHICLE_KINDS, ANIMAL_KINDS, WEAPON_KINDS, DISASTER_KINDS, TERRAFORM_MODES, TELEPORT_DESTS, POWER_MAP,
} from '../game/types';
import { SPEED_NAMES } from '../game/player';
import { Icon } from './icons';

const G = () => ref.game!;
type Setter = Partial<HudState>;

function Chip({ active, onClick, children, color = '#9fb4ff' }: { active?: boolean; onClick: () => void; children: ReactNode; color?: string }) {
  return (
    <button onClick={onClick} aria-pressed={!!active} className="rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition hover:scale-[1.03]"
      style={{ borderColor: active ? color : 'rgba(255,255,255,0.14)', background: active ? color + '33' : 'rgba(255,255,255,0.04)', color: active ? '#fff' : '#b8c4ee', boxShadow: active ? `0 0 14px ${color}44` : undefined }}>{children}</button>
  );
}
function Btn({ onClick, children, color = '#ffd24d', icon, small, disabled }: { onClick: () => void; children: ReactNode; color?: string; icon?: string; small?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`flex items-center justify-center gap-2 rounded-xl font-bold tracking-wide transition hover:scale-[1.03] active:scale-95 ${small ? 'px-3 py-1.5 text-[12px]' : 'px-4 py-2.5 text-[14px]'}`}
      style={{ background: `linear-gradient(135deg, ${color}dd, ${color}77)`, color: '#07080f', boxShadow: `0 0 20px ${color}44` }}>
      {icon && <Icon name={icon} size={small ? 14 : 17} />}{children}
    </button>
  );
}
function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="display text-[13px] font-bold tracking-[0.2em] text-white/85">{title}</h3>
      {desc && <p className="mt-1 text-[13px] text-white/55">{desc}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}
function Slider({ label, value, min, max, step = 1, onChange, fmt }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  const id = label.replace(/\W/g, '');
  return (
    <div className="py-1.5">
      <div className="mb-1 flex justify-between text-[13px]"><label htmlFor={id} className="text-white/75">{label}</label><span className="font-bold tabular-nums text-amber-200">{fmt ? fmt(value) : value}</span></div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}
function Toggle({ label, value, onChange, desc }: { label: string; value: boolean; onChange: (v: boolean) => void; desc?: string }) {
  return (
    <button role="switch" aria-checked={value} onClick={() => onChange(!value)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition hover:bg-white/[0.06]">
      <span><span className="block text-[14px] font-semibold text-white/90">{label}</span>{desc && <span className="block text-[12px] text-white/50">{desc}</span>}</span>
      <span className="relative h-6 w-11 shrink-0 rounded-full transition" style={{ background: value ? 'linear-gradient(90deg,#6bff9a,#3dd9ff)' : 'rgba(255,255,255,0.15)' }}><span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: value ? 22 : 2 }} /></span>
    </button>
  );
}

// ------------ TABS ------------
function PowersTab() {
  const cur = useHud((s) => s.power);
  const unlocked = useHud((s) => s.unlockedPowers);
  const [cat, setCat] = useState<string>('all');
  const list = POWERS.filter((p) => unlocked.includes(p.id) && (cat === 'all' || p.cat === cat));
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Chip active={cat === 'all'} onClick={() => setCat('all')}>Owned · {unlocked.length}</Chip>
        {CATS.filter((c) => unlocked.some((id) => POWER_MAP[id]?.cat === c.id)).map((c) => (<Chip key={c.id} active={cat === c.id} color={c.color} onClick={() => setCat(c.id)}><Icon name={c.icon} size={13} className="mr-1 inline -mt-0.5" />{c.name}</Chip>))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((p) => (
          <article key={p.id} className="rounded-2xl border p-3 transition hover:-translate-y-0.5" style={{ borderColor: cur === p.id ? p.color : 'rgba(255,255,255,0.1)', background: cur === p.id ? p.color + '14' : 'rgba(255,255,255,0.03)' }}>
            <div className={`pv ${p.cat}`} style={{ ['--c' as any]: p.color }}><span className="ic"><Icon name={p.icon} size={30} color="#fff" /></span></div>
            <div className="mt-2 flex items-center justify-between"><h4 className="display text-[13px] font-bold" style={{ color: p.color }}>{p.name}</h4><span className="rounded bg-white/10 px-1.5 text-[10px] font-bold tracking-widest text-white/60">{p.mode.toUpperCase()}</span></div>
            <p className="mt-1 min-h-[54px] text-[13px] leading-snug text-white/65">{p.desc}</p>
            <div className="mt-2 flex items-center gap-2">
              <Btn small color={p.color} icon="Play" onClick={() => { G().powers.select(p.id); }}>{cur === p.id ? 'Equipped' : 'Equip'}</Btn>
              <Btn small color="#ffffff" icon="Zap" onClick={() => G().powers.use(p.id)}>Cast now</Btn>
              <span className="ml-auto text-[10px] tracking-wider text-white/40">{p.hint}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function FormsTab() {
  const cur = useHud((s) => s.form);
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {FORMS.map((f, i) => (
        <article key={f.id} className="overflow-hidden rounded-2xl border" style={{ borderColor: cur === f.id ? f.color : 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', boxShadow: cur === f.id ? `0 0 28px ${f.color}44` : undefined }}>
          <div className="relative h-44" style={{ ['--c' as any]: f.color, ['--c2' as any]: f.color2, background: `radial-gradient(circle at 50% 100%, ${f.color}33, #05060e 75%)` }}>
            <div className="aura">
              <svg width="76" height="130" viewBox="0 0 76 130" className="relative z-10" style={{ filter: `drop-shadow(0 0 10px ${f.color})` }} aria-hidden="true">
                <circle cx="38" cy="16" r="11" fill={f.color2} />
                {f.id === 'supreme' && <ellipse cx="38" cy="3" rx="14" ry="3.5" fill="none" stroke="#ffe27a" strokeWidth="2.5" />}
                {f.id === 'destruction' && <><path d="M26 10 L20 -2 L30 6Z M50 10 L56 -2 L46 6Z" fill={f.color2} /></>}
                {f.id === 'shadow' && <path d="M26 40 L0 30 L8 60 L26 56Z M50 40 L76 30 L68 60 L50 56Z" fill="#150826" stroke={f.color} strokeWidth="1" />}
                {f.id === 'infinite' && <path d="M26 40 L-2 24 L6 54 L26 52Z M50 40 L78 24 L70 54 L50 52Z" fill="#aaffff" opacity="0.6" />}
                <rect x="24" y="28" width="28" height="42" rx="9" fill={f.color} />
                <rect x="10" y="30" width="10" height="38" rx="5" fill={f.color} /><rect x="56" y="30" width="10" height="38" rx="5" fill={f.color} />
                <rect x="26" y="70" width="11" height="52" rx="5" fill={f.color} opacity="0.9" /><rect x="39" y="70" width="11" height="52" rx="5" fill={f.color} opacity="0.9" />
                {f.id === 'cosmic' && <circle cx="38" cy="50" r="30" fill="none" stroke={f.color2} strokeDasharray="3 5" />}
                {f.id === 'elemental' && <><circle cx="8" cy="20" r="5" fill="#ff6a20" /><circle cx="68" cy="20" r="5" fill="#40a0ff" /><circle cx="8" cy="90" r="5" fill="#e8f8ff" /><circle cx="68" cy="90" r="5" fill="#50e060" /></>}
              </svg>
            </div>
            <div className="absolute left-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold tracking-widest text-white/80">KEY {i + 1}</div>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2"><Icon name={f.icon} size={18} color={f.color} /><h4 className="display text-[15px] font-bold" style={{ color: f.color }}>{f.name}</h4></div>
            <div className="text-[12px] italic text-white/50">{f.tagline}</div>
            <p className="mt-2 min-h-[58px] text-[13px] leading-snug text-white/70">{f.desc}</p>
            <div className="mt-3"><Btn color={f.color} icon="Sparkles" onClick={() => G().setForm(f.id)}>{cur === f.id ? 'Current form' : 'Transform instantly'}</Btn></div>
          </div>
        </article>
      ))}
    </div>
  );
}

function KindPicker({ list, value, onPick, color }: { list: { id: string; name: string }[]; value: string; onPick: (id: string) => void; color: string }) {
  return <div className="flex flex-wrap gap-2">{list.map((k) => <Chip key={k.id} active={value === k.id} color={color} onClick={() => onPick(k.id)}>{k.name}</Chip>)}</div>;
}
function CreateTab() {
  const s = useHud((x) => x);
  const set = (p: Setter) => hud.set(p);
  const cast = (id: string) => G().powers.use(id);
  const equip = (id: string) => { G().powers.select(id); G().toast(`${POWER_MAP[id].name} equipped — close the panel and click the world`, POWER_MAP[id].color); };
  const Row = ({ title, power, kinds, value, onPick, color, extra }: { title: string; power: string; kinds?: { id: string; name: string }[]; value?: string; onPick?: (id: string) => void; color: string; extra?: ReactNode }) => (
    <Section title={title} desc={POWER_MAP[power].desc}>
      {kinds && <KindPicker list={kinds} value={value!} onPick={onPick!} color={color} />}
      {extra}
      <div className="mt-3 flex flex-wrap gap-2"><Btn color={color} icon="Sparkles" onClick={() => cast(power)}>Create at crosshair</Btn><Btn small color="#ffffff" icon="Play" onClick={() => equip(power)}>Equip power</Btn></div>
    </Section>
  );
  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-amber-300/10 px-3 py-2 text-[13px] text-amber-100/90">Creations appear where your <b>crosshair</b> points. Close this panel, aim, then use the Equip button’s power — or create immediately at whatever you were looking at.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Row title="BUILDINGS" power="c_building" kinds={BUILDING_KINDS} value={s.bKind} onPick={(id) => set({ bKind: id })} color="#5dff9a" />
        <Row title="STRUCTURES" power="c_structure" kinds={STRUCTURE_KINDS} value={s.sKind} onPick={(id) => set({ sKind: id })} color="#ffcf8a" />
        <Row title="VEHICLES" power="c_vehicle" kinds={VEHICLE_KINDS} value={s.vKind} onPick={(id) => set({ vKind: id })} color="#5dd4ff" />
        <Row title="ANIMALS" power="c_animal" kinds={ANIMAL_KINDS} value={s.aKind} onPick={(id) => set({ aKind: id })} color="#b0ff6b" />
        <Row title="PEOPLE" power="c_npc" color="#ffd0a0" extra={<Slider label="Crowd size" value={s.npcCount} min={1} max={80} onChange={(v) => set({ npcCount: v })} />} />
        <Row title="WEAPONS" power="c_weapon" kinds={WEAPON_KINDS} value={s.wKind} onPick={(id) => set({ wKind: id })} color="#ffe8a0" />
        <Row title="SETTLEMENT" power="c_settlement" color="#9aff8a" />
      </div>
    </div>
  );
}

function WorldTab() {
  const s = useHud((x) => x);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="TERRAFORMING" desc="Sculpt the land. Hold the left mouse button with the Terraform power equipped.">
        <KindPicker list={TERRAFORM_MODES} value={s.tfMode} onPick={(id) => hud.set({ tfMode: id })} color="#8aff6b" />
        <Slider label="Brush radius" value={s.brush} min={15} max={220} onChange={(v) => hud.set({ brush: v })} fmt={(v) => `${v} m`} />
        <div className="mt-2"><Btn color="#8aff6b" icon="Layers" onClick={() => { G().powers.select('terraform'); G().setPanel(false); }}>Equip Terraform & close</Btn></div>
      </Section>
      <Section title="OCEANS" desc="Raise or lower the sea. Flooding drowns the low-lying world.">
        <Slider label="Sea level" value={s.seaLevel} min={-10} max={90} onChange={(v) => hud.set({ seaLevel: v })} fmt={(v) => `${v > 0 ? '+' : ''}${v} m`} />
        <div className="mt-2 flex gap-2"><Btn small color="#2fb8ff" icon="Waves" onClick={() => G().flood()}>Great flood</Btn><Btn small color="#ffffff" onClick={() => hud.set({ seaLevel: 0 })}>Reset sea</Btn></div>
      </Section>
      <Section title="CIVILIZATION" desc="The simulation keeps living: people commute, traffic flows, populations regrow.">
        <Slider label="Target population" value={s.popTarget} min={0} max={400} step={10} onChange={(v) => hud.set({ popTarget: v })} />
        <div className="mt-2"><Toggle label="Environmental recovery" desc="Craters heal, trees regrow, destroyed buildings rebuild themselves after a while." value={s.recovery} onChange={(v) => hud.set({ recovery: v })} /></div>
      </Section>
      <Section title="WORLD MANAGEMENT" desc="Restore everything to its original state or dispel active catastrophes.">
        <div className="flex flex-wrap gap-2">
          <Btn color="#7dffd0" icon="Sparkles" onClick={() => G().regenerate()}>Regenerate world</Btn>
          <Btn color="#ffd24d" icon="Wind" onClick={() => G().killAllDisasters()}>Dispel disasters</Btn>
          <Btn small color="#ffffff" onClick={() => { G().debris.clear(); G().fx.clear(); }}>Clear debris</Btn>
        </div>
      </Section>
    </div>
  );
}

function DisasterTab() {
  const s = useHud((x) => x);
  return (
    <div>
      <p className="mb-4 rounded-xl bg-rose-400/10 px-3 py-2 text-[13px] text-rose-100/90">Catastrophes strike at your crosshair. Choose one to trigger it immediately, or equip the Disaster power to fire it with a click.</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {DISASTER_KINDS.map((d) => (
          <div key={d.id} className="rounded-2xl border p-3" style={{ borderColor: s.dKind === d.id ? '#ff3d6a' : 'rgba(255,255,255,0.1)', background: s.dKind === d.id ? 'rgba(255,61,106,0.1)' : 'rgba(255,255,255,0.03)' }}>
            <div className="display text-[14px] font-bold text-rose-200">{d.name}</div>
            <div className="mt-1 min-h-[36px] text-[13px] text-white/60">{d.desc}</div>
            <div className="mt-2 flex gap-2"><Btn small color="#ff3d6a" icon="Biohazard" onClick={() => { hud.set({ dKind: d.id }); G().runDisaster(d.id); }}>Unleash</Btn><Btn small color="#ffffff" onClick={() => { hud.set({ dKind: d.id }); G().powers.select('disaster'); G().toast(`${d.name} loaded into the Disaster power`, '#ff3d6a'); }}>Equip</Btn></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeatherTab() {
  const s = useHud((x) => x);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="WEATHER SYSTEM" desc="Dynamic weather transitions smoothly across the whole world.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {WEATHERS.map((w) => (
            <button key={w.id} onClick={() => G().setWeather(w.id)} aria-pressed={s.weather === w.id} className="flex flex-col items-center gap-1 rounded-xl border p-3 transition hover:scale-105" style={{ borderColor: s.weather === w.id ? '#7fb4ff' : 'rgba(255,255,255,0.12)', background: s.weather === w.id ? 'rgba(100,150,255,0.2)' : 'rgba(255,255,255,0.03)' }}>
              <Icon name={w.icon} size={26} color={s.weather === w.id ? '#fff' : '#9fb4ff'} /><span className="text-[13px] font-semibold">{w.name}</span>
            </button>
          ))}
        </div>
        <Slider label="Intensity" value={s.weatherIntensity} min={0.2} max={2} step={0.1} onChange={(v) => { hud.set({ weatherIntensity: v }); G().sky.intensity = v; }} fmt={(v) => `${Math.round(v * 100)}%`} />
      </Section>
      <Section title="STORM CONTROL" desc="Call lightning on demand wherever you are looking.">
        <div className="flex flex-wrap gap-2">
          <Btn color="#9fd8ff" icon="Zap" onClick={() => G().powers.use('lightning')}>Lightning strike</Btn>
          <Btn color="#8aa4ff" icon="CloudLightning" onClick={() => G().setWeather('storm')}>Summon thunderstorm</Btn>
          <Btn color="#c9c2b0" icon="Tornado" onClick={() => G().powers.use('tornado')}>Spawn tornado</Btn>
          <Btn color="#d7f3ff" icon="Sun" onClick={() => G().setWeather('clear')}>Clear skies</Btn>
        </div>
      </Section>
    </div>
  );
}

function TimeTab() {
  const s = useHud((x) => x);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="TIME OF DAY" desc="Control the sun. Windows glow at night, stars appear, the world changes mood.">
        <Slider label="Hour" value={Math.round(s.hour * 10) / 10} min={0} max={23.9} step={0.1} onChange={(v) => G().sky.setHour(v)} fmt={(v) => `${String(Math.floor(v)).padStart(2, '0')}:${String(Math.floor((v % 1) * 60)).padStart(2, '0')}`} />
        <div className="mt-2 flex flex-wrap gap-2">{[['Dawn', 6], ['Noon', 12], ['Sunset', 18.2], ['Midnight', 0]].map(([n, h]) => <Chip key={n as string} onClick={() => G().sky.setHour(h as number)}>{n}</Chip>)}</div>
        <Slider label="Day length speed" value={s.daySpeed} min={0} max={30} step={0.5} onChange={(v) => hud.set({ daySpeed: v })} fmt={(v) => (v === 0 ? 'Paused' : `×${v}`)} />
      </Section>
      <Section title="TIME MANIPULATION" desc="Freeze reality, rewind the last seconds, or fast-forward civilization. You are always unaffected.">
        <div className="flex flex-wrap gap-2">
          <Btn color="#7de8ff" icon="Pause" onClick={() => G().setTimeMode(s.timeMode === 'freeze' ? 'normal' : 'freeze')}>{s.timeMode === 'freeze' ? 'Resume time' : 'Freeze time'}</Btn>
          <Btn color="#ffb86b" icon="Rewind" onClick={() => G().setTimeMode(s.timeMode === 'reverse' ? 'normal' : 'reverse')}>{s.timeMode === 'reverse' ? 'Stop rewind' : 'Reverse time'}</Btn>
          <Btn color="#ffd86b" icon="FastForward" onClick={() => G().setTimeMode(s.timeMode === 'fast' ? 'normal' : 'fast')}>{s.timeMode === 'fast' ? 'Normal speed' : 'Accelerate ×6'}</Btn>
        </div>
        <Slider label="World speed" value={s.timeScale} min={0.1} max={8} step={0.1} onChange={(v) => G().setTimeScale(v)} fmt={(v) => `×${v.toFixed(1)}`} />
        <div className="mt-1 text-[12px] text-white/45">Mode: <b className="uppercase text-white/80">{s.timeMode}</b></div>
      </Section>
    </div>
  );
}

function TravelTab() {
  const s = useHud((x) => x);
  return (
    <div className="space-y-4">
      <Section title="TELEPORTATION" desc="Instantly travel to any region of the world — or beyond it.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {TELEPORT_DESTS.map((d) => (<button key={d.id} onClick={() => { G().teleportDest(d.id); G().setPanel(false); }} className="flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.03] px-3 py-3 text-left transition hover:scale-[1.03] hover:bg-white/[0.08]"><Icon name={d.y > 1500 ? 'Globe' : d.id === 'underwater' ? 'Waves' : d.id === 'airport' ? 'Plane' : 'Navigation'} size={18} color="#6bffd8" /><span className="text-[13px] font-semibold">{d.name}</span></button>))}
        </div>
      </Section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="DIMENSIONAL PORTALS" desc="Place two linked gateways at your crosshair. Everything can step through.">
          <div className="flex gap-2"><Btn color="#2ab0ff" icon="CircleDot" onClick={() => G().powers.use('portal')}>Place portal</Btn><Btn small color="#ffffff" onClick={() => { G().powers.select('portal'); G().setPanel(false); }}>Equip & close</Btn></div>
        </Section>
        <Section title="MOVEMENT" desc="Super speed leaves sonic booms; light speed shatters whatever it touches.">
          <div className="flex flex-wrap gap-2">{SPEED_NAMES.map((n, i) => <Chip key={n} color="#ffe24d" active={s.speedLevel === i} onClick={() => { G().player.setSpeedLevel(i); hud.set({ speedLevel: i }); }}>{n}</Chip>)}</div>
          <div className="mt-3"><Toggle label="Free flight" value={s.flying} onChange={(v) => G().player.setFlying(v)} /></div>
        </Section>
      </div>
    </div>
  );
}

function SettingsTab() {
  const s = useHud((x) => x);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="DIVINITY">
        <div className="space-y-2">
          <Toggle label="Invulnerable" desc="Disable to become mortal — your own explosions can hurt you." value={s.invuln} onChange={(v) => { G().player.invulnerable = v; hud.set({ invuln: v }); }} />
          <Toggle label="Free flight" value={s.flying} onChange={(v) => G().player.setFlying(v)} />
        </div>
      </Section>
      <Section title="AUDIO & CONTROLS">
        <Slider label="Master volume" value={s.volume} min={0} max={1} step={0.05} onChange={(v) => { hud.set({ volume: v }); G().audio.setVolume(v); }} fmt={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Mouse sensitivity" value={s.sens} min={0.2} max={3} step={0.1} onChange={(v) => hud.set({ sens: v })} fmt={(v) => `×${v.toFixed(1)}`} />
        <Slider label="Field of view" value={s.fov} min={55} max={105} onChange={(v) => hud.set({ fov: v })} fmt={(v) => `${v}°`} />
        <div className="mt-2"><Toggle label="Ambient music" value={s.music} onChange={(v) => { hud.set({ music: v }); G().audio.setMusic(v); }} /></div>
      </Section>
      <Section title="GRAPHICS" desc="The renderer adapts resolution automatically to keep the frame rate smooth.">
        <div className="space-y-2">
          <Toggle label="Bloom & glow" value={s.bloom} onChange={(v) => hud.set({ bloom: v })} />
          <Toggle label="Dynamic shadows" value={s.shadows} onChange={(v) => hud.set({ shadows: v })} />
        </div>
      </Section>
      <Section title="CONTROLS">
        <div className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-1 text-[13px]">
          {[['WASD', 'Move / fly'], ['Space ×2', 'Toggle flight'], ['Shift', 'Boost'], ['C / Ctrl', 'Descend'], ['L-Click', 'Use power'], ['Scroll', 'Cycle powers'], ['Q', 'Power wheel'], ['Tab / P', 'This panel'], ['1–6', 'Forms'], ['Z / X', 'Freeze / rewind'], ['T', 'Teleport'], ['R', 'Speed mode'], ['H', 'Help']].map(([k, v]) => (<><kbd key={k} className="rounded bg-white/10 px-1.5 py-0.5 text-center font-bold text-amber-100">{k}</kbd><span key={v} className="text-white/70">{v}</span></>))}
        </div>
      </Section>
    </div>
  );
}

const TABS = [
  { id: 'powers', name: 'Powers', icon: 'Zap', C: PowersTab }, { id: 'forms', name: 'Forms', icon: 'Crown', C: FormsTab }, { id: 'create', name: 'Create', icon: 'Sparkles', C: CreateTab },
  { id: 'world', name: 'World', icon: 'Globe', C: WorldTab }, { id: 'disasters', name: 'Disasters', icon: 'Biohazard', C: DisasterTab }, { id: 'weather', name: 'Weather', icon: 'CloudRain', C: WeatherTab },
  { id: 'time', name: 'Time', icon: 'Clock', C: TimeTab }, { id: 'travel', name: 'Travel', icon: 'Compass', C: TravelTab }, { id: 'settings', name: 'Settings', icon: 'Settings', C: SettingsTab },
];

export function ControlPanel() {
  const open = useHud((s) => s.panelOpen);
  const tab = useHud((s) => s.panelTab);
  const box = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { if (open) { setMounted(true); setTimeout(() => box.current?.focus(), 50); } }, [open]);
  if (!open) return null;
  const Active = TABS.find((t) => t.id === tab)?.C ?? PowersTab;
  const onTabKey = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab);
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { hud.set({ panelTab: TABS[(i + 1) % TABS.length].id }); e.preventDefault(); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { hud.set({ panelTab: TABS[(i - 1 + TABS.length) % TABS.length].id }); e.preventDefault(); }
  };
  void mounted;
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 grid place-items-center p-2 sm:p-5" style={{ background: 'radial-gradient(circle at 50% 30%, rgba(20,26,60,0.55), rgba(2,3,10,0.86))', backdropFilter: 'blur(5px)' }} onMouseDown={(e) => { if (e.target === e.currentTarget) G().setPanel(false); }}>
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label="God Control Panel" className="glass anim-up flex h-[min(780px,94vh)] w-[min(1240px,98vw)] flex-col overflow-hidden rounded-3xl outline-none">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: 'radial-gradient(circle, #ffd24d66, #ffd24d11)', border: '1px solid #ffd24d88' }}><Icon name="Orbit" size={22} color="#ffd24d" /></div>
            <div><div className="display text-[18px] font-black tracking-[0.2em] text-amber-100">GOD CONTROL</div><div className="text-[12px] text-white/50">Everything is unlocked. The world keeps living behind this glass.</div></div>
          </div>
          <button onClick={() => G().setPanel(false)} aria-label="Close control panel" className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[13px] font-bold transition hover:bg-white/15"><Icon name="X" size={16} /> Close <kbd className="rounded bg-white/10 px-1 text-[10px]">Esc</kbd></button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <nav role="tablist" aria-label="Control panel sections" aria-orientation="vertical" onKeyDown={onTabKey} className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 p-2 md:w-[190px] md:flex-col md:overflow-visible md:border-b-0 md:border-r">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1} onClick={() => hud.set({ panelTab: t.id })}
                className="flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-[14px] font-bold transition hover:bg-white/10" style={{ background: tab === t.id ? 'linear-gradient(90deg, rgba(255,210,77,0.22), rgba(255,210,77,0.04))' : undefined, color: tab === t.id ? '#ffe9a8' : '#aab4d8', boxShadow: tab === t.id ? 'inset 3px 0 0 #ffd24d' : undefined }}>
                <Icon name={t.icon} size={17} />{t.name}
              </button>
            ))}
          </nav>
          <main role="tabpanel" className="scroll-y min-h-0 flex-1 p-4 sm:p-5"><Active /></main>
        </div>
      </div>
    </div>
  );
}
