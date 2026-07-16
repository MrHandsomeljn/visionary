import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  aggregateComponents3DStatus,
  cancelComponents3DExecutions,
  cancelComponents3DTrellisJob,
  collectComponents3DTrellisFailureDiagnostics,
  generateComponents3D,
  pollCompatible3DProviderJob,
  type Components3DAssetProgressItem,
  type Components3DAssetProgressSnapshot,
} from '../src/server/mcp/new-pipeline-components-3d-server.ts';
import type { Components3DEndpointConfig, Components3DGenerationConfig } from '../src/server/components-3d-config.ts';
import { CodexAgentRuntime, type CodexAgentTaskState } from '../src/server/codex-agent-runtime.ts';
import { ProjectStorage } from '../src/server/project-storage.ts';

function minimalGlbBuffer(label: string): Uint8Array {
  const json = Buffer.from(JSON.stringify({ asset: { version: '2.0', generator: label } }), 'utf8');
  const padding = (4 - (json.length % 4)) % 4;
  const jsonChunk = Buffer.concat([json, Buffer.alloc(padding, 0x20)]);
  const buffer = Buffer.alloc(20 + jsonChunk.length);
  buffer.write('glTF', 0, 'ascii');
  buffer.writeUInt32LE(2, 4);
  buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(jsonChunk.length, 12);
  buffer.write('JSON', 16, 'ascii');
  jsonChunk.copy(buffer, 20);
  return new Uint8Array(buffer);
}

function trellisConfig(overrides: Partial<Components3DEndpointConfig> = {}): Components3DEndpointConfig {
  return {
    host: 'trellis.test',
    port: '443',
    baseUrl: 'https://trellis.test',
    secretId: '',
    secretKey: '',
    region: '',
    version: '',
    model: 'TRELLIS.2-1024',
    pollIntervalSeconds: 0.2,
    maxWaitSeconds: 1,
    callbackUrl: '',
    downloadBaseUrl: '',
    ...overrides,
  };
}

function progressItem(status: Components3DAssetProgressItem['status']): Components3DAssetProgressItem {
  return {
    assetId: status,
    ordinal: 1,
    label: status,
    modelName: status,
    jobId: `job-${status}`,
    status,
    stageKey: '',
    stageIndex: null,
    stageCount: null,
    stageProgress: null,
    stageProgressEstimated: false,
    progress: 0,
    message: '',
    updatedAt: '2026-07-14T00:00:00.000Z',
  };
}

test('TRELLIS aggregate status distinguishes queued, active, and timed-out work', () => {
  assert.equal(aggregateComponents3DStatus([progressItem('queued'), progressItem('queued')], 'trellis.2'), 'queuing');
  assert.equal(aggregateComponents3DStatus([progressItem('done'), progressItem('queued')], 'trellis.2'), 'queuing');
  assert.equal(aggregateComponents3DStatus([progressItem('queued'), progressItem('running')], 'trellis.2'), 'running');
  assert.equal(aggregateComponents3DStatus([progressItem('TLE'), progressItem('running')], 'trellis.2'), 'running');
  assert.equal(aggregateComponents3DStatus([progressItem('TLE'), progressItem('done')], 'trellis.2'), 'TLE');
  assert.equal(aggregateComponents3DStatus([progressItem('queued')], 'hunyuan'), 'running');
});

test('TRELLIS polling renews its deadline on observable progress', { timeout: 5_000 }, async () => {
  const previousFetch = globalThis.fetch;
  const queryCounts = new Map<string, number>();
  try {
    globalThis.fetch = (async (_resource, init) => {
      const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
      const jobId = String(body.JobId || '');
      const count = (queryCounts.get(jobId) || 0) + 1;
      queryCounts.set(jobId, count);
      const moving = jobId === 'job-moving';
      const done = moving && count >= 7;
      return new Response(JSON.stringify({
        Response: {
          JobId: jobId,
          Status: done ? 'DONE' : 'RUNNING',
          Stage: done ? 'DONE' : 'TEXTURE_GENERATION',
          Progress: done ? 100 : moving ? count : 20,
          StageIndex: done ? 11 : 8,
          StageCount: 11,
          StageProgress: done ? 100 : moving ? count * 10 : 35,
          StageProgressEstimated: !done,
          ...(done ? { ResultFile3Ds: [{ Url: 'https://downloads.test/job-moving.glb' }] } : {}),
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    const [stuck, moving] = await Promise.allSettled([
      pollCompatible3DProviderJob({
        baseUrl: 'https://trellis.test',
        provider: 'trellis.2',
        jobId: 'job-stuck',
        config: trellisConfig(),
      }),
      pollCompatible3DProviderJob({
        baseUrl: 'https://trellis.test',
        provider: 'trellis.2',
        jobId: 'job-moving',
        config: trellisConfig(),
      }),
    ]);

    assert.equal(stuck.status, 'rejected');
    assert.match(stuck.status === 'rejected' ? stuck.reason.message : '', /made no progress for 1s/);
    assert.equal(moving.status, 'fulfilled');
    assert.ok((queryCounts.get('job-moving') || 0) >= 7);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('TRELLIS single-job cancellation sends the documented action', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (resource, init) => {
      assert.equal(String(resource), 'https://trellis.test/');
      assert.equal(new Headers(init?.headers).get('x-tc-action'), 'CancelHunyuanTo3DProJob');
      assert.deepEqual(JSON.parse(String(init?.body || '{}')), {
        JobId: 'job-cancel-me',
        Reason: 'user cancelled',
      });
      return new Response(JSON.stringify({
        Response: {
          JobId: 'job-cancel-me',
          Status: 'RUNNING',
          CancelRequested: true,
          Cancelled: false,
          RequestId: 'req-cancel',
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    const result = await cancelComponents3DTrellisJob({
      config: trellisConfig(),
      jobId: 'job-cancel-me',
      reason: 'user cancelled',
    });
    assert.equal(result.jobId, 'job-cancel-me');
    assert.equal(result.status, 'RUNNING');
    assert.equal(result.cancelRequested, true);
    assert.equal(result.cancelled, false);
    assert.equal(result.requestId, 'req-cancel');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('TRELLIS failure diagnostics capture safe network cause and health snapshots', async () => {
  const previousFetch = globalThis.fetch;
  let probeCount = 0;
  try {
    globalThis.fetch = (async (resource) => {
      probeCount += 1;
      const url = String(resource);
      if (url.endsWith('/health')) {
        return new Response(JSON.stringify({ ok: true, workers_enabled: true, api_key: 'must-redact' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.endsWith('/status')) {
        throw new TypeError('fetch failed', {
          cause: Object.assign(new Error('socket closed'), {
            code: 'ECONNRESET',
            syscall: 'read',
            address: '127.0.0.1',
            port: 25367,
          }),
        });
      }
      throw new Error(`Unexpected diagnostic request: ${url}`);
    }) as typeof fetch;

    const diagnostics = await collectComponents3DTrellisFailureDiagnostics({
      baseUrl: 'http://127.0.0.1:25367',
      jobId: 'job-debug',
      action: 'QueryHunyuanTo3DProJob',
      elapsedMs: 104_000,
      error: new TypeError('fetch failed', {
        cause: Object.assign(new Error('socket closed'), {
          code: 'ECONNRESET',
          errno: -104,
          syscall: 'read',
          address: '127.0.0.1',
          port: 25367,
        }),
      }),
      lastProgress: {
        ...progressItem('queued'),
        stageKey: 'INPUT_RECEIVED',
        stageIndex: 2,
        stageCount: 13,
        stageProgress: 95,
        progress: 0.02,
        message: 'input saved',
      },
    });

    assert.equal(diagnostics.request.action, 'QueryHunyuanTo3DProJob');
    assert.equal(diagnostics.request.jobId, 'job-debug');
    assert.equal(diagnostics.request.elapsedMs, 104_000);
    assert.equal(diagnostics.client.nodeVersion, process.version);
    assert.equal(diagnostics.client.platform, process.platform);
    assert.equal(diagnostics.failure.code, 'ECONNRESET');
    assert.equal(diagnostics.failure.syscall, 'read');
    assert.equal(diagnostics.lastProgress.stageKey, 'INPUT_RECEIVED');
    assert.equal(diagnostics.health.ok, true);
    assert.deepEqual(diagnostics.health.payload, { ok: true, workers_enabled: true });
    assert.equal(diagnostics.status.ok, false);
    assert.equal(diagnostics.status.error, 'fetch failed');

    await collectComponents3DTrellisFailureDiagnostics({
      baseUrl: 'http://127.0.0.1:25367',
      jobId: 'job-debug-2',
      action: 'QueryHunyuanTo3DProJob',
      error: new Error('second failure'),
      lastProgress: progressItem('queued'),
    });
    assert.equal(probeCount, 2);
    assert.doesNotMatch(JSON.stringify(diagnostics), /must-redact/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('TRELLIS query failures persist diagnostics in progress and model index', { timeout: 5_000 }, async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'visionary-components-3d-diagnostics-'));
  const storage = new ProjectStorage(rootDir);
  const previousFetch = globalThis.fetch;
  try {
    const project = await storage.createProject({ user: 'Demo User', name: 'Diagnostic TRELLIS' });
    const projectDir = await storage.resolveProjectDir('Demo User', project.id);
    const sourceDir = path.join(projectDir, 'agent_history', 'assets', 'new_pipeline', 'diagnostic-run', 'main_images');
    const objectDir = path.join(projectDir, 'agent_history', 'assets', 'new_pipeline', 'diagnostic-run', 'object_images');
    await mkdir(sourceDir, { recursive: true });
    await mkdir(objectDir, { recursive: true });
    const mainImagePath = path.join(sourceDir, 'image_001.png');
    const bboxPath = path.join(sourceDir, 'image_001_bbox_front.json');
    const objectPath = path.join(objectDir, '01-object.png');
    await writeFile(mainImagePath, 'main-image', 'utf8');
    await writeFile(objectPath, 'object-1', 'utf8');
    await writeFile(bboxPath, `${JSON.stringify([{ bbox_index: 0, label: 'object', box_2d: [1, 2, 3, 4] }])}\n`, 'utf8');
    await storage.saveUserApiConfig({
      user: 'Demo User',
      config: { components3D: { provider: 'trellis.2', trellis2: trellisConfig() } },
    });

    globalThis.fetch = (async (resource, init) => {
      const url = String(resource);
      if (url.endsWith('/health')) return new Response(JSON.stringify({ ok: true }), { status: 200 });
      if (url.endsWith('/status')) return new Response(JSON.stringify({ queue: { queued: 1, running: 0 } }), { status: 200 });
      const action = new Headers(init?.headers).get('x-tc-action');
      if (action === 'SubmitHunyuanTo3DProJob') {
        return new Response(JSON.stringify({ Response: { JobId: 'job-network-failure' } }), { status: 200 });
      }
      if (action === 'QueryHunyuanTo3DProJob') {
        throw new TypeError('fetch failed', {
          cause: Object.assign(new Error('connection reset'), { code: 'ECONNRESET', syscall: 'read' }),
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    const relative = (filePath: string) => path.relative(projectDir, filePath).replace(/\\/g, '/');
    const snapshots: Components3DAssetProgressSnapshot[] = [];
    const runtime = new CodexAgentRuntime(storage);
    await assert.rejects(() => runtime.handleStepAction({
      user: 'Demo User',
      projectId: project.id,
      sessionId: 'diagnostic-session',
      stepKey: 'components-3d',
      action: 'retry',
      prompt: 'diagnose provider',
      images: [],
      sourceImages: [
        { id: 'main', sourceStepKey: 'main-image', relativePath: relative(mainImagePath), mimeType: 'image/png', bytes: 1 },
        {
          id: 'objects',
          sourceStepKey: 'object-images',
          relativePath: relative(objectPath),
          mimeType: 'image/png',
          bytes: 1,
          metadata: {
            bboxJsonPath: relative(bboxPath),
            objectImageReferences: [{ path: relative(objectPath) }],
          },
        },
      ],
    }, {
      onTask: (task) => {
        if (task.assetProgress) snapshots.push(task.assetProgress as Components3DAssetProgressSnapshot);
      },
    }), /assets failed/);

    const diagnosticItem = snapshots.at(-1)?.items[0];
    assert.equal(diagnosticItem?.status, 'failed');
    assert.equal(diagnosticItem?.diagnostics?.request.action, 'QueryHunyuanTo3DProJob');
    assert.equal(diagnosticItem?.diagnostics?.failure.code, 'ECONNRESET');
    assert.equal(diagnosticItem?.diagnostics?.health.ok, true);
    assert.equal(diagnosticItem?.diagnostics?.status.ok, true);

    const modelIndex = JSON.parse(await readFile(
      path.join(sourceDir, 'pipeline_output', 'hunyuan_outputs', 'image_001', 'model_index.json'),
      'utf8',
    ));
    assert.equal(modelIndex.results[0].error, 'fetch failed');
    assert.deepEqual(modelIndex.results[0].diagnostics, diagnosticItem?.diagnostics);
  } finally {
    globalThis.fetch = previousFetch;
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('TRELLIS components generation submits assets concurrently and reports ordered progress', { timeout: 10_000 }, async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'visionary-components-3d-concurrency-'));
  const storage = new ProjectStorage(rootDir);
  const previousFetch = globalThis.fetch;
  let submitCount = 0;
  let queryCount = 0;
  let downloadCount = 0;
  let submitGateResolve: (() => void) | undefined;
  let submitGateReject: ((error: Error) => void) | undefined;
  const submitGate = new Promise<void>((resolve, reject) => {
    submitGateResolve = resolve;
    submitGateReject = reject;
  });
  const submitGateTimeout = setTimeout(() => {
    submitGateReject?.(new Error('TRELLIS submit calls were not concurrent'));
  }, 1_000);

  try {
    const project = await storage.createProject({ user: 'Demo User', name: 'Concurrent TRELLIS' });
    const projectDir = await storage.resolveProjectDir('Demo User', project.id);
    const sourceDir = path.join(projectDir, 'agent_history', 'assets', 'new_pipeline', 'test-run', 'main_images');
    const objectDir = path.join(projectDir, 'agent_history', 'assets', 'new_pipeline', 'test-run', 'object_images');
    await mkdir(sourceDir, { recursive: true });
    await mkdir(objectDir, { recursive: true });

    const mainImagePath = path.join(sourceDir, 'image_001.png');
    const bboxPath = path.join(sourceDir, 'image_001_bbox_front.json');
    const labels = ['工作台', 'robot-arm', '工具柜'];
    const objectPaths = await Promise.all(labels.map(async (_label, index) => {
      const objectPath = path.join(objectDir, `${String(index + 1).padStart(2, '0')}-object.png`);
      await writeFile(objectPath, `object-${index + 1}`, 'utf8');
      return objectPath;
    }));
    await writeFile(mainImagePath, 'main-image', 'utf8');
    await writeFile(bboxPath, `${JSON.stringify(labels.map((label, index) => ({
      bbox_index: index,
      label,
      box_2d: [10 + index, 20 + index, 100 + index, 120 + index],
    })))}\n`, 'utf8');

    await storage.saveUserApiConfig({
      user: 'Demo User',
      config: {
        components3D: {
          provider: 'trellis.2',
          trellis2: {
            host: 'trellis.test',
            port: '443',
            baseUrl: 'https://trellis.test',
            secretId: '',
            secretKey: '',
            region: '',
            version: '',
            model: 'TRELLIS.2-1024',
            pollIntervalSeconds: 0.2,
            maxWaitSeconds: 10,
            callbackUrl: '',
            downloadBaseUrl: '',
          },
        },
      },
    });

    globalThis.fetch = (async (resource, init) => {
      const url = String(resource);
      if (url === 'https://trellis.test/') {
        const action = new Headers(init?.headers).get('x-tc-action');
        const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
        if (action === 'SubmitHunyuanTo3DProJob') {
          submitCount += 1;
          const objectNumber = Buffer.from(String(body.ImageBase64 || ''), 'base64')
            .toString('utf8')
            .replace('object-', '');
          if (submitCount === labels.length) submitGateResolve?.();
          await submitGate;
          return new Response(JSON.stringify({ Response: { JobId: `job-${objectNumber}` } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (action === 'QueryHunyuanTo3DProJob') {
          queryCount += 1;
          const jobId = String(body.JobId || '');
          return new Response(JSON.stringify({
            Response: {
              JobId: jobId,
              Status: 'DONE',
              Progress: 100,
              Stage: 'texture_generation',
              StageIndex: 8,
              StageCount: 8,
              StageProgress: 100,
              StageProgressEstimated: 'false',
              StageMessage: 'ready to download',
              ResultFile3Ds: [{ Url: `https://downloads.test/${jobId}.glb` }],
            },
          }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
      }
      if (url.startsWith('https://trellis.test/') && url !== 'https://trellis.test/') {
        downloadCount += 1;
        const jobId = path.basename(new URL(url).pathname, '.glb');
        const delay = jobId === 'job-1' ? 30 : jobId === 'job-2' ? 15 : 0;
        if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
        return new Response(minimalGlbBuffer(jobId), {
          status: 200,
          headers: { 'content-type': 'model/gltf-binary' },
        });
      }
      throw new Error(`Unexpected fetch request: ${url}`);
    }) as typeof fetch;

    const relative = (filePath: string) => path.relative(projectDir, filePath).replace(/\\/g, '/');
    const taskEvents: CodexAgentTaskState[] = [];
    const taskSnapshots: Components3DAssetProgressSnapshot[] = [];
    const runtime = new CodexAgentRuntime(storage);
    const result = await runtime.handleStepAction({
      user: 'Demo User',
      projectId: project.id,
      sessionId: 'components-concurrency-session',
      stepKey: 'components-3d',
      action: 'retry',
      prompt: 'generate workshop components',
      images: [],
      sourceImages: [
        {
          id: 'main-image',
          sourceStepKey: 'main-image',
          relativePath: relative(mainImagePath),
          mimeType: 'image/png',
          bytes: 10,
        },
        {
          id: 'object-images',
          sourceStepKey: 'object-images',
          relativePath: relative(objectPaths[0]),
          mimeType: 'image/png',
          bytes: 8,
          metadata: {
            bboxJsonPath: relative(bboxPath),
            objectImageReferences: objectPaths.map((objectPath) => ({ path: relative(objectPath) })),
          },
        },
      ],
    }, {
      onTask: (task) => {
        taskEvents.push(task);
        if (task.assetProgress) {
          taskSnapshots.push(task.assetProgress as Components3DAssetProgressSnapshot);
        }
      },
    });

    clearTimeout(submitGateTimeout);
    assert.equal(submitCount, 3);
    assert.equal(queryCount, 3);
    assert.equal(downloadCount, 3);
    assert.equal(result.blockPatch.images.length, 3);
    assert.ok(taskSnapshots.length >= 9);
    assert.equal(taskEvents.at(-1)?.progress, 1);
    assert.ok(taskEvents.at(-1)?.assetProgress);
    const incrementalImageEvents = taskEvents.filter((task) => (
      Array.isArray(task.images) && task.images.length > 0 && task.progress < 0.9
    ));
    assert.ok(incrementalImageEvents.length >= 3);
    assert.deepEqual(incrementalImageEvents[0].images?.map((image) => image.id), [
      'component_3d_003',
    ]);
    assert.deepEqual(incrementalImageEvents[1].images?.map((image) => image.id), [
      'component_3d_002',
      'component_3d_003',
    ]);
    assert.deepEqual(incrementalImageEvents[2].images?.map((image) => image.id), [
      'component_3d_001',
      'component_3d_002',
      'component_3d_003',
    ]);
    assert.deepEqual(incrementalImageEvents[2].images?.map((image) => image.metadata?.sourceOrdinal), [0, 1, 2]);
    assert.deepEqual(
      incrementalImageEvents[2].images?.map((image) => image.relativePath),
      result.blockPatch.images.map((image) => image.relativePath),
    );
    assert.equal(taskSnapshots.some((snapshot) => snapshot.submitted === 3 && snapshot.running === 3), true);
    assert.equal(taskSnapshots.some((snapshot) => snapshot.items.some((item) => (
      item.status === 'downloading' && item.progress === 0.99
    ))), true);

    const finalSnapshot = taskSnapshots.at(-1);
    assert.ok(finalSnapshot);
    assert.equal(finalSnapshot.provider, 'trellis.2');
    assert.equal(finalSnapshot.completed, 3);
    assert.equal(finalSnapshot.failed, 0);
    assert.deepEqual(finalSnapshot.items.map((item) => item.label), labels);
    assert.deepEqual(finalSnapshot.items.map((item) => item.modelName), [
      '01-工作台-t1024',
      '02-robot-arm-t1024',
      '03-工具柜-t1024',
    ]);
    assert.deepEqual(finalSnapshot.items.map((item) => item.status), ['done', 'done', 'done']);
    assert.deepEqual(finalSnapshot.items.map((item) => item.stageProgressEstimated), [false, false, false]);

    const sourceGlbPaths = result.blockPatch.images.map((image) => {
      const metadata = image.metadata as Record<string, unknown>;
      return (metadata.sourceGlbPaths as string[])[0];
    });
    assert.deepEqual(sourceGlbPaths.map((filePath) => path.basename(filePath)), [
      '01-工作台-t1024.glb',
      '02-robot-arm-t1024.glb',
      '03-工具柜-t1024.glb',
    ]);

    const modelIndexPath = path.join(
      sourceDir,
      'pipeline_output',
      'hunyuan_outputs',
      'image_001',
      'model_index.json',
    );
    const modelIndex = JSON.parse(await readFile(modelIndexPath, 'utf8')) as {
      success: number;
      failed: number;
      results: Array<{ job_id: string; model_name: string; result_url: string; download_url: string }>;
    };
    assert.equal(modelIndex.success, 3);
    assert.equal(modelIndex.failed, 0);
    assert.deepEqual(modelIndex.results.map((item) => item.job_id), ['job-1', 'job-2', 'job-3']);
    assert.deepEqual(modelIndex.results.map((item) => item.model_name), [
      '01-工作台-t1024',
      '02-robot-arm-t1024',
      '03-工具柜-t1024',
    ]);
    assert.deepEqual(modelIndex.results.map((item) => item.result_url), [
      'https://downloads.test/job-1.glb',
      'https://downloads.test/job-2.glb',
      'https://downloads.test/job-3.glb',
    ]);
    assert.deepEqual(modelIndex.results.map((item) => item.download_url), [
      'https://trellis.test/job-1.glb',
      'https://trellis.test/job-2.glb',
      'https://trellis.test/job-3.glb',
    ]);

    let retrySubmitCount = 0;
    let retryQueryCount = 0;
    let retryDownloadCount = 0;
    globalThis.fetch = (async (resource, init) => {
      const url = String(resource);
      if (url === 'https://trellis.test/') {
        const action = new Headers(init?.headers).get('x-tc-action');
        const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
        if (action === 'SubmitHunyuanTo3DProJob') {
          retrySubmitCount += 1;
          assert.equal(Buffer.from(String(body.ImageBase64 || ''), 'base64').toString('utf8'), 'object-2');
          return new Response(JSON.stringify({ Response: { JobId: 'job-2-retry' } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (action === 'QueryHunyuanTo3DProJob') {
          retryQueryCount += 1;
          return new Response(JSON.stringify({
            Response: {
              JobId: body.JobId,
              Status: 'DONE',
              Progress: 100,
              ResultFile3Ds: [{ Url: 'https://downloads.test/job-2-retry.glb' }],
            },
          }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
      }
      if (url === 'https://trellis.test/job-2-retry.glb') {
        retryDownloadCount += 1;
        return new Response(minimalGlbBuffer('job-2-retry'), {
          status: 200,
          headers: { 'content-type': 'model/gltf-binary' },
        });
      }
      throw new Error(`Unexpected retry fetch request: ${url}`);
    }) as typeof fetch;

    const retryResult = await runtime.handleStepAction({
      user: 'Demo User',
      projectId: project.id,
      sessionId: 'components-concurrency-session',
      attemptId: 'attempt-1',
      executionId: 'step-execution-retry-1',
      stepKey: 'components-3d',
      action: 'retry-asset',
      assetId: 'component_3d_002',
      prompt: 'generate workshop components',
      images: result.blockPatch.images,
      sourceImages: [
        {
          id: 'main-image',
          sourceStepKey: 'main-image',
          relativePath: relative(mainImagePath),
          mimeType: 'image/png',
          bytes: 10,
        },
        {
          id: 'object-images',
          sourceStepKey: 'object-images',
          relativePath: relative(objectPaths[0]),
          mimeType: 'image/png',
          bytes: 8,
          metadata: {
            bboxJsonPath: relative(bboxPath),
            objectImageReferences: objectPaths.map((objectPath) => ({ path: relative(objectPath) })),
          },
        },
      ],
    });
    assert.equal(retrySubmitCount, 1);
    assert.equal(retryQueryCount, 1);
    assert.equal(retryDownloadCount, 1);
    assert.equal(retryResult.blockPatch.images.length, 3);
    const mergedModelIndex = JSON.parse(await readFile(modelIndexPath, 'utf8')) as {
      results: Array<{ job_id: string; model_name: string; download_url: string }>;
    };
    assert.deepEqual(mergedModelIndex.results.map((item) => item.job_id), [
      'job-1',
      'job-2-retry',
      'job-3',
    ]);
    assert.equal(mergedModelIndex.results[1]?.download_url, 'https://trellis.test/job-2-retry.glb');
  } finally {
    clearTimeout(submitGateTimeout);
    globalThis.fetch = previousFetch;
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('Hunyuan components generation submits assets concurrently', { timeout: 10_000 }, async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'visionary-components-3d-hunyuan-concurrency-'));
  const previousFetch = globalThis.fetch;
  let submitCount = 0;
  let queryCount = 0;
  let downloadCount = 0;
  let submitGateResolve: (() => void) | undefined;
  let submitGateReject: ((error: Error) => void) | undefined;
  const submitGate = new Promise<void>((resolve, reject) => {
    submitGateResolve = resolve;
    submitGateReject = reject;
  });
  const submitGateTimeout = setTimeout(() => {
    submitGateReject?.(new Error('Hunyuan submit calls were not concurrent'));
  }, 1_000);

  try {
    const sourceDir = path.join(rootDir, 'main_images');
    const objectDir = path.join(rootDir, 'object_images');
    await mkdir(sourceDir, { recursive: true });
    await mkdir(objectDir, { recursive: true });
    const mainImagePath = path.join(sourceDir, 'image_001.png');
    const bboxPath = path.join(sourceDir, 'image_001_bbox_front.json');
    const objectPaths = [path.join(objectDir, '01-object.png'), path.join(objectDir, '02-object.png')];
    await writeFile(mainImagePath, 'main-image', 'utf8');
    await writeFile(bboxPath, `${JSON.stringify([
      { bbox_index: 0, label: 'alpha', box_2d: [1, 2, 3, 4] },
      { bbox_index: 1, label: 'beta', box_2d: [5, 6, 7, 8] },
    ])}\n`, 'utf8');
    await Promise.all(objectPaths.map((objectPath, index) => writeFile(objectPath, `object-${index + 1}`, 'utf8')));

    globalThis.fetch = (async (resource, init) => {
      const url = String(resource);
      if (url === 'https://hunyuan.test/') {
        const action = new Headers(init?.headers).get('x-tc-action');
        const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
        if (action === 'SubmitHunyuanTo3DProJob') {
          submitCount += 1;
          const objectNumber = Buffer.from(String(body.ImageBase64 || ''), 'base64')
            .toString('utf8')
            .replace('object-', '');
          if (submitCount === objectPaths.length) submitGateResolve?.();
          await submitGate;
          return new Response(JSON.stringify({ Response: { JobId: `hunyuan-job-${objectNumber}` } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (action === 'QueryHunyuanTo3DProJob') {
          queryCount += 1;
          return new Response(JSON.stringify({
            Response: {
              JobId: body.JobId,
              Status: 'DONE',
              Progress: 100,
              ResultFile3Ds: [{ Url: `https://downloads.test/${String(body.JobId)}.glb` }],
            },
          }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
      }
      if (url.startsWith('https://downloads.test/hunyuan-job-')) {
        downloadCount += 1;
        return new Response(minimalGlbBuffer(path.basename(new URL(url).pathname, '.glb')), {
          status: 200,
          headers: { 'content-type': 'model/gltf-binary' },
        });
      }
      throw new Error(`Unexpected fetch request: ${url}`);
    }) as typeof fetch;

    const hunyuanConfig: Components3DEndpointConfig = {
      host: 'hunyuan.test',
      port: '',
      baseUrl: 'https://hunyuan.test',
      secretId: 'test-secret-id',
      secretKey: 'test-secret-key',
      region: 'ap-guangzhou',
      version: '2025-05-13',
      model: '3.1',
      pollIntervalSeconds: 0.2,
      maxWaitSeconds: 10,
      callbackUrl: '',
      downloadBaseUrl: '',
    };
    const config: Components3DGenerationConfig = {
      provider: 'hunyuan',
      hunyuan: hunyuanConfig,
      trellis2: trellisConfig(),
    };
    const result = await generateComponents3D({
      projectRoot: rootDir,
      projectId: 'hunyuan-parallel',
      mainImagePath: path.relative(rootDir, mainImagePath),
      layoutBboxJsonPath: path.relative(rootDir, bboxPath),
      objectImagePaths: objectPaths,
      runLabel: 'hunyuan-parallel',
      components3DConfig: config,
      user: 'Demo User',
      attemptId: 'attempt-hunyuan',
      stepExecutionId: 'step-hunyuan',
    });

    clearTimeout(submitGateTimeout);
    assert.equal(submitCount, 2);
    assert.equal(queryCount, 2);
    assert.equal(downloadCount, 2);
    assert.equal(Array.isArray(result.images) ? result.images.length : 0, 2);
  } finally {
    clearTimeout(submitGateTimeout);
    globalThis.fetch = previousFetch;
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('components-3d logical cancellation matches asset and step scopes exactly once', { timeout: 10_000 }, async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'visionary-components-3d-cancel-'));
  const storage = new ProjectStorage(rootDir);
  const previousFetch = globalThis.fetch;
  let queryCount = 0;
  let downloadCount = 0;
  const canceledJobs: string[] = [];
  let queriesReadyResolve: (() => void) | undefined;
  let lateQueryResolve: (() => void) | undefined;
  const queriesReady = new Promise<void>((resolve) => {
    queriesReadyResolve = resolve;
  });

  try {
    const project = await storage.createProject({ user: 'Demo User', name: 'Cancelable TRELLIS' });
    const projectDir = await storage.resolveProjectDir('Demo User', project.id);
    const sourceDir = path.join(projectDir, 'agent_history', 'assets', 'new_pipeline', 'cancel-run', 'main_images');
    const objectDir = path.join(projectDir, 'agent_history', 'assets', 'new_pipeline', 'cancel-run', 'object_images');
    await mkdir(sourceDir, { recursive: true });
    await mkdir(objectDir, { recursive: true });
    const mainImagePath = path.join(sourceDir, 'image_001.png');
    const bboxPath = path.join(sourceDir, 'image_001_bbox_front.json');
    const objectPaths = [path.join(objectDir, '01-object.png'), path.join(objectDir, '02-object.png')];
    await writeFile(mainImagePath, 'main-image', 'utf8');
    await writeFile(bboxPath, `${JSON.stringify([
      { bbox_index: 0, label: 'alpha', box_2d: [1, 2, 3, 4] },
      { bbox_index: 1, label: 'beta', box_2d: [5, 6, 7, 8] },
    ])}\n`, 'utf8');
    await Promise.all(objectPaths.map((objectPath, index) => writeFile(objectPath, `object-${index + 1}`, 'utf8')));
    await storage.saveUserApiConfig({
      user: 'Demo User',
      config: {
        components3D: {
          provider: 'trellis.2',
          trellis2: trellisConfig({ maxWaitSeconds: 10 }),
        },
      },
    });

    globalThis.fetch = (async (resource, init) => {
      const url = String(resource);
      if (url === 'https://trellis.test/job-2.glb') {
        downloadCount += 1;
        return new Response(minimalGlbBuffer('late-job-2'), {
          status: 200,
          headers: { 'content-type': 'model/gltf-binary' },
        });
      }
      if (url !== 'https://trellis.test/') throw new Error(`Unexpected fetch request: ${url}`);
      const action = new Headers(init?.headers).get('x-tc-action');
      const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
      if (action === 'SubmitHunyuanTo3DProJob') {
        const objectNumber = Buffer.from(String(body.ImageBase64 || ''), 'base64')
          .toString('utf8')
          .replace('object-', '');
        return new Response(JSON.stringify({ Response: { JobId: `job-${objectNumber}` } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (action === 'QueryHunyuanTo3DProJob') {
        queryCount += 1;
        if (queryCount === objectPaths.length) queriesReadyResolve?.();
        if (body.JobId === 'job-2') {
          return await new Promise<Response>((resolve) => {
            lateQueryResolve = () => resolve(new Response(JSON.stringify({
              Response: {
                JobId: 'job-2',
                Status: 'DONE',
                Progress: 100,
                ResultFile3Ds: [{ Url: 'https://downloads.test/job-2.glb' }],
              },
            }), { status: 200, headers: { 'content-type': 'application/json' } }));
          });
        }
        return await new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          const abort = () => reject(new DOMException('aborted', 'AbortError'));
          if (signal?.aborted) abort();
          else signal?.addEventListener('abort', abort, { once: true });
        });
      }
      if (action === 'CancelHunyuanTo3DProJob') {
        canceledJobs.push(String(body.JobId || ''));
        return new Response(JSON.stringify({
          Response: { JobId: body.JobId, Status: 'CANCELLED', CancelRequested: true, Cancelled: true },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      throw new Error(`Unexpected provider action: ${action}`);
    }) as typeof fetch;

    const relative = (filePath: string) => path.relative(projectDir, filePath).replace(/\\/g, '/');
    const run = new CodexAgentRuntime(storage).handleStepAction({
      user: 'Demo User',
      projectId: project.id,
      sessionId: 'cancel-session',
      attemptId: 'cancel-attempt',
      executionId: 'cancel-step',
      stepKey: 'components-3d',
      action: 'retry',
      prompt: 'generate assets',
      sourceImages: [
        { id: 'main', sourceStepKey: 'main-image', relativePath: relative(mainImagePath), mimeType: 'image/png', bytes: 1 },
        {
          id: 'objects',
          sourceStepKey: 'object-images',
          relativePath: relative(objectPaths[0]),
          mimeType: 'image/png',
          bytes: 1,
          metadata: {
            bboxJsonPath: relative(bboxPath),
            objectImageReferences: objectPaths.map((objectPath) => ({ path: relative(objectPath) })),
          },
        },
      ],
    });
    await queriesReady;

    const assetScope = {
      kind: 'asset' as const,
      user: 'Demo User',
      projectId: project.id,
      attemptId: 'cancel-attempt',
      stepExecutionId: 'cancel-step',
      assetExecutionId: 'cancel-step:component_3d_002',
    };
    assert.equal(cancelComponents3DExecutions(assetScope).matchedAssets, 1);
    assert.equal(cancelComponents3DExecutions(assetScope).matchedAssets, 0);
    assert.equal(cancelComponents3DExecutions({
      kind: 'step',
      user: 'Demo User',
      projectId: project.id,
      attemptId: 'cancel-attempt',
      stepExecutionId: 'wrong-step',
    }).matchedAssets, 0);
    assert.equal(cancelComponents3DExecutions({
      kind: 'step',
      user: 'Demo User',
      projectId: project.id,
      attemptId: 'cancel-attempt',
      stepExecutionId: 'cancel-step',
    }).matchedAssets, 1);
    lateQueryResolve?.();
    await assert.rejects(run, /assets failed/);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(canceledJobs.sort(), ['job-1', 'job-2']);
    assert.equal(downloadCount, 0);
    assert.equal(cancelComponents3DExecutions({
      kind: 'workflow',
      user: 'Demo User',
      projectId: project.id,
      attemptId: 'cancel-attempt',
    }).matchedAssets, 0);
  } finally {
    globalThis.fetch = previousFetch;
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('project API exposes a cancellable SSE step-action route while preserving JSON actions', async () => {
  const source = await readFile(new URL('../src/server/project-api.ts', import.meta.url), 'utf8');
  const componentsSource = await readFile(
    new URL('../src/server/mcp/new-pipeline-components-3d-server.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /const AGENT_STEP_ACTION_STREAM_PREFIX = `\$\{AGENT_STEP_ACTION_PREFIX\}\/stream`;/);
  assert.match(source, /url\.pathname === AGENT_STEP_ACTION_STREAM_PREFIX[\s\S]*sendSseHeaders\(res\)/);
  assert.match(source, /writeSse\(res, 'ready',[\s\S]*onTask:[\s\S]*writeSse\(res, 'task',[\s\S]*writeSse\(res, 'result'/);
  assert.match(source, /res\.once\('close',[\s\S]*controller\.abort\(\)/);
  assert.match(source, /url\.pathname === AGENT_STEP_ACTION_PREFIX[\s\S]*sendOk\(res, await codexAgent\.handleStepAction/);
  assert.match(source, /url\.pathname === AGENT_CANCEL_PREFIX[\s\S]*components3DCancelScopeFromBody\(body\)[\s\S]*storage\.resolveProjectDir\(scope\.user, scope\.projectId\)[\s\S]*cancelComponents3DExecutions\(scope\)/);
  assert.match(source, /action === 'components-3d' && filePath === 'cancel-job'[\s\S]*storage\.resolveProjectDir\(user, projectId\)[\s\S]*cancelComponents3DTrellisJob/);
  assert.doesNotMatch(source, /cancelComponents3DTrellisJob\(\{[\s\S]*baseUrl:/);
  assert.match(componentsSource, /await Promise\.all\(targetIndexes\.map\(\(index\) => processAsset\(index\)\)\)/);
  assert.doesNotMatch(componentsSource, /for \(let index = 0; index < objectImages\.length; index \+= 1\) \{[\s\S]*await processAsset\(index\)/);
});
