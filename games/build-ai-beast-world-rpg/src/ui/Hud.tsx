import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { Game, Hud } from "../game/game";
import { input, type Act } from "../game/input";

const pct = (a: number, b: number) => Math.max(0, Math.min(100, (a / Math.max(1, b)) * 100)) + "%";

function Cd({ cd, children, ready, locked, label, k, size = 52, onDown }: { cd: number; children: ReactNode; ready?: boolean; locked?: boolean; label: string; k: string; size?: number; onDown?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-1" style={{ width: size + 14 }} onPointerDown={onDown}>
      <div className={"relative flex items-center justify-center rounded-lg " + (ready ? "ready" : "")} style={{ width: size, height: size, background: "rgba(10,8,22,.75)", border: "1.5px solid " + (locked ? "#555" : ready ? "#ffd98a" : "rgba(255,214,140,.5)"), opacity: locked ? 0.45 : 1 }}>
        <span style={{ fontSize: size * 0.5, filter: locked ? "grayscale(1)" : "none" }}>{children}</span>
        {cd > 0 && <div className="absolute inset-0 rounded-lg" style={{ background: `conic-gradient(rgba(0,0,0,.72) ${cd * 360}deg, transparent 0)` }} />}
        {locked && <span className="absolute text-xs">🔒</span>}
      </div>
      <div className="text-[9px] leading-tight opacity-90 text-center" style={{ maxWidth: size + 18 }}><span className="keycap">{k}</span> {label}</div>
    </div>
  );
}

export function HudView({ hud, game }: { hud: Hud; game: Game }) {
  const mini = useRef<HTMLCanvasElement>(null);
  useEffect(() => { game.minimap = mini.current; return () => { game.minimap = null; }; }, [game]);
  const touch = input.touch;
  const hpPct = hud.hp / hud.maxHp;
  const mapSize = touch ? 112 : 158;
  const boss = hud.boss;
  const q = hud.quest;
  const showCtrl = hud.screen === "play";
  const todIcon = hud.tod > 0.22 && hud.tod < 0.78 ? "☀" : "☾";
  const wIcon: Record<string, string> = { clear: "", rain: "🌧", storm: "⛈", fog: "🌫", sand: "🌪", snow: "❄", ash: "🌋" };
  return (
    <div className="absolute inset-0 pointer-events-none select-none" style={{ opacity: showCtrl || hud.screen === "dead" ? 1 : 0.35, transition: "opacity .3s" }}>
      {/* vignette flashes */}
      <div className="absolute inset-0" style={{ boxShadow: `inset 0 0 ${60 + hud.hurt * 140}px rgba(255,20,10,${hud.hurt * 0.55})`, transition: "box-shadow .1s" }} />
      {hud.underwater && <div className="absolute inset-0" style={{ background: "radial-gradient(circle, rgba(20,110,150,.25), rgba(5,40,80,.65))" }} />}
      {hud.slow && <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 120px rgba(120,230,255,.45)" }} />}
      {hud.cine && <><div className="absolute left-0 right-0 top-0 h-[9%] bg-black" /><div className="absolute left-0 right-0 bottom-0 h-[9%] bg-black" /></>}

      {/* top-left vitals */}
      <div className="absolute left-3 top-3 anim-up" style={{ width: touch ? 190 : 270, display: hud.cine ? "none" : "block" }}>
        <div className="flex items-center gap-2 mb-1">
          <div className="font-title text-lg w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "radial-gradient(circle at 30% 30%, #ffe3a8, #b8681f)", color: "#2b1204", border: "2px solid #fff0c8", boxShadow: "0 0 12px rgba(255,180,80,.6)" }}>{hud.level}</div>
          <div className="flex-1">
            <div className="bar" style={{ height: 15 }}>
              <i style={{ width: pct(hud.hp, hud.maxHp), background: hpPct < 0.3 ? "linear-gradient(#ff7a6a,#c01818)" : "linear-gradient(#9cff9a,#2fb84a)" }} />
              <span className="absolute inset-0 text-[10px] font-bold text-center leading-[13px] text-white" style={{ textShadow: "0 1px 2px #000" }}>{Math.ceil(hud.hp)} / {hud.maxHp}</span>
            </div>
            <div className="bar mt-[3px]" style={{ height: 7 }}><i style={{ width: pct(hud.st, hud.maxSt), background: hud.st < 20 ? "linear-gradient(#ffd27a,#d67a1a)" : "linear-gradient(#e8ff9a,#9ad23a)" }} /></div>
            <div className="bar mt-[3px]" style={{ height: 7 }}><i style={{ width: pct(hud.en, 100), background: hud.en >= 100 ? "linear-gradient(#fff2a8,#ffb020)" : "linear-gradient(#9ff0ff,#2a8ad8)" }} /></div>
          </div>
        </div>
        <div className="bar" style={{ height: 4 }}><i style={{ width: pct(hud.xp, hud.xpNext), background: "linear-gradient(#ffe9b0,#d8a040)" }} /></div>
        <div className="flex items-center gap-2 mt-1 text-xs">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 16, height: 16, transform: "rotate(45deg)", background: i < hud.cores ? "radial-gradient(circle, #fff3c0, #ff8a2a)" : "rgba(0,0,0,.5)", border: "1.5px solid " + (i < hud.cores ? "#ffd070" : "#555"), boxShadow: i < hud.cores ? "0 0 10px #ff9a30" : "none" }} />
            ))}
          </div>
          <span className="opacity-80 tracking-wider">BEAST CORES</span>
          {hud.sp > 0 && <span className="ml-auto px-2 rounded font-bold" style={{ background: "#ffd98a", color: "#2b1204" }}>+{hud.sp} SP</span>}
        </div>
        {hud.coreT > 0 && (
          <div className="mt-1">
            <div className="text-[11px] tracking-widest" style={{ color: "#ffb04a" }}>VESPER ASCENDED</div>
            <div className="bar" style={{ height: 6 }}><i style={{ width: pct(hud.coreT, hud.coreMax), background: "linear-gradient(90deg,#ff5a1a,#ffd070)" }} /></div>
          </div>
        )}
        {hud.swimming && hud.o2 < 18 && <div className="mt-1"><div className="text-[11px] text-sky-200 tracking-widest">BREATH</div><div className="bar" style={{ height: 6 }}><i style={{ width: pct(hud.o2, 18), background: "linear-gradient(#bff4ff,#3aa0e0)" }} /></div></div>}
      </div>

      {/* score */}
      <div className="absolute left-1/2 -translate-x-1/2 top-2 text-center" style={{ display: hud.cine || boss ? "none" : "block" }}>
        <div className="font-title text-2xl" style={{ color: "#ffe9b8", textShadow: "0 0 14px rgba(255,170,70,.6), 0 2px 0 #000" }}>{hud.score.toLocaleString()}</div>
        {hud.combo >= 3 && (
          <div key={hud.combo > 0 ? Math.floor(hud.combo / 6) : 0} className="font-bold tracking-widest" style={{ color: hud.mult > 1.5 ? "#ffb04a" : "#fff", fontSize: 14 + Math.min(10, hud.combo / 6), textShadow: "0 0 10px rgba(255,150,50,.8)" }}>
            {hud.combo} HIT · ×{hud.mult.toFixed(2)}
          </div>
        )}
      </div>

      {/* boss bar */}
      {boss && !hud.cine && (
        <div className="absolute left-1/2 -translate-x-1/2 top-3 w-[min(640px,86vw)] anim-up">
          <div className="text-center font-title text-xl tracking-[.3em]" style={{ color: "#ffd0a0", textShadow: "0 0 14px #ff6a2a, 0 2px 0 #000" }}>{boss.name}</div>
          <div className="text-center text-[11px] tracking-[.3em] opacity-80 mb-1">{boss.title.toUpperCase()} · PHASE {boss.phase}</div>
          <div className="bar" style={{ height: 16, border: "1.5px solid " + (boss.shield ? "#c890ff" : "#ffcf9a"), boxShadow: boss.shield ? "0 0 18px #b070ff" : "0 0 12px rgba(255,120,40,.5)" }}>
            <i style={{ width: pct(boss.hp, boss.max), background: boss.shield ? "linear-gradient(#e0c0ff,#7a3ad0)" : "linear-gradient(#ffb06a,#c82a1a)" }} />
            <div className="absolute top-0 bottom-0 w-px bg-white/70" style={{ left: "66%" }} /><div className="absolute top-0 bottom-0 w-px bg-white/70" style={{ left: "33%" }} />
          </div>
          <div className="bar mt-[3px] mx-auto" style={{ height: 5, width: "50%" }}><i style={{ width: pct(boss.poise * 100, 100), background: "linear-gradient(#fff2b0,#ffb020)" }} /></div>
          {boss.shield && <div className="text-center text-xs mt-1 tracking-widest animate-pulse" style={{ color: "#d8b0ff" }}>WARD ACTIVE — SHATTER THE PYLONS</div>}
        </div>
      )}

      {/* top right: minimap + quest */}
      <div className="absolute right-3 top-3 flex flex-col items-end gap-2" style={{ display: hud.cine ? "none" : "flex" }}>
        <div className="relative" style={{ width: mapSize, height: mapSize }}>
          <canvas ref={mini} width={mapSize * 2} height={mapSize * 2} style={{ width: mapSize, height: mapSize, filter: "drop-shadow(0 4px 10px rgba(0,0,0,.6))" }} />
          <div className="absolute left-1/2 -translate-x-1/2 -top-1 text-[10px] px-1 rounded bg-black/60 font-bold" style={{ color: "#ffd98a" }}>N↑</div>
          <div className="absolute -bottom-1 right-0 text-[11px] px-1.5 rounded bg-black/60">{todIcon} {wIcon[hud.weather]}</div>
        </div>
        <div className="text-right text-xs font-bold tracking-widest px-2 py-0.5 rounded bg-black/55" style={{ color: "#ffe0a0" }}>{hud.region.toUpperCase()}</div>
        {q && !touch && (
          <div className="panel px-3 py-2 w-56 text-right">
            <div className="text-[10px] tracking-[.25em] opacity-70">OBJECTIVE</div>
            <div className="font-title text-sm" style={{ color: "#ffd98a" }}>{q.title}</div>
            <div className="text-xs opacity-85 leading-tight">{q.desc}</div>
            {q.dist >= 0 && (
              <div className="flex items-center justify-end gap-2 mt-1 text-xs">
                <span style={{ display: "inline-block", transform: `rotate(${q.ang}rad)`, color: "#ffd24a", fontSize: 16 }}>▲</span>
                <span>{Math.round(q.dist)} m</span>
              </div>
            )}
          </div>
        )}
        {q && touch && <div className="text-[11px] text-right max-w-[150px] leading-tight px-2 py-1 rounded bg-black/50"><b style={{ color: "#ffd98a" }}>{q.title}</b>{q.dist >= 0 && <span> · {Math.round(q.dist)}m <span style={{ display: "inline-block", transform: `rotate(${q.ang}rad)`, color: "#ffd24a" }}>▲</span></span>}</div>}
      </div>

      {/* banner */}
      {hud.banner && (
        <div key={hud.banner.id} className="absolute left-0 right-0 text-center anim-banner" style={{ top: boss ? "22%" : "17%" }}>
          <div className="font-title text-4xl md:text-6xl" style={{ color: hud.banner.color, textShadow: `0 0 30px ${hud.banner.color}, 0 3px 0 #000`, letterSpacing: ".14em" }}>{hud.banner.text}</div>
          {hud.banner.sub && <div className="mt-2 text-sm md:text-lg tracking-[.22em] opacity-95" style={{ textShadow: "0 2px 6px #000" }}>{hud.banner.sub}</div>}
        </div>
      )}

      {/* toasts */}
      <div className="absolute left-3 flex flex-col gap-1" style={{ top: touch ? 118 : 150 }}>
        {hud.toasts.map((t) => (
          <div key={t.id} className="anim-toast px-3 py-1 rounded text-sm font-semibold max-w-[300px]" style={{ background: "linear-gradient(90deg, rgba(10,8,22,.85), rgba(10,8,22,0))", borderLeft: `3px solid ${t.color}`, color: t.color, textShadow: "0 1px 3px #000" }}>{t.text}</div>
        ))}
      </div>

      {/* interact prompt */}
      {hud.prompt && !hud.dialogue && !hud.cine && (
        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-auto" style={{ bottom: touch ? "24%" : "27%" }}>
          <div className="panel px-4 py-2 flex items-center gap-2 text-base font-bold" style={{ borderColor: "#ffd98a", animation: "pulseGlow 1.4s infinite" }} onPointerDown={() => { if (touch) { input.set("interact", true); setTimeout(() => input.set("interact", false), 60); } }}>
            <span className="keycap">{touch ? "✋" : "F"}</span> {hud.prompt}
          </div>
        </div>
      )}

      {/* hint */}
      {hud.hint && !hud.dialogue && (
        <div className="absolute left-1/2 -translate-x-1/2 text-center text-sm md:text-base px-4 py-1.5 rounded-full anim-up" style={{ bottom: touch ? "42%" : "17%", background: "rgba(0,0,0,.6)", border: "1px solid rgba(255,214,140,.4)", maxWidth: "88vw" }}>💡 {hud.hint}</div>
      )}

      {/* subtitle */}
      {hud.subtitle && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-[11%] text-center max-w-[80vw]">
          <span className="font-title text-lg italic" style={{ color: "#ffb89a", textShadow: "0 2px 8px #000" }}><b>{hud.subtitle.name}:</b> “{hud.subtitle.text}”</span>
        </div>
      )}

      {/* dialogue */}
      {hud.dialogue && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-6 w-[min(760px,94vw)] pointer-events-auto" onPointerDown={() => { input.set("advance", true); setTimeout(() => input.set("advance", false), 40); }}>
          <div className="panel px-5 py-4 anim-up" style={{ borderColor: "#ffd98a" }}>
            <div className="font-title text-lg mb-1" style={{ color: "#ffd98a" }}>{hud.dialogue.name}</div>
            <div className="text-base md:text-lg leading-snug" style={{ fontStyle: hud.dialogue.text.startsWith("♪") ? "italic" : "normal", color: hud.dialogue.text.startsWith("♪") ? "#ffd0a0" : "#f4ecd8" }}>{hud.dialogue.text}</div>
            <div className="text-right text-xs opacity-70 mt-2 animate-pulse">{hud.dialogue.i + 1}/{hud.dialogue.n} · {touch ? "tap" : "click / F / Space"} to continue ▸</div>
          </div>
        </div>
      )}

      {/* charge ring */}
      {hud.charge > 0 && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 90, height: 90, borderRadius: "50%", background: `conic-gradient(${hud.charge >= 1 ? "#ffe9a0" : "#7ae8ff"} ${hud.charge * 360}deg, rgba(255,255,255,.08) 0)`, mask: "radial-gradient(circle, transparent 36px, #000 38px)", WebkitMask: "radial-gradient(circle, transparent 36px, #000 38px)", opacity: 0.9 }} />
      )}

      {/* desktop skill bar */}
      {!touch && !hud.cine && !hud.dialogue && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-3 flex items-end gap-2.5 px-3 py-2 rounded-xl" style={{ background: "rgba(8,6,18,.55)", border: "1px solid rgba(255,214,140,.25)" }}>
          <Cd cd={hud.cd.s1} k="E" label="Gale">🌪️</Cd>
          <Cd cd={hud.cd.s2} k="Q" label="Bloom" locked={!hud.unlock.s2}>🔮</Cd>
          <Cd cd={hud.cd.vs} k="Z" label="Vesper" locked={!hud.unlock.vesper}>🦊</Cd>
          <Cd cd={hud.ultReady ? 0 : 1 - hud.en / 100} k="R" label="Astral" ready={hud.ultReady && hud.unlock.ult} locked={!hud.unlock.ult} size={60}>☄️</Cd>
          <Cd cd={0} k="B" label={`Core ×${hud.cores}`} ready={hud.cores > 0 && hud.coreT <= 0}>🔥</Cd>
          <Cd cd={hud.cd.sense} k="G" label="Sense" locked={!hud.unlock.sense}>👁️</Cd>
          <Cd cd={0} k="V" label="Mount" locked={!hud.unlock.mount} ready={hud.mounted}>🐾</Cd>
        </div>
      )}
      {!touch && hud.screen === "play" && !hud.locked && !hud.cine && !hud.dialogue && (
        <div className="absolute left-1/2 -translate-x-1/2 top-[38%] text-center text-sm px-4 py-2 rounded bg-black/60 pointer-events-none">Click the game to capture the mouse · arrow keys also rotate the camera</div>
      )}
      <div className="absolute left-3 bottom-2 text-[10px] opacity-50">{hud.fps} fps</div>
      {/* fade */}
      <div className="absolute inset-0 bg-black" style={{ opacity: hud.fade, transition: "opacity .1s" }} />
      {touch && showCtrl && <Touch hud={hud} game={game} />}
    </div>
  );
}

/* ---------- touch controls ---------- */
function TBtn({ act, size, style, children, cd = 0, ready, label }: { act: Act; size: number; style: CSSProperties; children: ReactNode; cd?: number; ready?: boolean; label?: string }) {
  return (
    <div
      className="absolute pointer-events-auto flex items-center justify-center rounded-full"
      style={{ width: size, height: size, background: "rgba(12,10,26,.55)", border: "2px solid " + (ready ? "#ffd98a" : "rgba(255,214,140,.55)"), touchAction: "none", boxShadow: ready ? "0 0 16px #ffb04a" : undefined, ...style }}
      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); input.set(act, true); navigator.vibrate?.(6); }}
      onPointerUp={(e) => { e.stopPropagation(); input.set(act, false); }}
      onPointerCancel={() => input.set(act, false)}
      onLostPointerCapture={() => input.set(act, false)}
    >
      <span style={{ fontSize: size * 0.42 }}>{children}</span>
      {cd > 0 && <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(rgba(0,0,0,.7) ${cd * 360}deg, transparent 0)` }} />}
      {label && <span className="absolute -bottom-3 text-[9px] font-bold opacity-80">{label}</span>}
    </div>
  );
}

function Touch({ hud, game }: { hud: Hud; game: Game }) {
  const stickEl = useRef<HTMLDivElement>(null);
  const knobEl = useRef<HTMLDivElement>(null);
  const st = useRef<{ id: number; ox: number; oy: number } | null>(null);
  const lk = useRef<{ id: number; x: number; y: number } | null>(null);
  const R = 56;
  const moveStick = (cx: number, cy: number) => {
    const s = st.current; if (!s) return;
    let dx = cx - s.ox, dy = cy - s.oy; const l = Math.hypot(dx, dy);
    if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
    input.stick.x = dx / R; input.stick.y = -dy / R;
    if (knobEl.current) knobEl.current.style.transform = `translate(${dx}px,${dy}px)`;
    input.set("sprint", l > R * 1.08);
  };
  return (
    <div className="absolute inset-0" style={{ touchAction: "none" }}>
      <div className="absolute left-0 bottom-0 pointer-events-auto" style={{ width: "42%", height: "62%", touchAction: "none" }}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); st.current = { id: e.pointerId, ox: e.clientX, oy: e.clientY }; if (stickEl.current) { stickEl.current.style.left = e.clientX - 64 + "px"; stickEl.current.style.top = e.clientY - 64 + "px"; stickEl.current.style.opacity = "1"; } moveStick(e.clientX, e.clientY); }}
        onPointerMove={(e) => { if (st.current && st.current.id === e.pointerId) moveStick(e.clientX, e.clientY); }}
        onPointerUp={(e) => { if (st.current?.id === e.pointerId) { st.current = null; input.stick.x = 0; input.stick.y = 0; input.set("sprint", false); if (stickEl.current) stickEl.current.style.opacity = "0.35"; if (knobEl.current) knobEl.current.style.transform = ""; } }}
        onPointerCancel={() => { st.current = null; input.stick.x = 0; input.stick.y = 0; }} />
      <div ref={stickEl} className="absolute pointer-events-none rounded-full" style={{ left: 28, bottom: 28, top: "auto", width: 128, height: 128, border: "2px solid rgba(255,214,140,.5)", background: "rgba(12,10,26,.3)", opacity: 0.35 }}>
        <div ref={knobEl} className="absolute rounded-full" style={{ left: 40, top: 40, width: 48, height: 48, background: "rgba(255,214,140,.55)", border: "2px solid #fff3d0" }} />
      </div>
      {/* look zone */}
      <div className="absolute right-0 top-0 pointer-events-auto" style={{ width: "58%", height: "100%", touchAction: "none" }}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); lk.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; }}
        onPointerMove={(e) => { const l = lk.current; if (l && l.id === e.pointerId) { input.look.x += (e.clientX - l.x) * 1.7; input.look.y += (e.clientY - l.y) * 1.7; l.x = e.clientX; l.y = e.clientY; } }}
        onPointerUp={(e) => { if (lk.current?.id === e.pointerId) lk.current = null; }}
        onPointerCancel={() => { lk.current = null; }} />
      <TBtn act="attack" size={86} style={{ right: 18, bottom: 22, borderColor: "#ffb066", background: "rgba(90,30,10,.55)" }}>⚔️</TBtn>
      <TBtn act="jump" size={62} style={{ right: 118, bottom: 18 }} label="JUMP">⤴</TBtn>
      <TBtn act="dodge" size={58} style={{ right: 128, bottom: 90 }} label="DODGE">💨</TBtn>
      <TBtn act="heavy" size={54} style={{ right: 20, bottom: 118 }} label="HEAVY">🔨</TBtn>
      <TBtn act="skill1" size={54} style={{ right: 198, bottom: 28 }} cd={hud.cd.s1}>🌪️</TBtn>
      <TBtn act="skill2" size={50} style={{ right: 200, bottom: 100 }} cd={hud.cd.s2}>🔮</TBtn>
      <TBtn act="vesper" size={50} style={{ right: 84, bottom: 156 }} cd={hud.cd.vs}>🦊</TBtn>
      <TBtn act="ult" size={58} style={{ right: 18, bottom: 184 }} ready={hud.ultReady && hud.unlock.ult} cd={hud.ultReady ? 0 : 1 - hud.en / 100}>☄️</TBtn>
      <div className="absolute left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none" style={{ bottom: 8 }}>
        {([["block", "🛡️"], ["core", "🔥"], ["mount", "🐾"], ["sense", "👁️"], ["lock", "🎯"]] as [Act, string][]).map(([a, ic]) => (
          <div key={a} className="pointer-events-auto flex items-center justify-center rounded-full" style={{ position: "relative", width: 44, height: 44, background: "rgba(12,10,26,.55)", border: "2px solid rgba(255,214,140,.45)", fontSize: 20, touchAction: "none" }}
            onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); input.set(a, true); }}
            onPointerUp={() => input.set(a, false)} onPointerCancel={() => input.set(a, false)}>{ic}</div>
        ))}
      </div>
      <div className="absolute flex gap-2 pointer-events-none" style={{ left: "50%", top: 40, transform: "translateX(-50%)" }}>
        <div className="pointer-events-auto rounded-full flex items-center justify-center" style={{ width: 38, height: 38, background: "rgba(12,10,26,.6)", border: "1.5px solid rgba(255,214,140,.4)" }} onPointerDown={() => game.openMenu()}>🗺️</div>
        <div className="pointer-events-auto rounded-full flex items-center justify-center" style={{ width: 38, height: 38, background: "rgba(12,10,26,.6)", border: "1.5px solid rgba(255,214,140,.4)" }} onPointerDown={() => game.pause()}>⏸</div>
      </div>
    </div>
  );
}
