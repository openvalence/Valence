# Valence icons

One icon family, derived from the Valence mark
(`docs-site/docs/assets/icon.svg`: the nucleus with three electrons in the
ring). These SVGs are the sources; every PNG, ICO and ICNS is generated.

| Source | Artwork | Sizes | Used for |
|---|---|---|---|
| `icon-app.svg` | Flat full-color mark (no glow or gradient at any size) on the chassis square (#111318) with a #1D2026 hairline frame, full-bleed 1024 canvas | 48 px and up | Phosphor app icon: Windows ICO 48/64/256, PNG ladder, macOS ICNS (inside Apple's 824 px rounded square with its margins), Linux hicolor 128 plus scalable SVG, iOS, Android. Site `apple-touch-icon.png` (180) and `icon-512.png`; org avatar (512). |
| `icon-small.svg` | Simplified silhouette, flat colors, electrons with knockout gaps, 14 px grid | 24, 32 px | ICO 24/32, `32x32.png`, `Square30x30Logo.png`, site `favicon-32.png` |
| `icon-16.svg` | Pixel-grid silhouette: 2 px ring, solid white electrons, no knockouts (ring plus core carries the family at this size) | 16 px | ICO 16, site `favicon.svg` |
| `icon-mono.svg` | Single color (black) on transparent, 16 px grid | Any | Status badges, the macOS menu bar template (tinted by the system), favicon masks |

The Windows ICO ladder renders each layer with a 1 px clear edge.

Regenerating: edit only these SVGs, then run `npm run icons` in Phosphor
(`tools/icons.mjs`). Never hand-edit a generated PNG, and never fill a 16
to 32 px slot with a downscale of the 1024.
