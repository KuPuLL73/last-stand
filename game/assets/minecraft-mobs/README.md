# Minecraft mob reference assets

Textures were extracted from the official Minecraft Java 1.21.9 client distribution. See `../steve-sources.json` for the Mojang download URL, version, and checksum. Textures and characters are Mojang/Microsoft assets.

Geometry specifications come from Mojang's public Bedrock samples:

- https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/models/entity/zombie.geo.json
- https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/models/entity/skeleton.geo.json
- https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/models/entity/spider.geo.json
- https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/models/entity/creeper.geo.json
- https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/models/entity/iron_golem.geo.json

`game/minecraft-mobs.js` converts the cube sizes, pivots, and UV coordinates to the project's Three.js coordinate convention (+Z forward) and instances the bones. The browser preview and validation live in `game/artifacts/minecraft-mobs-preview.html` and `game/tests/visual-fidelity-browser.mjs`.

The spider's legs use outward yaw and downward roll; their distal vertices are checked over six phases of walking so the inverted-leg regression is detected.

## Endless-wave variants

The renderer also includes the husk, drowned, stray and cave spider. Six additional, unmodified textures were extracted from the same SHA-1-verified Java 1.21.9 client. Exact paths and SHA-256 hashes are recorded in `variant-sources.json`; the small variant textures total less than 4 KB.

`husk.geo.json`, `stray.geo.json` and `stray_armor.geo.json` are copied from Mojang's public Bedrock samples, with source URLs/hashes in that manifest. Drowned uses the Java 64×64 separate left-arm/left-leg UV rectangles. Husk keeps the legacy mirrored top-32px limb layout: its lower-half limb rectangles are fully transparent despite the image being 64×64. A regression check samples alpha on both legs and verifies separate animated joints throughout the walk cycle. The drowned has its actual translucent outer skin; the stray has its actual ragged clothes over the thin skeleton. These outer meshes share the corresponding animated bone matrices rather than floating independently. The cave spider shares the spider geometry at the official 0.7 species scale, as specified in Mojang's `cave_spider.entity.json`.

Base `type` values retain movement/animation behavior; `variant` selects the species. Ordinary render instances share a global limit of 80 across all variants, plus two boss slots. Geometry/materials are instanced by species/bone, with no new mesh allocation for individual spawned enemies.

Visual proof: `game/artifacts/minecraft-variants-final.png`; source preview: `game/artifacts/minecraft-variants-preview.html`. `node game/tests/minecraft-variants-browser.mjs` checks genuine wave-five simulation entities, both clothing layers, grounded cave-spider legs, shared instance limits and browser/shader errors.


## Endless bosses and late armour

The first endless boss remains the original iron golem. Following bosses use actual Mojang geometry and unmodified Java textures for Wither, Warden, Elder Guardian and Ender Dragon. `boss-sources.json` records the exact files, upstream URLs and hashes. `minecraft-boss-poses.js` resolves the original guardian spike/eye/tail neutral positions and the dragon's segmented neck/tail and mirrored wings; the meshes retain their UV layouts. The Warden has a separate bioluminescent layer. Wings and horns that are planes in the original source remain double-sided source surfaces inside otherwise volumetric models.

The reference zombie brute is original voxel geometry, with a chest over three times its head width, broad upper arms and parented forearms. It samples the original zombie skin, with native voxel skin patches on the torn shirt and knees. Its source is `zombie-brute.geo.json`; the user reference is recorded in the manifest. Armoured zombie/skeleton equipment is original bone-local geometry in `game/cubic-equipment.js`. No custom broodmother/frost-king substitute is present in the renderer.

The main renderer resolves source bone hierarchy and default rotations, supports per-face UV objects and rotated cubes, and batches species/equipment by bone. `modelScale` is applied to actual geometry for split slime/magma generations. Ordinary instances share one global cap of 80; all boss species share two boss slots. Per-model `healthHeight` and `shadowScale` supply the arena wrapper's presentation.

`node game/tests/endless-models-browser.mjs` checks boss order/models, equipment attachment, head/spike/wing/neck/tail geometry, both opaque leg textures and complete biped walk cycles, split scale and shared instance limits. Screenshots: `game/artifacts/endless-roster-final.png`, `game/artifacts/husk-legs-fixed.png`. The showcase uses separate one-species pools for side-by-side boss comparison; gameplay uses a single shared pool.
