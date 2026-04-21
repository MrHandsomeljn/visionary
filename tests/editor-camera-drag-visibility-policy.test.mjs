import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('camera keyframe dragging is suspended while camera trajectory is hidden', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /cameraSequenceDragEnabledBeforeHidden:\s*null/);
    assert.match(source, /function suspendCameraSequenceDragForHiddenTrajectory\(\) \{/);
    assert.match(source, /state\.cameraSequenceDragEnabledBeforeHidden = Boolean\(state\.cameraSequenceDragEnabled\)/);
    assert.match(source, /setCameraSequenceDragEnabled\(false, true\)/);
    assert.match(source, /function restoreCameraSequenceDragAfterVisibleTrajectory\(\) \{/);
    assert.match(source, /const shouldRestore = state\.cameraSequenceDragEnabledBeforeHidden === true/);
    assert.match(source, /setCameraSequenceDragEnabled\(true, true\)/);
    assert.match(source, /dom\.btnToggleCameraSequenceDrag\.disabled = disabled/);
    assert.match(source, /if \(nextEnabled && !syncCameraSequenceVisibilityState\(\)\) \{\s*return false;\s*\}/);
    assert.match(source, /if \(!safe\) \{\s*suspendCameraSequenceDragForHiddenTrajectory\(\);\s*\} else \{\s*restoreCameraSequenceDragAfterVisibleTrajectory\(\);\s*\}/);
});

test('timeline frame changes retarget camera gizmo when camera dragging is active', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');
    const timelineMatch = source.match(/function setTimelineFrame\(frame, options = \{\}\) \{([\s\S]*?)\n\}/);

    assert.ok(timelineMatch, 'expected setTimelineFrame to exist');
    assert.match(source, /function syncTimelineFrameToCameraGizmo\(frame = state\.selectedFrame\) \{/);
    assert.match(source, /resolveTimelineGizmoTarget\(\{[\s\S]*cameraSequenceDragEnabled: state\.cameraSequenceDragEnabled,[\s\S]*cameraSequenceVisible: state\.cameraSequenceVisible,[\s\S]*hasTimelineCamera: hasTimelineCameraPose\(\),/);
    assert.match(source, /if \(target\.kind !== 'camera-current' \|\| target\.frame === null\) return false;/);
    assert.match(source, /state\.selectedCameraSequenceFrame = safeFrame;\s*state\.viewportGizmoMode = normalizeViewportGizmoModeForSelection\(state\.viewportGizmoMode, 'camera'\);\s*syncSelectedCameraSequenceFrameToApp\(\);/);
    assert.match(timelineMatch[1], /syncTimelineFrameToCameraGizmo\(safeFrame\);/);
});

test('timeline keyframe marker selection activates camera keyframe dragging when possible', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /function activateTimelineCameraKeyframeSelection\(frame, \{ silent = false \} = \{\}\) \{/);
    assert.match(source, /if \(!state\.cameraSequenceDragEnabled\) \{\s*setCameraSequenceDragEnabled\(true, silent\);\s*\}/);
    assert.match(source, /syncTimelineFrameToCameraGizmo\(safeFrame\);/);
    assert.match(source, /activateTimelineCameraKeyframeSelection\(frame\);\s*syncCameraSequenceVisualization\(\);/);
    assert.match(source, /activateTimelineCameraKeyframeSelection\(safeFrame, \{ silent: true \}\);/);
    assert.match(source, /activateTimelineCameraKeyframeSelection\(nextFrame, \{ silent: true \}\);/);
});

test('disabling camera sequence edit cancels active gizmo interaction', () => {
    const editorSource = readFileSync(new URL('../src/editor/editor-app.ts', import.meta.url), 'utf8');
    const managerSource = readFileSync(new URL('../src/gizmo/gizmo-manager.ts', import.meta.url), 'utf8');
    const controllerSource = readFileSync(new URL('../src/gizmo/gizmo-controller.ts', import.meta.url), 'utf8');

    assert.match(editorSource, /if \(!this\.cameraSequenceEditEnabled\) \{\s*this\.gizmoManager\?\.cancelInteraction\?\.\(\);\s*this\.setViewportCameraInputEnabled\(true\);\s*\}/);
    assert.match(managerSource, /cancelInteraction\(\): void \{\s*this\.gizmoController\.cancelInteraction\(\);\s*\}/);
    assert.match(controllerSource, /cancelInteraction\(\): void \{\s*if \(!this\.isDragging\) return;/);
    assert.match(controllerSource, /if \(this\.callbacks\.onChangeEnd && this\.currentObject\) \{\s*this\.callbacks\.onChangeEnd\(this\.createEvent\('changeEnd'\)\);\s*\}/);
});
