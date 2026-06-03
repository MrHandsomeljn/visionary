import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('scene camera interaction no longer pauses timeline playback', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');
    const callbackMatch = source.match(/app\.onCameraInteraction\?\.\(\(kind\) => \{([\s\S]*?)\n\s*}\);/);

    assert.ok(callbackMatch, 'expected to find app.onCameraInteraction callback');
    const callbackBody = callbackMatch[1];

    assert.doesNotMatch(callbackBody, /stopTimelinePlayback\(false\);/);
    assert.doesNotMatch(callbackBody, /相机动画: 已暂停（手动控制）/);
});

test('playback opens camera preview when timeline playback starts', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');
    const match = source.match(/function playCameraAnimation\(\) \{([\s\S]*?)\n\}/);

    assert.ok(match, 'expected to find playCameraAnimation');
    const body = match[1];

    assert.match(body, /setCameraPreviewOpen\(true\);/);
});

test('non-looping playback stops on the final frame instead of resetting to start', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');
    const match = source.match(/function tickTimelinePlayback\(timestamp\) \{([\s\S]*?)\n\}/);

    assert.ok(match, 'expected to find tickTimelinePlayback');
    const body = match[1];

    assert.match(body, /const finalFrame = getTimelineTotalFrames\(\);/);
    assert.match(body, /setTimelineFrame\(finalFrame, \{ applyPose: true, syncSlider: true, lightweightUi: true \}\);\s*stopTimelinePlayback\(false\);/);
    assert.doesNotMatch(body, /stopTimelinePlayback\(true\);/);
});

test('playback restarts from frame zero when play is pressed on the final frame', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');
    const match = source.match(/function playCameraAnimation\(\) \{([\s\S]*?)\n\}/);

    assert.ok(match, 'expected to find playCameraAnimation');
    const body = match[1];

    assert.match(body, /if \(state\.selectedFrame >= getTimelineTotalFrames\(\)\) \{\s*setTimelineFrame\(0, \{ applyPose: true, syncSlider: true \}\);\s*\}/);
});

test('timeline speed initializes to 1.0 on a fresh editor open', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');
    const match = source.match(/function initTimelineUI\(\) \{([\s\S]*?)\n\}/);

    assert.ok(match, 'expected to find initTimelineUI');
    const body = match[1];

    assert.match(source, /const TIMELINE_PLAYBACK_SPEED_DEFAULT = 1\.0;/);
    assert.match(body, /state\.timelinePlaybackSpeed = TIMELINE_PLAYBACK_SPEED_DEFAULT;/);
    assert.match(body, /dom\.timelineSpeed\.value = TIMELINE_PLAYBACK_SPEED_DEFAULT\.toFixed\(1\);/);
});

test('global playback shortcut only ignores text editing controls, not every input', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');
    const match = source.match(/function isEditingText\(\) \{([\s\S]*?)\n\}/);

    assert.ok(match, 'expected to find isEditingText');
    const body = match[1];

    assert.doesNotMatch(body, /return tag === 'INPUT' \|\| tag === 'TEXTAREA' \|\| active\.isContentEditable;/);
    assert.match(body, /active instanceof HTMLTextAreaElement/);
    assert.match(body, /active instanceof HTMLInputElement/);
    assert.match(body, /type === 'text'/);
});
