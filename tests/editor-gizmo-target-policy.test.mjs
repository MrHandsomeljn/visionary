import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('timeline camera gizmo binds to current timeline camera only when camera poses exist', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /function hasTimelineCameraPose\(\) \{/);
    assert.match(source, /return Array\.isArray\(state\.keyframes\) && state\.keyframes\.length > 0;/);
    assert.match(source, /resolveTimelineGizmoTarget\(\{[\s\S]*hasTimelineCamera: hasTimelineCameraPose\(\),[\s\S]*currentFrame: frame,/);
    assert.match(source, /if \(target\.kind !== 'camera-current' \|\| target\.frame === null\) return false;/);
    assert.match(source, /if \(state\.selectedModelId\) \{\s*closeEditor\(\);\s*\}/);
    assert.match(source, /state\.viewportGizmoMode = normalizeViewportGizmoModeForSelection\(state\.viewportGizmoMode, 'camera'\);/);
});

test('model selection clears camera target and restores model gizmo scale availability', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /function selectModel\(id, options = \{\}\) \{/);
    assert.match(source, /state\.selectedModelId = id;\s*state\.selectedCameraSequenceFrame = null;/);
    assert.match(source, /syncSelectedCameraSequenceFrameToApp\(\);/);
    assert.match(source, /const frame = state\.selectedModelId\s*\?\s*null\s*:\s*Number\.isFinite\(Number\(state\.selectedCameraSequenceFrame\)\)/);
    assert.match(source, /if \(state\.viewportGizmoMode\) \{\s*app\.setViewportGizmoMode\?\.\(state\.viewportGizmoMode\);\s*\} else \{\s*app\.refreshSelectedModelViewportGizmo\?\.\(\);\s*\}/);
    assert.match(source, /const disabled = !app \|\| \(mode === 'scale' && cameraSelectionActive\) \|\| \(cameraSelectionActive && state\.isPlaying\);/);
});

test('viewport gizmo exposes opt-in debug state for root-cause inspection', () => {
    const publicSource = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');
    const editorSource = readFileSync(new URL('../src/editor/editor-app.ts', import.meta.url), 'utf8');

    assert.match(publicSource, /globalThis\.visionaryDebugGizmo = \(reason = 'manual'\) => app\?\.debugViewportGizmoState\?\.\(reason\);/);
    assert.match(publicSource, /globalThis\.__visionaryDebugGizmo = globalThis\.visionaryDebugGizmo;/);
    assert.match(editorSource, /debugViewportGizmoState\(reason = "manual"\): Record<string, unknown> \{/);
    assert.match(editorSource, /console\.log\("\[EditorApp:gizmo\]", state\);/);
    assert.match(editorSource, /localStorage\?\.getItem\?\.\("visionary:gizmo-debug"\)/);
});

test('canvas object double click preserves look-at and gates gizmo target switching', () => {
    const source = readFileSync(new URL('../src/editor/editor-app.ts', import.meta.url), 'utf8');
    const clickHandler = source.match(/this\.canvas\.addEventListener\('click', \(e\) => \{([\s\S]*?)\n    \}\);/)?.[1] ?? '';
    const cameraPickMethod = source.match(/private getCameraSequencePickFromClient\(clientX: number, clientY: number\): \{[\s\S]*?\n  private pickCameraSequenceKeyframeFromClient/)?.[0] ?? '';

    assert.match(source, /this\.canvas\.addEventListener\('dblclick', \(e\) => \{\s*if \(this\.isEditingText\(\)\) return;\s*if \(e\.button !== 0\) return;\s*void this\.handleViewportDoubleClick\(e\.clientX, e\.clientY\)\.catch/);
    assert.match(source, /e\.preventDefault\(\);/);
    assert.doesNotMatch(clickHandler, /pickEditorModelFromClient/);
    assert.doesNotMatch(clickHandler, /pickCameraSequenceKeyframeFromClient/);
    assert.match(source, /private isViewportGizmoHitFromClient\(clientX: number, clientY: number\): boolean \{/);
    assert.match(source, /const helper = controls\?\.getHelper\?\.\(\) as THREE\.Object3D \| undefined;/);
    assert.match(source, /return raycaster\.intersectObject\(helper, true\)\.length > 0;/);
    assert.match(source, /private async handleViewportDoubleClick\(clientX: number, clientY: number\): Promise<boolean> \{/);
    assert.match(source, /if \(this\.isViewportGizmoHitFromClient\(clientX, clientY\)\) return true;\s*const pick = await this\.getViewportObjectPickFromClient\(clientX, clientY\);/);
    assert.match(source, /if \(!pick\) return false;\s*this\.lookAtWorldPoint\(vec3\.fromValues\(pick\.point\.x, pick\.point\.y, pick\.point\.z\)\);/);
    assert.match(source, /if \(this\.viewportGizmoEnabled\) \{[\s\S]*if \(pick\.kind === "model"\) \{[\s\S]*this\.setSelectedModel\(pick\.modelId\);[\s\S]*\} else if \(this\.viewportGizmoMode !== "scale"\) \{[\s\S]*this\.setSelectedCameraSequenceFrame\(pick\.frame\);/);
    assert.match(source, /private getCameraSequencePickFromClient\(clientX: number, clientY: number\): \{/);
    assert.doesNotMatch(cameraPickMethod, /cameraSequenceEditEnabled/);
    assert.match(cameraPickMethod, /this\.cameraSequenceCurrentMarker\?\.getWorldPosition\(new THREE\.Vector3\(\)\)/);
    assert.match(cameraPickMethod, /const helperTarget = this\.cameraSequenceHelperTargets\.get\(normalizedFrame\)\?\.object \?\? null;[\s\S]*const point = helperTarget\.getWorldPosition\(new THREE\.Vector3\(\)\);/);
    assert.match(source, /private tagEditorModelPickTarget\(root: THREE\.Object3D \| null \| undefined, modelId: string\): void \{/);
    assert.match(source, /\(node\.userData \?\?= \{\}\)\[EDITOR_MODEL_PICK_ID_KEY\] = modelId;/);
    assert.match(source, /private getEditorModelIdFromObject\(object: THREE\.Object3D \| null \| undefined\): string \| null \{/);
    assert.match(source, /current\.userData\?\.\[EDITOR_MODEL_PICK_ID_KEY\]/);
    assert.match(source, /private pickEditorModelFromClient\(clientX: number, clientY: number\): boolean \{/);
    assert.match(source, /const targets: THREE\.Object3D\[\] = \[\];[\s\S]*for \(const model of this\.editorModels\.values\(\)\) \{/);
    assert.match(source, /const hits = raycaster\.intersectObjects\(targets, true\);/);
    assert.match(source, /const modelId = this\.getEditorModelIdFromObject\(hit\.object\);[\s\S]*return \{ modelId, point: hit\.point\.clone\(\), distance: hit\.distance \};/);
    assert.match(source, /private async getDepthModelPickFromClient\(clientX: number, clientY: number\): Promise<\{/);
    assert.match(source, /const picked = await this\.pickScenePointAtClient\(clientX, clientY\);[\s\S]*const modelId = this\.getEditorModelIdFromWorldPoint\(point\);/);
    assert.match(source, /private getEditorModelWorldBounds\(model: EditorModel\): \{ min: THREE\.Vector3; max: THREE\.Vector3 \} \| null \{/);
    assert.match(source, /const aabb = model\.gaussianModel\.getWorldAABB\(\);/);
    assert.match(source, /if \(this\.selectedCameraSequenceFrame !== null\) \{\s*return "camera";\s*\}/);
    assert.match(source, /const pick = this\.getEditorModelPickFromClient\(clientX, clientY\);\s*return Boolean\(pick && this\.setSelectedModel\(pick\.modelId\)\);/);
});

test('canvas camera double click keeps public camera selection state in sync', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');
    const callback = source.match(/app\.onCameraSequenceSelection\?\.\(\(frame\) => \{([\s\S]*?)\n    \}\);/)?.[1] ?? '';

    assert.match(callback, /state\.selectedCameraSequenceFrame = Math\.round\(Number\(frame\)\);/);
    assert.match(callback, /if \(!state\.cameraSequenceDragEnabled\) \{\s*state\.cameraSequenceDragEnabled = true;\s*app\.setCameraSequenceEditEnabled\?\.\(true\);\s*\}/);
    assert.match(callback, /syncCameraSequenceDragButton\(\);\s*syncCameraSequenceInteractionEnabled\(\);/);
});

test('camera gizmo is visible but non-interactive during playback', () => {
    const publicSource = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');
    const editorSource = readFileSync(new URL('../src/editor/editor-app.ts', import.meta.url), 'utf8');

    assert.match(publicSource, /function syncCameraSequenceInteractionEnabled\(\) \{\s*app\?\.setCameraSequenceInteractionEnabled\?\.\(!state\.isPlaying\);\s*\}/);
    assert.match(publicSource, /state\.isPlaying = false;\s*syncCameraSequenceInteractionEnabled\(\);/);
    assert.match(publicSource, /state\.isPlaying = true;\s*syncCameraSequenceInteractionEnabled\(\);/);
    assert.match(editorSource, /private cameraSequenceInteractionEnabled: boolean = true;/);
    assert.match(editorSource, /setCameraSequenceInteractionEnabled\(enabled: boolean\): boolean \{/);
    assert.match(editorSource, /this\.viewportGizmoEnabled &&\s*cameraModeAllowed &&\s*this\.cameraSequenceInteractionEnabled/);
});

test('video export frame traversal does not mutate user timeline frame or gizmo focus', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');
    const controllerMatch = source.match(/function buildExportTimelineController\(recordingCamera, options = \{\}\) \{([\s\S]*?)\n\}/);

    assert.ok(controllerMatch, 'expected buildExportTimelineController');
    assert.doesNotMatch(controllerMatch[1], /setTimelineFrame\(/);
    assert.match(controllerMatch[1], /const pose = interpolateCameraPoseAt\(sourceTimeSec\)/);
    assert.match(controllerMatch[1], /applyTimelinePoseToRecordingCamera\(recordingCamera, pose,/);
    assert.match(source, /setTimelineFrame\(restoreFrame, \{ applyPose: true, syncSlider: true, syncGizmo: false \}\);/);
});
