# Lightweight cubic-world shaders

The Minecraft-style arena uses local material shaders in `cubic-shaders.js`; it does not add an image-wide postprocessing chain.

- Water retains its original pixel texture. Analytic ripple normals, a restrained sky/Fresnel tint and moving soft crests animate its surface without moving the water plane or changing collision geometry. This is a lightweight sky tint, not screen-space reflections.
- Plant tops and decorative leaf blocks sway slightly. Trunks, landmarks and every playable obstacle stay fixed. Nearest texture filtering remains intact.
- Warm direct light, cooler ambient light and a small face-dependent material tint give block surfaces clearer separation. Existing PCF shadows are softened slightly; no additional shadow pass is introduced.
- A single points batch adds sparse sunlit dust near the forest edges: 26 points on desktop, 10 on mobile. Mobile wind amplitudes and point sizes are smaller. Dust never covers the central clearing densely.

## API

`createCubicArena(scene, {mobile, reducedMotion})` returns the existing arena fields plus:

```js
arena.update(player, {
  dt: active ? dt : 0,
  elapsed: run.state.elapsed,
  effects: profile.effects !== false,
  paused: !active,
});
const diagnostics = arena.effectsState;
```

The two-argument update is backwards compatible with `update(player)`. Shader time accumulates from finite, active `dt`; pause, upgrade choices, hidden-tab gameplay pauses and reduced motion do not advance it. `effects:false` stops wind/water motion and hides dust. The runtime's shared “Эффекты” setting controls this behavior. The internal `elapsed` option is accepted for integration consistency; shader time uses active deltas so restarts or test time jumps cannot cause a visual discontinuity.

`effectsState` reports enabled/animating/time, mobile/reduced-motion mode, the shader material count, compiled material count, mote count and the single added draw-call budget. These values describe scene cost, not a physical-device FPS claim.

The former tree at `(-14.5, 7.5)` was shifted to `(-17.5, 7.5)`: its trunk and entire canopy previously sat in the middle of the decorative pond. This peripheral scenery adjustment does not alter any of the seven playable collision landmarks.

## Checks and evidence

Run `node game/tests/cubic-shaders-browser.mjs` with the local server on port 5190. It verifies real shader compilation, original texture filtering, active/frozen time, unchanged solid instance matrices and pond vertices, effects/reduced-motion controls, mobile budgets, actual survival starts and pauses in both phone orientations, and the settings switch during normal gameplay.

Evidence in `game/artifacts/`:

- `cubic-shaders-results.json`
- `cubic-shaders-gameplay.png`
- `cubic-shaders-water-a.png` / `cubic-shaders-water-b.png`
- `cubic-shaders-mobile-390.png` / `cubic-shaders-mobile-844.png`
- `cubic-shaders-actual-390.png` / `cubic-shaders-actual-844.png`

Phone captures use browser emulation. Performance and battery use on a physical device remain to be assessed there.
