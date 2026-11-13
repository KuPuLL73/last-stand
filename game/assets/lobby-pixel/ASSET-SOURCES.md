# Pixel lobby asset sources

## Font

Tektur by Adam Jagosz. Official author repository: https://github.com/hyvyys/Tektur
Pinned source commit: aa45c4b0c85d971d9df103337e37d6ed47b6f3d0
License: SIL Open Font License 1.1; exact text in fonts/OFL.txt.

Original unmodified WOFF2 files: Regular (400), Medium (500), Black (900). Full source URLs and SHA256 hashes are in fonts/SOURCES.json. These fonts include Cyrillic; the local cmap validation covers every Russian uppercase/lowercase letter including Ё/ё.

Use the Black face for square display labels and PLAY, Regular or Medium for body copy. Declare separate @font-face rules with family Tektur and matching font-weight. Use font-display:swap; local URLs keep the menu independent of Google Fonts/CDNs. Do not fake 900 by stretching or repeatedly outlining a thin face.

## Icons

Pixelarticons free npm package v2.4.2 by Gerrit Halfmann. Official docs: https://pixelarticons.com/docs/
Package: https://www.npmjs.com/package/pixelarticons
Repository: https://github.com/halfmage/pixelarticons
License: MIT; exact package license in LICENSE.pixelarticons.txt.

icons.json contains original, unmodified library SVG source plus the inner body and source filename/URL/hash for each semantic key. No SVG artwork was drawn or redrawn for this selection.

Usage: import the JSON through Vite; take icons[name].body inside a 24-by-24 SVG with fill=currentColor, aria-hidden=true and focusable=false. The original full SVG is also available as icons[name].svg. Set the accessible name on the containing button. Prefer 24px or 48px displayed sizes so the original pixel grid lands on whole pixels.

Keys: shop, inventory, leaderboard, achievements, settings, help, music, swap, play, gems, skull, sword, shield, sparkle, close, check, music-off, back, crown.

The free Pixelarticons release has no actual bow icon. Keep the existing native bow weapon image; target was deliberately not relabeled as a bow.

Keep both license notices with the distributed game files. No network icon/font requests or additional npm runtime dependency are required.
