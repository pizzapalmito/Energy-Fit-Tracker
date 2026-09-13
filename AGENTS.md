# Repwise repository instructions

## Product invariants

- Repwise is offline-first. Normal workout, catalog, history, recovery, substitution, generation, export, and restore flows must not require a runtime API.
- IndexedDB is authoritative for user data. Persist important mutations immediately and preserve user/custom records across catalog updates.
- Store canonical kilograms, metres, seconds, and UTC timestamps. Unit conversion belongs at the UI boundary.
- Historical workout exercises retain an exercise snapshot. Pure engines consume recorded facts and expose an explicit algorithm version.
- Calculated recovery and subjective feedback remain distinct. Recovery is a training-readiness estimate, not medical advice.
- The product must not contain third-party workout-app branding, copied strings, screenshots, terminology, or proprietary assets.

## Architecture

- Keep business logic out of React components. Domain engines are deterministic, side-effect-free TypeScript.
- Access IndexedDB through repository classes. Schema changes require a Dexie migration and migration tests.
- Use CSS Modules and the shared design tokens. Preserve keyboard operation, visible focus, reduced-motion support, safe-area padding, and 44px touch targets.
- Keep GitHub Pages compatibility: hash routing and the `/muscle-pizza/` base path.

## Working rules

- Preserve unrelated and pre-existing changes. Do not reset, clean, commit, push, publish, or install software without explicit authorization.
- Do not add runtime cloud services, authentication, analytics, remote AI, or proprietary/uncleared exercise media.
- Generated catalog assets must be reproducible from the pinned source and accompanied by provenance/audit evidence.
- Report validation as PASS, FAIL, BLOCKED, or NOT RUN. An unrun check never passes.

## Validation

Run the focused tests for a change, then:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Use `npm run test:e2e` for user-visible workflow changes. Real iPhone Add-to-Home-Screen verification is a separate manual release gate.
