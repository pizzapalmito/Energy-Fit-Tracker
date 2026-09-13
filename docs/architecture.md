# Repwise architecture

Repwise is a static, single-user PWA. React renders the interface, Dexie owns local persistence, and pure domain engines calculate recovery, substitution, progression, and workout recommendations. There is no runtime server.

## Data flow

1. A versioned, generated catalog seeds IndexedDB without replacing custom exercises.
2. UI features read and write through repositories.
3. Each completed set is persisted immediately with an absolute timestamp.
4. Workout exercises retain catalog snapshots so later catalog revisions cannot rewrite history.
5. Domain engines receive immutable facts and return versioned results plus human-readable explanations.
6. Derived recovery and recommendations are recalculated; backups preserve reconstruction facts.

## Deployment

The application uses hash routing and a Vite base of `/muscle-pizza/`. GitHub Pages serves the generated static bundle and service worker. A new worker waits for user approval and must not reload an active workout.

## Release evidence

Static/unit, browser automation, packaged PWA, and real-iPhone evidence are reported separately. Playwright WebKit is useful compatibility evidence but is not equivalent to installed Safari on iOS.
