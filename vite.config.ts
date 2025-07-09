import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  
  // Resolve aliases
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@pages': resolve(__dirname, './src/pages'),
      '@hooks': resolve(__dirname, './src/hooks'),
      '@utils': resolve(__dirname, './src/utils'),
      '@contexts': resolve(__dirname, './src/contexts'),
      '@assets': resolve(__dirname, './src/assets'),
    },
  },
  
  // CSS configuration is handled by postcss.config.js
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
    },
  },
  
  // Development server configuration
  server: {
    port: 3000,
    open: true,
  },
  
  // Build configuration
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 1000, // Increase limit to 1MB
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React core
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-core';
          }
          
          // React ecosystem
          if (id.includes('node_modules/react-router-dom') || id.includes('node_modules/react-icons')) {
            return 'react-ecosystem';
          }
          
          // Firebase
          if (id.includes('firebase')) {
            return 'firebase';
          }
          
          // Utilities
          if (id.includes('node_modules/date-fns') || id.includes('node_modules/lodash')) {
            return 'utilities';
          }
          
          // Markdown and text processing
          if (id.includes('node_modules/react-markdown') || id.includes('markdown')) {
            return 'markdown';
          }
          
          // Other vendor libraries
          if (id.includes('node_modules/')) {
            return 'vendor';
          }
        },
      },
    },
  },
  
  // Optimize deps
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'date-fns',
      'date-fns/format',
      'date-fns/formatDistanceToNow'
    ],
    exclude: [
      'firebase/firestore',
      'firebase/auth',
      'firebase/storage'
    ]
  },
});
