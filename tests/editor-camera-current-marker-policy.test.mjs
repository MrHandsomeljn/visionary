import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('camera current marker depends on timeline camera helpers, not drag-toggle state', () => {
    const source = readFileSync(new URL('../src/editor/editor-app.ts', import.meta.url), 'utf8');

    assert.match(source, /private updateCameraSequenceCurrentMarkerFromPreviewPose\(\): void \{/);
    assert.match(source, /if \(!this\.cameraPreviewPose \|\| this\.cameraSequenceHelperTargets\.size === 0\) \{/);
    assert.doesNotMatch(source, /if \(!this\.cameraPreviewPose \|\| !this\.cameraSequenceEditEnabled\) \{/);
});
