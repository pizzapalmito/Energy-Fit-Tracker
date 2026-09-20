# free-exercise-db provenance record

- Source: https://github.com/yuhonas/free-exercise-db
- Pinned revision: `a859101d633a01c4a1a920d6a8ce41dabba0705f`
- Retrieved for audit: 2026-09-12
- Upstream license file: `LICENSE.md`
- License: Unlicense / public-domain dedication
- Upstream inventory at the pinned revision: 873 exercise directories; 95.04 MiB across the `exercises` tree before transformation

## Intended use

Energy Fit Tracker imports exercise names, classification fields, instructions, muscle associations, and start/end demonstration images. The import process normalizes identifiers and vocabulary, validates every record, applies the versioned `focused-strength-v1` curation profile, converts included images to WebP, and records rejected records.

The focused profile keeps exactly 438 broadly useful `strength` movements for progressive resistance training. It excludes stretching, cardio, plyometrics, strongman, Olympic-lifting and powerlifting-specialist categories, then ranks the remaining strength movements deterministically toward common gym equipment and compound movements while deprioritizing technical, balance, rehabilitation, and novelty variants. The full upstream inventory remains provenance evidence; it is not all shipped in the app.

The upstream license states that the repository is free and unencumbered software released into the public domain and permits copying, modification, publication, use, and distribution. Energy Fit Tracker retains this provenance record even though attribution is not required by the Unlicense.

The app must not fetch these assets from GitHub at runtime. Only artifacts reproduced from this pinned revision and emitted by the audited build pipeline may be packaged for offline use.

## Generated artifacts and evidence

- Verbatim upstream license text: `docs/licenses/free-exercise-db-LICENSE.txt`
- Machine-readable audit report (input/output counts, rejected records, missing media, byte totals, conversion settings): `docs/catalog/audit-report.json`
- Generated catalog + converted media consumed by the app: `public/catalog/catalog.json`, `public/catalog/media/**`
- Reproduce with `npm run catalog:build -- --source <pinned-checkout>`; verify with `npm run catalog:check -- --source <pinned-checkout>` (regenerates into a temp directory and diffs hashes against the committed output without mutating tracked files).
- At the pinned commit, the combined dataset (`dist/exercises.json`) contains 876 exercise records; 873 of them reference start/end images (2 each, 1746 images total), matching the 873 image directories observed in the upstream tree. The `focused-strength-v1` output ships 438 selected exercises; exact included-media counts are recorded in the generated audit report. The remaining 3 upstream records have no bundled images.

Some catalog media is intentionally overlaid with owner-authorized Greek-ink generated artwork after the pinned-source conversion. Its separate provenance and review gate are documented in `docs/catalog/greek-ink-media.md`.
