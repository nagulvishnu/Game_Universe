// Phase 9.6 — zero-dependency browser E2E harness for the MECHANIMOS 3D shell.
//
// Drives the production single-file build in headless Chrome/Edge over the
// Chrome DevTools Protocol. Uses only Node built-ins (child_process, http, net,
// fs, and the global fetch + WebSocket available in Node >= 22). No npm install
// is required and nothing is added to package.json dependencies.
//
// What it verifies (against the real renderer and the real animation loop):
//   - all three routes           : default 2D, ?proto3d, ?game3d
//   - car -> robot -> car         : transformation reaches the right modes/stages
//   - transformation timing       : wall-clock duration is in a sane band
//   - movement gating             : car drives, robot form does not
//   - camera behaviour            : distance stays in limits and tracks movement
//   - telemetry                   : captured before / during / after transform
//   - teardown                    : dispose() removes the canvas and is idempotent
//   - headless WebGL renderer     : recorded for the report (NOT a GPU benchmark)
//
// Usage:
//   npm run build
//   node scripts/e2e-game3d.mjs
//
// Env overrides:
//   MECHANIMOS_CHROME / CHROME_PATH : explicit browser executable
//   MECHANIMOS_E2E_KEEP=1           : leave browser + profile on disk for debugging
//
// Exit code is non-zero if any required assertion fails. A test is only ever
// reported PASS when its assertion actually executed.

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = join(ROOT, 'dist');
const INDEX = join(DIST, 'index.html');

const results = [];
let currentGroup = '(none)';

function group(name) {
  currentGroup = name;
  process.stdout.write(`\n== ${name} ==\n`);
}

// Records an assertion. `cond` must be a real boolean derived from observed
// state; a falsy value records a failure (never a skipped pass).
function check(name, cond, detail = '') {
  const ok = cond === true;
  results.push({ group: currentGroup, name, ok, detail: String(detail) });
  process.stdout.write(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  [${detail}]` : ''}\n`);
  return ok;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(fn, { timeout = 15000, interval = 100, label = 'condition' } = {}) {
  const start = Date.now();
  let lastError = null;
  while (Date.now() - start < timeout) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (err) {
      lastError = err;
    }
    await sleep(interval);
  }
  throw new Error(`timed out waiting for ${label} after ${timeout}ms${lastError ? ` (${lastError.message})` : ''}`);
}

// ------------------------------------------------------------------ browser

function findBrowser() {
  const explicit = process.env.MECHANIMOS_CHROME || process.env.CHROME_PATH;
  if (explicit) {
    if (!existsSync(explicit)) throw new Error(`MECHANIMOS_CHROME/CHROME_PATH points at a missing file: ${explicit}`);
    return explicit;
  }
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  throw new Error('no Chrome/Edge found; set MECHANIMOS_CHROME to the executable path');
}

function freePort() {
  return new Promise((res, rej) => {
    const srv = createNetServer();
    srv.on('error', rej);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => res(port));
    });
  });
}

// --------------------------------------------------------------- http server

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function startStaticServer(root) {
  const server = createServer((req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      let rel = decodeURIComponent(url.pathname);
      if (rel === '/' || rel === '') rel = '/index.html';
      const target = normalize(join(root, rel));
      if (!target.startsWith(root + sep) && target !== root) {
        res.writeHead(403).end('forbidden');
        return;
      }
      if (!existsSync(target) || !statSync(target).isFile()) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': MIME[extname(target)] || 'application/octet-stream' });
      res.end(readFileSync(target));
    } catch (err) {
      res.writeHead(500).end(String(err));
    }
  });
  return new Promise((res, rej) => {
    server.on('error', rej);
    server.listen(0, '127.0.0.1', () => res({ server, port: server.address().port }));
  });
}

// ------------------------------------------------------------- CDP client

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)); } catch { return; }
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message}${msg.error.data ? ` (${msg.error.data})` : ''}`));
        else resolve(msg.result);
      } else if (msg.method) {
        const hs = this.listeners.get(msg.method);
        if (hs) for (const h of [...hs]) h(msg.params);
      }
    });
  }

  static connect(wsUrl) {
    return new Promise((res, rej) => {
      const ws = new WebSocket(wsUrl);
      const onOpen = () => { ws.removeEventListener('error', onErr); res(new Cdp(ws)); };
      const onErr = (e) => { ws.removeEventListener('open', onOpen); rej(new Error(`websocket error: ${e?.message ?? e}`)); };
      ws.addEventListener('open', onOpen);
      ws.addEventListener('error', onErr);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30000);
    });
  }

  on(method, handler) {
    if (!this.listeners.has(method)) this.listeners.set(method, new Set());
    this.listeners.get(method).add(handler);
    return () => this.listeners.get(method).delete(handler);
  }

  waitEvent(method, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const off = this.on(method, (params) => { off(); clearTimeout(t); resolve(params); });
      const t = setTimeout(() => { off(); reject(new Error(`timeout waiting for ${method}`)); }, timeout);
    });
  }

  async evaluate(expression, { awaitPromise = false } = {}) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails.exception?.description || r.exceptionDetails.text || 'unknown page error';
      throw new Error(`page evaluate failed: ${d}`);
    }
    return r.result.value;
  }

  close() {
    try { this.ws.close(); } catch { /* ignore */ }
  }
}

async function httpJson(url, init) {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${init?.method ?? 'GET'} ${url} -> ${r.status}`);
  return r.json();
}

// ---------------------------------------------------------------- lifecycle

let child = null;
let profileDir = null;
let staticServer = null;

function killBrowserTree(pid) {
  try {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(pid, 'SIGKILL');
  } catch { /* best effort */ }
}

async function cleanup() {
  if (staticServer) { try { await new Promise((r) => staticServer.close(r)); } catch { /* ignore */ } staticServer = null; }
  if (child && child.pid) { killBrowserTree(child.pid); child = null; }
  if (profileDir && !process.env.MECHANIMOS_E2E_KEEP) {
    try { rmSync(profileDir, { recursive: true, force: true }); } catch { /* ignore */ }
    profileDir = null;
  }
}

// --------------------------------------------------------------------- main

async function main() {
  if (!existsSync(INDEX)) {
    throw new Error(`dist/index.html not found. Run "npm run build" first (looked in ${DIST}).`);
  }

  const browser = findBrowser();
  const cdpPort = await freePort();
  const { server, port: httpPort } = await startStaticServer(DIST);
  staticServer = server;
  const origin = `http://127.0.0.1:${httpPort}`;
  console.log(`browser : ${browser}`);
  console.log(`serving : ${DIST} at ${origin}`);
  console.log(`cdp     : 127.0.0.1:${cdpPort}`);

  profileDir = mkdtempSync(join(tmpdir(), 'mechanimos-e2e-'));
  child = spawn(browser, [
    '--headless=new',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--autoplay-policy=no-user-gesture-required',
    '--mute-audio',
    '--hide-scrollbars',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${profileDir}`,
    '--window-size=1280,720',
    'about:blank',
  ], { stdio: 'ignore' });

  await waitFor(
    () => httpJson(`http://127.0.0.1:${cdpPort}/json/version`),
    { timeout: 25000, interval: 250, label: 'CDP /json/version' },
  );

  const target = await httpJson(`http://127.0.0.1:${cdpPort}/json/new?url=about:blank`, { method: 'PUT' });
  const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  let loadWaiter = null;
  cdp.on('Page.loadEventFired', () => { if (loadWaiter) { loadWaiter(); loadWaiter = null; } });

  async function goto(path) {
    loadWaiter = null;
    const loaded = new Promise((res) => { loadWaiter = res; });
    await cdp.send('Page.navigate', { url: origin + path });
    await Promise.race([loaded, sleep(15000)]);
  }

  const evalJs = (expr, opts) => cdp.evaluate(expr, opts);

  // ---- headless renderer info (recorded, never presented as a GPU benchmark)
  const rendererInfo = await evalJs(`(() => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return { ok: false };
    const d = gl.getExtension('WEBGL_debug_renderer_info');
    return { ok: true, vendor: d ? gl.getParameter(d.UNMASKED_VENDOR_WEBGL) : 'n/a', renderer: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'n/a' };
  })()`);

  // =============================================================== ROUTES
  group('routes');

  await goto('/');
  const twoD = await evalJs(`({
    hasGame3d: typeof window.__game3d !== 'undefined',
    hasProto: typeof window.__proto3d !== 'undefined',
    text: document.body.innerText || '',
    canvas: document.querySelectorAll('canvas').length,
  })`);
  check('default route renders the 2D game', twoD.text.includes('START ENGINE'), `canvas=${twoD.canvas}`);
  check('default route does not mount ?game3d handle', twoD.hasGame3d === false);
  check('default route does not mount ?proto3d handle', twoD.hasProto === false);

  await goto('/?proto3d');
  let protoHandle = false;
  try {
    protoHandle = await waitFor(() => evalJs(`typeof window.__proto3d !== 'undefined'`), { timeout: 20000, label: 'window.__proto3d' });
  } catch (err) {
    check('?proto3d mounts its runtime handle', false, err.message);
  }
  if (protoHandle) check('?proto3d mounts its runtime handle', true);

  await goto('/?game3d');
  const gameHandle = await waitFor(() => evalJs(`typeof window.__game3d !== 'undefined'`), { timeout: 20000, label: 'window.__game3d' });
  check('?game3d mounts its runtime handle', gameHandle === true);

  // Wait for the animation loop to accumulate telemetry samples.
  await waitFor(() => evalJs(`window.__game3d.getTelemetry().samples > 3`), { timeout: 20000, label: 'telemetry samples' });

  // ========================================================= TRANSFORM
  group('transformation (car -> robot -> car)');

  const initial = await evalJs(`window.__game3d.getTransformState()`);
  check('initial state is car', initial.mode === 'car' && initial.t === 0 && initial.stage === 'CAR MODE', JSON.stringify(initial));

  const telemetryBefore = await evalJs(`window.__game3d.getTelemetry()`);
  check('telemetry before transform is live', telemetryBefore.samples > 0 && telemetryBefore.drawCalls > 0 && telemetryBefore.canvasWidth > 0,
    `fps=${telemetryBefore.fps.toFixed(1)} calls=${telemetryBefore.drawCalls} canvas=${telemetryBefore.canvasWidth}x${telemetryBefore.canvasHeight}`);

  // car -> robot (also samples the live particle count to prove effects run)
  const t0 = Date.now();
  await evalJs(`window.__game3d.toggleTransform(), true`);
  let sawTransforming = false;
  let maxParticles = 0;
  let robotState = null;
  while (Date.now() - t0 < 12000) {
    const s = await evalJs(`(() => { const g = window.__game3d; return { m: g.getTransformState().mode, p: g.getViewState().particles }; })()`);
    if (s.m === 'transforming') sawTransforming = true;
    if (s.p > maxParticles) maxParticles = s.p;
    if (s.m === 'robot') { robotState = await evalJs(`window.__game3d.getTransformState()`); break; }
    await sleep(40);
  }
  const toRobotMs = Date.now() - t0;
  check('car -> robot passed through a transforming state', sawTransforming === true);
  check('car -> robot reached robot mode (t=1, stage ROBOT MODE)', !!robotState && robotState.mode === 'robot' && robotState.t === 1 && robotState.stage === 'ROBOT MODE', JSON.stringify(robotState));
  check('car -> robot duration is in a sane band (1.5s..6s)', toRobotMs >= 1500 && toRobotMs <= 6000, `${toRobotMs}ms`);
  check('transformation emits spark/dust particles (alive count > 0)', maxParticles > 0, `maxParticles=${maxParticles}`);

  const telemetryAfterRobot = await evalJs(`window.__game3d.getTelemetry()`);
  check('telemetry after transform is live', telemetryAfterRobot.samples > telemetryBefore.samples, `samples ${telemetryBefore.samples} -> ${telemetryAfterRobot.samples}`);

  // robot -> car
  const t1 = Date.now();
  await evalJs(`window.__game3d.toggleTransform(), true`);
  const carState = await waitFor(
    async () => { const s = await evalJs(`window.__game3d.getTransformState()`); return s.mode === 'car' ? s : false; },
    { timeout: 12000, interval: 50, label: 'car mode' },
  );
  const toCarMs = Date.now() - t1;
  check('robot -> car returned to car mode (t=0)', carState.mode === 'car' && carState.t === 0, JSON.stringify(carState));
  check('robot -> car duration is in a sane band (1s..6s)', toCarMs >= 1000 && toCarMs <= 6000, `${toCarMs}ms`);

  // ========================================================= MOVEMENT
  group('movement gating + camera');

  async function key(type, code, keyName, vk) {
    await cdp.send('Input.dispatchKeyEvent', {
      type, code, key: keyName, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk,
    });
  }

  const camBefore = await evalJs(`(window.__game3d.getViewState(), window.__game3d.getViewState())`);
  const camDist0 = camBefore.camera.distance;

  // Drive forward in car form.
  await key('keyDown', 'KeyW', 'w', 87);
  let carMaxSpeed = 0;
  const driveStart = Date.now();
  while (Date.now() - driveStart < 1800) {
    const s = await evalJs(`window.__game3d.getViewState().speed`);
    if (s > carMaxSpeed) carMaxSpeed = s;
    await sleep(80);
  }
  const afterDrive = await evalJs(`window.__game3d.getViewState()`);
  await key('keyUp', 'KeyW', 'w', 87);
  check('car form responds to throttle (speed > 0.5)', carMaxSpeed > 0.5, `maxSpeed=${carMaxSpeed.toFixed(2)}`);
  check('car form actually moved (x/z changed)',
    Math.hypot(afterDrive.x - camBefore.x, afterDrive.z - camBefore.z) > 0.1,
    `dx=${(afterDrive.x - camBefore.x).toFixed(2)} dz=${(afterDrive.z - camBefore.z).toFixed(2)}`);

  const camDist1 = afterDrive.camera.distance;
  const camMoved = Math.hypot(
    afterDrive.camera.position.x - camBefore.camera.position.x,
    afterDrive.camera.position.y - camBefore.camera.position.y,
    afterDrive.camera.position.z - camBefore.camera.position.z,
  );
  check('camera tracked the moving vehicle (position changed)', camMoved > 0.1, `moved=${camMoved.toFixed(2)}`);
  check('camera distance stays within limits [4.5, 16]', camDist0 >= 4.5 && camDist0 <= 16 && camDist1 >= 4.5 && camDist1 <= 16,
    `before=${camDist0.toFixed(2)} after=${camDist1.toFixed(2)}`);

  // Transform to robot, then confirm movement is gated.
  await evalJs(`window.__game3d.toggleTransform(), true`);
  await waitFor(async () => (await evalJs(`window.__game3d.getTransformState().mode`)) === 'robot',
    { timeout: 12000, label: 'robot mode (gating)' });
  const posBeforeRobot = await evalJs(`(v => ({x:v.x,z:v.z}))(window.__game3d.getViewState())`);
  await key('keyDown', 'KeyW', 'w', 87);
  let robotMaxSpeed = 0;
  const robotDriveStart = Date.now();
  while (Date.now() - robotDriveStart < 1200) {
    const s = await evalJs(`window.__game3d.getViewState().speed`);
    if (s > robotMaxSpeed) robotMaxSpeed = s;
    await sleep(80);
  }
  const posAfterRobot = await evalJs(`(v => ({x:v.x,z:v.z}))(window.__game3d.getViewState())`);
  await key('keyUp', 'KeyW', 'w', 87);
  const robotDrift = Math.hypot(posAfterRobot.x - posBeforeRobot.x, posAfterRobot.z - posBeforeRobot.z);
  check('robot form gates movement (speed stays ~0)', robotMaxSpeed < 0.5, `maxSpeed=${robotMaxSpeed.toFixed(2)}`);
  check('robot form does not translate the vehicle', robotDrift < 0.05, `drift=${robotDrift.toFixed(3)}`);

  // Return to car for teardown test.
  await evalJs(`window.__game3d.toggleTransform(), true`);
  await waitFor(async () => (await evalJs(`window.__game3d.getTransformState().mode`)) === 'car',
    { timeout: 12000, label: 'car mode (pre-teardown)' });

  // ========================================================= AUDIO
  group('procedural audio');

  const audioState = await waitFor(async () => {
    const a = await evalJs(`window.__game3d.getAudioState()`);
    return a.status === 'running' || a.supported === false ? a : false;
  }, { timeout: 5000, interval: 100, label: 'audio running' }).catch(() => null);
  const aState = audioState ?? await evalJs(`window.__game3d.getAudioState()`);
  check('getAudioState() returns a well-formed view',
    typeof aState.supported === 'boolean' && typeof aState.status === 'string'
      && typeof aState.muted === 'boolean' && typeof aState.volume === 'number',
    JSON.stringify(aState));
  check('audio starts after a real user gesture when supported',
    aState.supported === false || aState.status === 'running',
    `supported=${aState.supported} status=${aState.status}`);

  // A transformation must schedule voices without throwing.
  await evalJs(`window.__game3d.toggleTransform(), true`);
  let sawAudioVoices = false;
  const audioT0 = Date.now();
  while (Date.now() - audioT0 < 4000) {
    if ((await evalJs(`window.__game3d.getAudioState().activeNodes`)) > 0) sawAudioVoices = true;
    if ((await evalJs(`window.__game3d.getTransformState().mode`)) === 'robot') break;
    await sleep(40);
  }
  check('transformation schedules audio voices when supported',
    aState.supported === false || sawAudioVoices,
    `supported=${aState.supported} sawVoices=${sawAudioVoices}`);

  // Mute and volume changes must be reported and must never throw.
  const mutedState = await evalJs(`(window.__game3d.setAudioMuted(true), window.__game3d.getAudioState())`);
  check('setAudioMuted(true) is reflected in audio state', mutedState.muted === true, JSON.stringify(mutedState));
  const volState = await evalJs(`(window.__game3d.setAudioVolume(0.3), window.__game3d.getAudioState())`);
  check('setAudioVolume(0.3) is reflected in audio state', Math.abs(volState.volume - 0.3) < 1e-9, `volume=${volState.volume}`);

  // Restore sane defaults, fold back to car and settle before teardown.
  await evalJs(`window.__game3d.setAudioMuted(false), window.__game3d.setAudioVolume(0.6), true`);
  await evalJs(`window.__game3d.toggleTransform(), true`);
  await waitFor(async () => (await evalJs(`window.__game3d.getTransformState().mode`)) === 'car',
    { timeout: 12000, label: 'car mode (audio done)' });

  // ========================================================= TEARDOWN
  group('teardown');

  const beforeDispose = await evalJs(`document.querySelectorAll('canvas').length`);
  await evalJs(`window.__game3d.dispose(), true`);
  await sleep(300);
  const afterDispose = await evalJs(`document.querySelectorAll('canvas').length`);
  const disposeTwice = await evalJs(`(() => { try { window.__game3d.dispose(); return 'ok'; } catch (e) { return 'threw: ' + e.message; } })()`);
  check('canvas is present before dispose', beforeDispose >= 1, `canvas=${beforeDispose}`);
  check('dispose() removes the renderer canvas', afterDispose === 0, `canvas=${afterDispose}`);
  check('dispose() is safe to call twice', disposeTwice === 'ok', disposeTwice);

  // ---------------------------------------------------------------- report
  const failed = results.filter((r) => !r.ok);
  const passed = results.filter((r) => r.ok);

  console.log('\n-------------------- summary --------------------');
  console.log(`assertions: ${passed.length} passed, ${failed.length} failed, ${results.length} total`);
  console.log(`headless renderer: ${rendererInfo.ok ? `${rendererInfo.renderer} | ${rendererInfo.vendor}` : 'unavailable'}`);
  console.log('telemetry:');
  console.log(`  before      fps=${telemetryBefore.fps.toFixed(1)} frameMs=${telemetryBefore.frameMs.toFixed(2)} p95=${telemetryBefore.p95Ms.toFixed(2)} calls=${telemetryBefore.drawCalls} tris=${telemetryBefore.triangles}`);
  console.log(`  after robot fps=${telemetryAfterRobot.fps.toFixed(1)} frameMs=${telemetryAfterRobot.frameMs.toFixed(2)} p95=${telemetryAfterRobot.p95Ms.toFixed(2)} calls=${telemetryAfterRobot.drawCalls} tris=${telemetryAfterRobot.triangles}`);
  console.log(`  transform   car->robot ${toRobotMs}ms, robot->car ${toCarMs}ms`);
  if (failed.length) {
    console.log('\nfailed assertions:');
    for (const f of failed) console.log(`  - [${f.group}] ${f.name}${f.detail ? `  [${f.detail}]` : ''}`);
  }
  console.log('-------------------------------------------------');

  cdp.close();
  return failed.length === 0 ? 0 : 1;
}

let exitCode = 1;
try {
  exitCode = await main();
} catch (err) {
  console.error(`\nE2E HARNESS ERROR: ${err.message}`);
  exitCode = 1;
} finally {
  await cleanup();
}
process.exit(exitCode);
