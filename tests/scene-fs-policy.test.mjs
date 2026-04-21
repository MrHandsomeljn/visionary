import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('SceneFS guards optional environment restore methods when loading manifests', () => {
    const source = readFileSync(new URL('../src/app/scene-fs.ts', import.meta.url), 'utf8');

    assert.match(source, /manifest\.env\.gaussianScale !== undefined && typeof \(app as any\)\.setGaussianScale === 'function'/);
    assert.match(source, /manifest\.env\.bgColor && typeof \(app as any\)\.setBackgroundColor === 'function'/);
    assert.match(source, /raw\.env\.gaussianScale !== undefined && typeof app\.setGaussianScale === 'function'/);
});

test('SceneFS routes persisted mesh asset types through the editor model loader', () => {
    const source = readFileSync(new URL('../src/app/scene-fs.ts', import.meta.url), 'utf8');

    assert.match(source, /'glb'/);
    assert.match(source, /'gltf'/);
    assert.match(source, /'obj'/);
    assert.match(source, /'stl'/);
    assert.match(source, /if \(resolvedFile && typeof \(app as any\)\.loadModel === 'function'\) \{/);
    assert.match(source, /await \(app as any\)\.loadModel\(normalizedFile, \{\s*sourcePath: asset\.path \|\| asset\.name,\s*suppressLoadingOverlay: true,\s*\}\)/s);
    assert.match(source, /if \(typeof source === 'string' && source\.length > 0 && typeof \(app as any\)\.loadSample === 'function'\)/);
});

test('EditorApp can suppress per-model loading overlay during batch scene restore', () => {
    const source = readFileSync(new URL('../src/editor/editor-app.ts', import.meta.url), 'utf8');

    assert.match(source, /async loadModel\(file: File, options: \{ sourcePath\?: string; suppressLoadingOverlay\?: boolean \} = \{\}\)/);
    assert.match(source, /const shouldManageLoadingOverlay = options\.suppressLoadingOverlay !== true;/);
    assert.match(source, /if \(shouldManageLoadingOverlay\) \{\s*this\.showLoading\(true, `Loading \$\{file\.name\}\.\.\.`, 0\);\s*\}/s);
    assert.match(source, /if \(shouldManageLoadingOverlay\) \{\s*this\.showLoading\(true, progress\.stage, Math\.round\(progress\.progress \* 100\)\);\s*\}/s);
    assert.match(source, /if \(shouldManageLoadingOverlay\) \{\s*this\.showLoading\(false\);\s*\}/s);
});

test('EditorApp exposes getModelManager for SceneFS transform restore compatibility', () => {
    const source = readFileSync(new URL('../src/editor/editor-app.ts', import.meta.url), 'utf8');

    assert.match(source, /getModelManager\(\): ModelManager \{\s*return this\.modelManager;\s*\}/s);
});

test('SceneFS treats same-origin absolute paths as remote assets instead of workspace-relative files', () => {
    const source = readFileSync(new URL('../src/app/scene-fs.ts', import.meta.url), 'utf8');

    assert.match(source, /private isHttpUrl\(value: string\): boolean \{/);
    assert.match(source, /\|\| value\.startsWith\('\/'\)/);
});

test('SceneFS fetches remote non-ONNX assets into File objects before delegating to EditorApp loader', () => {
    const source = readFileSync(new URL('../src/app/scene-fs.ts', import.meta.url), 'utf8');

    assert.match(source, /if \(!resolvedFile && typeof source === 'string' && this\.isHttpUrl\(source\) && asset\.type !== 'onnx'\) \{/);
    assert.match(source, /resolvedFile = await this\.fetchFileFromUrl\(source\);/);
    assert.match(source, /if \(resolvedFile && typeof \(app as any\)\.loadModel === 'function'\) \{/);
});
