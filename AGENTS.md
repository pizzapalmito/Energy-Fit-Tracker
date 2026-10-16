# Energy Fit Tracker instructions

Read `docs/catalog/SELECTION-POLICY.md` before changing catalog, media, workout entry points or imports.

- The owner selected exactly 374 modern muscle-highlight exercises on 2026-10-16. `src/catalog/selection-policy.json` binds their IDs, approved candidate IDs and SHA-256 hashes. Its 91 retired catalog IDs and eight bundled image-free definitions must not become selectable again during an update.
- Older sheet acceptance, retained files, earlier approvals and upstream imports do not authorize reactivation. Changing this cohort requires an explicit owner decision and a reviewed policy change.
- Preserve genuine user-created exercises, historical workouts, snapshots, sets, original assets and unrelated authoring changes. Retirement changes selection, never deletes history. Do not reset, clean, commit, push or deploy without authorization.
- Keep the app offline-first. IndexedDB remains authoritative for user data; canonical units and existing backup/database identities remain unchanged.
- Use repository accessors and shared selection guards; never bypass the policy with a stale object, saved template or imported backup.
- Run `npm run validate`, pinned-source `npm run catalog:check -- --source <source>`, and relevant Playwright workflows. Report unrun device checks separately. App version authority is `package.json`; update changelog/version for meaningful user-visible changes.
- Published baseline for this correction is `9f14053`. The separate Windows authoring checkout has extensive unpublished work and must not be copied wholesale into this patch. Coordinate with the Mac iOS task before integration.
