Original prompt: Build the first playable Tiny World Builder vertical slice: preserve the editor, add Play Mode with player movement, collisions, attack, one villain enemy, win/lose/reset flow, and deterministic test hooks.

Current prompt: Stabilize the vertical slice into an adventure-authoring foundation with `gameLayer`, marker tools, objective validation, upgraded deterministic enemy behavior, local dev cleanup, and a smoke-test script.

## Notes

- 2026-05-11: Started from clean `main` at `jasonkneen/tiny-world-builder`.
- 2026-05-11: Working branch is `play-mode-vertical-slice`.
- Preserve the single-file app contract. Gameplay code should live in `tiny-world-builder.html` with a clear `// -------- play mode --------` section.
- Keep gameplay simulation separate from `world[x][z]`; read from world data, do not mutate builder tiles during play.

## Checklist

- [x] Add Play Mode UI and HUD.
- [x] Add player/villain meshes and local combat loop.
- [x] Add `window.render_game_to_text` and `window.advanceTime(ms)`.
- [x] Run syntax and browser smoke checks.

## Progress

- Added a top-bar Play toggle and compact Play Mode HUD.
- Added a separate play runtime layer in `tiny-world-builder.html`; it reads `world[x][z]` but does not mutate editor tiles.
- Added player and villain pawns, collision against water/walls/rocks/buildings, local enemy chase/attack behavior, win/loss/restart/editor flow, and deterministic hooks.
- Validation passed: script extraction `node --check`, `git diff --check`, and a browser smoke test covering enter play, advance simulation, attack/win, and return to editor.
- Added persistent `gameLayer` state with board-level objective and unique markers for player spawn, villain spawn, chest, gate, NPC, quest point, and exit. Marker tools now render as subtle overlay pieces and save/export/import with the world JSON.
- Play Mode now validates required markers before starting, reads spawn positions from `gameLayer`, supports four objective types, and upgrades the villain with patrol, guard radius, line-of-sight, attack windup, and low-health retreat.
- Replaced the local `/auth.js` request with a conditional production-only loader, added `npm run smoke:play`, and verified the smoke script exits cleanly without leaving server/browser processes running.
- Rewrote `README.md` for the public Adventure World Builder fork, with explicit Tiny World Builder/Jason Kneen attribution, AGPL guidance, run/deploy instructions, architecture notes, smoke test docs, and roadmap. Updated package metadata to `adventure-world-builder`, the fork URL, and `AGPL-3.0-only`.
