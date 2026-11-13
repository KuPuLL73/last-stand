# Gameplay HUD — Gemini reference, 4 November 2026

final result: passed

## Source, scope and comparison

The user asked for a similar in-game interface and explicitly removed the lower-left movement/control hint. The existing game, models, map, simulation, shop and lobby are the foundation.

- Source truth: `reference/gemini-gameplay-hud.png`, an unchanged copy of the supplied image.
- Source: 1024×572 pixels. Final implementation: `game/artifacts/hud-gemini-1024.png`, 1024×572 screenshot pixels and CSS viewport, density 1. No rescaling was used for comparison.
- Full-view combined comparison: `game/artifacts/hud-reference-comparison.png`. Left is the reference; right is the actual IAB render.
- Focused, original-pixel comparisons: `game/artifacts/hud-reference-details.png`, covering portrait/HP/XP, timer, buff, loadout and ability.
- State: Steve, level 2, 175/175 HP, 00:10 elapsed, three kills, rapid attack six seconds, a three-item loadout. The separate `game/artifacts/hud-review.html` dev fixture arranges real simulation data/models and freezes the update for stable inspection. This is not a claim of naturally earning that precise state or of a screenshot-only implementation. The actual game was tested separately.
- Additional final screenshots: `hud-gemini-390-late.png` (390×844), `hud-gemini-320-late.png` (320×720), `hud-gemini-844-late.png` (844×390), all in `game/artifacts/`. They show all five statuses, a boss, a full loadout and touch controls. The combination deliberately stresses layout and can include mutually exclusive statuses.

## Findings and fixes

No actionable P0/P1/P2 issues remain in the inspected states.

1. [P2, fixed] The first central timer was 128×67 and duplicated the boss countdown. It is now a compact two-line timer, about 112×54, with the countdown in the right panel. Evidence: `hud-gemini-1024-v1.png` versus the final source comparison.
2. [P1, fixed] A legacy `.touch-mode #boss-hud` rule stretched the mobile boss strip across the status badges. The final overrides have explicit body-state specificity; portrait boss health occupies the right column and statuses occupy the left. Evidence: `hud-gemini-390-late-v1.png` versus `hud-gemini-390-late.png`; the same correction was checked at 320×720.
3. [P2, fixed] Showing both the selected weapon and a separate generic damage-upgrade sword duplicated the loadout. Damage rank is now attached to the actual selected weapon icon. All other earned upgrades remain visible and wrap on phones.
4. [P2, fixed] Numeric debuff labels crowded the compact status slot. Their typography was reduced inside the slot, while the full status name and timer remain visible.
5. [P3, fixed] The first timer used a heavier type weight than the reference. Medium Tektur at weight 700 now gives clearer numerals and preserves tabular alignment. Final full-view and detail comparisons were recaptured after the fix.

## Required fidelity surfaces

- Typography: existing Tektur, explicit medium weights for the hero/timer, tabular time and HP/XP counts. Small UI copy wraps without clipping at the inspected widths. The existing project font is retained; it is not an exact identification of the generated reference's font.
- Spacing/layout: hero panel and local XP at upper left; timer centered; compact combat tools at upper right; buffs along the left; loadout centered at the bottom; bow in the lower-right corner. Full mobile loadout does not cross the joystick or ability. No lower-left desktop hint remains in DOM or JavaScript.
- Colors/tokens: dark slate/steel surfaces, pale text, red HP, turquoise XP and cream timer; poison retains a distinct HP tint. Thin double borders keep the reference's game-panel treatment.
- Images/assets: the actual Minecraft wooden sword and bow pixels, existing physical-boost renders and existing project upgrade icons are used. Music/skull come from the already bundled Pixelarticons library; pause comes from the same pinned 2.4.2 library. Provenance is in `game/assets/hud/sources.json`; no new hand-drawn SVG/icon approximations or background replacements were introduced.
- Copy/content: actual HP, XP, level, kills, stage, boss time, selected weapon, upgrade ranks, buff timers and bow charge are connected to the current run. The word “stage” preserves the requested boss-victory progression.

## Intentional adaptations / P3 polish

- The reference's decorative silhouettes at upper right become a useful boss countdown. Hero/buff panels and the ability are slightly larger for readable live values and touch targets.
- Original three-dimensional collectible icons, the real purchased weapon and earned upgrade ranks take precedence over the reference's illustrative potion/arrow labels. There are no extra potion or ammunition systems implied by decorative art.
- The reference's clipped timer corners are interpreted as the same restrained metal-panel family with slightly rounded corners. This is a similar design, not a promise of pixel-identical copying.
- Arena positions and actor orientation are simulation content, outside this interface redesign. Existing world art is retained.

## Browser and interaction evidence

- Browser: Codex IAB. The ordinary `survival.html` route was used for real interactions, independently of the frozen review fixture.
- `game/artifacts/hud-ui-results.json`: ten successful observed checks covering sound, choosing an upgrade, activating bow, equipped-item updates, pause, resume, hidden gameplay UI during pause, removed hint, nested XP and loaded image assets/clean console. The initial attempts to click sound/bow while an upgrade overlay was open were correctly blocked; the final sound/ability checks were performed during active play.
- No JavaScript or rendering errors were observed in the actual game tab. The review fixture initially called an incorrect helper name; it was corrected to `_spawnEnemy` and final review renders completed successfully.
- `game/artifacts/hud-viewport-observations.json` records actual panel rectangles for the three mobile viewports. Touch controls are enabled explicitly in the fixture; no physical phone or touch-device performance claim is made.
- The ordinary game is left open and the temporary viewport override was reset. Sound was restored to its initial enabled setting.
- Production build: successful, 188 modules. The prior balance/core verification remains separately recorded; no balance logic was changed by this interface update.

## Implementation checklist

- [x] Source and implementation opened together, full-view and detail comparisons completed.
- [x] HP/XP compacted; clock, combat tools, effects and loadout restyled.
- [x] Lower-left movement hint removed with its JavaScript dependency.
- [x] Full boss/status/loadout states checked at desktop, narrow portrait and landscape sizes.
- [x] Primary controls checked in the actual game; console checked; production build passed.
- [x] All P0/P1/P2 findings fixed and recaptured.
