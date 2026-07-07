import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('fused renderer keeps overlay and blit formats compatible with WebGPU canvas', () => {
    const source = readFileSync(new URL('../src/app/GaussianThreeJSRenderer.ts', import.meta.url), 'utf8');

    assert.match(source, /this\.sceneDepthRT = new THREE\.RenderTarget\(width, height, \{[\s\S]*type:\s*THREE\.HalfFloatType/);
    assert.match(source, /this\.gizmoOverlayRT = new RenderTargetClass\(w, h, \{[\s\S]*type:\s*THREE\.HalfFloatType[\s\S]*depthBuffer:\s*false/);
    assert.match(source, /this\.gizmoOverlayRT\.texture\.colorSpace = THREE\.LinearSRGBColorSpace;/);
    assert.match(source, /format:\s*this\.canvasFormat\s*\/\/ Canvas format/);
    assert.match(source, /public compositeOverlayToCurrentCanvas\(\): boolean/);
    assert.match(source, /this\.compositeOverlayToCanvas\(device, encoder, targetView\);/);
});

test('editor fused viewport composites overlays after scene output without direct canvas overlay render', () => {
    const source = readFileSync(new URL('../src/editor/editor-app.ts', import.meta.url), 'utf8');

    assert.match(source, /this\.fusedRenderer\.renderThreeScene\(this\.meshCamera\);\s*this\.renderViewportOverlayWithFusedRenderer\(\);\s*const drew = this\.fusedRenderer\.drawSplats\(this\.meshRenderer, this\.meshScene, this\.meshCamera\);\s*if \(!drew\) \{\s*this\.fusedRenderer\.compositeOverlayToCurrentCanvas\(\);\s*\}/);
    assert.doesNotMatch(source, /this\.fusedRenderer\.drawSplats\(this\.meshRenderer, this\.meshScene, this\.meshCamera\);\s*this\.renderViewportOverlayDirect\(\);/);
});

test('fused renderer accumulates multiple editor overlay scenes in one frame', () => {
    const source = readFileSync(new URL('../src/app/GaussianThreeJSRenderer.ts', import.meta.url), 'utf8');

    assert.match(source, /if \(!this\.overlayRenderedThisFrame\) \{\s*this\.threeRenderer\.clear\(true, false, false\);\s*\}/);
    assert.match(source, /this\.threeRenderer\.render\(scene, camera\);\s*this\.overlayRenderedThisFrame = true;/);
    assert.match(source, /const prevAutoClear = \(this\.threeRenderer as any\)\.autoClear;/);
    assert.match(source, /this\.overlayRenderedThisFrame = false;\s*const RenderTargetClass/);
});

test('camera preview uses fused renderer for mesh-only depth preview', () => {
    const source = readFileSync(new URL('../src/editor/editor-app.ts', import.meta.url), 'utf8');

    assert.match(source, /this\.cameraPreviewFusedRenderer = new GaussianThreeJSRenderer\(renderer, this\.meshScene, gaussianModelEntries\);/);
    assert.doesNotMatch(source, /if \(gaussianModelEntries\.length > 0\) \{\s*this\.cameraPreviewFusedRenderer = new GaussianThreeJSRenderer\(renderer, this\.meshScene, gaussianModelEntries\);/);
    assert.match(source, /this\.cameraPreviewFusedRenderer\.renderThreeScene\(this\.cameraPreviewCamera\);\s*const drew = this\.cameraPreviewFusedRenderer\.drawSplats\(this\.cameraPreviewRenderer, this\.meshScene, this\.cameraPreviewCamera\);\s*if \(!drew && this\.renderMode !== "depth"\) \{/);
});
