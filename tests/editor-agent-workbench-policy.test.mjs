import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('agent workbench resize is coalesced per frame and persisted only after drag end', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /const AGENT_WORKBENCH_MIN_WIDTH = 314;/);
    assert.match(source, /let agentWorkbenchResizeRaf = 0;/);
    assert.match(
        source,
        /function scheduleAgentWorkbenchResizeWidth\(width\) \{[\s\S]*agentWorkbenchResizeState\.latestWidth = clampAgentWorkbenchWidth\(width\);[\s\S]*if \(agentWorkbenchResizeRaf !== 0\) return;[\s\S]*agentWorkbenchResizeRaf = requestAnimationFrame\(\(\) => \{[\s\S]*applyAgentWorkbenchWidth\(agentWorkbenchResizeState\.latestWidth, false, \{\s*syncViewport: false,\s*syncScrollbar: false,\s*\}\);[\s\S]*\}\);[\s\S]*\}/
    );
    assert.match(
        source,
        /function endAgentWorkbenchResize\(\) \{[\s\S]*cancelAnimationFrame\(agentWorkbenchResizeRaf\);[\s\S]*applyAgentWorkbenchWidth\(agentWorkbenchResizeState\.latestWidth, true\);[\s\S]*document\.body\.classList\.remove\('agent-workbench-resizing'\);/
    );
    assert.match(
        source,
        /function applyAgentWorkbenchWidth\(width, persist = true, \{\s*syncViewport = true,\s*syncScrollbar = true,\s*\} = \{\}\) \{[\s\S]*if \(syncViewport\) \{\s*syncCanvasContainerToViewport\(\);\s*\}[\s\S]*if \(syncScrollbar\) \{\s*scheduleAgentMessageScrollbarSync\(\);\s*\}/
    );
});

test('agent scrollbar sync is coalesced instead of queueing duplicate rAF callbacks', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /let agentMessageScrollbarSyncRaf = 0;/);
    assert.match(
        source,
        /function scheduleAgentMessageScrollbarSync\(\) \{[\s\S]*if \(agentMessageScrollbarSyncRaf !== 0\) return;[\s\S]*agentMessageScrollbarSyncRaf = requestAnimationFrame\(\(\) => \{[\s\S]*agentMessageScrollbarSyncRaf = 0;[\s\S]*syncAgentMessageScrollbar\(\);[\s\S]*\}\);[\s\S]*\}/
    );
    assert.doesNotMatch(source, /requestAnimationFrame\(syncAgentMessageScrollbar\)/);
});

test('agent collapse defers layout-heavy sync outside the click frame', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../public/editor.css', import.meta.url), 'utf8');
    const scheduleStart = source.indexOf('function scheduleAgentWorkbenchCollapseLayoutSync');
    const applyStart = source.indexOf('function applyAgentWorkbenchWidth', scheduleStart);
    const scheduleBody = source.slice(scheduleStart, applyStart);
    const setStart = source.indexOf('function setAgentWorkbenchCollapsed');
    const workflowStart = source.indexOf('function setAgentWorkbenchMode', setStart);
    const setBody = source.slice(setStart, workflowStart);

    assert.match(source, /let agentWorkbenchCollapseSyncRaf = 0;/);
    assert.match(source, /let agentWorkbenchTogglingTimer = 0;/);
    assert.ok(scheduleStart >= 0, 'expected collapse sync scheduler');
    assert.match(scheduleBody, /document\.body\.classList\.add\('agent-workbench-toggling'\);/);
    assert.match(scheduleBody, /if \(agentWorkbenchCollapseSyncRaf !== 0\) \{[\s\S]*return;[\s\S]*\}/);
    assert.equal(
        (scheduleBody.match(/agentWorkbenchCollapseSyncRaf = requestAnimationFrame\(\(\) => \{/g) || []).length,
        2
    );
    assert.match(scheduleBody, /syncCanvasContainerToViewport\(\);/);
    assert.match(scheduleBody, /scheduleAgentMessageScrollbarSync\(\);/);
    assert.match(scheduleBody, /document\.body\.classList\.remove\('agent-workbench-toggling'\);/);
    assert.match(setBody, /state\.agentWorkbenchCollapsed = Boolean\(collapsed\);/);
    assert.match(setBody, /syncAgentWorkbenchCollapsedState\(\);/);
    assert.match(setBody, /scheduleAgentWorkbenchCollapseLayoutSync\(\{ persist \}\);/);
    assert.doesNotMatch(setBody, /syncCanvasContainerToViewport\(\);/);
    assert.match(css, /body\.agent-workbench-resizing #agent-workbench\s*\{[\s\S]*will-change:\s*width;[\s\S]*backdrop-filter:\s*none;[\s\S]*-webkit-backdrop-filter:\s*none;[\s\S]*\}/);
    assert.doesNotMatch(css, /body\.agent-workbench-toggling #agent-workbench\s*\{[\s\S]*backdrop-filter:\s*none/);
});

test('agent workbench layout tokens and message column sizing remain pinned', () => {
    const css = readFileSync(new URL('../public/editor.css', import.meta.url), 'utf8');

    assert.match(css, /--agent-workflow-tab-width:\s*44px;/);
    assert.match(css, /--agent-workflow-tab-gap:\s*16px;/);
    assert.match(css, /--agent-control-slot-width:\s*44px;/);
    assert.match(css, /--agent-control-slot-height:\s*48px;/);
    assert.match(css, /--agent-workbench-content-inset-x:\s*10px;/);
    assert.match(css, /--agent-workbench-topbar-gap:\s*8px;/);
    assert.match(css, /--agent-output-right-gap:\s*18px;/);
    assert.match(css, /--agent-output-asset-max-width:\s*320px;/);
    assert.match(
        css,
        /\.agent-workflow-tabs\s*\{[\s\S]*flex:\s*1 1 auto;[\s\S]*display:\s*flex;[\s\S]*justify-content:\s*flex-start;[\s\S]*gap:\s*var\(--agent-workflow-tab-gap\);[\s\S]*margin-right:\s*var\(--agent-output-right-gap\);[\s\S]*order:\s*1;[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-workflow-tab\s*\{[\s\S]*flex:\s*1 1 0;[\s\S]*width:\s*auto;[\s\S]*min-width:\s*var\(--agent-workflow-tab-width\);[\s\S]*max-width:\s*none;[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-workbench-toggle\s*\{[\s\S]*width:\s*var\(--agent-control-slot-width\);[\s\S]*height:\s*var\(--agent-control-slot-height\);[\s\S]*order:\s*0;[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-workbench-toggle::before\s*\{[\s\S]*border:\s*1px solid var\(--input-border\);[\s\S]*border-radius:\s*10px;[\s\S]*box-shadow:\s*inset 0 0 0 1px transparent;[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-workbench-toggle:hover::before\s*\{[\s\S]*border-color:\s*var\(--accent\);[\s\S]*background:\s*color-mix\(in srgb, var\(--panel-bg\) 80%, transparent\);[\s\S]*box-shadow:\s*inset 0 0 0 1px color-mix\(in srgb, var\(--accent\) 50%, transparent\);[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-workbench-topbar\s*\{[\s\S]*padding:\s*10px var\(--agent-workbench-content-inset-x\);[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-message-scroll\s*\{[\s\S]*padding:\s*12px var\(--agent-workbench-content-inset-x\);[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-message-list\s*\{[\s\S]*--agent-output-column-width:\s*calc\(100% - var\(--agent-output-right-gap\)\);[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-message\.is-assistant \.agent-message-bubble\s*\{[\s\S]*width:\s*min\(100%, var\(--agent-output-column-width\)\);[\s\S]*max-width:\s*min\(100%, var\(--agent-output-column-width\)\);[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-message\.is-session\s*\{[\s\S]*justify-content:\s*flex-start;[\s\S]*width:\s*100%;[\s\S]*max-width:\s*100%;[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-session-stack\s*\{[\s\S]*flex:\s*0 1 auto;[\s\S]*width:\s*min\(100%, var\(--agent-output-column-width\)\);[\s\S]*max-width:\s*min\(100%, var\(--agent-output-column-width\)\);[\s\S]*min-width:\s*0;[\s\S]*align-items:\s*stretch;[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-session-bubble\s*\{[\s\S]*width:\s*100%;[\s\S]*max-width:\s*100%;[\s\S]*min-width:\s*0;[\s\S]*align-self:\s*stretch;[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-session-pager\s*\{[\s\S]*justify-content:\s*flex-end;[\s\S]*width:\s*100%;[\s\S]*max-width:\s*100%;[\s\S]*align-self:\s*stretch;[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-message-media,[\s\S]*\.agent-message-attachments\s*\{[\s\S]*width:\s*min\(100%, var\(--agent-output-asset-max-width\)\);[\s\S]*max-width:\s*var\(--agent-output-asset-max-width\);[\s\S]*align-self:\s*flex-start;[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-block\.agent-block-image,[\s\S]*\.agent-block\.agent-block-viewer3d\s*\{[\s\S]*width:\s*100%;[\s\S]*max-width:\s*none;[\s\S]*padding-left:\s*0;[\s\S]*padding-right:\s*0;[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-image-frame,[\s\S]*\.agent-viewer-frame\s*\{[\s\S]*width:\s*min\(100%, var\(--agent-output-asset-max-width\)\);[\s\S]*max-width:\s*var\(--agent-output-asset-max-width\);[\s\S]*justify-self:\s*flex-start;[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-step-gallery-main\s*\{[\s\S]*display:\s*block;[\s\S]*width:\s*100%;[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-step-gallery \.agent-image-frame\s*\{[\s\S]*position:\s*relative;[\s\S]*width:\s*100%;[\s\S]*max-width:\s*none;[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-step-gallery-nav\s*\{[\s\S]*position:\s*absolute;[\s\S]*top:\s*50%;[\s\S]*transform:\s*translateY\(-50%\);[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-step-gallery-count\s*\{[\s\S]*position:\s*absolute;[\s\S]*right:\s*8px;[\s\S]*top:\s*8px;[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-step-actions\s*\{[\s\S]*width:\s*100%;[\s\S]*max-width:\s*none;[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-step-actions\s*\{[\s\S]*justify-content:\s*flex-end;[\s\S]*gap:\s*8px;[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-block\.agent-block-image \.agent-block-header,[\s\S]*\.agent-block\.agent-block-image \.agent-block-status,[\s\S]*\.agent-block\.agent-block-viewer3d \.agent-block-header,[\s\S]*\.agent-block\.agent-block-viewer3d \.agent-block-status\s*\{[\s\S]*padding-left:\s*10px;[\s\S]*padding-right:\s*10px;[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-composer-dock\s*\{[\s\S]*padding:\s*10px var\(--agent-workbench-content-inset-x\) 12px;[\s\S]*\}/
    );
});

test('left sidebar shares the bottom timeline panel surface treatment', () => {
    const css = readFileSync(new URL('../public/editor.css', import.meta.url), 'utf8');
    const leftSidebarRule = css.match(/#left-sidebar\s*\{([\s\S]*?)\n\}/)?.[1] || '';

    assert.match(leftSidebarRule, /background:\s*var\(--panel-surface-bg\);/);
    assert.match(leftSidebarRule, /backdrop-filter:\s*var\(--panel-surface-filter\);/);
    assert.match(leftSidebarRule, /-webkit-backdrop-filter:\s*var\(--panel-surface-filter\);/);
    assert.match(css, /#bottom-timeline\s*\{[\s\S]*background:\s*var\(--panel-surface-bg\);[\s\S]*backdrop-filter:\s*var\(--panel-surface-filter\);/);
    assert.doesNotMatch(css, /--left-sidebar-bg|--scene-canvas-bg-color/);
});

test('agent workbench keeps composer docked at bottom, collapses to three floating entry points, and expands from collapsed mode clicks', () => {
    const html = readFileSync(new URL('../public/editor.html', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../public/editor.css', import.meta.url), 'utf8');
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(
        html,
        /<div class="agent-workbench-topbar">[\s\S]*id="agentWorkbenchModeTabs"[\s\S]*agent-workbench-mode-icon[\s\S]*agent-workbench-mode-label[\s\S]*id="btnToggleAgentWorkbench"[\s\S]*<div class="agent-workbench-body">[\s\S]*data-mode-panel="conversation"[\s\S]*data-mode-panel="asset-library"[\s\S]*<div id="agentComposerDock" class="agent-composer-dock">/
    );
    assert.doesNotMatch(html, /agent-composer-dock-topbar/);
    assert.match(
        css,
        /\.agent-workbench-body\s*\{[\s\S]*flex:\s*1 1 auto;[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;[\s\S]*overflow:\s*hidden;[\s\S]*\}/
    );
    assert.match(
        css,
        /#agent-workbench\.is-collapsed\s*\{[\s\S]*background:\s*transparent;[\s\S]*box-shadow:\s*none;[\s\S]*backdrop-filter:\s*none;[\s\S]*\}/
    );
    assert.match(
        css,
        /#agent-workbench\.is-collapsed \.agent-workbench-toggle\s*\{[\s\S]*display:\s*none;[\s\S]*\}/
    );
    assert.match(
        css,
        /#agent-workbench\.is-collapsed \.agent-workbench-topbar,[\s\S]*#agent-workbench\.is-collapsed \.agent-workbench-body\s*\{[\s\S]*display:\s*none;[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-workbench-collapsed-controls\s*\{[\s\S]*position:\s*absolute;[\s\S]*inset:\s*0;[\s\S]*display:\s*none;[\s\S]*flex-direction:\s*column;[\s\S]*justify-content:\s*flex-start;[\s\S]*pointer-events:\s*none;[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-workbench-collapsed-controls\[hidden\]\s*\{[\s\S]*display:\s*none !important;[\s\S]*pointer-events:\s*none;[\s\S]*\}/
    );
    assert.match(
        css,
        /#agent-workbench-shell\.is-collapsed \.agent-workbench-collapsed-controls:not\(\[hidden\]\)\s*\{[\s\S]*display:\s*flex;[\s\S]*pointer-events:\s*auto;[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-workbench-collapsed-mode-tabs\s*\{[\s\S]*width:\s*100%;[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;[\s\S]*align-items:\s*center;[\s\S]*gap:\s*10px;[\s\S]*\}/
    );
    assert.match(
        css,
        /#agent-workbench-shell\.is-collapsed \.agent-workbench-collapsed-controls \.agent-workbench-mode-tab\s*\{[\s\S]*width:\s*var\(--agent-control-slot-width\);[\s\S]*height:\s*var\(--agent-control-slot-height\);[\s\S]*background:\s*color-mix\(in srgb, var\(--panel-bg\) 22%, transparent\);[\s\S]*\}/
    );
    assert.match(
        css,
        /#agent-workbench-shell\.is-collapsed \.agent-workbench-collapsed-controls \.agent-user-avatar-btn\s*\{[\s\S]*width:\s*var\(--agent-control-slot-width\);[\s\S]*height:\s*var\(--agent-control-slot-height\);[\s\S]*flex:\s*0 0 var\(--agent-control-slot-height\);[\s\S]*margin-right:\s*0;[\s\S]*\}/
    );
    assert.match(
        css,
        /#agent-workbench-shell\.is-collapsed \.agent-workbench-collapsed-controls \.agent-workbench-mode-label\s*\{[\s\S]*display:\s*none;[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-workbench-collapsed-controls-bottom\s*\{[\s\S]*margin-top:\s*auto;[\s\S]*\}/
    );
    assert.match(
        css,
        /#agent-workbench-shell\.is-collapsed \.agent-workbench-resizer\s*\{[\s\S]*pointer-events:\s*none;[\s\S]*opacity:\s*0;[\s\S]*\}/
    );
    assert.match(
        html,
        /id="agentWorkbenchCollapsedControls"[\s\S]*id="agentWorkbenchCollapsedModeTabs"[\s\S]*data-mode="conversation"[\s\S]*data-mode="asset-library"[\s\S]*id="btnCollapsedUserSession"/
    );
    assert.doesNotMatch(html, /id="btnExpandAgentWorkbench"/);
    assert.match(
        source,
        /function handleAgentWorkbenchModeClick\(event\) \{[\s\S]*if \(state\.agentWorkbenchCollapsed\) \{[\s\S]*setAgentWorkbenchCollapsed\(false\);[\s\S]*\}[\s\S]*setAgentWorkbenchMode\(mode\);[\s\S]*\}/
    );
    assert.match(
        source,
        /function syncAgentWorkbenchCollapsedState\(\) \{[\s\S]*dom\.agentWorkbenchShell\?\.classList\.toggle\('is-collapsed', collapsed\);[\s\S]*dom\.agentWorkbench\?\.classList\.toggle\('is-collapsed', collapsed\);[\s\S]*\}/
    );
});

test('project session button stays in the composer action row with dynamic gradients', () => {
    const html = readFileSync(new URL('../public/editor.html', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../public/editor.css', import.meta.url), 'utf8');
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(
        html,
        /<div class="agent-composer-actions">[\s\S]*id="btnUserSession"[\s\S]*class="agent-user-avatar-btn"[\s\S]*agent-user-avatar-icon[\s\S]*agent-user-avatar-text[\s\S]*id="btnAgentAddImage"/
    );
    assert.match(
        css,
        /\.agent-user-avatar-btn\s*\{[\s\S]*width:\s*var\(--agent-control-slot-width\);[\s\S]*height:\s*var\(--agent-control-slot-height\);[\s\S]*margin-right:\s*auto;[\s\S]*border:\s*0;[\s\S]*background:\s*transparent;[\s\S]*flex:\s*0 0 var\(--agent-control-slot-width\);[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-user-avatar-btn::before\s*\{[\s\S]*width:\s*32px;[\s\S]*height:\s*32px;[\s\S]*linear-gradient\(135deg,\s*var\(--agent-user-avatar-start, #66758d\),\s*var\(--agent-user-avatar-end, #465267\)\);[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-user-avatar-btn\[data-authenticated="true"\] \.agent-user-avatar-text\s*\{[\s\S]*display:\s*block;[\s\S]*\}/
    );
    assert.match(
        source,
        /function getProjectSessionAvatarToken\(user\) \{[\s\S]*Array\.from\(trimmed\)\[0\][\s\S]*\}/
    );
    assert.match(
        source,
        /function getProjectSessionAvatarGradient\(token\) \{[\s\S]*const startHue = codePoint % 360;[\s\S]*const endHue = \(startHue \+ 42\) % 360;[\s\S]*\}/
    );
    assert.match(
        source,
        /function syncProjectSessionButton\(\) \{[\s\S]*style\.setProperty\('--agent-user-avatar-start', gradient\.start\);[\s\S]*style\.setProperty\('--agent-user-avatar-end', gradient\.end\);[\s\S]*querySelector\('\.agent-user-avatar-text'\)[\s\S]*\}/
    );
});

test('agent composer exposes single-select skill chips above the prompt input', () => {
    const html = readFileSync(new URL('../public/editor.html', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../public/editor.css', import.meta.url), 'utf8');
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(html, /id="agentComposerSkillToolbar"[^>]+class="agent-composer-skill-toolbar"[^>]+data-i18n-attrs="aria-label:agent\.skillToolbar"/);
    assert.match(html, /data-agent-skill-insert="scene"[^>]+data-i18n="agent\.skills\.scene"/);
    assert.match(html, /data-agent-skill-insert="object"[^>]+data-i18n="agent\.skills\.object"/);
    assert.match(html, /data-agent-skill-insert="character"[^>]+data-i18n="agent\.skills\.character"/);
    assert.match(html, /data-agent-skill-insert="camera"[^>]+data-i18n="agent\.skills\.camera"/);
    assert.match(html, /<div class="agent-composer-prompt-surface">[\s\S]*id="agentComposerInput"[\s\S]*contenteditable="plaintext-only"[\s\S]*data-i18n-placeholder="agent\.inputPlaceholder"[\s\S]*id="agentComposerSkillTokens" class="agent-composer-skill-tokens" contenteditable="false" hidden/);

    assert.match(source, /const AGENT_COMPOSER_SKILL_DEFS = \[[\s\S]*value:\s*'\$scene-skill'[\s\S]*value:\s*'\$object-skill'[\s\S]*value:\s*'\$character-skill'[\s\S]*value:\s*'\$camera-skill'/);
    assert.match(source, /aliases:\s*\['\$camera-skill', 'camera-skill'\]/);
    assert.match(source, /agentComposerSkillId:\s*'',/);
    assert.match(source, /function extractAgentComposerSkillText\(text\)/);
    assert.match(source, /function parseAgentComposerSkillText\(text\)/);
    assert.match(source, /function isAgentComposerSkillTokenMounted\(\)/);
    assert.match(source, /function getAgentComposerInputText\(\)/);
    assert.match(source, /function setAgentComposerInputText\(text, \{ focus = true \} = \{\}\)/);
    assert.match(source, /function renderAgentComposerSkillControls\(\)/);
    assert.match(source, /button\.disabled = hasSkill;/);
    assert.match(source, /button\.classList\.toggle\('is-active', isActive\);/);
    assert.match(source, /const tokenWasRemoved = Boolean\(previousSkillId\) && !isAgentComposerSkillTokenMounted\(\);/);
    assert.match(source, /if \(result\.skill\) \{\s*state\.agentComposerSkillId = result\.skill\.id;\s*\} else if \(tokenWasRemoved\) \{\s*state\.agentComposerSkillId = '';\s*\}/);
    assert.match(source, /function buildAgentComposerPromptText\(rawPrompt\)[\s\S]*return `\$\{skill\.value\} \$\{prompt\}`;/);
    assert.match(source, /const effectivePrompt = prompt \? rawPrompt\.trimStart\(\) : attachmentFallback;/);
    assert.match(source, /dom\.agentComposerInput\?\.addEventListener\('input', handleAgentComposerInput\);/);
    assert.match(source, /dom\.agentComposerSkillToolbar\?\.addEventListener\('click', handleAgentComposerSkillToolbarClick\);/);
    assert.match(source, /event\.key === 'Backspace'[\s\S]*clearAgentComposerSkill\(\);/);

    assert.match(css, /\.agent-composer-skill-toolbar\s*\{[\s\S]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);/);
    assert.match(css, /\.agent-composer-skill-btn\.is-active\s*\{[\s\S]*border-color:\s*var\(--accent\);/);
    assert.match(css, /\.agent-composer-skill-btn:disabled:not\(\.is-active\)\s*\{[\s\S]*opacity:\s*0\.36;/);
    assert.match(css, /\.agent-composer-input\s*\{[\s\S]*white-space:\s*pre-wrap;[\s\S]*word-break:\s*break-word;/);
    assert.match(css, /\.agent-composer-skill-tokens\s*\{[\s\S]*display:\s*inline-flex;[\s\S]*align-items:\s*center;[\s\S]*height:\s*18px;/);
    assert.match(css, /\.agent-composer-skill-token\s*\{[\s\S]*height:\s*18px;[\s\S]*min-height:\s*0;[\s\S]*border-radius:\s*999px;[\s\S]*vertical-align:\s*baseline;/);
});
