# PixelFX source subset

Upstream: https://github.com/patch-gg/pixelfx/tree/044e12a45dc9cc312cec50ee606dfc98afe5adc2

This directory contains the unchanged PixelFX math, colour, drawing, shape, font and simulation modules needed by the arena's offline FX exporter. It also contains the upstream PNG encoder. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md) for Patch and Hugo Duprez's notices.

Run `node game/tools/export-pixel-fx.mjs` in the game directory to regenerate the atlas. The authored effects live in `game/tools/pixel-fx-designs.mjs`. They use PixelFX's painter, ordered dithering, rings, sparkle, flare and crystal primitives with arena-specific palettes and timing. The exporter composites the separate light buffer over transparency. The game uses the resulting atlas as a single nearest-filtered texture.

Design approach: [How to make good pixel art effects](https://www.spritefusion.com/blog/how-to-make-good-pixel-art-effects-with-claude). The contact sheet records onset, build, peak and decay for review. Add `--gif` with FFmpeg on `PATH` to record the overview in motion.
