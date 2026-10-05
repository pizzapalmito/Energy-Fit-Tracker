# Reviewed muscle-highlight images

This release contains 347 original matte 3D exercise composites with localized primary-muscle highlights. New corrections use smooth featureless oval heads. Other approved images are retained.

Each manifest entry binds the exported WebP hash, original native PNG hash, exact final prompt, exercise specification, muscle mapping and individual review/browser evidence. Native sources and rejected drafts remain preserved in the authoring workspace; they are not runtime dependencies. The immutable WebP library is the build source. No runtime API is used.

Both `catalog:build` and `catalog:check` apply this library after the pinned upstream and existing Greek-ink generation. They fail before writing images if any approval, exercise specification, muscle mapping or artwork checksum has changed. Original artwork is preserved by Git history and the authoring backups.

The GitHub catalog retains all 465 exercise records. This image release does not delete calisthenics or alter workout records, history, persistence, exercise instructions or muscle mappings. Real installed-iPhone testing is still unverified.

Release validation: pinned-source `catalog:check` passes; `npm run validate` passes lint, typecheck, branding, 370 tests and the production build. The complete Windows browser suite passes 15 tests with one existing WebKit offline skip. Chromium verifies all 694 image slots offline; both browsers verify upgrade preservation and six representative dialogs. Twelve captured dialogs were visually inspected for full framing and presentation.
