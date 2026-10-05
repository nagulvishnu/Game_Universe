# Adding a New Game

No hub source code needs to change. Ever.

```text
games/
└── my-new-game/
    ├── game.json        ← required: the game contract
    ├── index.html       ← required: the entry file (name is up to you, set via "entry")
    ├── thumbnail.webp   ← recommended (png/jpg/svg/avif also work). Missing → generated fallback art
    ├── banner.webp      ← optional wide art used in the details panel / featured section
    └── assets/
```

## Steps

1. **Create a folder** inside `/games` (e.g. `games/my-new-game/`).
2. **Put the game files there** — vanilla HTML/JS, React, Three.js, Phaser, or the *built output* (`dist/`) of any Vite project.
3. **Add `game.json`** (copy `games/_template/game.json`).
4. **Add a thumbnail/banner** if you have them.
5. **Start or rebuild the hub**: `npm run dev` (restart it) or `npm run build`.
   You can also run `npm run discover-games` on its own to see the discovery report.
6. The game appears in the 3D universe, the library, search, filters, and `/game/my-new-game`.

> Use **relative asset paths** inside your game (`./assets/app.js`, Vite `base: './'`).
> Games are served from `/play/<folder>/`, so absolute paths such as `/assets/app.js` would break.

## `game.json`

| field         | required | notes |
|---------------|----------|-------|
| `id`          | **yes**  | unique, letters/numbers/`-`/`_`. Used in `/game/:id` |
| `title`       | **yes**  | |
| `entry`       | **yes**  | relative path to the HTML entry, or an `https://` URL for a remote game |
| `description` | no*      | *warning if missing |
| `genre` / `category` | one of them | e.g. `Racing` / `3D`. Drive filters **and the 3D portal look** |
| `thumbnail`   | no*      | *warning if missing — hub generates fallback art. `thumbnail.(webp\|png\|jpg\|svg…)` is auto-detected |
| `banner`      | no       | auto-detects `banner.(webp\|png\|…)` |
| `version`     | no       | |
| `tags`        | no       | searchable; tags shared by 2+ games become filter chips |
| `controls`    | no       | shown as key-caps in the details panel |
| `featured`    | no       | `true` → featured section |
| `status`      | no       | `playable` (default) \| `development` \| `coming-soon`. Non-playable games can't be launched |
| `developer`, `releaseDate` | no | shown in details |
| `flagship`    | no       | premium treatment. `ai-beast-world` is flagged automatically |
| `demo`        | no       | labels the game as a demo |

### How the 3D world is chosen

The portal's look is derived from `genre`, `category`, `tags` and `title` (see `src/games/theme.ts`):

| keywords | world |
|----------|-------|
| horror, zombie, dark, survival | corrupted dark zone |
| racing, drift, speed | neon speedway island |
| flight, sky, aerial | floating sky base |
| strategy, tower, fortress | floating fortress |
| shooter, fps, military, war | industrial outpost |
| fantasy, magic, rpg | arcane crystal |
| adventure, exploration, open world | planet |
| arcade, puzzle, platformer, 2D | arcade cube |
| anything else | cosmic node |

Placement in the universe is deterministic from the game's `id` — it never changes between sessions.

## What happens to invalid games?

They are **skipped, never fatal**. The terminal prints a report during `dev`/`build`:

```text
Game Discovery

✓ AI Beast World
⚠ Neon Velocity
    Missing thumbnail "thumbnail.webp" — using generated fallback art
✗ Zombie Defense  (zombie-defense)
    Entry file "index.html" not found — game skipped
```

In development the hub also shows a **DISCOVERY** panel (bottom-left) with the same information.

## Hub vs. game data

The hub only uses `localStorage` keys starting with `gu-`. It never calls `localStorage.clear()`.
Games own their own keys (e.g. `abw-*`). Don't use the `gu-` prefix in games.

## Deployment notes

* Discovery is **build-time**. The host never scans folders at runtime: `/games/*` is validated and copied to `public/play/*` during `next build`, and the registry is baked into the build. Adding a game = rebuild/redeploy.
* The `/games` folder must be present in the build environment (commit it, or mount it in CI).
* Games run in a sandboxed same-origin iframe (`allow-scripts allow-same-origin …`). Same-origin is required so games can use `localStorage`/IndexedDB, which means a game *can* technically reach the hub's origin. Only host games you trust there. For untrusted games use a remote `entry` URL on a different origin — the hub then cannot be touched by that game.
* The hub does not need a database for any of this.
