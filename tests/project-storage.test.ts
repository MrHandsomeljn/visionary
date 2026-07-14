import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  ProjectStorage,
  type ProjectStorageOptions,
  ProjectStorageError,
  normalizeProjectName,
  normalizeUserIdentity,
} from '../src/server/project-storage.ts';
import { redactUserApiConfigForClient } from '../src/server/components-3d-config.ts';

async function createTempStorage(options: ProjectStorageOptions = {}) {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'visionary-project-storage-'));
  const storage = new ProjectStorage(rootDir, options);
  return {
    rootDir,
    storage,
    async cleanup() {
      await rm(rootDir, { recursive: true, force: true });
    },
  };
}

async function readDeletionQueueEntry(rootDir: string, userId: string, projectId: string) {
  const queueDir = path.join(rootDir, '.deletion-queue', userId);
  const entries = await readdir(queueDir);
  for (const entryName of entries) {
    if (!entryName.endsWith('.json')) continue;
    const entryPath = path.join(queueDir, entryName);
    const entry = JSON.parse(await readFile(entryPath, 'utf8'));
    if (entry.projectId === projectId) {
      return { entry, entryPath };
    }
  }
  throw new Error(`Deletion queue entry not found for ${projectId}`);
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

test('treats legacy metadata without lifecycle state as active', async () => {
  const { rootDir, storage, cleanup } = await createTempStorage();
  try {
    const project = await storage.createProject({ user: 'alice', name: 'Legacy Lifecycle' });
    const userId = normalizeUserIdentity('alice').userId;
    const metadataPath = path.join(rootDir, userId, project.id, 'project.json');
    const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
    delete metadata.lifecycleState;
    await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

    const projects = await storage.listProjects('alice');
    assert.equal(projects.length, 1);
    assert.equal(projects[0]?.id, project.id);
    assert.equal(projects[0]?.lifecycleState, 'active');
  } finally {
    await cleanup();
  }
});

test('normalizes deletion timing options to safe millisecond values', async () => {
  const { storage, cleanup } = await createTempStorage({
    deletionRetentionMs: Number.NaN,
    deletionSweepIntervalMs: 1,
  });
  try {
    assert.equal(storage.deletionRetentionMs, 24 * 60 * 60 * 1000);
    assert.equal(storage.deletionSweepIntervalMs, 1000);
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

test('user API config persists components 3D provider settings per user', async () => {
  const { rootDir, storage, cleanup } = await createTempStorage();
  try {
    const aliceId = normalizeUserIdentity('alice').userId;
    const bobId = normalizeUserIdentity('bob').userId;

    const defaultConfig = await storage.getUserApiConfig('alice');
    assert.equal(defaultConfig.user, 'alice');
    assert.equal(defaultConfig.userId, aliceId);
    assert.equal(defaultConfig.codex.apiKey, '');
    assert.equal(defaultConfig.pipelineApi.apiBase, 'https://api.apiyi.com');
    assert.equal(defaultConfig.pipelineApi.apiProvider, 'gemini');
    assert.equal(defaultConfig.pipelineApi.modelName, 'gemini-3.1-pro-preview');
    assert.equal(defaultConfig.pipelineApi.imageUrl, 'https://api.apiyi.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent');
    assert.equal(defaultConfig.pipelineApi.imageModel, 'gemini-3.1-flash-image-preview');
    assert.equal(defaultConfig.pipelineApi.imageTimeoutMs, 300000);
    assert.equal(defaultConfig.components3D.provider, 'mocked');
    assert.equal(defaultConfig.components3D.trellis2.host, '127.0.0.1');
    assert.equal(defaultConfig.components3D.trellis2.port, '25367');
    assert.equal(defaultConfig.components3D.trellis2.model, 'TRELLIS.2-1024');
    assert.equal(defaultConfig.components3D.hunyuan.baseUrl, 'https://ai3d.tencentcloudapi.com');
    assert.equal(defaultConfig.components3D.hunyuan.host, 'ai3d.tencentcloudapi.com');
    assert.equal(defaultConfig.components3D.hunyuan.region, 'ap-guangzhou');
    assert.equal(defaultConfig.components3D.hunyuan.version, '2025-05-13');
    assert.equal(defaultConfig.components3D.hunyuan.secretKey, '');

    const saved = await storage.saveUserApiConfig({
      user: 'alice',
      config: {
        codex: {
          apiKey: 'sk-codex-from-api-config',
        },
        pipelineApi: {
          apiKey: 'sk-apiyi-from-api-config',
          apiBase: 'https://api.apiyi.com/v1',
          apiProvider: 'gemini',
          modelName: 'gemini-custom-pro',
          imageUrl: 'https://image.example.test/v1beta/models/custom-image:generateContent',
          imageModel: 'custom-image',
          imageTimeoutSeconds: 123,
        },
        components3D: {
          provider: 'trellis.2',
          trellis2: {
            host: '10.0.0.8',
            port: '25367',
            model: 'TRELLIS.2-1536',
            pollIntervalSeconds: 2,
            maxWaitSeconds: 300,
            downloadBaseUrl: 'http://127.0.0.1:25367',
          },
          hunyuan: {
            baseUrl: 'https://ai3d.tencentcloudapi.com',
            secretId: 'AKID-user',
            secretKey: 'secret-user',
            region: 'ap-shanghai',
            version: '2025-05-13',
            model: '3.1',
          },
        },
      },
    });

    assert.equal(saved.codex.apiKey, 'sk-codex-from-api-config');
    assert.equal(saved.pipelineApi.apiKey, 'sk-apiyi-from-api-config');
    assert.equal(saved.pipelineApi.apiBase, 'https://api.apiyi.com');
    assert.equal(saved.pipelineApi.modelName, 'gemini-custom-pro');
    assert.equal(saved.pipelineApi.imageUrl, 'https://image.example.test/v1beta/models/custom-image:generateContent');
    assert.equal(saved.pipelineApi.imageModel, 'custom-image');
    assert.equal(saved.pipelineApi.imageTimeoutMs, 123000);
    assert.equal(saved.components3D.provider, 'trellis.2');
    assert.equal(saved.components3D.trellis2.host, '10.0.0.8');
    assert.equal(saved.components3D.trellis2.port, '25367');
    assert.equal(saved.components3D.trellis2.model, 'TRELLIS.2-1536');
    assert.equal(saved.components3D.trellis2.pollIntervalSeconds, 2);
    assert.equal(saved.components3D.trellis2.maxWaitSeconds, 300);
    assert.equal(saved.components3D.trellis2.downloadBaseUrl, 'http://127.0.0.1:25367');
    assert.equal(saved.components3D.hunyuan.baseUrl, 'https://ai3d.tencentcloudapi.com');
    assert.equal(saved.components3D.hunyuan.secretId, 'AKID-user');
    assert.equal(saved.components3D.hunyuan.secretKey, 'secret-user');
    assert.equal(saved.components3D.hunyuan.region, 'ap-shanghai');

    assert.deepEqual(
      JSON.parse(await readFile(path.join(rootDir, aliceId, 'api_config.json'), 'utf8')),
      saved,
    );
    assert.deepEqual(
      JSON.parse(await readFile(path.join(rootDir, aliceId, 'codex_auth.json'), 'utf8')),
      { OPENAI_API_KEY: 'sk-codex-from-api-config' },
    );
    assert.deepEqual(await storage.getUserApiConfig('alice'), saved);
    assert.equal((await storage.getUserApiConfig('bob')).userId, bobId);
    assert.equal((await storage.getUserApiConfig('bob')).components3D.provider, 'mocked');

    await assert.rejects(
      () => storage.saveUserApiConfig({
        user: 'alice',
        config: {
          components3D: {
            provider: 'trellis.2',
            trellis2: {
              host: '127.0.0.1',
              port: '99999',
            },
          },
        },
      }),
      (error) => error instanceof ProjectStorageError && error.code === 'BAD_REQUEST',
    );
    assert.deepEqual(await storage.getUserApiConfig('alice'), saved);
    const preservedSecret = await storage.saveUserApiConfig({
      user: 'alice',
      config: {
        pipelineApi: {
          apiKey: '',
          apiBase: 'https://api.other.test',
        },
      },
    });
    assert.equal(preservedSecret.pipelineApi.apiKey, 'sk-apiyi-from-api-config');
    assert.equal(preservedSecret.codex.apiKey, 'sk-codex-from-api-config');
    assert.equal(preservedSecret.components3D.provider, 'trellis.2');
    assert.equal(preservedSecret.components3D.hunyuan.secretKey, 'secret-user');
    const redacted = redactUserApiConfigForClient(preservedSecret);
    assert.equal(redacted.pipelineApi.apiKey, '');
    assert.equal(redacted.pipelineApi.hasApiKey, true);
    assert.equal(redacted.components3D.hunyuan.secretKey, '');
    assert.equal(redacted.components3D.hunyuan.hasSecretKey, true);
  } finally {
    await cleanup();
  }
});

test('soft deletes projects, hides them from lists, and preserves directories until sweep', async () => {
  const { rootDir, storage, cleanup } = await createTempStorage();
  try {
    const aliceProject = await storage.createProject({ user: 'alice', name: 'Scene A' });
    await storage.createProject({ user: 'alice', name: 'Scene B' });
    await storage.createProject({ user: 'bob', name: 'Scene C' });
    const aliceId = normalizeUserIdentity('alice').userId;
    const projectDir = path.join(rootDir, aliceId, aliceProject.id);
    const trashedDir = path.join(rootDir, aliceId, `${aliceProject.id}.bak`);

    const users = await storage.listUsers();
    assert.equal(users.length, 2);
    assert.ok(users.some((user) => user.user === 'alice' && user.projectCount === 2));
    assert.ok(users.some((user) => user.user === 'bob' && user.projectCount === 1));

    const deleted = await storage.deleteProject('alice', aliceProject.id);
    assert.equal(deleted.lifecycleState, 'trashed');
    assert.equal(deleted.userId, aliceId);
    await assert.rejects(() => stat(projectDir), /ENOENT/);
    await stat(trashedDir);
    const { entry, entryPath: queuePath } = await readDeletionQueueEntry(rootDir, aliceId, aliceProject.id);
    assert.equal(entry.trashedDirName, `${aliceProject.id}.bak`);
    await stat(queuePath);

    const metadata = JSON.parse(await readFile(path.join(trashedDir, 'project.json'), 'utf8'));
    assert.equal(metadata.lifecycleState, 'trashed');
    assert.equal(typeof metadata.trashedAt, 'string');
    assert.equal(typeof metadata.purgeAfter, 'string');

    const aliceProjects = await storage.listProjects('alice');
    assert.equal(aliceProjects.length, 1);
    assert.equal(aliceProjects[0]?.name, 'Scene B');
    const nextUsersAfterSoftDelete = await storage.listUsers();
    assert.ok(nextUsersAfterSoftDelete.some((user) => user.user === 'alice' && user.projectCount === 1));

    const secondDelete = await storage.deleteProject('alice', aliceProject.id);
    assert.equal(secondDelete.lifecycleState, 'trashed');
    assert.equal(secondDelete.purgeAfter, deleted.purgeAfter);

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

test('trashed projects reject normal project operations', async () => {
  const { storage, cleanup } = await createTempStorage();
  try {
    const project = await storage.createProject({
      user: 'alice',
      name: 'Hidden Project',
      scene: { version: 2, assets: [] },
    });
    await storage.deleteProject('alice', project.id);
    const content = new TextEncoder().encode('bytes');

    const expectNotFound = (error: unknown) => error instanceof ProjectStorageError && error.code === 'NOT_FOUND';
    await assert.rejects(() => storage.getProject('alice', project.id), expectNotFound);
    await assert.rejects(() => storage.resolveProjectDir('alice', project.id), expectNotFound);
    await assert.rejects(() => storage.readScene('alice', project.id), expectNotFound);
    await assert.rejects(() => storage.saveScene({ user: 'alice', projectId: project.id, payload: {} }), expectNotFound);
    await assert.rejects(() => storage.readAgentHistory('alice', project.id), expectNotFound);
    await assert.rejects(
      () => storage.saveAgentHistory({ user: 'alice', projectId: project.id, payload: {} }),
      expectNotFound,
    );
    await assert.rejects(
      () => storage.writeAsset({ user: 'alice', projectId: project.id, relativePath: 'assets/a.bin', content }),
      expectNotFound,
    );
    await assert.rejects(() => storage.readAsset('alice', project.id, 'assets/a.bin'), expectNotFound);
    await assert.rejects(() => storage.listAssetIndex('alice', project.id), expectNotFound);
    await assert.rejects(
      () => storage.renameProject({ user: 'alice', projectId: project.id, name: 'New Name' }),
      expectNotFound,
    );
    await assert.rejects(() => storage.readProjectCodexApiKey('alice', project.id), expectNotFound);
  } finally {
    await cleanup();
  }
});

test('trashed project directories use .bak names so the same project name can be recreated', async () => {
  const { rootDir, storage, cleanup } = await createTempStorage({ deletionRetentionMs: 60_000 });
  try {
    const project = await storage.createProject({ user: 'alice', name: 'Reusable Name' });
    const userId = normalizeUserIdentity('alice').userId;
    const activeDir = path.join(rootDir, userId, project.id);
    const trashedDir = path.join(rootDir, userId, `${project.id}.bak`);

    await storage.deleteProject('alice', project.id);
    await assert.rejects(() => stat(activeDir), /ENOENT/);
    await stat(trashedDir);

    const validation = await storage.validateProjectNameAvailability({
      user: 'alice',
      name: 'Reusable Name',
    });
    assert.equal(validation.projectId, project.id);
    assert.equal(validation.hasTrashedBackup, true);

    const replacement = await storage.createProject({ user: 'alice', name: 'Reusable Name' });
    assert.equal(replacement.id, project.id);
    await stat(activeDir);
    await stat(trashedDir);

    const sweep = await storage.sweepDeletedProjects(new Date(Date.now() + 120_000));
    assert.equal(sweep.deleted, 1);
    await stat(activeDir);
    await assert.rejects(() => stat(trashedDir), /ENOENT/);
  } finally {
    await cleanup();
  }
});

test('deletion sweep skips future entries and purges due projects', async () => {
  const { rootDir, storage, cleanup } = await createTempStorage({ deletionRetentionMs: 60_000 });
  try {
    const project = await storage.createProject({ user: 'alice', name: 'Future Delete' });
    const userId = normalizeUserIdentity('alice').userId;
    const projectDir = path.join(rootDir, userId, project.id);
    const trashedDir = path.join(rootDir, userId, `${project.id}.bak`);

    await storage.deleteProject('alice', project.id);
    const { entryPath: queuePath } = await readDeletionQueueEntry(rootDir, userId, project.id);
    const skipped = await storage.sweepDeletedProjects(new Date());
    assert.equal(skipped.scanned, 1);
    assert.equal(skipped.skipped, 1);
    assert.equal(skipped.deleted, 0);
    await assert.rejects(() => stat(projectDir), /ENOENT/);
    await stat(trashedDir);
    await stat(queuePath);

    const deleted = await storage.sweepDeletedProjects(new Date(Date.now() + 120_000));
    assert.equal(deleted.scanned, 1);
    assert.equal(deleted.deleted, 1);
    await assert.rejects(() => stat(trashedDir), /ENOENT/);
    await assert.rejects(() => stat(queuePath), /ENOENT/);
  } finally {
    await cleanup();
  }
});

test('deletion sweep can finish when project metadata is already missing', async () => {
  const { rootDir, storage, cleanup } = await createTempStorage({ deletionRetentionMs: 0 });
  try {
    const project = await storage.createProject({ user: 'alice', name: 'Missing Metadata' });
    const userId = normalizeUserIdentity('alice').userId;
    const trashedDir = path.join(rootDir, userId, `${project.id}.bak`);

    await storage.deleteProject('alice', project.id);
    const { entryPath: queuePath } = await readDeletionQueueEntry(rootDir, userId, project.id);
    await rm(path.join(trashedDir, 'project.json'), { force: true });
    await stat(queuePath);

    const result = await storage.sweepDeletedProjects(new Date(Date.now() + 1));
    assert.equal(result.deleted, 1);
    await assert.rejects(() => stat(trashedDir), /ENOENT/);
    await assert.rejects(() => stat(queuePath), /ENOENT/);
  } finally {
    await cleanup();
  }
});

test('deletion sweep keeps queue entries for retry when physical removal fails', async () => {
  const { rootDir, storage, cleanup } = await createTempStorage({ deletionRetentionMs: 0 });
  const userId = normalizeUserIdentity('alice').userId;
  const userDir = path.join(rootDir, userId);
  try {
    const project = await storage.createProject({ user: 'alice', name: 'Retry Delete' });
    const projectDir = path.join(userDir, project.id);
    const trashedDir = path.join(userDir, `${project.id}.bak`);

    await storage.deleteProject('alice', project.id);
    const { entryPath: queuePath } = await readDeletionQueueEntry(rootDir, userId, project.id);
    await chmod(userDir, 0o500);

    const result = await storage.sweepDeletedProjects(new Date(Date.now() + 1));
    assert.equal(result.scanned, 1);
    assert.equal(result.deleted, 0);
    assert.equal(result.failed, 1);
    await assert.rejects(() => stat(projectDir), /ENOENT/);
    await stat(trashedDir);
    await stat(queuePath);
    assert.deepEqual(await storage.listProjects('alice'), []);

    const queue = JSON.parse(await readFile(queuePath, 'utf8'));
    assert.equal(queue.state, 'deleting');
    assert.equal(queue.retryCount, 1);
    assert.equal(typeof queue.lastError, 'string');
  } finally {
    await chmod(userDir, 0o700).catch(() => undefined);
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
