# EFT logo source

`eft-logo-source.jpg` is the product owner's supplied neon "EFT" wordmark artwork, selected on 2026-09-15 to replace the prior generated open-E logo concept. It is a 1254x1254 JPEG with a black background; pixel content is unchanged from the supplied file (EXIF metadata was stripped losslessly).

This is treated as the product owner's design asset. Independent third-party rights clearance has not been performed.

## Regeneration

All derived logo/icon assets are produced deterministically from this source by `scripts/generate-icons.mjs` using the already-installed Sharp toolchain. To regenerate every derived asset after changing this source file, run:

```
node scripts/generate-icons.mjs
```

This produces:
- `public/icons/favicon-32.png` — 32x32 resize of the full square source.
- `public/icons/icon-180.png`, `icon-192.png`, `icon-512.png` — square resizes of the full source for the home-screen/app icon and Apple touch icon.
- `public/icons/icon-maskable-512.png` — the square source resized to 384px and centered on a 512x512 black canvas, keeping the wordmark inside the maskable safe circle.
- `public/brand/eft-logo.webp` — the header lockup, cropped to `x=20, y=220, width=1220, height=800` to trim empty black margin while retaining the glow, encoded as WebP quality 88.

No other cropping, recoloring, or restyling is applied; the neon lettering, colors, and black background are retained as supplied.
