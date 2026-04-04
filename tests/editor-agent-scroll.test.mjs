import test from 'node:test';
import assert from 'node:assert/strict';

import {
    isAgentMessageScrollPinnedToBottom,
    resolveAgentMessageRefreshScrollTop,
    shouldForceAgentMessageBottomAfterRender,
} from '../public/editor-agent-scroll.js';

test('always mode always scrolls to bottom', () => {
    assert.equal(
        resolveAgentMessageRefreshScrollTop({
            mode: 'always',
            prevScrollTop: 0,
            prevClientHeight: 200,
            prevScrollHeight: 1200,
            nextScrollHeight: 1400,
        }),
        1200
    );
});

test('refresh keeps the viewport pinned to bottom only when it was already at bottom', () => {
    assert.equal(
        resolveAgentMessageRefreshScrollTop({
            mode: 'preserve-or-pin-bottom',
            prevScrollTop: 800,
            prevClientHeight: 200,
            prevScrollHeight: 1000,
            nextScrollHeight: 1360,
        }),
        1160
    );
});

test('refresh preserves absolute scrollTop when user is reading older content', () => {
    assert.equal(
        resolveAgentMessageRefreshScrollTop({
            mode: 'preserve-or-pin-bottom',
            prevScrollTop: 320,
            prevClientHeight: 200,
            prevScrollHeight: 1000,
            nextScrollHeight: 1360,
        }),
        320
    );
});

test('refresh clamps preserved scrollTop to the new maximum when content shrinks', () => {
    assert.equal(
        resolveAgentMessageRefreshScrollTop({
            mode: 'preserve-or-pin-bottom',
            prevScrollTop: 860,
            prevClientHeight: 200,
            prevScrollHeight: 1400,
            nextScrollHeight: 900,
        }),
        700
    );
});

test('bottom helper only returns true when the viewport is actually pinned to bottom', () => {
    assert.equal(
        isAgentMessageScrollPinnedToBottom({
            scrollTop: 796,
            clientHeight: 200,
            scrollHeight: 1000,
        }),
        false
    );
    assert.equal(
        isAgentMessageScrollPinnedToBottom({
            scrollTop: 799,
            clientHeight: 200,
            scrollHeight: 1000,
        }),
        true
    );
    assert.equal(
        isAgentMessageScrollPinnedToBottom({
            scrollTop: 800,
            clientHeight: 200,
            scrollHeight: 1000,
        }),
        true
    );
});

test('deferred bottom pin only runs for brand-new appends or updates that were already pinned', () => {
    assert.equal(
        shouldForceAgentMessageBottomAfterRender({
            mode: 'always',
            prevScrollTop: 120,
            prevClientHeight: 200,
            prevScrollHeight: 1200,
        }),
        true
    );

    assert.equal(
        shouldForceAgentMessageBottomAfterRender({
            mode: 'preserve-or-pin-bottom',
            prevScrollTop: 998,
            prevClientHeight: 200,
            prevScrollHeight: 1200,
        }),
        true
    );

    assert.equal(
        shouldForceAgentMessageBottomAfterRender({
            mode: 'preserve-or-pin-bottom',
            prevScrollTop: 700,
            prevClientHeight: 200,
            prevScrollHeight: 1200,
        }),
        false
    );
});
