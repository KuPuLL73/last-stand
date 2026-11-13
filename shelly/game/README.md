# Shelly playable character

`shelly-game.glb` is a self-contained GLB with the approved model, face geometry,
packed texture, skeleton, and three animation clips:

| Clip | Duration | Use |
| --- | --- | --- |
| `Idle` | 1.3333 s | Loop |
| `Walk` | 1.0000 s | Loop, in place |
| `Attack` | 1.1667 s | One shot |

The model uses glTF axes: up `+Y`, forward `+Z`. At Idle frame 0 its height is
3.9677 units and its feet are at Y = 0.12. A scale around 0.46 gives a character
about 1.83 units tall. Play Idle and call `mixer.update(0)` before measuring the
skinned bounds; the bind pose is not the hand-held weapon pose.

Walk has no root motion. The root position is identical at all sampled frames;
the hips return to their starting position at the loop boundary. Movement in
the game must be applied to an outer player group.

Both new clips explicitly include static finger and gun-bone transforms from
their source animation nodes. These transforms must not be dropped when
exporting or trimming the clips. Facial patches, including the fixed eyebrows,
are copied from the approved model and remain weighted to `head_s`.

## Rebuild

1. Run `tools/game-decode-walk.py` using regular Python with the existing flat
   converter dependencies to decode the saved public source.
2. Run `tools/build_game_character.py` with Python 3.12.
3. Run Blender with `--python tools/game-verify.py` to render five verification
   frames, or append `-- --metrics-only` to check bounds and root motion only.

## Sources

The approved character and texture are copied from `../model/shelly.glb`.
Animation references originate from the public repository
https://github.com/tailsjs/brawl-stars-assets/tree/master/69.230/sc3d
(`shelly_idle.glb`, `shelly_walk.glb`, `shelly_attack.glb`). The SC Odin flatbuffer
converter is the existing local research tool in `../tools/flat-converter`.
These are game-derived source assets, not newly generated original geometry;
the source game's intellectual-property rights remain with their owner.

Actual 3D verification renders are `verify-idle-0.png`, `verify-walk-6.png`,
`verify-walk-18.png`, `verify-attack-4.png`, and `verify-attack-12.png`.
`animation-validation.json` contains measurements from evaluated mesh vertices.
