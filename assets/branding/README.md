# EFT logo source

`eft-logo-source.png` is the product owner's supplied marble-and-gold Greek EFT crest, selected on 2026-09-20. It is a 1254x1254 PNG with a transparent background; pixel content is unchanged from the supplied file.

This is treated as the product owner's design asset. Independent third-party rights clearance has not been performed.

## Regeneration

All derived logo/icon assets are produced deterministically from this source by `scripts/generate-icons.mjs` using the already-installed Sharp toolchain. To regenerate every derived asset after changing this source file, run:

```
node scripts/generate-icons.mjs
```

This produces:
- `public/icons/favicon-32.png` — 32x32 resize of the full square source.
- `public/icons/icon-180.png`, `icon-192.png`, `icon-512.png` — square resizes of the full source for the home-screen/app icon and Apple touch icon.
- `public/icons/icon-maskable-512.png` — the square source resized to 384px and centered on a 512x512 black canvas, keeping the crest inside the maskable safe circle.
- `public/brand/eft-logo.webp` — the transparent header crest, encoded as WebP quality 90.

No cropping, recoloring, or restyling is applied; the marble, gold, and transparent background are retained as supplied.
