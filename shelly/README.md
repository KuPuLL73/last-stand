# Shelly — portable 3D study

This is an adaptation of an existing Brawl Stars game asset, not an original mesh generated from scratch.

- Character, body/weapon mesh, UVs, texture and source skeleton: Supercell.
- Public archive: https://github.com/tailsjs/brawl-stars-assets
- Geometry: `54.243/sc3d/shelly_redux_geo.glb`
- Texture: `54.243/sc3d/shelly_redux_tex.ktx`
- Idle motion and static finger/weapon transforms: `69.230/sc3d/shelly_idle.glb`
- Added here: portable modeled eyes (white, iris, pupil, highlights), facial attachment to the head joint, ordinary Principled materials, decoded PNG, corrected UV scaling, combined animation, export and studio lighting.

The original game uses facial overlays. These were replaced with surface-conforming eye patches, dark pupils, eyelids, eyelashes and a separate smile, attached to the head joint. The original independently animated eyebrows were replaced with smooth purple brows weighted only to the head. The pieces are real geometry in the self-contained GLB and follow the face curvature without protruding eyeball spheres. A copy of the first face version is retained as `model/shelly-face-v1.glb` and `.blend`. `renders/face-motion-check.json` records a six-frame check that the brows remain fixed relative to the head during the idle cycle.

Deliverables: `model/shelly.glb`, `model/shelly.blend`, `renders/shelly-hero.png` and front/side/back renders. The Blender scene includes the display stand; GLB contains the character only. The viewer at http://127.0.0.1:5190/ supports rotation, zoom, animation pause, wireframe and clay display.

Reference research:
- Full-body render: https://cdn.brawlify.com/brawlers/model/16000000.png
- Rotating comparison: https://sketchfab.com/3d-models/brawl-stars-shelly-3e697ade285f4fa6985d4354fde96f90 (viewed, not downloaded)
- Official animation: https://www.youtube.com/watch?v=CaryjOdYFa0
- Official remodel note: https://supercell.com/en/games/brawlstars/blog/release-notes/starrtoon-patch-notes/

Conversion tools retained with source notices:
- https://github.com/Daniil-SV/Supercell-Flat-Converter — FlatBuffer/Odin animation conversion. Local compatibility adjustment: flatten scalar accessor arrays for NumPy 2.5.
- https://github.com/BlaCoiso/scw_parse — GPLv3, used during SCW research; local fix to reuse `first.rotation` for unchanged rotation tracks.

All source files are kept locally for reproducibility. No upload/publication of this study has been performed.
