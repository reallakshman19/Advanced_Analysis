const gates = [
  './lafea.4-a4-independent-shear-objectivity-check.mjs',
  './lafea.4-mitc4-element-check.mjs',
  './lafea.4-mitc3-fallback-check.mjs',
  './lafea.4-mitc-adoption-element-check.mjs',
  './lafea.4-mitc-adoption-pressure-check.mjs',
  './lafea.4-mitc-adoption-solve-check.mjs',
  './lafea.4-mitc-adoption-recovery-check.mjs',
  './lafea.4-mitc-adoption-shared-qualification-check.mjs',
  './lafea.4-production-route-benchmarks-check.mjs',
  './lafea.4-mitc-production-route-check.mjs',
];

for (const gate of gates) await import(gate);

console.log('\n✅ LAFEA.4 production-adoption aggregate completed.');
