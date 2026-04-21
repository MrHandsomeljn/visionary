import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('camera keyframe gizmo uses camera-local axes while dragging camera helpers', () => {
    const source = readFileSync(new URL('../src/editor/editor-app.ts', import.meta.url), 'utf8');

    assert.match(source, /if \(selectionKind === "camera"\) \{\s*const cameraTarget = this\.getSelectedCameraSequenceTarget\(\);\s*this\.gizmoManager\.setSpace\("local"\);/);
    assert.match(source, /const c2w = w2c\.clone\(\)\.invert\(\);[\s\S]*root\.quaternion\.copy\(c2w\);/);
    assert.match(source, /this\.cameraSequenceCurrentMarker\.quaternion\.set\([\s\S]*Number\(this\.cameraPreviewPose\.rotation\.w\) \|\| 1[\s\S]*\)\.invert\(\);/);
});
