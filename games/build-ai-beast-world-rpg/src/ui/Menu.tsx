import { useEffect, useReducer, useRef, useState } from "react";
import type { Game } from "../game/game";
import { SKILL_DEFS } from "../game/game";
import { CONTINENTS, OCEANS, statesOf, GEAR, RARITY, RARITY_COL, TABLETS, QUESTS, ENEMIES, gearById, type Slot } from "../game/data";
import { BIOMES } from "../game/terrain";

const TABS = [["map", "Map"], ["journal", "Journal"], ["char", "Character"], ["atlas", "Atlas"], ["beast", "Bestiary"]] as const;

export function MenuView({ game }: { game: Game }) {
  const [tab, setTab] = useState<string>(game.menuTab || "map");
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === "Tab" || e.code === "KeyM" || e.code === "Escape") { e.preventDefault(); game.resume(); }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [game]);
  return (
    <div className="absolute inset-0 flex items-center justify-center p-2 md:p-6" style={{ background: "rgba(4,3,10,.82)", pointerEvents: "auto" }}>
      <div className="panel w-full max-w-6xl h-full max-h-[760px] flex flex-col overflow-hidden anim-up">
        <div className="flex items-center border-b border-white/10 px-3 overflow-x-auto">
          <div className="font-title tracking-[.2em] mr-4 hidden md:block" style={{ color: "#ffd98a" }}>AI BEAST WORLD</div>
          {TABS.map(([k, n]) => <div key={k} className={"tab " + (tab === k ? "on" : "")} onClick={() => { setTab(k); game.menuTab = k; }}>{n}</div>)}
          <div className="flex-1" />
          <button className="btn ghost !py-1 !px-3" onClick={() => game.resume()}>✕ Close</button>
        </div>
        <div className="flex-1 min-h-0 scroll p-3 md:p-4">
          {tab === "map" && <MapTab game={game} bump={bump} />}
          {tab === "journal" && <JournalTab game={game} />}
          {tab === "char" && <CharTab game={game} bump={bump} />}
          {tab === "atlas" && <AtlasTab game={game} />}
          {tab === "beast" && <BeastTab />}
        </div>
      </div>
    </div>
  );
}

function MapTab({ game, bump }: { game: Game; bump: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { game.mapCanvas = ref.current; game.drawMap(); return () => { game.mapCanvas = null; }; }, [game]);
  const w = game.world;
  const active = w.portals.filter((p) => p.active);
  return (
    <div className="flex flex-col md:flex-row gap-4 h-full">
      <div className="flex-1 flex items-center justify-center min-h-0">
        <canvas ref={ref} width={640} height={640} className="rounded-lg cursor-crosshair" style={{ width: "min(100%, 68vh)", aspectRatio: "1", border: "2px solid rgba(255,214,140,.5)", touchAction: "manipulation" }}
          onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); game.mapClick((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); bump(); }} />
      </div>
      <div className="md:w-72 flex flex-col gap-3 text-sm">
        <div className="panel p-3">
          <div className="font-title tracking-widest mb-1" style={{ color: "#ffd98a" }}>THE WASTELANDS · KALDRAXIS</div>
          <div className="opacity-80 text-xs mb-2">Four regions: {BIOMES.map((b) => b.name).join(" · ")}. Beyond the Tidewall lie six more continents and five oceans.</div>
          <div className="text-xs space-y-0.5 opacity-90">
            <div>◆ Gold diamond — objective · <span style={{ color: "#56e8ff" }}>◆</span> Waystone · ● Discovered place</div>
            <div>Use Vesper Sense (G) to reveal chests on the map.</div>
          </div>
        </div>
        <div className="panel p-3">
          <div className="font-bold tracking-widest text-xs mb-2" style={{ color: "#56e8ff" }}>FAST TRAVEL — AWAKENED WAYSTONES</div>
          {active.length === 0 && <div className="text-xs opacity-70">None yet. Find a Waystone, stand close and press F to awaken it.</div>}
          <div className="flex flex-col gap-1">{active.map((p) => <button key={p.id} className="btn ghost !py-1 !text-xs" onClick={() => game.teleport(p)}>⟡ {p.name}</button>)}</div>
        </div>
        <div className="panel p-3 text-xs space-y-1">
          <div>Places discovered: <b>{w.pois.filter((p) => p.discovered && p.id !== "start").length}</b> / {w.pois.length - 1}</div>
          <div>Chests: <b>{game.stats.chests}</b> / {w.chests.length}</div>
          <div>Tablets: <b>{game.stats.tablets}</b> / {w.tablets.length}</div>
          <div>Waystones awakened: <b>{game.stats.portals}</b> / {w.portals.length}</div>
        </div>
      </div>
    </div>
  );
}

function JournalTab({ game }: { game: Game }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <div className="font-title tracking-widest mb-2" style={{ color: "#ffd98a" }}>QUESTS</div>
        <div className="flex flex-col gap-2">
          {QUESTS.map((q, i) => {
            const done = game.questsDone.has(q.id), cur = i === game.quest;
            if (i > game.quest) return <div key={q.id} className="panel p-3 opacity-40 text-sm">??? — undiscovered</div>;
            return (
              <div key={q.id} className="panel p-3" style={{ borderColor: cur ? "#ffd98a" : undefined, opacity: done ? 0.65 : 1 }}>
                <div className="font-bold">{done ? "✓ " : cur ? "◆ " : ""}{q.title}</div>
                <div className="text-sm opacity-85">{q.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <div className="font-title tracking-widest mb-2" style={{ color: "#56e8ff" }}>ANCIENT TABLETS ({game.stats.tablets}/{game.world.tablets.length})</div>
        <div className="flex flex-col gap-2">
          {game.world.tablets.map((t) => (
            <div key={t.id} className="panel p-3" style={{ opacity: t.read ? 1 : 0.4 }}>
              {t.read ? <><div className="font-bold text-sm" style={{ color: "#9ff0ff" }}>{TABLETS[t.id - 1].title}</div><div className="text-sm opacity-90 italic">{TABLETS[t.id - 1].text}</div></> : <div className="text-sm">Tablet {t.id} — not yet found</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const ABILITIES = [
  ["Combo (LMB / J)", "Lv1", "Four-hit chain; the 4th is a knockdown finisher. Hold after a hit to charge a spinning slash."],
  ["Heavy (H) / Plunge", "Lv1", "Slow poise-breaker. In the air it becomes a ground-shaking plunge."],
  ["Dodge (Shift) · Perfect Dodge", "Lv1", "I-frames. Dodging through a hit slows time and empowers your next strikes (×1.5)."],
  ["Block / Parry (RMB / K)", "Lv1", "Tap just before impact to parry — staggers the foe and reflects projectiles. Purple telegraphs are unblockable."],
  ["Gale Rend (E)", "Lv1", "Dash-slash that launches enemies — follow with air attacks to juggle."],
  ["Glide · Climb · Swim · Dive", "Lv1", "Hold jump in air to glide; steep slopes are climbable at a stamina cost; hold C underwater to dive."],
  ["Gravity Bloom (Q)", "Lv2", "Plants a singularity that drags foes in, then detonates."],
  ["Vesper Strike (Z)", "Lv2", "Vesper leaps at a target. Use within 2.6s of Gale Rend or Bloom for BEAST SYNERGY ×1.7."],
  ["Vesper Sense (G)", "Lv2", "Reveals hidden treasure and Beasts across the area."],
  ["Mount Vesper (V)", "Lv3", "Ride at high speed, scale slopes, glide freely — and with a Core, fly."],
  ["Astral Judgement (R)", "Lv4", "Spend a full energy bar for a cinematic rain of blades and a screen-wide blast."],
  ["Beast Core (B)", "Rare", "Vesper ascends for ~30s: +30% damage, echo bolts on every hit, auto-fire, and flight while mounted."],
];

function CharTab({ game, bump }: { game: Game; bump: () => void }) {
  const p = game.p; const gs = game.gearStats();
  const slots: Slot[] = ["weapon", "armor", "charm"];
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="flex flex-col gap-3">
        <div className="panel p-4">
          <div className="font-title text-2xl" style={{ color: "#ffd98a" }}>The Wayfarer · Lv {p.level}</div>
          <div className="text-xs opacity-70 mb-2">XP {p.xp} / {game.xpNext()}</div>
          <div className="grid grid-cols-2 gap-1 text-sm">
            <div>Attack</div><b>{Math.round(game.atkPower())}</b>
            <div>Max HP</div><b>{game.maxHp()}</b>
            <div>Stamina</div><b>{game.maxSt()}</b>
            <div>Gear bonus</div><b>+{gs.atk} ATK · +{gs.hp} HP</b>
            <div>Core duration</div><b>{game.coreDur()}s</b>
          </div>
        </div>
        <div className="panel p-4">
          <div className="font-bold tracking-widest text-xs mb-2" style={{ color: "#ffd98a" }}>EQUIPMENT</div>
          {slots.map((s) => (
            <div key={s} className="mb-3">
              <div className="text-[11px] uppercase opacity-60">{s}</div>
              <div className="flex flex-col gap-1">
                {GEAR.filter((g) => g.slot === s && game.owned.has(g.id)).map((g) => {
                  const on = game.equipped[s] === g.id;
                  return (
                    <button key={g.id} onClick={() => { game.equip(g.id); bump(); }} className="text-left px-2 py-1 rounded border text-sm" style={{ borderColor: on ? RARITY_COL[g.rarity] : "rgba(255,255,255,.12)", background: on ? "rgba(255,255,255,.08)" : "transparent" }}>
                      <b style={{ color: RARITY_COL[g.rarity] }}>{g.name}</b> <span className="text-xs opacity-70">({RARITY[g.rarity]})</span>{on && " ✓"}
                      <div className="text-xs opacity-70">{g.atk ? `+${g.atk} ATK ` : ""}{g.hp ? `+${g.hp} HP` : ""} · {g.desc}</div>
                    </button>
                  );
                })}
                {game.equipped[s] === null && <div className="text-xs opacity-50">Empty — find a charm in a chest.</div>}
              </div>
            </div>
          ))}
          <div className="text-xs opacity-60">Unfound gear: {GEAR.filter((g) => !game.owned.has(g.id)).length}</div>
        </div>
      </div>
      <div className="panel p-4">
        <div className="flex items-center mb-2"><div className="font-title tracking-widest" style={{ color: "#ffd98a" }}>MASTERY</div><div className="ml-auto px-2 rounded font-bold" style={{ background: p.sp ? "#ffd98a" : "#444", color: p.sp ? "#2b1204" : "#aaa" }}>{p.sp} SP</div></div>
        <div className="flex flex-col gap-2">
          {SKILL_DEFS.map((s) => {
            const r = game.sk(s.id);
            return (
              <div key={s.id} className="flex items-center gap-2 p-2 rounded border border-white/10">
                <div className="flex-1"><div className="font-bold text-sm">{s.name} <span className="opacity-60 text-xs">{r}/{s.max}</span></div><div className="text-xs opacity-75">{s.desc}</div>
                  <div className="flex gap-1 mt-1">{Array.from({ length: s.max }).map((_, i) => <i key={i} style={{ width: 14, height: 5, background: i < r ? "#ffd98a" : "rgba(255,255,255,.15)", borderRadius: 2 }} />)}</div></div>
                <button className="btn !py-1 !px-3 !text-xs" disabled={!p.sp || r >= s.max} style={{ opacity: !p.sp || r >= s.max ? 0.35 : 1 }} onClick={() => { game.spendSkill(s.id); bump(); }}>+</button>
              </div>
            );
          })}
        </div>
      </div>
      <div className="panel p-4">
        <div className="font-title tracking-widest mb-2" style={{ color: "#ffd98a" }}>ABILITIES</div>
        <div className="flex flex-col gap-2 text-sm">
          {ABILITIES.map(([n, lv, d]) => {
            const need = lv.startsWith("Lv") ? +lv.slice(2) : 0;
            const locked = p.level < need;
            return <div key={n} style={{ opacity: locked ? 0.45 : 1 }}><b>{n}</b> <span className="text-xs px-1 rounded bg-white/10">{lv}</span>{locked && " 🔒"}<div className="text-xs opacity-80">{d}</div></div>;
          })}
        </div>
      </div>
    </div>
  );
}

function AtlasTab({ game }: { game: Game }) {
  const [ci, setCi] = useState(0);
  const c = CONTINENTS[ci];
  const states = statesOf(ci);
  return (
    <div>
      <div className="text-xs opacity-70 mb-2 tracking-widest">THE KNOWN WORLD — 7 CONTINENTS · 70 STATES · 280 REGIONS · 5 OCEAN CONTINENTS</div>
      <div className="flex flex-wrap gap-2 mb-3">
        {CONTINENTS.map((k, i) => <button key={k.name} onClick={() => setCi(i)} className="px-3 py-1 rounded border text-sm font-bold" style={{ borderColor: i === ci ? k.color : "rgba(255,255,255,.15)", color: k.color, background: i === ci ? "rgba(255,255,255,.08)" : "transparent" }}>{i + 1}. {k.name}</button>)}
      </div>
      <div className="panel p-3 mb-3" style={{ borderColor: c.color }}>
        <div className="font-title text-2xl" style={{ color: c.color }}>{c.name} — {c.epithet}</div>
        <div className="text-sm opacity-90">{c.teaser}</div>
        <div className="text-xs mt-1 opacity-75">Regional Warden: <b>{c.boss}</b> · {ci === 0 ? "Where your journey begins — The Wastelands are open to explore." : "Sealed behind the Tidewall. Reaching it will take more than a Waystone."}</div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {states.map((s, i) => {
          const open = ci === 0 && i === 0;
          return (
            <div key={s.name} className="panel p-2" style={{ opacity: open ? 1 : 0.7, borderColor: open ? "#ffd98a" : undefined }}>
              <div className="font-bold text-sm">{open ? "◆" : "🔒"} {i + 1}. {s.name}</div>
              <ul className="text-xs opacity-90 mt-1">
                {s.regions.map((r, j) => {
                  const seen = open && game.regionsSeen.has(j);
                  return <li key={r} style={{ color: open ? (seen ? "#9fe8a0" : "#ffd98a") : undefined }}>{open ? (seen ? "✓ " : "· ") : "· "}{open || ci < 0 ? r : r}</li>;
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="font-title tracking-widest mt-4 mb-2" style={{ color: "#7ad8ff" }}>OCEAN CONTINENTS</div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {OCEANS.map((o) => <div key={o.name} className="panel p-2 text-xs"><b style={{ color: "#7ad8ff" }}>🌊 {o.name}</b><div className="opacity-80">{o.note}</div></div>)}
      </div>
    </div>
  );
}

function BeastTab() {
  const info: Record<string, string> = {
    skitter: "Pack hunters. They circle, then lunge on a short red telegraph. Interrupt them mid-windup with fast hits; heavy attacks break their poise.",
    horn: "Armored ram. Dodge the line-charge (red lane) — it overshoots and goes dizzy, taking ×1.5 damage. Parry its gore. Walls and rocks stun it.",
    kite: "Flying ember-spitter that kites you. Its orbs can be dodged, or parried straight back. Air attacks and Gale Rend ground it.",
    colossus: "Elite guardian. Slams are unblockable (purple); the glowing crystals on its back take ×1.6. Dodge its roll, then punish the dizzy window. Powerful ones carry a Beast Core.",
    grazer: "Gentle herd Beast. Part of the ecosystem — they flee, and they drop healing essence if you hunt them.",
    warden: "Keeper of the Last Gate. Three phases. Parry the cleave, jump the shockwaves, lure its charge into a pillar to topple it, and shatter the Pylons that power its ward.",
  };
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {Object.values(ENEMIES).map((e) => (
        <div key={e.id} className="panel p-3">
          <div className="flex items-baseline gap-2"><div className="font-title text-lg" style={{ color: e.id === "warden" ? "#ff9a5a" : "#ffd98a" }}>{e.name}</div><div className="text-xs opacity-60">HP {e.hp} · Tier {e.tier}</div></div>
          <div className="text-sm opacity-90">{info[e.id]}</div>
          <div className="text-xs mt-1" style={{ color: "#9ff0ff" }}>Weakness: {e.weak}</div>
        </div>
      ))}
      <div className="panel p-3 md:col-span-2 text-sm opacity-90">
        <b style={{ color: "#ffb04a" }}>Beast Cores</b> are dropped only by mighty Beasts (the Colossi of the forest, dunes and mountains) and bosses — or found in the Skyglass Reliquary. You can hold three. Spend one to ascend Vesper.
        <div className="text-xs opacity-60 mt-1">Known gear: {GEAR.map((g) => gearById(g.id).name).slice(0, 4).join(", ")}…</div>
      </div>
    </div>
  );
}
