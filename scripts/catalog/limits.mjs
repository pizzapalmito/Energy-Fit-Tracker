/**
 * Shared safety ceiling for any single emitted PWA-precached asset. This is
 * Workbox's own default `maximumFileSizeToCacheInBytes` (2MiB); we configure
 * Workbox with it explicitly rather than relying on the implicit default so
 * it stays in lockstep with the catalog build's own pre-flight check.
 * Imported by both vite.config.ts (to configure Workbox) and the catalog
 * build script (to fail fast if an emitted asset would exceed it).
 */
export const MAX_ASSET_BYTES = 2 * 1024 * 1024
