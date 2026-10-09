#!/usr/bin/env node
// Executed by the existing B01 diagnostic capture step. This intentionally binds
// B02 architecture/recovery/convergence/frozen-definition contracts into the
// qualification gate without changing workflow definitions or using B02 output
// to generate acceptance data.
import './lafea-b02-gate0-contract-check.mjs';
import './lafea-b02-g4-physical-probe-diagnostic.mjs';
import './lafea-b02-g4-probe-fail-closed-diagnostic.mjs';
import './lafea-b02-g4-convergence-diagnostic.mjs';
import './lafea-b02-definition-freeze-check.mjs';
import './lafea-b02b-saint-venant-oracle-check.mjs';
