import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    CAMERA_PREVIEW_ASPECT_OPTIONS,
    getCameraPreviewAspectOption,
    normalizeCameraPreviewAspectId,
} from '../public/editor-camera-preview.js';

test('normalizeCameraPreviewAspectId falls back to the default preset', () => {
    assert.equal(normalizeCameraPreviewAspectId(undefined), '16:9');
    assert.equal(normalizeCameraPreviewAspectId(null), '16:9');
    assert.equal(normalizeCameraPreviewAspectId('unknown'), '16:9');
});

test('normalizeCameraPreviewAspectId keeps supported presets', () => {
    assert.equal(normalizeCameraPreviewAspectId('1:1'), '1:1');
    assert.equal(normalizeCameraPreviewAspectId('9:16'), '9:16');
    assert.equal(normalizeCameraPreviewAspectId('4:3'), '4:3');
});

test('getCameraPreviewAspectOption returns stable numeric aspect ratios', () => {
    assert.deepEqual(
        CAMERA_PREVIEW_ASPECT_OPTIONS.map((item) => item.id),
        ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9']
    );

    assert.equal(getCameraPreviewAspectOption('16:9')?.aspect, 16 / 9);
    assert.equal(getCameraPreviewAspectOption('9:16')?.aspect, 9 / 16);
    assert.equal(getCameraPreviewAspectOption('1:1')?.aspect, 1);
    assert.equal(getCameraPreviewAspectOption('unknown')?.aspect, 16 / 9);
});

test('camera preview panel has a concrete hidden display rule', () => {
    const css = readFileSync(new URL('../public/editor.css', import.meta.url), 'utf8');
    assert.match(css, /#cameraPreviewPanel\.hidden\s*\{\s*display:\s*none;\s*\}/);
});
