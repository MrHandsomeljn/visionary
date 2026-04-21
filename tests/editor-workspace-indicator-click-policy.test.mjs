import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('workspace indicator opens workspace target modal instead of saving immediately', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /function openWorkspaceTargetModal\(mode = 'status'\)/);
    assert.match(source, /function syncWorkspaceTargetModalLabels\(mode = 'status'\)/);
    assert.match(source, /dom\.workspaceStatusIndicator\?\.addEventListener\('click', async \(e\) => \{/);
    assert.match(source, /openWorkspaceTargetModal\('status'\);/);
    assert.doesNotMatch(source, /await saveScene\(\);\s*return;/);
    assert.doesNotMatch(source, /await saveWorkspaceToCurrentWorkspace\(/);
});
