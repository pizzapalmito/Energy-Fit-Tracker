import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { MAX_ASSET_BYTES } from './scripts/catalog/limits.mjs'

export default defineConfig({
  base: process.env.BASE_PATH ?? '/Energy-Fit-Tracker/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/*.{svg,png}'],
      manifest: {
        name: 'Energy Fit Tracker',
        short_name: 'Energy Fit',
        description: 'A private, offline-first workout tracker.',
        display: 'standalone',
        start_url: './#/today',
        scope: './',
        background_color: '#05050a',
        theme_color: '#05050a',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,webp,json,ttf}'],
        maximumFileSizeToCacheInBytes: MAX_ASSET_BYTES,
        cleanupOutdatedCaches: true
      }
    })
  ],
  test: {
    environment: 'jsdom',
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: { reporter: ['text', 'html'] }
  }
})
