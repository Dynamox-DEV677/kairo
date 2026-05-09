import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
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
        // Skip large model files — caching 17MB+ of GLBs would blow up the SW.
        globIgnores: ['**/models/**', '**/*.glb'],
        // Bump the per-file precache cap so workbox doesn't choke on the
        // Three.js chunk if it grows past 2MB.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Don't cache API calls — always fresh
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
            // Never cache /api — always go to network
            urlPattern: /\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 1500,
    // Saves significant memory on Vercel's build VM
    sourcemap: false,
    // Split the heavy 3D / markdown stacks into their own chunks so the
    // bundler doesn't try to minify everything in one pass.
    // (Vite 8 uses Rolldown — manualChunks must be a function, not an object.)
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
