import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('camera preview sizing is driven by max-size box instead of raw panel width', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /cameraPreviewMaxSize:/);
    assert.match(source, /function resolveCameraPreviewViewportSize\(maxSize = state\.cameraPreviewMaxSize, aspect = getCameraPreviewAspectOption\(state\.cameraPreviewAspectId\)\.aspect\)/);
    assert.match(source, /const maxWidth = safeMaxSize \* 3;/);
    assert.match(source, /const maxHeight = safeMaxSize \* 4;/);
    assert.match(source, /if \(height > maxHeight\) \{/);
});

test('camera preview resize updates the implicit max-size value', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /let cameraPreviewResizeState = null;/);
    assert.match(source, /function beginCameraPreviewPanelResize\(event\)/);
    assert.match(source, /function moveCameraPreviewPanelResize\(event\)/);
    assert.match(source, /cameraPreviewMaxSize = clampCameraPreviewMaxSize/);
    assert.doesNotMatch(source, /CAMERA_PREVIEW_MAX_SIZE_STORAGE_KEY/);
    assert.doesNotMatch(source, /localStorage\.setItem\(CAMERA_PREVIEW_MAX_SIZE_STORAGE_KEY/);
    assert.doesNotMatch(source, /localStorage\.getItem\(CAMERA_PREVIEW_MAX_SIZE_STORAGE_KEY/);
});

test('camera preview panel is not capped to the legacy fixed 320px width', () => {
    const css = readFileSync(new URL('../public/editor.css', import.meta.url), 'utf8');
    const match = css.match(/\.floating-camera-preview \{([\s\S]*?)\n\}/);

    assert.ok(match, 'expected to find .floating-camera-preview rule');
    const body = match[1];

    assert.match(body, /width:\s*auto;/);
    assert.match(body, /max-width:\s*calc\(100vw - 48px\);/);
    assert.doesNotMatch(body, /max-width:\s*min\(320px,/);
});

test('camera preview renderer resize is coalesced instead of blocking every drag frame', () => {
    const source = readFileSync(new URL('../src/editor/editor-app.ts', import.meta.url), 'utf8');

    assert.match(source, /private cameraPreviewResizeSyncTimer: ReturnType<typeof setTimeout> \| null = null;/);
    assert.match(source, /private cameraPreviewResizeSyncDueAt = 0;/);
    assert.match(source, /private cameraPreviewResizePending = false;/);
    assert.match(source, /private scheduleCameraPreviewResizeSync\(/);
    assert.match(source, /requestCameraPreviewResizeSync\(delayMs = 80\): boolean \{/);
    assert.match(source, /this\.cameraPreviewResizePending = true;/);
    assert.match(source, /this\.cameraPreviewResizeSyncDueAt <= nextDueAt/);
    assert.match(source, /this\.cameraPreviewResizeSyncDueAt = nextDueAt;/);
    assert.match(source, /setTimeout\(\(\) => \{/);
});

test('camera preview panel DOM resize requests deferred renderer sync', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /app\?\.requestCameraPreviewResizeSync\?\.\(80\);/);
});
