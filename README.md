# Nagul's Game Universe

A personal 3D game launcher. Every folder in `/games` becomes a world you can fly into and play.

```text
                 GAME UNIVERSE
                      │
             ┌────────┴────────┐
        GAME DISCOVERY     GAME LAUNCHER
             │                 │
       games.generated      /game/:id
             └────────┬────────┘
               INDIVIDUAL GAMES
```

**Stack:** Next.js (App Router) · React · TypeScript (strict) · Three.js (vanilla, no R3F) · Tailwind + custom CSS · Vitest.

## Commands

| command | what it does |
|---|---|
| `npm run dev` | start the hub (runs game discovery first) |
| `npm run build` | discover games + production build |
| `npm run preview` | serve the production build (`next start`) |
| `npm run discover-games` | run discovery alone and print the report |
| `npm run typecheck` | strict TypeScript check |
| `npm run test` | unit + UI tests |

## Adding a game

Drop a folder with a `game.json` and an entry HTML file into `/games`, restart/rebuild. That's it.
See **[ADDING_A_NEW_GAME.md](./ADDING_A_NEW_GAME.md)** and `games/_template/`.

## Architecture

```text
games/<folder>/game.json ─▶ src/games/discovery   (validate, never crash on bad games)
                          ─▶ src/games/registry/games.generated.json   (+ public/play/<folder> static copy)
                          ─▶ GamesProvider ─▶ Universe (3D) / Library / Featured / Details
                          ─▶ /game/[id]  ─▶ GameLauncher (sandboxed iframe, loader, fullscreen, exit)
```

* `src/games/` — contract types, validation, discovery, registry, theming (metadata → world look)
* `src/three/` — `UniverseEngine` (scene, camera, particles, portals, raycasting, loop, disposal), portal builders, deterministic placement
* `src/components/` — providers (settings / games / UI), universe stage, library, details panel, launcher, cursor, nav
* `src/utils/` — hub storage (`gu-*` keys only), device detection, procedural audio

Discovery runs from `next.config.ts`, so `dev` and `build` always pick up new games.

## Routes

`/` (intro + universe + featured + library + about) · `/universe` · `/library` · `/game/:id` (dynamic) · `/settings`

## Hosting notes

* Discovery is build-time; hosts never scan folders at runtime. Adding a game = rebuild.
* Games are served from `/play/<folder>/` — games must use relative asset paths.
* Games run in a same-origin sandboxed iframe so they can use their own `localStorage`. Use a remote (`https://…`) `entry` for untrusted games.
* Hub preferences use only `gu-*` localStorage keys; `localStorage.clear()` is never called.
* Set `NEXT_PUBLIC_GU_DEBUG=1` to show the Discovery panel in production (always on in development).


