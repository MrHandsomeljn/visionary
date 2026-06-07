import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('editor html uses declarative i18n markers for static UI text', () => {
    const html = readFileSync(new URL('../public/editor.html', import.meta.url), 'utf8');

    assert.match(html, /data-i18n="editor\.title"/);
    assert.match(html, /data-i18n="canvas\.noWebgpuTitle"/);
    assert.match(html, /data-i18n-placeholder="agent\.inputPlaceholder"/);
    assert.match(html, /data-i18n="sidebar\.title"/);
    assert.match(html, /data-i18n="timeline\.title"/);
    assert.match(html, /data-i18n="modal\.helpTitle"/);
    assert.match(html, /data-i18n-attrs="title:common\.addImage;aria-label:common\.addImage"/);
    assert.match(html, /data-i18n-attrs="title:sidebar\.loadModel;aria-label:sidebar\.loadModel"/);
    assert.match(html, /data-i18n-attrs="data-tooltip:toolbar\.translate;aria-label:toolbar\.translate"/);
    assert.match(html, /data-i18n-attrs="title:timeline\.addKeyframe;aria-label:timeline\.addKeyframe"/);
    assert.match(html, /data-i18n="workspaceStatus\.chooserTitle"/);
    assert.match(html, /data-i18n="workspaceStatus\.setLocal"/);
});

test('editor js provides a generic declarative i18n pass before dynamic UI updates', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /function applyDeclarativeI18n\(root = document\)/);
    assert.match(source, /root\.querySelectorAll\('\[data-i18n\]'\)/);
    assert.match(source, /root\.querySelectorAll\('\[data-i18n-placeholder\]'\)/);
    assert.match(source, /root\.querySelectorAll\('\[data-i18n-attrs\]'\)/);
    assert.match(source, /applyDeclarativeI18n\(\);/);
});

test('editor js routes user-visible feedback through i18n keys', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /messages:\s*\{/);
    assert.match(source, /showInfo\(t\('messages\.sceneCleared'\)\)/);
    assert.match(source, /confirm\(t\('messages\.clearSceneConfirm'\)\)/);
    assert.match(source, /throw new Error\(t\('messages\.invalidResolution'\)\)/);
    assert.doesNotMatch(source, /showInfo\(`[^`]*[\u4e00-\u9fff]/);
    assert.doesNotMatch(source, /showInfo\('[^']*[\u4e00-\u9fff]/);
    assert.doesNotMatch(source, /showError\('[^']*[\u4e00-\u9fff]/);
    assert.doesNotMatch(source, /confirm\('[^']*[\u4e00-\u9fff]/);
    assert.doesNotMatch(source, /throw new Error\('[^']*[\u4e00-\u9fff]/);
});

test('scene background sync updates canvas fallback css background', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /function syncAgentWorkbenchSceneBackground\(\) \{[\s\S]*const visibleHex = sceneHexToVisibleCanvasHex\(normalized\);[\s\S]*--agent-workbench-scene-bg[\s\S]*--canvas-bg/);
});
