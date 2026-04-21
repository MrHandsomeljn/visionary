import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('editor binds agent session store to writable workspace root before persisting conversation history', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /function syncAgentSessionStoreWorkspaceBinding\(\)/);
    assert.match(source, /const workspaceHandle = sceneFs\.getWorkspaceHandle\?\.\(\) \|\| null;/);
    assert.match(source, /if \(workspaceHandle && sceneFs\.isWorkspaceWritable\?\.\(\)\) \{/);
    assert.match(source, /store\.bindWorkspaceRoot\(workspaceHandle\);/);
    assert.match(source, /if \(store\.getStatus\(\)\.storageMode === 'workspace'\) \{\s*store\.bindWorkspaceRoot\(null\);\s*syncAgentWorkspacePersistenceState\(\);\s*\}/s);
    assert.match(source, /syncAgentSessionStoreWorkspaceBinding\(\);\s*if \(!store\.getStatus\(\)\.enabled\) return null;/s);
    assert.match(source, /const result = await store\.persistSnapshot\(buildAgentConversationSnapshot\(\)\);/);
});

test('workspace save path also flushes agent conversation history into agent_history.json', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /const saveResult = await sceneFs\.saveWorkspaceSnapshot\(manifest, \{ assets: assetInputs \}\);\s*await persistAgentConversationsNow\(\);/s);
});

test('project export path also emits agent_history binary assets for local reopen', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');
    const sceneFsSource = readFileSync(new URL('../src/app/scene-fs.ts', import.meta.url), 'utf8');

    assert.match(source, /const agentExport = await buildPersistableAgentConversationExport\(\{\s*includeAssets: true,\s*includeAssetPayloads: true,\s*\}\);/s);
    assert.match(source, /await exportSceneFs\.writeBinaryToRoot\(asset\.path, asset\.content\);/);
    assert.match(source, /await exportSceneFs\.writeJsonToRoot\('agent_history\.json', agentExport\.snapshot\);/);
    assert.match(sceneFsSource, /async writeBinaryToRoot\(relativePath: string, bytes: Uint8Array \| ArrayBuffer\): Promise<void>/);
});

test('workspace status indicator aggregates agent dirty, saving, error, and saved time', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /function getWorkspaceCombinedLastSavedAt\(\)/);
    assert.match(source, /const combinedError = workspace\.error \|\| workspace\.agentError \|\| null;/);
    assert.match(source, /const combinedSaving = Boolean\(workspace\.saving \|\| workspace\.agentSaving\);/);
    assert.match(source, /const combinedDirty = Boolean\(workspace\.dirty \|\| workspace\.agentDirty\);/);
    assert.match(source, /formatWorkspaceSavedAt\(getWorkspaceCombinedLastSavedAt\(\)\)/);
});

test('agent persistence scheduling marks workspace indicator dirty in workspace mode', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /function syncAgentWorkspacePersistenceState\(overrides = \{\}\)/);
    assert.match(source, /if \(store\.getStatus\(\)\.storageMode === 'workspace'\) \{\s*syncAgentWorkspacePersistenceState\(\{\s*agentDirty: true,\s*agentError: null,\s*\}\);\s*\}/s);
    assert.match(source, /syncAgentWorkspacePersistenceState\(\{\s*agentSaving: true,\s*agentError: null,\s*\}\);/s);
    assert.match(source, /syncAgentWorkspacePersistenceState\(\{\s*agentDirty: false,\s*agentSaving: false,\s*agentLastSavedAt:/s);
});

test('camera preview panel restores stored position and uses a dedicated first-open default above timeline and right of agent', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /function measureCameraPreviewPanelRect\(\)/);
    assert.match(source, /panel\.classList\.remove\('hidden'\);/);
    assert.match(source, /panel\.style\.visibility = 'hidden';/);
    assert.match(source, /const rect = panel\.getBoundingClientRect\(\);/);
    assert.match(source, /function captureCameraPreviewWorkspacePreset\(\)/);
    assert.match(source, /function applyCameraPreviewWorkspacePreset\(preset = null, markDirty = false\)/);
    assert.match(source, /function resolveDefaultCameraPreviewPanelPosition\(\)/);
    assert.match(source, /left = Math\.max\(margin, agentRect\.right \+ gap\);/);
    assert.match(source, /top = timelineRect\.top - actualHeight - gap;/);
    assert.match(source, /dom\.cameraPreviewPanel\.dataset\.pendingBottom = String\(bottom\);/);
    assert.match(source, /if \(!Number\.isFinite\(top\) && Number\.isFinite\(bottom\)\) \{\s*top = window\.innerHeight - bottom - panelRect\.height;\s*\}/s);
    assert.match(source, /const maxTop = Math\.max\(margin, window\.innerHeight - margin - headerHeight\);/);
    assert.match(source, /delete dom\.cameraPreviewPanel\.dataset\.pendingBottom;/);
    assert.match(source, /requestAnimationFrame\(\(\) => \{\s*applyCameraPreviewPanelSize\(\);\s*positionCameraPreviewPanel\(\);\s*requestAnimationFrame\(positionCameraPreviewPanel\);\s*\}\);/s);
    assert.match(source, /persistCameraPreviewPosition\(resolvedLeft, resolvedBottom\);/);
    assert.match(source, /cameraPreviewPreset: captureCameraPreviewWorkspacePreset\(\),/);
    assert.match(source, /applyCameraPreviewWorkspacePreset\(null, false\);/);
    assert.match(source, /applyCameraPreviewWorkspacePreset\(raw\.env\.cameraPreviewPreset, false\);/);
});
