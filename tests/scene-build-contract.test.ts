import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hashFromCanonicalAssetPath,
  isCanonicalAssetPath,
  normalizeSceneBuildAssetReference,
  normalizeSceneBuildStagePayload,
  normalizeSceneBuildStepKey,
  normalizeSceneBuildStatusId,
  SCENE_BUILD_STEP_KEYS,
} from '../src/server/scene-build-contract.ts';

const HASH_A = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const HASH_B = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

test('scene-build contract owns the staged scene keys', () => {
  assert.deepEqual([...SCENE_BUILD_STEP_KEYS], [
    'main-image',
    'top-view',
    'layout',
    'object-images',
    'components-3d',
    'insert-scene',
  ]);
});

test('scene-build status normalization excludes camera-only statuses', () => {
  assert.equal(normalizeSceneBuildStatusId('pending'), 'pending');
  assert.equal(normalizeSceneBuildStatusId('running'), 'running');
  assert.equal(normalizeSceneBuildStatusId('queuing'), 'queuing');
  assert.equal(normalizeSceneBuildStatusId('TLE'), 'TLE');
  assert.equal(normalizeSceneBuildStatusId('tle'), 'TLE');
  assert.equal(normalizeSceneBuildStatusId('complete'), 'done');
  assert.equal(normalizeSceneBuildStatusId('cancelled'), 'canceled');
  assert.equal(normalizeSceneBuildStatusId('error'), 'failed');
  assert.equal(normalizeSceneBuildStatusId('rendering'), '');
  assert.equal(normalizeSceneBuildStatusId('skipped'), '');
});

test('canonical asset references normalize assets/<sha256> paths only', () => {
  const reference = normalizeSceneBuildAssetReference({
    path: `assets/${HASH_A}.glb`,
    mimeType: 'model/gltf-binary',
    bytes: 1024,
    kind: 'component_glb',
    provenance: {
      workflow: 'scene-build',
      stepKey: 'components-3d',
    },
  });

  assert.deepEqual(reference, {
    assetId: `sha256:${HASH_A}`,
    hash: HASH_A,
    path: `assets/${HASH_A}.glb`,
    mimeType: 'model/gltf-binary',
    bytes: 1024,
    kind: 'component_glb',
    provenance: {
      workflow: 'scene-build',
      stepKey: 'components-3d',
    },
  });
  assert.equal(isCanonicalAssetPath(`assets/${HASH_A}.glb`), true);
  assert.equal(hashFromCanonicalAssetPath(`assets/${HASH_A}.glb`), HASH_A);
  assert.equal(isCanonicalAssetPath(`agent_history/assets/new_pipeline/project/run/${HASH_A}.glb`), false);
  assert.equal(normalizeSceneBuildAssetReference({ path: `agent_history/assets/new_pipeline/project/run/${HASH_A}.glb` }), null);
});

test('canonical asset references reject inconsistent hash identities', () => {
  assert.equal(
    normalizeSceneBuildAssetReference({
      path: `assets/${HASH_A}.png`,
      hash: HASH_B,
    }),
    null,
  );
  assert.equal(
    normalizeSceneBuildAssetReference({
      path: `assets/${HASH_A}.png`,
      assetId: `sha256:${HASH_B}`,
    }),
    null,
  );
});

test('stage payload normalization deduplicates actions and canonical asset references', () => {
  const payload = normalizeSceneBuildStagePayload({
    workflow: 'scene-build',
    sessionId: 'session-1',
    attemptId: 'attempt-1',
    stepKey: 'insert-scene',
    statusId: 'done',
    actions: ['cancel', 'retry', 'apply', 'retry', 'skipped'],
    assetReferences: [
      {
        path: `assets/${HASH_A}.glb`,
        mimeType: 'model/gltf-binary',
        bytes: 512,
      },
      {
        assetRef: {
          path: `assets/${HASH_A}.glb`,
        },
      },
      {
        path: `agent_history/assets/new_pipeline/project/run/debug.png`,
      },
    ],
    sceneInsertPlan: {
      schema: 'visionary.scene_insert_plan',
    },
    error: {
      message: 'preview failed',
      details: { code: 'LOAD_FAILED' },
    },
  });

  assert.deepEqual(payload, {
    workflow: 'scene-build',
    sessionId: 'session-1',
    attemptId: 'attempt-1',
    stepKey: 'insert-scene',
    statusId: 'done',
    actions: ['cancel', 'retry', 'apply'],
    assetReferences: [
      {
        assetId: `sha256:${HASH_A}`,
        hash: HASH_A,
        path: `assets/${HASH_A}.glb`,
        mimeType: 'model/gltf-binary',
        bytes: 512,
      },
    ],
    sceneInsertPlan: {
      schema: 'visionary.scene_insert_plan',
    },
    error: {
      message: 'preview failed',
      details: { code: 'LOAD_FAILED' },
    },
  });
});

test('stage payload normalization accepts underscore MCP stage aliases', () => {
  const payload = normalizeSceneBuildStagePayload({
    workflow: 'scene-build',
    stage: 'insert_scene',
    statusId: 'complete',
  });

  assert.equal(payload?.stepKey, 'insert-scene');
  assert.equal(payload?.statusId, 'done');
});

test('scene-build step key normalization accepts persisted UI aliases', () => {
  assert.equal(normalizeSceneBuildStepKey('objectImages'), 'object-images');
  assert.equal(normalizeSceneBuildStepKey('object_images'), 'object-images');
  assert.equal(normalizeSceneBuildStepKey('object-image'), 'object-images');
  assert.equal(normalizeSceneBuildStepKey('components3D'), 'components-3d');
  assert.equal(normalizeSceneBuildStepKey('insertScene'), 'insert-scene');
});

test('stage payload normalization rejects unknown stage keys and other workflows', () => {
  assert.equal(normalizeSceneBuildStagePayload({ stepKey: 'front-view' }), null);
  assert.equal(normalizeSceneBuildStagePayload({ workflow: 'camera-direct', stepKey: 'main-image' }), null);
});
