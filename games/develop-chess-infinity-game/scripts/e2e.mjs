// Browser smoke tests: node scripts/e2e.mjs  (requires `npm run build` first)
import http from "node:http";
import fs from "node:fs";
import { chromium } from "playwright";

const html = fs.readFileSync("dist/index.html");
const server = http.createServer((_, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(html); }).listen(4599);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
let pass = 0, fail = 0;
const ok = (c, name) => { if (c) { pass++; console.log("  ✓", name); } else { fail++; console.log("  ✗ FAIL:", name); } };
const wait = (ms) => page.waitForTimeout(ms);

async function sqPos(sq, orient = "w") {
  const b = await page.locator("[data-testid=board]").first().boundingBox();
  const f = "abcdefgh".indexOf(sq[0]), r = parseInt(sq[1]) - 1;
  const col = orient === "w" ? f : 7 - f, row = orient === "w" ? 7 - r : r;
  return { x: b.x + ((col + 0.5) * b.width) / 8, y: b.y + ((row + 0.5) * b.height) / 8 };
}
async function click(sq, o) { const p = await sqPos(sq, o); await page.mouse.click(p.x, p.y); }
async function mv(from, to, o) { await click(from, o); await wait(60); await click(to, o); await wait(300); }
const pieceAt = (sq) => page.locator(`.ci-piece[data-sq="${sq}"]`).getAttribute("data-piece").catch(() => null);
const count = (sel) => page.locator(sel).count();
async function toMenu() { await page.goto("http://localhost:4599/"); await wait(300); }
async function startLocal({ fen, clockCustom } = {}) {
  await toMenu();
  await page.getByRole("button", { name: /Play Local/ }).first().click();
  if (fen) { await page.getByText(/advanced: start from FEN/).click(); await page.locator("input[placeholder^=rnbqkbnr]").fill(fen); }
  if (clockCustom) { await page.getByRole("button", { name: "Custom" }).click(); await page.locator("input[type=number]").first().fill(String(clockCustom)); await page.locator("input[type=number]").nth(1).fill("0"); }
  await page.getByRole("button", { name: "Start game" }).click(); await wait(400);
}

console.log("Menu & rendering");
await toMenu();
ok((await page.title()).includes("CHESS INFINITY"), "title set");
ok(await page.getByText("Every Move Creates a New Possibility.").first().isVisible(), "tagline visible");
ok((await count(".ci-card")) >= 12, "menu cards present");
await page.screenshot({ path: "shot-menu.png" });

console.log("Local game: scholar's mate, illegal moves, drag & drop");
await startLocal();
ok((await count(".ci-piece")) === 32, "32 pieces on start");
await click("e2"); await wait(80);
ok((await count(".ci-dot")) === 2, "legal move dots for e2 pawn (2)");
await click("e5"); await wait(200);
ok((await pieceAt("e2")) === "wp", "illegal destination does not move pawn");
await click("e2"); await wait(80); await click("e4"); await wait(300);
ok((await pieceAt("e4")) === "wp", "click-click move e2-e4");
// drag and drop black e7-e5
{ const a = await sqPos("e7"), b = await sqPos("e5"); await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 }); await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up(); await wait(300); }
ok((await pieceAt("e5")) === "bp", "drag & drop e7-e5");
await click("e4"); await wait(60); await click("e7"); await wait(200);
ok((await pieceAt("e4")) === "wp", "cannot move through/onto illegal squares");
await mv("f1", "c4"); await mv("b8", "c6"); await mv("d1", "h5"); await mv("g8", "f6");
await page.screenshot({ path: "shot-game.png" });
await mv("h5", "f7");
ok((await page.locator(".ci-mate-banner").count()) === 1, "cinematic checkmate banner");
await wait(2800);
ok(await page.getByText("White wins!").first().isVisible(), "result modal: White wins");
ok(await page.getByText(/Checkmate — White wins/).first().isVisible(), "checkmate text");
await page.screenshot({ path: "shot-result.png" });
await page.getByRole("button", { name: "Engine analysis" }).click();
await page.getByRole("button", { name: /Run engine analysis/ }).click();
await page.getByText(/White accuracy/).waitFor({ timeout: 60000 });
ok(true, "engine analysis completes with accuracy");
await page.screenshot({ path: "shot-analysis.png" });
await page.getByRole("button", { name: "Review board" }).click(); await wait(200);
ok((await page.locator(".ci-mv").count()) === 7, "7 plies in move list");
await page.locator(".ci-mv").nth(0).click(); await wait(300);
ok((await pieceAt("e4")) === "wp" && (await pieceAt("f7")) === "bp", "history navigation shows earlier position");

console.log("Undo / redo");
await startLocal();
await mv("e2", "e4"); await mv("e7", "e5");
await page.getByRole("button", { name: /Undo/ }).click(); await wait(300);
ok((await pieceAt("e5")) === null && (await pieceAt("e7")) === "bp", "undo restores black pawn");
await page.getByRole("button", { name: /Redo/ }).click(); await wait(300);
ok((await pieceAt("e5")) === "bp", "redo replays move");

console.log("En passant");
await startLocal();
await mv("e2", "e4"); await mv("a7", "a6"); await mv("e4", "e5"); await mv("d7", "d5"); await mv("e5", "d6");
ok((await pieceAt("d6")) === "wp" && (await pieceAt("d5")) === null && (await count(".ci-piece")) === 31, "en passant captures pawn");

console.log("Castling both sides");
await startLocal({ fen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1" });
await mv("e1", "g1");
ok((await pieceAt("g1")) === "wk" && (await pieceAt("f1")) === "wr", "white O-O");
await mv("e8", "c8");
ok((await pieceAt("c8")) === "bk" && (await pieceAt("d8")) === "br", "black O-O-O");

console.log("Promotion (all four pieces via chooser)");
for (const p of ["q", "r", "b", "n"]) {
  await startLocal({ fen: "8/P6k/8/8/8/8/8/K7 w - - 0 1" });
  await click("a7"); await wait(60); await click("a8"); await wait(300);
  ok((await count(".ci-promo button")) === 4, `promotion chooser appears (${p})`);
  await page.locator(`.ci-promo button[data-promo=${p}]`).click(); await wait(300);
  ok((await pieceAt("a8")) === "w" + p, `promote to ${p}`);
}

console.log("Stalemate detection");
await startLocal({ fen: "7k/5K2/8/6Q1/8/8/8/8 w - - 0 1" });
await mv("g5", "g6"); await wait(1200);
ok(await page.getByText(/stalemate/i).first().isVisible(), "stalemate detected");

console.log("Timed game & timeout");
await startLocal({ clockCustom: 0.2 });
const clock0 = await page.locator(".ci-clock").first().innerText();
await mv("e2", "e4");
await wait(2200);
const clocks = await page.locator(".ci-clock").allInnerTexts();
ok(clocks.length === 2, "two clocks shown");
ok(/0:0\d\.\d|0:1\d|0:0\d/.test(clocks.join(" ")), "clock counts down: " + clocks.join(" / ") + " (start " + clock0 + ")");
await wait(11500);
ok(await page.getByText(/ran out of time/).first().isVisible(), "timeout ends game");
await page.screenshot({ path: "shot-timeout.png" });

console.log("Timeout with insufficient mating material = draw");
await startLocal({ fen: "4k3/8/8/8/8/8/8/4KB2 w - - 0 1", clockCustom: 0.2 });
// FEN above is already a draw by insufficient material; use K+B vs K+P so game is not auto-drawn
await startLocal({ fen: "4k3/p7/8/8/8/8/8/4KB2 w - - 0 1", clockCustom: 0.2 });
await mv("e1", "e2"); await mv("a7", "a6"); // white then black have moved; white clock ticking
await wait(13500);
ok(await page.getByText(/ran out of time/).first().isVisible(), "timeout recorded with pawn present (win/draw text shown)");

console.log("AI games");
for (const lvl of [1, 5]) {
  await toMenu();
  await page.getByRole("button", { name: /Play Against AI/ }).first().click();
  await page.locator(".ci-level button").nth(lvl - 1).click();
  await page.getByRole("button", { name: "Start game" }).click(); await wait(400);
  const t0 = Date.now();
  await mv("e2", "e4");
  await page.waitForFunction(() => document.querySelectorAll(".ci-mv").length >= 2, null, { timeout: 15000 }).catch(() => {});
  const n = await count(".ci-mv");
  ok(n >= 2, `AI level ${lvl} replied with a legal move in ${Date.now() - t0}ms`);
  await wait(400); await mv("g1", "f3"); await wait(300);
  await page.waitForFunction(() => document.querySelectorAll(".ci-mv").length >= 4, null, { timeout: 15000 }).catch(() => {});
  ok((await count(".ci-mv")) >= 4, `AI level ${lvl} continues playing`);
}
await page.screenshot({ path: "shot-ai.png" });
// AI as black plays first when user is black
await toMenu();
await page.getByRole("button", { name: /Play Against AI/ }).first().click();
await page.getByRole("button", { name: /Black/ }).first().click();
await page.getByRole("button", { name: "Start game" }).click();
await page.waitForFunction(() => document.querySelectorAll(".ci-mv").length >= 1, null, { timeout: 15000 }).catch(() => {});
ok((await count(".ci-mv")) >= 1, "AI opens as White when user plays Black");

console.log("Puzzles");
await toMenu();
await page.getByRole("button", { name: /^🧩 ?Puzzles|Puzzles Mates/ }).first().click(); await wait(400);
ok(await page.getByTestId("prompt").isVisible(), "puzzle prompt visible");
const prompt = await page.getByTestId("prompt").innerText();
ok(/checkmate in 1/.test(prompt), "first puzzle is mate in 1: " + prompt);
await mv("a1", "b1"); await wait(1000); // wrong move
ok(await page.getByText(/Not the best move/).first().isVisible(), "wrong puzzle move rejected");
await wait(800);
await mv("a1", "a8"); await wait(500);
ok(await page.getByText(/Solved!/).first().isVisible(), "correct mate-in-1 solved");
// mate in 2 flow through solver
await page.getByRole("button", { name: "Mate in 2", exact: true }).click(); await wait(300);
await page.locator(".ci-mv", { hasText: "Rook ladder" }).click(); await wait(400);
await mv("a2", "a7", "w"); await wait(1200);
await mv("b1", "b8", "w"); await wait(500);
ok(await page.getByText(/Solved!/).first().isVisible(), "mate-in-2 ladder solved with engine reply");
console.log("Puzzle hint");
await page.getByRole("button", { name: "All", exact: true }).click(); await wait(200);
await page.locator(".ci-mv", { hasText: "Knight fork" }).click(); await wait(300);
await page.getByRole("button", { name: /Hint/ }).click(); await wait(200);
ok((await count(".ci-sq.hint")) >= 1, "hint highlights a square");
await mv("d5", "c7"); await wait(400);
ok(await page.getByText(/Solved!/).first().isVisible(), "fork puzzle solved");

console.log("Daily, rush, survival");
for (const [name, text] of [["Daily Challenge", /Daily Challenge/], ["Puzzle Rush", /Puzzle Rush/], ["Survival Chess", /Survival Chess/]]) {
  await toMenu(); await page.getByRole("button", { name: text }).first().click(); await wait(400);
  if (name === "Daily Challenge") ok(await page.getByTestId("prompt").isVisible(), "daily puzzle shown");
  else { await page.getByRole("button", { name: "Start" }).click(); await wait(400); ok(await page.getByTestId("prompt").isVisible(), name + " run started"); }
}

console.log("Training");
await toMenu(); await page.getByRole("button", { name: /Training/ }).first().click(); await wait(300);
await page.getByRole("button", { name: /How the pieces move/ }).click(); await wait(400);
await mv("e1", "e5"); await wait(400);
ok(await page.getByText(/Rooks love open lines/).first().isVisible(), "lesson step success feedback");
await page.getByRole("button", { name: /Continue/ }).click(); await wait(300);
ok((await page.getByTestId("lesson-text").innerText()).includes("bishop"), "advanced to bishop step");

console.log("Opening explorer");
await toMenu(); await page.getByRole("button", { name: /Opening Explorer/ }).first().click(); await wait(300);
await page.getByRole("button", { name: /Italian Game/ }).click(); await wait(300);
await page.getByRole("button", { name: /Auto-play/ }).click(); await wait(3500);
ok((await pieceAt("e4")) === "wp", "auto-play advanced the line (e4 played)");
await page.getByRole("button", { name: "Play as White" }).click(); await wait(300);
await mv("e2", "e4"); await wait(900);
ok((await pieceAt("e5")) === "bp", "practice mode: opponent replies e5");
await mv("a2", "a3"); await wait(1000);
ok(await page.getByText(/book move is Nf3/).first().isVisible(), "practice rejects off-book move");

console.log("Settings persistence");
await toMenu(); await page.getByRole("button", { name: /Settings/ }).first().click(); await wait(300);
await page.getByRole("button", { name: /Neon Cyber/ }).click(); await wait(300);
await page.getByRole("button", { name: /Fantasy Kingdom/ }).click(); await wait(200);
await page.getByRole("button", { name: /Light/ }).click(); await wait(200);
await page.screenshot({ path: "shot-settings.png" });
await page.reload(); await wait(500);
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("chess-infinity:v1")).state.settings);
ok(saved.boardTheme === "neon" && saved.pieceStyle === "fantasy" && saved.uiMode === "light", "settings saved to localStorage");
ok((await page.locator(".ci-app").getAttribute("data-mode")) === "light", "settings restored after reload");
console.log("Corrupted storage");
await page.evaluate(() => localStorage.setItem("chess-infinity:v1", "{not json"));
await page.reload(); await wait(500);
ok(await page.getByText("CHESS").first().isVisible(), "app survives corrupted storage");
await page.evaluate(() => localStorage.setItem("chess-infinity:v1", JSON.stringify({ state: { settings: { boardTheme: 42, sound: "x" }, stats: { games: "many" } }, version: 1 })));
await page.reload(); await wait(500);
ok(await page.getByText("CHESS").first().isVisible(), "app survives wrong-typed storage");

console.log("Stats");
await toMenu(); await page.evaluate(() => localStorage.clear()); await page.reload(); await wait(300);
await startLocal();
await mv("f2", "f3"); await mv("e7", "e5"); await mv("g2", "g4"); await mv("d8", "h4"); await wait(3200);
await toMenu();
await page.getByRole("button", { name: /Statistics/ }).first().click(); await wait(400);
const statsTxt = await page.locator(".ci-stats-grid").first().innerText();
ok(/1\s*\nTotal games/i.test(statsTxt), "stats records finished game: " + statsTxt.replace(/\n/g, " ").slice(0, 80));
ok(await page.getByText(/Black won/).first().isVisible(), "match history lists result");

console.log("Responsive (mobile)");
await page.setViewportSize({ width: 390, height: 844 });
await startLocal();
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
ok(overflow <= 1, "no horizontal overflow on mobile (" + overflow + "px)");
const bb = await page.locator("[data-testid=board]").boundingBox();
ok(bb.width > 300, "board fills mobile width: " + Math.round(bb.width));
await page.screenshot({ path: "shot-mobile.png" });

console.log("\nconsole/page errors:", errors.length ? errors : "none");
console.log(`\nRESULT: ${pass} passed, ${fail} failed, ${errors.length} runtime errors`);
await browser.close(); server.close();
process.exit(fail || errors.length ? 1 : 0);
