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

test('editor no-splats fused fallback composites overlay without direct overlay render', () => {
    const source = readFileSync(new URL('../src/editor/editor-app.ts', import.meta.url), 'utf8');

    assert.match(source, /const drew = this\.fusedRenderer\.drawSplats\(this\.meshRenderer, this\.meshScene, this\.meshCamera\);[\s\S]*if \(!drew && this\.renderMode !== "depth"\) \{[\s\S]*this\.fusedRenderer\.compositeOverlayToCurrentCanvas\(\);[\s\S]*\}/);
    assert.doesNotMatch(source, /if \(!drew && this\.renderMode !== "depth"\) \{\s*this\.meshRenderer\.render\(this\.meshScene, this\.meshCamera\);\s*this\.renderViewportOverlayDirect\(\);\s*\}/);
});
