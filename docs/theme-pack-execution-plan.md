# Theme Pack Execution Plan

Adventure World Builder should treat each world style as a complete playable kit, not a recolor of the classic board. Every theme needs its own terrain language, building silhouettes, props, characters, villains, and encounter logic while preserving the same game contracts.

## Core Rules

- Use one manifest-driven asset system across all themes.
- Keep one shared sprite scale and bottom-center anchor.
- Keep four character directions: `front`, `back`, `left`, `right`.
- Keep four object orientations for directional props and vehicles: north, east, south, west.
- Generate full themed sets in batches, not one-off images.
- Every theme must include terrain, homes, landmarks, props, character outfits, villain archetypes, NPC archetypes, and objective objects.
- Theme assets must remain readable at tactical board scale.
- Cultural themes should use respectful architectural and wardrobe cues, not caricatured symbols.

## Product Use Cases

The app should support these authoring and play use cases across every theme.

### World Authoring

- Pick a world theme before building.
- Paint terrain that fits the selected world.
- Place homes, landmarks, roads, paths, water, fences, props, and encounter objects.
- Rotate directional objects before placement.
- Nudge smaller props inside a tile when the composition needs breathing room.
- Switch themes without silently destroying the board.
- Start a new themed preset that demonstrates the theme's full language.

### Adventure Authoring

- Place player spawn, villain spawn, NPC, chest, gate, quest point, and exit markers.
- Use themed marker visuals where possible.
- Validate required markers before Play Mode starts.
- Allow markers on authored cells, then resolve to nearby legal play cells only if the exact tile is blocked.
- Keep gameplay markers separate from terrain/object cells.

### Tactical Play

- Move character tile-by-tile through authored grid paths.
- Face front/back/left/right based on movement direction.
- Face the target before attacking.
- Let villains use deterministic local behavior first.
- Tie objective state to themed objects: chest, gate, exit, NPC line, relic/package.
- Preserve consistent scale across hero, villain, NPCs, guards, chests, and props.

### Theme Expansion

- Generate theme packs in complete sets.
- Test each generated sheet as a contact sheet before runtime extraction.
- Add theme-specific character costumes, villains, NPCs, and props.
- Add city vehicles and street objects with controllable orientation.
- Add theme-specific encounter hooks so each world plays differently without changing the core rules.

### Future AI Director

- AI should only generate supported primitives.
- AI can choose theme, layout, objective, markers, villain archetype, NPC line, and encounter plan.
- AI should output strict JSON with `worldTheme`, `cells`, `gameLayer`, and object transforms.
- AI must not invent unsupported object ids or mutate the renderer directly.

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

## Direction And Orientation Contract

Directional control applies to characters and placed objects, but they use different runtime models.

### Characters

Characters use semantic facing:

- `front`: facing the user/camera
- `back`: facing away/up the visible board
- `left`: facing screen-left
- `right`: facing screen-right

Rules:

- Walking up the visible board uses `back`.
- Walking down the visible board uses `front`.
- Walking left/right uses `left` or `right`.
- Attacks face the target before the animation starts.
- Guard keeps the last facing.
- Defeated can use one neutral frame unless the theme pack includes four directions.

### Objects And Vehicles

Objects use transform-based placement:

- `rotationY`: snapped 90-degree rotation around the tile center.
- `offsetX`: optional within-tile horizontal nudge.
- `offsetZ`: optional within-tile vertical nudge.

Rules:

- Directional objects must support north/east/south/west.
- Cars, delivery vans, buses, alley gates, shop signs, benches, fences, torii gates, bridges, market carts, and directional doors must rotate cleanly.
- Rotation should be visible in the ghost preview before placement.
- The current runtime already stores transform data in saved cells; the schema and UI should make this explicit.
- Export/import must preserve object transforms.
- AI generation should be allowed to set object transforms for vehicles, gates, signs, benches, and directional buildings.

Editor controls:

- `R`: rotate the ghost preview 90 degrees clockwise.
- `Shift+R`: rotate the ghost preview 90 degrees counter-clockwise.
- Left/Right arrows: rotate the ghost preview.
- Up/Down arrows: nudge the ghost preview within the tile.
- Shift + arrow keys: pan the camera.

Generated object requirements:

- If an asset is a 3D/procedural model, one model can rotate in-engine.
- If an asset is a sprite or extracted bitmap, generate north/east/south/west frames.
- Vehicles need four clear orientations at minimum because road direction matters.
- Buildings with visible doors or signs should either rotate or have side/front variants.
- Symmetric objects can use one frame with rotation metadata.

## Use Case Coverage Matrix

| Use case | Classic | Japan | China | City |
| --- | --- | --- | --- | --- |
| Freeform world painting | farms, rivers, cottages | gardens, temple paths, canals | courtyard, market, canals | roads, sidewalks, parks |
| Adventure board authoring | village quest board | shrine/temple quest board | courtyard/market quest board | city block quest board |
| Tactical movement | fields, bridges, fences | bridges, bamboo chokepoints | canal bridges, walls | roads, alleys, dog park gates |
| Objective object | relic chest, gate, bridge exit | shrine relic, temple gate | market relic, courtyard gate | package/relic, alley gate, park exit |
| NPC quest giver | farmer/merchant/elder | shrine attendant/elder | shop owner/elder/courier contact | shopkeeper/mechanic/park contact |
| Villain lair | tower/manor | pagoda/watchtower | fortified gate/tower | rooftop/garage/alley |
| Directional props | bridge, sign, fence gate | torii, bridge, sign, lantern row | arched bridge, market cart, gate | cars, vans, benches, signs, streetlights |
| AI director future | village quest plan | shrine encounter plan | market/courtyard plan | city-block encounter plan |

## Character Roster Matrix

Every role must keep the same animation contract: idle, walk, attack, guard, hit, defeated, with front/back/left/right directions unless the state is intentionally neutral.

| Role | Classic | Japan | China | City |
| --- | --- | --- | --- | --- |
| Hero | village defender, cape, sword, small shield | temple guardian/adventurer, compact blade/shield silhouette | city guardian/courier adventurer, compact blade/shield silhouette | urban courier/adventurer, tactical jacket, compact blade/shield equivalent |
| Main villain | outlaw mage or bandit captain | masked rogue, rival guardian, or spirit-touched warlord | corrupt tower boss, rooftop enforcer, or relic thief | rooftop boss, cyber-thief, or corrupt developer archetype |
| Guard NPC | village spear guard | temple guard with polearm | gate guard | security guard |
| Civilian NPC | villager | village resident with simplified local outfit cues | neighborhood resident | city resident |
| Merchant NPC | travelling seller | market vendor | street vendor | shopkeeper |
| Quest giver | elder/farmer | shrine attendant or elder | elder, shop owner, courier contact | mechanic, park ranger, dispatch contact |
| Future ally | archer/apprentice | shrine apprentice | courier scout | street medic or technician |
| Future enemy minion | raider | shrine rogue | market thug/enforcer | alley thief/security drone later |

## Environment Asset Matrix

| Family | Classic | Japan | China | City |
| --- | --- | --- | --- | --- |
| Terrain | meadow, dirt road, farm dirt, river, stone path | garden grass, pale stone path, packed earth, koi/canal water, moss | courtyard stone, garden grass, red-brown earth, canal water, gray paving | asphalt, sidewalk, concrete plaza, park grass, construction dirt, storm drain |
| Homes | cottage, farmhouse, barn | machiya-style home, temple residence | courtyard house, tiled-roof residence, apartment block | townhouse, condo, apartment, shop-over-flat |
| Landmarks | manor, tower, turret | shrine, temple hall, pagoda, watchtower, torii | tea house, pavilion, fortified gate, watchtower, arched bridge | skyscraper, pub/bar, cafe, shopfront, parking garage, bus stop |
| Fences/walls | wood fence, stone wall, gate | low wooden fence, courtyard wall | garden wall, canal railing, fortified gate | alley gate, dog park fence, street barrier |
| Nature | oak, stump, crops, hay | sakura, bamboo, pine, rice paddy | bamboo, pine, plum blossom, garden rock | street tree, planter, park grass |
| Props | crate, barrel, signpost, lantern, well | stone lantern, hanging lantern, shrine box, banner, water basin | red lantern, stone marker, market cart, signboard, notice board | car, van, bench, hydrant, cone, trash can, streetlight, traffic light, bike rack |
| Vehicles | future cart/wagon | future handcart | market cart | compact car, delivery van, bus/taxi later |

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

### Phase 1: Orientation And Asset Contract

1. Surface existing ghost transform controls in the UI.
2. Add `transform` to the public world schema.
3. Add transform preservation tests.
4. Define orientation support per object family.
5. Update AI generation schema/prompt rules to allow transforms.

### Phase 2: City Environment Pack

City should be first because it proves the largest visual and mechanical difference.

1. Use `assets/concepts/city-environment-sheet.png` as the first city visual reference.
2. Extract or model asphalt, sidewalk, crosswalk, park grass, and plaza tiles.
3. Add buildings: pub/bar, cafe, shopfront, townhouse, condo, skyscraper, parking garage.
4. Add props: streetlight, traffic light, hydrant, bench, trash can, planter, fountain, bike rack, cones, crate stack.
5. Add vehicles: compact car, delivery van, later bus or taxi.
6. Make vehicles directional with four orientations or in-engine rotation.
7. Add dog park pieces: fence, gate, sign, small grass/park tile.
8. Add city preset board and screenshot smoke test.

### Phase 3: City Character Pack

1. Generate urban hero four-way action set.
2. Generate rooftop/cyber/corrupt-developer villain four-way action set.
3. Generate city resident NPC.
4. Generate security guard NPC.
5. Generate shopkeeper/merchant NPC.
6. Generate quest giver such as mechanic, park ranger, or dispatch contact.
7. Validate all character frames at NPC baseline scale.

### Phase 4: Japan Environment Pack

1. Expand current Japan pieces into a full environment pack.
2. Add homes: small machiya-style house and temple residence.
3. Add structures: shrine, temple hall, pagoda, watchtower, courtyard wall.
4. Add props: stone lantern, hanging lantern, small shrine box, banner sign, water basin, garden stones, bench.
5. Add nature: sakura, bamboo, pine, rice paddy.
6. Add directional torii, bridge, gate, and sign variants.
7. Add Japan preset board and screenshot smoke test.

### Phase 5: Japan Character Pack

1. Generate temple guardian hero.
2. Generate masked rogue or spirit-touched villain.
3. Generate villager, guard, merchant, shrine-attendant quest giver.
4. Validate four-way movement, attack, guard, hit, and defeated states.

### Phase 6: China Environment Pack

1. Build China as courtyard/market/canal/city-block identity, not a Japan clone.
2. Add terrain: courtyard stone, street paving, red-brown earth, canal water, raised wall platform.
3. Add buildings: courtyard house, tiled-roof residence, market shop, tea house, condo block, fortified gate, watchtower, arched bridge, pavilion.
4. Add props: red lantern, stone lion marker, market cart, crate stack, bench, signboard, notice board, canal railing.
5. Make gates, market carts, bridges, benches, and signboards directional.
6. Add China preset board and screenshot smoke test.

### Phase 7: China Character Pack

1. Generate city guardian/courier hero.
2. Generate corrupt tower boss, rooftop enforcer, or relic thief villain.
3. Generate resident, gate guard, street vendor, elder/shop-owner quest giver.
4. Validate all four-way movement and combat states.

### Phase 8: Encounter Rules

1. Theme-specific villain spawn preferences.
2. Theme-specific chest/relic/package visuals.
3. Theme-specific gate/exit visuals.
4. Theme-specific NPC dialogue pools.
5. Objective chains that use local environment assets.
6. AI director JSON that chooses from the theme contract only.

## Acceptance Criteria

- Japan no longer reads as classic cottages with sakura added.
- City no longer reads as farms with skyscrapers added.
- China has its own courtyard/market/canal identity and does not reuse Japan as a shortcut.
- Characters visibly belong to their selected world.
- Character scale remains consistent across hero, villain, NPCs, and guards.
- Walking up shows back-facing sprites in every theme.
- Weapons and attack effects are not cropped.
- Save/export/import preserves `worldTheme`.
- Save/export/import preserves object transforms.
- Cars and other directional props can be rotated to all four cardinal orientations.
- Smoke tests prove each theme preset renders without console errors.

## Immediate Next Steps

1. Ship the orientation contract: UI help, schema support, and tests for `rotationY`, `offsetX`, and `offsetZ`.
2. Turn the generated city concept sheet into a project asset reference.
3. Add a city object family to the renderer: road, sidewalk, crosswalk, compact car, delivery van, streetlight, bench, trash can, dog park fence/gate.
4. Add a city tool group and city preset that uses those objects.
5. Verify car rotation visually and with export/import tests.
6. Generate or model city character pack after the city board reads correctly.
