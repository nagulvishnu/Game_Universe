"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSettings } from "@/components/providers/SettingsProvider";
import { HUB_KEYS, writeHub } from "@/utils/storage";
import { useHubJSON } from "@/utils/hooks";

const parseSeen = (raw: string | null) => raw === "true";

/** First-visit cinematic intro. Returning visitors skip it automatically (see inline script in layout). */
export function Intro() {
  const { sfx } = useSettings();
  const seen = useHubJSON(HUB_KEYS.introSeen, parseSeen, false);
  const [dismissed, setDismissed] = useState(false);
  const [expired, setExpired] = useState(false);
  const enterRef = useRef<HTMLButtonElement>(null);
  const visible = !seen && !expired;

  useEffect(() => {
    if (!seen) enterRef.current?.focus();
  }, [seen]);

  const finish = useCallback(() => {
    if (!visible || dismissed) return;
    writeHub(HUB_KEYS.introSeen, true);
    document.documentElement.dataset.intro = "seen";
    sfx("open");
    setDismissed(true);
    setTimeout(() => setExpired(true), 850);
  }, [visible, dismissed, sfx]);

  useEffect(() => {
    if (!visible || dismissed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, dismissed, finish]);

  if (!visible) return null;

  return (
    <div
      className="gu-intro"
      data-leaving={dismissed}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Nagul's Game Universe"
      data-testid="intro"
    >
      <button type="button" className="gu-chip absolute right-5 top-5" onClick={finish}>
        Skip intro
      </button>
      <div className="px-6">
        <p className="gu-kicker gu-intro-line" style={{ animationDelay: "0.2s", letterSpacing: "0.6em" }}>
          Nagul&apos;s
        </p>
        <p
          className="gu-title gu-glow-text gu-intro-line mt-5 text-[clamp(2.4rem,9vw,7rem)]"
          style={{ animationDelay: "0.7s" }}
        >
          <span className="gu-gradient-text">Game</span>
          <br />
          Universe
        </p>
        <div className="gu-intro-line mt-12" style={{ animationDelay: "1.5s" }}>
          <button ref={enterRef} type="button" className="gu-btn gu-btn--primary px-10 py-4 text-[0.8rem]" onClick={finish}>
            Enter the world
          </button>
        </div>
      </div>
    </div>
  );
}