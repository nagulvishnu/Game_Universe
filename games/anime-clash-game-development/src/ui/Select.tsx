import { useEffect, useReducer, useRef } from "react";
import { useApp } from "../game/store";
import { input } from "../game/input";
import { audio } from "../game/audio";
import { ARENAS, FIGHTERS, PLAYER_COLORS, keyLabel } from "../game/data";
import { getArt } from "../game/showcase";
import { Btn, ShowCanvas, StatBar, elIcon } from "./ui";

export default function Select() {
  const { go, mode, p1, p2, arena, setChars, setArena, startVersus, tourney } = useApp();
  const st = useRef({ sel: [p1, p2] as [number, number], ready: [false, false] as [boolean, boolean], phase: "chars" as "chars" | "arena", arena, go: 0, pending: 0 });
  const [, force] = useReducer((x: number) => x + 1, 0);
  const S = st.current;
  const forced = mode === "tournament";
  const forcedArena = tourney.match % ARENAS.length;

  const launch = () => {
    if (S.go) return;
    S.go = 1;
    setChars(S.sel[0], S.sel[1]);
    setArena(forced ? forcedArena : S.arena);
    audio.play("go");
    setTimeout(() => startVersus(), 150);
  };

  useEffect(() => {
    let raf = 0;
    const act = (p: 0 | 1, inp: ReturnType<typeof input.poll>) => {
      const pr = inp.pressed;
      if (S.phase === "chars") {
        if (!S.ready[p]) {
          if (pr.left) { S.sel[p] = (S.sel[p] + 3) % 4; audio.play("ui_move"); force(); }
          if (pr.right) { S.sel[p] = (S.sel[p] + 1) % 4; audio.play("ui_move"); force(); }
          if (pr.light || pr.heavy || pr.jump) { S.ready[p] = true; audio.play("ready"); force(); }
          else if (pr.block && p === 0 && !S.ready[1]) { audio.play("ui_back"); go("menu"); }
        } else if (pr.block) { S.ready[p] = false; audio.play("ui_back"); force(); }
        if (S.ready[0] && S.ready[1] && !S.pending) {
          S.pending = 1;
          if (forced) setTimeout(launch, 500);
          else setTimeout(() => { S.phase = "arena"; S.pending = 0; force(); }, 450);
        }
      } else {
        if (pr.left) { S.arena = (S.arena + 2) % 3; audio.play("ui_move"); force(); }
        if (pr.right) { S.arena = (S.arena + 1) % 3; audio.play("ui_move"); force(); }
        if (pr.light || pr.heavy || pr.jump) launch();
        if (pr.block) { S.phase = "chars"; S.pending = 0; S.ready = [false, false]; audio.play("ui_back"); force(); }
      }
    };
    const loop = () => {
      const a = input.poll(0), b = input.poll(1);
      input.endFrame();
      act(0, a); act(1, b);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const click = (i: number) => {
    if (S.phase !== "chars") return;
    const p = !S.ready[0] ? 0 : !S.ready[1] ? 1 : null;
    if (p === null) return;
    S.sel[p] = i; S.ready[p] = true; audio.play("ready"); force();
  };

  const side = (p: 0 | 1) => {
    const f = FIGHTERS[S.sel[p]];
    return (
      <div className={`absolute top-0 bottom-0 w-[31%] ${p === 0 ? "left-0" : "right-0"}`}>
        <div className="absolute inset-0 opacity-95"><ShowCanvas chars={[S.sel[p]]} pose="idle" camZ={5.6} camY={1.35} lookY={1.0} yaw={[p === 0 ? 0.55 : -0.55]} orbit /></div>
        <div className={`absolute top-6 ${p === 0 ? "left-6" : "right-6"} font-display text-5xl`} style={{ color: PLAYER_COLORS[p], textShadow: `0 0 20px ${PLAYER_COLORS[p]}` }}>PLAYER {p + 1}</div>
        <div className={`absolute bottom-6 ${p === 0 ? "left-6 slidel" : "right-6 slider"} w-[88%] panel p-4`} key={S.sel[p]}>
          <div className="text-xs tracking-[.5em]" style={{ color: f.color }}>{elIcon[f.element]} {f.element.toUpperCase()}</div>
          <div className="font-display text-6xl leading-none">{f.name}</div>
          <div className="font-display text-xl text-white/60 mb-2">{f.title}</div>
          <div className="space-y-1">
            <StatBar label="Power" v={f.stats.power} color={f.color} /><StatBar label="Speed" v={f.stats.speed} color={f.color} />
            <StatBar label="Range" v={f.stats.range} color={f.color} /><StatBar label="Defense" v={f.stats.defense} color={f.color} />
          </div>
          <div className="flex gap-1.5 mt-2 text-[11px] text-white/70 flex-wrap">{f.abilities.map((a) => <span key={a.key} className="bg-white/10 px-1.5 py-0.5">{a.name}</span>)}</div>
          <div className={`mt-2 text-center font-display text-3xl tracking-widest ${S.ready[p] ? "text-green-300 pulse" : "text-white/40"}`}>{S.ready[p] ? "✔ READY" : `◀ ${keyLabel(input.bindings[p].left)} / ${keyLabel(input.bindings[p].right)} ▶ · ${keyLabel(input.bindings[p].light)} TO LOCK`}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="absolute inset-0 bg-arena overflow-hidden">
      <div className="speedlines" />
      {side(0)}{side(1)}
      <div className="absolute left-[31%] right-[31%] top-0 bottom-0 flex flex-col items-center justify-center px-4">
        <div className="font-display text-5xl mb-1 fadein text-center">{S.phase === "chars" ? "SELECT YOUR FIGHTER" : "SELECT ARENA"}</div>
        <div className="tracking-[.4em] text-xs text-white/50 mb-4 text-center">
          {mode === "tournament" ? `TOURNAMENT · MATCH ${Math.min(3, tourney.match + 1)} OF 3 · ${PLAYER_COLORS.length ? `P1 ${tourney.wins[0]} — ${tourney.wins[1]} P2` : ""}` : mode === "practice" ? "TRAINING MODE" : "VERSUS MODE"}
        </div>
        {S.phase === "chars" ? (
          <div className="grid grid-cols-2 gap-3 w-full max-w-[34rem]">
            {FIGHTERS.map((f, i) => {
              const is1 = S.sel[0] === i, is2 = S.sel[1] === i;
              return (
                <button key={f.id} className="card aspect-[4/3.3] fadein" style={{ boxShadow: is1 || is2 ? `0 0 0 3px ${is1 && !is2 ? PLAYER_COLORS[0] : is2 && !is1 ? PLAYER_COLORS[1] : "#fff"}` : undefined, borderBottom: `6px solid ${f.color}`, animationDelay: `${i * 0.07}s` }}
                  onMouseEnter={() => audio.play("ui_move", 0.4)} onClick={() => click(i)}>
                  <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 30%, ${f.color}66, #0b0720 70%)` }} />
                  <img src={getArt(i, "bust")} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent text-left">
                    <div className="font-display text-3xl leading-none">{f.name}</div><div className="text-[10px] tracking-widest text-white/60">{f.title}</div>
                  </div>
                  <div className="absolute top-1 left-1 flex gap-1">
                    {is1 && <span className="px-2 font-display text-xl" style={{ background: PLAYER_COLORS[0] }}>P1{S.ready[0] ? " ✔" : ""}</span>}
                    {is2 && <span className="px-2 font-display text-xl" style={{ background: PLAYER_COLORS[1] }}>P2{S.ready[1] ? " ✔" : ""}</span>}
                  </div>
                  <div className="absolute top-1 right-2 text-2xl">{elIcon[f.element]}</div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="w-full max-w-[34rem] flex flex-col gap-3">
            {ARENAS.map((a, i) => (
              <button key={a.id} className="card h-24 text-left px-5 flex items-center justify-between fadein" style={{ background: `linear-gradient(100deg, ${a.colorA}, ${a.colorB})`, outline: S.arena === i ? "4px solid #fff" : "none", opacity: S.arena === i ? 1 : 0.55, animationDelay: `${i * 0.08}s` }}
                onMouseEnter={() => { S.arena = i; audio.play("ui_move", 0.4); force(); }} onClick={() => { S.arena = i; launch(); }}>
                <div><div className="font-display text-4xl drop-shadow-lg">{a.name}</div><div className="text-sm text-white/90">{a.desc}</div></div>
                <div className="font-display text-2xl opacity-80">{a.sub.toUpperCase()}</div>
              </button>
            ))}
            <div className="flex gap-3 justify-center mt-2"><Btn small onClick={() => { S.phase = "chars"; S.pending = 0; S.ready = [false, false]; force(); }} sound="ui_back">← BACK</Btn><Btn small on onClick={launch}>START ▶</Btn></div>
          </div>
        )}
        {S.phase === "chars" && forced && <div className="mt-3 text-yellow-300 tracking-widest text-sm">ARENA: {ARENAS[forcedArena].name}</div>}
        {S.phase === "chars" && <div className="mt-4"><Btn small onClick={() => go(mode === "practice" ? "menu" : "modes")} sound="ui_back">← BACK</Btn></div>}
      </div>
    </div>
  );
}
