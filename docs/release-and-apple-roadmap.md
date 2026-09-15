# Release maturity and Apple platform roadmap

This document is the delivery contract for turning Energy Fit Tracker into a dependable product and then a native Apple app. Complete each gate in order. A passing unit suite does not replace browser, installed-device, TestFlight, purchase, or sync evidence.

## Current PWA release candidate

The September 2026 hardening pass closes the data-loss and reporting defects found in the maturity audit:

- Workout finish and discard are guarded atomic lifecycle transitions. A stale rename patches only the name and cannot reactivate a completed workout.
- Exercise removal deletes the exercise instance and its sets in one transaction.
- Generated workouts, initialized sets, exercise snapshots, and the generator audit record are created in one transaction.
- Progress, personal records, totals, and CSV exports use completed workouts only. Eight-week consistency uses local calendar weeks and remains between 0 and 100 percent.
- Set edits start an IndexedDB write on every parseable change. A small synchronous draft journal recovers the latest focused field if a reload interrupts the asynchronous browser write.
- Settings initialization preserves fields the user has already edited while the IndexedDB query is still resolving.
- Backup export reads a consistent transaction snapshot. Restore rejects oversized files, unknown tables, malformed records, invalid enums/ranges/dates, duplicate primary keys, multiple active workouts, and broken parent relationships before replacing local data.
- CSV text that could be interpreted as a spreadsheet formula is neutralized.

Run the release-candidate gates from the repository root:

```powershell
npm run validate
npm run test:e2e
npm run catalog:check -- --source <path-to-pinned-free-exercise-db-checkout>
git diff --check
```

Then use a disposable profile on a real iPhone and verify:

1. Add the PWA to the Home Screen, launch it with airplane mode enabled, and browse the full catalog.
2. Start a workout, add an exercise and set, enter load and reps, reload while the final field still has focus, and confirm both values return.
3. Complete a set, let the timer run, background the app for five minutes, reopen it, and confirm the workout, set, and timer remain correct.
4. Finish one workout and discard another. Confirm only the finished workout contributes to Progress and CSV.
5. Export a backup, add more data, restore the backup, and verify the restored state. Try a deliberately damaged copy and confirm the app refuses it without changing current data.
6. Switch among English, Brazilian Portuguese, French, and Spanish. Check VoiceOver labels, Dynamic Type/zoom, focus visibility with a keyboard, reduced motion, safe areas, and 44-point touch targets.
7. Install an updated build over the previous installed version and confirm existing workouts, settings, custom records, and the selected locale remain intact.

Record the device model, iOS version, build/commit, pass or fail for each step, and any screenshots. The PWA is ready to become the behavioral reference only after this real-device gate passes.

## Product scope before native development

The first commercial release serves individual gym users. Its free tier remains useful without an account or connection:

- Free: offline workout logging, built-in catalog and program, basic progress/history, local backup/restore, and one saved custom routine.
- Pro: unlimited saved routines, advanced progress insights, and Apple-device sync.
- Proposed prices: US$1.99 monthly and US$14.99 yearly. Configure localized prices in App Store Connect rather than hard-coding display prices.

Do not restrict access to a user's recorded workouts after a subscription lapses. Keep reading, exporting, and deleting existing data available. Disable creation beyond the free routine limit and pause Pro-only calculations/sync while preserving all stored facts.

The native beta remains offline and has no paywall. Add StoreKit and CloudKit only after the local native workflows and PWA parity fixtures pass.

## Swift conversion sequence

Native development requires a supported Mac, the current Xcode release, an Apple Developer Program membership, a unique bundle identifier, and physical iPhone test devices. Create the Xcode workspace only after the PWA release-candidate gate is signed off.

### 1. Freeze portable contracts

Export representative version-1 backups containing empty state, a completed workout, a discarded workout, an active interrupted workout, kg and lb settings, each locale, recovery feedback, a template, a generated plan, and a historical exercise missing from the current catalog. Remove personal data from fixtures.

Write a language-neutral contract beside the fixtures for:

- IDs and entity relationships.
- Canonical kilograms, metres, seconds, local workout dates, and UTC timestamps.
- Workout lifecycle transitions and the single-active-workout invariant.
- Exercise snapshots and algorithm version fields.
- Backup format/checksum validation and forward-version rejection.
- Deterministic recovery, progression, substitution, and generation inputs/outputs.

Use the TypeScript fixtures as golden vectors. Swift tests must produce the same decisions and numeric results before UI work is accepted.

### 2. Build the native core

Create a Swift package named `EnergyFitCore` with no SwiftUI, StoreKit, or CloudKit dependency. Use value types conforming to `Codable`, explicit enums, injected clocks and ID generators, and pure engine protocols. Mirror the current repository boundaries with protocols for workouts, exercises, sets, settings, feedback, templates, and generated-plan audit records.

Use SwiftData for local persistence only after migration tests prove the model can import the frozen JSON contract without losing IDs or snapshots. Keep database mutations in actors or `@ModelActor` services. Implement workout creation, generated-workout creation, finish/discard, and cascade removal as transactions at the persistence boundary.

### 3. Build the SwiftUI beta

Reproduce the workflow in this order: Today/resume, active workout logging, exercise picker/detail, finish/discard, History/Progress, Settings, and backup/restore. Preserve one-handed controls, VoiceOver labels, Dynamic Type, reduced motion, safe-area layout, semantic green/orange/magenta colors, and immediate persistence.

Use navigation and state restoration that survive process termination. Test background/foreground, low-storage errors, interrupted imports, clock changes, locale changes, and rapid repeated taps. Ship the first internal TestFlight build only when the local native suite and all golden parity vectors pass.

### 4. Add subscriptions with StoreKit 2

Create one subscription group with monthly and yearly auto-renewable products. Suggested product IDs are `com.energyfittracker.pro.monthly` and `com.energyfittracker.pro.yearly`; confirm the final bundle identifier before creating products because product IDs become operational contracts.

Prototype both products in an Xcode StoreKit configuration first. Use StoreKit 2 signed transactions as the entitlement source, listen for transaction updates, finish verified transactions, expose Restore Purchases and Manage Subscription actions, and test new purchase, renewal, expiration, cancellation, billing retry, refund/revocation, offline launch, and family-sharing decisions. The paywall must show the App Store supplied localized name, price, billing period, and required subscription terms.

Apple describes StoreKit views and local StoreKit configuration in [Getting started with In-App Purchase using StoreKit views](https://developer.apple.com/documentation/storekit/getting-started-with-in-app-purchases-using-storekit-views), and its subscription lifecycle guidance is in [Auto-renewable subscriptions](https://developer.apple.com/app-store/subscriptions/).

### 5. Add Apple-device sync

Add sync after the offline TestFlight beta is stable. Use the user's private CloudKit database; Apple states that this data is private to the user by default and counts against their iCloud quota. Keep local SwiftData usable when iCloud is unavailable or signed out.

Give each record a stable ID, modification timestamp, tombstone/deletion marker, schema version, and deterministic conflict policy. Test two devices editing the same workout, offline edits on both devices, deletes, account sign-out/in, quota exhaustion, partial failures, and upgrades from the offline-only build. Never make CloudKit availability a condition for logging a workout.

See Apple's [private CloudKit database documentation](https://developer.apple.com/documentation/cloudkit/ckcontainer/privateclouddatabase) and [SwiftData CloudKit configuration](https://developer.apple.com/documentation/swiftdata/modelconfiguration/cloudkitdatabase-swift.struct/private(_:)).

## App Store operating path

1. Check the product name and mark with legal counsel, reserve the app record, choose the bundle ID/SKU, and enroll in the paid-app agreements. Add tax and banking details before configuring paid products.
2. Create the app record, subscription group, two subscription products, localization, support URL, marketing URL, privacy-policy URL, age rating, category, and review contact in App Store Connect.
3. Produce device-specific screenshots and copy for every supported storefront language. Avoid medical or injury-prevention claims; recovery remains a training-readiness estimate.
4. Add `PrivacyInfo.xcprivacy`, declare required-reason API use accurately, audit every SDK, and make the App Privacy answers match actual collection. A local/CloudKit-only product should avoid advertising identifiers, tracking, and analytics SDKs unless the product decision changes.
5. Run unit, migration, UI, accessibility, StoreKit, CloudKit, archive, and real-device tests. Upload an archive, distribute internal TestFlight, then external TestFlight, resolve crashes and tester findings, and repeat the release gate on the exact submission build.
6. Submit the app and subscriptions together when required, provide review notes and a working path to exercise Pro behavior, and keep backup/export available to the reviewer.
7. After approval, use phased release, monitor crashes, reviews, subscription conversion/churn, and CloudKit errors, and maintain a tested rollback/hotfix path. Metrics should use Apple's aggregate App Analytics unless explicit, privacy-reviewed product analytics are later approved.

Apple's current workflow requires an App Store Connect record before build upload and uses TestFlight before review; paid apps and in-app purchases also require agreements, tax, and banking setup. See [App Store Connect workflow](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-workflow) and [Submitting to the App Store](https://developer.apple.com/app-store/submitting/). Apple also requires privacy disclosures for submissions and a privacy manifest for applicable data and required-reason APIs; see [User privacy and data use](https://developer.apple.com/app-store/user-privacy-and-data-use/) and [Privacy manifest files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files).

## Release evidence

For every PWA, TestFlight, or App Store candidate, keep a release record with:

- Source commit, semantic version, build number, database/backup schema, catalog revision, and engine versions.
- Exact commands and PASS, FAIL, BLOCKED, or NOT RUN results.
- Desktop browser, mobile browser, installed PWA, iPhone, StoreKit sandbox, CloudKit multi-device, TestFlight, and App Review evidence as separate rows.
- Known limitations, migration rollback notes, privacy-manifest report, third-party license audit, and support owner.
- SHA-256 hashes for downloadable backup fixtures or packaged artifacts used for acceptance.
