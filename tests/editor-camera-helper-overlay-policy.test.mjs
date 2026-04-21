import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('camera sequence helpers live in editor overlay scene instead of mesh scene', () => {
    const source = readFileSync(new URL('../src/editor/editor-app.ts', import.meta.url), 'utf8');

    assert.match(source, /private editorHelperOverlayScene: THREE\.Scene \| null = null;/);
    assert.match(source, /this\.editorHelperOverlayScene = new THREE\.Scene\(\);/);
    assert.match(source, /if \(!this\.editorHelperOverlayScene\) return false;/);
    assert.match(source, /if \(this\.cameraSequenceGroup && this\.cameraSequenceGroup\.parent === this\.editorHelperOverlayScene\) \{/);
    assert.match(source, /this\.editorHelperOverlayScene\.add\(group\);/);
    assert.match(source, /for \(const scene of this\.getViewportOverlayScenes\(\)\) \{\s*this\.fusedRenderer\.renderOverlayScene\(scene, this\.meshCamera\);\s*\}/);
    assert.doesNotMatch(source, /this\.meshScene\.add\(group\);/);
});

test('camera preview and export no longer depend on temporary camera-sequence hiding', () => {
    const editorSource = readFileSync(new URL('../src/editor/editor-app.ts', import.meta.url), 'utf8');
    const publicSource = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.doesNotMatch(editorSource, /private hideEditorHelpersForPreview\(scene: THREE\.Scene\): void \{/);
    assert.doesNotMatch(editorSource, /private restoreEditorHelpersForPreview\(\): void \{/);
    assert.doesNotMatch(editorSource, /this\.hideEditorHelpersForPreview\(this\.meshScene\);/);
    assert.doesNotMatch(publicSource, /async function withTemporaryCameraSequenceHidden\(fn\)/);
    assert.doesNotMatch(publicSource, /await withTemporaryCameraSequenceHidden\(async \(\) => \{/);
});
