"use client";

import { useEffect, useRef } from "react";
import { useUI } from "@/components/providers/UIProvider";
import { SettingsPanel } from "./SettingsPanel";

export function SettingsDrawer() {
  const { settingsOpen, setSettingsOpen } = useUI();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!settingsOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [settingsOpen, setSettingsOpen]);

  if (!settingsOpen) return null;
  return (
    <>
      <div className="gu-backdrop" onClick={() => setSettingsOpen(false)} aria-hidden />
      <aside role="dialog" aria-modal="true" aria-labelledby="settings-title" className="gu-details px-7 py-8">
        <p className="gu-kicker">Control center</p>
        <h2 id="settings-title" className="gu-title mt-2 text-3xl">
          Settings
        </h2>
        <div className="mt-4">
          <SettingsPanel />
        </div>
        <div className="mt-auto pt-6">
          <button ref={closeRef} type="button" className="gu-btn" onClick={() => setSettingsOpen(false)}>
            Close
          </button>
        </div>
      </aside>
    </>
  );
}
