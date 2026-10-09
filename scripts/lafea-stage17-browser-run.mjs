#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const cli = path.join(process.cwd(), 'node_modules', 'playwright', 'cli.js');
if (!fs.existsSync(cli)) {
  console.error('LAFEA_A17_BROWSER_PLAYWRIGHT_NOT_INSTALLED');
  process.exit(2);
}

const result = spawnSync(process.execPath, [
  cli,
  'test',
  '--config=playwright.lafea-visible.config.js',
  'e2e/lafea-standalone.spec.js',
  'e2e/lafea-standalone-golden-journey.spec.js',
  'e2e/lafea-standalone-failures.spec.js',
  'e2e/lafea-visible-workbench.spec.js',
  'e2e/lafea-b02-g3-custody.spec.js',
], {
  cwd: process.cwd(),
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '0' },
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
