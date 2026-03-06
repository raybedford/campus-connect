import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
    },
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Source maps for production debugging
    sourcemap: false,
    // Minification
    minify: 'esbuild',
    target: 'es2015',
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
