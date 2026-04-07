import test from 'node:test';
import assert from 'node:assert/strict';

import {
    beginDemoCameraPreview,
    commitDemoCameraPreview,
    DEMO_CAMERA_WORKFLOW_ID,
    DEMO_SCENE_FOLDER_NAME,
    DEMO_SCENE_WORKFLOW_ID,
    buildDemoKeyframeRevealQueue,
    buildDemoModelRevealQueue,
    createDemoSceneState,
    createInactiveDemoSceneState,
    isDemoSceneFolder,
    restoreDemoCameraBackup,
    revealDemoCameraPreviewThroughCount,
} from '../src/editor/demo-scene-orchestrator.js';

test('demo scene folder detection only activates for the moon folder name', () => {
    assert.equal(DEMO_SCENE_FOLDER_NAME, 'moon');
    assert.equal(DEMO_SCENE_WORKFLOW_ID, 'scene-build');
    assert.equal(DEMO_CAMERA_WORKFLOW_ID, 'camera-direct');
    assert.equal(isDemoSceneFolder('moon'), true);
    assert.equal(isDemoSceneFolder(' Moon '), true);
    assert.equal(isDemoSceneFolder('mars'), false);
});

test('demo model reveal queue sorts by model name and keeps stable fallback order', () => {
    assert.deepEqual(
        buildDemoModelRevealQueue([
            { id: 'b', name: 'shot10.glb' },
            { id: 'a', name: 'shot2.glb' },
            { id: 'c', name: 'shot2.glb' },
            { id: 'd', name: 'Alpha.glb' },
        ]),
        [
            { id: 'd', name: 'Alpha.glb' },
            { id: 'a', name: 'shot2.glb' },
            { id: 'c', name: 'shot2.glb' },
            { id: 'b', name: 'shot10.glb' },
        ]
    );
});

test('demo keyframe reveal queue sorts by frame ascending', () => {
    assert.deepEqual(
        buildDemoKeyframeRevealQueue([
            { frame: 18, time: 0.75, camera: { position: { x: 3 } } },
            { frame: 6, time: 0.25, camera: { position: { x: 1 } } },
            { frame: 12, time: 0.5, camera: { position: { x: 2 } } },
        ]).map((item) => item.frame),
        [6, 12, 18]
    );
});

test('demo scene state is inactive outside the moon folder and queues data inside it', () => {
    assert.deepEqual(createInactiveDemoSceneState(), {
        active: false,
        folderName: '',
        sceneRevealStarted: false,
        sceneRevealCompleted: false,
        modelRevealQueue: [],
        nextModelIndex: 0,
        keyframeRevealQueue: [],
        nextKeyframeIndex: 0,
        cameraTimelineBackup: [],
        cameraPreviewKeyframes: [],
        cameraPreviewActive: false,
        cameraPreviewCompleted: false,
    });

    const inactive = createDemoSceneState({
        folderName: 'other',
        models: [{ id: 'm1', name: 'A' }],
        keyframes: [{ frame: 1, time: 0, camera: { position: { x: 0 } } }],
    });
    assert.equal(inactive.active, false);
    assert.equal(inactive.modelRevealQueue.length, 0);
    assert.equal(inactive.keyframeRevealQueue.length, 0);

    const active = createDemoSceneState({
        folderName: 'moon',
        models: [{ id: 'm2', name: 'B' }, { id: 'm1', name: 'A' }],
        keyframes: [{ frame: 10, time: 1, camera: { position: { x: 1 } } }],
    });
    assert.equal(active.active, true);
    assert.deepEqual(active.modelRevealQueue.map((item) => item.id), ['m1', 'm2']);
    assert.deepEqual(active.keyframeRevealQueue.map((item) => item.frame), [10]);
});

test('demo camera preview backs up the committed timeline, reveals keyframes progressively, and keeps the backup on commit', () => {
    const initial = createDemoSceneState({
        folderName: 'moon',
        keyframes: [
            { frame: 12, time: 0.5, camera: { position: { x: 2 } } },
            { frame: 24, time: 1, camera: { position: { x: 4 } } },
        ],
    });
    const committedTimeline = [
        { frame: 3, time: 0.125, camera: { position: { x: 0 } } },
        { frame: 6, time: 0.25, camera: { position: { x: 1 } } },
    ];

    const preview = beginDemoCameraPreview(initial, committedTimeline);
    assert.equal(preview.cameraPreviewActive, true);
    assert.equal(preview.cameraPreviewCompleted, false);
    assert.deepEqual(preview.cameraTimelineBackup.map((item) => item.frame), [3, 6]);
    assert.deepEqual(preview.cameraPreviewKeyframes, []);

    const mid = revealDemoCameraPreviewThroughCount(preview, 1);
    assert.deepEqual(mid.cameraPreviewKeyframes.map((item) => item.frame), [12]);
    assert.equal(mid.nextKeyframeIndex, 1);
    assert.equal(mid.cameraPreviewCompleted, false);

    const done = revealDemoCameraPreviewThroughCount(mid, 2);
    assert.deepEqual(done.cameraPreviewKeyframes.map((item) => item.frame), [12, 24]);
    assert.equal(done.cameraPreviewCompleted, true);

    const committed = commitDemoCameraPreview(done);
    assert.equal(committed.cameraPreviewActive, false);
    assert.deepEqual(committed.cameraTimelineBackup.map((item) => item.frame), [3, 6]);
});

test('demo camera preview restore clears the preview timeline and preserves the backup', () => {
    const preview = revealDemoCameraPreviewThroughCount(
        beginDemoCameraPreview(
            createDemoSceneState({
                folderName: 'moon',
                keyframes: [{ frame: 12, time: 0.5, camera: { position: { x: 2 } } }],
            }),
            [{ frame: 4, time: 0.2, camera: { position: { x: 1 } } }],
        ),
        1,
    );

    const restored = restoreDemoCameraBackup(preview);
    assert.equal(restored.cameraPreviewActive, false);
    assert.equal(restored.cameraPreviewCompleted, false);
    assert.deepEqual(restored.cameraPreviewKeyframes, []);
    assert.deepEqual(restored.cameraTimelineBackup.map((item) => item.frame), [4]);
});
