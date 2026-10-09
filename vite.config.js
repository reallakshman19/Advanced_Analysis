import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

import {
  computeLafea4Tech13ImplementationFingerprint,
} from './scripts/lib/lafea4-tech13-implementation-fingerprint.mjs';

const buildTime = new Date().toISOString();
const tech13Implementation = computeLafea4Tech13ImplementationFingerprint({
  rootDir: fileURLToPath(new URL('.', import.meta.url)),
});

const PURE_LAFEA_MESHING_WORKSPACE_MODULES = new Set([
  '/src/workspace/lafea-analysis-mesh-evidence-v2.js',
  '/src/workspace/lafea-domain-first-mesh-custody.js',
  '/src/workspace/lafea-mesh-capabilities.js',
  '/src/workspace/lafea-mesh-dof-policy.js',
  '/src/workspace/lafea-mesh-geometry-topology-adapter.js',
  '/src/workspace/lafea-mesh-producer-binding.js',
  '/src/workspace/lafea-mesh-producer-engine.js',
  '/src/workspace/lafea-mesh-producer-registry.js',
  '/src/workspace/lafea-mesh-producer-v2-contracts.js',
  '/src/workspace/lafea-mesh-refinement-command.js',
  '/src/workspace/lafea-retained-mesh-refinement.js',
  '/src/workspace/lafea-shell-curved-hole-midsurface-contract.js',
  '/src/workspace/lafea-shell-curved-midsurface-contract.js',
  '/src/workspace/lafea-shell-mesh-producer.js',
  '/src/workspace/lafea-shell-midsurface-contract.js',
  '/src/workspace/lafea-shell-midsurface-dispatch.js',
  '/src/workspace/lafea-shell-periodic-midsurface-contract.js',
]);

const PURE_LAFEA_WORKBENCH_GOVERNANCE_MODULES = new Set([
  '/src/workspace/lafea-analysis-settings-view.js',
  '/src/workspace/lafea-guided-workflow.js',
  '/src/workspace/lafea-guided-workflow-view.js',
  '/src/workspace/lafea-numerical-verification-view.js',
  '/src/workspace/lafea-t6-geometry-qualification-custody.js',
  '/src/workspace/lafea-t6-geometry-qualification-state.js',
  '/src/workspace/lafea-t6-geometry-qualification-view.js',
  '/src/workspace/lafea-workbench-orchestration-projection.js',
  '/src/workspace/lafea-workbench-readiness.js',
  '/src/workspace/lafea-workbench-reason-labels.js',
  '/src/workspace/lafea-workbench-release-binding.js',
  '/src/workspace/lafea-workbench-verification-state.js',
]);

/**
 * Stateless empirical authority calculators and validators. Each module takes
 * complete inputs, returns immutable evidence, and owns no controller, store,
 * DOM resource, ambient fallback, or module-level mutable engineering state.
 */
const PURE_EMPIRICAL_AUTHORITY_WORKSPACE_MODULES = new Set([
  '/src/workspace/engineering-loads/adapters/canonical-thermal-rom-authority-adapter.js',
  '/src/workspace/engineering-loads/adapters/empirical-v3-authorized-source-bound-execution.js',
  '/src/workspace/engineering-loads/adapters/empirical-v3-live-run-orchestration.js',
  '/src/workspace/engineering-loads/authorized-empirical-load-execution-v2.js',
  '/src/workspace/engineering-loads/authorized-empirical-load-execution.js',
  '/src/workspace/engineering-loads/authorized-empirical-load-input.js',
  '/src/workspace/engineering-loads/authorized-empirical-runtime-package.js',
  '/src/workspace/engineering-loads/empirical-component-load-authority.js',
  '/src/workspace/engineering-loads/empirical-result-overlay.js',
  '/src/workspace/engineering-loads/preproduction-thermal-liftoff-displacement-authority.js',
  '/src/workspace/engineering-loads/support-load-distribution-v3.js',
  '/src/workspace/project-data/non-fea-configured-default-provider.js',
]);

/**
 * Stateless linear-piping intake and run-gate contracts. These modules seal or
 * validate complete caller-owned records, import only pure core authority, and
 * own no controller, store, DOM resource, or module-level mutable state.
 */
const PURE_LINEAR_PIPING_AUTHORITY_WORKSPACE_MODULES = new Set([
  '/src/workspace/linear-piping-inputxml-intake.js',
  '/src/workspace/linear-piping-inputxml-prefea.js',
  '/src/workspace/linear-piping-run-gate.js',
  '/src/workspace/linear-piping-run-request.js',
]);

/**
 * Keep manual chunking limited to dependency-oriented or calculation-core
 * domains. Workspace modules remain graph-owned because they contain stores,
 * controllers, views, and top-level singleton instances with cross-feature
 * imports. The narrow workspace exceptions below contain only stateless pure
 * contract/projection helpers and own no runtime singleton.
 */
/**
 * The `mdb-reader` stack, reached only by dynamic import when a user selects
 * an .accdb file. Listed explicitly so it stays out of the eager vendor chunk.
 */
const ACCDB_READER_PACKAGE_PATHS = Object.freeze([
  '/node_modules/mdb-reader/',
  '/node_modules/buffer/',
  '/node_modules/pako/',
  '/node_modules/browserify-aes/',
  '/node_modules/create-hash/',
  '/node_modules/cipher-base/',
  '/node_modules/evp_bytestokey/',
  '/node_modules/md5.js/',
  '/node_modules/ripemd160/',
  '/node_modules/sha.js/',
  '/node_modules/hash-base/',
  '/node_modules/readable-stream/',
  '/node_modules/base64-js/',
  '/node_modules/ieee754/',
  '/node_modules/safe-buffer/',
  '/node_modules/inherits/',
]);

/**
 * Style leaves: each exports only a static CSS string, or a stateless
 * installer that builds one `<style>` element from one. None holds
 * module-level mutable state, none is imported by another of them, and
 * nothing imports a controller, store or view from them.
 */
const STYLE_LEAF_MODULES = Object.freeze([
  '/src/workspace/workspace-shell-styles.js',
  '/src/workspace/lafea-workbench-styles.js',
  '/src/workspace/lafea-workbench-styles.js',
  '/src/workspace/lafea-guided-workbench-styles.js',
  '/src/workspace/viewport-productivity/topology-edit-table-styles.js',
  '/src/workspace/viewport-productivity/topology-edit-object-tree-styles.js',
  '/src/workspace/viewport-productivity/topology-edit-professional-operation-styles.js',
  '/src/workspace/viewport-productivity/topology-edit-authoring-styles.js',
]);

export function manualChunk(id) {
  const source = id.replaceAll('\\', '/');
  if (source.includes('vite/preload-helper')) return 'runtime';
  if (source.includes('/node_modules/three/examples/')) return 'vendor-three-examples';
  if (source.includes('/node_modules/three/')) return 'vendor-three-core';
  // Keep xlsx on Rollup's existing dynamic-import boundary; it is already a
  // large isolated chunk and must not be folded into the generic leaf vendor.
  if (source.includes('/node_modules/xlsx/')) return undefined;
  // Same treatment for the ACCDB reader stack. It is reached only through the
  // dynamic import in caesar-accdb-reader-core.js, i.e. only once a user
  // actually picks an .accdb file. Folding it into the eager `vendor` chunk
  // would ship ~230 KB of Access parsing to every page load; leaving it on
  // Rollup's dynamic boundary keeps it lazy.
  if (ACCDB_READER_PACKAGE_PATHS.some((path) => source.includes(path))) return undefined;
  // Dependency-only partition. Workspace modules remain graph-owned below so
  // this cannot create controller/store evaluation-order cycles.
  if (source.includes('/node_modules/')) return 'vendor';
  if (source.includes('/src/core/element-fea/')) return 'core-element-fea';
  if (source.includes('/src/core/local-continuum/')) return 'core-local-continuum';
  if (source.includes('/src/core/local-shell/')) return 'core-local-shell';
  if (source.includes('/src/core/local-stress/')) return 'core-local-stress';
  if (source.includes('/src/core/local-attachment-screening/')) return 'core-attachment-screening';
  if (source.includes('/src/core/local-trunnion-footprint/')) return 'core-local-trunnion-footprint';
  if (source.includes('/src/core/linear-fea-')) return 'core-linear-fea';
  if (source.includes('/src/core/linear-piping-')) return 'core-linear-piping';
  if (source.includes('/src/core/support-')) return 'core-application';
  if (source.includes('/src/core/vertical-beam-solver/')
    || source.includes('/src/core/centerline-beam-fea/')) return 'core-application';
  if (source.includes('/src/core/first-cut-load-estimation/')) return 'core-load-estimation';
  if (source.includes('/src/core/model-calculation-package/')) return 'core-application';
  if (source.includes('/src/core/piping-topology/')
    || source.includes('/src/core/shared-piping-model/')) return 'core-application';
  if (source.includes('/src/core/fea-benchmarks/')) return 'core-fea-benchmarks';
  if (source.includes('/src/core/')) return 'core-application';
  if (source.includes('/src/calc-workspace/cii-standalone-port/ui-adapted/')) {
    return 'cii-standalone-ui';
  }
  if (source.includes('/src/calc-workspace/cii-standalone-port/')) {
    return 'cii-standalone-core';
  }
  if (source.includes('/src/calc-workspace/')) return 'cii-standalone-core';
  if (source.includes('/src/vendors/')) return 'vendor-integrations';
  if (source.includes('/src/utils/') || source.includes('/src/mocks/')) return 'application-support';
  // These exact paths are stateless LAFEA meshing contracts/producers. Keeping
  // the exception explicit avoids pulling controllers, stores, views, or other
  // singleton-bearing workspace modules into a forced chunk.
  if ([...PURE_LAFEA_MESHING_WORKSPACE_MODULES]
    .some((modulePath) => source.endsWith(modulePath))) {
    return 'lafea-workbench-governance';
  }
  // This helper owns no controller/store/singleton state. Splitting its I/O and
  // style dependencies gives the graph a safe leaf boundary without forcing
  // the LAFEA workbench controller itself into a manual chunk.
  if (source.endsWith('/src/workspace/lafea-workbench-controller-io.js')) {
    return 'lafea-workbench-io';
  }
  if (source.endsWith('/src/workspace/topology-edit/topology-edit-inline-component-replacement.js')
    || source.endsWith('/src/workspace/topology-edit/topology-edit-junction-relation-command.js')
    || source.endsWith('/src/workspace/topology-edit/topology-edit-engineering-edit-effect.js')) {
    return 'topology-edit-engineering-commands';
  }
  if (source.endsWith('/src/workspace/topology-edit/topology-edit-stagedjson-engineering-source.js')) {
    return 'topology-edit-stagedjson-source-engineering';
  }
  if (source.endsWith('/src/workspace/topology-edit/editor-state/topology-edit-capability-contract.js')
    || source.endsWith('/src/workspace/topology-edit/table/topology-edit-table-edit-capability.js')
    || source.endsWith('/src/workspace/viewport-interaction/topology-edit-endpoint-affordance-model.js')
    || source.endsWith('/src/workspace/viewport-interaction/topology-edit-endpoint-affordance-runtime.js')) {
    return 'topology-edit-r1-pure-presentation';
  }
  // Fidelity evidence publication is a stateless projection to host datasets.
  // Keep it out of the large stateful SJSON controller chunk while leaving the
  // controller/backend lifecycle under Rollup graph-aware ownership.
  if (source.endsWith('/src/workspace/topology-edit/topology-edit-sjson-fidelity-evidence-v2.js')) {
    return 'topology-edit-sjson-evidence';
  }
  if (source.endsWith('/src/workspace/resolved-engineering-geometry.js')
    || source.endsWith('/src/workspace/model-zone-selector.js')
    || source.endsWith('/src/workspace/model-zone-viewport-projection.js')
    || source.endsWith('/src/workspace/viewport-render-model.js')
    || source.endsWith('/src/workspace/support-load-viewport-callout-projection.js')) {
    return 'workspace-viewport-engineering-projections';
  }
  // These modules are pure event validation and presentation projection. They
  // own no controller, store, mutable singleton, or runtime resource, so they
  // form a safe leaf boundary for the LFEA-to-3D-Edit integration.
  if (source.endsWith('/src/workspace/event-topics.js')
    || source.endsWith('/src/workspace/lafea-support-actions-panel.js')) {
    return 'workspace-event-presentation-contracts';
  }
  // Import-free static shell CSS is a safe presentation leaf. Keep the
  // application controller/layout graph under Rollup ownership while moving
  // only this large string literal out of the entry chunk.
  if (source.endsWith('/src/workspace/workspace-shell-styles.js')) {
    return 'application-shell-static-styles';
  }
  // PR #1016 adds a bounded set of read-only views, immutable qualification
  // custody, and derived readiness/release projections. These modules export
  // functions/contracts only; they own no workbench controller, store, mounted
  // viewport, or top-level mutable singleton. Keeping them in a dedicated leaf
  // chunk reduces the entry chunk without manually partitioning the stateful
  // workbench composition graph.
  if ([...PURE_LAFEA_WORKBENCH_GOVERNANCE_MODULES]
    .some((modulePath) => source.endsWith(modulePath))) {
    return 'lafea-workbench-governance';
  }
  // A handful of /src/core/lafea-meshing/ probes import this pure hash helper
  // straight from the workspace layer. Left unrouted, Rollup follows that
  // exclusive-dependent rule and pulls it into 'lafea-workbench-governance',
  // which then makes 'core-application' depend on 'lafea-workbench-governance'
  // for it while 'lafea-workbench-governance' independently depends on
  // 'core-application' for LAFEA3_QUALIFIED_MESH_QUALITY_POLICY. That mutual
  // chunk cycle reproduces "Cannot access '<binding>' before initialization"
  // on boot (verified with a real browser load). This module only imports
  // from core/shared-primitives, so routing it alongside its own dependency
  // breaks the cycle without touching any workspace/core layering.
  if (source.endsWith('/src/workspace/lafea-canonical-sha256.js')) {
    return 'core-application';
  }
  if ([...PURE_EMPIRICAL_AUTHORITY_WORKSPACE_MODULES]
    .some((modulePath) => source.endsWith(modulePath))) {
    return 'empirical-engineering-authority';
  }
  if ([...PURE_LINEAR_PIPING_AUTHORITY_WORKSPACE_MODULES]
    .some((modulePath) => source.endsWith(modulePath))) {
    return 'linear-piping-authority';
  }

  // Rollup-profiled at 32,589 rendered bytes on exact main. This module owns
  // presentation/render functions only; it creates no store/controller/singleton
  // at module load. Keep its stateful consumer controller graph-owned. Its only
  // source dependency is the import-free topology gap policy. A real browser
  // boot remains mandatory because generated chunk evaluation order is authority.
  if (source.endsWith('/src/workspace/load-calc-consumer-view.js')) {
    return 'load-calc-consumer-view';
  }

  // The generation panel is stateless and imports only core authority plus the
  // import-free DOM helper. Its parent also imports that helper, so the helper
  // must travel with the panel: splitting the panel alone would create a
  // main -> panel -> main-owned-helper back-edge. Grouping both preserves a
  // one-way main -> generation -> core graph.
  if (source.endsWith('/src/workspace/lafea-discretization-generation-panel.js')
    || source.endsWith('/src/workspace/lafea-discretization-dom.js')) {
    return 'lafea-discretization-generation';
  }

  // The Phase-1 pre-flight core is an indexed, DOM-free, clock-free leaf stack.
  // scripts/lafea-preflight-phase1-indexed-model-check.mjs asserts both halves of
  // what makes this split safe: these modules create no DOM and read no ambient
  // clock, and none of them imports the live UI, the review surface or the
  // application entry point. The dependency therefore runs one way, so giving
  // them their own chunk cannot reorder evaluation of a stateful workspace
  // controller. Splitting them keeps the main chunk under the production
  // ceiling asserted by scripts/bundle-chunk-check.mjs.
  if (source.includes('/src/workspace/lafea-preflight-phase1-')) {
    return 'lafea-preflight-phase1';
  }

  // Pure CSS-string leaf: a single exported function returning a template
  // literal, no top-level state, no DOM access, no singleton. Its only
  // consumer (workspace-layout.js) calls it and inserts the returned string,
  // so splitting it changes nothing about evaluation order.
  // Style leaves (see STYLE_LEAF_MODULES). Grouping them cannot reorder
  // evaluation of a stateful workspace controller, and it keeps the entry
  // chunk under the ceiling asserted by scripts/bundle-chunk-check.mjs.
  if (STYLE_LEAF_MODULES.some((modulePath) => source.endsWith(modulePath))) {
    return 'application-shell-css';
  }
  // Largest module in the entry chunk, and a genuine leaf: no DOM, no
  // module-level mutable state, no controller/store/view import.
  //
  // Splitting it was UNSAFE until the cyclic core-* chunks above were
  // collapsed — with those cycles present the built app died on boot with
  // "Cannot access '<binding>' before initialization" and rendered nothing,
  // while bundle-chunk-check.mjs still reported PASS. Chunk SIZE is not
  // evaluation ORDER: always verify a real browser boot after changing
  // anything in this function.
  if (source.endsWith('/src/workspace/engineering-loads/empirical-beam-contact-runtime.js')) {
    return 'engineering-loads-beam-contact-runtime';
  }
  // Rollup must own the complete stateful workspace graph so evaluation order
  // follows static dependency analysis rather than filename-based partitions.
  if (source.includes('/src/workspace/')) return undefined;
  return undefined;
}

export default defineConfig({
  base: '/Advanced_Analysis/',
  plugins: [],
  define: {
    __BUILD_TIME__: JSON.stringify(buildTime),
    __LAFEA4_TECH13_IMPLEMENTATION_FINGERPRINT__: JSON.stringify(tech13Implementation.fingerprint),
  },
  build: {
    modulePreload: false,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        analyze: fileURLToPath(new URL('./analyze.html', import.meta.url)),
      },
      output: {
        manualChunks: manualChunk,
        // Allow dependencies of a selected manual chunk to move with that
        // chunk. Explicit-only ownership created circular chunks and TDZ
        // failures in the generated ESM graph.
        onlyExplicitManualChunks: false,
      },
    },
  },
  server: {
    watch: {
      ignored: ['**/benchmarks/**', '**/reports/**', '**/playwright-report/**'],
    },
  },
});