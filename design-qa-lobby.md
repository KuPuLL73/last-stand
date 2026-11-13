# Pixel lobby — final verification, 2 November 2026

final result: passed

## Scope and source truth

This completes the interrupted fog/water/background-cleanup request, retaining the menu style the user already approved. It is not a new redesign.

- Source dimensions: 1376×768 pixels. Implementation: `game/artifacts/lobby-motion-a.png`, 1376×768 CSS px and screenshot px, deviceScaleFactor 1. Main menu, Shelly selected, panels closed.
- Full-view comparison and focused 1:1 navigation strips in the same image: `game/artifacts/lobby-final-comparison.png`. Full views are both shown at 50%; navigation crops retain source pixels.
- Focused same-coordinate terrain/ore comparison: `game/artifacts/lobby-background-detail-comparison.png`, before `world-clean.webp` versus final `world-polished-v2.webp`, both 1672×941. Analytical crops only; no source artwork was procedurally repainted.
- Final moving proof: `game/artifacts/lobby-atmosphere-final.mp4`; original current-run recording: `game/artifacts/lobby-motion-recording.webm`.

## Findings and comparison history

1. Earlier P2: the close control disappeared after scrolling a long inventory/achievement panel. The previous chat added a sticky header. Current menu/atmosphere checks confirm the close control remains visible at desktop and mobile sizes; evidence includes `game/artifacts/pixel-sticky-390.png` and `pixel-sticky-inventory.png`.
2. Earlier P2: torn red-island steps and edges. The interrupted chat's polished backgrounds repair the rectilinear terrain. Same-coordinate final detail comparison confirms the repair is retained.
3. Current first comparison P2: ore in `world-polished.webp` was still nearly identical to the blurry prior version. Evidence preserved in `game/artifacts/lobby-background-detail-comparison-v1.png`. Two targeted built-in ImageGen edits produced the v2 backgrounds, with prompts/originals retained. Final focused comparison and independent image review show sharper mineral insets, clean cube faces and no new obvious seams or crop drift. WebGL and CSS fallback both use v2.
4. Fog was previously too faint. Latest shader uses visible drifting side layers; current desktop capture and recording show them. There is one portal pass, with no duplicate CSS ring. Water and particle motion advance; all layers stop behind panels and under reduced motion.

No remaining actionable P0/P1/P2 issue found within this cleanup scope. Small inherited differences remain: library outline navigation icons instead of filled reference illustrations; a single live hero and compact selector as explicitly requested; no painted UI or extra static flying sparks. A tiny decorative chest in the mobile v2 illustration became an ore cube during the art edit; this does not change a game control or collectible and is treated as minor background variation (P3).

## Required fidelity surfaces

| Surface | Result |
|---|---|
| Fonts and typography | Local Tektur display/body treatment remains consistent, Cyrillic labels are intact; no new wrapping or clipping. Source lettering is raster art and is not an exact font match. Inherited 7px labels at 320px remain a P3 comfort refinement. |
| Spacing/layout rhythm | Reference hierarchy, upper logo/tools, central platform and dominant gold play CTA retained. Single hero and compact selector follow user changes. All five navigation actions fit tested sizes; scrolling dialogs retain close controls. |
| Colors/tokens | Midnight blue/cyan portal, warm gold action, slate panels and orange scenery remain consistent. Fog adds a restrained cool/warm layer without covering labels. |
| Image quality/assets | Generated bitmap art is retained; terrain steps/cube faces improved. Both v2 backgrounds preserve portal/platform placement and crop. No custom SVG/CSS replacement of background or button artwork. |
| Copy/content | Existing concise Russian labels and hero-specific content remain intact; no editing prompts or implementation details appear in the menu. |

## Runtime evidence and limits

- Current-run checks: 70 core tests, 38 menu browser checks, 14 atmosphere browser checks, all pass; production build passes after final asset switch.
- Atmosphere suite rerun after v2: JavaScript/GPU shader errors `[]`; portal/water/mist/particles advance, settings and reduced motion stop them, panels freeze rendering, starting gameplay hides the atmosphere.
- Responsive screenshots: `game/artifacts/lobby-motion-390.png`, `lobby-motion-320.png`, `lobby-motion-844.png`. These are derived responsive layouts, not comparisons to a nonexistent phone mock.
- Desktop/mobile render calls observed in the atmosphere report are scene-cost indicators; no physical phone or sustained hardware FPS measurement was performed.

Implementation checklist: complete for this request. Next verification is visibility and smoothness on the user's physical phone.
