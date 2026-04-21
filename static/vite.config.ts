/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  oxc: false, // Disable oxc and use esbuild instead

  // Force every part of the graph to resolve the same single React/ReactDOM
  // instance. Without this, Vite's dep-optimizer can bundle the CommonJS
  // React copy for libraries like zustand / @react-three / @elevenlabs
  // while the app itself uses the ESM copy — two React instances, hook
  // dispatcher returns null, everything crashes on first hook call.
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
  },

  // Pre-declare every prod dep here so Vite bundles them all ONCE at startup
  // instead of discovering them lazily and triggering a mid-session
  // re-optimization (which is what was blanking the page: re-optimize →
  // stale bundles briefly live alongside fresh ones → duplicate React →
  // invalid hook call → tree unmounts).
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'zustand',
      // The following are only needed once we add them back; harmless if
      // missing at the time this config is read because Vite tolerates
      // include entries it cannot resolve yet.
      '@react-three/fiber',
      '@react-three/drei',
      'three',
      '@elevenlabs/client',
    ],
  },

  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  },
});
