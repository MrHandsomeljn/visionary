import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('editor exposes top-level mode tabs for conversation and asset library', () => {
    const html = readFileSync(new URL('../public/editor.html', import.meta.url), 'utf8');

    assert.match(
        html,
        /<div id="agentWorkbenchModeTabs" class="agent-workbench-mode-tabs"[\s\S]*?<button[^>]*class="agent-workbench-mode-tab active"[^>]*data-mode="conversation"[^>]*>[\s\S]*?<span[^>]*>对话<\/span>[\s\S]*?<button[^>]*class="agent-workbench-mode-tab"[^>]*data-mode="asset-library"[^>]*>[\s\S]*?<span[^>]*>资产库<\/span>/
    );
});

test('editor exposes asset library sub-tabs for scene object character and camera histories', () => {
    const html = readFileSync(new URL('../public/editor.html', import.meta.url), 'utf8');

    assert.match(
        html,
        /<div id="assetLibraryTabs" class="asset-library-tabs"[\s\S]*?data-asset-tab="scene"[\s\S]*?>[\s\S]*?场景[\s\S]*?data-asset-tab="object"[\s\S]*?>[\s\S]*?物体[\s\S]*?data-asset-tab="character"[\s\S]*?>[\s\S]*?人物[\s\S]*?data-asset-tab="camera"[\s\S]*?>[\s\S]*?运镜/
    );
});

test('editor wires asset library mode and sub-tab switching in workbench controller', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /agentWorkbenchModeTabs:\s*document\.getElementById\('agentWorkbenchModeTabs'\),/);
    assert.match(source, /assetLibraryTabs:\s*document\.getElementById\('assetLibraryTabs'\),/);
    assert.match(source, /agentWorkbenchPanels:\s*Array\.from\(document\.querySelectorAll\('\[data-mode-panel\]'\)\),/);
    assert.match(source, /assetLibraryPanels:\s*Array\.from\(document\.querySelectorAll\('\[data-asset-panel\]'\)\),/);
    assert.match(source, /agentWorkbenchMode:\s*'conversation',/);
    assert.match(source, /agentAssetLibraryTab:\s*'scene',/);
    assert.match(source, /function syncAgentWorkbenchModeTabs\(\) \{/);
    assert.match(source, /querySelectorAll\('\[data-mode\]'\)/);
    assert.match(source, /button\.dataset\.mode === state\.agentWorkbenchMode/);
    assert.match(source, /panel\.dataset\.modePanel === state\.agentWorkbenchMode/);
    assert.match(source, /classList\.toggle\('hidden', !isActive\)/);
    assert.match(source, /function syncAssetLibraryTabs\(\) \{/);
    assert.match(source, /querySelectorAll\('\[data-asset-tab\]'\)/);
    assert.match(source, /button\.dataset\.assetTab === state\.agentAssetLibraryTab/);
    assert.match(source, /panel\.dataset\.assetPanel === state\.agentAssetLibraryTab/);
    assert.match(source, /function setAgentWorkbenchMode\(mode\) \{[\s\S]*state\.agentWorkbenchMode = mode;[\s\S]*syncAgentWorkbenchModeTabs\(\);/);
    assert.match(source, /function setAgentAssetLibraryTab\(tab\) \{[\s\S]*state\.agentAssetLibraryTab = tab;[\s\S]*syncAssetLibraryTabs\(\);/);
    assert.match(source, /function handleAgentWorkbenchModeClick\(event\) \{[\s\S]*closest\('\[data-mode\]'\)[\s\S]*setAgentWorkbenchMode\(/);
    assert.match(source, /function handleAssetLibraryTabClick\(event\) \{[\s\S]*closest\('\[data-asset-tab\]'\)[\s\S]*setAgentAssetLibraryTab\(/);
    assert.match(source, /dom\.agentWorkbenchModeTabs\?\.addEventListener\('click', handleAgentWorkbenchModeClick\);/);
    assert.match(source, /dom\.assetLibraryTabs\?\.addEventListener\('click', handleAssetLibraryTabClick\);/);
});
