import { components3DEndpointBaseUrl, type Components3DEndpointConfig } from './components-3d-config.ts';

export interface Components3DTrellisGpuStatusSummary {
  gpuId: number | null;
  memoryUsedMiB: number | null;
  memoryTotalMiB: number | null;
  utilizationGpuPct: number | null;
  roles: string[];
}

export interface Components3DTrellisGenerationModelSummary {
  name: string;
  pipelineType: string;
  lowVram: boolean | null;
  remesh: boolean | null;
  textureSize: number | null;
  decimationTarget: number | null;
  exportGpu: number | null;
  cumeshGpu: number | null;
  snapshotMode: string;
}

export interface Components3DTrellisQueueSummary {
  maxQueuedJobs: number | null;
  queued: number | null;
  running: number | null;
  totalActive: number | null;
  idle: boolean | null;
  statusCounts: Record<string, number>;
}

export interface Components3DTrellisStatusSummary {
  ok: boolean;
  checkedAt: string;
  statusUrl: string;
  httpStatus: number | null;
  error: string;
  serverTimeIso: string;
  publicBaseUrl: string;
  workersEnabled: boolean | null;
  physicalGpuCount: number | null;
  configuredWorkerGpuIds: number[];
  workerCount: number | null;
  busyWorkerCount: number | null;
  idleWorkerCount: number | null;
  queue: Components3DTrellisQueueSummary;
  gpuStatus: Components3DTrellisGpuStatusSummary[];
  generationModels: Components3DTrellisGenerationModelSummary[];
  actions: string[];
}

export interface Components3DTrellisStatusContext {
  checkedAt: string;
  statusUrl: string;
  httpStatus: number | null;
  error?: string;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown): string {
  return String(value ?? '').trim();
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function booleanValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;
  return null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => stringValue(item)).filter((item) => Boolean(item))
    : [];
}

function numberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value
      .map((item) => numberValue(item))
      .filter((item): item is number => item !== null)
    : [];
}

function normalizeQueue(record: Record<string, unknown>): Components3DTrellisQueueSummary {
  const statusCountsRecord = readRecord(record.status_counts ?? record.statusCounts);
  const statusCounts: Record<string, number> = {};
  for (const [key, value] of Object.entries(statusCountsRecord)) {
    const numeric = numberValue(value);
    if (numeric !== null) {
      statusCounts[key] = numeric;
    }
  }
  return {
    maxQueuedJobs: numberValue(record.max_queued_jobs ?? record.maxQueuedJobs),
    queued: numberValue(record.queued),
    running: numberValue(record.running),
    totalActive: numberValue(record.total_active ?? record.totalActive),
    idle: booleanValue(record.idle),
    statusCounts,
  };
}

function normalizeGpuStatus(
  hardware: Record<string, unknown>,
): Components3DTrellisGpuStatusSummary[] {
  const gpuRolesRecord = readRecord(hardware.gpu_roles ?? hardware.gpuRoles);
  const rawEntries = hardware.gpu_status ?? hardware.gpuStatus;
  const entries = Array.isArray(rawEntries) ? rawEntries : [];
  return entries
    .map((entry) => {
      const record = readRecord(entry);
      const gpuId = numberValue(record.gpu_id ?? record.gpuId);
      const roleKey = gpuId === null ? '' : String(gpuId);
      const roles = stringArray(gpuRolesRecord[roleKey]);
      return {
        gpuId,
        memoryUsedMiB: numberValue(record.memory_used_mib ?? record.memoryUsedMiB),
        memoryTotalMiB: numberValue(record.memory_total_mib ?? record.memoryTotalMiB),
        utilizationGpuPct: numberValue(record.utilization_gpu_pct ?? record.utilizationGpuPct),
        roles,
      };
    })
    .filter((entry) => entry.gpuId !== null || entry.memoryUsedMiB !== null || entry.roles.length > 0);
}

function normalizeGenerationModels(record: Record<string, unknown>): Components3DTrellisGenerationModelSummary[] {
  const rawModels = record.generation_models ?? record.generationModels;
  const models = Array.isArray(rawModels) ? rawModels : [];
  return models
    .map((model) => {
      const entry = readRecord(model);
      const name = stringValue(entry.name);
      return {
        name,
        pipelineType: stringValue(entry.pipeline_type ?? entry.pipelineType),
        lowVram: booleanValue(entry.low_vram ?? entry.lowVram),
        remesh: booleanValue(entry.remesh),
        textureSize: numberValue(entry.texture_size ?? entry.textureSize),
        decimationTarget: numberValue(entry.decimation_target ?? entry.decimationTarget),
        exportGpu: numberValue(entry.export_gpu ?? entry.exportGpu),
        cumeshGpu: numberValue(entry.cumesh_gpu ?? entry.cumeshGpu),
        snapshotMode: stringValue(entry.snapshot_mode ?? entry.snapshotMode),
      };
    })
    .filter((model) => Boolean(model.name));
}

export function summarizeComponents3DTrellisStatusPayload(
  payload: unknown,
  context: Components3DTrellisStatusContext,
): Components3DTrellisStatusSummary {
  const root = readRecord(payload);
  const statusRecord = readRecord(root.Response ?? root.response ?? root.data);
  const server = readRecord(root.server ?? statusRecord.server);
  const hardware = readRecord(root.hardware ?? statusRecord.hardware);
  const queueRecord = readRecord(root.queue ?? statusRecord.queue);
  const apis = readRecord(root.apis ?? statusRecord.apis);
  const serverTimeIso = stringValue(root.server_time_iso ?? statusRecord.server_time_iso);
  const publicBaseUrl = stringValue(server.public_base_url ?? server.publicBaseUrl);
  return {
    ok: true,
    checkedAt: context.checkedAt,
    statusUrl: context.statusUrl,
    httpStatus: context.httpStatus,
    error: '',
    serverTimeIso,
    publicBaseUrl,
    workersEnabled: booleanValue(server.workers_enabled ?? server.workersEnabled),
    physicalGpuCount: numberValue(hardware.physical_gpu_count ?? hardware.physicalGpuCount),
    configuredWorkerGpuIds: numberArray(hardware.configured_worker_gpu_ids ?? hardware.configuredWorkerGpuIds),
    workerCount: numberValue(hardware.worker_count ?? hardware.workerCount),
    busyWorkerCount: numberValue(hardware.busy_worker_count ?? hardware.busyWorkerCount),
    idleWorkerCount: numberValue(hardware.idle_worker_count ?? hardware.idleWorkerCount),
    queue: normalizeQueue(queueRecord),
    gpuStatus: normalizeGpuStatus(hardware),
    generationModels: normalizeGenerationModels(apis),
    actions: stringArray(apis.actions),
  };
}

function buildStatusError(context: Components3DTrellisStatusContext, error: unknown): Components3DTrellisStatusSummary {
  const message = error instanceof Error
    ? error.message
    : String(error ?? 'Unknown Trellis status error');
  return {
    ok: false,
    checkedAt: context.checkedAt,
    statusUrl: context.statusUrl,
    httpStatus: context.httpStatus,
    error: context.error || message,
    serverTimeIso: '',
    publicBaseUrl: '',
    workersEnabled: null,
    physicalGpuCount: null,
    configuredWorkerGpuIds: [],
    workerCount: null,
    busyWorkerCount: null,
    idleWorkerCount: null,
    queue: {
      maxQueuedJobs: null,
      queued: null,
      running: null,
      totalActive: null,
      idle: null,
      statusCounts: {},
    },
    gpuStatus: [],
    generationModels: [],
    actions: [],
  };
}

export function buildComponents3DTrellisStatusUrl(config: Components3DEndpointConfig): string {
  return `${components3DEndpointBaseUrl(config)}/status`;
}

export function normalizeComponents3DTrellisStatus(value: unknown): Components3DTrellisStatusSummary | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const rawGpuStatus = record.gpuStatus;
  const rawGenerationModels = record.generationModels;
  return {
    ok: Boolean(record.ok),
    checkedAt: stringValue(record.checkedAt),
    statusUrl: stringValue(record.statusUrl),
    httpStatus: numberValue(record.httpStatus),
    error: stringValue(record.error),
    serverTimeIso: stringValue(record.serverTimeIso),
    publicBaseUrl: stringValue(record.publicBaseUrl),
    workersEnabled: booleanValue(record.workersEnabled),
    physicalGpuCount: numberValue(record.physicalGpuCount),
    configuredWorkerGpuIds: numberArray(record.configuredWorkerGpuIds),
    workerCount: numberValue(record.workerCount),
    busyWorkerCount: numberValue(record.busyWorkerCount),
    idleWorkerCount: numberValue(record.idleWorkerCount),
    queue: normalizeQueue(readRecord(record.queue)),
    gpuStatus: Array.isArray(rawGpuStatus)
      ? rawGpuStatus.map((entry) => {
        const gpu = readRecord(entry);
        return {
          gpuId: numberValue(gpu.gpuId),
          memoryUsedMiB: numberValue(gpu.memoryUsedMiB),
          memoryTotalMiB: numberValue(gpu.memoryTotalMiB),
          utilizationGpuPct: numberValue(gpu.utilizationGpuPct),
          roles: stringArray(gpu.roles),
        };
      })
      : [],
    generationModels: Array.isArray(rawGenerationModels)
      ? rawGenerationModels.map((entry) => {
        const model = readRecord(entry);
        return {
          name: stringValue(model.name),
          pipelineType: stringValue(model.pipelineType),
          lowVram: booleanValue(model.lowVram),
          remesh: booleanValue(model.remesh),
          textureSize: numberValue(model.textureSize),
          decimationTarget: numberValue(model.decimationTarget),
          exportGpu: numberValue(model.exportGpu),
          cumeshGpu: numberValue(model.cumeshGpu),
          snapshotMode: stringValue(model.snapshotMode),
        };
      })
      : [],
    actions: stringArray(record.actions),
  };
}

export async function queryComponents3DTrellisStatus(
  config: Components3DEndpointConfig,
  options: { timeoutMs?: number } = {},
): Promise<Components3DTrellisStatusSummary> {
  const checkedAt = new Date().toISOString();
  let statusUrl = '';
  try {
    statusUrl = buildComponents3DTrellisStatusUrl(config);
  } catch (error) {
    return buildStatusError({
      checkedAt,
      statusUrl: '',
      httpStatus: null,
      error: error instanceof Error ? error.message : String(error ?? 'Invalid Trellis status endpoint'),
    }, error);
  }

  const timeoutMs = Math.max(250, Math.min(30_000, Math.round(Number(options.timeoutMs || 2500))));
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      return buildStatusError({
        checkedAt,
        statusUrl,
        httpStatus: response.status,
        error: text ? `${response.status} ${response.statusText}: ${text.trim().slice(0, 240)}` : `${response.status} ${response.statusText}`,
      }, new Error(text || response.statusText));
    }
    let payload: unknown = {};
    if (text.trim()) {
      try {
        payload = JSON.parse(text);
      } catch (error) {
        return buildStatusError({
          checkedAt,
          statusUrl,
          httpStatus: response.status,
          error: 'Trellis status response is not valid JSON',
        }, error);
      }
    }
    return summarizeComponents3DTrellisStatusPayload(payload, {
      checkedAt,
      statusUrl,
      httpStatus: response.status,
    });
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    return buildStatusError({
      checkedAt,
      statusUrl,
      httpStatus: null,
      error: isAbort
        ? `Trellis status request timed out after ${timeoutMs}ms`
        : error instanceof Error
          ? error.message
          : String(error ?? 'Unknown Trellis status error'),
    }, error);
  } finally {
    clearTimeout(timeoutId);
  }
}
