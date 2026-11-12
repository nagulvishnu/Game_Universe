import type { ReactNode } from "react";
import { Board } from "../chess/Board";
import type { Arrow } from "../chess/Board";
import { BOARD_THEMES } from "../chess/themes";
import { PIECE_STYLES, PieceSvg } from "../chess/pieces";
import { useStore } from "../chess/store";
import type { FreeBoard } from "../chess/useFreeBoard";
import type { Color } from "../chess/rules";

export function Modal({ children, onClose, wide }: { children: ReactNode; onClose?: () => void; wide?: boolean }) {
  return (
    <div className="ci-modal-bg" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`ci-modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true">{children}</div>
    </div>
  );
}

export function Confirm({ title, text, confirm, cancel = "Cancel", danger, onConfirm, onCancel }: { title: string; text: ReactNode; confirm: string; cancel?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal onClose={onCancel}>
      <h2 className="ci-serif">{title}</h2>
      <p className="ci-muted" style={{ lineHeight: 1.5 }}>{text}</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
        <button className="ci-btn" onClick={onCancel}>{cancel}</button>
        <button className={`ci-btn ${danger ? "danger" : "primary"}`} onClick={onConfirm} autoFocus>{confirm}</button>
      </div>
    </Modal>
  );
}

export function Switch({ label, desc, on, onChange }: { label: string; desc?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="ci-toggle" role="switch" aria-checked={on} tabIndex={0} onClick={() => onChange(!on)} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onChange(!on); } }}>
      <span>{label}{desc && <small className="ci-muted" style={{ display: "block", fontWeight: 500 }}>{desc}</small>}</span>
      <span className={`ci-switch ${on ? "on" : ""}`} />
    </div>
  );
}

export function TopBar({ title, onBack, right }: { title: ReactNode; onBack: () => void; right?: ReactNode }) {
  return (
    <div className="ci-topbar">
      <button className="ci-btn icon" onClick={onBack} aria-label="Back">←</button>
      <h1 className="ci-serif">{title}</h1>
      {right}
    </div>
  );
}

export function ThemePicker() {
  const s = useStore((st) => st.settings); const upd = useStore((st) => st.updateSettings);
  return (
    <div className="ci-picks">
      {BOARD_THEMES.map((t) => (
        <button key={t.id} className={`ci-pick ${s.boardTheme === t.id ? "on" : ""}`} onClick={() => upd({ boardTheme: t.id, pieceStyle: t.pieces })} aria-pressed={s.boardTheme === t.id}>
          <div className="ci-mini" style={{ boxShadow: `0 0 0 3px ${t.frame}` }}>
            {Array.from({ length: 8 }, (_, i) => {
              const dark = (i + (i > 3 ? 1 : 0)) % 2 === 0;
              return <div key={i} style={{ background: dark ? t.darkBg ?? t.dark : t.lightBg ?? t.light }}>
                {i === 1 && <PieceSvg type="n" color="w" styleId={t.pieces} />}
                {i === 6 && <PieceSvg type="q" color="b" styleId={t.pieces} />}
              </div>;
            })}
          </div>
          <b>{t.name}</b><span>{t.blurb}</span>
        </button>
      ))}
    </div>
  );
}

export function PiecePicker() {
  const s = useStore((st) => st.settings); const upd = useStore((st) => st.updateSettings);
  return (
    <div className="ci-picks">
      {PIECE_STYLES.map((ps) => (
        <button key={ps.id} className={`ci-pick ${s.pieceStyle === ps.id ? "on" : ""}`} onClick={() => upd({ pieceStyle: ps.id })} aria-pressed={s.pieceStyle === ps.id}>
          {(["w", "b"] as const).map((c) => (
            <div key={c} className={`ci-pieces-row ${c === "w" ? "" : "dk"}`} style={{ marginBottom: 4 }}>
              {(["k", "q", "r", "b", "n", "p"] as const).map((t) => <PieceSvg key={t} type={t} color={c} styleId={ps.id} />)}
            </div>
          ))}
          <b>{ps.name}</b><span>{ps.blurb}</span>
        </button>
      ))}
    </div>
  );
}

/** Board bound to a useFreeBoard() instance and the user's saved board settings. */
export function FreeBoardView({ fb, orientation, arrows, hideColor, children }: { fb: FreeBoard; orientation: Color; arrows?: Arrow[]; hideColor?: Color | null; children?: ReactNode }) {
  const s = useStore((st) => st.settings);
  return (
    <Board
      pieces={fb.pieces} orientation={orientation} theme={s.boardTheme} pieceStyle={s.pieceStyle} showCoords={s.coords} animations={s.animations}
      lastMove={s.highlightLast && fb.last ? { from: fb.last.from, to: fb.last.to } : null}
      checkSquare={fb.checkSquare} mateSquare={fb.mateSquare} selected={fb.selected} targets={fb.targets} interactiveColor={fb.interactiveColor}
      hint={fb.hint} fx={fb.fx} arrows={arrows} hideColor={hideColor} showLegal={s.legalMoves}
      promotion={fb.pending ? { to: fb.pending.to, color: fb.turn } : null}
      onSelect={fb.select} onMove={fb.tryMove} onPromote={fb.promote} onCancelPromotion={fb.cancelPromotion}
    >{children}</Board>
  );
}
