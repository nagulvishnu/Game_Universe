import type { NextConfig } from "next";
import { runDiscovery } from "./src/games/discovery/run";

// Game discovery runs automatically on `next dev` / `next build` only.
// It MUST NOT run on `next start` (preview/prod serve): public/play/* is
// already baked at build time, and re-running discovery there would wipe it
// if /games is not shipped, or race with concurrent config loads.
const PHASE = process.env.NEXT_PHASE as string | undefined;
const isBuildPhase = PHASE === "phase-production-build";
const isDevPhase = !PHASE || PHASE === "phase-development-server";
if ((isBuildPhase || isDevPhase) && !process.env.GU_DISCOVERY_DONE) {
  process.env.GU_DISCOVERY_DONE = "1";
  try {
    runDiscovery(process.cwd());
  } catch (err) {
    // Discovery must never crash dev/build — games are optional.
    console.error("[GameUniverse] discovery failed (hub still boots):", err);
  }
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Pin the workspace root to this project. Without it Next infers the root from
  // the nearest lockfile, and a stray one in a parent folder (e.g. Desktop)
  // hijacks module resolution.
  turbopack: {
  root: process.cwd(),
},
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Games are rebuilt from /games on every hub build — always revalidate.
        source: "/play/:path*",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};

export default nextConfig;
