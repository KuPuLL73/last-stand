# Pudge reference model and runtime conversion

Pudge's body, skinning, equipment geometry, and colour textures are Valve assets from the official Dota 2 Workshop reference package. They are not a newly generated model or a third-party recreation.

## Verified sources

- Official hero resource page: https://www.dota2.com/workshop/requirements/pudge
- Official reference archive linked by that page: https://media.steampowered.com/apps/dota2/workshop/pudge.zip?v=11161272
- The standard Pudge model is `pudge_base.zip` → `pudge_econ.fbx`; the archive also contains a separate persona package. This prototype uses the standard hero.
- Official Valve portrait: https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/pudge.png
- Local portrait is byte-identical to that 256×144 PNG; SHA-256 `a610c206ddabc1391d99050f8e07079a11bc7c589ad70930f7f371c96782e82b`.

## Conversion

`game/tools/pudge-convert.py` imports the official FBX in Blender, retains the original geometry, rig and skin weights, converts the colour maps to packed PNG images, and exports `pudge.glb`. The standard colour maps are used with a simple rough PBR material; Source-engine-specific shader masks are not interpreted as separate game materials.

The source archive, extracted FBX/Maya files, and conversion-reference textures are retained here for reproducibility. The production game imports only `pudge.glb` and `pudge-portrait.png`; those reference packages are not part of the Vite dependency graph and are not copied into the production bundle.

## Runtime model

`game/pudge-model.js` exports asynchronous `loadPudge()`. It returns `root`, `model`, `cleaver`, `hookMesh`, `update`, `attack`, `hook`, `reset`, and `dispose`.

- The body is scaled to approximately 2.05 metres, with its feet placed at ground height.
- Valve's two reference equipment meshes start at separate authoring origins. Runtime bakes those two rigid skins relative to `weapon_rt_1` / `weapon_lf_2` and mounts them to `wrist_R` / `wrist_L`; the original reference copies are hidden.
- Idle breathing, walking, the cleaver swing and hook gesture are project-authored runtime joint motions. They are not claimed to be imported Dota 2 gameplay animations.
- Rot's cloud and its game rules are implemented separately from this model controller.

## Model audit

`game/tools/pudge-audit.mjs` captures idle, two walking phases, two cleaver phases, a hook phase, and a profile view. Its report is `game/artifacts/pudge-audit-results.json`.

The audit checks finite transforms, positive bounded weapon scale, stable weapon-to-wrist offsets, the body height, and browser errors. Both equipment pivots remain approximately 0.15 metres from their wrist throughout the sampled poses. The mesh count includes the two hidden source equipment copies; the retained source topology is approximately 6,132 triangles before excluding those hidden copies.

Original art and trademarks remain Valve's. The Workshop reference download is attribution of the source, not a claim of a separate commercial redistribution licence.
