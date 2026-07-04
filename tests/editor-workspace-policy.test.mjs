import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readEditorSource() {
  return readFile(new URL('../public/editor.js', import.meta.url), 'utf8');
}

function getFunctionBody(source, signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `missing function signature: ${signature}`);
  const braceStart = source.indexOf('{', start);
  assert.notEqual(braceStart, -1, `missing body for: ${signature}`);

  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(braceStart + 1, index);
      }
    }
  }

  throw new Error(`unterminated function body for: ${signature}`);
}

test('editor tracks minimal workspace state in UI state', async () => {
  const source = await readEditorSource();

  assert.match(source, /workspace:\s*createWorkspaceState\(\)/);
  assert.match(source, /function createWorkspaceState\(\)/);
  assert.match(source, /mode:\s*'local'/);
  assert.match(source, /name:\s*null/);
  assert.match(source, /writable:\s*false/);
  assert.match(source, /dirty:\s*false/);
  assert.match(source, /saving:\s*false/);
  assert.match(source, /lastSavedAt:\s*null/);
  assert.match(source, /error:\s*null/);
  assert.match(source, /syncStatus:\s*'no-workspace'/);
});

test('saveScene exports project without rebinding workspace and status light opens workspace target selection', async () => {
  const source = await readEditorSource();
  const saveSceneBody = getFunctionBody(source, 'async function saveScene()');

  assert.match(saveSceneBody, /window\.showDirectoryPicker\(\{/);
  assert.match(saveSceneBody, /const exportSceneFs = new SceneFS\(\);/);
  assert.match(saveSceneBody, /exportSceneFs\.attachWorkspace\(exportRoot, 'readwrite'\)/);
  assert.match(saveSceneBody, /const agentExport = await buildPersistableAgentConversationExport\(\{\s*includeAssets: true,\s*includeAssetPayloads: true,\s*\}\);/s);
  assert.match(saveSceneBody, /exportSceneFs\.saveWorkspaceSnapshot\(manifest, \{ assets: assetInputs \}\)/);
  assert.match(saveSceneBody, /for \(const asset of agentExport\.assetPayloads \|\| \[\]\) \{[\s\S]*await exportSceneFs\.writeBinaryToRoot\(asset\.path, asset\.content\);[\s\S]*\}/);
  assert.match(saveSceneBody, /exportSceneFs\.writeJsonToRoot\('agent_history\.json', agentExport\.snapshot\)/);
  assert.doesNotMatch(saveSceneBody, /syncWorkspaceStateFromSceneFS\(/);
  assert.match(source, /function openWorkspaceTargetModal\(mode = 'status'\)/);
  assert.match(source, /workspaceStatusIndicator\?\.addEventListener\('click'/);
  assert.match(source, /openWorkspaceTargetModal\('status'\)/);
});

test('openSceneWorkspace delegates to local workspace selection helper', async () => {
  const source = await readEditorSource();
  const body = getFunctionBody(source, 'async function openSceneWorkspace()');

  assert.match(source, /async function pickLocalSceneFolder\(options = \{\}\)/);
  assert.match(body, /return pickLocalSceneFolder\(\{ silentCancel: true \}\);/);
  assert.doesNotMatch(body, /syncWorkspaceStateFromSceneFS\(/);
});

test('local scene loading first opens a local folder and only prompts for workspace target after load when none is configured', async () => {
  const source = await readEditorSource();
  const body = getFunctionBody(source, 'async function loadScene()');

  assert.match(source, /async function hydrateAgentConversationLocalWorkspaceAssets\(snapshot, rootHandle\)/);
  assert.match(body, /const folderHandle = await openSceneWorkspace\(\);/);
  assert.match(body, /if \(!hasConfiguredWorkspaceTarget\(\)\) \{\s*openWorkspaceTargetModal\('load-scene-after-load'\);\s*\}/s);
  assert.match(body, /const agentHistory = await readFileByRelativePath\(folderHandle, 'agent_history\.json'\)/);
  assert.match(body, /const hydratedAgentHistory = await hydrateAgentConversationLocalWorkspaceAssets\(agentHistory, folderHandle\);/);
  assert.match(body, /hydrateAgentConversationSnapshot\(hydratedAgentHistory\);/);
  assert.match(body, /resetAgentConversation\(\);/);
});

test('scene loading restores saved canvas camera pose after model and timeline restoration', async () => {
  const source = await readEditorSource();
  const localBody = getFunctionBody(source, 'async function loadScene()');
  const snapshotStart = source.indexOf('async function loadSceneFromSnapshot(raw, options = {})');
  const snapshotEnd = source.indexOf('async function openServerProject', snapshotStart);
  assert.ok(snapshotStart >= 0, 'expected to find loadSceneFromSnapshot');
  assert.ok(snapshotEnd > snapshotStart, 'expected to find loadSceneFromSnapshot source range');
  const snapshotBody = source.slice(snapshotStart, snapshotEnd);

  const localModelLoadIndex = localBody.indexOf('const loadedModel = await app.loadModel');
  const localTimelineIndex = localBody.indexOf('const loadedTimeline = applySceneTimelineSnapshot');
  const localRestoreIndex = localBody.indexOf('restoreSavedCameraPose(raw?.env)');
  assert.ok(localModelLoadIndex >= 0, 'expected local scene load to load models');
  assert.ok(localTimelineIndex >= 0, 'expected local scene load to apply timeline');
  assert.ok(localRestoreIndex > localModelLoadIndex, 'local scene load must restore camera pose after model auto-framing');
  assert.ok(localRestoreIndex > localTimelineIndex, 'local scene load must restore camera pose after timeline state');
  assert.doesNotMatch(
    localBody.slice(0, localModelLoadIndex),
    /restoreSavedCameraPose/,
    'local scene load must not restore camera pose before model loading'
  );

  const snapshotLoadIndex = snapshotBody.indexOf('const loadResult = await sceneFs.loadScene');
  const snapshotTimelineIndex = snapshotBody.indexOf('applySceneTimelineSnapshot(timeline)');
  const snapshotRestoreIndex = snapshotBody.indexOf('restoreSavedCameraPose(raw?.env)');
  assert.ok(snapshotLoadIndex >= 0, 'expected snapshot scene load to delegate to SceneFS');
  assert.ok(snapshotTimelineIndex >= 0, 'expected snapshot scene load to apply timeline');
  assert.ok(snapshotRestoreIndex > snapshotLoadIndex, 'snapshot scene load must restore camera pose after model auto-framing');
  assert.ok(snapshotRestoreIndex > snapshotTimelineIndex, 'snapshot scene load must restore camera pose after timeline state');
});

test('editor exposes a lightweight workspace status indicator in the toolbar', async () => {
  const [html, css, js] = await Promise.all([
    readFile(new URL('../public/editor.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/editor.css', import.meta.url), 'utf8'),
    readFile(new URL('../public/editor.js', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /id="workspaceStatusIndicator"/);
  assert.match(html, /id="workspaceTargetModal"/);
  assert.match(css, /\.workspace-status-indicator/);
  assert.match(css, /\.workspace-target-actions/);
  assert.match(css, /\.workspace-status-dot/);
  assert.match(js, /function updateWorkspaceStatusIndicator\(\)/);
  assert.match(js, /function isServerProjectSessionActive\(\)/);
  assert.match(js, /function isLocalWorkspaceSyncMode\(\)/);
  assert.match(js, /navigator\.onLine/);
  assert.match(js, /lastSavedAt/);
  assert.match(js, /workspace\.name \? t\('workspaceStatus\.localOnly'\) : t\('workspaceStatus\.noLocalWorkspace'\)/);
  assert.match(js, /code: combinedDirty \? 'dirty' : \(workspace\.name \? 'clean' : 'no-workspace'\)/);
});

test('model edits mark workspace dirty and schedule autosave persistence', async () => {
  const source = await readEditorSource();
  const updateModelBody = getFunctionBody(source, 'function updateModelFromEditor()');
  const resetTransformBody = getFunctionBody(source, 'function resetTransform()');
  const dirtyBody = getFunctionBody(source, 'function markWorkspaceDirty(reason = \'scene-change\')');
  const autosaveBody = getFunctionBody(source, 'function scheduleWorkspaceAutosave()');

  assert.match(source, /function markWorkspaceDirty\(/);
  assert.match(source, /function scheduleWorkspaceAutosave\(/);
  assert.match(source, /function saveWorkspaceToCurrentWorkspace\(/);
  assert.match(source, /async function saveServerProjectToCurrentProject\(options = \{\}\)/);
  assert.match(updateModelBody, /markWorkspaceDirty\(/);
  assert.match(resetTransformBody, /markWorkspaceDirty\(/);
  assert.match(dirtyBody, /if \(isServerProjectSessionActive\(\)\) \{/);
  assert.match(dirtyBody, /syncStatus: 'dirty'/);
  assert.match(dirtyBody, /scheduleWorkspaceAutosave\(\);/);
  assert.match(autosaveBody, /if \(isServerProjectSessionActive\(\)\) \{/);
  assert.match(autosaveBody, /void saveServerProjectToCurrentProject\(\{ silent: true \}\)/);
  assert.match(source, /onViewportGizmoTransform\?\.\(\(id, model\) => \{/);
  assert.match(source, /onViewportGizmoTransform\?\.\(\(id, model\) => \{[\s\S]*markWorkspaceDirty\(/);
});

test('server project agent conversation changes also mark sync dirty and trigger autosave', async () => {
  const source = await readEditorSource();
  const body = getFunctionBody(source, 'function schedulePersistAgentConversations()');

  assert.match(body, /if \(isServerProjectSessionActive\(\)\) \{/);
  assert.match(body, /syncAgentWorkspacePersistenceState\(\{\s*agentDirty: true,\s*agentError: null,\s*\}\);/s);
  assert.match(body, /agentSessionPersistTimer = window\.setTimeout\(\(\) => \{\s*scheduleWorkspaceAutosave\(\);\s*\}, 160\);/s);
});

test('incremental workspace save only writes assets that are not already materialized in workspace', async () => {
  const source = await readEditorSource();
  const autosaveBody = getFunctionBody(source, 'function scheduleWorkspaceAutosave()');
  assert.match(source, /async function buildSceneWorkspaceSnapshot\(options = \{\}\)/);
  assert.match(source, /allowWorkspaceMaterializedAssetReuse = true/);
  assert.match(source, /allowServerMaterializedAssetReuse = false/);
  assert.match(source, /forceFullWorkspaceAssetMigration: false/);
  assert.match(source, /function markWorkspaceTargetMigrationRequired\(target\)/);
  assert.match(autosaveBody, /const includeAssetPayloads = hasPendingWorkspaceAssetMaterialization\(\);/);
  assert.match(autosaveBody, /includeAssetPayloads,/);
  assert.match(source, /const forceFullAssetMigration = Boolean\(state\.forceFullWorkspaceAssetMigration\);/);
  assert.match(source, /allowWorkspaceMaterializedAssetReuse: !forceFullAssetMigration/);
  assert.match(source, /const canProvideAssetPayload = sourceFile instanceof Blob \|\| \(sceneFs\.isWorkspaceWritable\?\.\(\) && isWorkspaceMaterializedAssetPath\(sourcePath\)\);/);
  assert.match(source, /const shouldReuseWorkspaceMaterializedPath = allowWorkspaceMaterializedAssetReuse && isWorkspaceMaterializedAssetPath\(sourcePath\);/);
  assert.match(source, /const shouldReuseServerMaterializedPath = allowServerMaterializedAssetReuse && isServerMaterializedAssetPath\(sourcePath\);/);
  assert.match(
    source,
    /const shouldMaterializeAsset = includeAssetPayloads\s*[\r\n]+\s*&& canProvideAssetPayload\s*[\r\n]+\s*&& !shouldReuseWorkspaceMaterializedPath\s*[\r\n]+\s*&& !shouldReuseServerMaterializedPath;/
  );
  assert.match(source, /if \(showProgress && shouldMaterializeAsset\) \{/);
  assert.match(source, /if \(shouldMaterializeAsset\) \{/);
  assert.match(source, /applyWorkspaceAssetWritesToLoadedModels/);
  assert.match(autosaveBody, /if \(!isLocalWorkspaceSyncMode\(\)\) return;/);
});

test('workspace asset materialization progress uses a non-blocking loading overlay mode', async () => {
  const source = await readEditorSource();
  const css = await readFile(new URL('../public/editor.css', import.meta.url), 'utf8');

  assert.match(source, /function showLoading\(show, text = t\('loading\.default'\), progress = 0, options = \{\}\)/);
  assert.match(source, /dom\.loadingOverlay\.classList\.toggle\('loading-overlay-passive', options\?\.passive === true\)/);
  assert.match(source, /t\('loading\.savingAssets', \{ current: i \+ 1, total: models\.length \}\),[\s\S]*\{ passive: true \}/);
  assert.match(css, /\.loading-overlay\.loading-overlay-passive/);
  assert.match(css, /pointer-events:\s*none;/);
});

test('startup loading overlay shows the current initialization step', async () => {
  const [html, css, source] = await Promise.all([
    readFile(new URL('../public/editor.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/editor.css', import.meta.url), 'utf8'),
    readEditorSource(),
  ]);

  assert.match(html, /id="bootLoadingOverlay"[\s\S]*class="loading-detail" data-i18n="loading\.bootPreparing"/);
  assert.match(css, /\.loading-detail/);
  assert.match(source, /function setBootLoadingStatus\(detail = t\('loading\.bootPreparing'\)\)/);
  assert.match(source, /setBootLoadingStatus\(t\('loading\.bootLoadingEditorApp'\)\)/);
  assert.match(source, /setBootLoadingStatus\(t\('loading\.bootInitializingWebGpu'\)\)/);
  assert.match(source, /setBootLoadingStatus\(t\('loading\.bootConnectingEditor'\)\)/);
  assert.match(source, /loadingDetail\.textContent = options\?\.detail \|\| '';/);
});

test('workspace and server save flows emit debug logs for file-level progress', async () => {
  const source = await readEditorSource();

  assert.match(source, /\[WorkspaceSave\] saveWorkspaceToCurrentWorkspace:start/);
  assert.match(source, /\[WorkspaceSave\] saveWorkspaceToCurrentWorkspace:complete/);
  assert.match(source, /\[WorkspaceSave\] saveWorkspaceToCurrentWorkspace:error/);
  assert.match(source, /showLoading\(false\);/);
  assert.match(source, /\[ProjectSync\] uploadServerProjectAssets:file:start/);
  assert.match(source, /\[ProjectSync\] uploadServerProjectAssets:file:complete/);
  assert.match(source, /\[ProjectSync\] uploadServerAgentHistoryAssets:file:start/);
  assert.match(source, /\[ProjectSync\] uploadServerAgentHistoryAssets:file:complete/);
  assert.match(source, /\[ProjectSync\] saveServerProjectToCurrentProject:file:complete/);
  assert.match(source, /\[ProjectExport\] saveScene:file:start/);
  assert.match(source, /\[ProjectExport\] saveScene:file:complete/);
  assert.match(source, /\[AgentSync\] persistAgentConversationsNow:start/);
  assert.match(source, /\[AgentSync\] persistAgentConversationsNow:complete/);
});

test('export and server project save paths re-materialize workspace assets for new destinations', async () => {
  const source = await readEditorSource();

  assert.match(source, /async function resolveModelAssetBytes\(model, sourcePath\)/);
  assert.match(source, /async function saveScene\(\)[\s\S]*allowWorkspaceMaterializedAssetReuse: false/);
  assert.match(source, /async function createServerProjectFromCurrentScene\(options = \{\}\)[\s\S]*allowWorkspaceMaterializedAssetReuse: false/);
  assert.match(source, /async function saveServerProjectToCurrentProject\(options = \{\}\)[\s\S]*allowWorkspaceMaterializedAssetReuse: false/);
});

test('server sync reuses already materialized server asset paths for incremental uploads', async () => {
  const source = await readEditorSource();

  assert.match(source, /activeProjectSceneAssetPaths: new Set\(\)/);
  assert.match(source, /activeProjectAgentAssetPaths: new Set\(\)/);
  assert.match(source, /function updateActiveServerProjectAssetCaches\(\{ scene, agentHistory \} = \{\}\)/);
  assert.match(source, /allowServerMaterializedAssetReuse = false/);
  assert.match(source, /forceFullServerAssetMigration: false/);
  assert.match(source, /const shouldReuseServerMaterializedPath = allowServerMaterializedAssetReuse && isServerMaterializedAssetPath\(sourcePath\);/);
  assert.match(source, /existingAssetPaths = new Set\(\)/);
  assert.match(source, /uploadServerProjectAssets:file:skip-known/);
  assert.match(source, /uploadServerAgentHistoryAssets:file:skip-known/);
  assert.match(source, /const forceFullAssetMigration = Boolean\(state\.forceFullServerAssetMigration\);/);
  assert.match(source, /allowServerMaterializedAssetReuse: !forceFullAssetMigration/);
  assert.match(source, /state\.workspace = \{\s*[\s\S]*saving: true,\s*[\s\S]*agentSaving: true,\s*[\s\S]*syncStatus: 'saving',\s*\};/);
  assert.match(source, /state\.workspace = \{\s*[\s\S]*dirty: false,\s*[\s\S]*saving: false,\s*[\s\S]*agentDirty: false,\s*[\s\S]*agentSaving: false,\s*[\s\S]*syncStatus: 'clean',\s*\};/);
});

test('editor treats same-origin absolute asset paths as fetchable remote resources', async () => {
  const source = await readEditorSource();
  const helperBody = getFunctionBody(source, 'function isHttpUrl(value)');

  assert.match(helperBody, /value\.startsWith\('\/'\)/);
  assert.match(source, /if \(sourcePath && !isHttpUrl\(sourcePath\)\) \{/);
  assert.match(source, /else if \(isHttpUrl\(sourcePath\)\) \{/);
});

test('viewport sync avoids redundant renderer layout refresh during sidebar drag', async () => {
  const source = await readEditorSource();
  const body = getFunctionBody(source, 'function syncCanvasContainerToViewport()');

  assert.match(source, /let lastCanvasViewportSync = null;/);
  assert.match(body, /viewportChanged/);
  assert.match(body, /if \(viewportChanged\) \{/);
  assert.match(body, /app\?\.refreshViewportLayout\?\.\(\)/);
});
