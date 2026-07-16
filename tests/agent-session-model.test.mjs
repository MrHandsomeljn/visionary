import test from 'node:test';
import assert from 'node:assert/strict';

import {
    appendAgentSessionRetryAttempt,
    appendAgentSessionWholeTaskRetryAttempt,
    buildAgentAssetPath,
    createAgentGenerationAttempt,
    createAgentSession,
    getAgentAttemptStepBlocks,
    getAgentSessionActiveAttempt,
    normalizeAgentAttemptStatus,
    resolveAgentSessionActionAvailability,
    resolveAgentSessionPagerItems,
    setAgentSessionArchiveState,
} from '../src/editor/agent-session-model.js';

test('creates a generation session with a single active attempt', () => {
    const session = createAgentSession({
        workflow: 'object-insert',
        prompt: '生成一把木椅',
        attachments: [{ name: 'chair-ref.png', type: 'image/png' }],
        attempt: createAgentGenerationAttempt({
            workflow: 'object-insert',
            text: '开始生成',
            blocks: [{ id: 'progress-1', type: 'progress', value: 0.1 }],
        }),
    });

    assert.equal(session.kind, 'session');
    assert.equal(session.workflow, 'object-insert');
    assert.equal(session.attempts.length, 1);
    assert.equal(session.activeAttemptIndex, 0);
    assert.equal(session.archiveState, 'active');
    assert.equal(session.collapsed, false);
    assert.equal(getAgentSessionActiveAttempt(session).text, '开始生成');
});

test('generation attempts can expose pipeline steps as the primary block model', () => {
    const attempt = createAgentGenerationAttempt({
        workflow: 'scene-build',
        text: '多步骤生成',
        blocks: [{ id: 'legacy-progress', type: 'progress', stepKey: 'legacy', value: 1 }],
        steps: [
            { id: 'step-main', type: 'progress', stepKey: 'main-image', value: 1, applied: true },
            { id: 'step-top', type: 'progress', stepKey: 'top-view', value: 0, isCurrent: true },
        ],
        status: 'complete',
    });

    assert.equal(attempt.steps.length, 2);
    assert.equal(getAgentAttemptStepBlocks(attempt)[0].stepKey, 'main-image');
    assert.equal(getAgentAttemptStepBlocks(attempt)[1].stepKey, 'top-view');
});

test('retry appends a new attempt and switches the pager to the latest attempt', () => {
    const session = createAgentSession({
        workflow: 'character-create',
        prompt: '生成一个女性角色',
        attempt: createAgentGenerationAttempt({
            workflow: 'character-create',
            text: '第一次尝试',
            blocks: [],
        }),
    });

    const retried = appendAgentSessionRetryAttempt(
        session,
        createAgentGenerationAttempt({
            workflow: 'character-create',
            text: '第二次尝试',
            blocks: [{ id: 'progress-2', type: 'progress', value: 0.2 }],
        })
    );

    assert.equal(retried.attempts.length, 2);
    assert.equal(retried.activeAttemptIndex, 1);
    assert.equal(getAgentSessionActiveAttempt(retried).text, '第二次尝试');
    assert.equal(retried.archiveState, 'active');
    assert.equal(retried.collapsed, false);
});

test('retry replaces an interrupted active attempt instead of appending a new version', () => {
    const session = createAgentSession({
        workflow: 'scene-build',
        prompt: '生成场景',
        attempt: createAgentGenerationAttempt({
            id: 'attempt-interrupted',
            workflow: 'scene-build',
            text: '任务已中断',
            status: 'interrupted',
            blocks: [],
        }),
    });

    const retried = appendAgentSessionRetryAttempt(
        session,
        createAgentGenerationAttempt({
            id: 'attempt-retry',
            workflow: 'scene-build',
            text: '重新生成',
            blocks: [{ id: 'progress-retry', type: 'progress', value: 0.1 }],
        })
    );

    assert.equal(retried.attempts.length, 1);
    assert.equal(retried.activeAttemptIndex, 0);
    assert.equal(getAgentSessionActiveAttempt(retried).id, 'attempt-retry');
    assert.equal(getAgentSessionActiveAttempt(retried).text, '重新生成');
});

test('whole task retry preserves the interrupted attempt and appends a new version', () => {
    const session = createAgentSession({
        workflow: 'scene-build',
        prompt: '生成场景',
        attempt: createAgentGenerationAttempt({
            id: 'attempt-running',
            workflow: 'scene-build',
            status: 'running',
        }),
    });
    const retried = appendAgentSessionWholeTaskRetryAttempt(session, createAgentGenerationAttempt({
        id: 'attempt-retry',
        workflow: 'scene-build',
        status: 'running',
    }));

    assert.equal(retried.attempts.length, 2);
    assert.equal(retried.attempts[0].status, 'interrupted');
    assert.equal(retried.activeAttemptIndex, 1);
    assert.equal(retried.attempts[1].id, 'attempt-retry');
});

test('cancel/apply archive state collapses the session into a compact tag model', () => {
    const session = createAgentSession({
        workflow: 'scene-build',
        prompt: '补全这个房间',
        attempt: createAgentGenerationAttempt({
            workflow: 'scene-build',
            text: '生成完成',
            blocks: [],
        }),
    });

    const canceled = setAgentSessionArchiveState(session, {
        archiveState: 'canceled',
        summaryLabel: '已取消',
        thumbnailUrl: 'mock://thumb.png',
    });

    assert.equal(canceled.archiveState, 'canceled');
    assert.equal(canceled.collapsed, true);
    assert.equal(canceled.archiveSummary.label, '已取消');
    assert.equal(canceled.archiveSummary.thumbnailUrl, 'mock://thumb.png');

    const applied = setAgentSessionArchiveState(canceled, {
        archiveState: 'applied',
        summaryLabel: '已应用',
    });

    assert.equal(applied.archiveState, 'applied');
    assert.equal(applied.collapsed, true);
    assert.equal(applied.archiveSummary.label, '已应用');
});

test('hashed asset paths are grouped under the shared assets folder', () => {
    assert.equal(
        buildAgentAssetPath({
            hashHex: 'abcdef1234567890fedcba0987654321abcdef1234567890fedcba0987654321',
            originalName: 'Scene Preview.PNG',
            fallbackExtension: '.bin',
        }),
        'assets/ab/abcdef1234567890fedcba0987654321abcdef1234567890fedcba0987654321.png'
    );

    assert.equal(
        buildAgentAssetPath({
            hashHex: '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
            originalName: '',
            fallbackExtension: '.gltf',
        }),
        'assets/00/00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff.gltf'
    );
});

test('pager shows all pages directly when total attempts do not exceed five', () => {
    assert.deepEqual(
        resolveAgentSessionPagerItems({ total: 5, activeIndex: 2 }),
        [
            { type: 'page', page: 1, index: 0, active: false },
            { type: 'page', page: 2, index: 1, active: false },
            { type: 'page', page: 3, index: 2, active: true },
            { type: 'page', page: 4, index: 3, active: false },
            { type: 'page', page: 5, index: 4, active: false },
        ]
    );
});

test('pager caps to seven controls with a leading contiguous window near the start', () => {
    assert.deepEqual(
        resolveAgentSessionPagerItems({ total: 9, activeIndex: 1 }),
        [
            { type: 'nav', direction: 'prev', targetIndex: 0, disabled: false },
            { type: 'page', page: 1, index: 0, active: false },
            { type: 'page', page: 2, index: 1, active: true },
            { type: 'page', page: 3, index: 2, active: false },
            { type: 'page', page: 4, index: 3, active: false },
            { type: 'page', page: 5, index: 4, active: false },
            { type: 'nav', direction: 'next', targetIndex: 2, disabled: false },
        ]
    );
});

test('pager keeps a centered five-page window when the active attempt is in the middle', () => {
    assert.deepEqual(
        resolveAgentSessionPagerItems({ total: 10, activeIndex: 4 }),
        [
            { type: 'nav', direction: 'prev', targetIndex: 3, disabled: false },
            { type: 'page', page: 3, index: 2, active: false },
            { type: 'page', page: 4, index: 3, active: false },
            { type: 'page', page: 5, index: 4, active: true },
            { type: 'page', page: 6, index: 5, active: false },
            { type: 'page', page: 7, index: 6, active: false },
            { type: 'nav', direction: 'next', targetIndex: 5, disabled: false },
        ]
    );
});

test('pager switches to the trailing contiguous window near the end', () => {
    assert.deepEqual(
        resolveAgentSessionPagerItems({ total: 8, activeIndex: 7 }),
        [
            { type: 'nav', direction: 'prev', targetIndex: 6, disabled: false },
            { type: 'page', page: 4, index: 3, active: false },
            { type: 'page', page: 5, index: 4, active: false },
            { type: 'page', page: 6, index: 5, active: false },
            { type: 'page', page: 7, index: 6, active: false },
            { type: 'page', page: 8, index: 7, active: true },
            { type: 'nav', direction: 'next', targetIndex: 7, disabled: true },
        ]
    );
});

test('running attempts disable retry and apply while keeping cancel available', () => {
    assert.deepEqual(
        resolveAgentSessionActionAvailability({
            archiveState: 'active',
            attemptStatus: 'running',
        }),
        {
            canCancel: true,
            canRetry: false,
            canApply: false,
        }
    );
});

test('scene tasks allow whole-task retry while running and never expose task apply', () => {
    assert.deepEqual(
        resolveAgentSessionActionAvailability({
            workflow: 'scene-build',
            archiveState: 'active',
            attemptStatus: 'running',
        }),
        {
            canCancel: true,
            canRetry: true,
            canApply: false,
        }
    );
});

test('completed attempts enable all actions', () => {
    assert.deepEqual(
        resolveAgentSessionActionAvailability({
            archiveState: 'active',
            attemptStatus: 'complete',
        }),
        {
            canCancel: true,
            canRetry: true,
            canApply: true,
        }
    );
});

test('failed attempts allow retry but keep apply disabled', () => {
    assert.deepEqual(
        resolveAgentSessionActionAvailability({
            archiveState: 'active',
            attemptStatus: 'failed',
        }),
        {
            canCancel: true,
            canRetry: true,
            canApply: false,
        }
    );
});

test('interrupted attempts disable apply but still allow retry and cancel', () => {
    assert.deepEqual(
        resolveAgentSessionActionAvailability({
            archiveState: 'active',
            attemptStatus: 'interrupted',
        }),
        {
            canCancel: true,
            canRetry: true,
            canApply: false,
        }
    );
    assert.equal(normalizeAgentAttemptStatus('running'), 'running');
    assert.equal(normalizeAgentAttemptStatus('interrupted'), 'interrupted');
    assert.equal(normalizeAgentAttemptStatus('cancelled'), 'canceled');
});
