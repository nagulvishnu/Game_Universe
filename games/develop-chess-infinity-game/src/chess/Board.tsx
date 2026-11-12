import { useRef, useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { PieceSvg } from "./pieces";
import { themeById } from "./themes";
import { FILES } from "./rules";
import type { Color, TPiece, PType } from "./rules";
import "./board.css";

export interface Arrow { from: string; to: string; color?: string }
export interface BoardFx { key: string; square: string; kind: "capture" | "check" | "promote" }

export interface BoardProps {
  pieces: TPiece[];
  orientation: Color;
  theme: string;
  pieceStyle: string;
  showCoords?: boolean;
  animations?: boolean;
  lastMove?: { from: string; to: string } | null;
  checkSquare?: string | null;
  mateSquare?: string | null;
  selected?: string | null;
  targets?: Record<string, boolean>;
  interactiveColor?: Color | null;
  hint?: { from: string; to?: string } | null;
  hideColor?: Color | null;
  arrows?: Arrow[];
  arrowsEnabled?: boolean;
  fx?: BoardFx | null;
  promotion?: { to: string; color: Color } | null;
  onSelect?: (sq: string | null) => void;
  onMove?: (from: string, to: string) => void;
  onPromote?: (p: PType) => void;
  onCancelPromotion?: () => void;
  showLegal?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const toXY = (sq: string, o: Color) => {
  const f = FILES.indexOf(sq[0]); const r = parseInt(sq[1]) - 1;
  return o === "w" ? { x: f, y: 7 - r } : { x: 7 - f, y: r };
};

export function Board(p: BoardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const theme = themeById(p.theme);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const dragRef = useRef<{ id: string; from: string; was: boolean; moved: boolean; sx: number; sy: number } | null>(null);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [marks, setMarks] = useState<string[]>([]);
  const rightStart = useRef<string | null>(null);
  const o = p.orientation;

  useEffect(() => { setArrows([]); setMarks([]); }, [p.lastMove?.from, p.lastMove?.to, p.pieces.length]);

  const squareAt = (cx: number, cy: number): string | null => {
    const el = ref.current; if (!el) return null;
    const r = el.getBoundingClientRect();
    const col = Math.floor(((cx - r.left) / r.width) * 8); const row = Math.floor(((cy - r.top) / r.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    const f = o === "w" ? col : 7 - col; const rk = o === "w" ? 7 - row : row;
    return FILES[f] + (rk + 1);
  };
  const bySq = new Map(p.pieces.map((x) => [x.square, x]));

  const down = (e: React.PointerEvent) => {
    const sq = squareAt(e.clientX, e.clientY); if (!sq) return;
    if (e.button === 2) { if (p.arrowsEnabled !== false) rightStart.current = sq; return; }
    if (e.button !== 0) return;
    setArrows([]); setMarks([]);
    if (p.selected && p.targets && p.targets[sq] !== undefined) { p.onMove?.(p.selected, sq); return; }
    const piece = bySq.get(sq);
    if (piece && p.interactiveColor === piece.color) {
      p.onSelect?.(sq);
      const rect = ref.current!.getBoundingClientRect();
      dragRef.current = { id: piece.id, from: sq, was: p.selected === sq, moved: false, sx: e.clientX, sy: e.clientY };
      setDrag({ id: piece.id, x: e.clientX - rect.left, y: e.clientY - rect.top });
      try { ref.current!.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    } else p.onSelect?.(null);
  };
  const move = (e: React.PointerEvent) => {
    const d = dragRef.current; if (!d) return;
    const rect = ref.current!.getBoundingClientRect();
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 5) d.moved = true;
    setDrag({ id: d.id, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  const up = (e: React.PointerEvent) => {
    if (e.button === 2 && rightStart.current) {
      const from = rightStart.current; rightStart.current = null;
      const to = squareAt(e.clientX, e.clientY); if (!to) return;
      if (to === from) setMarks((m) => (m.includes(to) ? m.filter((x) => x !== to) : [...m, to]));
      else setArrows((a) => (a.some((x) => x.from === from && x.to === to) ? a.filter((x) => !(x.from === from && x.to === to)) : [...a, { from, to }]));
      return;
    }
    const d = dragRef.current; if (!d) return;
    dragRef.current = null; setDrag(null);
    const to = squareAt(e.clientX, e.clientY);
    if (!to || to === d.from) { if (d.was && !d.moved) p.onSelect?.(null); return; }
    if (p.targets && p.targets[to] !== undefined) p.onMove?.(d.from, to);
  };

  const squares = [];
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    const f = o === "w" ? col : 7 - col; const rk = o === "w" ? 7 - row : row;
    const sq = FILES[f] + (rk + 1); const dark = (f + rk) % 2 === 0;
    const isTarget = p.showLegal !== false && p.targets && p.targets[sq] !== undefined;
    const cls = ["ci-sq"];
    if (p.lastMove && (p.lastMove.from === sq || p.lastMove.to === sq)) cls.push("last");
    if (p.selected === sq) cls.push("sel");
    if (p.checkSquare === sq) cls.push("check");
    if (p.mateSquare === sq) cls.push("mated");
    if (p.hint && (p.hint.from === sq || p.hint.to === sq)) cls.push("hint");
    if (marks.includes(sq)) cls.push("marked");
    squares.push(
      <div key={sq} className={cls.join(" ")} data-sq={sq} style={{ background: dark ? theme.darkBg ?? theme.dark : theme.lightBg ?? theme.light }}>
        {isTarget && (p.targets![sq] ? <i className="ci-ring" /> : <i className="ci-dot" />)}
        {p.showCoords !== false && col === 0 && <b className="ci-rank" style={{ color: dark ? theme.coordDark : theme.coordLight }}>{rk + 1}</b>}
        {p.showCoords !== false && row === 7 && <b className="ci-file" style={{ color: dark ? theme.coordDark : theme.coordLight }}>{FILES[f]}</b>}
      </div>,
    );
  }

  const sorted = [...p.pieces].sort((a, b) => (a.id < b.id ? -1 : 1));
  const bw = ref.current?.clientWidth ?? 0;
  const ctr = (sq: string) => { const { x, y } = toXY(sq, o); return { x: x * 10 + 5, y: y * 10 + 5 }; };
  const allArrows: Arrow[] = [...(p.arrows ?? []), ...arrows];

  let promoEl = null;
  if (p.promotion) {
    const { x, y } = toXY(p.promotion.to, o);
    const top = y === 0 ? 0 : 4;
    const order: PType[] = ["q", "n", "r", "b"];
    promoEl = (
      <>
        <div className="ci-promo-backdrop" onPointerDown={(e) => { e.stopPropagation(); p.onCancelPromotion?.(); }} />
        <div className="ci-promo" style={{ left: `${x * 12.5}%`, top: `${top * 12.5}%` }} onPointerDown={(e) => e.stopPropagation()}>
          {(y === 0 ? order : [...order].reverse()).map((t) => (
            <button key={t} aria-label={`Promote to ${t}`} data-promo={t} onClick={() => p.onPromote?.(t)}>
              <PieceSvg type={t} color={p.promotion!.color} styleId={p.pieceStyle} />
            </button>
          ))}
        </div>
      </>
    );
  }

  const style = { "--frame": theme.frame, "--bacc": theme.accent, "--bacc2": theme.accent2, "--last": theme.lastMove, "--selc": theme.select } as CSSProperties;
  return (
    <div className={`ci-board-frame ${theme.fx} ${p.mateSquare ? "mate-glow" : ""} ${p.className ?? ""}`} style={style}>
      <div
        ref={ref}
        className="ci-board"
        data-testid="board"
        onPointerDown={down} onPointerMove={move} onPointerUp={up}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="ci-grid">{squares}</div>
        <div className="ci-pieces">
          {sorted.map((pc) => {
            if (p.hideColor && pc.color === p.hideColor) return null;
            const { x, y } = toXY(pc.square, o);
            const dragging = drag?.id === pc.id;
            const t = dragging ? `translate(${drag!.x - bw / 16}px, ${drag!.y - bw / 16}px) scale(1.12)` : `translate(${x * 100}%, ${y * 100}%)`;
            return (
              <div key={pc.id} data-sq={pc.square} data-piece={pc.color + pc.type}
                className={`ci-piece ${dragging ? "dragging" : ""} ${p.animations === false ? "noanim" : ""}`}
                style={{ transform: t }}>
                <span key={pc.type} className="ci-piece-inner"><PieceSvg type={pc.type} color={pc.color} styleId={p.pieceStyle} /></span>
              </div>
            );
          })}
        </div>
        {p.fx && (() => { const { x, y } = toXY(p.fx.square, o); return <div key={p.fx.key} className={`ci-fx ${p.fx.kind}`} style={{ left: `${x * 12.5}%`, top: `${y * 12.5}%` }} />; })()}
        <svg className="ci-arrows" viewBox="0 0 80 80">
          <defs><marker id="arh" markerWidth="4" markerHeight="4" refX="2.2" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 z" fill="context-stroke" /></marker></defs>
          {allArrows.map((a, i) => {
            const s = ctr(a.from); const e = ctr(a.to);
            const dx = e.x - s.x, dy = e.y - s.y; const len = Math.hypot(dx, dy) || 1;
            const ex = e.x - (dx / len) * 3.6, ey = e.y - (dy / len) * 3.6;
            return <line key={i} x1={s.x} y1={s.y} x2={ex} y2={ey} stroke={a.color ?? "rgba(255,170,0,.85)"} strokeWidth="1.8" strokeLinecap="round" markerEnd="url(#arh)" />;
          })}
        </svg>
        {promoEl}
        {p.children}
      </div>
    </div>
  );
}
