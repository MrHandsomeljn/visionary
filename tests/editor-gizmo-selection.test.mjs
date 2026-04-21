import test from 'node:test';
import assert from 'node:assert/strict';

import {
    normalizeViewportGizmoModeForSelection,
    resolveTimelineGizmoTarget,
    resolveViewportSelectionKind,
} from '../public/editor-gizmo-selection.js';

test('model selection wins over camera drag mode when a model is selected', () => {
    assert.equal(
        resolveViewportSelectionKind({
            cameraSequenceDragEnabled: true,
            hasTimelineCamera: true,
            cameraGizmoTargetFrame: 24,
            selectedModelId: 'model-a',
        }),
        'model'
    );
});

test('camera selection is active only when drag is enabled and no model is selected', () => {
    assert.equal(
        resolveViewportSelectionKind({
            cameraSequenceDragEnabled: true,
            hasTimelineCamera: true,
            cameraGizmoTargetFrame: 24,
            selectedModelId: null,
        }),
        'camera'
    );
    assert.equal(
        resolveViewportSelectionKind({
            cameraSequenceDragEnabled: false,
            hasTimelineCamera: true,
            cameraGizmoTargetFrame: 24,
            selectedModelId: null,
        }),
        'none'
    );
});

test('camera selection downgrades scale mode to translate, but model selection keeps scale', () => {
    assert.equal(normalizeViewportGizmoModeForSelection('scale', 'camera'), 'translate');
    assert.equal(normalizeViewportGizmoModeForSelection('scale', 'model'), 'scale');
    assert.equal(normalizeViewportGizmoModeForSelection('rotate', 'camera'), 'rotate');
});

test('timeline camera target requires an existing timeline camera and is non-interactive during playback', () => {
    assert.deepEqual(
        resolveTimelineGizmoTarget({
            cameraSequenceDragEnabled: true,
            cameraSequenceVisible: true,
            hasTimelineCamera: true,
            playbackActive: false,
            selectedModelId: null,
            currentFrame: 42,
        }),
        { kind: 'camera-current', frame: 42, interactive: true }
    );
    assert.deepEqual(
        resolveTimelineGizmoTarget({
            cameraSequenceDragEnabled: true,
            cameraSequenceVisible: true,
            hasTimelineCamera: true,
            playbackActive: true,
            selectedModelId: null,
            currentFrame: 42,
        }),
        { kind: 'camera-current', frame: 42, interactive: false }
    );
    assert.deepEqual(
        resolveTimelineGizmoTarget({
            cameraSequenceDragEnabled: true,
            cameraSequenceVisible: true,
            hasTimelineCamera: false,
            playbackActive: false,
            selectedModelId: 'model-a',
            currentFrame: 42,
        }),
        { kind: 'model', frame: null, interactive: true }
    );
});
