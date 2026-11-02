# ECLIPSE: THE LAST AWAKENING — Production Status (honest report)

**This build is NOT the finished 60–90 minute feature film.** It is a complete, working autonomous-film engine
plus a first full four-act cut of about **28 minutes** (20 scenes).

## Verified
* `npx tsx scripts/simulate.ts` runs the whole film headlessly through the real runtime:
  20/20 scenes complete, ~27.7 min simulated playback, 1 navigation warning, continuity checks pass
  (deaths, possession of the Veil Key, prerequisite facts, jump-to-any-scene state rebuild, mark/obstacle validity, A* paths).
* `node scripts/browser-test.mjs` (Playwright + SwiftShader WebGL): app loads, film starts, scenes render with zero console errors.
  Screenshots checked: start screen, village dialogue, observatory, raid battle (burning village, fighting NPCs).
* Not verified: GPU frame rate on RTX 3050 4 GB (software GL only), real audio output, recorded export file, a full
  real-time playthrough in a browser with speech synthesis, post-fix visual review of every scene.

## What exists
Story orchestrator + world state · utility-AI character agents (emotion, memory, relationships, knowledge, gaze, gestures, A* nav)
· choreographed combat with guaranteed outcomes · cinematic camera director · procedural rigs/animation/lip-sync
· 6 procedural environments with weather, day/night, eclipse, destructibles · generative score + SFX + TTS voices
· IndexedDB resume · WebM recorder · asset registry · generated screenplay + scene specs · in-app production console.

## Main gaps (see in-app Status tab)
Runtime far below 60 min · placeholder-grade procedural characters (no imported models) · TTS instead of voice acting
(and not captured in export) · synthetic music · no Rapier · LLM layer optional/off and only for combat barks
· story authored without an external ECLIPSE spec (none was supplied).
