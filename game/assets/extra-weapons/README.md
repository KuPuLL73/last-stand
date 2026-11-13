# Extra Minecraft weapon items

`snowball.png`, `trident.png`, and the two trident display JSONs are unmodified resources from the locally cached Mojang Minecraft Java 1.21.9 client (`ce92fd8d1b2460c41ceda07ae7b3fe863a80d045`). `sources.json` records archive paths and SHA-256 hashes. Reproduce with `python game/tools/extract-extra-weapons.py` from the project directory.

The held and projectile meshes are authored voxel extrusions of those original item pixels. Snow uses crossed coloured extrusions to remain readable from the overhead camera; the thrown trident is oriented tip-forward on local +Z. These generated meshes are not represented as the original Java entity meshes. The slowing snowball and unlimited throwable trident are this game's weapon roles. No returning/homing trident behavior is implied.

Definitions are in `game/extra-weapons.js`; the central `game/economy.js` supplies final prices when the main catalog merges them. `game/extra-projectiles.js` exports `createExtraProjectileGeometry('snowball' | 'trident')`: shared BufferGeometry with normals and linear vertex colours, sized in world units for renderer scale 1 and yaw `atan2(vx,vz)`.

Checks: `extra-arsenal-assets.test.mjs` (3), `extra-arsenal-browser.mjs` (3), and `extra-arsenal-gameplay-browser.mjs` (5). Gameplay checks buy and reload the real loadout in isolated browser profiles, then arrange stationary durable targets to isolate one real shot. They verify actual projectile batches, slow application, and damage falloff on the second trident target. Those arranged targets are not a naturally occurring game session.
