import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  ProjectStorage,
  ProjectStorageError,
  normalizeProjectName,
  normalizeUserIdentity,
} from '../src/server/project-storage.ts';

async function createTempStorage() {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'visionary-project-storage-'));
  const storage = new ProjectStorage(rootDir);
  return {
    rootDir,
    storage,
    async cleanup() {
      await rm(rootDir, { recursive: true, force: true });
    },
  };
}

function stagedJsonPayloadSize(payload: unknown): number {
  return Buffer.byteLength(`${JSON.stringify(payload, null, 2)}\n`, 'utf8') * 2;
}

test('normalizes lightweight user and project names into stable safe ids', () => {
  const user = normalizeUserIdentity('Demo User');
  const project = normalizeProjectName('Untitled Project 2026-04-16 21-30');

  assert.match(user.userId, /^demo-user-[a-f0-9]{10}$/);
  assert.equal(user.user, 'Demo User');
  assert.match(project.projectId, /^untitled-project-2026-04-16-21-30-[a-f0-9]{10}$/);
  assert.equal(project.name, 'Untitled Project 2026-04-16 21-30');
});

test('creates projects under separate user namespaces and lists by user', async () => {
  const { storage, cleanup } = await createTempStorage();
  try {
    const aliceProject = await storage.createProject({
      user: 'alice',
      name: 'Moon Scene',
      scene: { version: 2, assets: [] },
    });
    const bobProject = await storage.createProject({
      user: 'bob',
      name: 'Moon Scene',
    });

    assert.notEqual(aliceProject.userId, bobProject.userId);

    const aliceProjects = await storage.listProjects('alice');
    const bobProjects = await storage.listProjects('bob');

    assert.equal(aliceProjects.length, 1);
    assert.equal(aliceProjects[0]?.name, 'Moon Scene');
    assert.equal(aliceProjects[0]?.hasScene, true);
    assert.equal(typeof aliceProjects[0]?.sizeBytes, 'number');
    assert.ok((aliceProjects[0]?.sizeBytes || 0) > 0);
    assert.equal(bobProjects.length, 1);
    assert.equal(bobProjects[0]?.name, 'Moon Scene');
    assert.equal(bobProjects[0]?.hasScene, false);
    assert.equal(bobProjects[0]?.sizeBytes, 0);
  } finally {
    await cleanup();
  }
});

test('rejects duplicate project names inside one user namespace', async () => {
  const { storage, cleanup } = await createTempStorage();
  try {
    await storage.createProject({ user: 'alice', name: 'Duplicate Name' });

    await assert.rejects(
      () => storage.createProject({ user: 'alice', name: 'duplicate name' }),
      (error) => error instanceof ProjectStorageError && error.code === 'CONFLICT',
    );
  } finally {
    await cleanup();
  }
});

test('renames projects by moving the project namespace and preserving persisted content', async () => {
  const { storage, cleanup } = await createTempStorage();
  try {
    const project = await storage.createProject({
      user: 'alice',
      name: 'Original Name',
      scene: { version: 2, assets: [] },
    });
    await storage.createProject({ user: 'alice', name: 'Existing Name' });

    const renamed = await storage.renameProject({
      user: 'alice',
      projectId: project.id,
      name: 'Renamed Name',
    });

    assert.notEqual(renamed.id, project.id);
    assert.equal(renamed.name, 'Renamed Name');
    assert.deepEqual(await storage.readScene('alice', renamed.id), { version: 2, assets: [] });
    await assert.rejects(
      () => storage.getProject('alice', project.id),
      (error) => error instanceof ProjectStorageError && error.code === 'NOT_FOUND',
    );

    await assert.rejects(
      () => storage.renameProject({ user: 'alice', projectId: renamed.id, name: 'existing name' }),
      (error) => error instanceof ProjectStorageError && error.code === 'CONFLICT',
    );
    await assert.rejects(
      () => storage.renameProject({ user: 'alice', projectId: renamed.id, name: 'bad/name' }),
      (error) => error instanceof ProjectStorageError && error.code === 'BAD_REQUEST',
    );
  } finally {
    await cleanup();
  }
});

test('saves scene and agent history with staged json files inside project folder', async () => {
  const { rootDir, storage, cleanup } = await createTempStorage();
  try {
    const project = await storage.createProject({ user: 'alice', name: 'Server Scene' });
    const createdUpdatedAt = project.updatedAt;

    const scenePayload = { version: 2, assets: [{ name: 'model', path: 'assets/model.ply' }] };
    const agentHistoryPayload = { schema: 'visionary.agent_history', version: 2, workflows: [] };

    await storage.saveScene({
      user: 'alice',
      projectId: project.id,
      payload: scenePayload,
    });
    await storage.saveAgentHistory({
      user: 'alice',
      projectId: project.id,
      payload: agentHistoryPayload,
    });

    assert.deepEqual(await storage.readScene('alice', project.id), scenePayload);
    assert.deepEqual(await storage.readAgentHistory('alice', project.id), agentHistoryPayload);

    const userId = normalizeUserIdentity('alice').userId;
    const sceneTmpPath = path.join(rootDir, userId, project.id, 'scene.json.tmp');
    const scenePath = path.join(rootDir, userId, project.id, 'scene.json');
    const agentTmpPath = path.join(rootDir, userId, project.id, 'agent_history.json.tmp');
    const agentPath = path.join(rootDir, userId, project.id, 'agent_history.json');
    assert.equal(JSON.parse(await readFile(sceneTmpPath, 'utf8')).version, 2);
    assert.equal(JSON.parse(await readFile(scenePath, 'utf8')).version, 2);
    assert.equal(JSON.parse(await readFile(agentTmpPath, 'utf8')).schema, 'visionary.agent_history');
    assert.equal(JSON.parse(await readFile(agentPath, 'utf8')).schema, 'visionary.agent_history');

    const refreshedProject = await storage.getProject('alice', project.id);
    assert.notEqual(refreshedProject.updatedAt, createdUpdatedAt);
    assert.equal(
      refreshedProject.sizeBytes,
      stagedJsonPayloadSize(scenePayload) + stagedJsonPayloadSize(agentHistoryPayload),
    );
  } finally {
    await cleanup();
  }
});

test('writes project assets only under allowed project asset roots', async () => {
  const { rootDir, storage, cleanup } = await createTempStorage();
  try {
    const project = await storage.createProject({ user: 'alice', name: 'Assets' });
    const beforeWrite = await storage.getProject('alice', project.id);
    const content = new TextEncoder().encode('asset bytes');

    const writeResult = await storage.writeAsset({
      user: 'alice',
      projectId: project.id,
      relativePath: 'assets/hash.ply',
      content,
    });

    assert.deepEqual(writeResult, {
      path: 'assets/hash.ply',
      bytes: content.byteLength,
      skipped: false,
    });
    assert.deepEqual(await storage.readAsset('alice', project.id, 'assets/hash.ply'), Buffer.from(content));

    const skippedWriteResult = await storage.writeAsset({
      user: 'alice',
      projectId: project.id,
      relativePath: 'assets/hash.ply',
      content,
    });
    assert.deepEqual(skippedWriteResult, {
      path: 'assets/hash.ply',
      bytes: content.byteLength,
      skipped: true,
    });

    const agentHistoryWriteResult = await storage.writeAsset({
      user: 'alice',
      projectId: project.id,
      relativePath: 'agent_history/assets/aa/hash.png',
      content,
    });
    assert.deepEqual(agentHistoryWriteResult, {
      path: 'agent_history/assets/aa/hash.png',
      bytes: content.byteLength,
      skipped: false,
    });
    assert.deepEqual(
      await storage.readAsset('alice', project.id, 'agent_history/assets/aa/hash.png'),
      Buffer.from(content),
    );

    const userId = normalizeUserIdentity('alice').userId;
    await stat(path.join(rootDir, userId, project.id, 'assets', 'hash.ply'));
    await stat(path.join(rootDir, userId, project.id, 'agent_history', 'assets', 'aa', 'hash.png'));

    assert.deepEqual(await storage.listAssetIndex('alice', project.id), {
      scene: ['assets/hash.ply'],
      agent: ['agent_history/assets/aa/hash.png'],
    });

    const afterWrites = await storage.getProject('alice', project.id);
    assert.notEqual(afterWrites.updatedAt, beforeWrite.updatedAt);
    assert.equal(afterWrites.sizeBytes, content.byteLength * 2);

    await assert.rejects(
      () => storage.writeAsset({
        user: 'alice',
        projectId: project.id,
        relativePath: '../escape.ply',
        content,
      }),
      (error) => error instanceof ProjectStorageError && error.code === 'FORBIDDEN',
    );

    await assert.rejects(
      () => storage.writeAsset({
        user: 'alice',
        projectId: project.id,
        relativePath: 'other/hash.ply',
        content,
      }),
      (error) => error instanceof ProjectStorageError && error.code === 'BAD_REQUEST',
    );
  } finally {
    await cleanup();
  }
});

test('asset index excludes json manifests and remains empty before binary uploads', async () => {
  const { storage, cleanup } = await createTempStorage();
  try {
    const project = await storage.createProject({
      user: 'alice',
      name: 'Fresh Index',
      scene: { version: 2, assets: [] },
      agentHistory: { schema: 'visionary.agent_history', version: 2, workflows: [] },
    });

    assert.deepEqual(await storage.listAssetIndex('alice', project.id), {
      scene: [],
      agent: [],
    });
  } finally {
    await cleanup();
  }
});

test('user Codex auth syncs to existing and newly created project codex homes', async () => {
  const { rootDir, storage, cleanup } = await createTempStorage();
  try {
    const first = await storage.createProject({ user: 'alice', name: 'Auth One' });
    const second = await storage.createProject({ user: 'alice', name: 'Auth Two' });
    const bobProject = await storage.createProject({ user: 'bob', name: 'Other User' });
    const aliceId = normalizeUserIdentity('alice').userId;
    const bobId = normalizeUserIdentity('bob').userId;

    const status = await storage.saveUserCodexAuth({
      user: 'alice',
      apiKey: 'sk-user-auth',
    });

    assert.equal(status.user, 'alice');
    assert.equal(status.userId, aliceId);
    assert.equal(status.hasAuth, true);
    assert.equal(status.projectCount, 2);
    assert.deepEqual(
      JSON.parse(await readFile(path.join(rootDir, aliceId, 'codex_auth.json'), 'utf8')),
      { OPENAI_API_KEY: 'sk-user-auth' },
    );
    assert.deepEqual(
      JSON.parse(await readFile(path.join(rootDir, aliceId, first.id, 'codex_home', 'auth.json'), 'utf8')),
      { OPENAI_API_KEY: 'sk-user-auth' },
    );
    assert.deepEqual(
      JSON.parse(await readFile(path.join(rootDir, aliceId, second.id, 'codex_home', 'auth.json'), 'utf8')),
      { OPENAI_API_KEY: 'sk-user-auth' },
    );
    await assert.rejects(
      () => stat(path.join(rootDir, bobId, bobProject.id, 'codex_home', 'auth.json')),
      /ENOENT/,
    );

    const createdAfterAuth = await storage.createProject({ user: 'alice', name: 'Auth Three' });
    assert.deepEqual(
      JSON.parse(await readFile(path.join(rootDir, aliceId, createdAfterAuth.id, 'codex_home', 'auth.json'), 'utf8')),
      { OPENAI_API_KEY: 'sk-user-auth' },
    );
    assert.deepEqual(await storage.getUserCodexAuthStatus('alice'), {
      user: 'alice',
      userId: aliceId,
      hasAuth: true,
      projectCount: 3,
    });
  } finally {
    await cleanup();
  }
});

test('legacy Codex auth payloads are normalized for project codex homes', async () => {
  const { rootDir, storage, cleanup } = await createTempStorage();
  try {
    const userId = normalizeUserIdentity('alice').userId;
    await mkdir(path.join(rootDir, userId), { recursive: true });
    await writeFile(
      path.join(rootDir, userId, 'codex_auth.json'),
      `${JSON.stringify({ CODEX_API_KEY: 'sk-legacy-auth' }, null, 2)}\n`,
      'utf8',
    );

    const project = await storage.createProject({ user: 'alice', name: 'Legacy Auth' });

    assert.deepEqual(
      JSON.parse(await readFile(path.join(rootDir, userId, project.id, 'codex_home', 'auth.json'), 'utf8')),
      { OPENAI_API_KEY: 'sk-legacy-auth' },
    );
  } finally {
    await cleanup();
  }
});

test('lists users and supports deleting projects and full user namespaces', async () => {
  const { storage, cleanup } = await createTempStorage();
  try {
    const aliceProject = await storage.createProject({ user: 'alice', name: 'Scene A' });
    await storage.createProject({ user: 'alice', name: 'Scene B' });
    await storage.createProject({ user: 'bob', name: 'Scene C' });

    const users = await storage.listUsers();
    assert.equal(users.length, 2);
    assert.ok(users.some((user) => user.user === 'alice' && user.projectCount === 2));
    assert.ok(users.some((user) => user.user === 'bob' && user.projectCount === 1));

    await storage.deleteProject('alice', aliceProject.id);
    const aliceProjects = await storage.listProjects('alice');
    assert.equal(aliceProjects.length, 1);
    assert.equal(aliceProjects[0]?.name, 'Scene B');

    await storage.deleteUser('bob');
    const nextUsers = await storage.listUsers();
    assert.equal(nextUsers.some((user) => user.user === 'bob'), false);
    await assert.rejects(
      () => storage.deleteUser('bob'),
      (error) => error instanceof ProjectStorageError && error.code === 'NOT_FOUND',
    );
  } finally {
    await cleanup();
  }
});

test('ProjectStorage emits debug logs for staged json writes and asset writes', () => {
  const source = readFileSync(new URL('../src/server/project-storage.ts', import.meta.url), 'utf8');

  assert.match(source, /debugStorage\('writeJsonFile:start'/);
  assert.match(source, /debugStorage\('writeJsonFile:complete'/);
  assert.match(source, /debugStorage\('writeJsonStaged:start'/);
  assert.match(source, /debugStorage\('writeJsonStaged:complete'/);
  assert.match(source, /debugStorage\('writeAsset:start'/);
  assert.match(source, /debugStorage\('writeAsset:complete'/);
  assert.match(source, /debugStorage\('saveProjectJson:start'/);
  assert.match(source, /debugStorage\('saveProjectJson:complete'/);
});
