import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

import {
  computeLafea4Tech13ImplementationFingerprint,
} from './scripts/lib/lafea4-tech13-implementation-fingerprint.mjs';

const buildTime = new Date().toISOString();
const tech13Implementation = computeLafea4Tech13ImplementationFingerprint({
  rootDir: fileURLToPath(new URL('.', import.meta.url)),
});

/** Dedicated standalone LAFEA build target with graph-owned chunking. */
export default defineConfig({
  base: '/Advanced_Analysis/',
  plugins: [],
  define: {
    __BUILD_TIME__: JSON.stringify(buildTime),
    __LAFEA4_TECH13_IMPLEMENTATION_FINGERPRINT__: JSON.stringify(tech13Implementation.fingerprint),
  },
  build: {
    outDir: 'dist-lafea',
    emptyOutDir: true,
    modulePreload: false,
    manifest: true,
    rollupOptions: {
      input: {
        lafea: fileURLToPath(new URL('./lafea.html', import.meta.url)),
      },
    },
  },
});
