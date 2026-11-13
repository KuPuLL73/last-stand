# Steve equipment and animation

The body uses the default Steve skin from Mojang's Java Edition 1.21.9 client. The lightweight cuboid mesh, limb hierarchy, procedural movement and survival attack animation are project code.

Sword and bow pixels are original Minecraft item textures, extruded by one pixel. Their held transforms are taken directly from `assets/minecraft/models/item/handheld.json` and `assets/minecraft/models/item/bow.json` in the official client archive referenced by `steve-sources.json`.

- Sword third-person right hand: rotation `[0,-90,55]`, translation `[0,4,.5]`, scale `.85`.
- Bow third-person right hand: rotation `[-80,260,-40]`, translation `[-1,-2,2.5]`, scale `.9`.
- A single coordinate conversion changes Minecraft's Y-down, front-negative-Z model coordinates to this project's Y-up, front-positive-Z coordinates.
- The shoulder pivots are at `x=±5`, `y=22` in the 32-pixel character; the arm cuboids extend two pixels above and ten pixels below their pivots. This matters for correct held-item contact.
- Bow arms use Mojang's `bow_equipped` pose: [official Bedrock player animation](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/animations/player.animation.json). Bow draw stages use the original `bow_pulling_0`, `bow_pulling_1`, and `bow_pulling_2` pixels, including their own string and arrow.

`createMinecraftItem(kind,{pull})` returns a `THREE.Group` with the original third-person mounting transform already applied. Attach it to the right shoulder bone, whose arm hangs along local negative Y; geometry scale assumes `1.85 / 32` metres per Minecraft pixel. `pull=-1` is the resting bow and `0..2` are its original draw stages.

The survival sword attack intentionally differs from vanilla's small attack motion: the user's chosen design is a smooth horizontal area cleave. It keeps the exact idle grip, uses a 0.07-second windup, crosses the forward contact area at approximately 0.14 seconds, follows through to 0.20 seconds, and recovers by 0.43 seconds. `attack({interval,duration})` compresses the same curve for faster attacks. Straight block arms and walking legs are preserved.

`game/tools/steve-fidelity-check.mjs` checks the item contact stays inside the fist, the mount has no animation drift, arms do not bend at artificial elbows, the nocked arrow faces forward, and the blade sweeps more than 110 degrees with less than eight centimetres of height variation. It also captures front, profile, and three-quarter views.

`steve-diamond.glb` includes Walk and SwordSlash clips. `steve-bow.glb` includes the drawn-bow pose and walking with the bow held correctly. Runtime draw-stage swapping is procedural in `steve-model.js`.
