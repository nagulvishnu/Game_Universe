# Phase 6C — RTX 3050 Laptop Benchmark Procedure

Reproducible manual performance test for the `?proto3d` slice on real hardware.
**Headless/SwiftShader numbers (CI, ~144 FPS) do NOT represent GPU performance — always run this on the laptop.**

## Setup (once)

1. `npm install` (if needed), then `npm run dev` → http://localhost:5173/
2. Open **Chrome or Edge (desktop, hardware acceleration ON)** — not headless.
3. Confirm GPU: `chrome://gpu` → "WebGL: Hardware accelerated" and the discrete GPU listed.
4. Navigate to `http://localhost:5173/?proto3d` (default entry must remain the 2D game).

## Environment capture

On the proto page, note (shown in the bottom-left HUD):

- FPS, frame ms (p95), draw calls, triangles
- Quality mode (`Q: HIGH`/`LOW`), shadows ON/OFF, DPR

Also record: browser + version, `chrome://gpu` renderer string, laptop screen resolution,
Windows power mode (Best performance vs Balanced), and whether the laptop is on AC power.

## Scripted run (built-in, ~37 s)

1. Press **B** — the 7-segment benchmark runs: car idle → car drive → transform to robot →
   robot walk → robot attack → transform to car → car idle.
2. When finished, results appear in DevTools console as
   `[proto3d] BENCH RESULT {...}` and on `window.__proto3dBench`.
3. To read them: F12 → Console, copy the JSON after `BENCH RESULT`.
   Or in the console: `copy(JSON.stringify(window.__proto3dBench, null, 2))`.
4. Repeat **3× per quality mode**:
   - Run 1–3 with default HIGH quality.
   - Press `Q` (HUD shows `Q: LOW`), run 3 more.
5. Report per segment: `avgFps`, `p50Ms`, `p95Ms`, `worstMs` for each mode.
   Target for RTX 3050 4 GB at 1280×720-ish window: HIGH ≥ 60 FPS avg with p95 ≤ 20 ms;
   LOW should be ≥ HIGH (LOW disables shadows and caps DPR at 1).

## Manual spot checks (before/after the scripted runs)

Each for ~15 s, watching the HUD FPS/FRAME numbers:

1. **Car idle** — sit still; baseline FPS.
2. **Car drive** — hold W, steer with A/D around rocks/pylons.
3. **Transform T→robot** — confirm 7 stages display, no hitch > 100 ms at stage 7/7 landing burst.
4. **Robot walk** — hold W in robot mode.
5. **Attack** — tap J repeatedly while walking.
6. **Transform G→car** — confirm reverse transformation completes and driving resumes.
7. **Resize** — drag the window across half/full screen; no black canvas, FPS recovers.
8. **Quality toggle** — press Q mid-drive; FPS should change and shadows disappear/reappear.

## Caveats

- Windowed browser + OS compositor adds overhead vs exclusive fullscreen games.
- First 2–3 s after load include shader warm-up — discard them (the built-in bench already
  starts measuring after its first segment setup).
- `worstMs` includes GC pauses and window-manager stalls; judge stability from p95, not worst.
- Browser tabs in background get throttled — keep the proto tab focused.
