import { ReactNode, useEffect } from "react";
import { GFX_PRESETS, Gfx } from "../game/data";
import { audio } from "../game/audio";
import { host } from "../game/host";
import { store, useSave } from "../game/store";
import { CONTROL_HELP } from "../game/input";
import { Btn, Kbd, Panel } from "./kit";
import { getShowroom } from "./shared";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-white/5">
      <div className="w-44 text-[12px] uppercase tracking-widest text-slate-300">{label}</div>
      <div className="flex-1 flex items-center gap-2 flex-wrap">{children}</div>
    </div>
  );
}
function Seg({ options, value, onChange }: { options: string[]; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex">
      {options.map((o, i) => (
        <button key={o} onClick={() => { audio.ui("move"); onChange(i); }} className="px-3 py-1.5 font-display text-[11px] uppercase tracking-wider border border-white/15 -ml-px" style={{ background: i === value ? "#17e0ff" : "rgba(255,255,255,0.05)", color: i === value ? "#04050c" : "#a9b8d8" }}>{o}</button>
      ))}
    </div>
  );
}
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <Seg options={["Off", "On"]} value={on ? 1 : 0} onChange={(v) => onChange(v === 1)} />;
}

export default function Settings({ onBack }: { onBack: () => void }) {
  const save = useSave();
  const s = save.settings;
  const g = s.gfx;
  useEffect(() => {
    const sr = getShowroom();
    sr.setLayout("single");
    sr.shift = 0;
    host.setScene(sr);
  }, []);
  const setGfx = (p: Partial<Gfx>) => {
    store.update((d) => { d.settings.gfx = { ...d.settings.gfx, ...p, preset: "custom" }; });
    if (p.res !== undefined) host.setResolution(p.res);
  };
  const preset = (k: "low" | "medium" | "high" | "ultra") => {
    store.update((d) => { d.settings.gfx = { ...GFX_PRESETS[k], fps: d.settings.gfx.fps, split: d.settings.gfx.split }; });
    host.setResolution(GFX_PRESETS[k].res);
  };
  const vol = (k: "music" | "sfx", v: number) => {
    store.update((d) => { d.settings[k] = v; });
    audio.setVolumes(k === "music" ? v : s.music, k === "sfx" ? v : s.sfx);
  };
  const presets = ["low", "medium", "high", "ultra"] as const;
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col">
      <div className="pointer-events-auto flex items-center gap-3 px-5 pt-4">
        <Btn variant="ghost" small onClick={onBack}>‹ Back</Btn>
        <div className="font-display font-black italic text-3xl uppercase text-white">Settings</div>
      </div>
      <div className="flex-1 min-h-0 grid md:grid-cols-2 gap-4 p-5">
        <Panel className="pointer-events-auto p-4 overflow-y-auto scroll-thin anim-left">
          <div className="font-display text-sm tracking-[0.3em] text-cyan-300 uppercase mb-2">Audio</div>
          <Row label="Music volume"><input type="range" min={0} max={1} step={0.05} value={s.music} onChange={(e) => vol("music", +e.target.value)} className="w-56" /><span className="font-display text-xs w-10">{Math.round(s.music * 100)}%</span></Row>
          <Row label="SFX volume"><input type="range" min={0} max={1} step={0.05} value={s.sfx} onChange={(e) => vol("sfx", +e.target.value)} onMouseUp={() => audio.ui("select")} className="w-56" /><span className="font-display text-xs w-10">{Math.round(s.sfx * 100)}%</span></Row>
          <div className="font-display text-sm tracking-[0.3em] text-cyan-300 uppercase mt-5 mb-2">Graphics</div>
          <Row label="Quality preset"><Seg options={["Low", "Medium", "High", "Ultra"]} value={presets.indexOf(g.preset as any)} onChange={(i) => preset(presets[i])} /></Row>
          <Row label="Resolution scale"><input type="range" min={0.5} max={1.5} step={0.05} value={g.res} onChange={(e) => setGfx({ res: +e.target.value })} className="w-56" /><span className="font-display text-xs w-12">{Math.round(g.res * 100)}%</span></Row>
          <Row label="Shadows"><Seg options={["Off", "Low", "Med", "High"]} value={g.shadows} onChange={(v) => setGfx({ shadows: v as any })} /></Row>
          <Row label="Reflections"><Toggle on={g.reflections} onChange={(v) => setGfx({ reflections: v })} /></Row>
          <Row label="Particle effects"><Seg options={["Min", "Low", "Normal", "Max"]} value={g.effects} onChange={(v) => setGfx({ effects: v as any })} /></Row>
          <Row label="Post FX (vignette, speed lines)"><Toggle on={g.post} onChange={(v) => setGfx({ post: v })} /></Row>
          <Row label="Weather density"><input type="range" min={0.2} max={1.6} step={0.1} value={g.weatherDensity} onChange={(e) => setGfx({ weatherDensity: +e.target.value })} className="w-56" /><span className="font-display text-xs w-10">{g.weatherDensity.toFixed(1)}x</span></Row>
          <Row label="Camera shake"><Toggle on={g.shake} onChange={(v) => setGfx({ shake: v })} /></Row>
          <Row label="Split-screen"><Seg options={["Auto", "Vertical", "Horizontal"]} value={["auto", "vertical", "horizontal"].indexOf(g.split)} onChange={(v) => setGfx({ split: (["auto", "vertical", "horizontal"] as const)[v] })} /></Row>
          <Row label="FPS counter"><Toggle on={g.fps} onChange={(v) => setGfx({ fps: v })} /></Row>
          <div className="text-[11px] text-slate-400 mt-2">Tip: on laptop GPUs choose Medium or lower the resolution scale for a steady 60 FPS in split-screen.</div>
        </Panel>
        <Panel className="pointer-events-auto p-4 overflow-y-auto scroll-thin anim-right">
          <div className="font-display text-sm tracking-[0.3em] text-pink-300 uppercase mb-2">Controls</div>
          <table className="w-full text-sm">
            <thead><tr className="text-[11px] uppercase tracking-widest text-slate-400"><th className="text-left py-1">Action</th><th style={{ color: "#17e0ff" }}>Player 1</th><th style={{ color: "#ff2fd0" }}>Player 2</th></tr></thead>
            <tbody>
              {CONTROL_HELP.map((c) => (
                <tr key={c.action} className="border-t border-white/5"><td className="py-1.5 uppercase tracking-wider text-slate-300 text-[12px]">{c.action}</td><td className="text-center"><Kbd>{c.p1}</Kbd></td><td className="text-center"><Kbd>{c.p2}</Kbd></td></tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 text-[13px] text-slate-300 leading-relaxed">
            <b className="text-cyan-200">Gamepads:</b> plug in up to two controllers — they are auto-assigned to Player 1 and Player 2 (change assignment in the lobby). Left stick / D-pad steer · RT accelerate · LT brake · A drift · RB or X nitro · Y power-up · B camera · LB reset · Start pause.
          </div>
          <div className="mt-3 text-[13px] text-slate-300 leading-relaxed">
            <b className="text-yellow-200">Tips:</b> hold Drift while steering to slide; counter-steer to control the angle. Long drifts bank a boost and recharge nitro. Wet tracks reduce grip.
          </div>
          <div className="mt-5"><Btn variant="danger" small onClick={() => { if (confirm("Erase all progress, unlocks and settings?")) { store.reset(); } }}>Reset save data</Btn></div>
        </Panel>
      </div>
    </div>
  );
}

export function Credits({ onBack }: { onBack: () => void }) {
  useEffect(() => { const sr = getShowroom(); sr.setLayout("single"); sr.shift = 0.25; host.setScene(sr); return () => { sr.shift = 0; }; }, []);
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center">
      <Panel className="pointer-events-auto ml-[5vw] p-6 w-[min(520px,90vw)] anim-left">
        <div className="font-display font-black italic text-4xl logo-grad">TURBO MASTERS</div>
        <div className="text-slate-300 mt-3 leading-relaxed text-[15px]">
          A browser-based, anime-inspired arcade racer built for two humans on one screen. All vehicles, tracks, effects, music and sound effects are generated procedurally in real time — no external assets.
        </div>
        <div className="mt-4 grid gap-1 text-sm text-slate-300 uppercase tracking-wider">
          <div><span className="text-cyan-300">Engine</span> · Three.js + WebGL</div>
          <div><span className="text-cyan-300">Physics</span> · custom arcade tire-force vehicle model</div>
          <div><span className="text-cyan-300">Audio</span> · Web Audio API synthesis</div>
          <div><span className="text-cyan-300">UI</span> · React + Tailwind</div>
        </div>
        <div className="mt-5"><Btn onClick={onBack}>‹ Back</Btn></div>
      </Panel>
    </div>
  );
}
