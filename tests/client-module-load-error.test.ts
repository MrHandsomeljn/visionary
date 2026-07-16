import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  CLIENT_MODULE_LOAD_ERROR_ENDPOINT,
  formatClientModuleLoadErrorLog,
  normalizeClientModuleLoadErrorReport,
} from '../src/server/client-module-load-error.ts';

test('client module load error reports are normalized for terminal output', () => {
  const report = normalizeClientModuleLoadErrorReport({
    message: '\u001b[31mThe requested module\n does not provide an export named x\u001b[0m',
    source: 'https://example.test/src/editor.js',
    line: 12,
    column: 8,
    pageUrl: 'https://example.test/editor.html',
    userAgent: 'test\nagent',
  });

  assert.deepEqual(report, {
    message: 'The requested module does not provide an export named x',
    source: 'https://example.test/src/editor.js',
    line: 12,
    column: 8,
    pageUrl: 'https://example.test/editor.html',
    userAgent: 'test agent',
  });
  assert.equal(
    formatClientModuleLoadErrorLog(report!),
    '[visionary] Frontend module load failed: The requested module does not provide an export named x (https://example.test/src/editor.js:12:8)',
  );
});

test('client module load error reports reject empty messages and invalid positions', () => {
  assert.equal(normalizeClientModuleLoadErrorReport(null), null);
  assert.equal(normalizeClientModuleLoadErrorReport({ message: '   ' }), null);
  assert.deepEqual(normalizeClientModuleLoadErrorReport({
    message: 'module failed',
    line: '12',
    column: -1,
  }), {
    message: 'module failed',
    source: '',
    line: null,
    column: null,
    pageUrl: '',
    userAgent: '',
  });
});

test('editor installs the module load guard before loading its module entry', async () => {
  const [html, guard, viteConfig] = await Promise.all([
    readFile(new URL('../public/editor.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/editor-module-load-guard.js', import.meta.url), 'utf8'),
    readFile(new URL('../vite.config.ts', import.meta.url), 'utf8'),
  ]);

  const guardIndex = html.indexOf('<script src="./editor-module-load-guard.js"></script>');
  const editorIndex = html.indexOf('<script type="module" src="./editor.js"></script>');
  assert.ok(guardIndex >= 0);
  assert.ok(editorIndex > guardIndex);
  assert.match(guard, /requested module .* does not provide an export named/i);
  assert.match(guard, /window\.addEventListener\('error'/);
  assert.match(guard, /window\.addEventListener\('unhandledrejection'/);
  assert.match(guard, new RegExp(CLIENT_MODULE_LOAD_ERROR_ENDPOINT.replaceAll('/', '\\/')));
  assert.match(viteConfig, /createClientModuleLoadErrorPlugin\(\)/);
});
