"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Page transition (blur + fade). Skipped for the game launcher, which is fixed-position full-screen. */
export default function Template({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/game/")) return <>{children}</>;
  return <div className="page-enter">{children}</div>;
}
