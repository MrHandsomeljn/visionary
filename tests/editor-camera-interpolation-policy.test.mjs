import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('timeline camera interpolation exposes sliders for position, rotation, and timing', () => {
    const html = readFileSync(new URL('../public/editor.html', import.meta.url), 'utf8');

    assert.doesNotMatch(html, /id="timelineCameraPositionInterpolation"/);
    assert.doesNotMatch(html, /id="timelineCameraRotationInterpolation"/);
    assert.doesNotMatch(html, /id="timelineCameraTimingInterpolation"/);
    assert.match(html, /id="timelineCatmullParam"/);
    assert.match(html, /id="timelineRotationParam"/);
    assert.match(html, /id="timelineEaseParam"/);
    assert.match(html, /id="timelineEaseParam" min="-1" max="1" step="0\.01" value="0"/);
});

test('camera interpolation state stores separate strengths with legacy compatibility mapping', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /cameraPositionInterpolation:\s*'linear'/);
    assert.match(source, /cameraRotationInterpolation:\s*'slerp'/);
    assert.match(source, /cameraTimingInterpolation:\s*'linear'/);
    assert.match(source, /cameraCatmullTension:\s*1/);
    assert.match(source, /cameraRotationStrength:\s*0/);
    assert.match(source, /cameraEaseStrength:\s*0/);
    assert.match(source, /function resolveCameraInterpolationStateFromLegacy\(mode, param = 0\.5\)/);
    assert.match(source, /function buildLegacyCameraInterpolationSnapshot\(\)/);
    assert.match(source, /function persistCameraInterpolationSettings\(\)/);
});

test('camera pose sampling composes timing easing with independent position and rotation interpolation strengths', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /function interpolateCameraPositionByMode\(keyframes, index, t, mode = state\.cameraPositionInterpolation\)/);
    assert.match(source, /function interpolateCameraRotationByMode\(keyframes, index, t, mode = state\.cameraRotationInterpolation\)/);
    assert.match(source, /min:\s*-1,[\s\S]*max:\s*1,[\s\S]*defaultParam:\s*0/);
    assert.match(source, /return Math\.abs\(clampCameraEaseStrength\(value\)\) > 1e-6/);
    assert.match(source, /const clampedStrength = Math\.max\(-1, Math\.min\(1, Number\(strength\) \|\| 0\)\);/);
    assert.match(source, /const fastNearKeyframes = clampedT < 0\.5/);
    assert.match(source, /const positionMode = resolveCameraPositionInterpolationModeFromTension\(state\.cameraCatmullTension\);/);
    assert.match(source, /const rotationMode = resolveCameraRotationInterpolationModeFromStrength\(state\.cameraRotationStrength\);/);
    assert.match(source, /const timingMode = resolveCameraTimingInterpolationModeFromStrength\(state\.cameraEaseStrength\);/);
    assert.match(source, /const timedT = timingMode === CAMERA_TIMING_INTERPOLATION_EASE[\s\S]*remapInterpolationTime\(t, state\.cameraEaseStrength\)[\s\S]*: t;/);
    assert.match(source, /const position = interpolateCameraPositionByMode\(keyframes, i, timedT, positionMode\);/);
    assert.match(source, /const rotation = interpolateCameraRotationByMode\(keyframes, i, timedT, rotationMode\);/);
});

test('scene timeline and camera-sequence export persist continuous interpolation strengths plus legacy fallback fields', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /interpolationMode:\s*legacyInterpolation\.mode/);
    assert.match(source, /interpolationParam:\s*Number\(legacyInterpolation\.param/);
    assert.match(source, /positionInterpolationMode:\s*resolveCameraPositionInterpolationModeFromTension\(state\.cameraCatmullTension\)/);
    assert.match(source, /rotationInterpolationMode:\s*resolveCameraRotationInterpolationModeFromStrength\(state\.cameraRotationStrength\)/);
    assert.match(source, /timingInterpolationMode:\s*resolveCameraTimingInterpolationModeFromStrength\(state\.cameraEaseStrength\)/);
    assert.match(source, /positionInterpolationStrength:\s*Number\(state\.cameraCatmullTension/);
    assert.match(source, /rotationInterpolationStrength:\s*Number\(state\.cameraRotationStrength/);
    assert.match(source, /timingInterpolationStrength:\s*Number\(state\.cameraEaseStrength/);
    assert.match(source, /catmullTension:\s*Number\(state\.cameraCatmullTension/);
    assert.match(source, /easeStrength:\s*Number\(state\.cameraEaseStrength/);
});
