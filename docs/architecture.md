# Energy Fit Tracker architecture

Energy Fit Tracker is a static, single-user PWA. React renders the interface, Dexie owns local persistence, and pure domain engines calculate recovery, substitution, progression, and workout recommendations. There is no runtime server.

## Data flow

1. A versioned, generated catalog seeds IndexedDB without replacing custom exercises.
2. UI features read and write through repositories.
3. Each completed set is persisted immediately with an absolute timestamp.
4. Workout exercises retain catalog snapshots so later catalog revisions cannot rewrite history.
5. Domain engines receive immutable facts and return versioned results plus human-readable explanations.
6. Derived recovery and recommendations are recalculated; backups preserve reconstruction facts.

## Localization

The dependency-free `src/i18n` layer provides typed English, Brazilian Portuguese, French, and Spanish message catalogs. The selected BCP 47 locale is persisted in the singleton settings row (Dexie schema 3), defaults safely to English, updates the document language immediately, and formats interface dates, numbers, plurals, and fixed vocabulary at the UI boundary. User-entered text and generated exercise catalog names/instructions remain stored and displayed verbatim.

## Deployment

The application uses hash routing and a Vite base of `/Energy-Fit-Tracker/`. GitHub Pages serves the generated static bundle and service worker. A new worker waits for user approval and must not reload an active workout.

## Release evidence

Static/unit, browser automation, packaged PWA, and real-iPhone evidence are reported separately. Playwright WebKit is useful compatibility evidence but is not equivalent to installed Safari on iOS.
