import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('camera keyframe gizmo uses camera-local axes while dragging camera helpers', () => {
    const source = readFileSync(new URL('../src/editor/editor-app.ts', import.meta.url), 'utf8');

    assert.match(source, /if \(selectionKind === "camera"\) \{\s*const cameraTarget = this\.getSelectedCameraSequenceTarget\(\);\s*this\.gizmoManager\.setSpace\("local"\);/);
    assert.match(source, /const c2w = w2c\.clone\(\)\.invert\(\);[\s\S]*root\.quaternion\.copy\(c2w\);/);
    assert.match(source, /this\.cameraSequenceCurrentMarker\.quaternion\.set\([\s\S]*Number\(this\.cameraPreviewPose\.rotation\.w\) \|\| 1[\s\S]*\)\.invert\(\);/);
});

test('camera timeline playback and helpers use Three camera local negative Z forward', () => {
    const editorSource = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');
    const appSource = readFileSync(new URL('../src/editor/editor-app.ts', import.meta.url), 'utf8');

    assert.match(editorSource, /rotateVectorByQuaternion\(\{ x: 0, y: 0, z: -1 \}, c2w\)/);
    assert.doesNotMatch(editorSource, /rotateVectorByQuaternion\(\{ x: 0, y: 0, z: 1 \}, c2w\)/);
    assert.match(appSource, /new THREE\.Vector3\(0, 0, -1\)\.applyQuaternion\(c2w\)/);
    assert.doesNotMatch(appSource, /new THREE\.Vector3\(0, 0, 1\)\.applyQuaternion\(c2w\)/);
    assert.match(appSource, /new THREE\.Vector3\(-halfWidth, halfHeight, -safeLength\)/);
    assert.match(appSource, /new THREE\.Vector3\(halfWidth, halfHeight, -safeLength\)/);
    assert.match(appSource, /new THREE\.Vector3\(-halfWidth, -halfHeight, -safeLength\)/);
    assert.match(appSource, /new THREE\.Vector3\(halfWidth, -halfHeight, -safeLength\)/);
});
