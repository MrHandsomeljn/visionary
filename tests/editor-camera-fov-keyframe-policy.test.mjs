import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('timeline camera fov uses independent keyframe storage and export payloads', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');
    const html = readFileSync(new URL('../public/editor.html', import.meta.url), 'utf8');

    assert.match(source, /cameraFovKeyframes:\s*\[\]/);
    assert.match(source, /function applyTimelineCameraFov\(value, silent = false, markDirty = true\)/);
    assert.match(source, /function updateTimelineCameraFovFromInput\(\)/);
    assert.match(source, /findCameraFovKeyframeIndexByFrame\(frame\)/);
    assert.match(source, /document\.activeElement !== dom\.timelineCameraFovNumber/);
    assert.match(source, /const parsed = extractNumericValue\(dom\.timelineCameraFovNumber\.value\);/);
    assert.match(source, /nudgeNumericInputValue\(\s*dom\.timelineCameraFovNumber\.value,\s*0\.001/);
    assert.match(source, /fovKeyframes:\s*\(Array\.isArray\(state\.cameraFovKeyframes\) \? state\.cameraFovKeyframes : \[\]\)/);
    assert.match(html, /id="timelineCameraFovRange"/);
    assert.match(html, /id="timelineCameraFovNumber"/);
});

test('timeline delete action removes fov keyframes before pose keyframes on the same frame', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /const fovIndex = findCameraFovKeyframeIndexByFrame\(frame\);/);
    assert.match(source, /if \(fovIndex >= 0\) \{/);
    assert.match(source, /state\.cameraFovKeyframes\.splice\(fovIndex, 1\)/);
});

test('timeline track renders compact fov markers independently from pose markers', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../public/editor.css', import.meta.url), 'utf8');

    assert.match(source, /class="timeline-fov-marker/);
    assert.match(source, /state\.cameraFovKeyframes\.length > 0/);
    assert.match(css, /\.timeline-fov-marker \{/);
});

test('scene and timeline camera sliders share the compact accent styling', () => {
    const css = readFileSync(new URL('../public/editor.css', import.meta.url), 'utf8');

    assert.match(css, /#sceneDepthScale,\s*#sceneFovRange,\s*#cameraDisplayScale,\s*#timelineCameraFovRange/);
    assert.match(css, /#sceneDepthScale,[\s\S]*#timelineEaseParam \{[\s\S]*height:\s*6px;[\s\S]*accent-color:\s*var\(--accent\);/);
    assert.doesNotMatch(css, /#timelineCameraFovRange::-webkit-slider-thumb/);
});
