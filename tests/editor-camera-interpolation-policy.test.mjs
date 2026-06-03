import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('timeline camera interpolation exposes sliders for position, rotation, and timing', () => {
    const html = readFileSync(new URL('../public/editor.html', import.meta.url), 'utf8');

    assert.doesNotMatch(html, /id="timelineCameraPositionInterpolation"/);
    assert.doesNotMatch(html, /id="timelineCameraRotationInterpolation"/);
    assert.doesNotMatch(html, /id="timelineCameraTimingInterpolation"/);
    assert.match(html, /data-i18n="timeline\.positionInterpolationShort">位置平滑</);
    assert.match(html, /data-i18n="timeline\.rotationInterpolationShort">旋转平滑</);
    assert.match(html, /data-i18n="timeline\.timingInterpolationShort">帧间节奏</);
    assert.match(html, /id="timelineCatmullParam"/);
    assert.match(html, /id="timelineCatmullParamValue"/);
    assert.match(html, /id="timelineRotationParam"/);
    assert.match(html, /id="timelineRotationParamValue"/);
    assert.match(html, /id="timelineRotationParam" min="0" max="1" step="0\.01" value="1"/);
    assert.match(html, /id="timelineRotationParamValue" min="0" max="1" step="0\.01" value="1\.00"/);
    assert.match(html, /id="timelineEaseParam"/);
    assert.match(html, /id="timelineEaseParamValue"/);
    assert.match(html, /id="timelineEaseParam" min="-1" max="1" step="0\.01" value="0"/);
    assert.match(html, /id="timelineEaseParamValue" min="-1" max="1" step="0\.01" value="0\.00"/);
});

test('camera interpolation state stores separate strengths with legacy compatibility mapping', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /cameraPositionInterpolation:\s*'linear'/);
    assert.match(source, /cameraRotationInterpolation:\s*'slerp'/);
    assert.match(source, /cameraTimingInterpolation:\s*'linear'/);
    assert.match(source, /cameraCatmullTension:\s*DEFAULT_CAMERA_POSITION_TENSION/);
    assert.match(source, /cameraRotationStrength:\s*DEFAULT_CAMERA_ROTATION_STRENGTH/);
    assert.match(source, /cameraEaseStrength:\s*DEFAULT_CAMERA_TIMING_STRENGTH/);
    assert.match(source, /const DEFAULT_CAMERA_POSITION_TENSION = 0;/);
    assert.match(source, /const DEFAULT_CAMERA_ROTATION_STRENGTH = 1;/);
    assert.match(source, /const DEFAULT_CAMERA_TIMING_STRENGTH = 0;/);
    assert.match(source, /function resolveCameraInterpolationStateFromLegacy\(mode, param = 0\.5\)/);
    assert.match(source, /function buildLegacyCameraInterpolationSnapshot\(\)/);
    assert.match(source, /function persistCameraInterpolationSettings\(\)/);
});

test('camera pose sampling composes timing easing with independent position and rotation interpolation strengths', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /function interpolateCameraPositionByMode\(keyframes, index, t, mode = state\.cameraPositionInterpolation\)/);
    assert.match(source, /function interpolateCameraRotationByMode\(keyframes, index, t, mode = state\.cameraRotationInterpolation\)/);
    assert.match(source, /function parseCameraInterpolationNumberInputValue\(value\)/);
    assert.match(source, /function commitCameraInterpolationNumberInput\(rawValue, applyFn, currentValue, digits\)/);
    assert.match(source, /return extractNumericValue\(value\);/);
    assert.match(source, /function handleCameraInterpolationInputArrowKey\(e, inputEl, step, fallbackValue, digits, applyFn\)/);
    assert.match(source, /function cameraPositionSmoothnessToTension\(value\)/);
    assert.match(source, /function cameraPositionTensionToSmoothness\(value\)/);
    assert.match(source, /const positionSmoothness = cameraPositionTensionToSmoothness\(state\.cameraCatmullTension\);/);
    assert.match(source, /document\.activeElement !== dom\.timelineCatmullParamValue/);
    assert.match(source, /document\.activeElement !== dom\.timelineRotationParamValue/);
    assert.match(source, /document\.activeElement !== dom\.timelineEaseParamValue/);
    assert.match(source, /function computeSquadTangent\(prev, current, next, strength = 1\)/);
    assert.match(source, /const strengthScale = clampCameraRotationStrength\(strength\);/);
    assert.match(source, /function interpolateQuaternionSquad\(prev, a, b, next, t, strength = state\.cameraRotationStrength\)/);
    assert.match(source, /min:\s*-1,[\s\S]*max:\s*1,[\s\S]*defaultParam:\s*0/);
    assert.match(source, /return Math\.abs\(clampCameraEaseStrength\(value\)\) > 1e-6/);
    assert.match(source, /const clampedStrength = Math\.max\(-1, Math\.min\(1, Number\(strength\) \|\| 0\)\);/);
    assert.match(source, /function smootherstepQuintic\(t\)/);
    assert.match(source, /const eased = smootherstepQuintic\(clampedT\);/);
    assert.match(source, /const accelerated = \(2 \* clampedT\) - eased;/);
    assert.match(source, /const positionMode = resolveCameraPositionInterpolationModeFromTension\(state\.cameraCatmullTension\);/);
    assert.match(source, /const rotationMode = resolveCameraRotationInterpolationModeFromStrength\(state\.cameraRotationStrength\);/);
    assert.match(source, /const timingMode = resolveCameraTimingInterpolationModeFromStrength\(state\.cameraEaseStrength\);/);
    assert.match(source, /const timedT = timingMode === CAMERA_TIMING_INTERPOLATION_EASE[\s\S]*remapInterpolationTime\(t, state\.cameraEaseStrength\)[\s\S]*: t;/);
    assert.match(source, /const position = interpolateCameraPositionByMode\(keyframes, i, timedT, positionMode\);/);
    assert.match(source, /const rotation = interpolateCameraRotationByMode\(keyframes, i, timedT, rotationMode\);/);
    assert.doesNotMatch(source, /const fastNearKeyframes = clampedT < 0\.5/);
    assert.match(source, /return interpolateQuaternionSquad\(prev, a\.camera\.rotation, b\.camera\.rotation, next, t, squadStrength\);/);
    assert.match(source, /handleCameraInterpolationInputArrowKey\(\s*e,\s*dom\.timelineCatmullParamValue/);
    assert.match(source, /handleCameraInterpolationInputArrowKey\(\s*e,\s*dom\.timelineRotationParamValue/);
    assert.match(source, /handleCameraInterpolationInputArrowKey\(\s*e,\s*dom\.timelineEaseParamValue/);
});

test('scene timeline and camera-sequence export persist continuous interpolation strengths plus legacy fallback fields', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /async function buildSceneWorkspaceSnapshot\(options = \{\}\) \{[\s\S]*const legacyInterpolation = buildLegacyCameraInterpolationSnapshot\(\);/);
    assert.match(source, /function buildCameraSequenceExportPayload\(\) \{[\s\S]*const legacyInterpolation = buildLegacyCameraInterpolationSnapshot\(\);/);
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
