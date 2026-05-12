# Adventure World Builder

Adventure World Builder is an open-source, browser-based voxel world editor and playable adventure prototype.

It is based on [Tiny World Builder](https://github.com/jasonkneen/tiny-world-builder) by [Jason Kneen](https://github.com/jasonkneen). This project keeps the original world-building foundation and expands it with Play Mode, adventure markers, objectives, villains, and local gameplay systems.

> Attribution matters: this repository is a fork and continuation of Tiny World Builder. The original concept, visual foundation, and much of the single-file Three.js editor architecture come from Jason Kneen's work.

![Adventure World Builder screenshot](https://github.com/user-attachments/assets/1b19a5f7-def5-42bf-b85f-01714f502afa)

## What It Is

Adventure World Builder has two modes:

- **Editor Mode**: paint terrain, place buildings, grow trees, draw fences, build farms, shape rivers, and create a tiny voxel world.
- **Play Mode**: drop a character into the authored world, move around the board, fight a villain, complete an objective, and return to editing.

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

Recommended next deployment cleanup:

- Add an `index.html` entrypoint or a `vercel.json` rewrite from `/` to `/tiny-world-builder.html`.
- Keep a visible source link in the deployed app.
- Keep this repository public if deploying a modified AGPL-derived version.

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
| Move in Play Mode | WASD or arrow keys |
| Attack in Play Mode | `Space` or Attack button |
| Exit Play Mode | `Esc` or Editor button |

## Editor Tools

Terrain and world tools:

`Grass` · `Path` · `Dirt` · `Water` · `House` · `Tree` · `Fence` · `Rock` · `Bridge` · `Crop` · `Corn` · `Wheat` · `Pumpkin` · `Carrot` · `Sunflower` · `Tuft` · `Erase`

Adventure marker tools:

`Spawn` · `Villain` · `Chest` · `Gate` · `NPC` · `Quest` · `Exit`

Terrain/object rules are normalized by the renderer: crops force dirt underneath, bridges force water, and ordinary objects do not float on water. Paths, shorelines, water foam, bridges, fences, castle walls, houses, and rocks are adjacency-aware.

## Architecture

The app is intentionally simple to run: it is still centered around a single HTML file with inline CSS and JavaScript using Three.js r128.

Important runtime structures:

- `world[x][z]`: tile intent, including terrain, object kind, floors, building variant, fence side, extras, and local object transforms.
- `cellMeshes['x,z']`: rendered Three.js groups for each tile.
- `setCell(x, z, opts)`: main tile mutation entry point.
- `gameLayer`: adventure data separate from tiles, including objective and markers.
- `playMode`: runtime-only gameplay state for player, villain, health, combat, objective status, and camera follow.
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
- `gameLayer` markers can be set
- Play Mode starts from explicit markers
- defeating the villain completes the objective
- exiting Play Mode returns clean editor state
- objective validation catches missing required markers

## Roadmap

Near-term:

- Add an Adventure Panel for objective selection and marker validation.
- Improve marker thumbnails and marker placement validation in the editor.
- Add objective-specific smoke tests for every objective type.
- Update `world.schema.json` to include `gameLayer`.
- Add a Vercel entrypoint or rewrite.

Future:

- Quest chains and multiple objectives.
- NPC dialogue.
- More enemy archetypes.
- Encounter planning through validated JSON.
- Optional AI director endpoints for generating villains, quests, and encounter plans without giving AI direct frame-by-frame control.

## License

This project is distributed under the GNU Affero General Public License v3.0, matching the root license of the upstream Tiny World Builder repository.

Because this project is based on an AGPL-licensed work, public hosted modified versions should also make their corresponding source code available. If you want to use this work in a closed-source or differently licensed product, get explicit permission or a separate license from the original author and any other rights holders.

Note: if package metadata disagrees with the root `LICENSE`, treat the root `LICENSE` as authoritative until the metadata is corrected.

## Credits

Original project:

- [Tiny World Builder](https://github.com/jasonkneen/tiny-world-builder)
- Created by [Jason Kneen](https://github.com/jasonkneen)

This fork:

- [Adventure World Builder](https://github.com/parrisdigital/adventure-world-builder)
- Expanded by [parrisdigital](https://github.com/parrisdigital)
