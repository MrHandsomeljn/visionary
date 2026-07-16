#!/usr/bin/env node
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createHash, createHmac } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  activeComponents3DEndpointConfig,
  components3DEndpointBaseUrl,
  normalizeComponents3DGenerationConfig,
  resolveComponents3DGenerationConfigFromEnv,
  type Components3DGenerationConfig,
  type Components3DEndpointConfig,
  UserApiConfigValidationError,
} from '../components-3d-config.ts';
import { buildComponents3DObjectName } from '../components-3d-model-naming.ts';

type JsonRecord = Record<string, unknown>;

export type Components3DAssetStatus =
  | 'pending'
  | 'submitting'
  | 'queued'
  | 'running'
  | 'downloading'
  | 'done'
  | 'failed'
  | 'TLE'
  | 'canceled';

export interface Components3DAssetProgressItem {
  assetId: string;
  assetExecutionId: string;
  stepExecutionId: string;
  ordinal: number;
  label: string;
  modelName: string;
  jobId: string;
  status: Components3DAssetStatus;
  stageKey: string;
  stageIndex: number | null;
  stageCount: number | null;
  stageProgress: number | null;
  stageProgressEstimated: boolean;
  progress: number;
  message: string;
  error?: string;
  diagnostics?: Components3DFailureDiagnostics;
  updatedAt: string;
}

export interface Components3DDiagnosticProbe {
  url: string;
  ok: boolean;
  httpStatus: number | null;
  durationMs: number;
  payload?: unknown;
  error?: string;
}

export interface Components3DFailureDiagnostics {
  version: 1;
  checkedAt: string;
  endpoint: string;
  client: {
    nodeVersion: string;
    platform: string;
    arch: string;
  };
  request: {
    action: string;
    jobId: string;
    elapsedMs: number | null;
  };
  failure: JsonRecord;
  lastProgress: JsonRecord;
  health: Components3DDiagnosticProbe;
  status: Components3DDiagnosticProbe;
}

export interface Components3DAssetProgressSnapshot {
  version: 1;
  revision: number;
  provider: Components3DGenerationConfig['provider'];
  total: number;
  submitted: number;
  running: number;
  completed: number;
  failed: number;
  timedOut: number;
  items: Components3DAssetProgressItem[];
}

export interface Components3DProgressEvent {
  title: string;
  message: string;
  progress: number;
  statusId: string;
  provider?: Components3DGenerationConfig['provider'];
  assetProgress?: Components3DAssetProgressSnapshot;
  [key: string]: unknown;
}

export type Components3DProgressHandler = (
  event: Components3DProgressEvent,
) => void | Promise<void>;

export interface Components3DAssetProgressUpdate {
  status: Components3DAssetStatus;
  jobId?: string;
  stageKey?: string;
  stageIndex?: number | null;
  stageCount?: number | null;
  stageProgress?: number | null;
  stageProgressEstimated?: boolean;
  progress?: number;
  message?: string;
  error?: string;
  diagnostics?: Components3DFailureDiagnostics;
}

export interface Components3DTrellisCancelResult {
  jobId: string;
  status: string;
  cancelRequested: boolean;
  cancelled: boolean;
  requestId: string;
  response: JsonRecord;
}

export type Components3DCancelScope =
  | { kind: 'workflow'; user: string; projectId: string; attemptId: string }
  | { kind: 'step'; user: string; projectId: string; attemptId: string; stepExecutionId: string }
  | { kind: 'asset'; user: string; projectId: string; attemptId: string; stepExecutionId: string; assetExecutionId: string };

export interface Components3DCancelResult {
  accepted: true;
  state: 'canceled';
  scope: Components3DCancelScope;
  matchedAssets: number;
}

interface Components3DActiveAssetExecution {
  user: string;
  projectId: string;
  attemptId: string;
  stepExecutionId: string;
  assetExecutionId: string;
  assetId: string;
  controller: AbortController;
  cancelRequested: boolean;
  cancelProviderJob?: () => Promise<unknown>;
}

interface GeneratedAsset {
  id: string;
  relativePath: string;
  mimeType: string;
  bytes: number;
  metadata?: JsonRecord;
}

interface CanonicalAssetReference {
  assetId: string;
  hash: string;
  path: string;
  mimeType: string;
  bytes: number;
  kind: string;
  provenance?: JsonRecord;
}

interface Component3DItem {
  id: string;
  ordinal: number;
  label: string;
  previewPath: string;
  thumbnailPath?: string;
  frontRenderPath?: string;
  previewMimeType?: string;
  modelPaths: string[];
  frontOrientationPath: string;
  candidateSheetPath?: string;
  selectedYaw?: unknown;
  confidence?: unknown;
  status?: unknown;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VISIONARY_ROOT = path.resolve(__dirname, '../../..');
const REPO_ROOT = path.resolve(VISIONARY_ROOT, '..');
const NEW_PIPELINE_ROOT = path.resolve(process.env.VISIONARY_NEW_PIPELINE_ROOT || path.join(REPO_ROOT, 'third-party', 'new_pipeline'));
const PYTHON_BIN = path.join(NEW_PIPELINE_ROOT, '.venv', 'bin', 'python');
const DEFAULT_COMPONENTS_3D_DEMO_GLB_DIR = path.join(
  VISIONARY_ROOT,
  'assets',
  'mock-components-3d',
  'moon-visionary-workspace',
);
const COMPONENTS_3D_DEMO_GLB_DIR = path.resolve(
  process.env.VISIONARY_COMPONENTS_3D_DEMO_GLB_DIR || DEFAULT_COMPONENTS_3D_DEMO_GLB_DIR,
);
const COMPONENTS_3D_DEMO_ASSET_COUNT = 9;
const activeComponents3DAssetExecutions = new Map<string, Components3DActiveAssetExecution>();

function components3DAssetExecutionKey(entry: Pick<Components3DActiveAssetExecution, 'user' | 'projectId' | 'attemptId' | 'stepExecutionId' | 'assetExecutionId'>): string {
  return [entry.user, entry.projectId, entry.attemptId, entry.stepExecutionId, entry.assetExecutionId].join(':');
}

function registerComponents3DAssetExecution(entry: Components3DActiveAssetExecution): () => void {
  const key = components3DAssetExecutionKey(entry);
  activeComponents3DAssetExecutions.set(key, entry);
  return () => {
    if (activeComponents3DAssetExecutions.get(key) === entry) {
      activeComponents3DAssetExecutions.delete(key);
    }
  };
}

export function cancelComponents3DExecutions(scope: Components3DCancelScope): Components3DCancelResult {
  const matching = Array.from(activeComponents3DAssetExecutions.values()).filter((entry) => {
    if (entry.cancelRequested) return false;
    if (entry.user !== scope.user || entry.projectId !== scope.projectId || entry.attemptId !== scope.attemptId) return false;
    if (scope.kind === 'workflow') return true;
    if (entry.stepExecutionId !== scope.stepExecutionId) return false;
    return scope.kind === 'step' || entry.assetExecutionId === scope.assetExecutionId;
  });
  matching.forEach((entry) => {
    entry.cancelRequested = true;
    entry.controller.abort();
    Promise.resolve(entry.cancelProviderJob?.()).catch(() => undefined);
  });
  return {
    accepted: true,
    state: 'canceled',
    scope,
    matchedAssets: matching.length,
  };
}

function nowRunId(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '_');
}

function safeSegment(value: string, fallback: string): string {
  const normalized = String(value || '').trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized || fallback;
}

function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function projectOutputRoot(projectRoot: string, projectId: string, runLabel: string, runId: string): string {
  const root = path.resolve(projectRoot);
  const safeProjectId = safeSegment(projectId, 'project');
  const safeLabel = safeSegment(runLabel, 'components-3d');
  const output = path.join(root, 'agent_history', 'assets', 'new_pipeline', safeProjectId, `${runId}-${safeLabel}`);
  if (!isPathInside(root, output)) {
    throw new Error('Resolved output path escapes project root.');
  }
  return output;
}

function toRelative(projectRoot: string, filePath: string): string {
  return path.relative(projectRoot, filePath).split(path.sep).join('/');
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fileAsset(projectRoot: string, id: string, filePath: string, mimeType: string, metadata: JsonRecord = {}): Promise<GeneratedAsset> {
  const info = await stat(filePath);
  return {
    id,
    relativePath: toRelative(projectRoot, filePath),
    mimeType,
    bytes: info.size,
    metadata,
  };
}

async function writeCanonicalProjectAssetFromFile(input: {
  projectRoot: string;
  filePath: string;
  mimeType: string;
  kind: string;
  sourcePath: string;
}): Promise<CanonicalAssetReference> {
  const root = path.resolve(input.projectRoot);
  const buffer = await readFile(input.filePath);
  const hash = createHash('sha256').update(buffer).digest('hex');
  const extension = (path.extname(input.filePath) || '.bin').toLowerCase();
  const relativePath = `assets/${hash}${extension}`;
  const targetPath = path.join(root, ...relativePath.split('/'));
  if (!isPathInside(root, targetPath)) {
    throw new Error('Resolved canonical asset path escapes project root.');
  }
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, buffer);
  return {
    assetId: `sha256:${hash}`,
    hash,
    path: relativePath,
    mimeType: input.mimeType,
    bytes: buffer.byteLength,
    kind: input.kind,
    provenance: {
      sourcePath: input.sourcePath,
      stage: 'components-3d',
    },
  };
}

function emitProgress(
  title: string,
  message: string,
  progress: number,
  extras: JsonRecord = {},
  onProgress?: Components3DProgressHandler,
): void {
  const statusId = progress >= 1 ? 'done' : 'running';
  const taskPayload = {
    title,
    message,
    progress,
    statusId,
    ...extras,
  } satisfies Components3DProgressEvent;
  const payload = {
    type: progress <= 0.01 ? 'visionary.task.started' : progress >= 1 ? 'visionary.task.completed' : 'visionary.task.progress',
    payload: taskPayload,
  };
  process.stderr.write(`${JSON.stringify(payload)}\n`);
  if (onProgress) {
    try {
      Promise.resolve(onProgress(taskPayload)).catch(() => undefined);
    } catch {
      // Progress reporting must not break asset generation.
    }
  }
}

class Components3DProviderInactivityError extends Error {
  constructor(provider: Components3DGenerationConfig['provider'], jobId: string, timeoutSeconds: number) {
    super(`${providerLabel(provider)} job ${jobId} made no progress for ${timeoutSeconds}s`);
    this.name = 'Components3DProviderInactivityError';
  }
}

class Components3DProviderRequestError extends Error {
  readonly action: string;
  readonly elapsedMs: number;

  constructor(action: string, elapsedMs: number, error: unknown) {
    super(error instanceof Error ? error.message : String(error), { cause: error });
    this.name = 'Components3DProviderRequestError';
    this.action = action;
    this.elapsedMs = elapsedMs;
  }
}

class Components3DProviderCanceledError extends Error {
  constructor(provider: Components3DGenerationConfig['provider'], jobId: string, message: string) {
    super(message || `${providerLabel(provider)} job ${jobId} was canceled`);
    this.name = 'Components3DProviderCanceledError';
  }
}

async function runPythonScript(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_BIN, args, {
      cwd,
      env: process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`Python command failed with code ${code}: ${args.join(' ')}\n${stderr || stdout}`));
    });
  });
}

async function runBlenderScript(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const blenderBin = process.env.BLENDER_BIN || 'blender';
  const timeoutMs = Math.max(1000, Number(process.env.VISIONARY_BLENDER_TIMEOUT_MS || 15000) || 15000);
  return new Promise((resolve, reject) => {
    const child = spawn(blenderBin, ['--background', '--python', ...args], {
      cwd: VISIONARY_ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Blender script timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`Blender script failed with exit code ${code}\n${stderr || stdout}`));
    });
  });
}

function parseImageIndex(relativePath: string): number {
  const match = path.basename(relativePath).match(/image_(\d+)\.[a-z0-9]+$/i);
  if (!match) {
    throw new Error(`Cannot infer image index from ${relativePath}`);
  }
  return Number(match[1]);
}

function imageStem(index: number): string {
  return `image_${String(index).padStart(3, '0')}`;
}

async function readJsonFile(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

function readRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function numberTuple(value: unknown, length: number): number[] | null {
  if (!Array.isArray(value) || value.length < length) return null;
  const values = value.slice(0, length).map((item) => Number(item));
  return values.every((item) => Number.isFinite(item)) ? values : null;
}

function normalizeModelKey(name: string): string {
  let key = path.basename(name, path.extname(name)).toLowerCase();
  if (key.includes('_model')) {
    key = key.split('_model')[0];
  }
  return key;
}

async function readLayoutAnnotations(bboxJsonPath: string): Promise<JsonRecord[]> {
  const data = await readJsonFile(bboxJsonPath);
  if (!Array.isArray(data)) return [];
  return data.map(readRecord).filter((annotation) => numberTuple(annotation.box_2d, 4));
}

function matchGlbToAnnotation(glbPath: string, annotations: JsonRecord[], fallbackIndex: number): JsonRecord {
  const key = normalizeModelKey(path.basename(glbPath));
  const matched = annotations.find((annotation) => {
    const label = String(annotation.label || '').toLowerCase();
    return label && (label.includes(key) || key.includes(label));
  });
  return matched || annotations[Math.min(fallbackIndex, Math.max(0, annotations.length - 1))] || {};
}

async function writeVisionaryFrontOrientation(input: {
  sourceBatchDir: string;
  imageIndex: number;
  bboxJsonPath: string;
  provider: Components3DGenerationConfig['provider'];
  model: string;
  embeddedPlacement?: boolean;
}): Promise<string> {
  const stem = imageStem(input.imageIndex);
  const hunyuanDir = path.join(input.sourceBatchDir, 'pipeline_output', 'hunyuan_outputs', stem);
  const orientationPath = path.join(hunyuanDir, 'front_orientation.json');
  const annotations = await readLayoutAnnotations(input.bboxJsonPath);
  const glbPaths = await collectGlbFiles(hunyuanDir);
  const items = glbPaths.map((glbPath, index) => {
    const annotation = matchGlbToAnnotation(glbPath, annotations, index);
    return {
      model_file: path.basename(glbPath),
      model_path: glbPath,
      bbox_index: Number.isFinite(Number(annotation.bbox_index)) ? Number(annotation.bbox_index) : index,
      label: String(annotation.label || path.basename(glbPath, path.extname(glbPath)) || `component_${index + 1}`),
      has_clear_front: Boolean(numberTuple(annotation.front_point, 2)),
      correction_yaw_deg: 0,
      confidence: 1,
      status: input.embeddedPlacement ? 'visionary_embedded_transform' : 'visionary_layout_default',
      placement_mode: input.embeddedPlacement ? 'glb_embedded_transform' : 'layout_bbox',
      warning: input.embeddedPlacement
        ? 'Scene insertion uses the GLB embedded transform directly; layout bbox placement is skipped.'
        : 'Blender/VLM front selection skipped; Visionary scene insertion uses layout direction directly.',
    };
  });
  await writeFile(orientationPath, `${JSON.stringify({
    version: 1,
    timestamp: nowRunId(),
    batch_dir: input.sourceBatchDir,
    image_index: input.imageIndex,
    hunyuan_dir: hunyuanDir,
    source: 'visionary_components_3d_mcp',
    provider: input.provider,
    model: input.model,
    placement_mode: input.embeddedPlacement ? 'glb_embedded_transform' : 'layout_bbox',
    front_world_axis: '+X',
    correction_semantics: 'final_yaw_deg = target_yaw_deg + correction_yaw_deg',
    submitted_count: annotations.length,
    completed_count: glbPaths.length,
    items,
  }, null, 2)}\n`, 'utf8');
  return orientationPath;
}

function svgText(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function writeComponentPreviewSvg(input: {
  outputPath: string;
  label: string;
  modelCount: number;
  status?: unknown;
}): Promise<void> {
  const label = svgText(input.label || 'Component 3D asset');
  const status = svgText(input.status || 'generated');
  const modelText = svgText(`${input.modelCount} GLB asset${input.modelCount === 1 ? '' : 's'}`);
  await writeFile(input.outputPath, `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <rect width="960" height="540" fill="#111827"/>
  <rect x="56" y="56" width="848" height="428" rx="16" fill="#f8fafc"/>
  <rect x="86" y="86" width="170" height="170" rx="18" fill="#dbeafe"/>
  <path d="M171 122l67 39v78l-67 39-67-39v-78z" fill="#2563eb" opacity="0.92"/>
  <path d="M171 122v78l67 39M171 200l-67 39" fill="none" stroke="#eff6ff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="296" y="154" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="34" font-weight="700" fill="#111827">${label}</text>
  <text x="296" y="212" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="25" fill="#334155">${modelText}</text>
  <text x="296" y="260" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="22" fill="#64748b">Visionary layout placement ready</text>
  <rect x="296" y="316" width="244" height="46" rx="23" fill="#dcfce7"/>
  <text x="320" y="347" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="21" font-weight="650" fill="#166534">${status}</text>
</svg>
`, 'utf8');
}

async function writeGradientThumbnailSvg(input: {
  outputPath: string;
  label: string;
  index: number;
}): Promise<void> {
  const label = svgText(input.label || 'GLB asset');
  const hue = (input.index * 47) % 360;
  await writeFile(input.outputPath, `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue}, 78%, 58%)"/>
      <stop offset="0.55" stop-color="hsl(${(hue + 55) % 360}, 70%, 46%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 120) % 360}, 72%, 32%)"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="28" fill="url(#g)"/>
  <g fill="none" stroke="rgba(255,255,255,0.88)" stroke-width="18" stroke-linejoin="round">
    <path d="M256 104l132 76v152l-132 76-132-76V180z"/>
    <path d="M256 104v152l132 76M256 256l-132 76"/>
  </g>
  <rect x="44" y="392" width="424" height="72" rx="18" fill="rgba(15,23,42,0.42)"/>
  <text x="256" y="436" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="24" font-weight="700" fill="#fff">${label}</text>
</svg>
`, 'utf8');
}

async function countGeneratedGlbs(sourceBatchDir: string, imageIndex: number): Promise<number> {
  const hunyuanDir = path.join(sourceBatchDir, 'pipeline_output', 'hunyuan_outputs', imageStem(imageIndex));
  return (await collectGlbFiles(hunyuanDir)).length;
}

async function collectDemoGlbFiles(): Promise<string[]> {
  return collectGlbFiles(COMPONENTS_3D_DEMO_GLB_DIR);
}

function abortError(): Error {
  const error = new Error('Components 3D generation was canceled');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort);
      resolve();
    }, ms);
    const handleAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', handleAbort);
      reject(abortError());
    };
    if (signal?.aborted) {
      handleAbort();
      return;
    }
    signal?.addEventListener('abort', handleAbort, { once: true });
  });
}

function linkAbortSignal(signal: AbortSignal | undefined, controller: AbortController): () => void {
  if (!signal) return () => undefined;
  const handleAbort = () => controller.abort();
  if (signal.aborted) {
    controller.abort();
    return () => undefined;
  }
  signal.addEventListener('abort', handleAbort, { once: true });
  return () => signal.removeEventListener('abort', handleAbort);
}

function responseProviderError(payload: JsonRecord): string {
  const response = readRecord(payload.Response);
  const error = readRecord(response.Error);
  if (!Object.keys(error).length) return '';
  const code = String(error.Code || 'ProviderError');
  const message = String(error.Message || '').trim();
  return message ? `${code}: ${message}` : code;
}

async function postCompatible3DProvider(input: {
  baseUrl: string;
  action: string;
  body: JsonRecord;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<JsonRecord> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const unlinkAbortSignal = linkAbortSignal(input.signal, controller);
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, input.timeoutMs || 60_000);
  try {
    const response = await fetch(`${input.baseUrl.replace(/\/+$/, '')}/`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-TC-Action': input.action,
      },
      body: JSON.stringify(input.body),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${input.action} failed with HTTP ${response.status}: ${text.slice(0, 500)}`);
    }
    const payload = JSON.parse(text) as JsonRecord;
    const providerError = responseProviderError(payload);
    if (providerError) {
      throw new Error(`${input.action} failed: ${providerError}`);
    }
    return payload;
  } catch (error) {
    if (input.signal?.aborted) throw abortError();
    if (error instanceof Error && error.name === 'AbortError') {
      if (timedOut) {
        throw new Components3DProviderRequestError(
          input.action,
          Date.now() - startedAt,
          new Error(`${input.action} timed out after ${input.timeoutMs || 60_000}ms`, { cause: error }),
        );
      }
    }
    throw error instanceof Components3DProviderRequestError
      ? error
      : new Components3DProviderRequestError(input.action, Date.now() - startedAt, error);
  } finally {
    clearTimeout(timeout);
    unlinkAbortSignal();
  }
}

function limitedDiagnosticValue(value: unknown, depth = 0): unknown {
  if (depth > 3) return '[truncated]';
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.slice(0, 500);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => limitedDiagnosticValue(item, depth + 1));
  if (!value || typeof value !== 'object') return String(value ?? '');
  const output: JsonRecord = {};
  for (const [key, item] of Object.entries(value as JsonRecord).slice(0, 40)) {
    if (/authorization|secret|token|imagebase64|api.?key/i.test(key)) continue;
    output[key] = limitedDiagnosticValue(item, depth + 1);
  }
  return output;
}

function diagnosticErrorRecord(error: unknown): JsonRecord {
  const record: JsonRecord = {};
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (current instanceof Error) {
      if (!record.name) record.name = current.name;
      if (!record.message) record.message = current.message.slice(0, 1000);
      const errorRecord = current as Error & {
        code?: unknown;
        errno?: unknown;
        syscall?: unknown;
        address?: unknown;
        port?: unknown;
      };
      for (const key of ['code', 'errno', 'syscall', 'address', 'port'] as const) {
        const value = errorRecord[key];
        if (value !== undefined && record[key] === undefined) record[key] = limitedDiagnosticValue(value);
      }
      current = current.cause;
      continue;
    }
    if (typeof current === 'object') {
      Object.assign(record, limitedDiagnosticValue(current));
    }
    break;
  }
  return record;
}

async function queryTrellisDiagnosticProbe(url: string, timeoutMs = 2500): Promise<Components3DDiagnosticProbe> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    const text = await response.text();
    let payload: unknown = text.trim().slice(0, 2000);
    if (text.trim()) {
      try {
        payload = limitedDiagnosticValue(JSON.parse(text));
      } catch {}
    }
    return {
      url,
      ok: response.ok,
      httpStatus: response.status,
      durationMs: Date.now() - startedAt,
      ...(payload === '' ? {} : { payload }),
      ...(!response.ok ? { error: `${response.status} ${response.statusText}`.trim() } : {}),
    };
  } catch (error) {
    return {
      url,
      ok: false,
      httpStatus: null,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error && error.name === 'AbortError'
        ? `diagnostic request timed out after ${timeoutMs}ms`
        : error instanceof Error
          ? error.message
          : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

const trellisDiagnosticSnapshots = new Map<string, {
  expiresAt: number;
  promise: Promise<Pick<Components3DFailureDiagnostics, 'health' | 'status'>>;
}>();

export async function collectComponents3DTrellisFailureDiagnostics(input: {
  baseUrl: string;
  jobId: string;
  action: string;
  elapsedMs?: number | null;
  error: unknown;
  lastProgress: Components3DAssetProgressItem;
}): Promise<Components3DFailureDiagnostics> {
  const endpoint = input.baseUrl.replace(/\/+$/, '');
  const now = Date.now();
  let cached = trellisDiagnosticSnapshots.get(endpoint);
  if (!cached || cached.expiresAt <= now) {
    cached = {
      expiresAt: now + 5000,
      promise: Promise.all([
        queryTrellisDiagnosticProbe(`${endpoint}/health`),
        queryTrellisDiagnosticProbe(`${endpoint}/status`),
      ]).then(([health, status]) => ({ health, status })),
    };
    trellisDiagnosticSnapshots.set(endpoint, cached);
  }
  const probes = await cached.promise;
  const requestError = input.error instanceof Components3DProviderRequestError ? input.error : null;
  return {
    version: 1,
    checkedAt: new Date().toISOString(),
    endpoint,
    client: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    request: {
      action: requestError?.action || input.action,
      jobId: input.jobId,
      elapsedMs: requestError?.elapsedMs ?? input.elapsedMs ?? null,
    },
    failure: diagnosticErrorRecord(input.error),
    lastProgress: {
      status: input.lastProgress.status,
      stageKey: input.lastProgress.stageKey,
      stageIndex: input.lastProgress.stageIndex,
      stageCount: input.lastProgress.stageCount,
      stageProgress: input.lastProgress.stageProgress,
      stageProgressEstimated: input.lastProgress.stageProgressEstimated,
      progress: input.lastProgress.progress,
      message: input.lastProgress.message,
      updatedAt: input.lastProgress.updatedAt,
    },
    ...probes,
  };
}

function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function hmacSha256(key: string | Buffer, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest();
}

function resolveHunyuanTencentCloudBaseUrl(config: Components3DEndpointConfig): string {
  const endpoint = config.baseUrl || config.host || 'https://ai3d.tencentcloudapi.com';
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint.replace(/\/+$/, '');
  }
  return `https://${endpoint.replace(/\/+$/, '')}`;
}

async function postHunyuanTencentCloudProvider(input: {
  config: Components3DEndpointConfig;
  action: string;
  body: JsonRecord;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<JsonRecord> {
  const secretId = String(input.config.secretId || '').trim();
  const secretKey = String(input.config.secretKey || '').trim();
  if (!secretId || !secretKey) {
    throw new Error('Hunyuan Tencent Cloud SecretId and SecretKey are required');
  }

  const baseUrl = resolveHunyuanTencentCloudBaseUrl(input.config);
  const endpoint = new URL(baseUrl);
  const host = endpoint.host;
  const service = 'ai3d';
  const version = input.config.version || '2025-05-13';
  const region = input.config.region || 'ap-guangzhou';
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const payload = JSON.stringify(input.body);
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\n`;
  const signedHeaders = 'content-type;host';
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    sha256Hex(payload),
  ].join('\n');
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const secretDate = hmacSha256(`TC3${secretKey}`, date);
  const secretService = hmacSha256(secretDate, service);
  const secretSigning = hmacSha256(secretService, 'tc3_request');
  const signature = createHmac('sha256', secretSigning).update(stringToSign).digest('hex');
  const authorization = [
    `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(', ');

  const controller = new AbortController();
  const unlinkAbortSignal = linkAbortSignal(input.signal, controller);
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, input.timeoutMs || 60_000);
  try {
    const response = await fetch(`${baseUrl}/`, {
      method: 'POST',
      headers: {
        authorization,
        'content-type': 'application/json; charset=utf-8',
        'x-tc-action': input.action,
        'x-tc-region': region,
        'x-tc-timestamp': String(timestamp),
        'x-tc-version': version,
      },
      body: payload,
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${input.action} failed with HTTP ${response.status}: ${text.slice(0, 500)}`);
    }
    const responsePayload = JSON.parse(text) as JsonRecord;
    const providerError = responseProviderError(responsePayload);
    if (providerError) {
      throw new Error(`${input.action} failed: ${providerError}`);
    }
    return responsePayload;
  } catch (error) {
    if (input.signal?.aborted) throw abortError();
    if (error instanceof Error && error.name === 'AbortError') {
      if (timedOut) {
        throw new Error(`${input.action} timed out after ${input.timeoutMs || 60_000}ms`);
      }
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    unlinkAbortSignal();
  }
}

async function post3DProvider(input: {
  provider: Exclude<Components3DGenerationConfig['provider'], 'mocked'>;
  baseUrl: string;
  config: Components3DEndpointConfig;
  action: string;
  body: JsonRecord;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<JsonRecord> {
  if (input.provider === 'hunyuan') {
    return postHunyuanTencentCloudProvider({
      config: input.config,
      action: input.action,
      body: input.body,
      timeoutMs: input.timeoutMs,
      signal: input.signal,
    });
  }
  return postCompatible3DProvider({
    baseUrl: input.baseUrl,
    action: input.action,
    body: input.body,
    timeoutMs: input.timeoutMs,
    signal: input.signal,
  });
}

function replaceUrlBase(url: string, newBase: string): string {
  if (!newBase) return url;
  const oldUrl = new URL(url);
  const replacement = new URL(newBase.replace(/\/+$/, ''));
  return `${replacement.protocol}//${replacement.host}${oldUrl.pathname}${oldUrl.search}${oldUrl.hash}`;
}

function objectIdFromImagePath(filePath: string, fallbackIndex: number): string {
  const stem = path.basename(filePath, path.extname(filePath)).replace(/_concept$/i, '');
  return safeSegment(stem, `object_${String(fallbackIndex + 1).padStart(2, '0')}`);
}

function providerLabel(provider: Components3DGenerationConfig['provider']): string {
  if (provider === 'trellis.2') return 'TRELLIS.2';
  if (provider === 'hunyuan') return 'Hunyuan';
  return 'Mocked';
}

function terminalStatus(status: Components3DAssetStatus): boolean {
  return status === 'done' || status === 'failed' || status === 'TLE' || status === 'canceled';
}

export function aggregateComponents3DStatus(
  items: Components3DAssetProgressItem[],
  provider: Components3DGenerationConfig['provider'],
): 'running' | 'queuing' | 'failed' | 'TLE' | 'done' {
  const unfinished = items.filter((item) => !terminalStatus(item.status));
  if (unfinished.length > 0) {
    return provider === 'trellis.2' && unfinished.every((item) => item.status === 'queued')
      ? 'queuing'
      : 'running';
  }
  if (items.some((item) => item.status === 'TLE')) return 'TLE';
  if (items.some((item) => item.status === 'failed' || item.status === 'canceled')) return 'failed';
  return items.length > 0 && items.every((item) => item.status === 'done') ? 'done' : 'running';
}

function normalizedPercent(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(100, numeric));
}

function normalizedBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

function finiteNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function providerAssetProgressValue(response: JsonRecord): number {
  const providerProgress = normalizedPercent(response.Progress);
  if (providerProgress !== null) return providerProgress / 100;
  const stageIndex = Number(response.StageIndex);
  const stageCount = Number(response.StageCount);
  const stageProgress = normalizedPercent(response.StageProgress) || 0;
  if (!Number.isFinite(stageIndex) || !Number.isFinite(stageCount) || stageCount <= 0) return 0;
  return Math.max(0, Math.min(1, ((Math.max(1, stageIndex) - 1) + stageProgress / 100) / stageCount));
}

function providerProgressMessage(response: JsonRecord): string {
  const status = String(response.Status || '').trim();
  const progress = response.Progress == null ? '' : `${response.Progress}%`;
  const stage = String(response.Stage || '').trim();
  const stageIndex = response.StageIndex == null ? '' : String(response.StageIndex);
  const stageCount = response.StageCount == null ? '' : String(response.StageCount);
  const stageProgress = response.StageProgress == null ? '' : `${response.StageProgress}%`;
  const stageMessage = String(response.StageMessage || '').trim();
  return [
    status ? `status=${status}` : '',
    progress ? `progress=${progress}` : '',
    stage ? `stage=${stage}` : '',
    stageIndex || stageCount ? `stageIndex=${stageIndex}/${stageCount}` : '',
    stageProgress ? `stageProgress=${stageProgress}` : '',
    stageMessage,
  ].filter(Boolean).join(' ');
}

export async function pollCompatible3DProviderJob(input: {
  baseUrl: string;
  provider: Exclude<Components3DGenerationConfig['provider'], 'mocked'>;
  jobId: string;
  config: Components3DEndpointConfig;
  signal?: AbortSignal;
  onUpdate?: (update: Components3DAssetProgressUpdate) => void;
}): Promise<JsonRecord> {
  const inactivityTimeoutMs = Math.max(1, input.config.maxWaitSeconds) * 1000;
  let inactivityDeadline = Date.now() + inactivityTimeoutMs;
  let lastActivityKey = '';
  let lastUpdateKey = '';
  while (Date.now() < inactivityDeadline) {
    throwIfAborted(input.signal);
    const payload = await post3DProvider({
      provider: input.provider,
      baseUrl: input.baseUrl,
      config: input.config,
      action: 'QueryHunyuanTo3DProJob',
      body: {
        JobId: input.jobId,
      },
      signal: input.signal,
    });
    const response = readRecord(payload.Response);
    const status = String(response.Status || '').trim().toUpperCase();
    const message = providerProgressMessage(response);
    const stageProgress = normalizedPercent(response.StageProgress);
    const stageIndex = finiteNumberOrNull(response.StageIndex);
    const stageCount = finiteNumberOrNull(response.StageCount);
    const progress = providerAssetProgressValue(response);
    const activityKey = [
      status,
      String(response.Stage || '').trim(),
      normalizedPercent(response.Progress),
      stageIndex,
      stageProgress,
    ].join('|');
    if (input.provider === 'trellis.2' && activityKey !== lastActivityKey) {
      lastActivityKey = activityKey;
      inactivityDeadline = Date.now() + inactivityTimeoutMs;
    }
    const nextStatus: Components3DAssetStatus = status === 'DONE' || status === 'SUCCESS' || status === 'SUCCEEDED'
      ? 'downloading'
      : status === 'FAIL' || status === 'FAILED' || status === 'ERROR'
        ? 'failed'
        : status === 'CANCELLED' || status === 'CANCELED'
          ? 'canceled'
        : /QUEUE|PENDING|WAIT/i.test(status)
          ? 'queued'
          : 'running';
    const updateKey = `${nextStatus}|${message}|${response.Progress}|${response.StageIndex}|${response.StageCount}|${response.StageProgress}|${response.StageProgressEstimated}`;
    if (updateKey !== lastUpdateKey) {
      lastUpdateKey = updateKey;
      input.onUpdate?.({
        status: nextStatus,
        jobId: input.jobId,
        stageKey: String(response.Stage || '').trim(),
        stageIndex,
        stageCount,
        stageProgress,
        stageProgressEstimated: normalizedBoolean(response.StageProgressEstimated),
        progress: nextStatus === 'downloading' ? Math.min(0.99, progress) : progress,
        message,
        ...(nextStatus === 'failed'
          ? { error: String(response.ErrorMessage || response.StageMessage || message || 'provider job failed') }
          : {}),
      });
    }
    if (status === 'DONE' || status === 'SUCCESS' || status === 'SUCCEEDED') {
      return response;
    }
    if (status === 'FAIL' || status === 'FAILED' || status === 'ERROR') {
      throw new Error(`${providerLabel(input.provider)} job ${input.jobId} failed: ${String(response.ErrorMessage || response.StageMessage || message || 'unknown error')}`);
    }
    if (status === 'CANCELLED' || status === 'CANCELED') {
      throw new Components3DProviderCanceledError(
        input.provider,
        input.jobId,
        String(response.CancelReason || response.StageMessage || message || ''),
      );
    }
    await sleep(Math.max(200, input.config.pollIntervalSeconds * 1000), input.signal);
  }
  if (input.provider === 'trellis.2') {
    throw new Components3DProviderInactivityError(input.provider, input.jobId, input.config.maxWaitSeconds);
  }
  throw new Error(`${providerLabel(input.provider)} job ${input.jobId} timed out after ${input.config.maxWaitSeconds}s`);
}

export async function cancelComponents3DTrellisJob(input: {
  config: Components3DEndpointConfig;
  jobId: string;
  reason?: string;
  signal?: AbortSignal;
}): Promise<Components3DTrellisCancelResult> {
  const jobId = String(input.jobId || '').trim();
  if (!jobId) throw new Error('TRELLIS.2 jobId is required');
  const reason = String(input.reason || '').trim();
  const payload = await post3DProvider({
    provider: 'trellis.2',
    baseUrl: components3DEndpointBaseUrl(input.config),
    config: input.config,
    action: 'CancelHunyuanTo3DProJob',
    body: {
      JobId: jobId,
      ...(reason ? { Reason: reason } : {}),
    },
    signal: input.signal,
  });
  const response = readRecord(payload.Response);
  return {
    jobId: String(response.JobId || jobId).trim(),
    status: String(response.Status || '').trim(),
    cancelRequested: normalizedBoolean(response.CancelRequested),
    cancelled: normalizedBoolean(response.Cancelled) || ['CANCELLED', 'CANCELED'].includes(String(response.Status || '').trim().toUpperCase()),
    requestId: String(response.RequestId || '').trim(),
    response,
  };
}

async function downloadProviderGlb(url: string, outputPath: string, signal?: AbortSignal): Promise<number> {
  throwIfAborted(signal);
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`GLB download failed with HTTP ${response.status}: ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength <= 0) {
    throw new Error(`GLB download returned an empty file: ${url}`);
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);
  return buffer.byteLength;
}

function minimalGlbBuffer(): Buffer {
  const json = Buffer.from(JSON.stringify({
    asset: {
      version: '2.0',
      generator: 'Visionary mock Hunyuan',
    },
  }), 'utf8');
  const padding = (4 - (json.length % 4)) % 4;
  const jsonChunk = Buffer.concat([json, Buffer.alloc(padding, 0x20)]);
  const totalLength = 12 + 8 + jsonChunk.length;
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const chunkHeader = Buffer.alloc(8);
  chunkHeader.writeUInt32LE(jsonChunk.length, 0);
  chunkHeader.write('JSON', 4, 'ascii');
  return Buffer.concat([header, chunkHeader, jsonChunk]);
}

async function writeMockHunyuanOutputs(input: {
  sourceBatchDir: string;
  imageIndex: number;
  annotations: JsonRecord[];
}): Promise<number> {
  const stem = imageStem(input.imageIndex);
  const singleObjectsDir = path.join(input.sourceBatchDir, 'pipeline_output', 'single_objects', stem);
  const hunyuanDir = path.join(input.sourceBatchDir, 'pipeline_output', 'hunyuan_outputs', stem);
  await rm(hunyuanDir, { recursive: true, force: true });
  await mkdir(hunyuanDir, { recursive: true });
  const demoGlbPaths = await collectDemoGlbFiles();
  const glbBuffer = minimalGlbBuffer();
  const results = [];
  for (let index = 0; index < COMPONENTS_3D_DEMO_ASSET_COUNT; index += 1) {
    const demoGlbPath = demoGlbPaths.length > 0 ? demoGlbPaths[index % demoGlbPaths.length] : '';
    const sourceName = demoGlbPath ? path.basename(demoGlbPath, path.extname(demoGlbPath)) : `demo_component_${index + 1}`;
    const annotation = input.annotations[index] || {};
    const objectId = `object_${String(index + 1).padStart(2, '0')}_${safeSegment(
      String(annotation.label || sourceName || `component_${index + 1}`),
      `component_${index + 1}`,
    )}`;
    const modelPath = path.join(hunyuanDir, `${objectId}_model.glb`);
    if (demoGlbPath) {
      await copyFile(demoGlbPath, modelPath);
    } else {
      await writeFile(modelPath, glbBuffer);
    }
    results.push({
      object_id: objectId,
      success: true,
      skipped: false,
      job_id: `mock-hunyuan-${String(index + 1).padStart(3, '0')}`,
      model_paths: [modelPath],
      demo_source_path: demoGlbPath || null,
      placement_mode: 'glb_embedded_transform',
      error: null,
      input_order: index,
    });
  }
  const modelIndexPath = path.join(hunyuanDir, 'model_index.json');
  await writeFile(modelIndexPath, `${JSON.stringify({
    timestamp: nowRunId(),
    source_dir: singleObjectsDir,
    total: results.length,
    success: results.length,
    skipped: 0,
    failed: 0,
    results,
  }, null, 2)}\n`, 'utf8');
  const hunyuanRoot = path.dirname(hunyuanDir);
  await mkdir(hunyuanRoot, { recursive: true });
  await writeFile(path.join(hunyuanRoot, 'hunyuan_index.json'), `${JSON.stringify({
    timestamp: nowRunId(),
    source_batch: input.sourceBatchDir,
    total_images: 1,
    success: results.length > 0 ? 1 : 0,
    skipped: 0,
    failed: results.length > 0 ? 0 : 1,
    results: [{
      index: input.imageIndex,
      image_index: input.imageIndex,
      success: results.length > 0,
      skipped: false,
      input_dir: singleObjectsDir,
      output_dir: hunyuanDir,
      model_index: modelIndexPath,
      total: results.length,
      success_count: results.length,
      skipped_count: 0,
      failed_count: 0,
    }],
  }, null, 2)}\n`, 'utf8');
  return results.length;
}

async function writeCompatibleApiHunyuanOutputs(input: {
  title: string;
  sourceBatchDir: string;
  objectImagePaths: string[];
  annotations: JsonRecord[];
  imageIndex: number;
  provider: Exclude<Components3DGenerationConfig['provider'], 'mocked'>;
  config: Components3DEndpointConfig;
  onProgress?: Components3DProgressHandler;
  signal?: AbortSignal;
  user: string;
  projectId: string;
  attemptId: string;
  stepExecutionId: string;
  targetAssetId?: string;
  onAssetDownloaded?: (asset: {
    index: number;
    objectImagePath: string;
    layoutLabel: string;
    modelPath: string;
  }) => void | Promise<void>;
}): Promise<number> {
  let baseUrl: string;
  try {
    baseUrl = input.provider === 'hunyuan'
      ? resolveHunyuanTencentCloudBaseUrl(input.config)
      : components3DEndpointBaseUrl(input.config);
  } catch (error) {
    if (error instanceof UserApiConfigValidationError) {
      throw new Error(error.message);
    }
    throw error;
  }
  const stem = imageStem(input.imageIndex);
  const objectImages = input.objectImagePaths;
  const objectImagesSourceDir = objectImages.length > 0 ? path.dirname(objectImages[0]) : '';
  const hunyuanDir = path.join(input.sourceBatchDir, 'pipeline_output', 'hunyuan_outputs', stem);
  if (objectImages.length <= 0) {
    throw new Error(`No object images were provided for ${providerLabel(input.provider)} 3D generation. Run the object-images stage first.`);
  }

  if (!input.targetAssetId) {
    await rm(hunyuanDir, { recursive: true, force: true });
  }
  await mkdir(hunyuanDir, { recursive: true });
  const progressItems: Components3DAssetProgressItem[] = objectImages.map((objectImagePath, index) => {
    const annotation = input.annotations[index] || {};
    const layoutLabel = String(annotation.label || annotation.object || objectIdFromImagePath(objectImagePath, index));
    return {
      assetId: `component_3d_${String(index + 1).padStart(3, '0')}`,
      assetExecutionId: `${input.stepExecutionId}:component_3d_${String(index + 1).padStart(3, '0')}`,
      stepExecutionId: input.stepExecutionId,
      ordinal: index + 1,
      label: layoutLabel,
      modelName: buildComponents3DObjectName({
        ordinal: index + 1,
        label: layoutLabel,
        provider: input.provider,
        model: input.config.model,
      }),
      jobId: '',
      status: 'pending',
      stageKey: '',
      stageIndex: null,
      stageCount: null,
      stageProgress: null,
      stageProgressEstimated: false,
      progress: 0,
      message: '',
      updatedAt: new Date().toISOString(),
    };
  });
  const modelIndexPath = path.join(hunyuanDir, 'model_index.json');
  const results: Array<JsonRecord | undefined> = Array.from({ length: objectImages.length });
  if (input.targetAssetId && await pathExists(modelIndexPath)) {
    const previousIndex = readRecord(await readJsonFile(modelIndexPath));
    const previousResults = Array.isArray(previousIndex.results)
      ? previousIndex.results.map(readRecord)
      : [];
    previousResults.forEach((result) => {
      const index = Number(result.input_order);
      if (Number.isInteger(index) && index >= 0 && index < results.length) {
        results[index] = result;
      }
    });
  }
  let revision = 0;
  const buildAssetProgress = (): Components3DAssetProgressSnapshot => {
    const scopedItems = input.targetAssetId
      ? progressItems.filter((item) => item.assetId === input.targetAssetId)
      : progressItems;
    const completed = scopedItems.filter((item) => item.status === 'done').length;
    const failed = scopedItems.filter((item) => item.status === 'failed' || item.status === 'TLE').length;
    const timedOut = scopedItems.filter((item) => item.status === 'TLE').length;
    const submitted = scopedItems.filter((item) => item.jobId || item.status !== 'pending').length;
    const running = scopedItems.filter((item) => !terminalStatus(item.status) && item.status !== 'pending').length;
    return {
      version: 1,
      revision,
      provider: input.provider,
      total: scopedItems.length,
      submitted,
      running,
      completed,
      failed,
      timedOut,
      items: scopedItems.map((item) => ({ ...item })),
    };
  };
  const publishAssetUpdate = (index: number, update: Components3DAssetProgressUpdate): void => {
    const item = progressItems[index];
    if (!item) return;
    const nextProgress = update.progress === undefined
      ? item.progress
      : Math.max(item.progress, Math.max(0, Math.min(1, update.progress)));
    Object.assign(item, update, {
      progress: nextProgress,
      updatedAt: new Date().toISOString(),
    });
    revision += 1;
    const snapshot = buildAssetProgress();
    const aggregateStatus = aggregateComponents3DStatus(progressItems, input.provider);
    const workProgress = progressItems.length > 0
      ? progressItems.reduce((total, current) => (
        total + (terminalStatus(current.status) ? 1 : current.progress)
      ), 0) / progressItems.length
      : 0;
    emitProgress(
      input.title,
      update.message || `${providerLabel(input.provider)} 生成 ${index + 1}/${objectImages.length}`,
      0.35 + workProgress * 0.46,
      {
        provider: input.provider,
        ...(item.jobId ? { jobId: item.jobId } : {}),
        statusId: aggregateStatus,
        assetProgress: snapshot,
      },
      input.onProgress,
    );
  };

  const processAsset = async (index: number): Promise<void> => {
    const objectImagePath = objectImages[index];
    const objectId = objectIdFromImagePath(objectImagePath, index);
    const annotation = input.annotations[index] || {};
    const layoutLabel = String(annotation.label || annotation.object || objectId);
    const modelName = progressItems[index].modelName;
    const progressItem = progressItems[index];
    const assetController = new AbortController();
    const unlinkAbortSignal = linkAbortSignal(input.signal, assetController);
    const registryEntry: Components3DActiveAssetExecution = {
      user: input.user,
      projectId: input.projectId,
      attemptId: input.attemptId,
      stepExecutionId: input.stepExecutionId,
      assetExecutionId: progressItem.assetExecutionId,
      assetId: progressItem.assetId,
      controller: assetController,
      cancelRequested: false,
    };
    const unregisterExecution = registerComponents3DAssetExecution(registryEntry);
    let jobId = '';
    let providerAction = 'SubmitHunyuanTo3DProJob';
    try {
      throwIfAborted(assetController.signal);
      publishAssetUpdate(index, {
        status: 'submitting',
        message: `${providerLabel(input.provider)} 提交 ${index + 1}/${objectImages.length}: ${path.basename(objectImagePath)}`,
      });
      const imageBase64 = (await readFile(objectImagePath)).toString('base64');
      throwIfAborted(assetController.signal);
      const submitBody: JsonRecord = {
        Model: input.config.model,
        ImageBase64: imageBase64,
      };
      if (input.config.callbackUrl) submitBody.CallbackUrl = input.config.callbackUrl;
      const submit = await post3DProvider({
        provider: input.provider,
        baseUrl,
        config: input.config,
        action: 'SubmitHunyuanTo3DProJob',
        body: submitBody,
        signal: assetController.signal,
      });
      jobId = String(readRecord(submit.Response).JobId || '').trim();
      if (!jobId) throw new Error(`${providerLabel(input.provider)} submit response has no JobId`);
      if (input.provider === 'trellis.2') {
        registryEntry.cancelProviderJob = () => cancelComponents3DTrellisJob({
          config: input.config,
          jobId,
          reason: 'Visionary execution canceled',
        });
        if (registryEntry.cancelRequested) {
          Promise.resolve(registryEntry.cancelProviderJob()).catch(() => undefined);
        }
      }
      throwIfAborted(assetController.signal);
      publishAssetUpdate(index, {
        status: 'queued',
        jobId,
        message: `${providerLabel(input.provider)} 已提交 ${index + 1}/${objectImages.length}`,
      });
      providerAction = 'QueryHunyuanTo3DProJob';
      const done = await pollCompatible3DProviderJob({
        baseUrl,
        provider: input.provider,
        jobId,
        config: input.config,
        signal: assetController.signal,
        onUpdate: (update) => publishAssetUpdate(index, update),
      });
      throwIfAborted(assetController.signal);
      const resultFiles = Array.isArray(done.ResultFile3Ds) ? done.ResultFile3Ds.map(readRecord) : [];
      const firstGlbUrl = String(resultFiles[0]?.Url || '').trim();
      if (!firstGlbUrl) throw new Error(`${providerLabel(input.provider)} job ${jobId} completed without ResultFile3Ds[0].Url`);
      const downloadUrl = input.provider === 'trellis.2'
        ? replaceUrlBase(firstGlbUrl, baseUrl)
        : replaceUrlBase(firstGlbUrl, input.config.downloadBaseUrl);
      const modelPath = path.join(hunyuanDir, `${modelName}.glb`);
      publishAssetUpdate(index, {
        status: 'downloading',
        jobId,
        progress: Math.max(progressItems[index].progress, 0.99),
        message: `${providerLabel(input.provider)} 下载 ${index + 1}/${objectImages.length}: ${jobId}`,
      });
      providerAction = 'DownloadResultFile3D';
      const bytes = await downloadProviderGlb(downloadUrl, modelPath, assetController.signal);
      throwIfAborted(assetController.signal);
      results[index] = {
        object_id: objectId,
        layout_label: layoutLabel,
        model_name: modelName,
        success: true,
        skipped: false,
        job_id: jobId,
        provider: input.provider,
        model: input.config.model,
        input_image: objectImagePath,
        model_paths: [modelPath],
        result_url: firstGlbUrl,
        download_url: downloadUrl,
        bytes,
        placement_mode: 'layout_bbox',
        error: null,
        input_order: index,
      };
      await input.onAssetDownloaded?.({
        index,
        objectImagePath,
        layoutLabel,
        modelPath,
      });
      throwIfAborted(assetController.signal);
      publishAssetUpdate(index, {
        status: 'done',
        jobId,
        progress: 1,
        message: `${providerLabel(input.provider)} 完成 ${index + 1}/${objectImages.length}`,
      });
    } catch (error) {
      const canceled = assetController.signal.aborted
        || error instanceof Components3DProviderCanceledError
        || error instanceof Error && error.name === 'AbortError';
      const timedOut = error instanceof Components3DProviderInactivityError;
      const message = error instanceof Error ? error.message : String(error);
      const status: Components3DAssetStatus = canceled ? 'canceled' : timedOut ? 'TLE' : 'failed';
      const diagnostics = input.provider === 'trellis.2' && !canceled
        ? await collectComponents3DTrellisFailureDiagnostics({
          baseUrl,
          jobId,
          action: providerAction,
          error,
          lastProgress: progressItems[index],
        })
        : undefined;
      results[index] = {
        object_id: objectId,
        layout_label: layoutLabel,
        model_name: modelName,
        success: false,
        skipped: false,
        job_id: jobId,
        provider: input.provider,
        model: input.config.model,
        input_image: objectImagePath,
        model_paths: [],
        error: message,
        ...(diagnostics ? { diagnostics } : {}),
        input_order: index,
      };
      publishAssetUpdate(index, {
        status,
        jobId,
        progress: progressItems[index].progress,
        error: message,
        ...(diagnostics ? { diagnostics } : {}),
        message: `${providerLabel(input.provider)} ${canceled ? '取消' : timedOut ? '超时' : '失败'} ${index + 1}/${objectImages.length}: ${message}`,
      });
    } finally {
      unlinkAbortSignal();
      unregisterExecution();
    }
  };

  const targetIndexes = Array.from({ length: objectImages.length }, (_, index) => index)
    .filter((index) => !input.targetAssetId || progressItems[index]?.assetId === input.targetAssetId);
  if (targetIndexes.length <= 0) {
    throw new Error(`Unknown components-3d asset: ${input.targetAssetId}`);
  }
  await Promise.all(targetIndexes.map((index) => processAsset(index)));
  throwIfAborted(input.signal);
  const orderedResults = results.filter((result): result is JsonRecord => Boolean(result));
  const attemptedResults = targetIndexes
    .map((index) => results[index])
    .filter((result): result is JsonRecord => Boolean(result));
  const successfulCount = orderedResults.filter((result) => result.success === true).length;
  const failedCount = orderedResults.length - successfulCount;
  const attemptedFailedCount = attemptedResults.filter((result) => result.success !== true).length;

  await writeFile(modelIndexPath, `${JSON.stringify({
    timestamp: nowRunId(),
    provider: input.provider,
    model: input.config.model,
    base_url: baseUrl,
    source_dir: objectImagesSourceDir,
    total: orderedResults.length,
    success: successfulCount,
    skipped: 0,
    failed: failedCount,
    results: orderedResults,
  }, null, 2)}\n`, 'utf8');
  const hunyuanRoot = path.dirname(hunyuanDir);
  await mkdir(hunyuanRoot, { recursive: true });
  await writeFile(path.join(hunyuanRoot, 'hunyuan_index.json'), `${JSON.stringify({
    timestamp: nowRunId(),
    provider: input.provider,
    model: input.config.model,
    source_batch: input.sourceBatchDir,
    total_images: 1,
    success: successfulCount === orderedResults.length && successfulCount > 0 ? 1 : 0,
    skipped: 0,
    failed: failedCount > 0 || orderedResults.length <= 0 ? 1 : 0,
    results: [{
      index: input.imageIndex,
      image_index: input.imageIndex,
      success: successfulCount === orderedResults.length && successfulCount > 0,
      skipped: false,
      input_dir: objectImagesSourceDir,
      output_dir: hunyuanDir,
      model_index: modelIndexPath,
      total: orderedResults.length,
      success_count: successfulCount,
      skipped_count: 0,
      failed_count: failedCount,
    }],
  }, null, 2)}\n`, 'utf8');
  if (attemptedFailedCount > 0) {
    const failedLabels = attemptedResults
      .filter((result) => result.success !== true)
      .map((result) => String(result.layout_label || result.object_id || 'asset'))
      .join(', ');
    throw new Error(`${providerLabel(input.provider)} ${attemptedFailedCount}/${attemptedResults.length} assets failed: ${failedLabels}`);
  }
  return successfulCount;
}

async function renderAndSelectFrontOrientation(input: {
  hunyuanDir: string;
}): Promise<{ orientationPath: string; warnings: string[] }> {
  const warnings: string[] = [];
  emitProgress('组件 3D 资产生成', '渲染 3D 模型正面候选图', 0.64);
  await runPythonScript([
    'render_front_candidates.py',
    '--hunyuan-dir',
    input.hunyuanDir,
    '--resolution',
    String(Number(process.env.VISIONARY_COMPONENTS_3D_FRONT_RENDER_RESOLUTION || 512) || 512),
  ], NEW_PIPELINE_ROOT);

  emitProgress('组件 3D 资产生成', '选择 3D 模型正面方向', 0.76);
  const selectArgs = [
    'select_front_with_vlm.py',
    '--hunyuan-dir',
    input.hunyuanDir,
  ];
  if (process.env.VISIONARY_COMPONENTS_3D_MOCK_VLM === '1') {
    selectArgs.push('--mock-response', '{"selected_panel":"A","selected_yaw":0,"has_clear_front":true,"confidence":0.95}');
    warnings.push('VLM front selection used mock response because VISIONARY_COMPONENTS_3D_MOCK_VLM=1.');
  }
  await runPythonScript(selectArgs, NEW_PIPELINE_ROOT);
  return {
    orientationPath: path.join(input.hunyuanDir, 'front_orientation.json'),
    warnings,
  };
}

async function injectLayoutBbox(input: {
  projectRoot: string;
  sourceBatchDir: string;
  imageIndex: number;
  layoutBboxJsonPath: string;
}): Promise<string> {
  const root = path.resolve(input.projectRoot);
  const sourceJsonPath = path.resolve(root, input.layoutBboxJsonPath);
  if (!isPathInside(root, sourceJsonPath)) {
    throw new Error('Resolved layout bbox path escapes project root.');
  }
  const stem = `image_${String(input.imageIndex).padStart(3, '0')}`;
  const targetDir = path.join(input.sourceBatchDir, 'pipeline_output', 'bbox_front', stem);
  const targetPath = path.join(targetDir, `${stem}_bbox_front.json`);
  await mkdir(targetDir, { recursive: true });
  await copyFile(sourceJsonPath, targetPath);
  return targetPath;
}

async function collectGlbFiles(rootDir: string): Promise<string[]> {
  if (!await pathExists(rootDir)) return [];
  const entries = await readdir(rootDir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) return collectGlbFiles(entryPath);
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.glb')) return [entryPath];
    return [];
  }));
  return files.flat().sort((a, b) => a.localeCompare(b));
}

async function collectObjectPreviewImages(rootDir: string): Promise<string[]> {
  if (!await pathExists(rootDir)) return [];
  const entries = await readdir(rootDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.(png|jpe?g|webp)$/i.test(entry.name))
    .map((entry) => path.join(rootDir, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

async function collectModelIndexInputImages(hunyuanDir: string): Promise<string[]> {
  const modelIndexPath = path.join(hunyuanDir, 'model_index.json');
  if (!await pathExists(modelIndexPath)) return [];
  const modelIndex = readRecord(await readJsonFile(modelIndexPath));
  const results = Array.isArray(modelIndex.results) ? modelIndex.results.map(readRecord) : [];
  const images: string[] = [];
  for (const result of results) {
    const inputImage = typeof result.input_image === 'string' ? result.input_image.trim() : '';
    if (inputImage && isRasterImagePath(inputImage) && await pathExists(inputImage)) {
      images.push(inputImage);
    }
  }
  return images;
}

function mimeTypeForImagePath(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.svg') return 'image/svg+xml';
  return 'image/png';
}

function isRasterImagePath(filePath: string): boolean {
  return /\.(png|jpe?g|webp)$/i.test(filePath);
}

async function resolveObjectImagePaths(input: {
  projectRoot: string;
  objectImagePaths?: string[];
  objectImagesDir?: string;
}): Promise<string[]> {
  const root = path.resolve(input.projectRoot);
  const resolved: string[] = [];
  const seen = new Set<string>();
  const addImagePath = async (value: string): Promise<void> => {
    const raw = String(value || '').trim().replace(/\\/g, '/');
    if (!raw) return;
    const candidate = path.isAbsolute(raw)
      ? path.resolve(raw)
      : path.resolve(root, raw.replace(/^\/+/, ''));
    if (!isPathInside(root, candidate)) {
      throw new Error(`Resolved object image path escapes project root: ${raw}`);
    }
    if (!isRasterImagePath(candidate) || !await pathExists(candidate)) return;
    if (seen.has(candidate)) return;
    seen.add(candidate);
    resolved.push(candidate);
  };

  for (const imagePath of input.objectImagePaths || []) {
    await addImagePath(imagePath);
  }
  const objectImagesDir = String(input.objectImagesDir || '').trim().replace(/\\/g, '/');
  if (objectImagesDir) {
    const dir = path.isAbsolute(objectImagesDir)
      ? path.resolve(objectImagesDir)
      : path.resolve(root, objectImagesDir.replace(/^\/+/, ''));
    if (!isPathInside(root, dir)) {
      throw new Error(`Resolved object images directory escapes project root: ${objectImagesDir}`);
    }
    for (const imagePath of await collectObjectPreviewImages(dir)) {
      await addImagePath(imagePath);
    }
  }
  return resolved;
}

function matchPreviewToModel(modelPath: string, previewPaths: string[], fallbackIndex: number): string {
  if (previewPaths.length <= 0) return '';
  const modelKey = normalizeModelKey(path.basename(modelPath));
  const matched = previewPaths.find((previewPath) => {
    const previewKey = normalizeModelKey(path.basename(previewPath));
    return modelKey && previewKey && (modelKey.includes(previewKey) || previewKey.includes(modelKey));
  });
  return matched || previewPaths[Math.min(fallbackIndex, previewPaths.length - 1)] || '';
}

function firstCandidateImage(item: JsonRecord): string {
  const candidateImages = readRecord(item.candidate_images);
  for (const key of ['0', '90', '180', '270']) {
    if (typeof candidateImages[key] === 'string') return candidateImages[key] as string;
  }
  for (const value of Object.values(candidateImages)) {
    if (typeof value === 'string') return value;
  }
  return '';
}

function selectedCandidateImage(item: JsonRecord): string {
  const candidateImages = readRecord(item.candidate_images);
  const selectedYaw = Number(item.selected_yaw ?? item.correction_yaw_deg);
  const selectedKey = Number.isFinite(selectedYaw) ? String(Math.round(selectedYaw)) : '';
  if (selectedKey && typeof candidateImages[selectedKey] === 'string') {
    return candidateImages[selectedKey] as string;
  }
  return firstCandidateImage(item);
}

function findCandidateManifestItem(manifestItems: JsonRecord[], modelPath: string, fallbackIndex: number): JsonRecord {
  if (manifestItems.length <= 0) return {};
  const modelKey = normalizeModelKey(path.basename(modelPath));
  const matched = manifestItems.find((item) => {
    const itemModelPath = typeof item.model_path === 'string' ? item.model_path : '';
    const itemModelFile = typeof item.model_file === 'string' ? item.model_file : itemModelPath;
    const itemKey = normalizeModelKey(path.basename(itemModelFile));
    return modelKey && itemKey && (modelKey.includes(itemKey) || itemKey.includes(modelKey));
  });
  return matched || manifestItems[Math.min(fallbackIndex, manifestItems.length - 1)] || {};
}

async function readComponents3DItems(input: {
  sourceBatchDir: string;
  imageIndex: number;
}): Promise<Component3DItem[]> {
  const stem = imageStem(input.imageIndex);
  const hunyuanDir = path.join(input.sourceBatchDir, 'pipeline_output', 'hunyuan_outputs', stem);
  const orientationPath = path.join(hunyuanDir, 'front_orientation.json');
  const manifestPath = path.join(hunyuanDir, 'front_candidates', 'front_candidates_manifest.json');
  const allGlbs = await collectGlbFiles(hunyuanDir);
  const objectPreviewDir = path.join(input.sourceBatchDir, 'pipeline_output', 'single_objects', stem);
  const objectPreviewPaths = [
    ...await collectObjectPreviewImages(objectPreviewDir),
    ...await collectModelIndexInputImages(hunyuanDir),
  ];
  const candidateManifest = await pathExists(manifestPath) ? readRecord(await readJsonFile(manifestPath)) : {};
  const candidateManifestItems = Array.isArray(candidateManifest.items)
    ? candidateManifest.items.map(readRecord)
    : [];
  if (!await pathExists(orientationPath)) {
    if (candidateManifestItems.length <= 0) {
      return allGlbs.map((modelPath, index) => ({
        id: `component_3d_${String(index + 1).padStart(3, '0')}`,
        ordinal: index,
        label: path.basename(modelPath, path.extname(modelPath)),
        previewPath: matchPreviewToModel(modelPath, objectPreviewPaths, index),
        thumbnailPath: matchPreviewToModel(modelPath, objectPreviewPaths, index),
        modelPaths: [modelPath],
        frontOrientationPath: orientationPath,
      }));
    }
    return candidateManifestItems.map((item, index) => {
      const modelPath = typeof item.model_path === 'string' ? item.model_path : allGlbs[index] || '';
      const frontRenderPath = selectedCandidateImage(item);
      const previewPath = frontRenderPath || matchPreviewToModel(modelPath, objectPreviewPaths, index);
      return {
        id: `component_3d_${String(index + 1).padStart(3, '0')}`,
        ordinal: index,
        label: String(item.label || path.basename(modelPath, path.extname(modelPath)) || `component_${index + 1}`),
        previewPath,
        thumbnailPath: previewPath,
        frontRenderPath,
        previewMimeType: previewPath ? mimeTypeForImagePath(previewPath) : undefined,
        modelPaths: modelPath ? [modelPath] : [],
        frontOrientationPath: orientationPath,
      };
    });
  }

  const orientation = readRecord(await readJsonFile(orientationPath));
  const items = Array.isArray(orientation.items) ? orientation.items.map(readRecord) : [];
  return items.map((item, index) => {
    const modelPath = typeof item.model_path === 'string' ? item.model_path : allGlbs[index] || '';
    const candidateSheetPath = typeof item.candidate_sheet === 'string' ? item.candidate_sheet : '';
    const candidateItem = findCandidateManifestItem(candidateManifestItems, modelPath, index);
    const objectPreviewPath = matchPreviewToModel(modelPath, objectPreviewPaths, index);
    const frontRenderPath = selectedCandidateImage({ ...candidateItem, ...item });
    const previewPath = frontRenderPath || objectPreviewPath || candidateSheetPath;
    return {
      id: `component_3d_${String(index + 1).padStart(3, '0')}`,
      ordinal: index,
      label: String(item.label || path.basename(modelPath, path.extname(modelPath)) || `component_${index + 1}`),
      previewPath,
      thumbnailPath: frontRenderPath || objectPreviewPath || previewPath,
      frontRenderPath,
      previewMimeType: previewPath ? mimeTypeForImagePath(previewPath) : undefined,
      modelPaths: modelPath ? [modelPath] : [],
      frontOrientationPath: orientationPath,
      candidateSheetPath,
      selectedYaw: item.correction_yaw_deg,
      confidence: item.confidence,
      status: item.status,
    };
  });
}

async function copyComponentOutputs(input: {
  projectRoot: string;
  outputRoot: string;
  items: Component3DItem[];
  renderFrontThumbnails?: boolean;
  onProgress?: (images: GeneratedAsset[], index: number, total: number) => void;
}): Promise<GeneratedAsset[]> {
  const previewsDir = path.join(input.outputRoot, 'previews');
  const frontRendersDir = path.join(input.outputRoot, 'front_renders');
  await mkdir(previewsDir, { recursive: true });
  await mkdir(frontRendersDir, { recursive: true });

  const assets: GeneratedAsset[] = [];
  const existingRelativePath = async (filePath: string | undefined): Promise<string> => {
    if (!filePath || !await pathExists(filePath)) return '';
    return toRelative(input.projectRoot, filePath);
  };
  for (const [index, item] of input.items.entries()) {
    const ordinal = Number.isInteger(item.ordinal) && item.ordinal >= 0 ? item.ordinal : index;
    const itemSlug = safeSegment(`${String(ordinal + 1).padStart(3, '0')}-${item.label}`, `component-${ordinal + 1}`);
    const copiedModelPaths: string[] = [];
    const canonicalModelReferences: CanonicalAssetReference[] = [];
    for (const modelPath of item.modelPaths) {
      if (!modelPath || !await pathExists(modelPath)) continue;
      const sourcePath = toRelative(input.projectRoot, modelPath);
      const canonicalAssetReference = await writeCanonicalProjectAssetFromFile({
        projectRoot: input.projectRoot,
        filePath: modelPath,
        mimeType: path.extname(modelPath).toLowerCase() === '.gltf' ? 'model/gltf+json' : 'model/gltf-binary',
        kind: 'model',
        sourcePath,
      });
      canonicalModelReferences.push(canonicalAssetReference);
      copiedModelPaths.push(canonicalAssetReference.path);
    }
    const hasPreview = Boolean(item.previewPath && await pathExists(item.previewPath));
    const previewTarget = hasPreview
      ? path.join(previewsDir, `${itemSlug}${path.extname(item.previewPath) || '.png'}`)
      : path.join(previewsDir, `${itemSlug}.svg`);
    if (hasPreview) {
      await copyFile(item.previewPath, previewTarget);
    } else {
      await writeComponentPreviewSvg({
        outputPath: previewTarget,
        label: item.label,
        modelCount: copiedModelPaths.length,
        status: item.status,
      });
    }
    let frontRenderTarget = '';
    if (item.frontRenderPath && isRasterImagePath(item.frontRenderPath) && await pathExists(item.frontRenderPath)) {
      frontRenderTarget = path.join(
        frontRendersDir,
        `${itemSlug}-front${path.extname(item.frontRenderPath) || '.png'}`,
      );
      await copyFile(item.frontRenderPath, frontRenderTarget);
    } else if (copiedModelPaths[0]) {
      frontRenderTarget = path.join(frontRendersDir, `${itemSlug}-front.png`);
      if (input.renderFrontThumbnails) {
        try {
          await runBlenderScript([
            path.join(VISIONARY_ROOT, 'scripts', 'render-glb-front-thumbnail.py'),
            '--',
            '--glb',
            path.resolve(input.projectRoot, copiedModelPaths[0]),
            '--output',
            frontRenderTarget,
            '--resolution',
            String(Number(process.env.VISIONARY_COMPONENTS_3D_FRONT_RENDER_RESOLUTION || 512) || 512),
            '--yaw',
            String(Number(item.selectedYaw) || 0),
          ]);
        } catch (error) {
          frontRenderTarget = path.join(frontRendersDir, `${itemSlug}-front.svg`);
          await writeGradientThumbnailSvg({
            outputPath: frontRenderTarget,
            label: item.label,
            index: ordinal,
          });
        }
      } else {
        frontRenderTarget = path.join(frontRendersDir, `${itemSlug}-front.svg`);
        await writeGradientThumbnailSvg({
          outputPath: frontRenderTarget,
          label: item.label,
          index: ordinal,
        });
      }
    }
    const sourceGlbPaths = (await Promise.all(
      item.modelPaths.map((modelPath) => existingRelativePath(modelPath)),
    )).filter(Boolean);
    const frontOrientationPath = await existingRelativePath(item.frontOrientationPath);
    const candidateSheetPath = await existingRelativePath(item.candidateSheetPath);
    const asset = await fileAsset(
      input.projectRoot,
      item.id,
      previewTarget,
      item.previewMimeType || (hasPreview ? 'image/png' : 'image/svg+xml'),
      {
        kind: 'components_3d',
        assetType: 'image',
        sourceOrdinal: ordinal,
        label: item.label,
        glbPaths: copiedModelPaths,
        canonicalAssetReferences: canonicalModelReferences,
        assetReferences: canonicalModelReferences,
        sourceGlbPaths,
        thumbnailPath: frontRenderTarget ? toRelative(input.projectRoot, frontRenderTarget) : '',
        frontRenderPath: frontRenderTarget ? toRelative(input.projectRoot, frontRenderTarget) : '',
        frontOrientationPath,
        candidateSheetPath,
        selectedYaw: item.selectedYaw,
        confidence: item.confidence,
        status: item.status,
      },
    );
    assets.push(asset);
    input.onProgress?.(assets, index + 1, input.items.length);
  }
  return assets;
}

function dependencyTree(input: {
  runId: string;
  sourceMainImagePath: string;
  sourceLayoutBboxPath: string;
  sourceBatchDir: string;
  injectedBboxPath: string;
  frontOrientationPath: string;
  outputRoot: string;
  images: GeneratedAsset[];
  projectRoot: string;
}): JsonRecord {
  const mainImageId = 'source_main_image';
  const layoutId = 'source_layout_bbox';
  const batchId = 'main_image_batch';
  const injectedBboxId = 'pipeline_bbox_json';
  const frontOrientationId = 'front_orientation';
  const outputId = 'components_3d_output';
  return {
    schema: 'visionary.new_pipeline.dependency_tree',
    version: 1,
    runId: input.runId,
    stage: 'components_3d_generation',
    nodes: [
      {
        id: mainImageId,
        kind: 'main_image',
        relativePath: input.sourceMainImagePath,
      },
      {
        id: layoutId,
        kind: 'layout_bbox_json',
        relativePath: input.sourceLayoutBboxPath,
      },
      {
        id: batchId,
        kind: 'main_image_batch',
        relativePath: toRelative(input.projectRoot, input.sourceBatchDir),
      },
      {
        id: injectedBboxId,
        kind: 'pipeline_bbox_json',
        relativePath: toRelative(input.projectRoot, input.injectedBboxPath),
      },
      {
        id: frontOrientationId,
        kind: 'front_orientation',
        relativePath: toRelative(input.projectRoot, input.frontOrientationPath),
      },
      {
        id: outputId,
        kind: 'components_3d_output',
        relativePath: toRelative(input.projectRoot, input.outputRoot),
      },
      ...input.images.map((asset) => ({
        id: asset.id,
        kind: 'components_3d_preview',
        relativePath: asset.relativePath,
        mimeType: asset.mimeType,
        bytes: asset.bytes,
        metadata: asset.metadata,
      })),
    ],
    edges: [
      {
        from: mainImageId,
        to: batchId,
        relation: 'belongs_to',
      },
      {
        from: layoutId,
        to: injectedBboxId,
        relation: 'injected_as_pipeline_bbox',
      },
      {
        from: injectedBboxId,
        to: frontOrientationId,
        relation: 'creates_default_orientation',
      },
      {
        from: batchId,
        to: outputId,
        relation: 'used_to_generate',
      },
      {
        from: frontOrientationId,
        to: outputId,
        relation: 'orients_generated_assets',
      },
      ...input.images.map((asset) => ({
        from: outputId,
        to: asset.id,
        relation: 'contains',
      })),
    ],
  };
}

export async function generateComponents3D(input: {
  projectRoot: string;
  projectId: string;
  mainImagePath: string;
  layoutBboxJsonPath: string;
  objectImagePaths?: string[];
  objectImagesDir?: string;
  runLabel: string;
  components3DConfig?: Components3DGenerationConfig;
  onProgress?: Components3DProgressHandler;
  signal?: AbortSignal;
  user?: string;
  attemptId?: string;
  stepExecutionId?: string;
  targetAssetId?: string;
}): Promise<JsonRecord> {
  const title = '组件 3D 资产生成';
  const root = path.resolve(input.projectRoot);
  const sourceMainImagePath = path.resolve(root, input.mainImagePath);
  const sourceLayoutBboxPath = path.resolve(root, input.layoutBboxJsonPath);
  if (!isPathInside(root, sourceMainImagePath) || !isPathInside(root, sourceLayoutBboxPath)) {
    throw new Error('Resolved source path escapes project root.');
  }
  const imageIndex = parseImageIndex(input.mainImagePath);
  const runId = nowRunId();
  const outputRoot = projectOutputRoot(input.projectRoot, input.projectId, input.runLabel, runId);
  const sourceBatchDir = path.dirname(sourceMainImagePath);
  const layoutAnnotations = await readLayoutAnnotations(sourceLayoutBboxPath);
  const components3DConfig = normalizeComponents3DGenerationConfig(
    input.components3DConfig ?? resolveComponents3DGenerationConfigFromEnv(),
  );
  const provider = components3DConfig.provider;
  const targetCount = provider === 'mocked'
    ? COMPONENTS_3D_DEMO_ASSET_COUNT
    : layoutAnnotations.length;
  const stem = imageStem(imageIndex);
  const hunyuanDir = path.join(sourceBatchDir, 'pipeline_output', 'hunyuan_outputs', stem);
  const warnings: string[] = [];
  let latestAssetProgress: Components3DAssetProgressSnapshot | undefined;
  let latestProgress = 0;
  const incrementalImagesById = new Map<string, GeneratedAsset>();
  const reportProgress: Components3DProgressHandler = (event) => {
    if (event.assetProgress) latestAssetProgress = event.assetProgress;
    latestProgress = Math.max(latestProgress, event.progress);
    return input.onProgress?.(event);
  };
  const providerProgressExtras = (): JsonRecord => ({
    provider,
    ...(latestAssetProgress ? { assetProgress: latestAssetProgress } : {}),
  });

  throwIfAborted(input.signal);
  emitProgress(title, '准备 3D 资产输入', 0.01, {}, reportProgress);
  await mkdir(outputRoot, { recursive: true });
  const injectedBboxPath = await injectLayoutBbox({
    projectRoot: input.projectRoot,
    sourceBatchDir,
    imageIndex,
    layoutBboxJsonPath: input.layoutBboxJsonPath,
  });

  emitProgress(
    title,
    `${providerLabel(provider)} 组件 3D 资产，已提交 0/${targetCount}，已完成 0/${targetCount}`,
    0.35,
    providerProgressExtras(),
    reportProgress,
  );
  if (provider === 'mocked') {
    await writeMockHunyuanOutputs({
      sourceBatchDir,
      imageIndex,
      annotations: layoutAnnotations,
    });
  } else {
    const endpointConfig = activeComponents3DEndpointConfig(components3DConfig);
    if (!endpointConfig) {
      throw new Error('3D generation provider config is missing');
    }
    const objectImagePaths = await resolveObjectImagePaths({
      projectRoot: input.projectRoot,
      objectImagePaths: input.objectImagePaths,
      objectImagesDir: input.objectImagesDir,
    });
    await writeCompatibleApiHunyuanOutputs({
      title,
      sourceBatchDir,
      objectImagePaths,
      annotations: layoutAnnotations,
      imageIndex,
      provider,
      config: endpointConfig,
      onProgress: reportProgress,
      signal: input.signal,
      user: String(input.user || ''),
      projectId: input.projectId,
      attemptId: String(input.attemptId || ''),
      stepExecutionId: String(input.stepExecutionId || `components-3d-${runId}`),
      targetAssetId: input.targetAssetId,
      onAssetDownloaded: provider === 'trellis.2'
        ? async ({ index, objectImagePath, layoutLabel, modelPath }) => {
          const [image] = await copyComponentOutputs({
            projectRoot: input.projectRoot,
            outputRoot,
            items: [{
              id: `component_3d_${String(index + 1).padStart(3, '0')}`,
              ordinal: index,
              label: layoutLabel,
              previewPath: objectImagePath,
              thumbnailPath: objectImagePath,
              previewMimeType: mimeTypeForImagePath(objectImagePath),
              modelPaths: [modelPath],
              frontOrientationPath: '',
            }],
            renderFrontThumbnails: false,
          });
          if (!image) {
            throw new Error(`TRELLIS.2 asset ${index + 1} could not be materialized for preview`);
          }
          incrementalImagesById.set(image.id, image);
          const completedImages = Array.from(incrementalImagesById.values()).sort((left, right) => (
            Number(left.metadata?.sourceOrdinal) - Number(right.metadata?.sourceOrdinal)
          ));
          emitProgress(
            title,
            `TRELLIS.2 资产预览已就绪 ${completedImages.length}/${targetCount}`,
            Math.max(0.35, latestProgress),
            {
              ...providerProgressExtras(),
              images: completedImages,
              completedCount: completedImages.length,
              totalCount: targetCount,
            },
            reportProgress,
          );
        }
        : undefined,
    });
  }
  const generatedGlbCount = await countGeneratedGlbs(sourceBatchDir, imageIndex);
  const completedCount = provider === 'mocked' ? Math.min(generatedGlbCount, targetCount) : generatedGlbCount;
  const totalCount = provider === 'mocked' ? targetCount : Math.max(targetCount, completedCount);
  const frontOrientationPath = await writeVisionaryFrontOrientation({
    sourceBatchDir,
    imageIndex,
    bboxJsonPath: sourceLayoutBboxPath,
    provider,
    model: activeComponents3DEndpointConfig(components3DConfig)?.model || '',
    // Mocked GLBs carry scene placement in the asset geometry; API-generated GLBs are object-local and use layout bbox placement.
    embeddedPlacement: provider === 'mocked',
  });
  if (provider === 'mocked') {
    const demoGlbPaths = await collectDemoGlbFiles();
    if (demoGlbPaths.length > 0) {
      warnings.push(`Using embedded transforms from ${COMPONENTS_3D_DEMO_GLB_DIR}; layout placement is skipped.`);
    } else {
      warnings.push('No demo GLB assets were found; wrote a minimal fallback GLB and inserted it at origin with embedded transform placement.');
    }
  } else {
    warnings.push(`Used ${providerLabel(provider)} provider with model ${activeComponents3DEndpointConfig(components3DConfig)?.model || ''}.`);
  }
  emitProgress(
    title,
    `写入 Visionary 资产位姿，已提交 ${totalCount}/${totalCount}，已完成 ${completedCount}/${totalCount}`,
    0.84,
    providerProgressExtras(),
    reportProgress,
  );

  emitProgress(title, '整理 3D 资产预览和依赖树', 0.9, providerProgressExtras(), reportProgress);
  const componentItems = await readComponents3DItems({
    sourceBatchDir,
    imageIndex,
  });
  const images = await copyComponentOutputs({
    projectRoot: input.projectRoot,
    outputRoot,
    items: componentItems,
    renderFrontThumbnails: process.env.VISIONARY_COMPONENTS_3D_RENDER_FRONT_THUMBNAILS === '1',
    onProgress: (completedImages, completed, total) => {
      emitProgress(
        title,
        `整理 3D 资产预览，已完成 ${completed}/${Math.max(total, totalCount)}`,
        0.9 + (Math.min(completed, Math.max(total, totalCount)) / Math.max(total, totalCount)) * 0.08,
        {
          ...providerProgressExtras(),
          images: completedImages,
          completedCount: completed,
          totalCount: Math.max(total, totalCount),
        },
        reportProgress,
      );
    },
  });
  if (images.length <= 0) {
    throw new Error(`${providerLabel(provider)} components-3d produced no usable artifacts`);
  }
  const tree = dependencyTree({
    runId,
    sourceMainImagePath: input.mainImagePath,
    sourceLayoutBboxPath: input.layoutBboxJsonPath,
    sourceBatchDir,
    injectedBboxPath,
    frontOrientationPath,
    outputRoot,
    images,
    projectRoot: input.projectRoot,
  });
  const manifestPath = path.join(outputRoot, 'dependency_tree.json');
  await writeFile(manifestPath, `${JSON.stringify(tree, null, 2)}\n`, 'utf8');

  emitProgress(title, '组件 3D 资产生成完成', 1, providerProgressExtras(), reportProgress);
  return {
    ok: true,
    stage: 'components_3d_generation',
    runId,
    batchOutput: {
      relativePath: toRelative(input.projectRoot, outputRoot),
    },
    images,
    assets3d: images.flatMap((image) => {
      const glbPaths = Array.isArray(image.metadata?.glbPaths) ? image.metadata.glbPaths : [];
      return glbPaths.map((relativePath) => ({
        type: 'viewer3d',
        relativePath,
      }));
    }),
    dependencyTree: {
      relativePath: toRelative(input.projectRoot, manifestPath),
      data: tree,
    },
    visionaryTask: {
      title,
      message: `${providerLabel(provider)} 已提交 ${totalCount}/${totalCount}，已完成 ${completedCount}/${totalCount} 个组件 3D 资产`,
      progress: 1,
      statusId: 'done',
      provider,
      ...(latestAssetProgress ? { assetProgress: latestAssetProgress } : {}),
    },
    warnings: images.length > 0 ? warnings : [...warnings, '未找到可展示的 3D 资产预览图。'],
  };
}

async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: 'visionary-new-pipeline-components-3d',
    version: '0.1.0',
  });

  server.registerTool(
    'generate_components_3d',
    {
      title: 'Generate component 3D assets',
      description: 'Generate GLB component models from object-images stage outputs, then write front orientation metadata for scene insertion.',
      inputSchema: {
        projectId: z.string().min(1).optional().describe('Optional Visionary project id. Defaults to the project id injected by the host runtime.'),
        mainImagePath: z.string().min(1).describe('Project-relative path of the applied main image.'),
        layoutBboxJsonPath: z.string().min(1).describe('Project-relative path of the applied layout bbox JSON.'),
        objectImagePaths: z.array(z.string()).default([]).describe('Project-relative object images produced by the object-images stage. Required for API providers.'),
        objectImagesDir: z.string().default('').describe('Project-relative object image gallery directory produced by the object-images stage.'),
        runLabel: z.string().default('components-3d').describe('Optional safe label appended to the run output directory.'),
      },
    },
    async ({ projectId, mainImagePath, layoutBboxJsonPath, objectImagePaths, objectImagesDir, runLabel }) => {
      try {
        const injectedProjectRoot = String(process.env.VISIONARY_PROJECT_ROOT || '').trim();
        if (!injectedProjectRoot) {
          throw new Error('VISIONARY_PROJECT_ROOT is not configured for this MCP server.');
        }
        const result = await generateComponents3D({
          projectId: projectId || String(process.env.VISIONARY_PROJECT_ID || 'project'),
          projectRoot: injectedProjectRoot,
          mainImagePath,
          layoutBboxJsonPath,
          objectImagePaths,
          objectImagesDir,
          runLabel,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const result = {
          ok: false,
          code: 'UPSTREAM_ERROR',
          message,
          recoverable: true,
          visionaryTask: {
            title: '组件 3D 资产生成',
            message,
            progress: 1,
            statusId: 'failed',
          },
        };
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
          isError: true,
        };
      }
    },
  );

  await server.connect(new StdioServerTransport());
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  await startMcpServer();
}
