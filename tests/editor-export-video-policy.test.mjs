import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('export modal exposes video aspect, RGB/depth/normal modes, and lightweight progress', () => {
    const html = readFileSync(new URL('../public/editor.html', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../public/editor.css', import.meta.url), 'utf8');

    assert.match(html, /id="exportAspectRatioRow"[\s\S]*id="exportAspectRatio"/);
    assert.match(html, /data-i18n="modal\.aspectRatio"/);
    assert.match(html, /id="exportVideoSpeedRow"[\s\S]*id="exportVideoSpeed"/);
    assert.match(html, /data-i18n="modal\.playbackSpeed"/);
    assert.match(html, /id="exportVideoFpsRow"[\s\S]*id="exportVideoFps"/);
    assert.match(html, /data-i18n="modal\.exportFps"/);
    assert.match(html, /value="color" data-i18n="modal\.exportRenderModes\.rgb">彩色图/);
    assert.match(html, /value="depth" data-i18n="modal\.exportRenderModes\.depth">深度图/);
    assert.match(html, /value="normal" data-i18n="modal\.exportRenderModes\.normal">法向图/);
    assert.match(html, /id="exportProgress" class="export-progress hidden"/);
    assert.match(html, /id="exportProgressFill" class="export-progress-fill"/);
    assert.match(html, /id="exportProgressText" class="export-progress-text" data-i18n="modal\.exportProgressIdle"/);

    assert.match(css, /\.export-progress\s*\{/);
    assert.match(css, /\.export-progress-fill\s*\{[\s\S]*transition:\s*width 120ms ease;/);
    assert.match(css, /\.export-form-row\.hidden\s*\{\s*display:\s*none;\s*\}/);
    assert.match(css, /\.export-form-row select option\s*\{[\s\S]*background:\s*var\(--panel-bg\);[\s\S]*color:\s*var\(--text-primary\);[\s\S]*\}/);
    assert.match(css, /body\.theme-light \.export-form-row select option\s*\{[\s\S]*background:\s*#ffffff;[\s\S]*color:\s*#1f2937;[\s\S]*\}/);
});

test('video export hides FOV, uses selected camera aspect, and does not pass modal FOV override', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /exportAspectRatio:\s*document\.getElementById\('exportAspectRatio'\)/);
    assert.match(source, /exportVideoSpeed:\s*document\.getElementById\('exportVideoSpeed'\)/);
    assert.match(source, /exportVideoFps:\s*document\.getElementById\('exportVideoFps'\)/);
    assert.match(source, /dom\.exportAspectRatioRow\?\.classList\.toggle\('hidden', !isVideo\)/);
    assert.match(source, /if \(dom\.exportAspectRatioRow\) dom\.exportAspectRatioRow\.hidden = !isVideo/);
    assert.match(source, /dom\.exportVideoSpeedRow\?\.classList\.toggle\('hidden', !isVideo\)/);
    assert.match(source, /dom\.exportVideoFpsRow\?\.classList\.toggle\('hidden', !isVideo\)/);
    assert.match(source, /dom\.exportFovRow\?\.classList\.toggle\('hidden', isVideo\)/);
    assert.match(source, /if \(dom\.exportFovRow\) dom\.exportFovRow\.hidden = isVideo/);
    assert.match(source, /const fov = isVideo \? null : clampSceneFov\(dom\.exportFov\?\.value\)/);
    assert.match(source, /buildExportResolutionOptions\(getSelectedExportAspectOption\(\)\)/);
    assert.match(source, /deriveResolutionForAspect\(preset, aspectOption\.aspect\)/);
    assert.match(source, /applySnapshotToRecordingCamera\(recordingCamera, cameraSnapshot, null, options\.aspect\)/);
    assert.doesNotMatch(source, /buildExportTimelineController\(recordingCamera,\s*options\.fov\)/);
});

test('video export can override timeline FPS and playback speed', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /function syncExportVideoTimingControls\(\)/);
    assert.match(source, /dom\.exportVideoSpeed\.value = String\(Number\(state\.timelinePlaybackSpeed \|\| 1\)\)/);
    assert.match(source, /dom\.exportVideoFps\.value = String\(Math\.max\(1, Number\(state\.timelineFps \|\| EXPORT_FALLBACK_FPS\)\)\)/);
    assert.match(source, /const fps = isVideo \? clampExportFps\(dom\.exportVideoFps\?\.value\) : null/);
    assert.match(source, /const playbackSpeed = isVideo \? clampExportPlaybackSpeed\(dom\.exportVideoSpeed\?\.value\) : null/);
    assert.match(source, /fps,\s*playbackSpeed,/);
    assert.match(source, /const exportFps = Math\.max\(1, Number\(options\.fps \|\| state\.timelineFps \|\| EXPORT_FALLBACK_FPS\)\)/);
    assert.match(source, /const playbackSpeed = Math\.max\(0\.01, Number\(options\.playbackSpeed \|\| 1\)\)/);
    assert.match(source, /const totalFrames = Math\.max\(1, Math\.round\(exportDurationSec \* exportFps\) \+ 1\)/);
    assert.match(source, /const sourceTimeSec = Math\.min\(sourceDurationSec, \(safeFrame \/ exportFps\) \* playbackSpeed\)/);
    assert.match(source, /fps: options\.fps,\s*playbackSpeed: options\.playbackSpeed,/);
    assert.match(source, /Math\.max\(0\.1, getExportVideoDurationSec\(options\.playbackSpeed\)\)/);
    assert.match(source, /Math\.max\(1, Number\(options\.fps \|\| state\.timelineFps \|\| EXPORT_FALLBACK_FPS\)\)/);
});

test('video timeline export drives recording camera from timeline pose and updates progress', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /function applyTimelinePoseToRecordingCamera\(recordingCamera, pose, options = \{\}\)/);
    assert.match(source, /const c2w = invertUnitQuaternion\(pose\.rotation\);/);
    assert.match(source, /const forward = rotateVectorByQuaternion\(\{ x: 0, y: 0, z: -1 \}, c2w\);/);
    assert.match(source, /recordingCamera\.camera\.lookAt\(/);
    assert.match(source, /recordingCamera\.camera\.fov = clampSceneFov\(pose\.fovDegrees\)/);
    assert.match(source, /function buildExportTimelineController\(recordingCamera, options = \{\}\)/);
    assert.match(source, /const sourceTimeSec = Math\.min\(sourceDurationSec, \(safeFrame \/ exportFps\) \* playbackSpeed\)/);
    assert.match(source, /const pose = interpolateCameraPoseAt\(sourceTimeSec\)/);
    assert.match(source, /options\.onProgress\?\.\(\(\(safeFrame \+ 1\) \/ totalFrames\) \* 100\)/);
    assert.match(source, /function setExportProgress\(percent, visible = pendingExportType === 'video'\)/);
    assert.match(source, /showLoading\(true, t\('loading\.renderingVideo'\), displayPercent, \{ passive: true \}\)/);
});

test('workspace camera pose records the timeline camera convention', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /const CAMERA_POSE_CONVENTION_TIMELINE_MINUS_Z = 'timeline_w2c_camera_local_negative_z'/);
    assert.match(source, /cameraPoseConvention: CAMERA_POSE_CONVENTION_TIMELINE_MINUS_Z/);
    assert.match(source, /function restoreSavedCameraPose\(env\)/);
    assert.match(source, /app\.setCoreCameraPose\(pose\)/);
});

test('export render mode labels are modal-specific RGB depth normal translations', () => {
    const html = readFileSync(new URL('../public/editor.html', import.meta.url), 'utf8');
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(html, /data-i18n="sceneSettings\.renderModes\.color">彩色图/);
    assert.match(source, /exportRenderModes:\s*\{[\s\S]*rgb: '彩色图'[\s\S]*depth: '深度图'[\s\S]*normal: '法向图'/);
    assert.match(source, /exportRenderModes:\s*\{[\s\S]*rgb: 'RGB'[\s\S]*depth: 'Depth'[\s\S]*normal: 'Normal'/);
    assert.match(source, /color: t\('modal\.exportRenderModes\.rgb'\)/);
    assert.match(source, /setElementText\(dom\.modeColor\?\.querySelector\('\.menu-btn-text'\), t\('modal\.exportRenderModes\.rgb'\)\)/);
    assert.match(source, /setElementText\(dom\.modeDepth\?\.querySelector\('\.menu-btn-text'\), t\('modal\.exportRenderModes\.depth'\)\)/);
    assert.match(source, /setElementText\(dom\.modeNormal\?\.querySelector\('\.menu-btn-text'\), t\('modal\.exportRenderModes\.normal'\)\)/);
    assert.match(source, /if \(exportModeOptions\[0\]\) exportModeOptions\[0\]\.textContent = t\('modal\.exportRenderModes\.rgb'\)/);
});

test('video frame capture waits for WebGPU before copying and does not resize the main editor renderer', () => {
    const recordingCamera = readFileSync(new URL('../src/exportMedia/RecordingCamera.ts', import.meta.url), 'utf8');
    const recordingManager = readFileSync(new URL('../src/exportMedia/RecordingManager.ts', import.meta.url), 'utf8');

    assert.match(recordingCamera, /if \(device && device\.queue\) \{\s*await device\.queue\.onSubmittedWorkDone\(\);\s*\}[\s\S]*const exportCanvas = document\.createElement\('canvas'\)/);
    assert.doesNotMatch(recordingCamera, /exportCtx\.drawImage\(sourceCanvas, 0, 0, width, height\);[\s\S]*await device\.queue\.onSubmittedWorkDone\(\);/);
    assert.doesNotMatch(recordingManager, /options\.mainRenderer\.setSize\(renderWidth, renderHeight, false\)/);
    assert.doesNotMatch(recordingManager, /const renderer = options\.mainRenderer;[\s\S]*renderer\.setSize\(renderWidth, renderHeight, false\)/);
    assert.match(recordingManager, /options\.recordingCamera\.renderer\.setSize\(renderWidth, renderHeight, false\)/);
});

test('recording environment fallback does not depend on missing bundled HDR and quiets normal Three fallback', () => {
    const envMapHelper = readFileSync(new URL('../src/utils/env-map-helper.ts', import.meta.url), 'utf8');
    const rendererInitHelper = readFileSync(new URL('../src/utils/renderer-init-helper.ts', import.meta.url), 'utf8');
    const recordingCamera = readFileSync(new URL('../src/exportMedia/RecordingCamera.ts', import.meta.url), 'utf8');

    assert.match(rendererInitHelper, /DEFAULT_FALLBACK_HDR_URL = ""/);
    assert.doesNotMatch(rendererInitHelper, /\/public\/textures\/hdr\/daytime\.hdr/);
    assert.match(envMapHelper, /const response = await fetch\(url\)/);
    assert.match(envMapHelper, /if \(!response\.ok\) \{/);
    assert.match(envMapHelper, /loader\.parse\(buffer\)/);
    assert.doesNotMatch(envMapHelper, /loader\.loadAsync\(url\)/);
    assert.match(recordingCamera, /private gaussianRenderFailureWarned = false/);
    assert.doesNotMatch(recordingCamera, /console\.warn\('fall back in three js render camera recording camera'\)/);
    assert.match(recordingCamera, /GS_VIDEO_EXPORT_DEBUG[\s\S]*Three\.js fallback rendered export frame/);
});

test('timeline video export waits on render callbacks instead of fixed per-frame sleeps', () => {
    const exportVideo = readFileSync(new URL('../src/exportMedia/exportVideo.ts', import.meta.url), 'utf8');
    const timelineModeMatch = exportVideo.match(/if \(mode === 'timeline' && timelineController\) \{([\s\S]*?)\n\s*\} else if \(mode === 'realtime'\)/);

    assert.ok(timelineModeMatch, 'expected timeline export branch');
    const timelineModeBody = timelineModeMatch[1];

    assert.match(timelineModeBody, /await timelineController\.setFrameIndex\(frameIndex\)/);
    assert.doesNotMatch(timelineModeBody, /setTimeout\(resolve,\s*100\)/);
    assert.doesNotMatch(timelineModeBody, /waitTimeMs/);
    assert.doesNotMatch(timelineModeBody, /继续下一帧/);
    assert.doesNotMatch(timelineModeBody, /console\.log\('frameIndex done'/);
});

test('recording manager has bounded encoder backpressure and fails frame errors loudly', () => {
    const recordingManager = readFileSync(new URL('../src/exportMedia/RecordingManager.ts', import.meta.url), 'utf8');

    assert.match(recordingManager, /maxInFlightFrames\?: number/);
    assert.match(recordingManager, /DEFAULT_MAX_IN_FLIGHT_FRAMES = 2/);
    assert.match(recordingManager, /private maxInFlightFrames: number = RecordingManager\.DEFAULT_MAX_IN_FLIGHT_FRAMES/);
    assert.match(recordingManager, /private async waitForEncoderBackpressure\(\): Promise<void>/);
    assert.match(recordingManager, /encoder\.encodeQueueSize >= this\.maxInFlightFrames/);
    assert.match(recordingManager, /await this\.waitForEncoderBackpressure\(\);/);
    assert.match(recordingManager, /const timestamp = \(this\.currentFrameIndex \* 1000000\) \/ this\.fps/);
    assert.match(recordingManager, /videoEncoder\.encode\(frame, \{ keyFrame \}\);[\s\S]*frame\.close\(\);[\s\S]*this\.currentFrameIndex\+\+/);
    assert.match(recordingManager, /catch \(error\) \{[\s\S]*console\.error\('渲染\/编码帧失败:', error\);[\s\S]*throw error;[\s\S]*\}/);
});

test('export progress bar and loading overlay use the same rounded percent', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /const displayPercent = Math\.round\(safePercent\)/);
    assert.match(source, /dom\.exportProgressFill\.style\.width = `\$\{displayPercent\}%`/);
    assert.match(source, /t\('modal\.exportProgressValue', \{ percent: displayPercent \}\)/);
    assert.match(source, /return displayPercent;/);
    assert.match(source, /const displayPercent = setExportProgress\(percent, true\);\s*showLoading\(true, t\('loading\.renderingVideo'\), displayPercent, \{ passive: true \}\)/);
});
