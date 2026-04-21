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
    assert.match(source, /function renderProjectBrowserProjectGrid\(\)/);
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
    assert.match(source, /async function buildPersistableAgentConversationExport\(options = \{\}\)/);
    assert.match(source, /function hydrateAgentConversationAssetUrls\(snapshot, resolveAssetUrl\)/);
    assert.match(source, /const scene = buildServerSceneAssetUrls\(rawScene, state\.projectSession\.user, projectId\);/);
    assert.match(source, /restoreServerProjectModelSourcePaths\(Array\.isArray\(rawScene\?\.assets\) \? rawScene\.assets : \[\]\);/);
    assert.match(source, /hydrateAgentConversationSnapshot\(hydrateAgentConversationAssetUrls\(/);
    assert.match(source, /const \{ manifest, assetInputs \} = await buildSceneWorkspaceSnapshot\(\{[\s\S]*includeAssetPayloads: true,[\s\S]*showProgress: false,[\s\S]*allowWorkspaceMaterializedAssetReuse: false,[\s\S]*\}\);/);
    assert.match(source, /const agentExport = await buildPersistableAgentConversationExport\(\{\s*includeAssets: true,\s*includeAssetPayloads: true,\s*\}\);/s);
    assert.match(source, /const assetWrites = await uploadServerProjectAssets\(/);
    assert.match(source, /await uploadServerAgentHistoryAssets\(/);
    assert.match(source, /agentHistory: agentExport\.snapshot/);
    assert.match(clientSource, /getAssetUrl\(user, projectId, relativePath\)/);
    assert.match(clientSource, /async writeAsset\(\{ user, projectId, relativePath, content \}\)/);
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
    assert.match(source, /if \(reopenModalOnError === 'post-login'\) \{\s*openPostLoginProjectModal\(\);/s);
    assert.match(source, /else if \(reopenModalOnError === 'project-browser-saveas' && dom\.projectBrowserSaveAsName\) \{\s*dom\.projectBrowserSaveAsName\.value = projectName;\s*\}/s);
});

test('duplicate project names are surfaced inline on project name inputs instead of alert-only errors', async () => {
    const html = await readFile(new URL('../public/editor.html', import.meta.url), 'utf8');
    const css = await readFile(new URL('../public/editor.css', import.meta.url), 'utf8');
    const source = await readFile(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(html, /id="projectSessionNewProjectNameError" class="project-session-inline-error hidden"/);
    assert.match(html, /id="projectBrowserSaveAsNameError" class="project-session-inline-error hidden"/);
    assert.match(css, /\.project-session-inline-error \{/);
    assert.match(css, /\.project-session-input\.has-error \{/);
    assert.match(source, /function setProjectNameConflictState\(input, errorElement\)/);
    assert.match(source, /function isDuplicateProjectNameError\(error\)/);
    assert.match(source, /if \(isDuplicateProjectNameError\(error\)\) \{\s*setProjectNameConflictState\(reopenedInput, reopenedErrorElement\);\s*return false;\s*\}/s);
    assert.match(source, /dom\.projectSessionNewProjectName\?\.addEventListener\('input', \(\) => \{\s*clearProjectNameConflictState\(dom\.projectSessionNewProjectName, dom\.projectSessionNewProjectNameError\);\s*\}\);/s);
    assert.match(source, /dom\.projectBrowserSaveAsName\?\.addEventListener\('input', \(\) => \{\s*clearProjectNameConflictState\(dom\.projectBrowserSaveAsName, dom\.projectBrowserSaveAsNameError\);\s*\}\);/s);
});

test('project browser save-as panel only closes after a successful save', async () => {
    const source = await readFile(new URL('../public/editor.js', import.meta.url), 'utf8');

    assert.match(source, /const saved = await createServerProjectFromCurrentScene\(\{\s*nameInput: dom\.projectBrowserSaveAsName,\s*closeModal: false,\s*\}\);/s);
    assert.match(source, /if \(saved\) \{\s*closeProjectBrowserSaveAsPanel\(\);\s*\}/s);
    assert.match(source, /return true;\s*\} catch \(error\) \{/s);
    assert.match(source, /if \(isDuplicateProjectNameError\(error\)\) \{\s*setProjectNameConflictState\(reopenedInput, reopenedErrorElement\);\s*return false;\s*\}/s);
});
