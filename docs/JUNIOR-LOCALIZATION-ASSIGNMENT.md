# Junior Assignment — Repwise UI localization

## Role and target

You are the junior implementation developer. Work only in:

`C:\Users\lielp\OneDrive\BKDocuments\ChatGPT\Repwise`

Codex is the senior engineer and final release gate. Read `AGENTS.md`, `PROJECT-MEMORY.md` (Snapshot and Rules first), `README.md`, and `docs/architecture.md` before editing. Inspect the relevant existing source and tests before choosing implementation details.

## Objective

Add complete application-interface localization for four locales:

- English (`en`) — existing default
- Portuguese, Brazil (`pt-BR`)
- French (`fr`)
- Spanish (`es`)

Users must be able to change language in Settings, see the interface update immediately, and retain the selection after reload/offline restart.

## Required behavior

1. Add a small, typed, dependency-free localization layer suitable for this static offline-first React PWA.
2. Persist the selected locale in the existing singleton `AppSettings` record. Add a Dexie migration only if required by the repository's schema rules, and add/update migration coverage.
3. Keep English as the safe fallback. Existing users with no locale saved must continue in English. Reject or safely normalize unsupported persisted/backup locale values.
4. Update `document.documentElement.lang` when the active locale changes.
5. Add an accessible Language control to Settings, using native language names: English, Português (Brasil), Français, Español.
6. Localize all application-authored user-facing UI copy across the shell and feature screens, including headings, buttons, form labels/options, status/error/empty-state/confirmation text, PWA update text, units/goal/split/equipment/muscle/readiness labels, generator explanations presented by the UI, and accessibility text such as aria-labels, image alternatives, and dialog labels.
7. Use locale-aware formatting for interface numbers and dates wherever formatting is user-facing. Preserve canonical kg/metres/seconds/UTC data and existing unit conversion behavior.
8. Keep route paths, IDs, enum values, database values, backup shape semantics, CSV schema semantics, exercise identifiers, and engine contracts stable. Translate labels at the UI boundary.
9. Do not translate user-entered content or the generated exercise catalog's names/instructions in this assignment; those are content datasets, not interface chrome. The surrounding labels and accessibility phrases must still be localized.
10. Switching languages must not reload the page, require a network connection, disturb an active workout, or erase/change other settings.
11. Add focused tests for locale fallback/key completeness/interpolation or pluralization, settings persistence/migration, and at least one live language switch that verifies both visible and accessibility copy. Update existing assertions carefully without weakening behavior checks.
12. Extend the Playwright workflow to verify changing language in Settings persists across navigation/reload and then restore English so later checks remain deterministic.

## Constraints and non-goals

- Preserve all product invariants and unrelated behavior.
- No runtime API, external translation service, analytics, authentication, remote AI, new package installation, or new dependency.
- Do not modify generated catalog/media assets merely to translate content.
- Do not redesign the UI or perform unrelated cleanup/reformatting.
- Do not commit, push, create/merge a PR, reset, clean, delete material data, or change external systems.
- Preserve pre-existing changes. The pre-assignment tree includes Codex-created `PROJECT-MEMORY.md`, the one-line project-memory reference in `AGENTS.md`, and this assignment document; do not revert or rewrite those except for a narrowly justified project-memory checkpoint after implementation.
- Stop and report `BLOCKED` if repository instructions conflict, required access is unavailable, destructive work appears necessary, or a decision would materially alter architecture/product behavior.

## Acceptance checks

Run and report exact outcomes for:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

If any cannot run, mark it `NOT RUN` or `BLOCKED`; never imply an unrun check passed. Do not claim real-iPhone/Add-to-Home-Screen verification.

## Completion report

Report:

- `PASS`, `FAIL`, `BLOCKED`, and `NOT RUN` items explicitly
- changed files
- implementation summary and architecture choices
- exact validation commands and outcomes/test counts
- known limitations, risks, assumptions, and questions
- confirmation that no commit/push/reset/clean/install/external-system change occurred
- final approval left to Codex
