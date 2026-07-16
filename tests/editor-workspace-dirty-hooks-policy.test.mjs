import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('workspace dirty hooks cover timeline fov, scene fov, scene background, visibility, canvas camera, and camera transform commit', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /markWorkspaceDirty\('timeline-camera-fov'\)/);
    assert.match(source, /markWorkspaceDirty\('scene-camera-fov'\)/);
    assert.match(source, /markWorkspaceDirty\('scene-background'\)/);
    assert.match(source, /markWorkspaceDirty\('model-visibility'\)/);
    assert.match(source, /app\.onCameraInteraction\?\.\(\(kind\) => \{[\s\S]*markWorkspaceDirty\('canvas-camera-pose'\)/);
    assert.match(source, /markWorkspaceDirty\('camera-sequence-transform'\)/);
});

test('reset transform no-ops when model is already at default transform', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /const alreadyReset =/);
    assert.match(source, /if \(alreadyReset\) \{/);
    assert.doesNotMatch(source, /function resetTransform\(\)[\s\S]*markWorkspaceDirty\('reset-model-transform'\);[\s\S]*if \(alreadyReset\) \{/);
});
