# Hostile Minecraft family assets

This folder supplies 26 additional hostile/hostile-neutral species to `game/minecraft-roster.js`. They join the base creatures, the four original variants and the equipment elites in the full renderer registry. Boss models are maintained separately by `minecraft-mobs.js` and `minecraft-boss-poses.js`.

## Sources and transformations

Source geometries are unmodified JSON files from Mojang's public `bedrock-samples` repository at commit `15701fa9c13923f12662984c32c124327e40e3d3`. Texture pixels and held-item pixels come from the previously SHA-1-verified Minecraft Java 1.21.9 client. `sources.json` records exact source paths, source URLs, file hashes and dimensions. Character art remains Mojang/Microsoft material; this file records provenance rather than a new licence.

The renderer converts Bedrock coordinates (+Y up, −Z front) to the game's +Z-forward convention. It retains bone parents, rest rotations, cube rotations and per-face UV rectangles. The registry normalizes lower-case humanoid limb names without redrawing the geometry or texture.

Specific resolved source requirements:

- Witch geometry inherits a villager torso, legs and folded arms. The registry resolves that inheritance and appends the wart/hat pieces instead of displaying a detached hat.
- The enderman's source head and hat are placed together above the torso, the right long arm sits outside the torso, and both long legs are grounded. Original cube dimensions/UVs are retained.
- Blaze rods use the three four-rod orbital rings described by Mojang's `blaze.animation.json`; the rods do not stack inside the head.
- Breeze uses the actual head, rods, eye layer and three translucent wind-shell layers. The wind shell has its own 128×128 texture layout.
- Slime uses the smaller solid inner cube and a translucent larger shell, so its eyes/mouth remain visible. Magma cube uses its matching 64×64 v2 UV layout and segmented body.
- Guardian spike, eye and tail rest positions are resolved by `guardianGeometry()` from the boss-pose module. Ghast tentacles and phantom/vex wings animate as their own joints.
- Ranged humanoids carry a bow only when appropriate. Crossbows, swords, axes and the witch's bottle are extrusions of actual source item pixels, merged into hand-local instanced geometry.
- Split slime/magma offspring inherit `entity.modelScale`; the renderer handles the scaling of the same actual model.

## Registered ordinary families

| ID | Species | Base rule family |
|---|---|---|
| zombie-villager | Zombie villager | walker |
| wither-skeleton | Wither skeleton | walker |
| bogged | Bogged | spitter |
| pillager | Pillager | spitter |
| vindicator | Vindicator | walker |
| evoker | Evoker | spitter |
| witch | Witch | spitter |
| enderman | Enderman | walker |
| slime | Slime | runner |
| magma-cube | Magma cube | runner |
| blaze | Blaze | spitter |
| breeze | Breeze | spitter |
| ghast | Ghast | spitter |
| phantom | Phantom | runner |
| silverfish | Silverfish | runner |
| endermite | Endermite | runner |
| guardian | Guardian | spitter |
| shulker | Shulker | spitter |
| vex | Vex | runner |
| hoglin | Hoglin | walker |
| zoglin | Zoglin | walker |
| piglin | Piglin | spitter |
| piglin-brute | Piglin brute | walker |
| zombified-piglin | Zombified piglin | walker |
| ravager | Ravager | walker |
| creaking | Creaking | walker |

These creatures use new arena rules rather than claiming to reproduce every original Minecraft AI. Progression/unlock requirements and combat effects are owned by `cubic-variants.js` and `survival-core.js`; new families unlock after boss victories, not just elapsed time. Passive animals, NPCs and unused command-only mobs are outside this hostile-family list.

## Verification

`node game/tests/minecraft-roster-browser.mjs` checks all 26 real late-stage simulation entities, their complete textured models, ground/bounds, animation without per-enemy mesh allocation, held-item attachment, layered shells/eyes and browser/GLSL errors. Preview: `game/artifacts/minecraft-roster-preview.html`; final contact sheet: `game/artifacts/minecraft-roster-final.png`; numeric bounds/report: `minecraft-roster-bounds.json` and `minecraft-roster-results.json` in the same artifacts folder.

The preview deliberately sets twelve completed boss victories before asking the real simulation to spawn each family, so it exercises the same post-boss unlock gates used in a real endless run.
