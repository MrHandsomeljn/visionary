import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('timeline camera fov uses independent keyframe storage and export payloads', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');
    const html = readFileSync(new URL('../public/editor.html', import.meta.url), 'utf8');

    assert.match(source, /cameraFovKeyframes:\s*\[\]/);
    assert.match(source, /function applyTimelineCameraFov\(value, silent = false, markDirty = true\)/);
    assert.match(source, /findCameraFovKeyframeIndexByFrame\(frame\)/);
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
