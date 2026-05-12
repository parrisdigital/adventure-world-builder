# Notices and Attribution

Adventure World Builder is authored and maintained by Parris Digital. It is an open-source expansion built on the world-building foundation of Tiny World Builder.

## Original Upstream Foundation

- Project: [Tiny World Builder](https://github.com/jasonkneen/tiny-world-builder)
- Author: [Jason Kneen](https://github.com/jasonkneen)
- License: GNU Affero General Public License v3.0, as indicated by the upstream root `LICENSE`

The original concept, visual foundation, and much of the single-file Three.js editor architecture come from Tiny World Builder. Adventure World Builder preserves that foundation and expands it with adventure authoring, Play Mode, objectives, local villain behavior, and release/deployment support.

## Adventure World Builder

- Project: [Adventure World Builder](https://github.com/parrisdigital/adventure-world-builder)
- Primary author and maintainer: [Parris Digital](https://github.com/parrisdigital)
- License: GNU Affero General Public License v3.0

## License Metadata Note

If package metadata in the upstream project differs from the root `LICENSE`, treat the root `LICENSE` as authoritative. Adventure World Builder aligns its package metadata to `AGPL-3.0-only`.

## Source Availability

Because this project is based on an AGPL-licensed work, public hosted modified versions should make their corresponding source code available.

## Project Concept And Sprite Assets

- Character/action, turnaround, and true-direction concept sheets are stored in `assets/concepts/`.
- Playable transparent sprites are extracted into `assets/sprites/` and indexed by `assets/sprites/manifest.json`.
- The sprite extraction/validation scripts are part of this fork and are used to keep runtime characters complete, padded, and free of cropped body or weapon fragments.
- The direction sheet is used for true back-facing character frames when characters walk up the visible board.
- The older procedural character pieces remain only as runtime fallbacks while sprite textures load or if a sprite asset fails.

## Theme Pack Assets

- Theme pack contracts are stored in `assets/themes/`.
- The initial supported theme ids are `classic`, `japan`, `china`, and `city`.
- Theme-specific character and object packs should preserve the same manifest contract while changing outfits, structures, roads, homes, props, and villains to match the chosen world style.

## Third-Party Runtime Assets

- Three.js r128 is vendored in `vendor/three-r128.min.js` for reliable static hosting.
- Three.js is licensed under the MIT License; see `vendor/three-r128.LICENSE`.
