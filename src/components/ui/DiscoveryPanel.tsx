"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useGames } from "@/components/providers/GamesProvider";

/** Development diagnostics. Only rendered when the server passes a report (dev, or NEXT_PUBLIC_GU_DEBUG=1). */
export function DiscoveryPanel() {
  const { report } = useGames();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  if (!report || pathname.startsWith("/game/")) return null;
  const problems = report.diagnostics.filter((d) => d.level !== "ok").length;

  return (
    <div className="fixed bottom-3 left-3 z-[70] max-w-[min(420px,calc(100vw-1.5rem))] text-[0.95rem]">
      {open && (
        <div className="gu-panel mb-2 max-h-[50vh] overflow-y-auto p-4" role="region" aria-label="Discovery status" data-testid="discovery-panel">
          <p className="gu-kicker mb-3">Discovery status</p>
          <p className="mb-3">Games discovered: {report.games.length}</p>
          <ul className="space-y-2">
            {report.diagnostics.length === 0 && <li className="text-dim">No folders found in /games</li>}
            {report.diagnostics.map((d) => (
              <li key={d.folder}>
                <span
                  className={d.level === "ok" ? "text-[#4dffb0]" : d.level === "warning" ? "text-amber" : "text-danger"}
                  aria-label={d.level}
                >
                  {d.level === "ok" ? "✓" : d.level === "warning" ? "⚠" : "✗"}
                </span>{" "}
                {d.title ?? d.folder}
                {d.messages.map((m) => (
                  <p key={m} className="ml-5 text-dim">
                    {m}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}
      <button type="button" className="gu-chip" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Discovery · {report.games.length}
        {problems > 0 && <small style={{ color: "#ffb84d", opacity: 1 }}>⚠ {problems}</small>}
      </button>
    </div>
  );
}
