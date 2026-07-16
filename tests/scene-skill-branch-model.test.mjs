import test from 'node:test';
import assert from 'node:assert/strict';

import {
    activateSceneSkillCandidate,
    appendSceneSkillCandidate,
    createEmptySceneSkillBranch,
    createSceneSkillCandidate,
    createSceneSkillExecutionRef,
    getSceneSkillSiblingCandidates,
    getSceneSkillCandidateGallery,
    isSceneSkillExecutionCurrent,
    interruptSceneSkillBranchExecutions,
    migrateLegacySceneSkillAttempt,
    resolveActiveSceneSkillContext,
} from '../src/editor/scene-skill-branch-model.js';

function appendCandidate(branch, id, stepKey, context = {}) {
    return appendSceneSkillCandidate(branch, createSceneSkillCandidate({
        id,
        stepKey,
        parentCandidateIds: Object.values(branch.activeCandidateByStep),
        context,
    }));
}

test('appends retry siblings without replacing earlier candidates', () => {
    let branch = appendCandidate(createEmptySceneSkillBranch(), 'main-a', 'main-image', { images: [{ id: 'a' }] });
    branch = appendCandidate(branch, 'top-a', 'top-view', { images: [{ id: 'top-a' }] });
    branch = appendSceneSkillCandidate(branch, createSceneSkillCandidate({
        id: 'top-b',
        stepKey: 'top-view',
        parentCandidateIds: ['main-a'],
        context: { images: [{ id: 'top-b' }] },
    }));

    assert.deepEqual(getSceneSkillSiblingCandidates(branch, 'top-view').map((item) => item.id), ['top-a', 'top-b']);
    assert.equal(branch.activeCandidateByStep['top-view'], 'top-b');
});

test('candidate gallery preserves every active output independently from retry versions', () => {
    const imagesA = Array.from({ length: 6 }, (_, index) => ({ id: `object-a-${index + 1}` }));
    const imagesB = Array.from({ length: 4 }, (_, index) => ({ id: `object-b-${index + 1}` }));
    let branch = appendCandidate(createEmptySceneSkillBranch(), 'main-a', 'main-image');
    branch = appendCandidate(branch, 'objects-a', 'object-images', { images: imagesA, selectedImageIndex: 4 });
    branch = appendSceneSkillCandidate(branch, createSceneSkillCandidate({
        id: 'objects-b',
        stepKey: 'object-images',
        parentCandidateIds: ['main-a'],
        context: { images: imagesB, selectedImageIndex: 2 },
    }));

    let gallery = getSceneSkillCandidateGallery(branch, 'object-images');
    assert.deepEqual(gallery.images.map((image) => image.id), imagesB.map((image) => image.id));
    assert.equal(gallery.selectedImageIndex, 2);
    assert.deepEqual(gallery.candidateIds, ['objects-a', 'objects-b']);
    assert.equal(gallery.candidateIndex, 1);

    branch = activateSceneSkillCandidate(branch, 'objects-a');
    gallery = getSceneSkillCandidateGallery(branch, 'object-images');
    assert.equal(gallery.images.length, 6);
    assert.equal(gallery.selectedImageIndex, 4);
    assert.equal(gallery.candidateIndex, 0);
});

test('switching a candidate restores its saved descendant subtree', () => {
    let branch = appendCandidate(createEmptySceneSkillBranch(), 'main-a', 'main-image');
    branch = appendCandidate(branch, 'top-a', 'top-view');
    branch = appendCandidate(branch, 'layout-a', 'layout');
    branch = activateSceneSkillCandidate(branch, 'main-a');
    branch = appendSceneSkillCandidate(branch, createSceneSkillCandidate({
        id: 'top-b',
        stepKey: 'top-view',
        parentCandidateIds: ['main-a'],
    }));
    branch = appendCandidate(branch, 'layout-b', 'layout');

    assert.equal(activateSceneSkillCandidate(branch, 'top-a').activeCandidateByStep.layout, 'layout-a');
    assert.equal(activateSceneSkillCandidate(branch, 'top-b').activeCandidateByStep.layout, 'layout-b');
});

test('switching to a candidate without descendants clears downstream path', () => {
    let branch = appendCandidate(createEmptySceneSkillBranch(), 'main-a', 'main-image');
    branch = appendCandidate(branch, 'top-a', 'top-view');
    branch = appendCandidate(branch, 'layout-a', 'layout');
    branch = activateSceneSkillCandidate(branch, 'main-a');
    branch = appendSceneSkillCandidate(branch, createSceneSkillCandidate({
        id: 'top-b',
        stepKey: 'top-view',
        parentCandidateIds: ['main-a'],
    }));

    assert.deepEqual(branch.activeCandidateByStep, {
        'main-image': 'main-a',
        'top-view': 'top-b',
    });
});

test('different parent scopes are excluded from sibling gallery', () => {
    let branch = appendCandidate(createEmptySceneSkillBranch(), 'main-a', 'main-image');
    branch = appendCandidate(branch, 'top-a', 'top-view');
    branch = activateSceneSkillCandidate(branch, 'main-a');
    branch = appendSceneSkillCandidate(branch, createSceneSkillCandidate({
        id: 'main-b',
        stepKey: 'main-image',
        parentCandidateIds: [],
    }));
    branch = appendCandidate(branch, 'top-b', 'top-view');

    assert.deepEqual(getSceneSkillSiblingCandidates(branch, 'top-view').map((item) => item.id), ['top-b']);
});

test('active context is resolved from one branch and keeps structured outputs', () => {
    let branch = appendCandidate(createEmptySceneSkillBranch(), 'main-a', 'main-image', {
        images: [{ id: 'main' }],
    });
    branch = appendCandidate(branch, 'top-a', 'top-view', {
        images: [{ id: 'top' }],
        annotations: { horizon: 0.4 },
    });
    const context = resolveActiveSceneSkillContext(branch, 'layout');

    assert.deepEqual(context.parentCandidateIds, ['main-a', 'top-a']);
    assert.equal(context.candidatesByStep['top-view'].annotations.horizon, 0.4);
});

test('execution responses require the same revision and dependency parents', () => {
    let branch = appendCandidate(createEmptySceneSkillBranch(), 'main-a', 'main-image');
    const executionRef = createSceneSkillExecutionRef({
        executionId: 'exec-top',
        attemptId: 'attempt-a',
        stepKey: 'top-view',
        branch,
    });
    branch = {
        ...branch,
        activeExecutionByStep: { 'top-view': executionRef },
    };

    assert.equal(isSceneSkillExecutionCurrent(branch, executionRef, {
        executionId: 'exec-top',
        attemptId: 'attempt-a',
        stepKey: 'top-view',
        parentCandidateIds: ['main-a'],
    }), true);
    assert.equal(isSceneSkillExecutionCurrent({ ...branch, revision: branch.revision + 1 }, executionRef), false);
    assert.equal(isSceneSkillExecutionCurrent(branch, executionRef, { parentCandidateIds: ['main-b'] }), false);
});

test('persisted active executions become interrupted on hydration', () => {
    const branch = interruptSceneSkillBranchExecutions({
        ...createEmptySceneSkillBranch(),
        revision: 3,
        activeExecutionByStep: {
            layout: { executionId: 'exec-layout' },
        },
        activeTaskExecution: { executionId: 'exec-task' },
    });

    assert.equal(branch.revision, 4);
    assert.deepEqual(branch.activeExecutionByStep, {});
    assert.equal(branch.activeTaskExecution, null);
});

test('legacy attempts migrate to one deterministic aggregate candidate path', () => {
    const attempt = migrateLegacySceneSkillAttempt({
        id: 'attempt-legacy',
        workflow: 'scene-build',
        createdAt: '2026-07-13T00:00:00.000Z',
        steps: [
            { stepKey: 'main-image', images: [{ id: 'main' }], selectedIndex: 0, applied: true },
            { stepKey: 'top-view', images: [{ id: 'top-1' }, { id: 'top-2' }], selectedIndex: 1 },
            { stepKey: 'layout', images: [] },
        ],
    });

    assert.equal(attempt.sceneBranch.migratedFromLegacy, true);
    assert.deepEqual(Object.keys(attempt.sceneBranch.activeCandidateByStep), ['main-image', 'top-view']);
    assert.equal(attempt.sceneBranch.candidatesById['attempt-legacy-top-view-candidate-1'].context.images.length, 2);
});
