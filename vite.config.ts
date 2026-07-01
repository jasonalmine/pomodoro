import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Tauri sets TAURI_ENV_* in the environment of its before{Dev,Build}Command.
// Inside the desktop shell we disable the service worker: a SW under the tauri://
// custom protocol causes stale-asset and navigation-fallback quirks, and the
// native app bundles its assets anyway. VitePWA stays registered (so the
// `virtual:pwa-register/react` import in PWAUpdatePrompt still resolves to a
// no-op); only SW generation/registration is turned off. The web/PWA build is
// unchanged.
const isTauri = !!process.env.TAURI_ENV_PLATFORM

// https://vite.dev/config/
export default defineConfig({
  // Tauri dev needs a stable port matching devUrl in tauri.conf.json.
  server: { strictPort: true },
  plugins: [
    react(),
    VitePWA({
      disable: isTauri,
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Pomodoro',
        short_name: 'Pomodoro',
        description: 'A reflection-first focus timer with projects, tasks, and a daily ritual.',
        theme_color: '#0b0b10',
        background_color: '#0b0b10',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache built assets. HTML falls through to /index.html for the SPA,
        // and Supabase / AI provider hosts are excluded from caching entirely so
        // every call hits the live network.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css', cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
