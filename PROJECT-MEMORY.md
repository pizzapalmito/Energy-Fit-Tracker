# Project Memory — Repwise

> An offline-first, installable workout tracker for a single user, with all training data stored locally in the browser.
> **Read order:** Snapshot → Rules → the module sections relevant to your task.
> **Maintenance:** Snapshot is replaced wholesale. Checkpoints, Decisions and Learnings are append-only — supersede, never rewrite. IDs are never reused. Archive: `project-memory/` (older entries, same IDs).

**Last updated:** 2026-09-13 · **Profile:** software-app · **Memory schema:** 1

## Snapshot
- **Status:** Four-language interface localization is validated on `main` and ready for user testing.
- **Where things stand:**
  - React 19/Vite UI uses hash routing and the `/Repwise/` deployment base.
  - Dexie/IndexedDB is authoritative for user data; schema version is 3 and persists the selected locale.
  - Typed catalogs cover `en`, `pt-BR`, `fr`, and `es`; interface copy, accessibility text, fixed vocabulary, dates, numbers, and plurals localize at the UI boundary.
  - Validation passes: 35 unit files / 298 tests, production build, brand scan, and 9 Playwright tests; the 1 WebKit offline-emulation case is intentionally skipped on Windows.
- **Next step:** User manual test of language switching and core workout flows; real-iPhone installed-PWA verification remains a separate release gate.
- **Blocked on:** Nothing.
- **Verify it works:** `npm run validate`, then `npm run test:e2e`; real iPhone Add-to-Home-Screen remains a separate manual gate.
- **Source of truth:** The `main` commit containing CP-004 and the localization implementation.

## Brief
- **Goal:** Deliver a private, offline-first workout tracker that is fast and dependable during real training sessions.
- **In scope / Out of scope:** Static PWA, local workout/catalog/history/recovery/generation/backup flows / runtime APIs, accounts, analytics, remote AI, and uncleared third-party assets.
- **Users / stakeholders:** The product owner and people using Repwise on phones, including installed-PWA use.
- **Constraints:** IndexedDB persistence, canonical metric domain values, UI-boundary conversions, accessibility, reduced motion, 44px touch targets, hash routing, and GitHub Pages `/Repwise/` compatibility.
- **Key locations:** `src/features/` — user workflows; `src/engines/` — pure deterministic domain logic; `src/data/` — Dexie schema and repositories; `src/catalog/` — reproducible exercise catalog; `e2e/` — browser workflows.
- **Related docs:** `README.md`, `AGENTS.md`, `docs/architecture.md`.

## Checkpoints

### CP-004 · 2026-09-13 · Four-language interface localization
- **State:** Repwise supports English, Brazilian Portuguese, French, and Spanish interface languages with an immediate, persisted Settings selector and English fallback.
- **Evidence:** `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (35 files, 298 tests); `npm run brand:scan` PASS; `npm run build` PASS; `npm run test:e2e` PASS (9 passed, 1 intentional Windows WebKit offline-emulation skip).
- **Ref:** Uncommitted working tree; `src/i18n/`, Dexie schema 3, and localization UI/test changes.
- **Deferred:** Real-iPhone Add-to-Home-Screen verification remains a separate manual release gate; generated exercise catalog and user-entered content remain verbatim by design.

### CP-003 · 2026-09-13 · Repwise deployment path
- **State:** Product and GitHub Pages base were renamed to Repwise.
- **Evidence:** Commit `141bd2a` is the current `main` and `origin/main` head.
- **Ref:** `141bd2a`

### CP-002 · 2026-09-13 · Streamlined logging and rotation
- **State:** Workout logging was streamlined and the built-in program rotation was added.
- **Evidence:** Merged feature commit in repository history.
- **Ref:** `5086979`

### CP-001 · 2026-09-12 · Release-candidate safeguards
- **State:** Phone PWA, catalog audit, persistence ordering, and release safeguards were established.
- **Evidence:** Commits `aa5b5df` through `47d28ea`; unit baseline re-run on 2026-09-13 passed 248 tests in 29 files.
- **Ref:** `47d28ea`

## Decisions

### D-002 · 2026-09-13 · Offline UI-boundary localization · Active
In the context of adding four interface languages to an offline-first PWA with stable domain and backup contracts, facing dependency, persistence, and historical-audit constraints, we chose typed in-bundle message catalogs plus UI-boundary presentation adapters and a schema-3 locale setting over a runtime translation service or translated domain records, to achieve immediate offline switching and stable stored facts, accepting that user-entered and generated exercise catalog content remains verbatim.
- **Revisit if:** Exercise-content localization becomes a product requirement or the supported locale count makes hand-maintained catalogs impractical.
- **Evidence / link:** `src/i18n/`, `src/data/db.ts`, `docs/architecture.md`

### D-001 · 2026-09-13 · Memory profile · Active
In the context of creating project memory, facing a React/Vite installable PWA with local persistence and explicit browser/release gates, we chose the software-app profile over library, research, or infrastructure profiles, to track runtime, UI, data, deployment, and release evidence, accepting that low-level module history remains in Git and focused docs.
- **Evidence / link:** `package.json`, `docs/architecture.md`, `AGENTS.md`

## Learnings
_None recorded yet._

## Rules
- Keep normal product flows fully offline and do not add runtime services, authentication, analytics, or remote AI. (`AGENTS.md`)
- Treat IndexedDB as authoritative; persist important mutations immediately and preserve custom and historical records. (`AGENTS.md`)
- Keep canonical kilograms, metres, seconds, and UTC timestamps; convert only at the UI boundary. (`AGENTS.md`)
- Keep business logic out of React; domain engines remain deterministic and side-effect-free. (`AGENTS.md`)
- Preserve accessibility, visible focus, reduced-motion support, safe-area padding, and 44px touch targets. (`AGENTS.md`)
- Preserve hash routing and the `/Repwise/` GitHub Pages base. (`AGENTS.md`)
- Report static/unit, browser automation, packaged PWA, and real-iPhone evidence separately. (`docs/architecture.md`)

## Run & Verify
| Purpose | Command | Expected |
|---|---|---|
| Start | `npm run dev` | Vite serves the local PWA (normally `http://localhost:5173`). |
| Full static/unit build gate | `npm run validate` | Lint, typecheck, 248+ unit tests, brand scan, and production build pass. |
| Browser workflows | `npm run test:e2e` | Playwright workflows pass; this is not real-iPhone proof. |

## Architecture Map
- `src/app/` — router and persistent shell; must retain hash-routing compatibility.
- `src/features/` — React workflow UI; must not own reusable domain algorithms.
- `src/engines/` — pure recovery, progression, substitution, and generation logic; must not access React or IndexedDB.
- `src/data/` — Dexie schema, migrations, repositories, and settings; schema changes require migration tests.
- `src/domain/` — canonical models and contracts; stores metric units and recorded facts.
- `src/catalog/` — pinned generated exercise data and media provenance; generation must remain reproducible.
- `src/services/` — backup/export boundaries; restore validation must fail safely.

## Environments & Releases
| Version | Date | Where deployed / who has it | Notes |
|---|---|---|---|
| 0.1.0 candidate | 2026-09-13 | GitHub Pages configuration on `main` | Static/unit and browser evidence are distinct from installed-iPhone acceptance. |

## Open Questions & Risks
- **R-001** Browser automation cannot certify installed Safari/Add-to-Home-Screen behavior — likelihood/impact: M/H — mitigation: keep real-iPhone verification as a separate manual release gate.
- **R-002** Generated exercise names/instructions and user-entered records remain verbatim, so non-English users can still encounter English catalog content — likelihood/impact: H/L — mitigation: keep the boundary explicit and treat content localization as a separate, provenance-aware feature.
