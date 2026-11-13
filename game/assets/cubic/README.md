# Cubic forest stage assets

The block and plant pixels are from **Minecraft Java Edition 1.21.9**, published by Mojang. They were extracted from the original client JAR referenced in [sources.json](./sources.json).

Official archive: https://piston-data.mojang.com/v1/objects/ce92fd8d1b2460c41ceda07ae7b3fe863a80d045/client.jar

Reference for the oak forest environment: https://www.minecraft.net/da-dk/article/forest

`game/tools/cubic-textures.py` reproducibly creates the padded atlas and applies a forest biome tint to the original grayscale grass/leaves pixels. The grass floor uses a continuous repeating texture; it has no random per-block colors or seams. All new stage geometry and collision layout are authored in `game/cubic-stage.js`.

The stage batches repeated blocks with instancing and shares one block atlas. Both trees inside the clearing have trunk collision boxes. `createCubicArena(...).update(player)` fades their canopies when the player is nearby to keep combat visible.

Visual checks: `game/tools/cubic-map-check.mjs`, with results and desktop/mobile screenshots under `game/artifacts/cubic-map-*`.

The screenshots use stationary test enemies to show the four mob silhouettes on the real playable map; the game rules and wave progression are not changed by this QA fixture.
