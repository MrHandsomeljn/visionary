import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('project api client exposes Codex agent message endpoint', async () => {
    const clientSource = await readFile(new URL('../src/editor/project-api-client.js', import.meta.url), 'utf8');
    const serverSource = await readFile(new URL('../src/server/project-api.ts', import.meta.url), 'utf8');

    assert.match(clientSource, /async sendCodexAgentMessage\(\{[\s\S]*user,[\s\S]*projectId,[\s\S]*conversationId,[\s\S]*threadId,[\s\S]*prompt,[\s\S]*workflow,[\s\S]*\}\)/);
    assert.match(clientSource, /fetch\('\/api\/codex-agent\/messages'/);
    assert.match(clientSource, /async sendCodexAgentStepAction\(\{[\s\S]*sessionId,[\s\S]*stepKey,[\s\S]*action,[\s\S]*selectedIndex,[\s\S]*images,[\s\S]*sourceImages,[\s\S]*\}\)/);
    assert.match(clientSource, /fetch\('\/api\/agent\/step-action'/);
    assert.match(serverSource, /const CODEX_AGENT_PREFIX = '\/api\/codex-agent';/);
    assert.match(serverSource, /const AGENT_STEP_ACTION_PREFIX = '\/api\/agent\/step-action';/);
    assert.match(serverSource, /url\.pathname === `\$\{CODEX_AGENT_PREFIX\}\/messages`/);
    assert.match(serverSource, /url\.pathname === AGENT_STEP_ACTION_PREFIX/);
    assert.match(serverSource, /url\.pathname === `\$\{CODEX_AGENT_PREFIX\}\/step-actions`/);
    assert.match(serverSource, /await codexAgent\.sendMessage\(\{/);
    assert.match(serverSource, /await codexAgent\.handleStepAction\(\{/);
    assert.match(serverSource, /sourceImages: Array\.isArray\(body\.sourceImages\) \? body\.sourceImages : undefined/);
});

test('project api exposes per-user Codex auth status and save endpoints', async () => {
    const clientSource = await readFile(new URL('../src/editor/project-api-client.js', import.meta.url), 'utf8');
    const serverSource = await readFile(new URL('../src/server/project-api.ts', import.meta.url), 'utf8');

    assert.match(clientSource, /async getCodexAuthStatus\(user\)/);
    assert.match(clientSource, /async saveCodexAuth\(\{ user, apiKey \}\)/);
    assert.match(serverSource, /const CODEX_AUTH_PREFIX = '\/api\/codex-auth';/);
    assert.match(serverSource, /url\.pathname === CODEX_AUTH_PREFIX/);
    assert.match(serverSource, /storage\.getUserCodexAuthStatus\(getQueryString\(url, 'user'\)\)/);
    assert.match(serverSource, /storage\.saveUserCodexAuth\(\{/);
});

test('editor routes server project agent prompts through Codex before falling back to mock responses', async () => {
    const source = await readFile(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /agentCodexConversationId:\s*'',/);
    assert.match(source, /agentCodexThreadId:\s*'',/);
    assert.match(source, /function getAgentRuntimeStatus\(\) \{[\s\S]*state\.workspace\?\.mode !== 'server'[\s\S]*!state\.projectSession\.codexAuthHasAuth[\s\S]*agentRuntimeReady/);
    assert.match(source, /function canUseServerCodexAgent\(\) \{\s*return getAgentRuntimeStatus\(\)\.ready;\s*\}/);
    assert.match(source, /function startServerCodexAgentResponse\(workflowId, prompt, attachments = \[\]\) \{/);
    assert.match(source, /const handle = openAgentAssistantMessage\(\{[\s\S]*workflow: workflowId,[\s\S]*isLoading: true,[\s\S]*\}\);/);
    assert.doesNotMatch(source, /messages\.codexAgentRunning/);
    assert.match(source, /projectApi\.sendCodexAgentMessage\(\{[\s\S]*conversationId: getCodexAgentConversationId\(\),[\s\S]*threadId: state\.agentCodexThreadId,[\s\S]*workflow: workflowId,[\s\S]*\}\)/);
    assert.match(source, /if \(canUseServerCodexAgent\(\)\) \{[\s\S]*startServerCodexAgentResponse\(state\.agentWorkflow, effectivePrompt, attachments\);[\s\S]*return;[\s\S]*\}[\s\S]*startMockAgentResponse\(state\.agentWorkflow, effectivePrompt, attachments\);/);
});

test('editor renders Codex pending state as a spinner inside the assistant bubble', async () => {
    const source = await readFile(new URL('../public/editor.js', import.meta.url), 'utf8');
    const css = await readFile(new URL('../public/editor.css', import.meta.url), 'utf8');

    assert.match(source, /isLoading = false,[\s\S]*\} = \{\}\) \{/);
    assert.match(source, /message\.isLoading = Boolean\(isLoading\);/);
    assert.match(source, /const isLoading = isAssistant && message\.isLoading;/);
    assert.match(source, /agent-message-loading-spinner/);
    assert.match(source, /message\.isLoading = false;/);
    assert.match(
        css,
        /\.agent-message-bubble\s*\{[\s\S]*position:\s*relative;[\s\S]*\}/
    );
    assert.match(
        css,
        /\.agent-message-loading-spinner\s*\{[\s\S]*position:\s*absolute;[\s\S]*top:\s*10px;[\s\S]*right:\s*12px;[\s\S]*animation:\s*spin 0\.8s linear infinite;[\s\S]*\}/
    );
});

test('editor shows Codex generation controls only after an explicit task signal', async () => {
    const source = await readFile(new URL('../public/editor.js', import.meta.url), 'utf8');
    const startFunction = source.match(/function startServerCodexAgentResponse\(workflowId, prompt, attachments = \[\]\) \{[\s\S]*?\n\}/)?.[0] || '';
    const createSessionFunction = source.match(/function createCodexTaskSessionFromResult\([\s\S]*?\n\}/)?.[0] || '';

    assert.match(source, /function hasCodexTaskSignal\(result\) \{[\s\S]*result\?\.task\?\.started/);
    assert.match(source, /function createCodexTaskSessionFromResult\([\s\S]*createAgentProgressBlock/);
    assert.match(source, /const SCENE_PIPELINE_STEP_DEFS = \[[\s\S]*key: 'main-image'[\s\S]*key: 'front-view'[\s\S]*key: 'top-view'[\s\S]*key: 'layout'[\s\S]*key: 'components-3d'[\s\S]*key: 'insert-scene'/);
    assert.match(source, /function createScenePipelineSteps\(\{/);
    assert.match(source, /function advanceAgentPipelineAfterStepApply\(context\)/);
    assert.match(source, /const progressImages = Array\.isArray\(result\?\.images\)/);
    assert.match(source, /createAgentProgressBlock\(\{[\s\S]*images: progressImages/);
    assert.match(source, /selectedIndex: 0/);
    assert.match(source, /applied: false/);
    assert.match(source, /actions: progressImages\.length > 0 \? \['cancel', 'retry', 'apply'\] : \[\]/);
    assert.match(source, /const steps = createScenePipelineSteps\(\{[\s\S]*mainImageBlock: progressBlock/);
    assert.match(source, /steps,/);
    assert.match(source, /renderAgentBlocks\(getAgentAttemptStepBlocks\(attempt\)/);
    assert.match(source, /<details class="agent-block agent-block-progress agent-step-block/);
    assert.match(source, /class="agent-step-gallery/);
    assert.match(source, /data-agent-step-gallery-nav="prev"/);
    assert.match(source, /data-agent-step-gallery-nav="next"/);
    assert.match(source, /\$\{selectedIndex \+ 1\} \/ \$\{images\.length\}/);
    assert.doesNotMatch(source, /agent-step-gallery-dots/);
    assert.match(source, /function updateAgentStepSelectedIndex\(context, selectedIndex\)/);
    assert.match(source, /function updateAgentStepGalleryDom\(context\)/);
    assert.match(source, /skipRender: true/);
    assert.match(source, /data-agent-step-action="\$\{escapeHtml\(action\)\}"/);
    assert.match(source, /const stepActionButton = event\.target\.closest\('\[data-agent-step-action\]'\)/);
    assert.match(source, /handleAgentStepAction\(context, action\)\.catch/);
    assert.match(source, /function handleAgentStepAction\(context, action\)/);
    assert.match(source, /projectApi\.sendCodexAgentStepAction\(\{/);
    assert.match(source, /sourceImages: \[[\s\S]*serializeAgentStepSourceImage\(context\.attempt, 'main-image'\)[\s\S]*serializeAgentStepSourceImage\(context\.attempt, 'top-view'\)[\s\S]*serializeAgentStepSourceImage\(context\.attempt, 'layout'\)[\s\S]*serializeAgentStepSourceImage\(context\.attempt, 'components-3d'\)/);
    assert.match(source, /sourceStepKey: stepKey/);
    assert.match(source, /function renderAgentStepImageMetadata\(image\)/);
    assert.match(source, /metadata\.kind === 'components_3d'/);
    assert.match(source, /components3dAssets/);
    assert.match(source, /metadata\.kind === 'insert_scene'/);
    assert.match(source, /insertSceneAsset/);
    assert.match(source, /metadata\.kind !== 'layout_bbox'/);
    assert.match(source, /patchAgentStepBlock\(context, \{[\s\S]*images: nextImages/);
    assert.match(source, /function buildAgentStepStatesSnapshot\(\)/);
    assert.match(source, /stepStates: buildAgentStepStatesSnapshot\(\)/);
    assert.match(source, /function buildAgentPipelineStatesSnapshot\(\)/);
    assert.match(source, /pipelineStates: buildAgentPipelineStatesSnapshot\(\)/);
    assert.match(source, /function createScenePipelineState\(\{/);
    assert.match(source, /isCurrent: Boolean\(block\.isCurrent\)/);
    assert.match(source, /expanded: Boolean\(block\.expanded\)/);
    assert.match(source, /function applyAgentStepStatesToSnapshot\(snapshot\)/);
    assert.match(source, /function applyAgentPipelineStatesToSnapshot\(snapshot\)/);
    assert.match(source, /applyAgentPipelineStatesToSnapshot\(applyAgentStepStatesToSnapshot\(snapshot\)\)/);
    assert.match(source, /const hydratedSnapshot = applyAgentPipelineStatesToSnapshot\(applyAgentStepStatesToSnapshot\(snapshot\)\);/);
    assert.match(source, /blocks: steps/);
    assert.doesNotMatch(createSessionFunction, /createAgentImageBlock/);
    assert.match(source, /if \(hasCodexTaskSignal\(result\)\) \{[\s\S]*replaceAgentMessageWithSession\(handle\.messageId, createCodexTaskSessionFromResult/);
    assert.doesNotMatch(startFunction, /createAgentProgressBlock/);
    assert.doesNotMatch(startFunction, /createAgentGenerationAttempt/);
    assert.doesNotMatch(startFunction, /createAgentSession/);
});

test('editor clears Codex thread binding when the active server project changes', async () => {
    const source = await readFile(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /function resetAgentCodexSessionBinding\(\) \{[\s\S]*state\.agentCodexConversationId = '';[\s\S]*state\.agentCodexThreadId = '';[\s\S]*\}/);
    assert.match(source, /state\.projectSession\.activeProjectId = project\?\.id \|\| projectId;\s*state\.projectSession\.activeProjectName = project\?\.name \|\| projectId;\s*resetAgentCodexSessionBinding\(\);/);
    assert.match(source, /state\.projectSession\.activeProjectId = project\?\.id \|\| '';\s*state\.projectSession\.activeProjectName = project\?\.name \|\| projectName;\s*resetAgentCodexSessionBinding\(\);/);
    assert.match(source, /function clearActiveServerProjectSelection\(\) \{[\s\S]*resetAgentCodexSessionBinding\(\);[\s\S]*\}/);
    assert.match(source, /function logoutProjectSession\(\) \{[\s\S]*resetAgentCodexSessionBinding\(\);/);
});
