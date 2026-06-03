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

test('agent workflow tabs keep a fixed width and resize mode disables expensive workbench filters', () => {
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
        /body\.agent-workbench-resizing #agent-workbench\s*\{[\s\S]*will-change:\s*width;[\s\S]*backdrop-filter:\s*none;[\s\S]*-webkit-backdrop-filter:\s*none;[\s\S]*\}/
    );
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
        /\.agent-block\.agent-block-image \.agent-block-header,[\s\S]*\.agent-block\.agent-block-image \.agent-block-status,[\s\S]*\.agent-block\.agent-block-viewer3d \.agent-block-header,[\s\S]*\.agent-block\.agent-block-viewer3d \.agent-block-status\s*\{[\s\S]*padding-left:\s*10px;[\s\S]*padding-right:\s*10px;[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-composer-dock\s*\{[\s\S]*padding:\s*10px var\(--agent-workbench-content-inset-x\) 12px;[\s\S]*\}/
    );
    assert.match(
        css,
        /#agent-workbench\.is-collapsed \.agent-workbench-toggle\s*\{[\s\S]*width:\s*var\(--agent-control-slot-width\);[\s\S]*height:\s*var\(--agent-control-slot-height\);[\s\S]*margin-bottom:\s*10px;[\s\S]*\}/
    );
    assert.match(
        css,
        /#agent-workbench\.is-collapsed \.agent-workbench-topbar\s*\{[\s\S]*align-items:\s*flex-start;[\s\S]*padding:\s*10px var\(--agent-workbench-content-inset-x\);[\s\S]*\}/
    );
    assert.match(
        css,
        /#agent-workbench\.is-collapsed \.agent-workflow-tabs\s*\{[\s\S]*width:\s*auto;[\s\S]*align-items:\s*flex-start;[\s\S]*gap:\s*10px;[\s\S]*\}/
    );
    assert.match(
        css,
        /#agent-workbench\.is-collapsed \.agent-workflow-tab\s*\{[\s\S]*flex:\s*0 0 var\(--agent-workflow-tab-width\);[\s\S]*width:\s*var\(--agent-workflow-tab-width\);[\s\S]*height:\s*var\(--agent-workflow-tab-width\);[\s\S]*aspect-ratio:\s*1 \/ 1;[\s\S]*\}/
    );
    assert.match(
        css,
        /#agent-workbench\.is-collapsed \.agent-workbench-body\s*\{[\s\S]*display:\s*flex;[\s\S]*\}/
    );
    assert.match(
        css,
        /#agent-workbench\.is-collapsed \.agent-message-pane,[\s\S]*#agent-workbench\.is-collapsed #btnAgentSend\s*\{[\s\S]*display:\s*none;[\s\S]*\}/
    );
    assert.match(
        css,
        /#agent-workbench\.is-collapsed \.agent-composer-dock\s*\{[\s\S]*margin-top:\s*auto;[\s\S]*padding:\s*10px var\(--agent-workbench-content-inset-x\) 12px;[\s\S]*\}/
    );
    assert.match(
        css,
        /#agent-workbench\.is-collapsed \.agent-composer-actions\s*\{[\s\S]*justify-content:\s*flex-start;[\s\S]*\}/
    );
});

test('project session button renders as a composer avatar with dynamic gradients', () => {
    const html = readFileSync(new URL('../public/editor.html', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../public/editor.css', import.meta.url), 'utf8');
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(
        html,
        /<div class="agent-composer-actions">[\s\S]*id="btnUserSession"[\s\S]*class="agent-user-avatar-btn"[\s\S]*agent-user-avatar-icon[\s\S]*agent-user-avatar-text[\s\S]*id="btnAgentAddImage"/
    );
    assert.match(
        css,
        /\.agent-user-avatar-btn\s*\{[\s\S]*width:\s*var\(--agent-control-slot-width\);[\s\S]*height:\s*var\(--agent-control-slot-height\);[\s\S]*margin-right:\s*auto;[\s\S]*border:\s*0;[\s\S]*background:\s*transparent;[\s\S]*\}/
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
