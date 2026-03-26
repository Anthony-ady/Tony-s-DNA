import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001, // Port par défaut pour le développement
    allowedHosts: true,
    // Configure fallback for client-side routing during development
    historyApiFallback: true,
    proxy: {
      '/api': {
        target: 'https://back.platform.gcp.omnitagjs.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/bo-api')
      }
    }
  },
  // Configure build settings for production
  build: {
    rollupOptions: {
      output: {
        // Ensure consistent asset naming
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        // Configuration pour le code splitting
        manualChunks: {
          // Séparer les bibliothèques UI en chunks distincts
          'ui-vendor': ['@radix-ui/react-accordion', '@radix-ui/react-alert-dialog', '@radix-ui/react-dialog'],
          'forms-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'utils-vendor': ['clsx', 'tailwind-merge', 'class-variance-authority'],
          // Séparer les pages principales
          'pages-placement': ['./src/pages/Placement/Placement.jsx'],
          'pages-broker': ['./src/pages/broker/Broker.jsx'],
          'pages-company': ['./src/pages/Company/Company.jsx'],
          'pages-dsp': ['./src/pages/DSP/DSP.jsx'],
          'pages-deal': ['./src/pages/Deal/Deal.jsx']
        }
      }
    },
    // Augmenter la limite de taille des chunks pour éviter les warnings
    chunkSizeWarningLimit: 1000
  },
  // Configure preview server for production testing
  preview: {
    port: 4173,
    strictPort: true,
    // Enable history API fallback for preview
    historyApiFallback: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json']
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
}) 