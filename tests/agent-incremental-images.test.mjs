import test from 'node:test';
import assert from 'node:assert/strict';

import {
    mergeAgentIncrementalImages,
    resolveAgentImageSelectionIndex,
} from '../src/editor/agent-incremental-images.js';

function image(id, sourceOrdinal, relativePath = `${id}.png`) {
    return {
        id,
        relativePath,
        metadata: { sourceOrdinal },
    };
}

test('incremental asset images sort by source ordinal without moving selection from the first completion', () => {
    const first = mergeAgentIncrementalImages([], [image('component_3d_003', 2)], 0);
    assert.deepEqual(first.images.map((item) => item.id), ['component_3d_003']);
    assert.equal(first.selectedIndex, 0);

    const second = mergeAgentIncrementalImages(first.images, [image('component_3d_002', 1)], first.selectedIndex);
    assert.deepEqual(second.images.map((item) => item.id), ['component_3d_002', 'component_3d_003']);
    assert.equal(second.selectedIndex, 1);
    assert.equal(second.images[second.selectedIndex].id, 'component_3d_003');
});

test('incremental asset images replace a retried stable id without duplicating siblings', () => {
    const current = [
        image('component_3d_002', 1),
        image('component_3d_003', 2),
    ];
    const merged = mergeAgentIncrementalImages(
        current,
        [image('component_3d_002', 1, 'component_3d_002-retry.png')],
        1,
    );

    assert.deepEqual(merged.images.map((item) => item.id), ['component_3d_002', 'component_3d_003']);
    assert.equal(merged.images[0].relativePath, 'component_3d_002-retry.png');
    assert.equal(merged.images[merged.selectedIndex].id, 'component_3d_003');
});

test('terminal image selection resolves the streamed asset identity in a complete ordered gallery', () => {
    const streamedSelection = image('component_3d_003', 2);
    const finalImages = [
        image('component_3d_001', 0),
        image('component_3d_002', 1),
        image('component_3d_003', 2),
    ];

    assert.equal(resolveAgentImageSelectionIndex(finalImages, streamedSelection, 0), 2);
});

test('stable component ids preserve source ordering for legacy images without ordinal metadata', () => {
    const legacy03 = { id: 'component_3d_003', relativePath: '03.png' };
    const incoming02 = image('component_3d_002', 1);
    const merged = mergeAgentIncrementalImages([legacy03], [incoming02], 0);

    assert.deepEqual(merged.images.map((item) => item.id), ['component_3d_002', 'component_3d_003']);
    assert.equal(merged.images[merged.selectedIndex].id, 'component_3d_003');
});
