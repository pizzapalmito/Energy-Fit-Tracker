# Greek-ink catalog media provenance

## Scope

The reviewed Greek-ink exercise illustrations in `public/catalog/greek-ink-sheets-v1/` replace the bundled start/end demonstration media for the accepted exercise tiles. They are project-owner-authorized generated artwork, not third-party workout-app imagery.

## Reproduction and audit

- `accepted.json` is the review gate: only its accepted sheets may be integrated.
- `plan.json` records the exercise-to-tile assignment.
- `source-sheets/` retains each accepted source sheet in WebP; `exercises/` contains its named WebP crops.
- `scripts/catalog/integrate-greek-ink-media.mjs` converts any newly approved PNGs to WebP and applies the overlay to the catalog media.
- `npm run catalog:build -- --source <pinned-checkout>` and `npm run catalog:check -- --source <pinned-checkout>` apply the same overlay after the pinned free-exercise-db build, so the generated media is retained and checked.

Each exercise tile depicts its start and finish motion within one framed illustration. The same WebP tile is intentionally used for the catalog's `start.webp` and `end.webp` slots to preserve the established media contract.
