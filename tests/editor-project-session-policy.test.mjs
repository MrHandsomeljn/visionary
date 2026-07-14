import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('editor exposes a leading user-session button and modal-based login/project prompts', async () => {
    const html = await readFile(new URL('../public/editor.html', import.meta.url), 'utf8');

    assert.match(html, /id="btnUserSession"/);
    assert.match(html, /data-role="user-session"/);
    assert.match(html, /id="loginModal"/);
    assert.match(html, /id="postLoginProjectModal"/);
    assert.match(html, /id="projectBrowserModal"/);
    assert.match(html, /id="projectBrowserProjectGrid"/);
    assert.match(html, /class="project-browser-summary-row"/);
    assert.match(html, /id="projectBrowserProjectsTab"[^>]+data-project-browser-tab="projects"[^>]+data-i18n="projectSession\.browserProjectsTab"/);
    assert.match(html, /id="projectBrowserApiTab"[^>]+data-project-browser-tab="api"[^>]+data-i18n="projectSession\.apiManagementTab"/);
    assert.match(html, /id="projectBrowserProjectsPanel"[^>]+data-project-browser-panel="projects"/);
    assert.match(html, /id="projectBrowserApiPanel"[^>]+data-project-browser-panel="api"[^>]+hidden/);
    assert.match(html, /id="projectBrowserCodexAuthInline" class="project-browser-auth-inline"/);
    assert.match(html, /id="projectBrowserCodexAuthStatus"/);
    assert.match(html, /id="projectBrowserAgentRuntimeStatus" class="project-browser-agent-runtime-status"/);
    assert.match(html, /id="btnProjectBrowserEditCodexAuth"[^>]+data-i18n-attrs="title:projectSession\.codexAuthEditAction;aria-label:projectSession\.codexAuthEditAction"/);
    assert.match(html, /id="projectBrowserCodexAuthKey"[^>]+class="project-browser-auth-inline-input"[^>]+data-i18n-placeholder="projectSession\.codexAuthPlaceholder"[^>]+hidden/);
    assert.match(html, /id="btnProjectBrowserSaveCodexAuth"[^>]+class="project-browser-auth-submit-btn"[^>]+data-i18n-attrs="title:projectSession\.codexAuthSubmitAction;aria-label:projectSession\.codexAuthSubmitAction"[^>]+hidden/);
    assert.match(html, /data-i18n="projectSession\.apiProvider3DTitle"[^>]*>3D 生成 API<\/h5>/);
    assert.match(html, /id="projectBrowserComponents3DStatus"/);
    assert.match(html, /id="projectBrowserComponents3DProvider"[^>]+role="radiogroup"/);
    assert.match(html, /id="btnComponents3DProviderMocked"[^>]+data-components3d-provider="mocked"/);
    assert.match(html, /id="btnComponents3DProviderHunyuan"[^>]+data-components3d-provider="hunyuan"/);
    assert.match(html, /id="btnComponents3DProviderTrellis2"[^>]+data-components3d-provider="trellis\.2"/);
    assert.match(html, /id="btnComponents3DProviderTrellis2"[^>]*>私有部署<\/button>/);
    assert.match(html, /id="components3DTrellisModel"[^>]+list="components3DTrellisModelOptions"[^>]+placeholder="TRELLIS\.2-1024"/);
    assert.match(html, /id="components3DTrellisModelOptions"[\s\S]*TRELLIS\.2-512[\s\S]*TRELLIS\.2-1024[\s\S]*TRELLIS\.2-1536/);
    assert.match(html, /id="components3DTrellisStatusPanel"[^>]+hidden/);
    assert.match(html, /id="btnComponents3DTrellisStatusRefresh"[^>]+data-i18n-attrs="title:projectSession\.components3DTrellisStatusRefresh;aria-label:projectSession\.components3DTrellisStatusRefresh"/);
    assert.match(html, /id="components3DTrellisStatusBadge"[^>]+data-i18n="projectSession\.components3DTrellisStatusUnknown"/);
    assert.match(html, /id="components3DTrellisStatusBody"/);
    assert.match(html, /id="components3DHunyuanBaseUrl"[^>]+placeholder="https:\/\/ai3d\.tencentcloudapi\.com"/);
    assert.match(html, /id="components3DHunyuanSecretKey"[^>]+type="password"[^>]+data-i18n-placeholder="projectSession\.apiProviderSecretKeyPlaceholder"/);
    assert.match(html, /id="components3DHunyuanSecretId"[^>]+placeholder="AKID\.\.\."/);
    assert.match(html, /id="components3DHunyuanRegion"[^>]+placeholder="ap-guangzhou"/);
    assert.match(html, /id="components3DHunyuanVersion"[^>]+placeholder="2025-05-13"/);
    assert.match(html, /id="components3DHunyuanModel"[^>]+placeholder="3\.1"/);
    assert.match(html, /id="components3DHunyuanHost" type="hidden"/);
    assert.match(html, /id="components3DHunyuanPort" type="hidden"/);
    assert.match(html, /id="components3DTrellisCallbackUrl" type="hidden"/);
    assert.match(html, /id="components3DTrellisDownloadBaseUrl" type="hidden"/);
    assert.match(html, /id="components3DHunyuanCallbackUrl" type="hidden"/);
    assert.match(html, /id="components3DHunyuanDownloadBaseUrl" type="hidden"/);
    assert.doesNotMatch(html, /data-i18n="projectSession\.apiFieldCallbackUrl"/);
    assert.doesNotMatch(html, /data-i18n="projectSession\.apiFieldDownloadBaseUrl"/);
    assert.match(html, /id="btnProjectBrowserSaveComponents3DConfig"[^>]+data-i18n="projectSession\.apiConfigSaveAction"[^>]+disabled/);
    assert.match(html, /data-i18n="projectSession\.apiProviderPipelineTitle"[^>]*>Pipeline API<\/h5>/);
    assert.doesNotMatch(html, /data-i18n="projectSession\.apiProviderPipelineTitle"[^>]*>[^<]*apiyi/i);
    assert.doesNotMatch(html, /data-i18n="projectSession\.apiProviderPipelineDescription"[^>]*>[^<]*apiyi/i);
    assert.match(html, /id="projectBrowserPipelineApiStatus"/);
    assert.match(html, /id="pipelineApiKey"[^>]+data-i18n-placeholder="projectSession\.apiProviderKeyPlaceholder"/);
    assert.match(html, /id="pipelineApiBase"[^>]+placeholder="https:\/\/api\.apiyi\.com"/);
    assert.ok(html.indexOf('id="pipelineApiBase"') < html.indexOf('id="pipelineApiKey"'));
    assert.match(html, /id="pipelineApiModelName"[^>]+placeholder="gemini-3\.1-pro-preview"/);
    assert.match(html, /id="pipelineApiImageUrl"[^>]+placeholder="https:\/\/api\.apiyi\.com\/v1beta\/models\/gemini-3\.1-flash-image-preview:generateContent"/);
    assert.match(html, /id="btnProjectBrowserSavePipelineApiConfig"[^>]+data-i18n="projectSession\.apiConfigSaveAction"[^>]+disabled/);
    assert.doesNotMatch(html, /project-browser-api-provider is-disabled/);
    assert.match(html, /id="btnProjectBrowserCreateNew"[^>]+data-i18n="projectSession\.createNewProjectAction"[^>]*>创建新项目<\/button>/);
    assert.match(html, /id="projectCreateModal"/);
    assert.match(html, /for="projectCreateName"[^>]+data-i18n="projectSession\.createProjectNameLabel"[^>]*>新项目名称<\/label>/);
    assert.doesNotMatch(html, /for="projectCreateName"[^>]*>另存为项目名<\/label>/);
    assert.match(html, /id="btnProjectBrowserSaveAs"/);
    assert.match(html, /id="btnProjectBrowserLogout"/);
    assert.match(html, /id="adminProjectModal"/);
    assert.match(html, /id="adminUserList"/);
    assert.match(html, /id="adminProjectGrid"/);
    assert.match(html, /id="btnAdminProjectLogout"/);
    assert.doesNotMatch(html, /id="projectSessionLoggedOut"/);
});

test('editor wires project session state and project api client into the main controller', async () => {
    const source = await readFile(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /import \{ ProjectApiClient \} from '\.\.\/src\/editor\/project-api-client\.js';/);
    assert.match(source, /function createProjectSessionState\(\)/);
    assert.match(source, /projectSession:\s*createProjectSessionState\(\)/);
    assert.match(source, /const projectApi = new ProjectApiClient\(\);/);
    assert.match(source, /async function openServerProject\(projectId\)/);
    assert.match(source, /async function createServerProjectFromCurrentScene\(options = \{\}\)/);
    assert.match(source, /function openLoginModal\(\)/);
    assert.match(source, /function openPostLoginProjectModal\(\)/);
    assert.match(source, /function openProjectBrowserModal\(\)/);
    assert.match(source, /function setProjectBrowserTab\(tab = 'projects'\)/);
    assert.match(source, /function openAdminProjectModal\(\)/);
    assert.match(source, /function syncProjectSessionModalLabels\(\)/);
    assert.match(source, /btnProjectBrowserCreateNew:\s*document\.getElementById\('btnProjectBrowserCreateNew'\),/);
    assert.match(source, /projectBrowserProjectsTab:\s*document\.getElementById\('projectBrowserProjectsTab'\),/);
    assert.match(source, /projectBrowserApiTab:\s*document\.getElementById\('projectBrowserApiTab'\),/);
    assert.match(source, /projectBrowserProjectsPanel:\s*document\.getElementById\('projectBrowserProjectsPanel'\),/);
    assert.match(source, /projectBrowserApiPanel:\s*document\.getElementById\('projectBrowserApiPanel'\),/);
    assert.match(source, /projectBrowserCodexAuthStatus:\s*document\.getElementById\('projectBrowserCodexAuthStatus'\),/);
    assert.match(source, /projectBrowserAgentRuntimeStatus:\s*document\.getElementById\('projectBrowserAgentRuntimeStatus'\),/);
    assert.match(source, /projectBrowserCodexAuthKey:\s*document\.getElementById\('projectBrowserCodexAuthKey'\),/);
    assert.match(source, /projectBrowserPipelineApiStatus:\s*document\.getElementById\('projectBrowserPipelineApiStatus'\),/);
    assert.match(source, /pipelineApiKey:\s*document\.getElementById\('pipelineApiKey'\),/);
    assert.match(source, /pipelineApiBase:\s*document\.getElementById\('pipelineApiBase'\),/);
    assert.match(source, /pipelineApiModelName:\s*document\.getElementById\('pipelineApiModelName'\),/);
    assert.match(source, /btnProjectBrowserSavePipelineApiConfig:\s*document\.getElementById\('btnProjectBrowserSavePipelineApiConfig'\),/);
    assert.match(source, /projectBrowserComponents3DStatus:\s*document\.getElementById\('projectBrowserComponents3DStatus'\),/);
    assert.match(source, /projectBrowserComponents3DProvider:\s*document\.getElementById\('projectBrowserComponents3DProvider'\),/);
    assert.match(source, /components3DTrellisHost:\s*document\.getElementById\('components3DTrellisHost'\),/);
    assert.match(source, /components3DTrellisModel:\s*document\.getElementById\('components3DTrellisModel'\),/);
    assert.match(source, /components3DTrellisStatusPanel:\s*document\.getElementById\('components3DTrellisStatusPanel'\),/);
    assert.match(source, /components3DTrellisStatusBadge:\s*document\.getElementById\('components3DTrellisStatusBadge'\),/);
    assert.match(source, /components3DTrellisStatusBody:\s*document\.getElementById\('components3DTrellisStatusBody'\),/);
    assert.match(source, /components3DHunyuanBaseUrl:\s*document\.getElementById\('components3DHunyuanBaseUrl'\),/);
    assert.match(source, /components3DHunyuanSecretId:\s*document\.getElementById\('components3DHunyuanSecretId'\),/);
    assert.match(source, /components3DHunyuanSecretKey:\s*document\.getElementById\('components3DHunyuanSecretKey'\),/);
    assert.match(source, /components3DHunyuanRegion:\s*document\.getElementById\('components3DHunyuanRegion'\),/);
    assert.match(source, /components3DHunyuanVersion:\s*document\.getElementById\('components3DHunyuanVersion'\),/);
    assert.match(source, /components3DHunyuanModel:\s*document\.getElementById\('components3DHunyuanModel'\),/);
    assert.match(source, /btnProjectBrowserSaveComponents3DConfig:\s*document\.getElementById\('btnProjectBrowserSaveComponents3DConfig'\),/);
    assert.match(source, /btnProjectBrowserEditCodexAuth:\s*document\.getElementById\('btnProjectBrowserEditCodexAuth'\),/);
    assert.match(source, /btnProjectBrowserSaveCodexAuth:\s*document\.getElementById\('btnProjectBrowserSaveCodexAuth'\),/);
    assert.match(source, /createNewProjectAction:\s*'创建新项目',/);
    assert.match(source, /createNewProjectAction:\s*'Create New Project',/);
    assert.match(source, /apiManagementTab:\s*'API 管理',/);
    assert.match(source, /apiManagementTab:\s*'API Management',/);
    assert.match(source, /apiProvider3DTitle:\s*'3D 生成 API',/);
    assert.match(source, /components3DProviderMocked:\s*'Mocked',/);
    assert.match(source, /components3DProviderHunyuan:\s*'Hunyuan',/);
    assert.match(source, /components3DProviderTrellis2:\s*'私有部署',/);
    assert.match(source, /components3DProviderTrellis2:\s*'Private Deployment',/);
    assert.match(source, /components3DTrellisStatusTitle:\s*'TRELLIS 状态',/);
    assert.match(source, /components3DTrellisStatusTitle:\s*'TRELLIS Status',/);
    assert.match(source, /components3DTrellisStatusModels:\s*'模型列表',/);
    assert.match(source, /components3DTrellisStatusModels:\s*'Model List',/);
    assert.match(source, /components3DTrellisStatusGpuDetails:\s*'GPU 详情',/);
    assert.match(source, /components3DTrellisStatusGpuDetails:\s*'GPU Details',/);
    assert.equal(source.match(/components3DTrellisStatusWorkerGpuIds:\s*'Worker GPU ID',/g)?.length, 2);
    assert.doesNotMatch(source, /components3DTrellisStatusActions:\s*'动作',/);
    assert.doesNotMatch(source, /components3DTrellisStatusActions:\s*'Actions',/);
    assert.match(source, /apiConfigSaveAction:\s*'保存 API 配置',/);
    assert.match(source, /apiProviderPipelineTitle:\s*'Pipeline API',/);
    assert.doesNotMatch(source, /apiProviderPipelineTitle:\s*'[^']*apiyi/i);
    assert.doesNotMatch(source, /apiProviderPipelineDescription:\s*'[^']*apiyi/i);
    assert.match(source, /apiProviderSecretKeyPlaceholder:\s*'留空保持已保存密钥',/);
    assert.match(source, /apiProviderKeyPlaceholder:\s*'留空保持已保存密钥',/);
    assert.match(source, /apiProvider3DTitle:\s*'3D Generation API',/);
    assert.match(source, /apiConfigSaveAction:\s*'Save API Config',/);
    assert.match(source, /apiProviderPipelineTitle:\s*'Pipeline API',/);
    assert.match(source, /apiProviderSecretKeyPlaceholder:\s*'Leave blank to keep saved secret key',/);
    assert.match(source, /apiProviderKeyPlaceholder:\s*'Leave blank to keep saved key',/);
    assert.match(source, /createProjectNameLabel:\s*'新项目名称',/);
    assert.match(source, /createProjectNameLabel:\s*'New project name',/);
    assert.match(source, /codexAuthSaveAction:\s*'保存 Auth',/);
    assert.match(source, /codexAuthSaveAction:\s*'Save Auth',/);
    assert.match(source, /codexAuthEditAction:\s*'编辑 Codex Auth',/);
    assert.match(source, /codexAuthEditAction:\s*'Edit Codex Auth',/);
    assert.match(source, /agentRuntimeCodex:\s*'Codex',/);
    assert.match(source, /agentRuntimeCodex:\s*'Codex',/);
    assert.match(source, /agentRuntimeDemo:\s*'Demo',/);
    assert.match(source, /agentRuntimeNoAuth:\s*'Codex Auth 未配置，当前使用 Demo Agent',/);
    assert.match(source, /agentRuntimeNoAuth:\s*'Codex Auth is not configured, using Demo Agent',/);
    assert.match(source, /setElementText\(dom\.projectBrowserProjectsTab, t\('projectSession\.browserProjectsTab'\)\);/);
    assert.match(source, /setElementText\(dom\.projectBrowserApiTab, t\('projectSession\.apiManagementTab'\)\);/);
    assert.match(source, /setElementText\(dom\.btnProjectBrowserCreateNew, t\('projectSession\.createNewProjectAction'\)\);/);
    assert.match(source, /function renderProjectBrowserCodexAuthStatus\(\)/);
    assert.match(source, /function getAgentRuntimeStatus\(\)/);
    assert.match(source, /function openProjectBrowserCodexAuthEditor\(\)/);
    assert.match(source, /function closeProjectBrowserCodexAuthEditor\(\)/);
    assert.match(source, /async function refreshProjectBrowserCodexAuthStatus\(\)/);
    assert.match(source, /async function saveProjectBrowserCodexAuth\(\)/);
    assert.match(source, /function renderProjectBrowserComponents3DConfig\(\)/);
    assert.match(source, /function renderProjectBrowserComponents3DTrellisStatus\(config\)/);
    assert.match(source, /async function refreshProjectBrowserComponents3DTrellisStatus\(\)/);
    assert.match(source, /components3DTrellisStatusRefreshing:\s*false,/);
    assert.match(source, /dom\.btnComponents3DTrellisStatusRefresh\?\.addEventListener\('click',/);
    assert.match(source, /function setProjectBrowserComponents3DGpuDetailsCollapsed\(collapsed\)/);
    assert.match(source, /data-trellis-gpu-details-toggle/);
    assert.match(source, /aria-expanded="\$\{String\(!gpuDetailsCollapsed\)\}"/);
    assert.match(source, /components3DTrellisGpuDetailsCollapsed:\s*true,/);
    assert.match(source, /function renderProjectBrowserPipelineApiConfig\(\)/);
    assert.match(source, /async function refreshProjectBrowserUserApiConfig\(\)/);
    assert.match(source, /async function saveProjectBrowserComponents3DConfig\(\)/);
    assert.match(source, /async function saveProjectBrowserPipelineApiConfig\(\)/);
    assert.doesNotMatch(source, /async function saveProjectBrowserUserApiConfig\(\)/);
    assert.match(source, /function renderProjectBrowserProjectGrid\(\)/);
    assert.match(source, /function formatProjectUpdatedAt\(updatedAt\)/);
    assert.match(source, /function formatProjectSize\(sizeBytes\)/);
    assert.match(source, /function startProjectRename\(projectId\)/);
    assert.match(source, /async function commitProjectRename\(projectId\)/);
    assert.match(source, /async function deleteProjectFromBrowser\(projectId\)/);
    assert.match(source, /function renderAdminUserList\(\)/);
    assert.match(source, /function renderAdminProjectGrid\(\)/);
});

test('login success prompt only appears when current scene has meaningful draft content', async () => {
    const source = await readFile(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /function hasMeaningfulAgentConversation\(\)/);
    assert.match(source, /function hasCurrentSceneDraftToSave\(\)/);
    assert.match(source, /if \(hasCurrentSceneDraftToSave\(\)\) \{\s*openPostLoginProjectModal\(\);\s*return;\s*\}/);
});

test('admin login path uses dedicated admin modal and admin delete APIs', async () => {
    const source = await readFile(new URL('../public/editor.js', import.meta.url), 'utf8');
    const clientSource = await readFile(new URL('../src/editor/project-api-client.js', import.meta.url), 'utf8');

    assert.match(source, /function isAdminUser\(user\)/);
    assert.match(source, /if \(state\.projectSession\.isAdmin\) \{\s*openAdminProjectModal\(\);\s*return;\s*\}/);
    assert.match(source, /async function deleteAdminProject\(user, projectId\)/);
    assert.match(source, /async function deleteAdminUser\(user\)/);
    assert.match(clientSource, /async listUsers\(\)/);
    assert.match(clientSource, /async adminDeleteProject\(user, projectId\)/);
    assert.match(clientSource, /async deleteUser\(user\)/);
});

test('server-backed project flow uploads assets and rewrites server asset urls on open', async () => {
    const source = await readFile(new URL('../public/editor.js', import.meta.url), 'utf8');
    const clientSource = await readFile(new URL('../src/editor/project-api-client.js', import.meta.url), 'utf8');

    assert.match(source, /async function uploadServerProjectAssets\(\{ user, projectId, assetInputs = \[\], existingAssetPaths = new Set\(\) \} = \{\}\)/);
    assert.match(source, /async function uploadServerAgentHistoryAssets\(\{ user, projectId, assetPayloads = \[\], existingAssetPaths = new Set\(\) \} = \{\}\)/);
    assert.match(source, /function buildServerProjectSceneSnapshot\(manifest, assetWrites = \[\]\)/);
    assert.match(source, /function restoreServerProjectModelSourcePaths\(sceneAssets = \[\]\)/);
    assert.match(source, /function buildServerSceneAssetUrls\(rawScene, user, projectId\)/);
    assert.match(source, /async function resolveServerProjectExistingAssetPaths\(\{ user, projectId, fallbackScenePaths = new Set\(\), fallbackAgentPaths = new Set\(\) \} = \{\}\)/);
    assert.match(source, /async function buildPersistableAgentConversationExport\(options = \{\}\)/);
    assert.match(source, /function hydrateAgentConversationAssetUrls\(snapshot, resolveAssetUrl\)/);
    assert.match(source, /const scene = buildServerSceneAssetUrls\(rawScene, state\.projectSession\.user, projectId\);/);
    assert.match(source, /restoreServerProjectModelSourcePaths\(Array\.isArray\(rawScene\?\.assets\) \? rawScene\.assets : \[\]\);/);
    assert.match(source, /hydrateAgentConversationSnapshot\(hydrateAgentConversationAssetUrls\(/);
    assert.match(source, /const \{ manifest, assetInputs \} = await buildSceneWorkspaceSnapshot\(\{[\s\S]*includeAssetPayloads: true,[\s\S]*showProgress: false,[\s\S]*allowWorkspaceMaterializedAssetReuse: false,[\s\S]*\}\);/);
    assert.match(source, /const agentExport = await buildPersistableAgentConversationExport\(\{\s*includeAssets: true,\s*includeAssetPayloads: true,\s*\}\);/s);
    assert.match(source, /const existingServerAssetPaths = await resolveServerProjectExistingAssetPaths\(\{[\s\S]*projectId: state\.projectSession\.activeProjectId,[\s\S]*fallbackScenePaths: state\.projectSession\.activeProjectSceneAssetPaths,[\s\S]*fallbackAgentPaths: state\.projectSession\.activeProjectAgentAssetPaths,[\s\S]*\}\);/);
    assert.match(source, /const assetWrites = await uploadServerProjectAssets\(/);
    assert.match(source, /await uploadServerAgentHistoryAssets\(/);
    assert.match(source, /existingAssetPaths: existingServerAssetPaths\.scene/);
    assert.match(source, /existingAssetPaths: existingServerAssetPaths\.agent/);
    assert.match(source, /agentHistory: agentExport\.snapshot/);
    assert.match(clientSource, /getAssetUrl\(user, projectId, relativePath\)/);
    assert.match(clientSource, /async loadAssetIndex\(user, projectId\)/);
    assert.match(clientSource, /async writeAsset\(\{ user, projectId, relativePath, content \}\)/);
    assert.match(clientSource, /async renameProject\(\{ user, projectId, name \}\)/);
});

test('project file API serves image and model assets with browser-usable content types', async () => {
    const serverSource = await readFile(new URL('../src/server/project-api.ts', import.meta.url), 'utf8');

    assert.match(serverSource, /function contentTypeForProjectFilePath\(filePath: string\): string/);
    assert.match(serverSource, /normalized\.endsWith\('\.svg'\)[\s\S]*image\/svg\+xml; charset=utf-8/);
    assert.match(serverSource, /normalized\.endsWith\('\.png'\)[\s\S]*image\/png/);
    assert.match(serverSource, /normalized\.endsWith\('\.glb'\)[\s\S]*model\/gltf-binary/);
    assert.match(serverSource, /res\.setHeader\('content-type', contentTypeForProjectFilePath\(filePath\)\);/);
    assert.doesNotMatch(serverSource, /res\.setHeader\('content-type', 'application\/octet-stream'\);/);
});

test('opening a persisted server project rejects empty restore results for non-empty manifests', async () => {
    const source = await readFile(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /const loadResult = await sceneFs\.loadScene\(app, \{ sceneData: raw \}\);/);
    assert.match(source, /return \{\s*loaded: true,\s*loadResult,\s*\};/s);
    assert.match(source, /const hasPersistedAssets = Array\.isArray\(rawScene\?\.assets\) && rawScene\.assets\.length > 0;/);
    assert.match(source, /const totalAssetCount = Number\(loaded\?\.loadResult\?\.totalAssetCount \|\| 0\);/);
    assert.match(source, /const loadedAssetCount = Number\(loaded\?\.loadResult\?\.loadedAssetCount \|\| 0\);/);
    assert.match(source, /if \(hasPersistedAssets && totalAssetCount > 0 && loadedAssetCount <= 0\) \{\s*throw new Error\(t\('projectSession\.openProjectFailedEmpty'\)\);/s);
});

test('opening a server project closes project modals and uses a full-editor blocking loader', async () => {
    const source = await readFile(new URL('../public/editor.js', import.meta.url), 'utf8');
    const css = await readFile(new URL('../public/editor.css', import.meta.url), 'utf8');

    assert.match(source, /async function openServerProject\(projectId\) \{[\s\S]*closePostLoginProjectModal\(\);\s*closeProjectBrowserModal\(\);\s*showLoading\(true, t\('projectSession\.loadingProject'\), 30\);/);
    assert.match(css, /\.loading-overlay \{\s*position: fixed;\s*inset: 0;[\s\S]*z-index: 1000;/);
});

test('save button is now presented as export project instead of local workspace save copy', async () => {
  const html = await readFile(new URL('../public/editor.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../public/editor.js', import.meta.url), 'utf8');

  assert.match(html, /id="btnSaveScene"[^>]+title="导出项目"[^>]+aria-label="导出项目"/);
  assert.match(source, /setButtonTooltip\(dom\.btnSaveScene, t\('projectSession\.exportProject'\)\);/);
});

test('project creation uses pre-close only for post-login flow and keeps browser save-as panel stable on failure', async () => {
    const source = await readFile(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /reopenModalOnError = closeModal \? 'post-login' : 'project-browser-saveas'/);
    assert.match(source, /if \(reopenModalOnError === 'post-login'\) \{\s*closePostLoginProjectModal\(\);\s*\}/s);
    assert.match(source, /showLoading\(true, t\('projectSession\.savingProject'\), 40, \{ passive: true \}\);/);
    assert.match(source, /const existingServerAssetPaths = await resolveServerProjectExistingAssetPaths\(\{[\s\S]*projectId: draftProject\?\.id,[\s\S]*\}\);/);
    assert.match(source, /if \(reopenModalOnError === 'post-login'\) \{\s*openPostLoginProjectModal\(\);/s);
    assert.match(source, /else if \(reopenModalOnError === 'project-browser-saveas' && dom\.projectBrowserSaveAsName\) \{\s*dom\.projectBrowserSaveAsName\.value = projectName;\s*\}/s);
});

test('duplicate project names are surfaced inline on project name inputs instead of alert-only errors', async () => {
    const html = await readFile(new URL('../public/editor.html', import.meta.url), 'utf8');
    const css = await readFile(new URL('../public/editor.css', import.meta.url), 'utf8');
    const source = await readFile(new URL('../public/editor.js', import.meta.url), 'utf8');
    const clientSource = await readFile(new URL('../src/editor/project-api-client.js', import.meta.url), 'utf8');

    assert.match(html, /id="projectSessionNewProjectNameError" class="project-session-inline-error hidden"/);
    assert.match(html, /id="projectBrowserSaveAsNameError" class="project-session-inline-error hidden"/);
    assert.match(html, /id="projectCreateNameError" class="project-session-inline-error hidden"/);
    assert.match(css, /\.project-session-inline-error \{/);
    assert.match(css, /\.project-session-input\.has-error \{/);
    assert.match(clientSource, /async validateProjectName\(\{ user, name \}\)/);
    assert.match(clientSource, /fetch\(`\$\{this\.baseUrl\}\/validate-name`, \{/);
    assert.match(source, /function setProjectNameConflictState\(input, errorElement\)/);
    assert.match(source, /function setProjectNameNoticeState\(input, errorElement, message\)/);
    assert.match(source, /function isDuplicateProjectNameError\(error\)/);
    assert.match(source, /async function validateProjectNameBeforeCreate\(\{ projectName, input, errorElement \} = \{\}\)/);
    assert.match(source, /projectApi\.validateProjectName\(\{[\s\S]*user: state\.projectSession\.user,[\s\S]*name: projectName,[\s\S]*\}\)/);
    assert.match(source, /if \(validation\?\.hasTrashedBackup\) \{[\s\S]*setProjectNameNoticeState\(input, errorElement, t\('projectSession\.trashedProjectNameNotice'\)\);/);
    assert.match(source, /const projectNameAvailable = await validateProjectNameBeforeCreate\(\{[\s\S]*projectName,[\s\S]*input: nameInput,[\s\S]*errorElement,[\s\S]*\}\);[\s\S]*if \(!projectNameAvailable\) \{[\s\S]*return false;/);
    assert.match(source, /if \(isDuplicateProjectNameError\(error\)\) \{\s*setProjectNameConflictState\(reopenedInput, reopenedErrorElement\);\s*return false;\s*\}/s);
    assert.match(source, /dom\.projectSessionNewProjectName\?\.addEventListener\('input', \(\) => \{\s*clearProjectNameConflictState\(dom\.projectSessionNewProjectName, dom\.projectSessionNewProjectNameError\);\s*\}\);/s);
    assert.match(source, /dom\.projectBrowserSaveAsName\?\.addEventListener\('input', \(\) => \{\s*clearProjectNameConflictState\(dom\.projectBrowserSaveAsName, dom\.projectBrowserSaveAsNameError\);\s*\}\);/s);
    assert.match(source, /dom\.projectCreateName\?\.addEventListener\('input', \(\) => \{\s*clearProjectNameConflictState\(dom\.projectCreateName, dom\.projectCreateNameError\);\s*\}\);/s);
});

test('project browser save-as panel only closes after a successful save', async () => {
    const source = await readFile(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /function openProjectBrowserSaveAsPanel\(\{ preferDefaultName = false \} = \{\}\)/);
    assert.match(source, /const saved = await createServerProjectFromCurrentScene\(\{\s*nameInput: dom\.projectBrowserSaveAsName,\s*closeModal: false,\s*\}\);/s);
    assert.match(source, /if \(saved\) \{\s*closeProjectBrowserSaveAsPanel\(\);\s*\}/s);
    assert.match(source, /return true;\s*\} catch \(error\) \{/s);
    assert.match(source, /if \(isDuplicateProjectNameError\(error\)\) \{\s*setProjectNameConflictState\(reopenedInput, reopenedErrorElement\);\s*return false;\s*\}/s);
});

test('project browser create-new opens a stacked dialog with its own project-name field', async () => {
    const source = await readFile(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /projectCreateModal:\s*document\.getElementById\('projectCreateModal'\),/);
    assert.match(source, /projectCreateName:\s*document\.getElementById\('projectCreateName'\),/);
    assert.match(source, /projectCreateNameError:\s*document\.getElementById\('projectCreateNameError'\),/);
    assert.match(source, /function openProjectCreateDialog\(\) \{[\s\S]*dom\.projectCreateModal\?\.classList\.remove\('hidden'\);[\s\S]*dom\.projectCreateName\.value = getProjectSessionDefaultProjectName\(\);/);
    assert.match(source, /function closeProjectCreateDialog\(\) \{[\s\S]*dom\.projectCreateModal\?\.classList\.add\('hidden'\);[\s\S]*\}/);
    assert.match(source, /dom\.btnProjectBrowserCreateNew\?\.addEventListener\('click', openProjectCreateDialog\);/);
    assert.match(source, /dom\.btnProjectCreateConfirm\?\.addEventListener\('click', async \(\) => \{[\s\S]*nameInput: dom\.projectCreateName,[\s\S]*reopenModalOnError: 'project-create',[\s\S]*if \(saved\) \{[\s\S]*closeProjectCreateDialog\(\);/);
    assert.match(source, /reopenModalOnError === 'project-create'[\s\S]*dom\.projectCreateName/);
    assert.match(source, /reopenModalOnError === 'project-create'[\s\S]*dom\.projectCreateNameError/);
    assert.match(source, /if \(e\.key === 'Escape' && dom\.projectCreateModal && !dom\.projectCreateModal\.classList\.contains\('hidden'\)\) \{[\s\S]*closeProjectCreateDialog\(\);[\s\S]*return;/);
});

test('project browser cards expose delete actions and inline rename editing', async () => {
    const source = await readFile(new URL('../public/editor.js', import.meta.url), 'utf8');
    const css = await readFile(new URL('../public/editor.css', import.meta.url), 'utf8');
    const serverSource = await readFile(new URL('../src/server/project-api.ts', import.meta.url), 'utf8');
    const detachStart = source.indexOf('function detachDeletedServerProjectAsDraft');
    const selectLocalStart = source.indexOf('async function selectLocalWorkspace', detachStart);
    const detachBody = source.slice(detachStart, selectLocalStart);

    assert.match(serverSource, /method === 'PATCH'[\s\S]*storage\.renameProject\(\{/);
    assert.match(source, /deleteAction:\s*'删除',/);
    assert.match(source, /renameProjectAria:\s*'重命名项目 \{name\}',/);
    assert.match(source, /invalidProjectName:\s*'项目名称包含不支持的字符，无法作为服务器端项目名称',/);
    assert.match(source, /data-project-rename-start="\$\{escapeHtml\(projectId\)\}"/);
    assert.match(source, /data-project-rename-input="\$\{escapeHtml\(projectId\)\}"/);
    assert.match(source, /data-project-delete="\$\{escapeHtml\(projectId\)\}"/);
    assert.match(source, /project-browser-project-card-meta/);
    assert.match(source, /escapeHtml\(formatProjectUpdatedAt\(project\.updatedAt\)\)/);
    assert.match(source, /escapeHtml\(formatProjectSize\(project\.sizeBytes\)\)/);
    assert.match(source, /dom\.projectBrowserProjectGrid\?\.addEventListener\('click', \(event\) => \{[\s\S]*data-project-delete[\s\S]*deleteProjectFromBrowser\(projectId\);[\s\S]*data-project-rename-start[\s\S]*startProjectRename\(projectId\);/);
    assert.match(source, /dom\.projectBrowserProjectGrid\?\.addEventListener\('keydown', \(event\) => \{[\s\S]*event\.key === 'Enter'[\s\S]*commitProjectRename\(input\.dataset\.projectRenameInput\);/);
    assert.match(source, /dom\.projectBrowserProjectGrid\?\.addEventListener\('focusout', \(event\) => \{[\s\S]*commitProjectRename\(input\.dataset\.projectRenameInput\);/);
    assert.match(source, /if \(!nextName \|\| nextName === project\.name\) \{[\s\S]*cancelProjectRename\(\);[\s\S]*return;[\s\S]*\}/);
    assert.match(source, /projectApi\.renameProject\(\{[\s\S]*user: state\.projectSession\.user,[\s\S]*projectId: project\.id,[\s\S]*name: nextName,[\s\S]*\}\)/);
    assert.match(source, /if \(isInvalidProjectNameError\(error\)\) \{[\s\S]*setProjectRenameError\(project\.id, t\('projectSession\.invalidProjectName'\)\);/);
    assert.match(source, /if \(state\.projectSession\.activeProjectId === project\.id\) \{[\s\S]*state\.projectSession\.activeProjectId = renamed\?\.id \|\| project\.id;[\s\S]*resetAgentCodexSessionBinding\(\);/);
    assert.match(source, /projectApi\.deleteProject\(state\.projectSession\.user, project\.id\)/);
    assert.match(source, /currentProjectDeletedDraft:\s*'项目已删除，当前画布和 Agent 对话保留为未保存草稿，可另存为新项目或选择本地工作区',/);
    assert.match(source, /function detachDeletedServerProjectAsDraft\(\) \{[\s\S]*sceneFs\.clearWorkspace\?\.\(\);[\s\S]*clearActiveServerProjectSelection\(\);[\s\S]*mode: 'draft',[\s\S]*dirty: true,[\s\S]*syncStatus: 'no-workspace'/);
    assert.doesNotMatch(detachBody, /resetAllAgentConversations\(\);/);
    assert.match(source, /const deletingActiveProject = state\.projectSession\.activeProjectId === project\.id;/);
    assert.match(source, /if \(deletingActiveProject\) \{[\s\S]*detachDeletedServerProjectAsDraft\(\);[\s\S]*closeProjectBrowserModal\(\);[\s\S]*\} else \{[\s\S]*await refreshProjectSessionProjects\(\);[\s\S]*\}/);
    assert.match(source, /showInfo\(deletingActiveProject[\s\S]*t\('projectSession\.currentProjectDeletedDraft'\)[\s\S]*t\('projectSession\.projectDeleted', \{ name: projectName \}\)/);
    assert.match(source, /function resetAllAgentConversations\(\) \{[\s\S]*Object\.keys\(AGENT_WORKFLOW_DEFS\)\.forEach\(\(workflowId\) => \{[\s\S]*thread\.items = createDefaultAgentMessages\(workflowId\);[\s\S]*state\.agentPendingImages = \[\];/);
    assert.match(css, /\.project-browser-project-rename-btn\s*\{/);
    assert.match(css, /\.project-browser-project-card-meta\s*\{[\s\S]*justify-content:\s*space-between;/);
    assert.match(css, /\.project-browser-project-card-size\s*\{[\s\S]*text-align:\s*right;/);
    assert.match(css, /\.project-browser-project-card-size\s*\{[\s\S]*font-variant-numeric:\s*tabular-nums;/);
    assert.match(css, /\.project-browser-project-action-btn\s*\{[\s\S]*display:\s*inline-flex;/);
    assert.match(css, /\.project-browser-project-action-btn\s*\{[\s\S]*align-items:\s*center;/);
    assert.match(css, /\.project-browser-project-action-btn\s*\{[\s\S]*font-size:\s*10\.5px;/);
    assert.match(css, /\.project-browser-project-name-edit\.has-error\s*\{[\s\S]*animation:\s*project-name-error-flash/);
});

test('project delete API uses soft-delete storage lifecycle and starts a cleanup sweeper', async () => {
    const storageSource = await readFile(new URL('../src/server/project-storage.ts', import.meta.url), 'utf8');
    const serverSource = await readFile(new URL('../src/server/project-api.ts', import.meta.url), 'utf8');
    const source = await readFile(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(storageSource, /export type ProjectLifecycleState = 'active' \| 'trashed' \| 'deleting';/);
    assert.match(storageSource, /const PROJECT_DELETION_QUEUE_DIR = '\.deletion-queue';/);
    assert.match(storageSource, /const PROJECT_TRASH_SUFFIX = '\.bak';/);
    assert.match(storageSource, /interface ProjectNameValidationResult \{[\s\S]*hasTrashedBackup: boolean;[\s\S]*\}/);
    assert.match(storageSource, /async validateProjectNameAvailability\(input: ValidateProjectNameInput\): Promise<ProjectNameValidationResult>/);
    assert.match(storageSource, /async deleteProject\(userInput: string, projectIdInput: string\): Promise<ProjectDeleteResult> \{[\s\S]*lifecycleState: nextLifecycleState,[\s\S]*purgeAfter,/);
    assert.match(storageSource, /const trashedDirName = await this\.resolveAvailableTrashedProjectDirName\(userId, projectId, timestamp\);/);
    assert.match(storageSource, /await rename\(activeProjectDir, trashedProjectDir\);/);
    assert.match(storageSource, /await this\.writeDeletionQueueEntry\(\{[\s\S]*schema: PROJECT_DELETION_SCHEMA,[\s\S]*trashedDirName,[\s\S]*state: nextLifecycleState === 'deleting' \? 'deleting' : 'trashed',/);
    assert.match(storageSource, /async sweepDeletedProjects\(now = new Date\(\)\): Promise<ProjectDeletionSweepResult>/);
    assert.match(storageSource, /if \(!isProjectMetadataActive\(metadata\)\) \{[\s\S]*continue;[\s\S]*\}/);
    assert.match(storageSource, /private async readActiveProjectMetadata\(userId: string, projectId: string\): Promise<ProjectMetadata> \{[\s\S]*throw new ProjectStorageError\('NOT_FOUND', 'project not found'\);/);
    assert.match(storageSource, /await rm\(this\.getTrashedProjectDir\(entry\.userId, entry\.trashedDirName\), \{ recursive: true, force: true \}\);/);
    assert.doesNotMatch(storageSource, /async deleteProject\(userInput: string, projectIdInput: string\): Promise<\{ userId: string; projectId: string \}> \{[\s\S]*await rm\(this\.getProjectDir\(userId, projectId\), \{ recursive: true, force: true \}\);/);

    assert.match(serverSource, /storage\.startProjectDeletionSweeper\(options\?\.deletionSweepIntervalMs\)/);
    assert.match(serverSource, /server\.httpServer\?\.once\('close', \(\) => \{[\s\S]*stopDeletionSweeper\?\.\(\);[\s\S]*\}\);/);
    assert.match(serverSource, /url\.pathname === `\$\{API_PREFIX\}\/validate-name` && method === 'POST'[\s\S]*storage\.validateProjectNameAvailability\(\{/);
    assert.match(serverSource, /method === 'DELETE'[\s\S]*sendOk\(res, await storage\.deleteProject\(user, projectId\)\);/);
    assert.match(serverSource, /parts\.length === 3 && parts\[1\] === 'projects' && method === 'DELETE'[\s\S]*storage\.deleteProject\(parts\[0\] \|\| '', parts\[2\] \|\| ''\)/);

    assert.match(source, /if \(!confirm\(t\('projectSession\.confirmDeleteProject', \{ name: projectName \}\)\)\) return;/);
    assert.match(source, /await projectApi\.deleteProject\(state\.projectSession\.user, project\.id\);/);
    assert.match(source, /await refreshProjectSessionProjects\(\);/);
});

test('project browser exposes per-user Codex auth management without echoing raw keys', async () => {
    const source = await readFile(new URL('../public/editor.js', import.meta.url), 'utf8');
    const clientSource = await readFile(new URL('../src/editor/project-api-client.js', import.meta.url), 'utf8');
    const css = await readFile(new URL('../public/editor.css', import.meta.url), 'utf8');

    assert.match(clientSource, /async getCodexAuthStatus\(user\)/);
    assert.match(clientSource, /fetch\(`\/api\/codex-auth\$\{buildQuery\(\{ user \}\)\}`\)/);
    assert.match(clientSource, /async saveCodexAuth\(\{ user, apiKey \}\)/);
    assert.match(source, /void refreshProjectBrowserCodexAuthStatus\(\);/);
    assert.match(source, /projectApi\.getCodexAuthStatus\(state\.projectSession\.user\)/);
    assert.match(source, /projectApi\.saveCodexAuth\(\{[\s\S]*user: state\.projectSession\.user,[\s\S]*apiKey,[\s\S]*\}\)/);
    assert.match(source, /dom\.projectBrowserCodexAuthKey\.value = '';/);
    assert.match(source, /\[dom\.projectBrowserProjectsTab, dom\.projectBrowserApiTab\]\.forEach\(\(tabButton\) => \{[\s\S]*setProjectBrowserTab\(tabButton\.dataset\.projectBrowserTab \|\| 'projects'\);/);
    assert.match(source, /const showProjectActions = activeTab === 'projects';[\s\S]*dom\.btnProjectBrowserCreateNew\.hidden = !showProjectActions;[\s\S]*dom\.btnProjectBrowserSaveAs\.hidden = !showProjectActions;/);
    assert.match(source, /dom\.btnProjectBrowserEditCodexAuth\?\.addEventListener\('click', openProjectBrowserCodexAuthEditor\);/);
    assert.match(source, /dom\.btnProjectBrowserSaveCodexAuth\?\.addEventListener\('mousedown', \(event\) => \{[\s\S]*event\.preventDefault\(\);/);
    assert.match(source, /dom\.btnProjectBrowserSaveCodexAuth\?\.addEventListener\('click', \(\) => \{[\s\S]*saveProjectBrowserCodexAuth\(\);/);
    assert.match(source, /dom\.projectBrowserCodexAuthKey\?\.addEventListener\('keydown', \(event\) => \{[\s\S]*event\.key !== 'Enter'[\s\S]*saveProjectBrowserCodexAuth\(\);/);
    assert.match(source, /dom\.projectBrowserCodexAuthKey\?\.addEventListener\('blur', \(\) => \{[\s\S]*closeProjectBrowserCodexAuthEditor\(\);/);
    assert.match(css, /\.project-browser-summary-row\s*\{/);
    assert.match(css, /\.project-browser-tabs\s*\{/);
    assert.match(css, /\.project-browser-tab\.is-active\s*\{/);
    assert.match(css, /\.project-browser-panel\[hidden\]\s*\{/);
    assert.match(css, /\.project-browser-api-provider\s*\{/);
    assert.match(css, /\.project-browser-api-placeholder\s*\{/);
    assert.match(css, /\.project-browser-auth-inline\s*\{/);
    assert.match(css, /\.project-browser-auth-inline-input\s*\{/);
    assert.match(css, /\.project-browser-auth-submit-btn\[hidden\][\s\S]*display:\s*none !important;/);
    assert.match(css, /\.project-browser-auth-status\.is-ready\s*\{/);
});

test('project browser exposes per-user components 3D API provider management', async () => {
    const source = await readFile(new URL('../public/editor.js', import.meta.url), 'utf8');
    const clientSource = await readFile(new URL('../src/editor/project-api-client.js', import.meta.url), 'utf8');
    const css = await readFile(new URL('../public/editor.css', import.meta.url), 'utf8');

    assert.match(clientSource, /async getUserApiConfig\(user\)/);
    assert.match(clientSource, /fetch\(`\/api\/user-api-config\$\{buildQuery\(\{ user \}\)\}`\)/);
    assert.match(clientSource, /async saveUserApiConfig\(\{ user, config \}\)/);
    assert.match(clientSource, /fetch\('\/api\/user-api-config'/);
    assert.match(source, /components3DConfig:\s*createDefaultComponents3DConfig\(\),/);
    assert.match(source, /pipelineApiConfig:\s*createDefaultPipelineApiConfig\(\),/);
    assert.match(source, /components3DConfigSaving:\s*false,/);
    assert.match(source, /pipelineApiConfigSaving:\s*false,/);
    assert.match(source, /function createDefaultPipelineApiConfig\(\)/);
    assert.match(source, /apiBase:\s*'https:\/\/api\.apiyi\.com'/);
    assert.match(source, /modelName:\s*'gemini-3\.1-pro-preview'/);
    assert.match(source, /imageUrl:\s*'https:\/\/api\.apiyi\.com\/v1beta\/models\/gemini-3\.1-flash-image-preview:generateContent'/);
    assert.match(source, /function createDefaultComponents3DEndpointConfig\(kind = 'hunyuan'\)/);
    assert.match(source, /provider:\s*'mocked'/);
    assert.match(source, /baseUrl:\s*'https:\/\/ai3d\.tencentcloudapi\.com'/);
    assert.match(source, /secretId:\s*'',/);
    assert.match(source, /secretKey:\s*'',/);
    assert.match(source, /region:\s*'ap-guangzhou'/);
    assert.match(source, /version:\s*'2025-05-13'/);
    assert.match(source, /components3DTrellisStatus:\s*null,/);
    assert.match(source, /components3DConfigValidatedSignature:\s*'',/);
    assert.match(source, /pipelineApiConfigValidatedSignature:\s*'',/);
    assert.match(source, /function normalizeComponents3DTrellisStatus\(value\)/);
    assert.match(source, /model:\s*'TRELLIS\.2-1024'/);
    assert.match(source, /model:\s*'3\.1'/);
    assert.doesNotMatch(source, /apiFieldCallbackUrl:/);
    assert.doesNotMatch(source, /apiFieldDownloadBaseUrl:/);
    assert.match(source, /void refreshProjectBrowserUserApiConfig\(\);/);
    assert.match(source, /projectApi\.getUserApiConfig\(state\.projectSession\.user\)/);
    assert.match(source, /state\.projectSession\.components3DTrellisStatus = normalizeComponents3DTrellisStatus\(config\?\.components3DTrellisStatus\);/);
    const componentsSaveStart = source.indexOf('async function saveProjectBrowserComponents3DConfig()');
    const statusRefreshStart = source.indexOf('async function refreshProjectBrowserComponents3DTrellisStatus()');
    const pipelineSaveStart = source.indexOf('async function saveProjectBrowserPipelineApiConfig()');
    const projectGridStart = source.indexOf('function renderProjectBrowserProjectGrid()');
    const statusRefreshSource = source.slice(statusRefreshStart, componentsSaveStart);
    const componentsSaveSource = source.slice(componentsSaveStart, pipelineSaveStart);
    const pipelineSaveSource = source.slice(pipelineSaveStart, projectGridStart);
    assert.match(statusRefreshSource, /projectApi\.getUserApiConfig\(state\.projectSession\.user\)/);
    assert.match(statusRefreshSource, /state\.projectSession\.components3DTrellisStatus = normalizeComponents3DTrellisStatus\(config\?\.components3DTrellisStatus\);/);
    assert.doesNotMatch(statusRefreshSource, /state\.projectSession\.components3DConfig\s*=/);
    assert.doesNotMatch(statusRefreshSource, /writeEndpointConfigToForm/);
    assert.match(componentsSaveSource, /projectApi\.saveUserApiConfig\(\{[\s\S]*user: state\.projectSession\.user,[\s\S]*config:\s*\{[\s\S]*components3D: state\.projectSession\.components3DConfig,[\s\S]*\}[\s\S]*\}\)/);
    assert.doesNotMatch(componentsSaveSource, /pipelineApi: state\.projectSession\.pipelineApiConfig/);
    assert.match(pipelineSaveSource, /projectApi\.saveUserApiConfig\(\{[\s\S]*user: state\.projectSession\.user,[\s\S]*config:\s*\{[\s\S]*pipelineApi: state\.projectSession\.pipelineApiConfig,[\s\S]*\}[\s\S]*\}\)/);
    assert.doesNotMatch(pipelineSaveSource, /components3D: state\.projectSession\.components3DConfig/);
    assert.match(source, /renderProjectBrowserComponents3DTrellisStatus\(config\);/);
    assert.match(source, /function syncComponents3DTrellisModelOptions\(status\)/);
    assert.match(source, /status\.generationModels\.map\(\(model\) => model\.name\)/);
    assert.match(source, /function isProjectBrowserApiConfigDirty\(section\)/);
    assert.match(source, /function syncProjectBrowserApiConfigSaveState\(section\)/);
    assert.match(source, /button\.disabled = Boolean\(!state\.projectSession\.authenticated \|\| loading \|\| saving \|\| !dirty\);/);
    assert.match(source, /handleProjectBrowserApiConfigFormInput\('components3D'\);/);
    assert.match(source, /handleProjectBrowserApiConfigFormInput\('pipeline'\);/);
    assert.match(source, /dom\.btnProjectBrowserSavePipelineApiConfig\?\.addEventListener\('click',/);
    assert.match(source, /dom\.projectBrowserComponents3DProvider\?\.addEventListener\('click',/);
    assert.match(source, /setComponents3DProvider\(button\.dataset\.components3dProvider \|\| 'mocked'\);/);
    assert.match(source, /button\.setAttribute\('aria-checked', isActive \? 'true' : 'false'\);/);
    assert.match(css, /\.project-browser-provider-segmented\s*\{/);
    assert.match(css, /\.project-browser-provider-option\.is-active\s*\{/);
    assert.match(css, /\.project-browser-provider-panel\[hidden\]\s*\{/);
    assert.match(css, /\.project-browser-api-field-grid\s*\{/);
    assert.match(css, /\.project-browser-api-status-panel\s*\{/);
    assert.match(css, /\.project-browser-api-status-refresh\s*\{/);
    assert.match(css, /\.project-browser-api-status-refresh\.is-refreshing svg\s*\{/);
    assert.match(css, /\.project-browser-api-status-badge\.is-ready\s*\{/);
    assert.match(css, /\.project-browser-api-details-toggle\s*\{/);
    assert.match(css, /\.project-browser-api-details-toggle\.is-collapsed \.project-browser-api-details-toggle-shape\.is-menu\s*\{/);
    assert.match(css, /\.project-browser-api-details-toggle\.is-collapsed \.project-browser-api-details-toggle-shape\.is-arrow\s*\{/);
    assert.doesNotMatch(css, /\.project-browser-api-details-toggle\.is-collapsed\s*\{[^}]*color:\s*var\(--accent\)/);
    assert.match(css, /\.project-browser-api-status-details-body\[hidden\]\s*\{/);
    assert.match(css, /\.project-browser-api-actions \.button-primary:disabled\s*\{/);
    assert.match(css, /\.project-browser-api-input\s*\{/);
    assert.match(css, /\.project-browser-api-provider-status\.is-error\s*\{/);
});

test('logout from an active dirty server project routes through explicit sync-or-discard handling', async () => {
    const source = await readFile(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /async function requestProjectSessionLogout\(\)/);
    assert.match(source, /if \(!isServerProjectSessionActive\(\) \|\| !state\.workspace\?\.dirty\) \{\s*logoutProjectSession\(\);\s*return true;\s*\}/s);
    assert.match(source, /const shouldSyncBeforeLogout = confirm\(t\('projectSession\.logoutDirtyConfirm'\)\);/);
    assert.match(source, /const saved = await saveServerProjectToCurrentProject\(\{ silent: true \}\);/);
    assert.match(source, /if \(!saved\) \{\s*showError\(t\('projectSession\.logoutDirtySyncFailed'\)\);\s*return false;\s*\}/s);
    assert.match(source, /logoutProjectSession\(\);\s*return true;/s);
    assert.match(source, /dom\.btnProjectBrowserLogout\?\.addEventListener\('click', \(\) => \{\s*void requestProjectSessionLogout\(\);\s*\}\);/s);
    assert.match(source, /dom\.btnAdminProjectLogout\?\.addEventListener\('click', \(\) => \{\s*void requestProjectSessionLogout\(\);\s*\}\);/s);
});
