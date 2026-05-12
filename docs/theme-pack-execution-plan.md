# Theme Pack Execution Plan

Adventure World Builder should treat each world style as a complete playable kit, not a recolor of the classic board. Every theme needs its own terrain language, building silhouettes, props, characters, villains, and encounter logic while preserving the same game contracts.

## Core Rules

- Use one manifest-driven asset system across all themes.
- Keep one shared sprite scale and bottom-center anchor.
- Keep four character directions: `front`, `back`, `left`, `right`.
- Generate full themed sets in batches, not one-off images.
- Every theme must include terrain, homes, landmarks, props, character outfits, villain archetypes, NPC archetypes, and objective objects.
- Theme assets must remain readable at tactical board scale.
- Cultural themes should use respectful architectural and wardrobe cues, not caricatured symbols.

## Theme Pack Contract

Each theme should eventually provide:

- `theme.json`: metadata, tools, palette, asset families, encounter rules.
- `sprites/characters/`: hero, villain, villager, guard, merchant, quest giver.
- `sprites/objects/`: chest, relic, gate, exit, quest marker, signs, loot.
- `tiles/`: grass, path, dirt, water, road, plaza, raised ground variants.
- `objects/`: trees, rocks, lamps, fences, cars, crops, crates, benches.
- `buildings/`: homes, shops, landmarks, towers, walls, gates.
- `presets/`: starter boards that demonstrate the theme.

Suggested path shape:

```text
assets/themes/{theme}/theme.json
assets/themes/{theme}/sprites/characters/{role}/{action}-{direction}.png
assets/themes/{theme}/sprites/objects/{object}-{state}.png
assets/themes/{theme}/tiles/{tile}.png
assets/themes/{theme}/objects/{object}.png
assets/themes/{theme}/buildings/{building}.png
assets/themes/{theme}/presets/{preset}.json
```

## Classic

Fantasy: quiet farmland, cottages, fields, rivers, small towers, village trouble.

Terrain:

- meadow grass
- worn dirt road
- farm dirt
- shallow river
- raised grassy mounds
- stone path for manor/tower cells

Structures:

- cottage
- farmhouse
- barn
- manor
- stone tower
- wooden fence
- small bridge
- well
- market stall
- storage shed

Nature and props:

- oak tree
- stump
- hay bale
- crop rows
- wheat
- pumpkin patch
- carrot patch
- crate
- barrel
- signpost
- lantern

Characters:

- hero: village defender with cape, short sword, small shield
- villain: outlaw mage or bandit captain
- NPC villager: same scale as hero, simple tunic
- NPC farmer: work clothes, tool
- NPC merchant: apron or satchel
- NPC guard: spear and shield

Encounters:

- raiders near farms
- villain in tower or manor
- bridge ambush
- crop/relic recovery

## Japan

Fantasy: Japanese temple village, gardens, canals, shrines, sakura paths, bamboo edges.

Terrain:

- soft green garden grass
- pale stone path
- packed earth garden path
- koi pond or canal water
- mossy stone
- raised temple platform

Structures:

- small machiya-style home
- shrine building
- temple hall
- pagoda
- watchtower
- torii gate
- stone steps
- garden bridge
- low wooden fence
- courtyard wall

Nature and props:

- sakura tree
- bamboo cluster
- pine tree
- stone lantern
- hanging lantern
- small shrine box
- banner sign
- rice paddy
- garden stones
- water basin
- wooden bench

Characters:

- hero: temple guardian/adventurer using the same toy-voxel proportions
- villain: masked rogue, rival guardian, or spirit-touched warlord
- NPC villager: kimono-inspired silhouette simplified for voxel scale
- NPC guard: temple guard with polearm
- NPC merchant: market vendor with small pack
- NPC quest giver: shrine attendant or elder

Encounters:

- protect the shrine gate
- recover relic from pagoda courtyard
- unlock temple gate
- chase villain through bamboo and bridge choke points

## China

Fantasy: Chinese courtyard neighborhood with garden walls, market lanes, towers, canals, and denser city blocks. This should not be a copy of Japan.

Terrain:

- courtyard stone
- garden grass
- red-brown earth
- canal water
- gray street paving
- raised wall/platform tiles

Structures:

- courtyard house
- tiled-roof residence
- market shop
- tea house
- apartment/condo block
- fortified gate
- watchtower
- arched bridge
- garden wall
- small pavilion

Nature and props:

- bamboo
- pine tree
- plum blossom tree
- red lantern
- stone lion marker
- market cart
- crate stack
- bench
- garden rock
- canal railing
- signboard
- community notice board

Characters:

- hero: city guardian or courier-adventurer with short blade/shield equivalent
- villain: corrupt tower boss, rooftop enforcer, or relic thief
- NPC resident: neighborhood civilian
- NPC guard: gate guard
- NPC merchant: street vendor
- NPC quest giver: elder, shop owner, or courier contact

Encounters:

- market-lane chase
- gate unlock objective
- canal bridge control
- condo courtyard rescue
- tower boss with guards later

## City

Fantasy: modern tactical city board with roads, sidewalks, plazas, apartment blocks, shops, dog parks, cars, and alley routes.

Terrain:

- asphalt road
- sidewalk
- plaza concrete
- park grass
- construction dirt
- storm drain/water channel
- crosswalk markings

Structures:

- skyscraper
- condo/apartment block
- shopfront
- townhouse
- parking garage
- small park pavilion
- alley gate
- bus stop
- street corner building
- rooftop access block

Nature and props:

- street tree
- planter
- streetlight
- traffic cone
- parked car
- delivery van
- bench
- trash can
- hydrant
- dog park fence
- dog park sign
- fountain
- bike rack

Characters:

- hero: urban adventurer/courier with readable tactical gear
- villain: rooftop boss, cyber-thief, or corrupt developer archetype
- NPC resident: civilian
- NPC guard: security guard
- NPC merchant: shopkeeper
- NPC quest giver: park ranger, mechanic, or dispatch contact

Encounters:

- alley ambush
- retrieve relic/package from shop or van
- unlock gate to exit through park
- city-block escape objective
- villain patrols between rooftops/condos later

## Character Generation Requirements

For each theme and character role:

- idle `front/back/left/right`
- walk `front/back/left/right`
- attack `front/back/left/right`
- guard `front/back/left/right`
- hit `front/back/left/right`
- defeated neutral or four-way

Every sprite sheet must:

- keep the full body visible
- keep weapons and slash effects inside frame padding
- use transparent background
- keep scale consistent with NPC baseline
- preserve the same character identity across directions
- be inspected as a contact sheet before runtime integration

## Runtime Requirements

- Add `themeCharacterPack` lookup by `worldTheme`.
- Resolve sprite path as `{theme}/{role}/{action}-{direction}.png`, with fallback to `classic`.
- Let theme tools expose theme-specific object labels while mapping back to supported renderer kinds until full assets exist.
- Keep save format stable: `worldTheme` plus ordinary cells and `gameLayer`.
- Add tests that start each theme preset and confirm the correct sprite/theme assets resolve.

## Execution Batches

1. Harden manifest routing for theme-specific characters with classic fallback.
2. Generate Japan character pack: hero, villain, villager, guard, merchant.
3. Generate Japan environment pack: homes, shrine, temple hall, pagoda, torii, lanterns, sakura, bamboo, bridge, rice paddy.
4. Add Japan preset smoke test and browser screenshot.
5. Generate City character pack: hero, villain, resident, security guard, shopkeeper.
6. Generate City environment pack: asphalt, sidewalks, crosswalks, condo, shop, skyscraper, cars, dog park, streetlights, benches.
7. Add City preset smoke test and browser screenshot.
8. Generate China character pack and environment pack.
9. Add China preset smoke test and browser screenshot.
10. Add encounter rules so objectives spawn theme-appropriate villains, gates, chests/relics, and NPC quest lines.

## Acceptance Criteria

- Japan no longer reads as classic cottages with sakura added.
- City no longer reads as farms with skyscrapers added.
- China has its own courtyard/market/canal identity and does not reuse Japan as a shortcut.
- Characters visibly belong to their selected world.
- Character scale remains consistent across hero, villain, NPCs, and guards.
- Walking up shows back-facing sprites in every theme.
- Weapons and attack effects are not cropped.
- Save/export/import preserves `worldTheme`.
- Smoke tests prove each theme preset renders without console errors.
