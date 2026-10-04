# Valence icons

One icon family, derived from the Valence mark
(`docs-site/docs/assets/icon.svg`: the nucleus with three electrons in the
ring). Every variant is the same flat silhouette: a thick violet ring around
a large cyan core, the electrons as small light dots inside the ring band, no
glow, no gradients, no knockout gaps. These SVGs are the sources; every PNG,
ICO and ICNS is generated.

| Source | Artwork | Sizes | Used for |
|---|---|---|---|
| `icon-app.svg` | Ring, core and electron dots on the chassis square (#111318), full-bleed 1024 canvas | 48 px and up | Phosphor app icon: Windows ICO 48/64/256, PNG ladder, macOS ICNS (inside Apple's 824 px rounded square with its margins), Linux hicolor 128 plus scalable SVG, iOS, Android. Site `apple-touch-icon.png` (180) and `icon-512.png`. |
| `icon-small.svg` | The same proportions on a 30 px grid | 24, 32 px | ICO 24/32, `32x32.png`, `Square30x30Logo.png`, site `favicon-32.png` |
| `icon-16.svg` | The same proportions on a 14 px pixel grid (2 px ring) | 16 px | ICO 16, site `favicon.svg` |
| `icon-mono.svg` | Ring and core only, single color (black) on transparent, 16 px grid | Any | Status badges, the macOS menu bar template (tinted by the system), favicon masks |
| `avatar.svg` | Ring and core only on a full square tile (the host crops the corners) | 512 | GitHub org avatar, uploaded by hand |

The ring's outer edge reaches about 80% of the tile width at every size (2 px
inside the tile edge at 16). The app variants sit on a rounded square (corner radius about 22% of the
side; transparent outside it), except the iOS and apple-touch icons, which
stay square for the system mask. The Windows ICO ladder renders each layer
with a 1 px clear edge.

Regenerating: edit only these SVGs, then run `npm run icons` in Phosphor
(`tools/icons.mjs`). Never hand-edit a generated PNG, and never fill a 16
to 32 px slot with a downscale of the 1024.
