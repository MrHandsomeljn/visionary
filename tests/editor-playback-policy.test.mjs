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
