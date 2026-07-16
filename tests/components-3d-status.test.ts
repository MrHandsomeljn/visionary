import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildComponents3DTrellisStatusUrl,
  normalizeComponents3DTrellisStatus,
  summarizeComponents3DTrellisStatusPayload,
} from '../src/server/components-3d-status.ts';

test('summarizes Trellis status payload for the API management panel', async () => {
  const payload = JSON.parse(
    await readFile(new URL('../../third-party/call_3dgen_status.json', import.meta.url), 'utf8'),
  );
  const summary = summarizeComponents3DTrellisStatusPayload(payload, {
    checkedAt: '2026-07-13T01:22:00.000Z',
    statusUrl: 'http://127.0.0.1:25367/status',
    httpStatus: 200,
  });

  assert.equal(summary.ok, true);
  assert.equal(summary.publicBaseUrl, 'http://127.0.0.1:25367');
  assert.equal(summary.serverTimeIso, '2026-07-13T01:21:01.981210+00:00');
  assert.equal(summary.workersEnabled, true);
  assert.equal(summary.workerCount, 1);
  assert.equal(summary.busyWorkerCount, 0);
  assert.equal(summary.idleWorkerCount, 1);
  assert.equal(summary.physicalGpuCount, 8);
  assert.deepEqual(summary.configuredWorkerGpuIds, [0]);
  assert.equal(summary.queue.queued, 0);
  assert.equal(summary.queue.running, 0);
  assert.equal(summary.queue.totalActive, 0);
  assert.equal(summary.queue.idle, true);
  assert.equal(summary.queue.statusCounts.DONE, 3);
  assert.equal(summary.gpuStatus.length, 8);
  assert.deepEqual(summary.gpuStatus[0], {
    gpuId: 0,
    memoryUsedMiB: 14,
    memoryTotalMiB: 24576,
    utilizationGpuPct: 0,
    roles: ['worker'],
  });
  assert.deepEqual(summary.generationModels.map((model) => model.name), [
    'TRELLIS.2-1024',
    'TRELLIS.2-1536',
    'TRELLIS.2-512',
  ]);
  assert.equal(summary.generationModels[0].pipelineType, '1024');
  assert.equal(summary.generationModels[0].lowVram, true);
  assert.equal(summary.generationModels[0].textureSize, 2048);
  assert.ok(summary.actions.includes('QueryTrellisServerStatus'));

  const normalized = normalizeComponents3DTrellisStatus(summary);
  assert.equal(normalized?.ok, true);
  assert.deepEqual(normalized?.generationModels.map((model) => model.name), [
    'TRELLIS.2-1024',
    'TRELLIS.2-1536',
    'TRELLIS.2-512',
  ]);
});

test('builds Trellis status URL from base URL or host and port', () => {
  assert.equal(
    buildComponents3DTrellisStatusUrl({
      host: '127.0.0.1',
      port: '25367',
      baseUrl: '',
      secretId: '',
      secretKey: '',
      region: '',
      version: '',
      model: 'TRELLIS.2-1024',
      pollIntervalSeconds: 5,
      maxWaitSeconds: 1800,
      callbackUrl: '',
      downloadBaseUrl: '',
    }),
    'http://127.0.0.1:25367/status',
  );
  assert.equal(
    buildComponents3DTrellisStatusUrl({
      host: '',
      port: '',
      baseUrl: 'http://10.0.0.8:25367/',
      secretId: '',
      secretKey: '',
      region: '',
      version: '',
      model: 'TRELLIS.2-1024',
      pollIntervalSeconds: 5,
      maxWaitSeconds: 1800,
      callbackUrl: '',
      downloadBaseUrl: '',
    }),
    'http://10.0.0.8:25367/status',
  );
});
