import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('render frame API exposes function-call rendering with explicit camera parameters', () => {
    const source = readFileSync(new URL('../src/exportMedia/renderFrame.ts', import.meta.url), 'utf8');
    const exportMediaIndex = readFileSync(new URL('../src/exportMedia/index.ts', import.meta.url), 'utf8');
    const packageIndex = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
    const editorApp = readFileSync(new URL('../src/editor/editor-app.ts', import.meta.url), 'utf8');
    const recordingCamera = readFileSync(new URL('../src/exportMedia/RecordingCamera.ts', import.meta.url), 'utf8');

    assert.match(source, /export class VisionaryFrameRenderer/);
    assert.match(source, /export async function renderVisionaryFrame/);
    assert.match(source, /export function applyVisionaryCameraParameters/);
    assert.match(source, /export interface VisionaryCameraIntrinsics[\s\S]*fx:\s*number;[\s\S]*fy\?:\s*number;[\s\S]*cx\?:\s*number;[\s\S]*cy\?:\s*number;/);
    assert.match(source, /export interface VisionaryCameraExtrinsics[\s\S]*matrix:\s*ArrayLike<number>;[\s\S]*convention\?:\s*VisionaryExtrinsicConvention;[\s\S]*layout\?:\s*VisionaryMatrixLayout;/);
    assert.match(source, /camera\.projectionMatrix\.set\([\s\S]*\(2 \* fx\) \/ width[\s\S]*\(2 \* fy\) \/ height[\s\S]*\);/);
    assert.match(source, /coordinateSystem \|\| "three"\) === "opencv"[\s\S]*THREE_FROM_OPENCV_CAMERA/);
    assert.match(source, /outputs\?:\s*VisionaryRenderOutput\[\];/);
    assert.match(source, /result\.imageData = readCanvasImageData\(canvas\);/);
    assert.match(source, /result\.blob = await canvasToBlob\(canvas, options\.mimeType, options\.quality\);/);

    assert.match(recordingCamera, /preserveCameraProjection\?:\s*boolean;/);
    assert.match(recordingCamera, /if \(!options\.preserveCameraProjection\) \{[\s\S]*camera\.updateProjectionMatrix\(\);[\s\S]*\}/);

    assert.match(exportMediaIndex, /renderVisionaryFrame/);
    assert.match(packageIndex, /renderVisionaryFrame/);
    assert.match(editorApp, /getRenderFrameContext\(\): VisionaryRenderFrameContext \| null/);
    assert.match(editorApp, /createFrameRenderer\(id\?: string\): VisionaryFrameRenderer \| null/);
    assert.match(editorApp, /async renderFrame\(options: VisionaryRenderFrameOptions\): Promise<VisionaryRenderFrameResult>/);
});
