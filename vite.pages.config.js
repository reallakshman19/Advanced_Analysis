import { defineConfig, mergeConfig } from 'vite';
import baseConfig from './vite.config.js';

export default defineConfig(
  mergeConfig(baseConfig, {
    base: '/Advanced_Analysis/site/',
    build: {
      outDir: 'docs/site',
      emptyOutDir: true,
    },
  }),
);
