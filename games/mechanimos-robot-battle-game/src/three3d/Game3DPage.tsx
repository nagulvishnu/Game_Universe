// Phase 9.1 — React host for the reusable 3D application shell.
// Mounts App3D into a plain <div>, polls telemetry at UI rate, and surfaces a
// readable error instead of a blank canvas if WebGL is unavailable.
//
// This page intentionally contains no gameplay UI. HUD, pause and menus arrive
// with Phase 9.2+.

import { useCallback, useEffect, useRef, useState } from 'react';
import { App3D, WebGLInitError, type TransformState } from './core/App3D';
import type { QualityLevel } from './core/quality';
import type { TelemetrySnapshot } from './core/telemetry';
import type { CameraViewState } from './core/camera';
import type { AudioStateView } from './core/audio';

const EMPTY_TRANSFORM: TransformState = { t: 0, stage: 'CAR MODE', mode: 'car' };
const EMPTY_CAMERA: CameraViewState = {
  yaw: 0, pitch: 0, distance: 0,
  position: { x: 0, y: 0, z: 0 }, following: false,
};
const EMPTY_VIEW = { speed: 0, heading: 0, x: 0, z: 0, wheelSpin: 0, particles: 0, camera: EMPTY_CAMERA, dragging: false };
const EMPTY_AUDIO: AudioStateView = { supported: true, status: 'idle', muted: false, volume: 0.6, activeNodes: 0 };

export default function Game3DPage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<App3D | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | null>(null);
  const [transform, setTransform] = useState<TransformState>(EMPTY_TRANSFORM);
  const [view, setView] = useState(EMPTY_VIEW);
  const [audio, setAudio] = useState<AudioStateView>(EMPTY_AUDIO);
  const [mounted, setMounted] = useState(false);

  const refresh = useCallback(() => {
    const app = appRef.current;
    if (!app) return;
    setTelemetry(app.getTelemetry());
    setTransform(app.getTransformState());
    setView(app.getViewState());
    setAudio(app.getAudioState());
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let app: App3D | null = null;
    try {
      app = new App3D(host, { onStateChange: refresh });
    } catch (err) {
      const message = err instanceof WebGLInitError
        ? err.message
        : `The 3D engine failed to start: ${err instanceof Error ? err.message : String(err)}`;
      setError(message);
      return;
    }

    appRef.current = app;
    setMounted(true);
    // Handle for manual/CDP inspection, matching the existing ?proto3d pattern.
    (window as unknown as { __game3d?: App3D }).__game3d = app;

    const poll = window.setInterval(refresh, 150);
    return () => {
      window.clearInterval(poll);
      app?.dispose();
      appRef.current = null;
      delete (window as unknown as { __game3d?: App3D }).__game3d;
    };
  }, [refresh]);

  const handleQuality = useCallback((level: QualityLevel) => {
    appRef.current?.setQuality(level);
    refresh();
  }, [refresh]);

  const handleMute = useCallback(() => {
    const app = appRef.current;
    if (!app) return;
    app.unlockAudio();
    app.setAudioMuted(!audio.muted);
    refresh();
  }, [audio.muted, refresh]);

  const handleVolume = useCallback((value: number) => {
    const app = appRef.current;
    if (!app) return;
    app.unlockAudio();
    app.setAudioVolume(value / 100);
    refresh();
  }, [refresh]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black font-mono text-cyan-200">
      <div ref={hostRef} className="absolute inset-0" />

      {error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#0a0618] p-6 text-center">
          <div className="text-[18px] font-bold tracking-widest text-red-400">3D ENGINE UNAVAILABLE</div>
          <div className="max-w-md text-[12px] leading-relaxed text-white/70">{error}</div>
          <div className="max-w-md text-[11px] leading-relaxed text-white/50">
            Enable hardware acceleration in your browser, or continue in the 2D game.
          </div>
          <a
            href="./"
            className="rounded border border-cyan-500/50 bg-black/60 px-4 py-2 text-[11px] tracking-widest hover:bg-cyan-900/40"
          >
            &larr; BACK TO 2D GAME
          </a>
        </div>
      )}

      {!error && (
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="rounded border border-cyan-500/40 bg-black/60 p-3 text-[11px] leading-5 backdrop-blur-sm">
              <div className="mb-1 text-[13px] font-bold tracking-widest text-cyan-300">
                MECHANIMOS &middot; 3D SHELL
              </div>
              <div className="text-amber-200/90">AURORA-01 &middot; PROCEDURAL PLACEHOLDER &mdash; NOT CANON</div>
              <div className="mt-2 text-cyan-100/90">
                PHASE 9.2 &mdash; third-person camera + driving<br />
                <span className="text-cyan-300/80">W / S or &uarr; / &darr; &mdash; throttle &amp; brake/reverse</span><br />
                <span className="text-cyan-300/80">A / D or &larr; / &rarr; &mdash; steer</span><br />
                <span className="text-cyan-300/80">DRAG &mdash; orbit camera &middot; WHEEL &mdash; zoom</span><br />
                <span className="text-cyan-300/80">T &mdash; transform test rig</span><br />
                <span className="text-cyan-300/80">Q &mdash; toggle quality (HIGH / LOW)</span>
              </div>
            </div>
            <div className="pointer-events-auto flex flex-col items-end gap-2">
              <a
                href="./"
                className="rounded border border-cyan-500/50 bg-black/60 px-3 py-2 text-[11px] tracking-widest hover:bg-cyan-900/40"
              >
                &larr; BACK TO 2D GAME
              </a>
            </div>
          </div>

          <div className="flex items-end justify-between gap-4">
            <div className="rounded border border-cyan-500/40 bg-black/60 p-3 text-[11px] leading-5 backdrop-blur-sm">
              <div>
                MODE:{' '}
                <span className="text-cyan-300">{transform.mode.toUpperCase()}</span>
              </div>
              <div>STAGE: <span className="text-fuchsia-300">{transform.stage}</span></div>
              <div>
                SPEED: <span className="text-emerald-300">{view.speed.toFixed(1)}</span>
                {' \u00b7 '}X: {view.x.toFixed(1)} Z: {view.z.toFixed(1)}
              </div>
              <div>
                CAM: <span className="text-amber-200">DIST {view.camera.distance.toFixed(1)}</span>
                {' \u00b7 '}PITCH {(view.camera.pitch * 57.2958).toFixed(0)}&deg;
                {view.dragging ? <span className="text-fuchsia-300"> \u00b7 ORBITING</span> : null}
              </div>
              <div className="mt-1 border-t border-cyan-500/30 pt-1">
                FPS: <span className="text-emerald-300">{telemetry ? telemetry.fps.toFixed(0) : '--'}</span>
                {' \u00b7 '}FRAME: {telemetry ? telemetry.frameMs.toFixed(1) : '--'}ms (p95 {telemetry ? telemetry.p95Ms.toFixed(1) : '--'})
              </div>
              <div>
                CALLS: <span className="text-amber-200">{telemetry ? telemetry.drawCalls : '--'}</span>
                {' \u00b7 '}TRIS: {telemetry ? (telemetry.triangles / 1000).toFixed(1) : '--'}k
                {' \u00b7 '}SHADOWS: {telemetry && telemetry.shadows ? 'ON' : 'OFF'}
              </div>
              <div className="text-cyan-400/80">
                DPR: {telemetry ? telemetry.pixelRatio.toFixed(2) : '--'}
                {' \u00b7 '}CANVAS: {telemetry ? `${telemetry.canvasWidth}x${telemetry.canvasHeight}` : '--'}
              </div>
            </div>

            <div className="pointer-events-auto flex flex-col gap-2">
              <div className="rounded border border-cyan-500/40 bg-black/60 p-2 text-[11px] backdrop-blur-sm">
                <div className="mb-1 tracking-widest text-cyan-300/90">AUDIO</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleMute}
                    disabled={!audio.supported}
                    className={[
                      'rounded border px-2 py-1 text-[10px] tracking-widest transition-colors',
                      audio.muted
                        ? 'border-fuchsia-400 bg-fuchsia-900/50 text-fuchsia-100'
                        : 'border-white/20 bg-black/60 text-white/70 hover:bg-cyan-900/30',
                      !audio.supported ? 'opacity-40' : '',
                    ].join(' ')}
                  >
                    {audio.muted ? 'MUTED' : 'SOUND'}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round(audio.volume * 100)}
                    onChange={(e) => handleVolume(Number(e.target.value))}
                    disabled={!audio.supported || audio.muted}
                    aria-label="Volume"
                    className="h-1 w-24 cursor-pointer accent-cyan-400 disabled:opacity-40"
                  />
                  <span className="w-8 text-right text-white/60">{Math.round(audio.volume * 100)}</span>
                </div>
                <div className="mt-1 text-[10px] text-white/45">
                  {audio.supported
                    ? audio.status === 'running'
                      ? 'ON \u00b7 starts on first input'
                      : 'READY \u00b7 press a key or click'
                    : 'UNAVAILABLE IN THIS BROWSER'}
                </div>
              </div>
              {(['high', 'low'] as QualityLevel[]).map((level) => (
                <button
                  key={level}
                  onClick={() => handleQuality(level)}
                  className={[
                    'rounded border px-3 py-1 text-[11px] tracking-widest transition-colors',
                    telemetry?.quality === level.toUpperCase()
                      ? 'border-cyan-400 bg-cyan-900/60 text-cyan-100'
                      : 'border-white/20 bg-black/60 text-white/60 hover:bg-cyan-900/30',
                  ].join(' ')}
                >
                  QUALITY: {level.toUpperCase()}
                </button>
              ))}
              {!mounted && <div className="text-[10px] text-white/40">STARTING ENGINE&hellip;</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}