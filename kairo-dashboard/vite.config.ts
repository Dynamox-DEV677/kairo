import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// VitePWA + Workbox is the single biggest memory consumer in the build pipeline.
// Vercel's free/hobby tier gives ~4GB total — workbox alone can spike to 2GB+
// during precache manifest generation, on top of Rollup/Rolldown's own usage.
// Default to OFF on Vercel; flip ENABLE_PWA=true to opt back in (e.g. on Pro).
const PWA_ENABLED = process.env.ENABLE_PWA === 'true'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // When the real PWA plugin isn't loaded, stub `virtual:pwa-register` so
    // `src/lib/pwa.ts` still bundles — without this, Rolldown fails to
    // resolve the import and the whole build errors out.
    ...(!PWA_ENABLED ? [{
      name: 'kairo-pwa-register-stub',
      resolveId(id: string) {
        if (id === 'virtual:pwa-register') return '\0virtual:pwa-register'
        return null
      },
      load(id: string) {
        if (id === '\0virtual:pwa-register') {
          return `export function registerSW(_options) { return (_reload) => {} }`
        }
        return null
      },
    }] : []),
    ...(PWA_ENABLED ? [VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['kairo_logo.png', 'favicon.svg'],
      manifest: {
        name:             'Kairo — Accelerate Your Academics',
        short_name:       'Kairo',
        description:      'AI-powered school operating system for Indian classrooms.',
        theme_color:      '#6366f1',
        background_color: '#0a0a0a',
        display:          'standalone',
        orientation:      'portrait',
        scope:            '/',
        start_url:        '/',
        categories:       ['education', 'productivity'],
        icons: [
          { src: '/kairo_logo.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/kairo_logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/kairo_logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        globIgnores: ['**/models/**', '**/*.glb'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'kairo-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'kairo-cdn',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: { enabled: false },
    })] : []),
  ],
  build: {
    chunkSizeWarningLimit: 1500,
    sourcemap: false,
    // Aggressive code-splitting keeps Rolldown's per-chunk peak memory low.
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('node_modules/three/')) return 'three'
          if (id.includes('node_modules/@react-three/')) return 'r3f'
          if (
            id.includes('react-markdown') ||
            id.includes('remark-') ||
            id.includes('rehype-') ||
            id.includes('katex') ||
            id.includes('mdast') ||
            id.includes('hast') ||
            id.includes('micromark') ||
            id.includes('unist')
          ) return 'markdown'
          if (id.includes('framer-motion')) return 'motion'
          if (id.includes('@supabase/')) return 'supabase'
          if (id.includes('lucide-react')) return 'icons'
          return undefined
        },
      },
    },
  },
  server: {
    port: 3002,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
