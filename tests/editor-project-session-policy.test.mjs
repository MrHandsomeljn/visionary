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
    assert.match(html, /id="projectBrowserCodexAuthInline" class="project-browser-auth-inline"/);
    assert.match(html, /id="projectBrowserCodexAuthStatus"/);
    assert.match(html, /id="projectBrowserAgentRuntimeStatus" class="project-browser-agent-runtime-status"/);
    assert.match(html, /id="btnProjectBrowserEditCodexAuth"[^>]+data-i18n-attrs="title:projectSession\.codexAuthEditAction;aria-label:projectSession\.codexAuthEditAction"/);
    assert.match(html, /id="projectBrowserCodexAuthKey"[^>]+class="project-browser-auth-inline-input"[^>]+data-i18n-placeholder="projectSession\.codexAuthPlaceholder"[^>]+hidden/);
    assert.match(html, /id="btnProjectBrowserSaveCodexAuth"[^>]+class="project-browser-auth-submit-btn"[^>]+data-i18n-attrs="title:projectSession\.codexAuthSubmitAction;aria-label:projectSession\.codexAuthSubmitAction"[^>]+hidden/);
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
    assert.match(source, /function openAdminProjectModal\(\)/);
    assert.match(source, /function syncProjectSessionModalLabels\(\)/);
    assert.match(source, /btnProjectBrowserCreateNew:\s*document\.getElementById\('btnProjectBrowserCreateNew'\),/);
    assert.match(source, /projectBrowserCodexAuthStatus:\s*document\.getElementById\('projectBrowserCodexAuthStatus'\),/);
    assert.match(source, /projectBrowserAgentRuntimeStatus:\s*document\.getElementById\('projectBrowserAgentRuntimeStatus'\),/);
    assert.match(source, /projectBrowserCodexAuthKey:\s*document\.getElementById\('projectBrowserCodexAuthKey'\),/);
    assert.match(source, /btnProjectBrowserEditCodexAuth:\s*document\.getElementById\('btnProjectBrowserEditCodexAuth'\),/);
    assert.match(source, /btnProjectBrowserSaveCodexAuth:\s*document\.getElementById\('btnProjectBrowserSaveCodexAuth'\),/);
    assert.match(source, /createNewProjectAction:\s*'创建新项目',/);
    assert.match(source, /createNewProjectAction:\s*'Create New Project',/);
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
    assert.match(source, /setElementText\(dom\.btnProjectBrowserCreateNew, t\('projectSession\.createNewProjectAction'\)\);/);
    assert.match(source, /function renderProjectBrowserCodexAuthStatus\(\)/);
    assert.match(source, /function getAgentRuntimeStatus\(\)/);
    assert.match(source, /function openProjectBrowserCodexAuthEditor\(\)/);
    assert.match(source, /function closeProjectBrowserCodexAuthEditor\(\)/);
    assert.match(source, /async function refreshProjectBrowserCodexAuthStatus\(\)/);
    assert.match(source, /async function saveProjectBrowserCodexAuth\(\)/);
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

test('opening a persisted server project rejects empty restore results for non-empty manifests', async () => {
    const source = await readFile(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /const loadResult = await sceneFs\.loadScene\(app, \{ sceneData: raw \}\);/);
    assert.match(source, /return \{\s*loaded: true,\s*loadResult,\s*\};/s);
    assert.match(source, /const hasPersistedAssets = Array\.isArray\(rawScene\?\.assets\) && rawScene\.assets\.length > 0;/);
    assert.match(source, /const totalAssetCount = Number\(loaded\?\.loadResult\?\.totalAssetCount \|\| 0\);/);
    assert.match(source, /const loadedAssetCount = Number\(loaded\?\.loadResult\?\.loadedAssetCount \|\| 0\);/);
    assert.match(source, /if \(hasPersistedAssets && totalAssetCount > 0 && loadedAssetCount <= 0\) \{\s*throw new Error\(t\('projectSession\.openProjectFailedEmpty'\)\);/s);
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

    assert.match(html, /id="projectSessionNewProjectNameError" class="project-session-inline-error hidden"/);
    assert.match(html, /id="projectBrowserSaveAsNameError" class="project-session-inline-error hidden"/);
    assert.match(html, /id="projectCreateNameError" class="project-session-inline-error hidden"/);
    assert.match(css, /\.project-session-inline-error \{/);
    assert.match(css, /\.project-session-input\.has-error \{/);
    assert.match(source, /function setProjectNameConflictState\(input, errorElement\)/);
    assert.match(source, /function isDuplicateProjectNameError\(error\)/);
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
    assert.match(source, /if \(state\.projectSession\.activeProjectId === project\.id\) \{[\s\S]*clearActiveServerProjectSelection\(\);/);
    assert.match(source, /if \(state\.projectSession\.activeProjectId === project\.id\) \{[\s\S]*clearActiveServerProjectSelection\(\);[\s\S]*resetAllAgentConversations\(\);[\s\S]*resetAgentCodexSessionBinding\(\);/);
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
    assert.match(source, /dom\.btnProjectBrowserEditCodexAuth\?\.addEventListener\('click', openProjectBrowserCodexAuthEditor\);/);
    assert.match(source, /dom\.btnProjectBrowserSaveCodexAuth\?\.addEventListener\('mousedown', \(event\) => \{[\s\S]*event\.preventDefault\(\);/);
    assert.match(source, /dom\.btnProjectBrowserSaveCodexAuth\?\.addEventListener\('click', \(\) => \{[\s\S]*saveProjectBrowserCodexAuth\(\);/);
    assert.match(source, /dom\.projectBrowserCodexAuthKey\?\.addEventListener\('keydown', \(event\) => \{[\s\S]*event\.key !== 'Enter'[\s\S]*saveProjectBrowserCodexAuth\(\);/);
    assert.match(source, /dom\.projectBrowserCodexAuthKey\?\.addEventListener\('blur', \(\) => \{[\s\S]*closeProjectBrowserCodexAuthEditor\(\);/);
    assert.match(css, /\.project-browser-summary-row\s*\{/);
    assert.match(css, /\.project-browser-auth-inline\s*\{/);
    assert.match(css, /\.project-browser-auth-inline-input\s*\{/);
    assert.match(css, /\.project-browser-auth-submit-btn\[hidden\][\s\S]*display:\s*none !important;/);
    assert.match(css, /\.project-browser-auth-status\.is-ready\s*\{/);
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
