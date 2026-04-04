import test from 'node:test';
import assert from 'node:assert/strict';

import {
    normalizeViewportGizmoModeForSelection,
    resolveViewportSelectionKind,
} from '../public/editor-gizmo-selection.js';

test('model selection wins over camera drag mode when a model is selected', () => {
    assert.equal(
        resolveViewportSelectionKind({
            cameraSequenceDragEnabled: true,
            selectedCameraSequenceFrame: 24,
            selectedModelId: 'model-a',
        }),
        'model'
    );
});

test('camera selection is active only when drag is enabled and no model is selected', () => {
    assert.equal(
        resolveViewportSelectionKind({
            cameraSequenceDragEnabled: true,
            selectedCameraSequenceFrame: 24,
            selectedModelId: null,
        }),
        'camera'
    );
    assert.equal(
        resolveViewportSelectionKind({
            cameraSequenceDragEnabled: false,
            selectedCameraSequenceFrame: 24,
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
