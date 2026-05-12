# Adventure World Builder

Adventure World Builder is an open-source, browser-based voxel world editor and playable adventure prototype by Parris Digital.

It builds on the world-building foundation of [Tiny World Builder](https://github.com/jasonkneen/tiny-world-builder) by [Jason Kneen](https://github.com/jasonkneen), expanding that foundation with Play Mode, adventure markers, objectives, villains, and local gameplay systems.

> Attribution matters: Adventure World Builder is authored and maintained by Parris Digital. The original concept, visual foundation, and much of the single-file Three.js editor architecture come from Jason Kneen's Tiny World Builder.

![Adventure World Builder screenshot](https://github.com/user-attachments/assets/1b19a5f7-def5-42bf-b85f-01714f502afa)

## What It Is

Adventure World Builder keeps the quiet diorama editor as the authoring surface, then adds a separate adventure runtime on top of the authored world.

## Editor Mode

Editor Mode is for building the world: paint terrain, place buildings, grow trees, draw fences, build farms, shape rivers, and set adventure markers without starting combat.

Terrain/object rules are normalized by the renderer: crops force dirt underneath, bridges force water, and ordinary objects do not float on water. Paths, shorelines, water foam, bridges, fences, castle walls, houses, and rocks are adjacency-aware.

## Play Mode

Play Mode drops a character into the authored world. Movement respects blocked terrain and objects, the camera follows the player, and objectives can complete the board before returning to the editor.

The current combat slice uses a tactics-style foundation: the hero has a `Vanguard` fighting style with Move 3, movement speed metadata, action points, Slash, Dash, and Guard actions. The villain uses a `Hexblade` style with deterministic local turn behavior. Characters move tile-to-tile through the computed path instead of jumping to the destination, face front/back/left/right based on movement or target position, and show hit, guard, slash, and defeated presentation states.

## Adventure Markers

The current game layer supports:

- Player spawn markers
- Villain spawn markers
- Chests
- Gates
- NPC markers
- Quest points
- Exit markers
- Objective validation before Play Mode starts
- Local deterministic villain behavior: patrol, guard radius, line-of-sight, attack windup, and retreat at low health

Adventure markers are stored in `gameLayer`, separate from terrain/object tile data, and are exported/imported with world JSON. The editor includes an Adventure panel for choosing the objective, seeing required markers, and catching invalid setup before Play Mode starts.

Spawn and adventure markers can be placed on authored world cells without forcing the user back to roads only. If a spawn marker sits on a blocked authored tile, Play Mode resolves the character to the nearest valid standing tile while preserving the marker's authored position.

## Character Direction

Character concept sheets live in `assets/concepts/`:

- `character-action-sheet.png`
- `character-turnaround-sheet.png`
- `character-direction-sheet.png`

Playable sprite assets live in `assets/sprites/` and are generated from the concept sheets with:

```bash
npm run sprites:extract
```

The live game uses manifest-backed transparent Three.js sprites for the hero, villain, NPCs, and chest, with the older procedural pieces kept as runtime fallback while image textures load. Hero and villain frames switch by action and facing direction: idle, move, dash, slash, guard, hit, villain attack, defeated, and chest open/closed/relic states. Movement uses screen-space board direction, so walking up the visible grid selects the back-facing character frame instead of reusing a front or side pose.

Sprite quality is checked with:

```bash
npm run sprites:validate
```

That validation enforces transparent edge padding and catches large detached frame-edge fragments, so action sprites do not ship with cropped heads, swords, slash arcs, or partial bodies from the source sheets. The extraction pipeline also restores pale weapon details that are easy to mistake for the concept-sheet background.

## World Themes

Saved worlds include a `worldTheme` field. The first supported themes are:

- `classic`
- `japan`
- `china`
- `city`

The Adventure panel includes a world style selector. Applying a theme changes the active tool palette, converting a world maps compatible objects to theme-specific variants, and starting a new themed world loads a preset board. The Japanese pack is playable now with sakura, bamboo, stone lanterns, torii gates, pagodas, temple halls, and watchtowers. China and City are scaffolded as theme packs and support conversion/preset contracts for further asset expansion. Future character packs should be theme-specific: Japan should use appropriate local outfits and villains, City should use urban civilians/guards/villains, and each theme should ship matching terrain, homes, props, roads, and encounter objects rather than recoloring the classic set.

## Current Objectives

The adventure layer currently supports one active objective at a time:

- `defeat_villain`
- `collect_relic`
- `unlock_gate`
- `escape`

The objective and markers are stored in a separate `gameLayer`, not inside the tile data. This keeps terrain/object authoring separate from gameplay authoring.

## Run Locally

Open the HTML file directly:

```bash
open tiny-world-builder.html
```

Or serve the folder locally:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/tiny-world-builder.html
```

## Deploy

This app can be deployed as a static site. On Vercel, import this GitHub repository and use the default static deployment flow.

The included `vercel.json` rewrites:

- `/` to `/tiny-world-builder.html`
- `/app` to `/tiny-world-builder.html`

Deployment notes:

- Keep a visible source link in the deployed app.
- Keep this repository public if deploying a modified AGPL-derived version.
- Keep `NOTICE.md` in the public source repository so attribution and license notes are easy to find.

## Controls

| Action | Input |
| --- | --- |
| Place selected tool | Click a cell |
| Erase | `E` then click, or pick the eraser |
| Orbit camera | Drag |
| Pan camera | Right-drag or hold `Space` and drag |
| Zoom | Scroll wheel |
| Stack/enhance item | Click the same object tool on an existing object |
| Switch tool | `1`-`9`, then letter shortcuts shown in the toolbar |
| Toggle camera | `P` or `I` |
| Reset to preset | `R` |
| Clear to grass | `C` |
| Enter Play Mode | Play button |
| Move in Play Mode | Click a highlighted reachable tile; the character follows the chosen square path |
| Select Slash | `Space` or Slash button, then click the villain tile |
| Select Dash | `Shift` or Dash button, then click a highlighted dash tile; dash still follows the square path |
| Guard in Play Mode | `G` or Guard button |
| End turn | `Enter` or End Turn button |
| Exit Play Mode | `Esc` or Editor button |

## Editor Tools

Terrain and world tools:

`Grass` · `Path` · `Dirt` · `Water` · `House` · `Tree` · `Sakura` · `Bamboo` · `Fence` · `Rock` · `Bridge` · `Lantern` · `Torii` · `Crop` · `Corn` · `Wheat` · `Pumpkin` · `Carrot` · `Sunflower` · `Tuft` · `Erase`

Adventure marker tools:

`Spawn` · `Villain` · `Chest` · `Gate` · `NPC` · `Quest` · `Exit`

## Architecture

The app is intentionally simple to run: it is still centered around a single HTML file with inline CSS and JavaScript using Three.js r128.

Three.js r128 is vendored under `vendor/` so the deployed app does not depend on a third-party CDN at runtime.

Important runtime structures:

- `world[x][z]`: tile intent, including terrain, object kind, floors, building variant, fence side, extras, and local object transforms.
- `cellMeshes['x,z']`: rendered Three.js groups for each tile.
- `setCell(x, z, opts)`: main tile mutation entry point.
- `gameLayer`: adventure data separate from tiles, including objective and markers.
- `assets/sprites/manifest.json`: generated sprite index for hero, villain, NPC, and chest frames.
- `assets/themes/*/theme.json`: theme pack contracts for available tools, buildings, props, characters, and default presets.
- `playMode`: runtime-only gameplay state for player, villain, health, combat, objective status, camera follow, render positions, and active movement paths.
- `window.render_game_to_text()`: deterministic text state for smoke tests and automation.
- `window.advanceTime(ms)`: deterministic simulation stepping hook.

See [AGENTS.md](./AGENTS.md) for guidance on extending the codebase.

## Smoke Test

Run the Play Mode smoke test:

```bash
npm run smoke:play
```

The smoke test starts a temporary static server and headless Chrome session, then verifies:

- Play Mode hooks load
- in-app credits/source attribution opens from the toolbar
- the sprite manifest contains front/back/left/right frames for hero, villain, and NPC roles
- runtime hero/villain textures load from `assets/sprites/`
- theme labels, Japanese preset loading, and `worldTheme` export/import work
- `gameLayer` markers can be set
- Play Mode starts from explicit markers
- flexible spawn placement resolves blocked authored markers to valid standing tiles
- tactics metadata includes fighting style, movement speed, turn state, action points, and Slash/Dash/Guard
- click-to-move spends action points, creates an active path, animates render coordinates along the square route, and updates reachable tile overlays
- Slash preview exposes attack tiles, Dash requires a destination tile, Guard hands the turn to the enemy, and the villain resolves a deterministic turn
- player facing switches front/back while moving vertically and left/right when attacking across the board
- `defeat_villain`, `collect_relic`, `unlock_gate`, and `escape` objectives complete
- NPC markers can surface a short dialogue line
- objective validation catches missing required markers
- export/import preserves `gameLayer`

## Roadmap

Near-term:

- Add quest chains and multiple objectives.
- Add richer NPC interactions.
- Add party members and multiple enemies.

Future:

- More enemy archetypes.
- Encounter planning through validated JSON.
- Optional AI director endpoints for generating villains, quests, and encounter plans without giving AI direct frame-by-frame control.

## License

This project is distributed under the GNU Affero General Public License v3.0, matching the root license of the upstream Tiny World Builder repository.

Because this project is based on an AGPL-licensed work, public hosted modified versions should also make their corresponding source code available. If you want to use this work in a closed-source or differently licensed product, get explicit permission or a separate license from the original author and any other rights holders.

License metadata note: the upstream repository has had a root AGPL license while package metadata may indicate a different license. Treat the root `LICENSE` as authoritative. This fork aligns its package metadata to `AGPL-3.0-only`.

## Credits

See [NOTICE.md](./NOTICE.md) for standalone attribution and license notes.

Original project:

- [Tiny World Builder](https://github.com/jasonkneen/tiny-world-builder)
- Created by [Jason Kneen](https://github.com/jasonkneen)

Adventure World Builder:

- [Adventure World Builder](https://github.com/parrisdigital/adventure-world-builder)
- Created and maintained by [Parris Digital](https://github.com/parrisdigital)
