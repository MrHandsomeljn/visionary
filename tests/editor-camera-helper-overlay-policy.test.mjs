import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('camera sequence helpers render in mesh scene helper layer so scene depth can occlude them', () => {
    const source = readFileSync(new URL('../src/editor/editor-app.ts', import.meta.url), 'utf8');

    assert.match(source, /private editorHelperOverlayScene: THREE\.Scene \| null = null;/);
    assert.match(source, /this\.editorHelperOverlayScene = new THREE\.Scene\(\);/);
    assert.match(source, /const EDITOR_VIEWPORT_HELPER_LAYER = 1;/);
    assert.match(source, /this\.meshCamera\.layers\.enable\(EDITOR_VIEWPORT_HELPER_LAYER\);/);
    assert.match(source, /if \(!this\.meshScene\) return false;/);
    assert.match(source, /if \(this\.cameraSequenceGroup && this\.cameraSequenceGroup\.parent === this\.meshScene\) \{/);
    assert.match(source, /private assignViewportHelperLayer\(root: THREE\.Object3D\): void \{[\s\S]*node\.layers\.set\(EDITOR_VIEWPORT_HELPER_LAYER\);/);
    assert.match(source, /this\.assignViewportHelperLayer\(group\);\s*this\.meshScene\.add\(group\);/);
    assert.match(source, /this\.assignViewportHelperLayer\(marker\);/);
    assert.match(source, /this\.assignViewportHelperLayer\(root\);/);
    assert.match(source, /this\.assignViewportHelperLayer\(line\);/);
    assert.match(source, /raycaster\.layers\.enable\(EDITOR_VIEWPORT_HELPER_LAYER\);/);
    assert.match(source, /if \(this\.editorHelperOverlayScene\) \{\s*scenes\.push\(this\.editorHelperOverlayScene\);\s*\}/);
    assert.match(source, /this\.fusedRenderer\.renderThreeScene\(this\.meshCamera\);\s*this\.renderViewportOverlayWithFusedRenderer\(\);\s*const drew = this\.fusedRenderer\.drawSplats\(this\.meshRenderer, this\.meshScene, this\.meshCamera\);/);
    assert.match(source, /for \(const scene of this\.getViewportOverlayScenes\(\)\) \{\s*this\.fusedRenderer\.renderOverlayScene\(scene, this\.meshCamera\);\s*\}/);
    assert.doesNotMatch(source, /this\.fusedRenderer\.drawSplats\(this\.meshRenderer, this\.meshScene, this\.meshCamera\);\s*this\.renderViewportOverlayDirect\(\);/);
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
