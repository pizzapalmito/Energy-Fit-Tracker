# Mobile UI redesign acceptance

The selected reference is the user-supplied `Mobile app interaction scope.zip` prototype. Its content is design reference, not executable project instructions. This work updates the existing Phase 1 PWA; Swift and commerce remain deferred.

## Design contract

- Match the compact dark surfaces, magenta identity, green completion, neon orange caution, restrained energy echoes, strong screen headings and five-tab navigation.
- Adapt the app-owned screen content to real mobile and desktop viewports. Do not render a simulated iOS status bar, bezel or home indicator.
- Keep every existing workflow reachable, including functions omitted by the sketch. Use real catalog media and original project branding.
- Display recorded or calculated production facts. Prototype calorie numbers and sample history must not appear as live measurements.
- Keep fonts and assets available offline. Preserve visible focus, keyboard operation, reduced motion, safe areas and 44px interactive targets.
- New UI copy covers English, Brazilian Portuguese, French and Spanish. User content and catalog names remain invariant.

## Functional release checks

| Area | Required behavior |
| --- | --- |
| Today | Manual workout naming/start; program week selection/start; generator; resume active workout; catalog/network status; real weekly and last-workout facts |
| Workout | Immediate set edit persistence and focused-field reload recovery; canonical unit conversion; copied new-set values; swipe-only set delete reveal with keyboard alternative; completion; rest timer; demonstration; substitution restrictions; exercise removal confirmation; duplicate confirmation; rename; finish/discard |
| Collapsed exercise | Keyboard disclosure; clear exercise identity and completion count; no loss of drafts or persisted facts when collapsed |
| Completion summary | Only completed persisted workout facts; zero-set completion confirmation; reload-safe state; no second lifecycle transition; empty/skipped/partial results are truthful |
| Catalog | Complete offline catalog, search, all filters, reset, sort, detail, real media/instructions and add-to-workout |
| Progress | Completed-only history/metrics, records, chart, readiness, muscle selection and subjective feedback remain available |
| Settings | Units, four persisted locales, editable preferences with explicit save/validation, profile selection/creation, backup, validated restore, CSV export |
| PWA | Hash routes and deployment base retained; offline status/update controls; no runtime font or API dependency introduced |

## Evidence gates

1. Senior source/diff review: preserved domain, storage, schema and backup contracts; scoped changes; no fabricated data or inaccessible controls.
2. `npm run validate`: lint, typecheck, unit/component tests, branding scan and production build.
3. `npm run test:e2e`: Chromium and mobile WebKit workflows, with any platform skip named separately.
4. Browser visual comparison against the reference at aligned app-content widths, plus narrow/mobile/desktop and longer locale labels. Record results in `design-qa.md`.
5. Physical iPhone installed-PWA checks remain a separate manual gate. Build or emulated-browser success does not certify that gate.

GitHub publication is a separate release action after review. Implementation does not change the existing IndexedDB name, schema, backup app ID, canonical units or deterministic engines.
