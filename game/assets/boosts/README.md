# Shared collectible artwork

These five transparent 256×256 PNGs are rendered directly from the game's beveled 3D meshes in `game/boost-models.js`, rebuilt from the supplied Gemini prop concepts. The HUD uses the same geometry and materials as the real world collectibles, including the shield's segmented glass shell.

| ID | World/HUD symbol | Meaning |
|---|---|---|
| heal | White case, red lid, raised crosses and gold clasps | Restore up to 25 health |
| haste | Turquoise trainer, white feather wings and open cuff | +35% movement speed for 10 seconds |
| rapid | Radial burst of seven brass cartridges and a large central round | Attack interval ×0.6 for 8 seconds |
| shield | Cyan/gold shield inside a segmented cyan sphere | No damage for 6 seconds; clears poison/slow |
| magnet | Red/blue horseshoe, silver poles and green XP crystals | Collect all arena XP once |

These are volumetric props with fixed world poses, not medallions or camera-facing planes. Top and side details stay visible from the gameplay camera. Low-amplitude hovering pauses with simulation time; reduced motion disables it. Meshes remain instanced by boost type.

To rebuild the PNGs after editing the 3D shapes, keep the dev server running on port 5190 and execute `node game/tools/render-boost-icons.mjs` from the project directory. Source export scene: `game/artifacts/boost-icon-render.html`. `boost-icons.js` imports the same PNGs for active buffs, the nearby-item card and the help panel.

World/collection/status proof: `game/tests/boost-gameplay-browser.mjs`. Concept geometry, batching, expiry and export checks: `game/tests/boost-gemini-browser.mjs`. Current renders: `game/artifacts/boost-gemini-models.png` and `boost-gemini-world.png`. Mobile and desktop arena screenshots: `boost-world-390.png`, `boost-world-844.png`, `boost-world-1280.png` in `game/artifacts/`.
