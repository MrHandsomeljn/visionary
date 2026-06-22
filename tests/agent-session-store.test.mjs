import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { AgentSessionStore } from '../src/editor/agent-session-store.js';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

class MockWritable {
    constructor(target) {
        this.target = target;
        this.buffer = new Uint8Array(0);
    }

    async write(input) {
        const chunk = typeof input === 'string'
            ? textEncoder.encode(input)
            : input instanceof Uint8Array
                ? input
                : new Uint8Array(input);
        const merged = new Uint8Array(this.buffer.length + chunk.length);
        merged.set(this.buffer, 0);
        merged.set(chunk, this.buffer.length);
        this.buffer = merged;
    }

    async close() {
        this.target.content = this.buffer;
    }
}

class MockFileHandle {
    constructor(target) {
        this.target = target;
    }

    async getFile() {
        return {
            text: async () => textDecoder.decode(this.target.content),
            arrayBuffer: async () => this.target.content.buffer.slice(
                this.target.content.byteOffset,
                this.target.content.byteOffset + this.target.content.byteLength
            ),
        };
    }

    async createWritable() {
        return new MockWritable(this.target);
    }
}

class MockDirectoryHandle {
    constructor(name, basePath = '', directories = new Map(), files = new Map()) {
        this.name = name;
        this.basePath = basePath;
        this.directories = directories;
        this.files = files;
    }

    resolvePath(entryName) {
        return this.basePath ? `${this.basePath}/${entryName}` : entryName;
    }

    async getDirectoryHandle(directoryName, options = {}) {
        const path = this.resolvePath(directoryName);
        if (!this.directories.has(path)) {
            if (!options.create) {
                throw new Error(`Directory not found: ${path}`);
            }
            this.directories.set(path, true);
        }
        return new MockDirectoryHandle(directoryName, path, this.directories, this.files);
    }

    async getFileHandle(fileName, options = {}) {
        const path = this.resolvePath(fileName);
        let target = this.files.get(path);
        if (!target) {
            if (!options.create) {
                throw new Error(`File not found: ${path}`);
            }
            target = { content: new Uint8Array(0) };
            this.files.set(path, target);
        }
        return new MockFileHandle(target);
    }

    getFileContent(path) {
        const target = this.files.get(path);
        return target ? textDecoder.decode(target.content) : null;
    }
}

test('AgentSessionStore persists workspace agent history as a single json plus hashed assets', async () => {
    const store = new AgentSessionStore();
    const workspaceRoot = new MockDirectoryHandle('workspace');
    store.bindWorkspaceRoot(workspaceRoot);

    const snapshot = {
        version: 2,
        savedAt: '2026-04-12T00:00:00.000Z',
        stepStates: {
            'session-1:attempt-1:main-image': {
                sessionId: 'session-1',
                attemptId: 'attempt-1',
                blockId: 'progress-1',
                stepKey: 'main-image',
                images: [
                    {
                        id: 'main-image-1',
                        title: '主图 1',
                        assetPath: 'agent_history/assets/new_pipeline/manual/run/main_images/image_001.png',
                        relativePath: 'agent_history/assets/new_pipeline/manual/run/main_images/image_001.png',
                        mimeType: 'image/png',
                        bytes: 123,
                    },
                ],
                selectedIndex: 0,
                applied: true,
                actions: [],
                isCurrent: false,
                expanded: true,
            },
        },
        pipelineStates: {
            'session-1:attempt-1': {
                kind: 'scene-skill',
                sessionId: 'session-1',
                attemptId: 'attempt-1',
                status: 'ready',
                currentStepKey: 'front-view',
                lastAppliedStepKey: 'main-image',
                autoContinue: true,
                steps: {
                    'main-image': { status: 'applied' },
                    'front-view': { status: 'ready' },
                },
            },
        },
        workflows: [
            {
                workflow: 'scene-build',
                label: '场景',
                items: [
                    {
                        id: 'msg-user-1',
                        kind: 'message',
                        role: 'user',
                        workflow: 'scene-build',
                        text: '帮我生成这个场景',
                        attachments: [
                            {
                                id: 'attachment-1',
                                name: 'reference.png',
                                type: 'image/png',
                                dataUrl: 'data:image/png;base64,SGVsbG8=',
                            },
                        ],
                        createdAt: '2026-04-12T00:00:01.000Z',
                        updatedAt: '2026-04-12T00:00:01.000Z',
                    },
                    {
                        id: 'session-1',
                        kind: 'session',
                        workflow: 'scene-build',
                        prompt: '帮我生成这个场景',
                        attachments: [],
                        attempts: [
                            {
                                id: 'attempt-1',
                                workflow: 'scene-build',
                                text: '请查看当前结果，并确认是否应用。',
                                status: 'complete',
                                createdAt: '2026-04-12T00:00:02.000Z',
                                updatedAt: '2026-04-12T00:00:03.000Z',
                                blocks: [
                                    {
                                        id: 'progress-1',
                                        type: 'progress',
                                        stepKey: 'main-image',
                                        title: '场景构建中',
                                        status: 'complete',
                                        statusText: '已完成',
                                        value: 1,
                                    },
                                    {
                                        id: 'image-1',
                                        type: 'image',
                                        title: '场景草图',
                                        status: 'ready',
                                        alt: '场景草图预览',
                                        src: 'data:image/png;base64,V29ybGQ=',
                                    },
                                ],
                                steps: [
                                    {
                                        id: 'progress-1',
                                        type: 'progress',
                                        stepKey: 'main-image',
                                        title: '主图生成',
                                        statusText: '已完成',
                                        value: 1,
                                        applied: true,
                                        isCurrent: false,
                                        expanded: true,
                                        images: [
                                            {
                                                id: 'main-image-1',
                                                title: '主图 1',
                                                assetPath: 'agent_history/assets/new_pipeline/manual/run/main_images/image_001.png',
                                                relativePath: 'agent_history/assets/new_pipeline/manual/run/main_images/image_001.png',
                                                src: 'mock://runtime-url',
                                                mimeType: 'image/png',
                                                bytes: 123,
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                        activeAttemptIndex: 0,
                        archiveState: 'applied',
                        collapsed: true,
                        archiveSummary: {
                            label: '已应用',
                            thumbnailUrl: '',
                            note: '',
                        },
                        createdAt: '2026-04-12T00:00:02.000Z',
                        updatedAt: '2026-04-12T00:00:03.000Z',
                    },
                ],
            },
        ],
    };

    await store.persistSnapshot(snapshot);

    const rawJson = workspaceRoot.getFileContent('agent_history.json');
    assert.ok(rawJson, 'agent_history.json should be written');
    const persisted = JSON.parse(rawJson);

    assert.equal(persisted.schema, 'visionary.agent_history');
    assert.equal(persisted.storageMode, 'workspace');
    assert.equal(persisted.assetRoot, 'agent_history');
    assert.deepEqual(persisted.stepStates?.['session-1:attempt-1:main-image'], snapshot.stepStates['session-1:attempt-1:main-image']);
    assert.deepEqual(persisted.pipelineStates?.['session-1:attempt-1'], snapshot.pipelineStates['session-1:attempt-1']);
    assert.equal(Array.isArray(persisted.references?.links), true);
    assert.equal(persisted.workflows.length, 1);
    assert.equal(persisted.workflows[0].workflow, 'scene-build');
    assert.equal(persisted.workflows[0].label, '场景');
    const persistedSteps = persisted.workflows[0].items[1].attempts[0].steps;
    assert.equal(persistedSteps.length, 1);
    assert.equal(persistedSteps[0].stepKey, 'main-image');
    assert.equal(persistedSteps[0].images[0].src, undefined);
    assert.equal(persistedSteps[0].images[0].assetPath, 'agent_history/assets/new_pipeline/manual/run/main_images/image_001.png');

    const openaiMessages = persisted.openai_conversation?.data || [];
    assert.equal(openaiMessages.length, 2);
    assert.equal(openaiMessages[0].type, 'message');
    assert.equal(openaiMessages[0].role, 'user');
    assert.equal(openaiMessages[1].role, 'assistant');
    assert.equal(openaiMessages[1].content.some((item) => item.type === 'visionary_progress'), true);
    assert.equal(openaiMessages[1].content.some((item) => item.type === 'visionary_output_image'), true);

    const assetIndex = persisted.asset_index || [];
    assert.equal(assetIndex.length, 2);
    assert.equal(assetIndex.every((entry) => String(entry.path || '').startsWith('agent_history/')), true);

    for (const entry of assetIndex) {
        assert.ok(workspaceRoot.getFileContent(entry.path) !== null, `asset should exist: ${entry.path}`);
    }
});

test('AgentSessionStore exportSnapshot can emit uploadable agent_history asset payloads without bound workspace', async () => {
    const store = new AgentSessionStore();

    const snapshot = {
        version: 2,
        savedAt: '2026-04-17T00:00:00.000Z',
        workflows: [
            {
                workflow: 'scene-build',
                label: '场景',
                items: [
                    {
                        id: 'message-1',
                        kind: 'message',
                        role: 'user',
                        workflow: 'scene-build',
                        text: '参考图',
                        attachments: [
                            {
                                id: 'attachment-1',
                                name: 'reference.png',
                                type: 'image/png',
                                dataUrl: 'data:image/png;base64,SGVsbG8=',
                            },
                        ],
                        createdAt: '2026-04-17T00:00:01.000Z',
                        updatedAt: '2026-04-17T00:00:01.000Z',
                    },
                    {
                        id: 'session-1',
                        kind: 'session',
                        workflow: 'scene-build',
                        prompt: '生成结果',
                        attachments: [],
                        attempts: [
                            {
                                id: 'attempt-1',
                                workflow: 'scene-build',
                                text: '请查看结果',
                                status: 'complete',
                                createdAt: '2026-04-17T00:00:02.000Z',
                                updatedAt: '2026-04-17T00:00:03.000Z',
                                blocks: [
                                    {
                                        id: 'image-1',
                                        type: 'image',
                                        title: '场景草图',
                                        status: 'ready',
                                        alt: '场景草图预览',
                                        src: 'data:image/png;base64,V29ybGQ=',
                                    },
                                ],
                            },
                        ],
                        activeAttemptIndex: 0,
                        archiveState: 'applied',
                        collapsed: true,
                        archiveSummary: {
                            label: '已应用',
                            thumbnailUrl: '',
                            note: '',
                        },
                        createdAt: '2026-04-17T00:00:02.000Z',
                        updatedAt: '2026-04-17T00:00:03.000Z',
                    },
                ],
            },
        ],
    };

    const exported = await store.exportSnapshot(snapshot, {
        includeAssets: true,
        includeAssetPayloads: true,
    });

    assert.equal(exported.snapshot.schema, 'visionary.agent_history');
    assert.equal(exported.snapshot.storageMode, 'detached');
    assert.equal(Array.isArray(exported.snapshot.asset_index), true);
    assert.equal(Array.isArray(exported.assetPayloads), true);
    assert.equal(exported.assetPayloads.length, 2);
    assert.equal(exported.assetPayloads.every((entry) => String(entry.path || '').startsWith('agent_history/')), true);
    assert.equal(exported.assetPayloads.every((entry) => entry.content instanceof Uint8Array), true);
    assert.deepEqual(
        exported.assetPayloads.map((entry) => entry.path).sort(),
        exported.snapshot.asset_index.map((entry) => entry.path).sort(),
    );
});

test('AgentSessionStore emits debug logs around agent history writes', () => {
    const source = readFileSync(new URL('../src/editor/agent-session-store.js', import.meta.url), 'utf8');

    assert.match(source, /this\.debugLog\('persistSnapshot:start'/);
    assert.match(source, /this\.debugLog\('persistSnapshot:file:start'/);
    assert.match(source, /this\.debugLog\('persistSnapshot:file:complete'/);
    assert.match(source, /this\.debugLog\('persistNormalizedAsset:file:start'/);
    assert.match(source, /this\.debugLog\('persistNormalizedAsset:file:complete'/);
});
