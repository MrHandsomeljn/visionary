import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('load scene always starts from a local folder and server workspace selection continues into login plus project naming', () => {
    const source = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');
    const html = readFileSync(new URL('../public/editor.html', import.meta.url), 'utf8');

    assert.match(html, /id="btnWorkspaceTargetServer"/);
    assert.match(html, /id="btnWorkspaceTargetLocal"/);
    assert.match(source, /dom\.btnLoadScene\?\.addEventListener\('click', loadScene\);/);
    assert.match(source, /async function loadScene\(\)[\s\S]*const folderHandle = await openSceneWorkspace\(\);/);
    assert.match(source, /openWorkspaceTargetModal\('load-scene-after-load'\)/);
    assert.match(source, /setPendingWorkspaceTargetAction\(\{\s*type: 'create-server-project-from-loaded-scene',\s*\}\);/s);
    assert.match(source, /if \(state\.pendingWorkspaceTargetAction\?\.type === 'create-server-project-from-loaded-scene'\) \{\s*openPostLoginProjectModal\(\);\s*return;\s*\}/s);
    assert.match(source, /function markWorkspaceTargetMigrationRequired\(target\)/);
    assert.match(source, /markWorkspaceTargetMigrationRequired\('local'\)/);
});
