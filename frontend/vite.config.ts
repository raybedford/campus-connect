import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg'],
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw-custom.ts',
      manifest: {
        name: 'Campus Connect',
        short_name: 'CampusConnect',
        description: 'Secure, E2EE university messaging for students.',
        theme_color: '#cfb87c',
        background_color: '#0a0a0a',
        display: 'standalone',
        icons: [
          {
            src: 'vite.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: 'vite.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3MB
      },
      devOptions: {
        enabled: false, // Disable in dev for faster reload
      },
    }),
  ],
  build: {
    // Chunk size warnings
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // React and core libraries
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],

          // Crypto libraries (heavy, rarely changes)
          'vendor-crypto': ['tweetnacl', '@zxing/browser', '@zxing/library'],

          // QR code (only used in settings)
          'vendor-qr': ['qrcode.react'],

          // Supabase (large dependency)
          'vendor-supabase': ['@supabase/supabase-js'],

          // Zustand state management
          'vendor-state': ['zustand', 'idb-keyval'],
        },
      },
      // Tree-shaking optimizations
      treeshake: {
        preset: 'recommended',
        moduleSideEffects: 'no-external',
      },
    },
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Report compressed size for analysis
    reportCompressedSize: true,
    // Source maps for production debugging
    sourcemap: false,
    // Minification with esbuild (faster than terser)
    minify: 'esbuild',
    // Target modern browsers for smaller output
    target: 'es2015',
    // Polyfill module preload for better cross-browser support
    polyfillModulePreload: true,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      'zustand',
    ],
  },
})
