import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveAgentPreviewInstanceAction } from '../src/editor/agent-preview-sync-policy.js';

test('creates a viewer instance when none exists yet', () => {
    assert.equal(
        resolveAgentPreviewInstanceAction({ hasInstance: false, hostChanged: false }),
        'create'
    );
});

test('reattaches an existing viewer instance when the host element changed', () => {
    assert.equal(
        resolveAgentPreviewInstanceAction({ hasInstance: true, hostChanged: true }),
        'reattach'
    );
});

test('reuses an existing viewer instance when the host element is stable', () => {
    assert.equal(
        resolveAgentPreviewInstanceAction({ hasInstance: true, hostChanged: false }),
        'reuse'
    );
});
