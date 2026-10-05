"use client";

import { useSettings } from "@/components/providers/SettingsProvider";
import type { Settings } from "@/components/providers/SettingsProvider";
import { useFullscreen } from "@/utils/hooks";

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-dashed border-[rgba(130,165,255,0.2)] py-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-display text-[0.78rem] tracking-[0.2em] uppercase">{label}</p>
        {hint && <p className="mt-1 max-w-sm text-[0.95rem] text-dim">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="gu-chip"
      style={{ minWidth: 92 }}
      data-testid={`switch-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {on ? "● ON" : "○ OFF"}
    </button>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" className="gu-chip" aria-pressed={value === o} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

export function SettingsPanel() {
  const { settings, update, setAudio, reset, detectedQuality, quality, reducedMotion } = useSettings();
  const { supported: fsSupported, active: fullscreen } = useFullscreen();

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  };

  return (
    <div data-testid="settings-panel">
      <Row label="Audio" hint="Ambient universe sound and UI effects. Never starts without your interaction.">
        <Switch on={settings.audio} onChange={setAudio} label="Audio" />
      </Row>
      <Row
        label="Motion"
        hint={`Auto follows your system preference. Currently: ${reducedMotion ? "reduced" : "full"} motion.`}
      >
        <Segmented
          label="Motion"
          value={settings.motion}
          options={["auto", "full", "reduced"] as const}
          onChange={(motion: Settings["motion"]) => update({ motion })}
        />
      </Row>
      <Row
        label="Graphics quality"
        hint={`Auto picked ${detectedQuality.toUpperCase()} for this device. Active: ${quality.toUpperCase()}.`}
      >
        <Segmented
          label="Graphics quality"
          value={settings.quality}
          options={["auto", "high", "medium", "low"] as const}
          onChange={(q: Settings["quality"]) => update({ quality: q })}
        />
      </Row>
      <Row label="Particles" hint="Dust, energy pulses and dense starfield in the 3D universe.">
        <Switch on={settings.particles} onChange={(particles) => update({ particles })} label="Particles" />
      </Row>
      <Row label="Fullscreen" hint="Fill the whole screen for a more immersive experience.">
        <button type="button" className="gu-btn gu-btn--sm" onClick={toggleFullscreen} disabled={!fsSupported}>
          {fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        </button>
      </Row>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-5">
        <p className="max-w-sm text-[0.9rem] text-dim">
          Preferences are stored in this browser under <code className="text-ink">gu-*</code> keys only. Game save data is never touched.
        </p>
        <button type="button" className="gu-btn gu-btn--sm" onClick={reset}>
          Reset
        </button>
      </div>
    </div>
  );
}
