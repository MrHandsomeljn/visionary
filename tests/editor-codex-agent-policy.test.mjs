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
    assert.match(source, /const liveContext = getAgentStepBlockContextById\(context\?\.sessionId, context\?\.attemptId, context\?\.blockId\) \|\| context;/);
    assert.match(source, /function getSelectedAgentStepSourceImageFromSession\(session, currentAttempt, stepKey\)/);
    assert.match(source, /sourceImages: \[[\s\S]*serializeAgentSessionStepSourceImage\(liveContext\.session, liveContext\.attempt, 'main-image'\)[\s\S]*serializeAgentSessionStepSourceImage\(liveContext\.session, liveContext\.attempt, 'top-view'\)[\s\S]*serializeAgentSessionStepSourceImage\(liveContext\.session, liveContext\.attempt, 'layout'\)[\s\S]*serializeAgentSessionStepSourceImage\(liveContext\.session, liveContext\.attempt, 'components-3d'\)/);
    assert.match(source, /const appliedContext = getAgentStepBlockContextById\(liveContext\.sessionId, liveContext\.attemptId, liveContext\.blockId\) \|\| liveContext;[\s\S]*const nextContext = advanceAgentPipelineAfterStepApply\(appliedContext\);/);
    assert.match(source, /sourceStepKey: stepKey/);
    assert.match(source, /const statusText = isStepBlock && isApplied && \/\^已应用\|\^Applied\/i\.test\(String\(block\.statusText \|\| ''\)\)/);
    assert.match(source, /const showProgressTrack = !isStepBlock \|\| !isApplied;/);
    assert.match(source, /const forceCollapsed = isStepBlock && Boolean\(context\.stepBlocksCollapsed\);/);
    assert.match(source, /const isOpen = !isStepBlock \|\| \(!forceCollapsed && Boolean\(block\.expanded \|\| block\.isCurrent \|\| \(!isApplied && \(selectedImage \|\| actions\.length > 0 \|\| showContinue\)\)\)\);/);
    assert.match(source, /\$\{showProgressTrack \? `<span class="agent-block-meta">\$\{percentText\}<\/span>` : ''\}/);
    assert.match(source, /function getAgentStepBlockThumbnail\(block\)/);
    assert.match(source, /class="agent-step-summary-thumb"><img src="\$\{escapeHtml\(stepThumbnail\)\}" alt="" loading="eager" decoding="async"><\/span>/);
    assert.match(source, /function getAgentImageAspectRatio\(image\)/);
    assert.match(source, /if \(metadata\.kind === 'layout_bbox'\) return 1;[\s\S]*return null;/);
    assert.match(source, /renderAgentImageAspectStyle\(selectedImage\)/);
    assert.match(source, /loading="eager" decoding="async"/);
    assert.match(source, /const stepStateLabel = isApplied \? t\('agent\.pipelineSteps\.applied'\) : '';/);
    assert.match(source, /const currentStepLabel = block\.isCurrent && !isApplied \? t\('agent\.pipelineSteps\.current'\) : '';/);
    assert.match(source, /currentStepLabel \? `<span class="agent-step-current-tag">\$\{escapeHtml\(currentStepLabel\)\}<\/span>` : ''/);
    assert.match(source, /function getAgentPipelineProgressLabel\(attempt\)/);
    assert.match(source, /t\('common\.progressCount', \{[\s\S]*current: completed,[\s\S]*total: scopedBlocks\.length/);
    assert.match(source, /pipelineProgressLabel \|\| \(attempt\?\.status === 'complete'/);
    assert.match(source, /collapseAllSteps: '收纳全部步骤'/);
    assert.match(source, /expandAllSteps: '展开全部步骤'/);
    assert.match(source, /function createAgentStepExpandToggleIcon\(\)/);
    assert.match(source, /class="agent-session-step-toggle-icon"/);
    assert.match(source, /class="agent-session-step-toggle-shape is-menu"/);
    assert.match(source, /class="agent-session-step-toggle-shape is-arrow"/);
    assert.match(source, /data-agent-session-step-toggle="\$\{session\.id\}"/);
    assert.match(source, /stepBlocksCollapsed: !nextExpanded/);
    assert.match(source, /stepBlocksCollapsed: arePipelineStepsCollapsed/);
    assert.match(source, /const sessionStepToggle = event\.target\.closest\('\[data-agent-session-step-toggle\]'\)/);
    assert.match(source, /function captureAgentMessageLayoutAnimation\(options = null\)/);
    assert.match(source, /function prepareAgentMessageLayoutAnimation\(snapshot\)/);
    assert.match(source, /function restoreAgentMessageLayoutAnchor\(snapshot\)/);
    assert.match(source, /function runAgentMessageLayoutAnimation\(animation\)/);
    assert.match(source, /function syncAgentSessionStepBlocksDom\(sessionId, attemptId, expanded\)/);
    assert.match(source, /details\.classList\.remove\('is-deferred-hidden'\);/);
    assert.match(source, /details\.hidden = false;/);
    assert.match(source, /function syncAgentImageFrameAspectRatios\(root = dom\.agentMessageList\)/);
    assert.match(source, /frame\.style\.setProperty\('--agent-image-aspect-ratio', \(width \/ height\)\.toFixed\(4\)\)/);
    assert.match(source, /function retainAgentThumbnailImageCache\(root = dom\.agentMessageList\)/);
    assert.match(source, /const cachedImage = new Image\(\);/);
    assert.match(source, /renderAgentMessages\(\{ autoScroll, animateLayout \}\)/);
    assert.match(source, /renderAgentSessionStepBlocksExpanded\(sessionId, attemptId, !nextCollapsed\);/);
    assert.doesNotMatch(source, /animateAgentSessionStepBlocks\(sessionId, attemptId, !nextCollapsed\);[\s\S]*window\.setTimeout\(\(\) => \{[\s\S]*setAgentSessionStepBlocksExpanded\(sessionId, attemptId, !nextCollapsed\);/);
    assert.match(source, /if \(context\.stepBlocksCollapsed\) \{[\s\S]*blocks\.map\(\(block\) => renderAgentProgressBlock\(block, context\)\)/);
    assert.match(source, /function renderAgentStepImageMetadata\(image\)/);
    assert.match(source, /metadata\.kind === 'components_3d'/);
    assert.match(source, /components3dAssets/);
    assert.match(source, /metadata\.kind === 'insert_scene'/);
    assert.match(source, /insertSceneAsset/);
    assert.match(source, /metadata\.kind !== 'layout_bbox'/);
    const renderMetadataFunction = source.match(/function renderAgentStepImageMetadata\(image\) \{[\s\S]*?\n\}/)?.[0] || '';
    assert.doesNotMatch(renderMetadataFunction, /metadata\.bboxJsonPath \? `<span>\$\{escapeHtml\(metadata\.bboxJsonPath\)\}<\/span>` : ''/);
    assert.match(source, /patchAgentStepBlock\(liveContext, \{[\s\S]*images: nextImages/);
    assert.match(source, /if \(patch\.sceneInsertPlan && typeof patch\.sceneInsertPlan === 'object'\) \{/);
    assert.match(source, /await applyAgentSceneInsertPlan\(patch\.sceneInsertPlan\)/);
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

test('editor applies insert-scene plan directly into the Visionary scene', async () => {
    const source = await readFile(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /async function applyAgentSceneInsertPlan\(plan\) \{/);
    assert.match(source, /projectApi\.getAssetUrl\(\s*state\.projectSession\.user,[\s\S]*state\.projectSession\.activeProjectId,[\s\S]*sourcePath/);
    assert.match(source, /const fileForLoad = new File\(\[blob\], targetName/);
    assert.match(source, /await app\.loadModel\(fileForLoad, \{[\s\S]*sourcePath: targetName,[\s\S]*suppressLoadingOverlay: true/);
    assert.match(source, /app\.setModelPosition\(loadedModel\.id, position\[0\], position\[1\], position\[2\]\)/);
    assert.match(source, /app\.setModelRotation\(loadedModel\.id, rotation\[0\], rotation\[1\], rotation\[2\]\)/);
    assert.match(source, /app\.setModelScale\(loadedModel\.id, resolveAgentSceneInsertScale\(loadedModel, transform\)\)/);
    assert.match(source, /function computeObject3DDimensions\(root\)/);
    assert.match(source, /markWorkspaceDirty\('agent-insert-scene'\)/);
});

test('insert-scene MCP produces a scene insert plan instead of Blender output', async () => {
    const serverSource = await readFile(new URL('../src/server/mcp/new-pipeline-insert-scene-server.ts', import.meta.url), 'utf8');
    const runtimeSource = await readFile(new URL('../src/server/codex-agent-runtime.ts', import.meta.url), 'utf8');

    assert.match(serverSource, /sceneInsertPlan/);
    assert.match(serverSource, /visionary\.scene_insert_plan/);
    assert.match(serverSource, /bboxJsonPath\(batchDir, imageIndex\)/);
    assert.match(serverSource, /frontOrientationPath/);
    assert.match(serverSource, /matchGlbToLayoutObjects/);
    assert.match(serverSource, /images: \[\]/);
    assert.doesNotMatch(serverSource, /blender_frontpoint_layout\.py/);
    assert.doesNotMatch(serverSource, /layout\.blend/);
    assert.doesNotMatch(serverSource, /blendAsset/);
    assert.doesNotMatch(serverSource, /application\/x-blender/);
    assert.match(runtimeSource, /sceneInsertPlan\?: Record<string, unknown>/);
    assert.match(runtimeSource, /const sceneInsertPlan = readRecord\(result\.sceneInsertPlan\)/);
    assert.match(runtimeSource, /\.\.\.\(hasSceneInsertPlan \? \{ sceneInsertPlan \} : \{\}\)/);
});

test('editor clears Codex thread binding when the active server project changes', async () => {
    const source = await readFile(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /function resetAgentCodexSessionBinding\(\) \{[\s\S]*state\.agentCodexConversationId = '';[\s\S]*state\.agentCodexThreadId = '';[\s\S]*\}/);
    assert.match(source, /state\.projectSession\.activeProjectId = project\?\.id \|\| projectId;\s*state\.projectSession\.activeProjectName = project\?\.name \|\| projectId;\s*resetAgentCodexSessionBinding\(\);/);
    assert.match(source, /state\.projectSession\.activeProjectId = project\?\.id \|\| '';\s*state\.projectSession\.activeProjectName = project\?\.name \|\| projectName;\s*resetAgentCodexSessionBinding\(\);/);
    assert.match(source, /function clearActiveServerProjectSelection\(\) \{[\s\S]*resetAgentCodexSessionBinding\(\);[\s\S]*\}/);
    assert.match(source, /function logoutProjectSession\(\) \{[\s\S]*resetAgentCodexSessionBinding\(\);/);
});
