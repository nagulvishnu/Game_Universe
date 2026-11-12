import { useEffect, useRef, useState } from "react";
import type { Move } from "chess.js";
import { LESSONS } from "../chess/data";
import type { Lesson } from "../chess/data";
import { useFreeBoard } from "../chess/useFreeBoard";
import type { FreeBoard } from "../chess/useFreeBoard";
import { useStore } from "../chess/store";
import { FreeBoardView, TopBar } from "../components/ui";
import { START_FEN } from "../chess/rules";
import type { Color } from "../chess/rules";
import { sfx } from "../chess/audio";

function LessonRunner({ lesson, back }: { lesson: Lesson; back: () => void }) {
  const autoQueen = useStore((s) => s.settings.autoQueen);
  const complete = useStore((s) => s.completeLesson);
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState<{ t: string; k: "good" | "bad" } | null>(null);
  const fbRef = useRef<FreeBoard | null>(null);
  const step = lesson.steps[idx];
  const isInfo = !step.accept;

  const handle = (mv: Move) => {
    const fb = fbRef.current!; const st = lesson.steps[idxRef.current];
    const uci = mv.from + mv.to + (mv.promotion ?? "");
    const ok = st.accept === "mate" ? mv.san.endsWith("#") : !!(st.accept as string[]).includes(uci);
    if (ok) {
      sfx.success(); setMsg({ t: `✓ ${st.success ?? "Well done!"}`, k: "good" });
      if (st.reply) setTimeout(() => { fbRef.current?.play(st.reply!); setTimeout(() => setDone(true), 350); }, 550);
      else setDone(true);
    } else { sfx.error(); setMsg({ t: "Not quite — look at the instruction and try again.", k: "bad" }); setTimeout(() => fb.undo(), 650); }
  };
  const idxRef = useRef(0); idxRef.current = idx;
  const fb = useFreeBoard(lesson.steps[0].fen ?? START_FEN, { autoQueen, onUserMove: handle });
  fbRef.current = fb;

  useEffect(() => {
    setDone(false); setMsg(null);
    const f = fbRef.current!;
    if (step.fen) f.reset(step.fen, step.accept ? (step.fen.split(" ")[1] as Color) : null);
    else f.setPlayer(step.accept ? f.turn : null);
    f.setHint(null);
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  const hint = () => {
    let uci: string | undefined;
    if (step.accept === "mate") uci = fb.chess.moves({ verbose: true }).find((m) => m.san.endsWith("#"))?.lan;
    else uci = step.accept?.[0];
    if (uci) fb.setHint({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
  };
  const last = idx === lesson.steps.length - 1;
  const next = () => { if (last) { complete(lesson.id); back(); } else setIdx(idx + 1); };

  return (
    <div className="ci-two">
      <FreeBoardView fb={fb} orientation="w" />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="ci-glass ci-panel">
          <div className="ci-label">{lesson.title} · step {idx + 1}/{lesson.steps.length}</div>
          <div className="ci-bar" style={{ margin: "8px 0 12px" }}><i style={{ width: `${((idx + (done || isInfo ? 1 : 0)) / lesson.steps.length) * 100}%` }} /></div>
          <p style={{ margin: 0, lineHeight: 1.55, fontSize: "1.02rem" }} data-testid="lesson-text">{step.text}</p>
        </div>
        {msg && <div className={`ci-bubble ${msg.k}`} role="status">{msg.t}</div>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!isInfo && !done && <button className="ci-btn" onClick={hint}>💡 Show move</button>}
          {idx > 0 && <button className="ci-btn" onClick={() => setIdx(idx - 1)}>← Back</button>}
          {(isInfo || done) && <button className="ci-btn primary" onClick={next}>{last ? "Finish lesson ✓" : "Continue →"}</button>}
        </div>
      </div>
    </div>
  );
}

export function Training({ back }: { back: () => void }) {
  const done = useStore((s) => s.training.done);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  return (
    <div>
      <TopBar title={lesson ? lesson.title : "Training"} onBack={lesson ? () => setLesson(null) : back} right={<span className="ci-chip accent">{LESSONS.filter((l) => done[l.id]).length}/{LESSONS.length} complete</span>} />
      <div className="ci-page" style={{ maxWidth: 1000 }}>
        {lesson ? <LessonRunner key={lesson.id} lesson={lesson} back={() => setLesson(null)} /> : (
          <div style={{ display: "grid", gap: 10, maxWidth: 720, margin: "0 auto" }}>
            <p className="ci-muted">Learn by doing — each lesson sets up a position and guides you one move at a time.</p>
            {LESSONS.map((l, i) => (
              <button key={l.id} className={`ci-lesson ${done[l.id] ? "done" : ""}`} onClick={() => setLesson(l)}>
                <div className="ico">{done[l.id] ? "✓" : l.icon}</div>
                <div style={{ flex: 1 }}><b>{i + 1}. {l.title}</b><div className="ci-muted" style={{ fontSize: ".85rem" }}>{l.subtitle}</div></div>
                <span className="ci-chip">{l.steps.length} steps</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
