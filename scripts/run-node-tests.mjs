#!/usr/bin/env node
import { availableParallelism } from 'node:os';
import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const repoRoot = process.cwd();
const testsDir = path.join(repoRoot, 'tests');
const entries = await readdir(testsDir, { withFileTypes: true });
const testFiles = entries
  .filter((entry) => entry.isFile() && /\.test\.(?:mjs|ts)$/.test(entry.name))
  .map((entry) => path.join('tests', entry.name))
  .sort();

const requestedConcurrency = Number(process.env.VISIONARY_TEST_CONCURRENCY || 0);
const defaultConcurrency = Math.max(1, Math.min(8, availableParallelism()));
const concurrency = Number.isFinite(requestedConcurrency) && requestedConcurrency > 0
  ? Math.round(requestedConcurrency)
  : defaultConcurrency;
const reporter = String(process.env.VISIONARY_TEST_REPORTER || 'dot').trim() || 'dot';

const args = [
  '--import',
  'tsx',
  '--test',
  `--test-concurrency=${concurrency}`,
  `--test-reporter=${reporter}`,
  ...process.argv.slice(2),
  ...testFiles,
];

// Node's strip-only TypeScript runner rejects some valid TS syntax in this suite;
// tsx keeps the fast native node:test runner while handling real TypeScript files.
// The dot reporter keeps routine full-suite runs from spending time on TAP noise.
const child = spawn(process.execPath, args, {
  cwd: repoRoot,
  env: process.env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
