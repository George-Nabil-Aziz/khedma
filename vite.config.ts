import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // GitHub Pages serves the app from /khedma-2027/ — the deploy workflow sets BASE_PATH.
  base: process.env.BASE_PATH || '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'فصلي',
        short_name: 'فصلي',
        description: 'بيانات أولاد الفصل والافتقاد — Khedma',
        lang: 'ar',
        dir: 'rtl',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#110f21',
        theme_color: '#6a42e8',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell only — children data lives in IndexedDB, never in the service-worker cache.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
})
