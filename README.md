# Repwise

Repwise is a private, offline-first workout tracker built as an installable progressive web app. It stores training data locally in IndexedDB and does not require an account, subscription, backend, or remote AI service.

## Development

Requires Node.js 20.15 or newer within the Node 20 line.

```powershell
npm install
npm run dev
npm run validate
npm run test:e2e
```

The production build uses `/Repwise/` as its GitHub Pages base path. Override `BASE_PATH` only for local or custom-domain deployments.

## Data and privacy

Workout data stays in the browser unless the user explicitly downloads a backup or CSV export. Browser storage is not a substitute for backups; Repwise provides reminders and validated restore tools.

Recovery and progression values are transparent training estimates, not medical advice.

## Third-party material

Exercise metadata and demonstration sources are tracked in [`docs/licenses`](docs/licenses). No third-party asset is packaged without a recorded source revision and redistribution basis.
