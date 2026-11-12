"use client";

import type { PickPhase } from "./HolographicUniverse";

export interface RandomPickButtonProps {
  phase: PickPhase;
  disabled: boolean;
  onClick: () => void;
  onReset: () => void;
}

const LABEL: Record<PickPhase, string> = {
  idle: "Random pick",
  spinning: "Scanning…",
  revealing: "Destiny chosen",
};

/**
 * The RANDOM PICK trigger. It locks while the cinematic runs and turns into a
 * reset control once a world has been chosen.
 */
export function RandomPickButton({ phase, disabled, onClick, onReset }: RandomPickButtonProps) {
  const busy = phase !== "idle";

  return (
    <div className="gu-pick">
      <button
        type="button"
        className="gu-pick__btn"
        data-testid="random-pick"
        data-phase={phase}
        disabled={disabled || phase === "spinning"}
        onClick={busy && phase === "revealing" ? onReset : onClick}
        aria-live="polite"
      >
        <span className="gu-pick__ring" aria-hidden />
        <span className="gu-pick__label">{LABEL[phase]}</span>
      </button>
    </div>
  );
}
