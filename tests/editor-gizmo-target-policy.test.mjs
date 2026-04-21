import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('timeline camera gizmo binds to current timeline camera only when camera poses exist', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /function hasTimelineCameraPose\(\) \{/);
    assert.match(source, /return Array\.isArray\(state\.keyframes\) && state\.keyframes\.length > 0;/);
    assert.match(source, /resolveTimelineGizmoTarget\(\{[\s\S]*hasTimelineCamera: hasTimelineCameraPose\(\),[\s\S]*currentFrame: frame,/);
    assert.match(source, /if \(target\.kind !== 'camera-current' \|\| target\.frame === null\) return false;/);
    assert.match(source, /if \(state\.selectedModelId\) \{\s*closeEditor\(\);\s*\}/);
    assert.match(source, /state\.viewportGizmoMode = normalizeViewportGizmoModeForSelection\(state\.viewportGizmoMode, 'camera'\);/);
});

test('model selection clears camera target and restores model gizmo scale availability', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /function selectModel\(id, options = \{\}\) \{/);
    assert.match(source, /state\.selectedModelId = id;\s*state\.selectedCameraSequenceFrame = null;/);
    assert.match(source, /syncSelectedCameraSequenceFrameToApp\(\);/);
    assert.match(source, /const disabled = !app \|\| \(mode === 'scale' && cameraSelectionActive\) \|\| \(cameraSelectionActive && state\.isPlaying\);/);
});

test('camera gizmo is visible but non-interactive during playback', () => {
    const publicSource = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');
    const editorSource = readFileSync(new URL('../src/editor/editor-app.ts', import.meta.url), 'utf8');

    assert.match(publicSource, /function syncCameraSequenceInteractionEnabled\(\) \{\s*app\?\.setCameraSequenceInteractionEnabled\?\.\(!state\.isPlaying\);\s*\}/);
    assert.match(publicSource, /state\.isPlaying = false;\s*syncCameraSequenceInteractionEnabled\(\);/);
    assert.match(publicSource, /state\.isPlaying = true;\s*syncCameraSequenceInteractionEnabled\(\);/);
    assert.match(editorSource, /private cameraSequenceInteractionEnabled: boolean = true;/);
    assert.match(editorSource, /setCameraSequenceInteractionEnabled\(enabled: boolean\): boolean \{/);
    assert.match(editorSource, /this\.viewportGizmoEnabled &&\s*cameraModeAllowed &&\s*this\.cameraSequenceInteractionEnabled/);
});

test('video export frame traversal does not mutate user timeline frame or gizmo focus', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');
    const controllerMatch = source.match(/function buildExportTimelineController\(recordingCamera, options = \{\}\) \{([\s\S]*?)\n\}/);

    assert.ok(controllerMatch, 'expected buildExportTimelineController');
    assert.doesNotMatch(controllerMatch[1], /setTimelineFrame\(/);
    assert.match(controllerMatch[1], /const pose = interpolateCameraPoseAt\(sourceTimeSec\)/);
    assert.match(controllerMatch[1], /applyTimelinePoseToRecordingCamera\(recordingCamera, pose,/);
    assert.match(source, /setTimelineFrame\(restoreFrame, \{ applyPose: true, syncSlider: true, syncGizmo: false \}\);/);
});
