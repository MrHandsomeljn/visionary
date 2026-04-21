import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EditorWorkspaceStore,
  type WorkspaceSaveState,
} from '../src/app/editor-workspace-store.ts';
import { SceneFS, type SceneManifest } from '../src/app/scene-fs.ts';
import { createWorkspaceSnapshot } from '../src/app/workspace-snapshot.ts';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function createStore(overrides?: {
  persistSnapshot?: (snapshot: ReturnType<typeof createWorkspaceSnapshot>) => Promise<void>;
}) {
  let revision = 0;
  return new EditorWorkspaceStore({
    buildSnapshot: (reason) =>
      createWorkspaceSnapshot({
        revision: ++revision,
        reason,
      }),
    persistSnapshot: overrides?.persistSnapshot ?? (async () => {}),
  });
}

test('store starts clean without workspace handle', () => {
  const store = createStore();
  const state = store.getState();

  const expected: WorkspaceSaveState = {
    workspaceHandle: null,
    dirty: false,
    saving: false,
    saveQueued: false,
    error: null,
  };

  assert.deepEqual(state, expected);
});

test('markDirty queues one autosave and does not run concurrent saves', async () => {
  const firstSave = createDeferred<void>();
  const calls: Array<ReturnType<typeof createWorkspaceSnapshot>> = [];

  const store = createStore({
    persistSnapshot: async (snapshot) => {
      calls.push(snapshot);
      if (calls.length === 1) {
        await firstSave.promise;
      }
    },
  });

  store.markDirty('first-change');
  store.markDirty('second-change');
  assert.equal(calls.length, 0);
  assert.equal(store.getState().saveQueued, true);

  await flushMicrotasks();
  assert.equal(calls.length, 1);
  assert.equal(store.getState().saving, true);

  store.markDirty('third-change');
  store.markDirty('latest-change');
  await flushMicrotasks();
  assert.equal(calls.length, 1);

  firstSave.resolve();
  await store.whenIdle();

  assert.equal(calls.length, 2);
  assert.equal(calls[1].reason, 'latest-change');
});

test('successful save returns state to clean', async () => {
  const calls: Array<ReturnType<typeof createWorkspaceSnapshot>> = [];
  const store = createStore({
    persistSnapshot: async (snapshot) => {
      calls.push(snapshot);
    },
  });

  store.markDirty('success');
  await store.whenIdle();

  assert.equal(calls.length, 1);
  assert.equal(store.getState().dirty, false);
  assert.equal(store.getState().saving, false);
  assert.equal(store.getState().error, null);
  assert.equal(store.getState().saveQueued, false);
});

test('failed save keeps dirty state and stores error', async () => {
  const store = createStore({
    persistSnapshot: async () => {
      throw new Error('disk write failed');
    },
  });

  store.markDirty('failure');
  await store.whenIdle();

  const state = store.getState();
  assert.equal(state.dirty, true);
  assert.equal(state.saving, false);
  assert.equal(state.saveQueued, false);
  assert.match(state.error ?? '', /disk write failed/);
});

type MockWriteTarget = { content: Uint8Array };

class MockWritable {
  private buffer = new Uint8Array(0);
  constructor(
    private readonly target: MockWriteTarget,
    private readonly onClose: () => void
  ) {}
  async write(input: string | Uint8Array | ArrayBuffer): Promise<void> {
    const chunk =
      typeof input === 'string'
        ? textEncoder.encode(input)
        : input instanceof Uint8Array
          ? input
          : new Uint8Array(input);
    const merged = new Uint8Array(this.buffer.length + chunk.length);
    merged.set(this.buffer, 0);
    merged.set(chunk, this.buffer.length);
    this.buffer = merged;
  }
  async close(): Promise<void> {
    this.target.content = this.buffer;
    this.onClose();
  }
}

class MockFileHandle {
  constructor(
    private readonly target: MockWriteTarget,
    private readonly onClose: () => void
  ) {}
  async getFile(): Promise<{ text: () => Promise<string>; arrayBuffer: () => Promise<ArrayBuffer> }> {
    return {
      text: async () => textDecoder.decode(this.target.content),
      arrayBuffer: async () => this.target.content.buffer.slice(
        this.target.content.byteOffset,
        this.target.content.byteOffset + this.target.content.byteLength
      ),
    };
  }
  async createWritable(): Promise<MockWritable> {
    return new MockWritable(this.target, this.onClose);
  }
}

class MockDirectoryHandle {
  readonly kind = 'directory';
  private readonly directories: Map<string, true>;
  private readonly files: Map<string, MockWriteTarget>;
  readonly writeOrder: string[];
  constructor(
    public readonly name: string,
    private permission: PermissionState = 'granted',
    private readonly basePath = '',
    directories?: Map<string, true>,
    files?: Map<string, MockWriteTarget>,
    writeOrder?: string[]
  ) {
    this.directories = directories ?? new Map<string, true>();
    this.files = files ?? new Map<string, MockWriteTarget>();
    this.writeOrder = writeOrder ?? [];
  }

  private resolvePath(entryName: string): string {
    return this.basePath ? `${this.basePath}/${entryName}` : entryName;
  }

  async queryPermission(): Promise<PermissionState> {
    return this.permission;
  }
  async requestPermission(): Promise<PermissionState> {
    return this.permission;
  }
  async getDirectoryHandle(
    directoryName: string,
    options?: { create?: boolean }
  ): Promise<MockDirectoryHandle> {
    const path = this.resolvePath(directoryName);
    if (!this.directories.has(path)) {
      if (!options?.create) {
        throw new Error(`Directory not found: ${path}`);
      }
      this.directories.set(path, true);
    }
    return new MockDirectoryHandle(
      directoryName,
      this.permission,
      path,
      this.directories,
      this.files,
      this.writeOrder
    );
  }
  async getFileHandle(
    fileName: string,
    options?: { create?: boolean }
  ): Promise<MockFileHandle> {
    const path = this.resolvePath(fileName);
    let target = this.files.get(path);
    if (!target) {
      if (!options?.create) {
        throw new Error(`File not found: ${path}`);
      }
      target = { content: new Uint8Array(0) };
      this.files.set(path, target);
    }
    return new MockFileHandle(target, () => this.writeOrder.push(path));
  }
  setFileContent(fileName: string, content: string): void {
    this.files.set(fileName, { content: textEncoder.encode(content) });
  }
  getFileContent(fileName: string): string | null {
    const target = this.files.get(fileName);
    if (!target) return null;
    return textDecoder.decode(target.content);
  }
  getFileBytes(fileName: string): Uint8Array | null {
    return this.files.get(fileName)?.content ?? null;
  }
  countWrites(fileName: string): number {
    return this.writeOrder.filter((entry) => entry === fileName).length;
  }
}

function createSceneManifest(label: string): SceneManifest {
  return {
    version: 1,
    meta: {
      app: 'test',
      createdAt: `2026-04-11T00:00:00.000Z-${label}`,
      unit: 'meter',
    },
    env: {
      bgColor: [0, 0, 0, 1],
      gaussianScale: 1,
    },
    assets: [],
  };
}

test('workspace metadata reflects selected writable workspace', async () => {
  const directory = new MockDirectoryHandle('workspace-A');
  (globalThis as any).window = {
    showDirectoryPicker: async () => directory,
  };

  const sceneFs = new SceneFS();
  await sceneFs.openWorkspaceReadWrite();
  const workspace = sceneFs.getWorkspaceInfo();

  assert.deepEqual(workspace, {
    name: 'workspace-A',
    permission: 'readwrite',
    writable: true,
  });
});

test('saveWorkspaceSnapshot writes temp manifest before scene.json commit', async () => {
  const directory = new MockDirectoryHandle('workspace-B');
  (globalThis as any).window = {
    showDirectoryPicker: async () => directory,
  };

  const sceneFs = new SceneFS();
  await sceneFs.openWorkspaceReadWrite();
  const token = await sceneFs.writeTempSceneManifest(createSceneManifest('next'));
  await sceneFs.commitSceneManifest(token);

  assert.deepEqual(directory.writeOrder, ['scene.json.tmp', 'scene.json']);
  assert.equal(directory.getFileContent('scene.json'), directory.getFileContent('scene.json.tmp'));
  assert.equal(directory.getFileContent('scene.json.tmp') !== null, true);
  assert.equal(directory.getFileContent('scene.json') !== null, true);
});

test('writing only temp manifest keeps existing scene.json unchanged', async () => {
  const directory = new MockDirectoryHandle('workspace-C');
  const existing = JSON.stringify(createSceneManifest('old'), null, 2);
  directory.setFileContent('scene.json', existing);
  (globalThis as any).window = {
    showDirectoryPicker: async () => directory,
  };

  const sceneFs = new SceneFS();
  await sceneFs.openWorkspaceReadWrite();
  await sceneFs.writeTempSceneManifest(createSceneManifest('new'));

  assert.equal(directory.getFileContent('scene.json'), existing);
  assert.equal(directory.getFileContent('scene.json.tmp') !== null, true);
});

test('commit replaces old scene.json with the current temp snapshot', async () => {
  const directory = new MockDirectoryHandle('workspace-D');
  directory.setFileContent('scene.json', JSON.stringify(createSceneManifest('very-old'), null, 2));
  (globalThis as any).window = {
    showDirectoryPicker: async () => directory,
  };

  const sceneFs = new SceneFS();
  await sceneFs.openWorkspaceReadWrite();

  const nextManifest = createSceneManifest('fresh');
  const token = await sceneFs.writeTempSceneManifest(nextManifest);
  await sceneFs.commitSceneManifest(token);

  const saved = directory.getFileContent('scene.json');
  const expected = JSON.stringify(nextManifest, null, 2);
  assert.equal(saved, expected);
  assert.notEqual(saved, JSON.stringify(createSceneManifest('very-old'), null, 2));
});

test('standalone commit without matching token does not flush stale tmp', async () => {
  const directory = new MockDirectoryHandle('workspace-E');
  const oldManifest = createSceneManifest('old-stable');
  const staleTmpManifest = createSceneManifest('stale-tmp');
  directory.setFileContent('scene.json', JSON.stringify(oldManifest, null, 2));
  directory.setFileContent('scene.json.tmp', JSON.stringify(staleTmpManifest, null, 2));
  (globalThis as any).window = {
    showDirectoryPicker: async () => directory,
  };

  const sceneFs = new SceneFS();
  await sceneFs.openWorkspaceReadWrite();

  await assert.rejects(
    () => sceneFs.commitSceneManifest('missing-or-stale-token'),
    /stale|token|commit/i
  );
  assert.equal(directory.getFileContent('scene.json'), JSON.stringify(oldManifest, null, 2));
});

test('asset plan hashes content, rewrites manifest path, and skips duplicate writes', async () => {
  const directory = new MockDirectoryHandle('workspace-F');
  (globalThis as any).window = {
    showDirectoryPicker: async () => directory,
  };

  const sceneFs = new SceneFS();
  await sceneFs.openWorkspaceReadWrite();

  const manifest = createSceneManifest('asset-first');
  manifest.assets.push({
    name: 'sample-model.ply',
    type: 'ply',
    path: 'uploads/sample-model.ply',
  });

  const content = textEncoder.encode('same-content-for-hash');
  const expectedHash = sceneFs.computeAssetContentHash(content);
  const expectedPath = `assets/${expectedHash}.ply`;

  const first = await sceneFs.saveWorkspaceSnapshot(manifest, {
    assets: [
      {
        sourcePath: 'uploads/sample-model.ply',
        content,
      },
    ],
  });

  assert.equal(first.assetWrites.length, 1);
  assert.equal(first.assetWrites[0]?.hash, expectedHash);
  assert.equal(first.assetWrites[0]?.targetPath, expectedPath);
  assert.equal(first.assetWrites[0]?.skipped, false);

  const secondManifest = createSceneManifest('asset-second');
  secondManifest.assets.push({
    name: 'sample-model.ply',
    type: 'ply',
    path: 'uploads/sample-model.ply',
  });

  const second = await sceneFs.saveWorkspaceSnapshot(secondManifest, {
    assets: [
      {
        sourcePath: 'uploads/sample-model.ply',
        content,
      },
    ],
  });

  assert.equal(second.assetWrites.length, 1);
  assert.equal(second.assetWrites[0]?.targetPath, expectedPath);
  assert.equal(second.assetWrites[0]?.skipped, true);
  assert.equal(directory.countWrites(expectedPath), 1);

  const persistedManifest = JSON.parse(directory.getFileContent('scene.json') ?? '{}') as SceneManifest;
  assert.equal(persistedManifest.assets[0]?.path, expectedPath);
  assert.deepEqual(directory.getFileBytes(expectedPath), content);
});
