import test from 'node:test';
import assert from 'node:assert/strict';

import {
    resolveFloatingPanelPosition,
    resolveFloatingPanelLayerZIndices,
} from '../public/editor-floating-panels.js';

test('floating panel opens from the editor shell left edge instead of viewport left edge', () => {
    const position = resolveFloatingPanelPosition({
        shellRect: { left: 720, right: 1540 },
        anchorRect: { top: 820, bottom: 844 },
        panelWidth: 290,
        panelHeight: 220,
        viewportWidth: 1600,
        viewportHeight: 900,
        margin: 12,
        gap: 14,
    });

    assert.equal(position.left, 732);
});

test('floating panel falls back below the anchor when there is no room above', () => {
    const position = resolveFloatingPanelPosition({
        shellRect: { left: 720, right: 1540 },
        anchorRect: { top: 20, bottom: 44 },
        panelWidth: 320,
        panelHeight: 240,
        viewportWidth: 1600,
        viewportHeight: 900,
        margin: 12,
        gap: 14,
    });

    assert.equal(position.top, 58);
});

test('camera floating panels are persistent and should not rely on outside-click dismissal helpers', async () => {
    const module = await import('../public/editor-floating-panels.js');
    assert.equal('shouldDismissFloatingPanel' in module, false);
});

test('focused floating panel is assigned the higher z-index', () => {
    assert.deepEqual(
        resolveFloatingPanelLayerZIndices('cameraSettings'),
        { cameraSettings: 62, cameraPreview: 60 }
    );

    assert.deepEqual(
        resolveFloatingPanelLayerZIndices('cameraPreview'),
        { cameraSettings: 60, cameraPreview: 62 }
    );
});
