import { useEffect } from "react";
import { RaceResult, PlayerResult } from "../game/race";
import { TRACKS, carById, trackById } from "../game/data";
import { host } from "../game/host";
import { audio } from "../game/audio";
import { store } from "../game/store";
import { fmtTime, ordinal } from "../game/util";
import { Btn, Chip } from "./kit";
import { ChampState, getShowroom, money } from "./shared";

const COLORS = ["#17e0ff", "#ff2fd0"];

function Row({ k, v, hi }: { k: string; v: string; hi?: boolean }) {
  return (
    <div className="flex justify-between text-[13px] py-[3px] border-b border-white/5">
      <span className="uppercase tracking-wider text-slate-400">{k}</span>
      <span className={`font-display tabular-nums ${hi ? "text-yellow-300" : "text-white"}`}>{v}</span>
    </div>
  );
}

function Card({ r, mode, winner, delay }: { r: PlayerResult; mode: string; winner: boolean; delay: number }) {
  const col = COLORS[r.idx];
  const def = carById(r.carId);
  return (
    <div className="glass chamfer p-4 w-[min(440px,46vw)] anim-up" style={{ animationDelay: `${delay}ms`, borderColor: col + "88", boxShadow: winner ? `0 0 40px ${col}55` : undefined }}>
      <div className="flex items-center gap-3 mb-2">
        <div className="font-display font-black italic text-5xl leading-none" style={{ color: r.position === 1 ? "#ffd21f" : "#c9d6f2", textShadow: r.position === 1 ? "0 0 22px #ffd21f" : "none" }}>{mode === "timetrial" ? (r.position === 1 ? "BEST" : "") : ordinal(r.position)}</div>
        <div className="min-w-0">
          <div className="font-display font-bold uppercase tracking-widest text-sm" style={{ color: col }}>{r.name}</div>
          <div className="font-display italic uppercase text-white truncate">{def.name}</div>
        </div>
        {r.record && <Chip color="#7affc0" className="ml-auto">New record</Chip>}
        {r.dnf && <Chip color="#ff6a4a" className="ml-auto">DNF</Chip>}
      </div>
      <Row k="Race time" v={r.dnf ? "—" : fmtTime(r.time)} hi />
      <Row k="Best lap" v={fmtTime(isFinite(r.bestLap) ? r.bestLap : null)} />
      <Row k="Max speed" v={`${Math.round(r.maxSpeed)} km/h`} />
      <Row k="Drift score" v={r.drift.toLocaleString()} />
      <Row k="Nitro used" v={`${r.nitroUsed.toFixed(1)} s`} />
      <Row k="Overtakes" v={String(r.overtakes)} />
      <Row k="Damage" v={`${Math.round(r.damage * 100)}%`} />
      <div className="mt-2 flex items-center justify-between">
        <span className="uppercase tracking-widest text-xs text-slate-400">Rewards</span>
        <span className="font-display font-bold text-xl text-yellow-300">+{money(r.reward)}</span>
      </div>
    </div>
  );
}

export function Results({ result, champ, onRematch, onNext, onSetup, onMenu }: {
  result: RaceResult; champ: ChampState | null; onRematch: () => void; onNext: () => void; onSetup: () => void; onMenu: () => void;
}) {
  const winner = result.players.find((p) => p.position === 1)!;
  const save = store.get();
  useEffect(() => {
    const sr = getShowroom();
    const def = carById(winner.carId);
    sr.setLayout("single");
    sr.setCar(0, def, save.profiles[winner.idx].custom[def.id]);
    sr.setAccents(COLORS[winner.idx], "#ffd21f");
    sr.celebrate = true;
    sr.auto = true;
    sr.shift = 0;
    sr.zoom = 0.95;
    host.setScene(sr);
    return () => { sr.celebrate = false; };
    // eslint-disable-next-line
  }, []);
  const tr = trackById(result.track);
  const ordered = [...result.players].sort((a, b) => a.position - b.position);
  return (
    <div className="absolute inset-0 flex flex-col items-center pointer-events-none">
      <div className="mt-[3.5vh] text-center anim-up">
        <div className="font-display text-xs tracking-[0.5em] uppercase text-slate-300">{result.mode === "timetrial" ? "Time trial complete" : "Race complete"} · {tr.name}</div>
        <div className="font-display font-black italic uppercase text-4xl md:text-6xl" style={{ color: COLORS[winner.idx], textShadow: `0 0 36px ${COLORS[winner.idx]}` }}>
          {result.mode === "timetrial" ? "Fastest: " : "Winner: "}{winner.name}
        </div>
        {result.mode !== "timetrial" && <div className="font-display text-yellow-300 text-sm tracking-widest uppercase">🏆 {carById(winner.carId).name}</div>}
      </div>
      <div className="flex-1" />
      <div className="flex gap-5 justify-center px-4">
        {ordered.map((r, i) => <Card key={r.idx} r={r} mode={result.mode} winner={r.position === 1} delay={150 + i * 120} />)}
      </div>
      <div className="pointer-events-auto flex gap-3 my-5 flex-wrap justify-center">
        {champ ? <Btn variant="solid" color="#ffd21f" onClick={onNext}>{champ.round + 1 >= champ.total ? "Final standings ▸" : "Standings & next race ▸"}</Btn> : <Btn variant="solid" color="#7affc0" onClick={onRematch}>↻ Rematch</Btn>}
        {!champ && <Btn variant="ghost" onClick={onSetup}>Change setup</Btn>}
        <Btn variant="ghost" onClick={onMenu}>Main menu</Btn>
      </div>
    </div>
  );
}

export function ChampScreen({ champ, onNext, onMenu }: { champ: ChampState; onNext: () => void; onMenu: () => void }) {
  const save = store.get();
  const done = champ.done;
  const leader: number = champ.points[0] === champ.points[1] ? -1 : champ.points[0] > champ.points[1] ? 0 : 1;
  useEffect(() => {
    const sr = getShowroom();
    sr.setLayout("single");
    sr.celebrate = done;
    sr.auto = true;
    sr.shift = 0.2;
    sr.zoom = 0.95;
    const p = leader < 0 ? 0 : leader;
    const pr = save.profiles[p];
    const def = carById(pr.unlocked.includes(pr.selected) ? pr.selected : "kitsune");
    sr.setCar(0, def, pr.custom[def.id]);
    sr.setAccents(COLORS[p], "#ffd21f");
    host.setScene(sr);
    if (done) audio.victory();
    return () => { sr.celebrate = false; sr.shift = 0; };
    // eslint-disable-next-line
  }, []);
  return (
    <div className="absolute inset-0 pointer-events-none flex">
      <div className="pointer-events-auto glass chamfer m-6 p-5 w-[min(560px,92vw)] flex flex-col anim-left">
        <div className="font-display text-xs tracking-[0.4em] uppercase text-yellow-300">Championship</div>
        {done ? (
          <div className="font-display font-black italic text-3xl md:text-5xl uppercase mt-1" style={{ color: leader < 0 ? "#fff" : COLORS[leader], textShadow: "0 0 30px currentColor" }}>
            {leader < 0 ? "Dead heat!" : `🏆 ${save.profiles[leader].name} is champion!`}
          </div>
        ) : (
          <div className="font-display font-black italic text-3xl uppercase mt-1">Round {champ.round + 1} / {champ.total} complete</div>
        )}
        <div className="grid grid-cols-2 gap-3 mt-4">
          {[0, 1].map((p) => (
            <div key={p} className="p-3 bg-white/5" style={{ borderTop: `3px solid ${COLORS[p]}`, boxShadow: leader === p ? `0 0 24px ${COLORS[p]}66` : "none" }}>
              <div className="font-display text-xs tracking-widest" style={{ color: COLORS[p] }}>{save.profiles[p].name}{leader === p ? " · LEADER" : ""}</div>
              <div className="font-display font-black text-5xl tabular-nums">{champ.points[p]}</div>
              <div className="text-[11px] uppercase text-slate-400 tracking-widest">points</div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-[11px] tracking-widest uppercase text-slate-400">Results by round</div>
        <div className="mt-1 grid gap-1 overflow-y-auto scroll-thin max-h-[34vh]">
          {TRACKS.map((t, i) => {
            const h = champ.history[i];
            return (
              <div key={t.id} className="flex items-center gap-3 px-3 py-1.5 text-sm" style={{ background: i === champ.round + (done ? -1 : 1) ? "rgba(255,210,31,0.08)" : "rgba(255,255,255,0.04)", opacity: h ? 1 : 0.55 }}>
                <span className="font-display text-yellow-300 w-5">{i + 1}</span>
                <span className="flex-1 uppercase tracking-wider">{t.name}</span>
                {h ? (
                  <>
                    <span className="font-display" style={{ color: COLORS[0] }}>P1 {ordinal(h.pos[0])} +{h.pts[0]}</span>
                    <span className="font-display" style={{ color: COLORS[1] }}>P2 {ordinal(h.pos[1])} +{h.pts[1]}</span>
                  </>
                ) : <span className="text-slate-500 text-xs uppercase">upcoming</span>}
              </div>
            );
          })}
        </div>
        <div className="flex gap-3 mt-4">
          {!done && <Btn variant="solid" color="#ffd21f" onClick={onNext}>Next race: {TRACKS[champ.round + 1]?.name} ▸</Btn>}
          <Btn variant={done ? "solid" : "ghost"} color="#17e0ff" onClick={onMenu}>{done ? "Back to menu" : "Quit championship"}</Btn>
        </div>
        {done && leader >= 0 && <div className="mt-3 text-sm text-yellow-200">Champion bonus awarded: +{money(3000)}</div>}
      </div>
    </div>
  );
}
