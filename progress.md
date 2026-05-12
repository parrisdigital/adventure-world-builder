Original prompt: Build the first playable Tiny World Builder vertical slice: preserve the editor, add Play Mode with player movement, collisions, attack, one villain enemy, win/lose/reset flow, and deterministic test hooks.

Current prompt: Add Adventure UX and objective gameplay polish: Adventure Panel, interactive chest/gate/exit/NPC states, objective-specific smoke tests, authoring quality, docs, and schema updates.

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
- Added an Adventure panel for objective selection, required marker status, validation errors, and one-click Play Mode entry.
- Added editor marker labels and softened/hidden inactive markers during Play Mode; marker authoring is now flexible, with Play Mode resolving blocked authored spawn markers to the nearest valid standing tile.
- Made objective objects reactive: chests open after relic collection, gates open after unlocking, exits only surface for escape objectives, and NPC markers can surface a short quest line.
- Expanded `npm run smoke:play` to cover all four objective types, NPC dialogue, and export/import preservation for `gameLayer`.
- Updated `world.schema.json`, the embedded `WORLD_SCHEMA`, and README documentation for `gameLayer`, adventure markers, objective gameplay, `soft` camera mode, and AGPL/package metadata alignment.
- Committed the Adventure UX checkpoint as `6a092f7`.
- Added Vercel rewrites for `/` and `/app`, an in-app Credits and License modal, and standalone `NOTICE.md` attribution/license notes for release readiness.
- Corrected authorship language so Adventure World Builder is presented as a Parris Digital project while crediting Tiny World Builder/Jason Kneen as the original upstream foundation.
- Vendored Three.js r128 locally after the deployed page failed to boot when the external CDN script did not define `window.THREE`.
- Fixed the production blank-map boot issue by replacing the optional auth `document.write()` loader, adding an `auth.js` placeholder, and guarding the smoke test against script-tag swallowing.
- Generated character/action and left/right turnaround concept sheets under `assets/concepts/`, then translated them into procedural hero, villain, NPC, and treasure chest models.
- Added a first tactics-style character foundation: Vanguard hero metadata, Hexblade villain metadata, Slash/Dash/Guard actions, movement speed, action cooldowns, left/right facing, sword slash animation, guard stance, dash speed, and smoke coverage for flexible spawns plus directional combat.
- Added true tactics-mode flow: click-to-move reachable tiles, Player/Enemy turns, AP costs, Slash/Dash/Guard selection, attack and target previews, deterministic villain turns, and smoke coverage for movement, AP spend, guard handoff, enemy damage, and turn reset.
- Added Tactics Presentation 2.0 foundation: generated transparent sprite assets from the character concept sheets, added a sprite manifest/extraction script, switched hero/villain/NPC/chest visuals to sprite-driven Three.js actors with procedural fallbacks, and animated tactical movement through square paths using render coordinates separate from logical tile position.
