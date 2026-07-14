import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  DEV_BOOT_PROGRESS_EVENT,
  normalizeDevBootProgressDetail,
} from '../src/editor/dev-boot-progress.ts';

test('dev boot progress detail is safe for one-line terminal output', () => {
  assert.equal(
    normalizeDevBootProgressDetail('\u001b[31mPreparing\neditor shell...\u001b[0m'),
    'Preparing editor shell...',
  );
  assert.equal(normalizeDevBootProgressDetail('   '), '');
  assert.equal(normalizeDevBootProgressDetail('x'.repeat(200)).length, 160);
});

test('Vite terminal reporting reuses the editor boot status sequence', async () => {
  const [viteConfig, editorSource] = await Promise.all([
    readFile(new URL('../vite.config.ts', import.meta.url), 'utf8'),
    readFile(new URL('../public/editor.js', import.meta.url), 'utf8'),
  ]);

  assert.equal(DEV_BOOT_PROGRESS_EVENT, 'visionary:boot-progress');
  assert.match(viteConfig, /server\.ws\.on\(DEV_BOOT_PROGRESS_EVENT/);
  assert.match(viteConfig, /logger\.info\(`\[visionary\] \$\{detail\}`/);
  assert.match(editorSource, /function setBootLoadingStatus[\s\S]*reportDevBootProgress\(detail\)/);
  assert.match(editorSource, /setBootLoadingStatus\(t\('loading\.bootReady'\)\)/);
});
