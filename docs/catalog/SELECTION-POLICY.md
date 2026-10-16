# Selectable exercise decision — 2026-10-16

The owner confirmed the cumulative modern muscle-highlight cohort: **347 rollout exercises generated October 2–5 plus 27 completion exercises generated October 13 = 374 selectable catalog entries**. The exact 91 remaining seeded entries, including `ab-roller`, are retired. The checked-in `src/catalog/selection-policy.json` is authoritative across clones. It pins one approved candidate and image checksum per selectable exercise, rather than selecting every historical approval or inferring approval from timestamps.

Keep all 465 catalog records and all original assets for compatibility. The 91 retired records have `excluded: true`; search, generation, substitution and new workout entry points must reject them even if an old backup or stale caller sets `excluded: false`. Existing workout snapshots, sets and active/completed histories remain untouched. Genuine user-created exercises remain available subject to the user's own exclusion flag.

The eight reserved `repwise-*` bundled program definitions have no approved modern images and are also unavailable for new selection, despite their historical `source: custom` label. Existing records remain intact. Do not silently drop or substitute movements in the built-in program: incompatible templates cannot start, and the UI explains how to use manual/generated workouts. Reauthoring that program requires a separate owner decision.

## Why the old artwork returned

The upstream importer retained Ab Roller as strength; the Greek-ink overlay copied the accepted sheet-046 tile to both display slots. A later individual audit rejected that tile's kneeling mechanics, but that separate audit was not a build gate. The newer muscle rollout skipped calisthenics, leaving the old tile in place. A name/category cleanup never implemented retirement. Original Ab Roller tile SHA-256: `db109792feff7da4e30d09ae4f9c15d7b3e109cb7ecb2c187eae36208bd48152`.

Build integration applies retirement after the existing media overlays and recalculates the content-addressed catalog version. `npm run build` checks membership, approval, candidate hashes, source images and both display slots. Startup enforces retirement even when the catalog version already matches; backup restoration applies it transactionally. Runtime guards protect stale catalogs and saved templates without modifying recorded history.

## Validation and integration

Run `npm run validate`, `npm run catalog:check -- --source <pinned-source>` and `npm run test:e2e`. Regression cases must cover a pre-policy backup, same-version reseeding, Ab Roller search/direct-add rejection, stale generated plans, substitutions, bundled programs, genuine custom records and unchanged historical snapshots.

This local correction starts at GitHub `9f14053`; it is not a deployment. The Mac checkout has independent iOS/glass/export work at the same baseline and acknowledged read-only ownership during this correction. Integrate the reviewed policy/runtime patch deliberately; reconcile its version/package, tests and guidance with Mac changes before rebuilding native assets. Never copy the older dirty Windows checkout wholesale.

## Local verification — 2026-10-16

Candidate `0.1.1-beta.3`, catalog `catalog-40a0e6ffd2a6cbf2`: lint/typecheck/branding/build PASS; 390 tests in 43 files PASS; pinned-source reproduction of catalog, audit and all media PASS. Eleven production-PWA workflows PASS using existing Chromium 1248, including old-backup restore, same-version reload, Ab Roller absence, historical/custom preservation and all 748 selected display slots offline. Two 390px policy captures inspected. All 1,834 original artwork files and all 807 protected authoring changes are byte-preserved. Pinned Chromium 1193, WebKit, physical iPhone and packaged Mac/iOS integration remain unverified; no browsers installed or releases published.
