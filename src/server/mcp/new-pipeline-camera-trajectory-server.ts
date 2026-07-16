#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

type JsonRecord = Record<string, unknown>;
type Vec3 = [number, number, number];
type QuatWxyz = [number, number, number, number];

const CAMERA_PIPELINE_STAGES = [
  'camera_scene_info_export',
  'camera_initial_view_prepare',
  'camera_director_analysis',
  'camera_trajectory_generation',
  'camera_trajectory_eval_render',
];

interface GeneratedAsset {
  id: string;
  relativePath: string;
  mimeType: string;
  bytes: number;
  metadata?: JsonRecord;
}

interface SceneInfoBundle {
  sceneFullInfo: JsonRecord;
  sceneInfo: JsonRecord;
  collectionsInfo: JsonRecord[];
  objectsInfo: JsonRecord[];
  warnings: string[];
}

interface TrajectoryKeyframe {
  frame: number;
  position: Vec3;
  rotation_quaternion: QuatWxyz;
}

interface TrajectoryCamera {
  camera_name: string;
  keyframes: TrajectoryKeyframe[];
  meta?: JsonRecord;
}

interface NormalizedCameraTimelineEntry {
  frame: number;
  time: number;
  cameraName: string;
  sourceFrame: number;
  segmentIndex: number;
  position: Vec3;
  rotationQuaternionWxyz: QuatWxyz;
  fovDegrees: number;
  timelineKeyframe: JsonRecord;
  fovKeyframe: JsonRecord;
}

interface CameraTrajectoryBoundaryDelta {
  position: number;
  rotationDegrees: number;
  fovDegrees: number;
}

interface PythonRunResult {
  stdout: string;
  stderr: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VISIONARY_ROOT = path.resolve(__dirname, '../../..');
const REPO_ROOT = path.resolve(VISIONARY_ROOT, '..');
const NEW_PIPELINE_ROOT = path.resolve(process.env.VISIONARY_NEW_PIPELINE_ROOT || path.join(REPO_ROOT, 'third-party', 'new_pipeline'));
const TRAJECTORY_GEN_ROOT = path.resolve(
  process.env.VISIONARY_TRAJECTORY_GEN_ROOT || path.join(REPO_ROOT, 'third-party', 'Trajectory_gen'),
);
const NEW_PIPELINE_PYTHON_BIN = path.join(NEW_PIPELINE_ROOT, '.venv', 'bin', 'python');
const TRAJECTORY_GEN_PYTHON_BIN = path.join(TRAJECTORY_GEN_ROOT, '.venv', 'bin', 'python');
const PYTHON_BIN = process.env.VISIONARY_TRAJECTORY_GEN_PYTHON
  || process.env.VISIONARY_NEW_PIPELINE_PYTHON
  || process.env.PYTHON
  || (existsSync(NEW_PIPELINE_PYTHON_BIN) ? NEW_PIPELINE_PYTHON_BIN : TRAJECTORY_GEN_PYTHON_BIN);
const VISIONARY_COORDINATE_SYSTEM = 'visionary_y_up_xz_ground';
const CAMERA_TRAJECTORY_STITCHING_THRESHOLDS = {
  position: 0.15,
  rotationDegrees: 5,
  fovDegrees: 1,
} as const;

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
  const safeLabel = safeSegment(runLabel, 'camera-trajectory');
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

async function readJsonFile(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

async function writeJsonFile(filePath: string, payload: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function writeTextFile(filePath: string, text: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, text, 'utf8');
}

async function fileAsset(projectRoot: string, id: string, filePath: string, mimeType: string, metadata: JsonRecord = {}): Promise<GeneratedAsset> {
  const info = await stat(filePath);
  return {
    id,
    relativePath: toRelative(projectRoot, filePath),
    mimeType,
    bytes: info.size,
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
}

async function existingInitialViewImages(projectRoot: string, paths: string[]): Promise<GeneratedAsset[]> {
  const root = path.resolve(projectRoot);
  const assets: GeneratedAsset[] = [];
  for (const [index, filePath] of paths.entries()) {
    const resolved = path.resolve(root, filePath);
    if (!isPathInside(root, resolved) || !await pathExists(resolved)) continue;
    assets.push(await fileAsset(
      projectRoot,
      `camera_initial_view_${String(index + 1).padStart(3, '0')}`,
      resolved,
      mimeTypeForPath(resolved),
      { kind: 'camera_initial_view', viewIndex: index },
    ));
  }
  return assets;
}

async function readDirectorIntentText(sceneAnalysisPath: string): Promise<string> {
  const intents: string[] = [];
  if (await pathExists(sceneAnalysisPath)) {
    const sceneAnalysis = readRecord(await readJsonFile(sceneAnalysisPath));
    const rawIntents = Array.isArray(sceneAnalysis.director_intents) ? sceneAnalysis.director_intents : [];
    rawIntents.forEach((item) => {
      const intent = String(readRecord(item).intent || '').trim();
      if (intent) intents.push(intent);
    });
  }
  const fallbackPath = path.join(path.dirname(sceneAnalysisPath), 'director_intent.txt');
  if (intents.length <= 0 && await pathExists(fallbackPath)) {
    const text = (await readFile(fallbackPath, 'utf8')).trim();
    if (text) intents.push(...text.split(/\r?\n+/).map((line) => line.trim()).filter(Boolean));
  }
  return intents
    .filter((item, index, list) => list.indexOf(item) === index)
    .map((item, index, list) => list.length > 1 ? `${index + 1}. ${item}` : item)
    .join('\n');
}

function inferCameraStageStatusId(message: string, progress: number): string {
  if (progress >= 1) return 'done';
  if (/渲染/.test(message)) return 'rendering';
  return 'running';
}

function emitProgress(title: string, message: string, progress: number, stage = '', statusId = '', options: {
  skipEvalRender?: boolean;
  evalRenderStatusId?: string;
} = {}): void {
  const normalizedStage = String(stage || '').trim();
  const normalizedStatusId = String(statusId || '').trim() || inferCameraStageStatusId(message, progress);
  const eventType = progress <= 0.01
    ? 'visionary.task.started'
    : ['done', 'skipped', 'canceled'].includes(normalizedStatusId)
      ? 'visionary.task.completed'
      : 'visionary.task.progress';
  const payload = {
    type: eventType,
    payload: {
      title,
      message,
      progress,
      pipelineStages: CAMERA_PIPELINE_STAGES,
      ...(normalizedStage ? { stage: normalizedStage } : {}),
      statusId: normalizedStatusId,
      ...(normalizedStage ? {
        pipelineStageStatuses: buildCameraPipelineStageStatuses(normalizedStage, normalizedStatusId, options),
      } : {}),
    },
  };
  process.stderr.write(`${JSON.stringify(payload)}\n`);
}

function buildCameraPipelineStageStatuses(currentStage: string, currentStatusId: string, options: {
  skipEvalRender?: boolean;
  evalRenderStatusId?: string;
} = {}): Array<{ stage: string; statusId: string }> {
  const normalizedStage = String(currentStage || '').trim();
  const currentIndex = CAMERA_PIPELINE_STAGES.indexOf(normalizedStage);
  return CAMERA_PIPELINE_STAGES.map((stage, index) => {
    if (index < currentIndex) {
      return { stage, statusId: 'done' };
    }
    if (index === currentIndex) {
      return { stage, statusId: currentStatusId || 'running' };
    }
    if (stage === 'camera_trajectory_eval_render' && options.evalRenderStatusId) {
      return { stage, statusId: options.evalRenderStatusId };
    }
    if (options.skipEvalRender && stage === 'camera_trajectory_eval_render') {
      return { stage, statusId: 'skipped' };
    }
    return { stage, statusId: 'pending' };
  });
}

function redactConfigForDebug(config: JsonRecord): JsonRecord {
  const redacted = { ...config };
  for (const key of ['api_key', 'apiKey', 'GENAI_API_KEY', 'GOOGLE_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'CODEX_API_KEY']) {
    if (typeof redacted[key] === 'string' && String(redacted[key]).trim()) {
      redacted[key] = '[redacted]';
    }
  }
  return redacted;
}

function mimeTypeForPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.txt') || lower.endsWith('.log')) return 'text/plain';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  return 'application/octet-stream';
}

async function collectFilesRecursive(rootDir: string, projectRoot: string): Promise<JsonRecord[]> {
  if (!await pathExists(rootDir)) return [];
  const result: JsonRecord[] = [];
  async function visit(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const info = await stat(fullPath);
      result.push({
        relativePath: toRelative(projectRoot, fullPath),
        bytes: info.size,
        mimeType: mimeTypeForPath(fullPath),
        mtime: info.mtime.toISOString(),
      });
    }
  }
  await visit(rootDir);
  return result.sort((a, b) => String(a.relativePath).localeCompare(String(b.relativePath)));
}

async function writePythonRunDebug(input: {
  projectRoot: string;
  debugDir: string;
  label: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  result: PythonRunResult;
}): Promise<JsonRecord> {
  const logDir = path.join(input.debugDir, 'logs');
  const stdoutPath = path.join(logDir, `${input.label}.stdout.log`);
  const stderrPath = path.join(logDir, `${input.label}.stderr.log`);
  const metaPath = path.join(logDir, `${input.label}.meta.json`);
  await writeTextFile(stdoutPath, input.result.stdout || '');
  await writeTextFile(stderrPath, input.result.stderr || '');
  const meta = {
    label: input.label,
    command: {
      python: PYTHON_BIN,
      args: input.args,
      cwd: input.cwd,
    },
    env: {
      HUMAN_TEXT: input.env.HUMAN_TEXT || '',
      SEGMENT_COUNT: input.env.SEGMENT_COUNT || '',
      SEGMENT_DURATION: input.env.SEGMENT_DURATION || '',
      FPS: input.env.FPS || '',
      KEYFRAME_INTERVAL: input.env.KEYFRAME_INTERVAL || '',
      FIRST_FRAME_ONLY: input.env.FIRST_FRAME_ONLY || '',
      MAX_OPTIMIZATION_ROUNDS: input.env.MAX_OPTIMIZATION_ROUNDS || '',
      LLM_API_PROVIDER: input.env.LLM_API_PROVIDER || '',
      LLM_MODEL_NAME: input.env.LLM_MODEL_NAME || '',
      GENAI_API_BASE: input.env.GENAI_API_BASE || '',
    },
    logs: {
      stdout: toRelative(input.projectRoot, stdoutPath),
      stderr: toRelative(input.projectRoot, stderrPath),
    },
  };
  await writeJsonFile(metaPath, meta);
  return {
    ...meta,
    logs: {
      ...readRecord(meta.logs),
      meta: toRelative(input.projectRoot, metaPath),
    },
  };
}

function readRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function finiteNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function tuple3(value: unknown, fallback: Vec3): Vec3 {
  if (!Array.isArray(value) || value.length < 3) return fallback;
  const result: Vec3 = [
    finiteNumber(value[0], fallback[0]),
    finiteNumber(value[1], fallback[1]),
    finiteNumber(value[2], fallback[2]),
  ];
  return result;
}

function positiveTuple3(value: unknown): Vec3 | null {
  if (!Array.isArray(value) || value.length < 3) return null;
  const result: Vec3 = [
    Math.abs(finiteNumber(value[0], 0)),
    Math.abs(finiteNumber(value[1], 0)),
    Math.abs(finiteNumber(value[2], 0)),
  ];
  return result.every((item) => item > 0) ? result : null;
}

function tuple4Wxyz(value: unknown, fallback: QuatWxyz = [1, 0, 0, 0]): QuatWxyz {
  if (!Array.isArray(value) || value.length < 4) return fallback;
  return [
    finiteNumber(value[0], fallback[0]),
    finiteNumber(value[1], fallback[1]),
    finiteNumber(value[2], fallback[2]),
    finiteNumber(value[3], fallback[3]),
  ];
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function roundVec3(value: Vec3, digits: number): Vec3 {
  return [round(value[0], digits), round(value[1], digits), round(value[2], digits)];
}

function roundQuat(value: QuatWxyz, digits: number): QuatWxyz {
  return [round(value[0], digits), round(value[1], digits), round(value[2], digits), round(value[3], digits)];
}

function parseSceneAssets(rawScene: unknown): JsonRecord[] {
  const scene = readRecord(rawScene);
  if (Array.isArray(scene.assets)) {
    return scene.assets.map(readRecord).filter((item) => Object.keys(item).length > 0);
  }
  if (!Array.isArray(scene.scenes)) return [];
  const assets: JsonRecord[] = [];
  for (const sceneEntry of scene.scenes.map(readRecord)) {
    const models = Array.isArray(sceneEntry.models) ? sceneEntry.models : [];
    for (const modelValue of models) {
      const model = readRecord(modelValue);
      if (Object.keys(model).length <= 0) continue;
      const trs = Array.isArray(model.trs) ? model.trs : [];
      const transform: JsonRecord = {};
      if (Array.isArray(trs[0])) transform.position = tuple3(trs[0], [0, 0, 0]);
      if (Array.isArray(trs[1])) transform.rotationEulerRad = tuple3(trs[1], [0, 0, 0]);
      if (Array.isArray(trs[2])) transform.scale = tuple3(trs[2], [1, 1, 1]);
      assets.push({
        ...model,
        transform: {
          ...readRecord(model.transform),
          ...transform,
        },
      });
    }
  }
  return assets;
}

function inferAssetPath(asset: JsonRecord): string {
  const candidates = [
    asset.path,
    asset.modelPath,
    asset.relativePath,
    asset.url,
    readRecord(asset.extras).visionaryRelativePath,
    asset.name,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return '';
}

function inferAssetName(asset: JsonRecord, index: number): string {
  const name = typeof asset.name === 'string' && asset.name.trim() ? asset.name.trim() : '';
  if (name) return name;
  const sourcePath = inferAssetPath(asset);
  if (sourcePath) return path.basename(sourcePath);
  return `visionary_object_${String(index + 1).padStart(3, '0')}`;
}

function inferAssetType(asset: JsonRecord, sourcePath: string): string {
  const type = typeof asset.type === 'string' && asset.type.trim() ? asset.type.trim().toLowerCase() : '';
  if (type) return type;
  const ext = path.extname(sourcePath).replace(/^\./, '').toLowerCase();
  return ext || 'object';
}

function transformRecord(asset: JsonRecord): JsonRecord {
  return readRecord(asset.transform);
}

function assetPosition(asset: JsonRecord): Vec3 {
  return tuple3(transformRecord(asset).position, tuple3(asset.position, [0, 0, 0]));
}

function assetRotation(asset: JsonRecord): Vec3 {
  return tuple3(transformRecord(asset).rotationEulerRad, tuple3(asset.rotationEulerRad, [0, 0, 0]));
}

function assetScale(asset: JsonRecord): Vec3 {
  const transform = transformRecord(asset);
  const transformScale = transform.scale;
  if (Array.isArray(transformScale)) return tuple3(transformScale, [1, 1, 1]);
  if (Number.isFinite(Number(transformScale))) {
    const value = Math.abs(Number(transformScale));
    return [value, value, value];
  }
  const assetScaleValue = asset.scale;
  if (Array.isArray(assetScaleValue)) return tuple3(assetScaleValue, [1, 1, 1]);
  if (Number.isFinite(Number(assetScaleValue))) {
    const value = Math.abs(Number(assetScaleValue));
    return [value, value, value];
  }
  return [1, 1, 1];
}

function assetReferenceSize(asset: JsonRecord): { size: Vec3; source: string } {
  const transform = transformRecord(asset);
  const extras = readRecord(asset.extras);
  const metadata = readRecord(asset.metadata);
  const candidates: Array<[unknown, string]> = [
    [asset.referenceSize, 'asset.referenceSize'],
    [transform.referenceSize, 'transform.referenceSize'],
    [extras.referenceSize, 'extras.referenceSize'],
    [readRecord(extras.visionarySceneInfo).referenceSize, 'extras.visionarySceneInfo.referenceSize'],
    [metadata.referenceSize, 'metadata.referenceSize'],
  ];
  for (const [candidate, source] of candidates) {
    const value = positiveTuple3(candidate);
    if (value) return { size: value, source };
  }
  return { size: [1, 1, 1], source: 'unit_fallback' };
}

function readBboxRecord(record: JsonRecord, source: string): { min: Vec3; max: Vec3; source: string } | null {
  const minCandidate = record.world_bbox_min ?? record.worldMin ?? record.min;
  const maxCandidate = record.world_bbox_max ?? record.worldMax ?? record.max;
  const min = tuple3(minCandidate, [Number.NaN, Number.NaN, Number.NaN]);
  const max = tuple3(maxCandidate, [Number.NaN, Number.NaN, Number.NaN]);
  if (!min.every(Number.isFinite) || !max.every(Number.isFinite)) return null;
  return {
    min: roundVec3([
      Math.min(min[0], max[0]),
      Math.min(min[1], max[1]),
      Math.min(min[2], max[2]),
    ], 4),
    max: roundVec3([
      Math.max(min[0], max[0]),
      Math.max(min[1], max[1]),
      Math.max(min[2], max[2]),
    ], 4),
    source,
  };
}

function explicitWorldBboxForAsset(asset: JsonRecord): { min: Vec3; max: Vec3; source: string } | null {
  const transform = transformRecord(asset);
  const extras = readRecord(asset.extras);
  const sceneInfo = readRecord(extras.visionarySceneInfo);
  const metadata = readRecord(asset.metadata);
  const candidates: Array<[JsonRecord, string]> = [
    [asset, 'asset.world_bbox'],
    [readRecord(asset.worldBounds), 'asset.worldBounds'],
    [readRecord(asset.bounds), 'asset.bounds'],
    [transform, 'transform.world_bbox'],
    [readRecord(transform.worldBounds), 'transform.worldBounds'],
    [sceneInfo, 'extras.visionarySceneInfo.world_bbox'],
    [readRecord(sceneInfo.worldBounds), 'extras.visionarySceneInfo.worldBounds'],
    [metadata, 'metadata.world_bbox'],
    [readRecord(metadata.worldBounds), 'metadata.worldBounds'],
  ];
  for (const [candidate, source] of candidates) {
    const bbox = readBboxRecord(candidate, source);
    if (bbox) return bbox;
  }
  return null;
}

function rotatedExtents(halfSize: Vec3, euler: Vec3): Vec3 {
  const [rx, ry, rz] = euler;
  const a = Math.cos(rx);
  const b = Math.sin(rx);
  const c = Math.cos(ry);
  const d = Math.sin(ry);
  const e = Math.cos(rz);
  const f = Math.sin(rz);

  const matrix = [
    [c * e, -c * f, d],
    [b * d * e + a * f, -b * d * f + a * e, -b * c],
    [-a * d * e + b * f, a * d * f + b * e, a * c],
  ];
  return [
    Math.abs(matrix[0][0]) * halfSize[0] + Math.abs(matrix[0][1]) * halfSize[1] + Math.abs(matrix[0][2]) * halfSize[2],
    Math.abs(matrix[1][0]) * halfSize[0] + Math.abs(matrix[1][1]) * halfSize[1] + Math.abs(matrix[1][2]) * halfSize[2],
    Math.abs(matrix[2][0]) * halfSize[0] + Math.abs(matrix[2][1]) * halfSize[1] + Math.abs(matrix[2][2]) * halfSize[2],
  ];
}

function bboxForAsset(asset: JsonRecord): { min: Vec3; max: Vec3; source: string } {
  const explicit = explicitWorldBboxForAsset(asset);
  if (explicit) return explicit;

  const position = assetPosition(asset);
  const rotation = assetRotation(asset);
  const scale = assetScale(asset);
  const reference = assetReferenceSize(asset);
  const half: Vec3 = [
    Math.max(1e-6, reference.size[0] * Math.abs(scale[0]) * 0.5),
    Math.max(1e-6, reference.size[1] * Math.abs(scale[1]) * 0.5),
    Math.max(1e-6, reference.size[2] * Math.abs(scale[2]) * 0.5),
  ];
  const extents = rotatedExtents(half, rotation);
  return {
    min: roundVec3([position[0] - extents[0], position[1] - extents[1], position[2] - extents[2]], 4),
    max: roundVec3([position[0] + extents[0], position[1] + extents[1], position[2] + extents[2]], 4),
    source: reference.source,
  };
}

function bboxCenter(min: Vec3, max: Vec3): Vec3 {
  return roundVec3([
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ], 4);
}

function unionBounds(bounds: Array<{ min: Vec3; max: Vec3 }>): { min: Vec3; max: Vec3 } {
  if (bounds.length <= 0) {
    return {
      min: [-1, -1, -1],
      max: [1, 1, 1],
    };
  }
  const min: Vec3 = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max: Vec3 = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (const item of bounds) {
    for (let index = 0; index < 3; index += 1) {
      min[index] = Math.min(min[index], item.min[index]);
      max[index] = Math.max(max[index], item.max[index]);
    }
  }
  return {
    min: roundVec3(min, 4),
    max: roundVec3(max, 4),
  };
}

function expandBoundsAroundCenter(min: Vec3, max: Vec3, scale: number): { min: Vec3; max: Vec3; center: Vec3; size: Vec3 } {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const center: Vec3 = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ];
  const size: Vec3 = [
    Math.max(1e-6, max[0] - min[0]),
    Math.max(1e-6, max[1] - min[1]),
    Math.max(1e-6, max[2] - min[2]),
  ];
  const half: Vec3 = [size[0] * safeScale * 0.5, size[1] * safeScale * 0.5, size[2] * safeScale * 0.5];
  return {
    min: roundVec3([center[0] - half[0], center[1] - half[1], center[2] - half[2]], 4),
    max: roundVec3([center[0] + half[0], center[1] + half[1], center[2] + half[2]], 4),
    center: roundVec3(center, 4),
    size: roundVec3(size, 4),
  };
}

function groupCollections(objectsInfo: JsonRecord[]): JsonRecord[] {
  const groups = new Map<string, Array<{ min: Vec3; max: Vec3 }>>();
  for (const object of objectsInfo) {
    const type = safeSegment(String(object.type || 'objects'), 'objects');
    const min = tuple3(object.world_bbox_min, [0, 0, 0]);
    const max = tuple3(object.world_bbox_max, [0, 0, 0]);
    const list = groups.get(type) || [];
    list.push({ min, max });
    groups.set(type, list);
  }
  const collections: JsonRecord[] = [];
  for (const [type, bounds] of groups.entries()) {
    const union = unionBounds(bounds);
    collections.push({
      collection_name: `Visionary_${type}`,
      world_bbox_min: union.min,
      world_bbox_max: union.max,
      coordinate_system: VISIONARY_COORDINATE_SYSTEM,
      object_count: bounds.length,
    });
  }
  const full = unionBounds(objectsInfo.map((object) => ({
    min: tuple3(object.world_bbox_min, [0, 0, 0]),
    max: tuple3(object.world_bbox_max, [0, 0, 0]),
  })));
  collections.unshift({
    collection_name: 'VisionaryScene',
    world_bbox_min: full.min,
    world_bbox_max: full.max,
    coordinate_system: VISIONARY_COORDINATE_SYSTEM,
    object_count: objectsInfo.length,
  });
  return collections;
}

async function buildSceneInfoBundle(input: {
  projectRoot: string;
  sceneBoundsScale?: number;
}): Promise<SceneInfoBundle> {
  const scenePath = path.join(input.projectRoot, 'scene.json');
  if (!await pathExists(scenePath)) {
    throw new Error(`Visionary scene.json not found at ${scenePath}`);
  }
  const warnings: string[] = [];
  const rawScene = await readJsonFile(scenePath);
  const rawAssets = parseSceneAssets(rawScene);
  let assets = rawAssets.filter((asset) => asset.visible !== false);
  if (assets.length <= 0 && rawAssets.length > 0) {
    warnings.push('No visible assets were found; hidden assets were exported so the camera pipeline has geometry context.');
    assets = rawAssets;
  }
  if (assets.length <= 0) {
    warnings.push('scene.json has no assets; exported a fallback unit scene.');
  }

  const objectsInfo = assets.map((asset, index) => {
    const sourcePath = inferAssetPath(asset);
    const name = inferAssetName(asset, index);
    const type = inferAssetType(asset, sourcePath);
    const position = assetPosition(asset);
    const bbox = bboxForAsset(asset);
    const location = bboxCenter(bbox.min, bbox.max);
    if (bbox.source === 'unit_fallback') {
      warnings.push(`${name}: using unit fallback bounds because scene.json does not store mesh dimensions.`);
    }
    return {
      name,
      type,
      path: sourcePath,
      visible: asset.visible !== false,
      world_bbox_min: bbox.min,
      world_bbox_max: bbox.max,
      location,
      transform_location: roundVec3(position, 4),
      bbox_source: bbox.source,
      coordinate_system: VISIONARY_COORDINATE_SYSTEM,
    };
  });

  const sceneBounds = unionBounds(objectsInfo.map((object) => ({
    min: tuple3(object.world_bbox_min, [-1, -1, -1]),
    max: tuple3(object.world_bbox_max, [1, 1, 1]),
  })));
  const expanded = expandBoundsAroundCenter(sceneBounds.min, sceneBounds.max, input.sceneBoundsScale ?? 3);
  const bboxSources = new Set(objectsInfo.map((object) => String(object.bbox_source || '')).filter(Boolean));
  const sceneInfo = {
    world_min: expanded.min,
    world_max: expanded.max,
    size_xyz: expanded.size,
    center_xyz: expanded.center,
    source: 'visionary_project_storage',
    bounds_source: bboxSources.size === 1 ? Array.from(bboxSources)[0] : 'mixed_scene_asset_bounds',
    coordinate_system: VISIONARY_COORDINATE_SYSTEM,
    bounds_scale: input.sceneBoundsScale ?? 3,
    object_count: objectsInfo.length,
  };
  const collectionsInfo = groupCollections(objectsInfo);
  const sceneFullInfo = {
    scene_info: sceneInfo,
    collections_info: collectionsInfo,
    objects_info: objectsInfo,
    source: {
      type: 'visionary_project_storage',
      scenePath: 'scene.json',
    },
  };
  return {
    sceneFullInfo,
    sceneInfo,
    collectionsInfo,
    objectsInfo,
    warnings: [...new Set(warnings)],
  };
}

async function writeSceneInfoBundle(outputDir: string, bundle: SceneInfoBundle): Promise<{
  sceneFullInfoPath: string;
  collectionsInfoPath: string;
  objectsInfoPath: string;
}> {
  await mkdir(outputDir, { recursive: true });
  const sceneFullInfoPath = path.join(outputDir, 'scene_full_info.json');
  const collectionsInfoPath = path.join(outputDir, 'collections_info.json');
  const objectsInfoPath = path.join(outputDir, 'objects_info.json');
  await writeJsonFile(sceneFullInfoPath, bundle.sceneFullInfo);
  await writeJsonFile(collectionsInfoPath, bundle.collectionsInfo);
  await writeJsonFile(objectsInfoPath, bundle.objectsInfo);
  return {
    sceneFullInfoPath,
    collectionsInfoPath,
    objectsInfoPath,
  };
}

async function readSceneInfoBundle(projectRoot: string, relativeOrAbsolutePath: string): Promise<SceneInfoBundle> {
  const root = path.resolve(projectRoot);
  const resolved = path.isAbsolute(relativeOrAbsolutePath)
    ? path.resolve(relativeOrAbsolutePath)
    : path.resolve(root, relativeOrAbsolutePath);
  if (!isPathInside(root, resolved)) {
    throw new Error('Resolved scene info path escapes project root.');
  }
  const info = await stat(resolved);
  const baseDir = info.isDirectory() ? resolved : path.dirname(resolved);
  const sceneFullInfo = readRecord(await readJsonFile(path.join(baseDir, 'scene_full_info.json')));
  const embeddedCollections = Array.isArray(sceneFullInfo.collections_info)
    ? sceneFullInfo.collections_info.map(readRecord)
    : [];
  const embeddedObjects = Array.isArray(sceneFullInfo.objects_info)
    ? sceneFullInfo.objects_info.map(readRecord)
    : [];
  const collectionsInfo = await pathExists(path.join(baseDir, 'collections_info.json'))
    ? (await readJsonFile(path.join(baseDir, 'collections_info.json')) as unknown[]).map(readRecord)
    : embeddedCollections;
  const objectsInfo = await pathExists(path.join(baseDir, 'objects_info.json'))
    ? (await readJsonFile(path.join(baseDir, 'objects_info.json')) as unknown[]).map(readRecord)
    : embeddedObjects;
  return {
    sceneFullInfo: {
      ...sceneFullInfo,
      collections_info: collectionsInfo,
      objects_info: objectsInfo,
    },
    sceneInfo: readRecord(sceneFullInfo.scene_info),
    collectionsInfo,
    objectsInfo,
    warnings: [],
  };
}

function exportSceneDependencyTree(input: {
  runId: string;
  projectRoot: string;
  sceneJsonPath: string;
  sceneInfoDir: string;
  assets: GeneratedAsset[];
}): JsonRecord {
  const sceneId = 'visionary_scene_json';
  const sceneInfoId = 'trajectory_gen_scene_info';
  return {
    schema: 'visionary.new_pipeline.dependency_tree',
    version: 1,
    runId: input.runId,
    stage: 'camera_scene_info_export',
    nodes: [
      {
        id: sceneId,
        kind: 'visionary_scene_json',
        relativePath: toRelative(input.projectRoot, input.sceneJsonPath),
      },
      {
        id: sceneInfoId,
        kind: 'trajectory_gen_scene_info_dir',
        relativePath: toRelative(input.projectRoot, input.sceneInfoDir),
      },
      ...input.assets.map((asset) => ({
        id: asset.id,
        kind: asset.metadata?.kind || 'scene_info_json',
        relativePath: asset.relativePath,
        mimeType: asset.mimeType,
        bytes: asset.bytes,
      })),
    ],
    edges: [
      {
        from: sceneId,
        to: sceneInfoId,
        relation: 'converted_to_trajectory_gen_scene_info',
      },
      ...input.assets.map((asset) => ({
        from: sceneInfoId,
        to: asset.id,
        relation: 'contains',
      })),
    ],
  };
}

export async function exportSceneInfo(input: {
  projectRoot: string;
  projectId: string;
  runLabel: string;
  sceneBoundsScale?: number;
}): Promise<JsonRecord> {
  const title = '相机场景信息导出';
  const runId = nowRunId();
  const outputRoot = projectOutputRoot(input.projectRoot, input.projectId, input.runLabel, runId);
  const sceneInfoDir = path.join(outputRoot, 'scene_info');
  const sceneJsonPath = path.join(input.projectRoot, 'scene.json');

  emitProgress(title, '读取 Visionary scene.json', 0.01, 'camera_scene_info_export', 'running');
  const bundle = await buildSceneInfoBundle({
    projectRoot: input.projectRoot,
    sceneBoundsScale: input.sceneBoundsScale,
  });

  emitProgress(title, '写入 Trajectory_gen 场景信息格式', 0.75, 'camera_scene_info_export', 'running');
  const written = await writeSceneInfoBundle(sceneInfoDir, bundle);
  const assets = [
    await fileAsset(input.projectRoot, 'scene_full_info', written.sceneFullInfoPath, 'application/json', { kind: 'scene_full_info' }),
    await fileAsset(input.projectRoot, 'collections_info', written.collectionsInfoPath, 'application/json', { kind: 'collections_info' }),
    await fileAsset(input.projectRoot, 'objects_info', written.objectsInfoPath, 'application/json', { kind: 'objects_info' }),
  ];

  emitProgress(title, '记录输出依赖树', 0.9, 'camera_scene_info_export', 'running');
  const tree = exportSceneDependencyTree({
    runId,
    projectRoot: input.projectRoot,
    sceneJsonPath,
    sceneInfoDir,
    assets,
  });
  const manifestPath = path.join(outputRoot, 'dependency_tree.json');
  await writeJsonFile(manifestPath, tree);

  emitProgress(title, '相机场景信息导出完成', 1, 'camera_scene_info_export', 'done');
  return {
    ok: true,
    stage: 'camera_scene_info_export',
    runId,
    batchOutput: {
      relativePath: toRelative(input.projectRoot, sceneInfoDir),
    },
    sceneInfo: {
      relativePath: toRelative(input.projectRoot, written.sceneFullInfoPath),
      directory: toRelative(input.projectRoot, sceneInfoDir),
      data: bundle.sceneFullInfo,
    },
    files: assets,
    images: [],
    dependencyTree: {
      relativePath: toRelative(input.projectRoot, manifestPath),
      data: tree,
    },
    visionaryTask: {
      title,
      message: `导出 ${bundle.objectsInfo.length} 个对象供相机轨迹生成使用`,
      progress: 1,
      stage: 'camera_scene_info_export',
      statusId: 'done',
      pipelineStageStatuses: buildCameraPipelineStageStatuses('camera_scene_info_export', 'done'),
      files: assets,
      images: [],
      dependencyTree: {
        relativePath: toRelative(input.projectRoot, manifestPath),
        data: tree,
      },
      warnings: bundle.warnings,
    },
    warnings: bundle.warnings,
  };
}

async function runPythonScript(args: string[], cwd: string, envOverrides: Record<string, string>): Promise<PythonRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_BIN, args, {
      cwd,
      env: {
        ...process.env,
        ...envOverrides,
      },
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

async function writeCameraViewExporterWrapper(outputRoot: string): Promise<string> {
  const wrapperPath = path.join(outputRoot, 'run_camera_view_exporter_no_blender.py');
  await writeFile(wrapperPath, [
    'import os',
    'import sys',
    '',
    `TRAJECTORY_GEN_ROOT = ${JSON.stringify(TRAJECTORY_GEN_ROOT)}`,
    'if TRAJECTORY_GEN_ROOT not in sys.path:',
    '    sys.path.insert(0, TRAJECTORY_GEN_ROOT)',
    '',
    'from util import load_json_file',
    'from pipeline import camera_view_exporter',
    '',
    'original_select_view_focus_assets = camera_view_exporter.select_view_focus_assets',
    '',
    'def deterministic_focus_selection(config, human_text, collections_info, objects_info, output_dir):',
    '    collection_names, object_names = camera_view_exporter._build_name_candidates(collections_info, objects_info)',
    '    total_candidates = len(collection_names) + len(object_names)',
    '    # Avoid an LLM round trip when every candidate is already a reasonable focus target.',
    '    if 0 < total_candidates <= 3:',
    '        return {',
    '            "important_names": object_names + collection_names,',
    '            "target_objects": object_names,',
    '            "target_collections": collection_names,',
    '            "selection_source": "deterministic_small_scene",',
    '        }',
    '    keyword_names = camera_view_exporter._keyword_fallback_selection(human_text, collection_names, object_names)',
    '    if keyword_names:',
    '        normalized = camera_view_exporter._normalize_focus_selection(keyword_names, collection_names, object_names)',
    '        return {',
    '            "important_names": normalized["important_names"],',
    '            "target_objects": normalized["target_objects"],',
    '            "target_collections": normalized["target_collections"],',
    '            "selection_source": "deterministic_keyword",',
    '        }',
    '    return original_select_view_focus_assets(config, human_text, collections_info, objects_info, output_dir)',
    '',
    'def skip_blender_render(blender_exec, project_path, script_path, args, background=True):',
    '    print("[Visionary] Skipping Blender camera initialization/render step; Visionary stores poses as JSON.")',
    '',
    'camera_view_exporter.run_blender_script = skip_blender_render',
    'camera_view_exporter.select_view_focus_assets = deterministic_focus_selection',
    '',
    'if len(sys.argv) < 2:',
    '    print("Usage: python run_camera_view_exporter_no_blender.py <config_path>")',
    '    sys.exit(1)',
    '',
    'config_path = sys.argv[1]',
    'config = load_json_file(config_path)',
    'human_text = os.environ.get("HUMAN_TEXT", str(config.get("human_text", "")))',
    'camera_view_exporter.export_initial_views(config, human_text=human_text)',
    '',
  ].join('\n'));
  return wrapperPath;
}

async function writeTrajectoryOptimizationRoundWrapper(outputRoot: string): Promise<string> {
  const wrapperPath = path.join(outputRoot, 'run_trajectory_optimization_round_visionary.py');
  await writeFile(wrapperPath, [
    'import json',
    'import os',
    'import sys',
    '',
    `TRAJECTORY_GEN_ROOT = ${JSON.stringify(TRAJECTORY_GEN_ROOT)}`,
    'if TRAJECTORY_GEN_ROOT not in sys.path:',
    '    sys.path.insert(0, TRAJECTORY_GEN_ROOT)',
    '',
    'from util import get_genai_client, get_project_name, get_project_paths, load_json_file, read_text_file, read_non_empty_lines, save_json_file',
    'from pipeline.trajectory_evaluator import evaluate_trajectory',
    'from pipeline.trajectory_optimizer import optimize_trajectory',
    'from pipeline.loop_trajectory_optimization import trajectory_json_to_text, _normalize_segment_payload, _parse_need_optimization',
    '',
    'def media_inputs_for_eval(eval_root, camera_name, round_index):',
    '    render_dir = os.path.join(eval_root, camera_name, f"round_{round_index:02d}")',
    '    if not os.path.isdir(render_dir):',
    '        return [f"Evaluation keyframe directory missing: {render_dir}"]',
    '    names = sorted([name for name in os.listdir(render_dir) if name.lower().endswith(".png")])',
    '    paths = [os.path.join(render_dir, name) for name in names]',
    '    if not paths:',
    '        return [f"Evaluation keyframe directory has no images: {render_dir}"]',
    '    return ["Low-resolution Visionary evaluation keyframes are provided in start/middle/end order."] + paths',
    '',
    'def main():',
    '    if len(sys.argv) < 3:',
    '        raise SystemExit("Usage: python run_trajectory_optimization_round_visionary.py <config_path> <round_index>")',
    '    config_path = sys.argv[1]',
    '    round_index = int(sys.argv[2])',
    '    config = load_json_file(config_path)',
    '    if "api_key" in config:',
    '        os.environ["GENAI_API_KEY"] = str(config.get("api_key") or "")',
    '    if "api_base" in config:',
    '        os.environ["GENAI_API_BASE"] = str(config.get("api_base") or "")',
    '    os.environ["LLM_API_PROVIDER"] = str(config.get("api_provider") or "")',
    '    os.environ["LLM_MODEL_NAME"] = str(config.get("model_name") or "")',
    '    project_name = get_project_name(config.get("project_path"))',
    '    paths = get_project_paths(config, project_name)',
    '    camera_init_dir = paths["project_camera_init_dir"]',
    '    trajectory_dir = paths["project_trajectory_dir"]',
    '    renders_dir = os.path.join(paths["project_renders_dir"], "eval_keyframes")',
    '    first_frame_only = str(config.get("first_frame_only", False)).lower() in ("1", "true", "yes")',
    '    suffix = "_first_frame" if first_frame_only else ""',
    '    trajectory_json_path = os.path.join(trajectory_dir, f"trajectory_multi_camera{suffix}.json")',
    '    trajectory_txt_path = os.path.join(trajectory_dir, f"trajectory_multi_camera{suffix}.txt")',
    '    if round_index == 1:',
    '        current_before = load_json_file(trajectory_json_path)',
    '        save_json_file(os.path.join(trajectory_dir, f"trajectory_multi_camera_before_optimization{suffix}.json"), current_before, ensure_ascii=False, indent=2)',
    '        with open(os.path.join(trajectory_dir, f"trajectory_multi_camera_before_optimization{suffix}.txt"), "w", encoding="utf-8") as f:',
    '            f.write(trajectory_json_to_text(current_before))',
    '    payload = load_json_file(trajectory_json_path)',
    '    cameras = payload.get("cameras", []) if isinstance(payload, dict) else []',
    '    scene_description = read_text_file(os.path.join(camera_init_dir, "scene_description.txt"))',
    '    important_objects = read_text_file(os.path.join(camera_init_dir, "important_objects.txt"))',
    '    director_intents = []',
    '    scene_analysis_path = os.path.join(camera_init_dir, "all_scene_analysis.json")',
    '    if os.path.exists(scene_analysis_path):',
    '        scene_analysis = load_json_file(scene_analysis_path)',
    '        for item in scene_analysis.get("director_intents", []):',
    '            if isinstance(item, dict) and str(item.get("intent", "")).strip():',
    '                director_intents.append(str(item.get("intent")).strip())',
    '    if not director_intents:',
    '        director_intents.extend(read_non_empty_lines(os.path.join(camera_init_dir, "director_intent.txt")))',
    '    client = get_genai_client(config)',
    '    round_results = []',
    '    any_need_optimization = False',
    '    for idx, camera_payload in enumerate(cameras):',
    '        camera_name = str(camera_payload.get("camera_name", f"camera_{idx + 1:03d}")).strip() or f"camera_{idx + 1:03d}"',
    '        director_intent = director_intents[idx] if idx < len(director_intents) else ""',
    '        media_inputs = media_inputs_for_eval(renders_dir, camera_name, round_index)',
    '        evaluation = evaluate_trajectory(client, scene_description, important_objects, director_intent, camera_payload, media_inputs, first_frame_only=first_frame_only)',
    '        need = _parse_need_optimization(evaluation.get("need_optimization", True))',
    '        any_need_optimization = any_need_optimization or need',
    '        optimized = camera_payload',
    '        if need:',
    '            optimized_payload = optimize_trajectory(client, scene_description, important_objects, director_intent, camera_payload, str(evaluation.get("optimization_suggestion", "")).strip(), media_inputs, first_frame_only=first_frame_only)',
    '            optimized = _normalize_segment_payload(optimized_payload, camera_name)',
    '            if first_frame_only and optimized.get("keyframes"):',
    '                first_kf = dict(optimized["keyframes"][0])',
    '                first_kf["frame"] = 0',
    '                optimized["keyframes"] = [first_kf]',
    '            cameras[idx] = optimized',
    '        round_results.append({"camera_name": camera_name, "need_optimization": need, "evaluation": evaluation})',
    '        save_json_file(os.path.join(trajectory_dir, f"trajectory_{camera_name}{suffix}.json"), optimized, ensure_ascii=False, indent=2)',
    '        with open(os.path.join(trajectory_dir, f"trajectory_{camera_name}{suffix}.txt"), "w", encoding="utf-8") as f:',
    '            f.write(trajectory_json_to_text({"cameras": [optimized]}))',
    '    next_payload = {"cameras": cameras}',
    '    save_json_file(trajectory_json_path, next_payload, ensure_ascii=False, indent=2)',
    '    with open(trajectory_txt_path, "w", encoding="utf-8") as f:',
    '        f.write(trajectory_json_to_text(next_payload))',
    '    save_json_file(os.path.join(trajectory_dir, f"trajectory_multi_camera_after_optimization{suffix}.json"), next_payload, ensure_ascii=False, indent=2)',
    '    with open(os.path.join(trajectory_dir, f"trajectory_multi_camera_after_optimization{suffix}.txt"), "w", encoding="utf-8") as f:',
    '        f.write(trajectory_json_to_text(next_payload))',
    '    summary = {"round_index": round_index, "any_need_optimization": any_need_optimization, "results": round_results, "trajectory_json_path": trajectory_json_path}',
    '    save_json_file(os.path.join(trajectory_dir, f"optimization_round_{round_index:02d}.json"), summary, ensure_ascii=False, indent=2)',
    '    print(json.dumps(summary, ensure_ascii=False))',
    '',
    'if __name__ == "__main__":',
    '    main()',
    '',
  ].join('\n'));
  return wrapperPath;
}

function readTrajectoryGenLlmDefaults(): JsonRecord {
  try {
    return readRecord(JSON.parse(readFileSync(path.join(TRAJECTORY_GEN_ROOT, 'config', 'config.json'), 'utf8')) as unknown);
  } catch {
    return {};
  }
}

function isOpenAiModelName(value: string): boolean {
  return /^(gpt-|o1|o3|o4|chatgpt-)/i.test(String(value || '').trim());
}

function allowTrajectoryLlmOverride(): boolean {
  return String(process.env.VISIONARY_TRAJECTORY_ALLOW_LLM_OVERRIDE || '').trim() === '1';
}

function resolveTrajectoryLlmSettings(input: {
  apiKey?: string;
  apiBase?: string;
  apiProvider?: string;
  modelName?: string;
}): {
  apiKey: string;
  apiBase: string;
  apiProvider: string;
  modelName: string;
} {
  const defaults = readTrajectoryGenLlmDefaults();
  const defaultProvider = String(defaults.api_provider || 'gemini').trim();
  const defaultModelName = String(defaults.model_name || 'gemini-3.1-pro-preview').trim();
  const allowInputOverride = allowTrajectoryLlmOverride();
  const explicitProvider = allowInputOverride ? String(input.apiProvider || '').trim() : '';
  const provider = explicitProvider
    || String(process.env.LLM_API_PROVIDER || defaultProvider || 'gemini').trim();
  const requestedModelName = String((allowInputOverride ? input.modelName : '') || process.env.LLM_MODEL_NAME || process.env.GENAI_MODEL_NAME || '').trim();
  const modelName = (!explicitProvider && isOpenAiModelName(requestedModelName) && provider === 'gemini')
    ? defaultModelName
    : (requestedModelName || defaultModelName);
  const apiBase = String(
    (allowInputOverride ? input.apiBase : '')
    || process.env.GENAI_API_BASE
    || defaults.api_base
    || (provider === 'gemini' ? '' : process.env.OPENAI_BASE_URL)
    || '',
  ).trim();
  const apiKey = String(
    (allowInputOverride ? input.apiKey : '')
    || process.env.GENAI_API_KEY
    || process.env.GOOGLE_API_KEY
    || process.env.GEMINI_API_KEY
    || defaults.api_key
    || (provider === 'gemini' ? '' : process.env.OPENAI_API_KEY)
    || (provider === 'gemini' ? '' : process.env.CODEX_API_KEY)
    || '',
  ).trim();
  return {
    apiKey,
    apiBase,
    apiProvider: provider,
    modelName,
  };
}

export function normalizeTrajectoryLlmConfig(config: JsonRecord): JsonRecord {
  const llm = resolveTrajectoryLlmSettings({
    apiKey: typeof config.api_key === 'string' ? config.api_key : '',
    apiBase: typeof config.api_base === 'string' ? config.api_base : '',
    apiProvider: typeof config.api_provider === 'string' ? config.api_provider : '',
    modelName: typeof config.model_name === 'string' ? config.model_name : '',
  });
  return {
    ...config,
    api_key: llm.apiKey,
    api_base: llm.apiBase,
    api_provider: llm.apiProvider,
    model_name: llm.modelName,
  };
}

function assertTrajectoryLlmConfig(config: JsonRecord): void {
  if (typeof config.api_key !== 'string' || !config.api_key.trim()) {
    throw new Error('Trajectory_gen LLM API key is missing. Set api_key in third-party/Trajectory_gen/config/config.json or provide GENAI_API_KEY for the camera trajectory MCP server.');
  }
}

function normalizePositiveInt(value: unknown, fallback: number, min = 1, max = 10000): number {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function buildTrajectoryConfig(input: {
  outputRoot: string;
  projectName: string;
  humanText: string;
  segmentCount: number;
  segmentDuration: number;
  fps: number;
  keyframeInterval: number;
  firstFrameOnly: boolean;
  debugEvalOnly?: boolean;
  maxOptimizationRounds?: number;
  apiKey?: string;
  apiBase?: string;
  apiProvider?: string;
  modelName?: string;
}): JsonRecord {
  const llm = resolveTrajectoryLlmSettings({
    apiKey: input.apiKey,
    apiBase: input.apiBase,
    apiProvider: input.apiProvider,
    modelName: input.modelName,
  });
  const config = {
    project_path: path.join(input.outputRoot, `${input.projectName}.visionary`),
    scene_info_dir: path.join(input.outputRoot, 'data', 'scene_info'),
    render_dir: path.join(input.outputRoot, 'data', 'renders'),
    camera_init_dir: path.join(input.outputRoot, 'data', 'camera_init'),
    trajectory_dir: path.join(input.outputRoot, 'data', 'trajectory'),
    output_dir: path.join(input.outputRoot, 'output'),
    human_text: input.humanText,
    segment_count: input.segmentCount,
    segment_duration: input.segmentDuration,
    fps: input.fps,
    keyframe_interval: input.keyframeInterval,
    first_frame_only: input.firstFrameOnly,
    debug_eval_only: Boolean(input.debugEvalOnly),
    max_optimization_rounds: Boolean(input.debugEvalOnly)
      ? normalizePositiveInt(input.maxOptimizationRounds, 1, 1, 10)
      : 0,
    camera_distance_scale: 1.5,
    api_key: llm.apiKey,
    api_base: llm.apiBase,
    api_provider: llm.apiProvider,
    model_name: llm.modelName,
  };
  assertTrajectoryLlmConfig(config);
  return config;
}

async function writeVlmDebugManifest(input: {
  projectRoot: string;
  projectId: string;
  runId: string;
  outputRoot: string;
  debugDir: string;
  configPath: string;
  config: JsonRecord;
  sceneInfoDir: string;
  renderDir: string;
  cameraInitDir: string;
  trajectoryDir: string;
  expectedInitialViewPaths: string[];
  pythonRuns: JsonRecord[];
  warnings: string[];
}): Promise<{ manifestPath: string; readmePath: string; data: JsonRecord }> {
  const renderFiles = await collectFilesRecursive(input.renderDir, input.projectRoot);
  const cameraInitFiles = await collectFilesRecursive(input.cameraInitDir, input.projectRoot);
  const trajectoryFiles = await collectFilesRecursive(input.trajectoryDir, input.projectRoot);
  const expectedInitialViews = await Promise.all(input.expectedInitialViewPaths.map(async (filePath) => {
    const exists = await pathExists(filePath);
    const info = exists ? await stat(filePath) : null;
    return {
      relativePath: toRelative(input.projectRoot, filePath),
      exists,
      bytes: info?.size || 0,
      mimeType: mimeTypeForPath(filePath),
    };
  }));
  const missingInitialViews = expectedInitialViews.filter((item) => !item.exists);
  const manifest = {
    schema: 'visionary.camera_trajectory.vlm_debug',
    version: 1,
    projectId: input.projectId,
    runId: input.runId,
    createdAt: new Date().toISOString(),
    summary: {
      renderFiles: renderFiles.length,
      expectedInitialViews: expectedInitialViews.length,
      missingInitialViews: missingInitialViews.length,
      pythonRuns: input.pythonRuns.length,
    },
    paths: {
      outputRoot: toRelative(input.projectRoot, input.outputRoot),
      debugDir: toRelative(input.projectRoot, input.debugDir),
      config: toRelative(input.projectRoot, input.configPath),
      sceneInfoDir: toRelative(input.projectRoot, input.sceneInfoDir),
      renderDir: toRelative(input.projectRoot, input.renderDir),
      cameraInitDir: toRelative(input.projectRoot, input.cameraInitDir),
      trajectoryDir: toRelative(input.projectRoot, input.trajectoryDir),
    },
    config: redactConfigForDebug(input.config),
    vlmInputs: {
      humanText: String(input.config.human_text || ''),
      provider: String(input.config.api_provider || ''),
      modelName: String(input.config.model_name || ''),
      apiBase: String(input.config.api_base || ''),
      expectedInitialViews,
      missingInitialViews,
      note: missingInitialViews.length > 0
        ? 'Initial render PNGs are missing. In the current Visionary bridge the Blender render step is skipped, so VLM calls may run without image inputs unless renders are provided separately.'
        : 'Initial render PNGs were present and available to VLM calls.',
    },
    renderFiles,
    cameraInitFiles,
    trajectoryFiles,
    pythonRuns: input.pythonRuns,
    warnings: input.warnings,
  };
  const manifestPath = path.join(input.debugDir, 'manifest.json');
  const readmePath = path.join(input.debugDir, 'README.md');
  await writeJsonFile(manifestPath, manifest);
  await writeTextFile(readmePath, [
    '# Camera Trajectory VLM Debug',
    '',
    `Project: ${input.projectId}`,
    `Run: ${input.runId}`,
    '',
    'Open `manifest.json` for the full machine-readable record.',
    '',
    'Important fields:',
    '- `config`: trajectory parameters with API keys redacted.',
    '- `vlmInputs.expectedInitialViews`: render PNGs the VLM scripts look for.',
    '- `vlmInputs.missingInitialViews`: expected render PNGs that were not found.',
    '- `renderFiles`: every file found under the render directory.',
    '- `pythonRuns`: stdout/stderr log paths for each Trajectory_gen stage.',
    '- `cameraInitFiles` and `trajectoryFiles`: generated intermediate/output JSON/TXT files.',
    '',
  ].join('\n'));
  return { manifestPath, readmePath, data: manifest };
}

function cameraInitFovMap(payload: unknown): Map<string, number> {
  const record = readRecord(payload);
  const cameras = Array.isArray(record.cameras) ? record.cameras.map(readRecord) : [];
  const result = new Map<string, number>();
  for (const camera of cameras) {
    const name = typeof camera.name === 'string' ? camera.name.trim() : '';
    const fov = Number(camera.fov);
    if (name && Number.isFinite(fov) && fov > 0) {
      result.set(name, fov);
    }
  }
  return result;
}

function parseTrajectoryText(raw: string): JsonRecord {
  const cameras: TrajectoryCamera[] = [];
  let current: TrajectoryCamera | null = null;
  for (const lineRaw of raw.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (!line) continue;
    if (line.startsWith('Camera:')) {
      current = {
        camera_name: line.slice('Camera:'.length).trim(),
        keyframes: [],
      };
      if (current.camera_name) cameras.push(current);
      continue;
    }
    if (!current) continue;
    const parts = line.split(/\s+/).map(Number);
    if (parts.length < 8 || parts.some((part) => !Number.isFinite(part))) continue;
    current.keyframes.push({
      frame: Math.round(parts[0]),
      position: [parts[1], parts[2], parts[3]],
      rotation_quaternion: [parts[4], parts[5], parts[6], parts[7]],
    });
  }
  return { cameras };
}

async function readTrajectoryPayload(filePath: string): Promise<unknown> {
  if (filePath.toLowerCase().endsWith('.json')) {
    return readJsonFile(filePath);
  }
  return parseTrajectoryText(await readFile(filePath, 'utf8'));
}

function normalizeRawTrajectoryCameras(payload: unknown): TrajectoryCamera[] {
  const record = readRecord(payload);
  const rawCameras = Array.isArray(record.cameras)
    ? record.cameras
    : (record.camera_name && Array.isArray(record.keyframes) ? [record] : []);
  return rawCameras.map((cameraValue, index): TrajectoryCamera | null => {
    const camera = readRecord(cameraValue);
    const cameraName = typeof camera.camera_name === 'string' && camera.camera_name.trim()
      ? camera.camera_name.trim()
      : `camera_${String(index + 1).padStart(3, '0')}`;
    const keyframes = Array.isArray(camera.keyframes)
      ? camera.keyframes.map((keyframeValue): TrajectoryKeyframe | null => {
        const keyframe = readRecord(keyframeValue);
        const frame = Math.round(Number(keyframe.frame));
        const position = tuple3(keyframe.position, [0, 0, 0]);
        const rotation = tuple4Wxyz(keyframe.rotation_quaternion);
        if (!Number.isFinite(frame)) return null;
        return {
          frame,
          position,
          rotation_quaternion: rotation,
        };
      }).filter((item): item is TrajectoryKeyframe => Boolean(item))
      : [];
    if (keyframes.length <= 0) return null;
    return {
      camera_name: cameraName,
      keyframes,
      meta: readRecord(camera.meta),
    };
  }).filter((camera): camera is TrajectoryCamera => Boolean(camera));
}

// Trajectory_gen inherits Blender camera conventions: quaternions are [qw,qx,qy,qz]
// and describe camera-to-world orientation. Blender/Three cameras look down local -Z,
// with local +Y as up. Keep this convention through conversion; only reorder WXYZ->XYZW
// here, and store an inverted copy separately when a Visionary timeline field expects W2C.
function wxyzToXyzw(rotation: QuatWxyz): { x: number; y: number; z: number; w: number } {
  return {
    x: rotation[1],
    y: rotation[2],
    z: rotation[3],
    w: rotation[0],
  };
}

function invertXyzw(rotation: { x: number; y: number; z: number; w: number }): { x: number; y: number; z: number; w: number } {
  return {
    x: -rotation.x,
    y: -rotation.y,
    z: -rotation.z,
    w: rotation.w,
  };
}

function vec3Distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function normalizeQuatWxyz(rotation: QuatWxyz): QuatWxyz {
  const length = Math.hypot(rotation[0], rotation[1], rotation[2], rotation[3]);
  if (!Number.isFinite(length) || length <= 1e-8) return [1, 0, 0, 0];
  return [
    rotation[0] / length,
    rotation[1] / length,
    rotation[2] / length,
    rotation[3] / length,
  ];
}

function quatWxyzAngularDistanceDegrees(a: QuatWxyz, b: QuatWxyz): number {
  const normalizedA = normalizeQuatWxyz(a);
  const normalizedB = normalizeQuatWxyz(b);
  const dot = Math.abs(
    normalizedA[0] * normalizedB[0]
      + normalizedA[1] * normalizedB[1]
      + normalizedA[2] * normalizedB[2]
      + normalizedA[3] * normalizedB[3],
  );
  const clamped = Math.max(0, Math.min(1, dot));
  return 2 * Math.acos(clamped) * (180 / Math.PI);
}

function cameraTrajectoryBoundaryDelta(
  previous: NormalizedCameraTimelineEntry,
  next: NormalizedCameraTimelineEntry,
): CameraTrajectoryBoundaryDelta {
  return {
    position: vec3Distance(previous.position, next.position),
    rotationDegrees: quatWxyzAngularDistanceDegrees(previous.rotationQuaternionWxyz, next.rotationQuaternionWxyz),
    fovDegrees: Math.abs(previous.fovDegrees - next.fovDegrees),
  };
}

function cameraTrajectoryBoundaryDeltaWithinThreshold(delta: CameraTrajectoryBoundaryDelta): boolean {
  return delta.position <= CAMERA_TRAJECTORY_STITCHING_THRESHOLDS.position
    && delta.rotationDegrees <= CAMERA_TRAJECTORY_STITCHING_THRESHOLDS.rotationDegrees
    && delta.fovDegrees <= CAMERA_TRAJECTORY_STITCHING_THRESHOLDS.fovDegrees;
}

function cameraTrajectoryStitchingDiagnostic(
  previous: NormalizedCameraTimelineEntry,
  next: NormalizedCameraTimelineEntry,
  delta: CameraTrajectoryBoundaryDelta,
): JsonRecord {
  return {
    action: previous.segmentIndex === next.segmentIndex ? 'dropped_duplicate_keyframe' : 'dropped_duplicate_segment_start',
    frame: next.frame,
    time: next.time,
    previousCameraName: previous.cameraName,
    previousSourceFrame: previous.sourceFrame,
    previousSegmentIndex: previous.segmentIndex,
    nextCameraName: next.cameraName,
    nextSourceFrame: next.sourceFrame,
    nextSegmentIndex: next.segmentIndex,
    positionDistance: round(delta.position, 4),
    rotationDegrees: round(delta.rotationDegrees, 4),
    fovDegrees: round(delta.fovDegrees, 4),
  };
}

function cameraTrajectoryDiscontinuityError(
  previous: NormalizedCameraTimelineEntry,
  next: NormalizedCameraTimelineEntry,
  delta: CameraTrajectoryBoundaryDelta,
): Error {
  return new Error([
    `Camera trajectory boundary discontinuity at frame ${next.frame}.`,
    `Cannot stitch ${previous.cameraName} source frame ${previous.sourceFrame} to ${next.cameraName} source frame ${next.sourceFrame}.`,
    `Deltas: position ${round(delta.position, 4)} (threshold ${CAMERA_TRAJECTORY_STITCHING_THRESHOLDS.position}),`,
    `rotation ${round(delta.rotationDegrees, 4)}deg (threshold ${CAMERA_TRAJECTORY_STITCHING_THRESHOLDS.rotationDegrees}deg),`,
    `fov ${round(delta.fovDegrees, 4)}deg (threshold ${CAMERA_TRAJECTORY_STITCHING_THRESHOLDS.fovDegrees}deg).`,
    'A single Visionary camera timeline must be continuous; use separate candidate trajectories for cuts.',
  ].join(' '));
}

function pushStitchedTimelineEntry(
  entries: NormalizedCameraTimelineEntry[],
  entry: NormalizedCameraTimelineEntry,
  diagnostics: JsonRecord[],
): void {
  const previous = entries[entries.length - 1];
  if (previous && previous.frame === entry.frame) {
    const delta = cameraTrajectoryBoundaryDelta(previous, entry);
    if (cameraTrajectoryBoundaryDeltaWithinThreshold(delta)) {
      diagnostics.push(cameraTrajectoryStitchingDiagnostic(previous, entry, delta));
      return;
    }
    throw cameraTrajectoryDiscontinuityError(previous, entry, delta);
  }
  entries.push(entry);
}

function pickEvalKeyframes(camera: TrajectoryCamera, firstFrameOnly: boolean): TrajectoryKeyframe[] {
  const keyframes = [...camera.keyframes].sort((a, b) => a.frame - b.frame);
  if (keyframes.length <= 0) return [];
  if (firstFrameOnly || keyframes.length <= 2) return [keyframes[0]];
  const middleIndex = Math.floor((keyframes.length - 1) / 2);
  return [keyframes[0], keyframes[middleIndex], keyframes[keyframes.length - 1]]
    .filter((item, index, list) => list.findIndex((candidate) => candidate.frame === item.frame) === index);
}

function evalFrameLabel(index: number, total: number): string {
  if (total <= 1) return 'first';
  if (index === 0) return 'start';
  if (index === total - 1) return 'end';
  return 'middle';
}

function buildTrajectoryEvalRenderRequests(input: {
  projectRoot: string;
  outputRoot: string;
  projectName: string;
  rawTrajectory: unknown;
  cameraInit: unknown;
  firstFrameOnly: boolean;
  roundIndex: number;
}): JsonRecord[] {
  const cameras = normalizeRawTrajectoryCameras(input.rawTrajectory);
  const fovByCamera = cameraInitFovMap(input.cameraInit);
  const requests: JsonRecord[] = [];
  for (const camera of cameras) {
    const selected = pickEvalKeyframes(camera, input.firstFrameOnly);
    selected.forEach((keyframe, index) => {
      const label = evalFrameLabel(index, selected.length);
      const outputPath = path.join(
        input.outputRoot,
        'data',
        'renders',
        input.projectName,
        'eval_keyframes',
        safeSegment(camera.camera_name, `camera_${String(requests.length + 1).padStart(3, '0')}`),
        `round_${String(input.roundIndex).padStart(2, '0')}`,
        `eval_${label}_${String(keyframe.frame).padStart(4, '0')}.png`,
      );
      requests.push({
        name: `${camera.camera_name}_${label}_${keyframe.frame}`,
        outputPath: toRelative(input.projectRoot, outputPath),
        resolution: { width: 320, height: 180 },
        camera: {
          pose: {
            position: vec3Object(keyframe.position),
            quaternion: wxyzToXyzw(keyframe.rotation_quaternion),
          },
          fovDegrees: fovByCamera.get(camera.camera_name) || 50,
          near: 0.01,
          far: 2000,
        },
        source: {
          stage: 'camera_trajectory_eval_render',
          roundIndex: input.roundIndex,
          cameraName: camera.camera_name,
          sourceFrame: keyframe.frame,
          coordinateSystem: VISIONARY_COORDINATE_SYSTEM,
          quaternionConvention: 'camera-to-world',
        },
      });
    });
  }
  return requests;
}

export function normalizeCameraTrajectoryPayload(payload: unknown, options: {
  runId: string;
  fps: number;
  segmentDuration: number;
  segmentCount: number;
  keyframeInterval: number;
  firstFrameOnly: boolean;
  cameraInit?: unknown;
  sourcePath?: string;
}): JsonRecord {
  const record = readRecord(payload);
  if (record.schema === 'visionary.camera_trajectory') {
    return record;
  }
  const cameras = normalizeRawTrajectoryCameras(payload);
  if (cameras.length <= 0) {
    throw new Error('Trajectory payload has no valid cameras/keyframes.');
  }
  const fps = normalizePositiveInt(options.fps, 30);
  const segmentDuration = normalizePositiveInt(options.segmentDuration, 3);
  const segmentFrames = fps * segmentDuration;
  const fovByCamera = cameraInitFovMap(options.cameraInit);
  const candidateKeyframes: NormalizedCameraTimelineEntry[] = [];
  const stitchingDiagnostics: JsonRecord[] = [];

  for (const [cameraIndex, camera] of cameras.entries()) {
    const segmentOffset = cameraIndex * segmentFrames;
    const fovDegrees = fovByCamera.get(camera.camera_name) || 50;
    for (const keyframe of [...camera.keyframes].sort((a, b) => a.frame - b.frame)) {
      const frame = segmentOffset + keyframe.frame;
      const time = frame / fps;
      const cameraToWorld = wxyzToXyzw(keyframe.rotation_quaternion);
      const worldToCamera = invertXyzw(cameraToWorld);
      const timelineKeyframe = {
        frame,
        time,
        cameraName: camera.camera_name,
        sourceFrame: keyframe.frame,
        camera: {
          position: {
            x: keyframe.position[0],
            y: keyframe.position[1],
            z: keyframe.position[2],
          },
          rotation: worldToCamera,
          fovDegrees,
        },
        renderFrameCamera: {
          pose: {
            position: {
              x: keyframe.position[0],
              y: keyframe.position[1],
              z: keyframe.position[2],
            },
            quaternion: cameraToWorld,
          },
          fovDegrees,
        },
        source: {
          rotationQuaternionWxyz: roundQuat(keyframe.rotation_quaternion, 6),
          quaternionConvention: 'camera-to-world',
        },
      };
      const fovKeyframe = {
        frame,
        time,
        fovDegrees,
      };
      candidateKeyframes.push({
        frame,
        time,
        cameraName: camera.camera_name,
        sourceFrame: keyframe.frame,
        segmentIndex: cameraIndex,
        position: keyframe.position,
        rotationQuaternionWxyz: keyframe.rotation_quaternion,
        fovDegrees,
        timelineKeyframe,
        fovKeyframe,
      });
    }
  }

  candidateKeyframes.sort((a, b) => a.frame - b.frame
    || a.segmentIndex - b.segmentIndex
    || a.sourceFrame - b.sourceFrame
    || a.cameraName.localeCompare(b.cameraName));
  const stitchedKeyframes: NormalizedCameraTimelineEntry[] = [];
  for (const entry of candidateKeyframes) {
    pushStitchedTimelineEntry(stitchedKeyframes, entry, stitchingDiagnostics);
  }
  const keyframes = stitchedKeyframes.map((entry) => entry.timelineKeyframe);
  const fovKeyframes = stitchedKeyframes.map((entry) => entry.fovKeyframe);
  const maxFrame = keyframes.reduce((max, keyframe) => Math.max(max, Number(keyframe.frame) || 0), 0);
  const totalFrames = Math.max(maxFrame + 1, cameras.length * segmentFrames);

  return {
    schema: 'visionary.camera_trajectory',
    version: 1,
    runId: options.runId,
    stage: 'camera_trajectory',
    sourceSchema: 'trajectory_gen.multi_camera',
    sourcePath: options.sourcePath || '',
    coordinateSystem: VISIONARY_COORDINATE_SYSTEM,
    timelineQuaternionConvention: 'world-to-camera',
    renderFrameQuaternionConvention: 'camera-to-world',
    sourceQuaternionOrder: 'wxyz',
    quaternionOrder: 'xyzw',
    fps,
    segmentCount: options.segmentCount,
    segmentDuration,
    keyframeInterval: options.keyframeInterval,
    firstFrameOnly: options.firstFrameOnly,
    totalFrames,
    durationSec: totalFrames / fps,
    cameras: cameras.map((camera) => ({
      ...camera,
      keyframes: camera.keyframes.map((keyframe) => ({
        frame: keyframe.frame,
        position: roundVec3(keyframe.position, 4),
        rotation_quaternion: roundQuat(keyframe.rotation_quaternion, 6),
      })),
    })),
    timeline: {
      fps,
      durationSec: totalFrames / fps,
      selectedFrame: 0,
      currentTime: 0,
      isLooping: false,
      positionInterpolationMode: 'catmull-rom',
      rotationInterpolationMode: 'slerp',
      timingInterpolationMode: 'linear',
      keyframes,
      fovKeyframes,
      stitching: {
        policy: 'continuous-single-pose-per-frame',
        thresholds: {
          ...CAMERA_TRAJECTORY_STITCHING_THRESHOLDS,
        },
        droppedBoundaryKeyframes: stitchingDiagnostics,
      },
    },
  };
}

function trajectoryDependencyTree(input: {
  runId: string;
  projectRoot: string;
  sceneInfoDir: string;
  configPath: string;
  cameraInitPath: string;
  sceneAnalysisPath: string;
  rawTrajectoryPath: string;
  rawTrajectoryTextPath: string;
  visionaryTrajectoryPath: string;
  vlmDebugManifestPath?: string;
}): JsonRecord {
  const sceneInfoId = 'scene_info';
  const configId = 'trajectory_gen_config';
  const cameraInitId = 'camera_init';
  const sceneAnalysisId = 'scene_analysis';
  const rawTrajectoryId = 'trajectory_gen_raw_json';
  const rawTrajectoryTextId = 'trajectory_gen_raw_txt';
  const visionaryTrajectoryId = 'visionary_camera_trajectory';
  return {
    schema: 'visionary.new_pipeline.dependency_tree',
    version: 1,
    runId: input.runId,
    stage: 'camera_trajectory_generation',
    nodes: [
      { id: sceneInfoId, kind: 'trajectory_gen_scene_info_dir', relativePath: toRelative(input.projectRoot, input.sceneInfoDir) },
      { id: configId, kind: 'trajectory_gen_config', relativePath: toRelative(input.projectRoot, input.configPath) },
      { id: cameraInitId, kind: 'camera_init', relativePath: toRelative(input.projectRoot, input.cameraInitPath) },
      { id: sceneAnalysisId, kind: 'director_scene_analysis', relativePath: toRelative(input.projectRoot, input.sceneAnalysisPath) },
      { id: rawTrajectoryId, kind: 'trajectory_gen_raw_json', relativePath: toRelative(input.projectRoot, input.rawTrajectoryPath) },
      { id: rawTrajectoryTextId, kind: 'trajectory_gen_raw_txt', relativePath: toRelative(input.projectRoot, input.rawTrajectoryTextPath) },
      { id: visionaryTrajectoryId, kind: 'visionary_camera_trajectory', relativePath: toRelative(input.projectRoot, input.visionaryTrajectoryPath) },
      ...(input.vlmDebugManifestPath ? [{ id: 'vlm_debug_manifest', kind: 'camera_trajectory_vlm_debug_manifest', relativePath: toRelative(input.projectRoot, input.vlmDebugManifestPath) }] : []),
    ],
    edges: [
      { from: sceneInfoId, to: configId, relation: 'referenced_by' },
      { from: configId, to: cameraInitId, relation: 'generates' },
      { from: cameraInitId, to: sceneAnalysisId, relation: 'informs' },
      { from: sceneAnalysisId, to: rawTrajectoryId, relation: 'prompts' },
      { from: rawTrajectoryId, to: visionaryTrajectoryId, relation: 'converted_to_visionary_timeline' },
      { from: rawTrajectoryTextId, to: rawTrajectoryId, relation: 'same_trajectory_text_form' },
      ...(input.vlmDebugManifestPath ? [
        { from: configId, to: 'vlm_debug_manifest', relation: 'debug_records' },
        { from: cameraInitId, to: 'vlm_debug_manifest', relation: 'debug_records' },
        { from: rawTrajectoryId, to: 'vlm_debug_manifest', relation: 'debug_records' },
      ] : []),
    ],
  };
}

export async function generateCameraTrajectory(input: {
  projectRoot: string;
  projectId: string;
  sceneInfoPath?: string;
  humanText: string;
  segmentCount: number;
  segmentDuration: number;
  fps: number;
  keyframeInterval: number;
  firstFrameOnly: boolean;
  runLabel: string;
  apiKey?: string;
  apiBase?: string;
  apiProvider?: string;
  modelName?: string;
  sceneBoundsScale?: number;
  debugEvalOnly?: boolean;
  maxOptimizationRounds?: number;
}): Promise<JsonRecord> {
  const prepared = await prepareCameraTrajectoryRender(input);
  return {
    ...prepared,
    needsRender: true,
    renderStage: 'camera_initial_view_prepare',
  };
}

export async function prepareCameraTrajectoryRender(input: {
  projectRoot: string;
  projectId: string;
  sceneInfoPath?: string;
  humanText: string;
  segmentCount: number;
  segmentDuration: number;
  fps: number;
  keyframeInterval: number;
  firstFrameOnly: boolean;
  runLabel: string;
  apiKey?: string;
  apiBase?: string;
  apiProvider?: string;
  modelName?: string;
  sceneBoundsScale?: number;
  debugEvalOnly?: boolean;
  maxOptimizationRounds?: number;
}): Promise<JsonRecord> {
  const title = '相机初始视图准备';
  const root = path.resolve(input.projectRoot);
  const runId = nowRunId();
  const outputRoot = projectOutputRoot(input.projectRoot, input.projectId, input.runLabel, runId);
  const projectName = safeSegment(input.projectId, 'visionary-project');
  const configPath = path.join(outputRoot, 'config.json');
  const projectSceneInfoDir = path.join(outputRoot, 'data', 'scene_info', projectName);
  const projectCameraInitDir = path.join(outputRoot, 'data', 'camera_init', projectName);
  const projectTrajectoryDir = path.join(outputRoot, 'data', 'trajectory', projectName);
  const fileSuffix = input.firstFrameOnly ? '_first_frame' : '';
  const rawTrajectoryPath = path.join(projectTrajectoryDir, `trajectory_multi_camera${fileSuffix}.json`);
  const rawTrajectoryTextPath = path.join(projectTrajectoryDir, `trajectory_multi_camera${fileSuffix}.txt`);
  const cameraInitPath = path.join(projectCameraInitDir, 'camera_init.json');
  const debugDir = path.join(outputRoot, 'vlm_debug');

  if (!isPathInside(root, outputRoot)) {
    throw new Error('Resolved output path escapes project root.');
  }

  emitProgress(title, '准备 Trajectory_gen 工作目录', 0.01, 'camera_initial_view_prepare', 'running');
  await mkdir(projectSceneInfoDir, { recursive: true });
  await mkdir(projectCameraInitDir, { recursive: true });
  await mkdir(projectTrajectoryDir, { recursive: true });
  await mkdir(debugDir, { recursive: true });

  const sceneBundle = input.sceneInfoPath
    ? await readSceneInfoBundle(input.projectRoot, input.sceneInfoPath)
    : await buildSceneInfoBundle({
      projectRoot: input.projectRoot,
      sceneBoundsScale: input.sceneBoundsScale,
    });
  await writeSceneInfoBundle(projectSceneInfoDir, sceneBundle);

  const config = buildTrajectoryConfig({
    outputRoot,
    projectName,
    humanText: input.humanText,
    segmentCount: normalizePositiveInt(input.segmentCount, 1, 1, 24),
    segmentDuration: normalizePositiveInt(input.segmentDuration, 3, 1, 120),
    fps: normalizePositiveInt(input.fps, 30, 1, 240),
    keyframeInterval: normalizePositiveInt(input.keyframeInterval, 5, 1, 1000),
    firstFrameOnly: Boolean(input.firstFrameOnly),
    debugEvalOnly: Boolean(input.debugEvalOnly),
    maxOptimizationRounds: normalizePositiveInt(input.maxOptimizationRounds, 1, 1, 10),
    apiKey: input.apiKey,
    apiBase: input.apiBase,
    apiProvider: input.apiProvider,
    modelName: input.modelName,
  });
  await writeJsonFile(configPath, config);

  const env = {
    HUMAN_TEXT: input.humanText,
    SEGMENT_COUNT: String(config.segment_count),
    SEGMENT_DURATION: String(config.segment_duration),
    FPS: String(config.fps),
    KEYFRAME_INTERVAL: String(config.keyframe_interval),
    FIRST_FRAME_ONLY: input.firstFrameOnly ? 'true' : 'false',
    MAX_OPTIMIZATION_ROUNDS: String(config.max_optimization_rounds || 0),
    LLM_API_PROVIDER: String(config.api_provider || ''),
    LLM_MODEL_NAME: String(config.model_name || ''),
    GENAI_API_BASE: String(config.api_base || ''),
  };
  const pythonRuns: JsonRecord[] = [];
  const expectedInitialViewPaths = [1, 2, 3].map((index) => (
    path.join(outputRoot, 'data', 'renders', projectName, 'initial_views', `camera_${String(index).padStart(3, '0')}.png`)
  ));

  emitProgress(title, '生成初始相机 JSON', 0.18, 'camera_initial_view_prepare', 'running');
  const cameraViewWrapperPath = await writeCameraViewExporterWrapper(outputRoot);
  const cameraViewArgs = [cameraViewWrapperPath, configPath];
  const cameraViewRun = await runPythonScript(cameraViewArgs, TRAJECTORY_GEN_ROOT, env);
  pythonRuns.push(await writePythonRunDebug({
    projectRoot: input.projectRoot,
    debugDir,
    label: '01_camera_view_exporter',
    args: cameraViewArgs,
    cwd: TRAJECTORY_GEN_ROOT,
    env,
    result: cameraViewRun,
  }));

  const cameraInit = await pathExists(cameraInitPath) ? readRecord(await readJsonFile(cameraInitPath)) : {};
  const focusPath = path.join(projectCameraInitDir, 'camera_view_focus.json');
  const focus = await pathExists(focusPath) ? readRecord(await readJsonFile(focusPath)) : {};
  const subsceneInfo = readRecord(focus.subscene_info);
  const fallbackSceneInfo = readRecord(sceneBundle.sceneInfo);
  const target = tuple3(subsceneInfo.center_xyz || fallbackSceneInfo.center_xyz, [0, 0, 0]);
  const cameras = Array.isArray(cameraInit.cameras) ? cameraInit.cameras.map(readRecord) : [];
  const renderRequests = cameras.map((camera, index) => {
    const name = String(camera.name || `camera_${String(index + 1).padStart(3, '0')}`).trim();
    const outputPath = path.join(outputRoot, 'data', 'renders', projectName, 'initial_views', `${name}.png`);
    return {
      name,
      outputPath: toRelative(input.projectRoot, outputPath),
      resolution: { width: 1920, height: 1080 },
      camera: {
        lookAt: {
          position: vec3Object(tuple3(camera.location, [0, 0, 0])),
          target: vec3Object(target),
          up: { x: 0, y: 1, z: 0 },
        },
        fovDegrees: finiteNumber(camera.fov, 50),
        near: finiteNumber(camera.clip_start, 0.01),
        far: finiteNumber(camera.clip_end, 2000),
      },
      source: {
        coordinateSystem: VISIONARY_COORDINATE_SYSTEM,
        targetSource: subsceneInfo.center_xyz ? 'camera_view_focus.subscene_info.center_xyz' : 'scene_info.center_xyz',
        originalTrajectoryGenQuaternionWxyz: tuple4Wxyz(camera.rotation_quaternion),
        quaternionIgnoredForVisionaryInitialRender: true,
      },
    };
  });

  const preparedPath = path.join(outputRoot, 'camera_trajectory_prepare.json');
  const prepared = {
    schema: 'visionary.camera_trajectory.prepare',
    version: 1,
    runId,
    projectId: input.projectId,
    outputRoot: toRelative(input.projectRoot, outputRoot),
    configPath: toRelative(input.projectRoot, configPath),
    sceneInfoDir: toRelative(input.projectRoot, projectSceneInfoDir),
    cameraInitPath: toRelative(input.projectRoot, cameraInitPath),
    renderDir: toRelative(input.projectRoot, path.join(outputRoot, 'data', 'renders', projectName)),
    trajectoryDir: toRelative(input.projectRoot, projectTrajectoryDir),
    debugDir: toRelative(input.projectRoot, debugDir),
    rawTrajectoryPath: toRelative(input.projectRoot, rawTrajectoryPath),
    rawTrajectoryTextPath: toRelative(input.projectRoot, rawTrajectoryTextPath),
    debugEvalOnly: Boolean(config.debug_eval_only),
    maxOptimizationRounds: Number(config.max_optimization_rounds || 0),
    optimizationRound: 0,
    renderRequests,
    pythonRuns,
    warnings: sceneBundle.warnings,
  };
  await writeJsonFile(preparedPath, prepared);

  const files = [
    await fileAsset(input.projectRoot, 'camera_trajectory_prepare', preparedPath, 'application/json', { kind: 'camera_trajectory_prepare' }),
    await fileAsset(input.projectRoot, 'trajectory_config', configPath, 'application/json', { kind: 'trajectory_config' }),
    await fileAsset(input.projectRoot, 'camera_init', cameraInitPath, 'application/json', { kind: 'camera_init' }),
  ];
  const initialViewImages = await existingInitialViewImages(
    input.projectRoot,
    renderRequests.map((request) => String(readRecord(request).outputPath || '')),
  );

  emitProgress(title, '请使用 Visionary 渲染初始三视图', 1, 'camera_initial_view_prepare', 'rendering');
  return {
    ok: true,
    stage: 'camera_initial_view_prepare',
    runId,
    prepared: {
      relativePath: toRelative(input.projectRoot, preparedPath),
      data: prepared,
    },
    renderRequests,
    files,
    images: initialViewImages,
    visionaryTask: {
      title,
      message: `已生成 ${renderRequests.length} 个 Visionary 初始视图渲染请求`,
      progress: 1,
      stage: 'camera_initial_view_prepare',
      statusId: 'rendering',
      pipelineStageStatuses: buildCameraPipelineStageStatuses('camera_initial_view_prepare', 'rendering'),
      files,
      images: initialViewImages,
      initialViewImages,
      warnings: sceneBundle.warnings,
    },
    warnings: sceneBundle.warnings,
  };
}

function vec3Object(value: Vec3): { x: number; y: number; z: number } {
  return { x: value[0], y: value[1], z: value[2] };
}

export async function continueCameraTrajectoryAfterRender(input: {
  projectRoot: string;
  projectId: string;
  preparedPath: string;
}): Promise<JsonRecord> {
  const title = '相机轨迹生成';
  const root = path.resolve(input.projectRoot);
  const resolvedPreparedPath = path.resolve(root, input.preparedPath);
  if (!isPathInside(root, resolvedPreparedPath)) {
    throw new Error('Resolved prepared path escapes project root.');
  }
  const prepared = readRecord(await readJsonFile(resolvedPreparedPath));
  const runId = String(prepared.runId || nowRunId());
  const outputRoot = path.resolve(root, String(prepared.outputRoot || ''));
  if (!isPathInside(root, outputRoot)) {
    throw new Error('Resolved output path escapes project root.');
  }
  const configPath = path.resolve(root, String(prepared.configPath || ''));
  const projectSceneInfoDir = path.resolve(root, String(prepared.sceneInfoDir || ''));
  const projectCameraInitDir = path.dirname(path.resolve(root, String(prepared.cameraInitPath || '')));
  const projectTrajectoryDir = path.resolve(root, String(prepared.trajectoryDir || ''));
  const debugDir = path.resolve(root, String(prepared.debugDir || path.join(String(prepared.outputRoot || ''), 'vlm_debug')));
  const rawTrajectoryPath = path.resolve(root, String(prepared.rawTrajectoryPath || ''));
  const rawTrajectoryTextPath = path.resolve(root, String(prepared.rawTrajectoryTextPath || ''));
  const cameraInitPath = path.resolve(root, String(prepared.cameraInitPath || ''));
  const sceneAnalysisPath = path.join(projectCameraInitDir, 'all_scene_analysis.json');
  const visionaryTrajectoryPath = path.join(outputRoot, 'visionary_camera_trajectory.json');
  const vlmDebugManifestPath = path.join(debugDir, 'manifest.json');
  const config = normalizeTrajectoryLlmConfig(readRecord(await readJsonFile(configPath)));
  assertTrajectoryLlmConfig(config);
  await writeJsonFile(configPath, config);
  const env = {
    HUMAN_TEXT: String(config.human_text || ''),
    SEGMENT_COUNT: String(config.segment_count || 1),
    SEGMENT_DURATION: String(config.segment_duration || 3),
    FPS: String(config.fps || 30),
    KEYFRAME_INTERVAL: String(config.keyframe_interval || 5),
    FIRST_FRAME_ONLY: config.first_frame_only ? 'true' : 'false',
    MAX_OPTIMIZATION_ROUNDS: String(config.max_optimization_rounds || 0),
    LLM_API_PROVIDER: String(config.api_provider || ''),
    LLM_MODEL_NAME: String(config.model_name || ''),
    GENAI_API_BASE: String(config.api_base || ''),
  };
  const pythonRuns = Array.isArray(prepared.pythonRuns) ? prepared.pythonRuns.map(readRecord) : [];

  emitProgress(title, '生成场景分析和导演意图', 0.45, 'camera_director_analysis', 'running');
  const directorArgs = [
    path.join(TRAJECTORY_GEN_ROOT, 'pipeline', 'director_trajectory_generator.py'),
    configPath,
  ];
  const directorRun = await runPythonScript(directorArgs, TRAJECTORY_GEN_ROOT, env);
  pythonRuns.push(await writePythonRunDebug({
    projectRoot: input.projectRoot,
    debugDir,
    label: '02_director_trajectory_generator',
    args: directorArgs,
    cwd: TRAJECTORY_GEN_ROOT,
    env,
    result: directorRun,
  }));

  emitProgress(title, '生成分镜相机轨迹', 0.72, 'camera_trajectory_generation', 'running');
  const trajectoryArgs = [
    path.join(TRAJECTORY_GEN_ROOT, 'pipeline', 'trajectory_generator.py'),
    configPath,
  ];
  const trajectoryRun = await runPythonScript(trajectoryArgs, TRAJECTORY_GEN_ROOT, env);
  pythonRuns.push(await writePythonRunDebug({
    projectRoot: input.projectRoot,
    debugDir,
    label: '03_trajectory_generator',
    args: trajectoryArgs,
    cwd: TRAJECTORY_GEN_ROOT,
    env,
    result: trajectoryRun,
  }));
  const directorIntentText = await readDirectorIntentText(sceneAnalysisPath);

  if (!await pathExists(rawTrajectoryPath)) {
    throw new Error(`Expected trajectory JSON was not created: ${rawTrajectoryPath}`);
  }

  const cameraInit = await pathExists(cameraInitPath) ? await readJsonFile(cameraInitPath) : {};
  const rawTrajectory = await readTrajectoryPayload(rawTrajectoryPath);
  if (Boolean(config.debug_eval_only)) {
    const roundIndex = 1;
    const evalRenderRequests = buildTrajectoryEvalRenderRequests({
      projectRoot: input.projectRoot,
      outputRoot,
      projectName: safeSegment(input.projectId, 'visionary-project'),
      rawTrajectory,
      cameraInit,
      firstFrameOnly: Boolean(config.first_frame_only),
      roundIndex,
    });
    const evalRenderRequestsPath = path.join(outputRoot, `eval_render_requests_round_${String(roundIndex).padStart(2, '0')}.json`);
    await writeJsonFile(evalRenderRequestsPath, {
      schema: 'visionary.camera_trajectory.eval_render_requests',
      version: 1,
      runId,
      roundIndex,
      requests: evalRenderRequests,
    });
    const nextPrepared = {
      ...prepared,
      pythonRuns,
      optimizationRound: roundIndex,
      evalRenderRequestsPath: toRelative(input.projectRoot, evalRenderRequestsPath),
    };
    await writeJsonFile(resolvedPreparedPath, nextPrepared);
    const files = [
      await fileAsset(input.projectRoot, 'trajectory_raw_json', rawTrajectoryPath, 'application/json', { kind: 'trajectory_gen_raw_json' }),
      await fileAsset(input.projectRoot, 'camera_trajectory_eval_render_requests', evalRenderRequestsPath, 'application/json', { kind: 'camera_trajectory_eval_render_requests' }),
    ];
    const warnings = Array.isArray(prepared.warnings) ? prepared.warnings.map(String) : [];
    const initialViewImages = await existingInitialViewImages(
      input.projectRoot,
      (Array.isArray(prepared.renderRequests) ? prepared.renderRequests : []).map((request) => String(readRecord(request).outputPath || '')),
    );
    emitProgress(title, '准备 Visionary 轨迹评估渲染', 0.82, 'camera_trajectory_eval_render', 'rendering');
    return {
      ok: true,
      stage: 'camera_trajectory_eval_render',
      runId,
      needsEvalRender: true,
      preparedPath: toRelative(input.projectRoot, resolvedPreparedPath),
      evalRenderRequests,
      trajectory: {
        relativePath: toRelative(input.projectRoot, rawTrajectoryPath),
        data: rawTrajectory,
      },
      files,
    visionaryTask: {
      title,
      message: `准备 ${evalRenderRequests.length} 张 Visionary 轨迹评估渲染`,
      progress: 0.82,
      stage: 'camera_trajectory_eval_render',
      statusId: 'rendering',
        pipelineStageStatuses: buildCameraPipelineStageStatuses('camera_trajectory_eval_render', 'rendering'),
        directorIntentText,
        initialViewImages,
        artifacts: directorIntentText ? [{
          kind: 'text',
          title: '导演意图',
          text: directorIntentText,
          targetStage: 'camera_director_analysis',
        }] : [],
        trajectory: {
          relativePath: toRelative(input.projectRoot, rawTrajectoryPath),
          data: rawTrajectory,
        },
        files,
        images: [],
        warnings,
      },
      warnings,
    };
  }

  emitProgress(title, '转换为 Visionary 相机轨迹格式', 0.9, 'camera_trajectory_generation', 'running');
  const visionaryTrajectory = normalizeCameraTrajectoryPayload(rawTrajectory, {
    runId,
    fps: Number(config.fps),
    segmentDuration: Number(config.segment_duration),
    segmentCount: Number(config.segment_count),
    keyframeInterval: Number(config.keyframe_interval),
    firstFrameOnly: Boolean(config.first_frame_only),
    cameraInit,
    sourcePath: toRelative(input.projectRoot, rawTrajectoryPath),
  });
  await writeJsonFile(visionaryTrajectoryPath, visionaryTrajectory);

  const tree = trajectoryDependencyTree({
    runId,
    projectRoot: input.projectRoot,
    sceneInfoDir: projectSceneInfoDir,
    configPath,
    cameraInitPath,
    sceneAnalysisPath,
    rawTrajectoryPath,
    rawTrajectoryTextPath,
    visionaryTrajectoryPath,
    vlmDebugManifestPath,
  });
  const manifestPath = path.join(outputRoot, 'dependency_tree.json');
  await writeJsonFile(manifestPath, tree);
  const expectedInitialViewPaths = Array.isArray(prepared.renderRequests)
    ? prepared.renderRequests.map((request) => path.resolve(root, String(readRecord(request).outputPath || '')))
    : [1, 2, 3].map((index) => path.join(outputRoot, 'data', 'renders', safeSegment(input.projectId, 'visionary-project'), 'initial_views', `camera_${String(index).padStart(3, '0')}.png`));
  const vlmDebug = await writeVlmDebugManifest({
    projectRoot: input.projectRoot,
    projectId: input.projectId,
    runId,
    outputRoot,
    debugDir,
    configPath,
    config,
    sceneInfoDir: projectSceneInfoDir,
    renderDir: path.resolve(root, String(prepared.renderDir || '')),
    cameraInitDir: projectCameraInitDir,
    trajectoryDir: projectTrajectoryDir,
    expectedInitialViewPaths,
    pythonRuns,
    warnings: Array.isArray(prepared.warnings) ? prepared.warnings.map(String) : [],
  });
  const initialViewImages = await existingInitialViewImages(input.projectRoot, expectedInitialViewPaths);

  const files = [
    await fileAsset(input.projectRoot, 'trajectory_config', configPath, 'application/json', { kind: 'trajectory_config' }),
    await fileAsset(input.projectRoot, 'camera_init', cameraInitPath, 'application/json', { kind: 'camera_init' }),
    await fileAsset(input.projectRoot, 'scene_analysis', sceneAnalysisPath, 'application/json', { kind: 'scene_analysis' }),
    await fileAsset(input.projectRoot, 'trajectory_raw_json', rawTrajectoryPath, 'application/json', { kind: 'trajectory_gen_raw_json' }),
    ...(await pathExists(rawTrajectoryTextPath)
      ? [await fileAsset(input.projectRoot, 'trajectory_raw_text', rawTrajectoryTextPath, 'text/plain', { kind: 'trajectory_gen_raw_text' })]
      : []),
    await fileAsset(input.projectRoot, 'visionary_camera_trajectory', visionaryTrajectoryPath, 'application/json', { kind: 'visionary_camera_trajectory' }),
    await fileAsset(input.projectRoot, 'camera_trajectory_vlm_debug_manifest', vlmDebug.manifestPath, 'application/json', { kind: 'camera_trajectory_vlm_debug_manifest' }),
    await fileAsset(input.projectRoot, 'camera_trajectory_vlm_debug_readme', vlmDebug.readmePath, 'text/markdown', { kind: 'camera_trajectory_vlm_debug_readme' }),
  ];

  emitProgress(title, '相机轨迹生成完成', 1, 'camera_trajectory_generation', 'done', {
    skipEvalRender: true,
  });
  return {
    ok: true,
    stage: 'camera_trajectory_generation',
    runId,
    batchOutput: {
      relativePath: toRelative(input.projectRoot, outputRoot),
    },
    trajectory: {
      relativePath: toRelative(input.projectRoot, visionaryTrajectoryPath),
      data: visionaryTrajectory,
    },
    files,
    images: [],
    dependencyTree: {
      relativePath: toRelative(input.projectRoot, manifestPath),
      data: tree,
    },
    vlmDebug: {
      relativePath: toRelative(input.projectRoot, vlmDebug.manifestPath),
      directory: toRelative(input.projectRoot, debugDir),
      data: vlmDebug.data,
    },
    visionaryTask: {
      title,
      message: `生成 ${Array.isArray(readRecord(visionaryTrajectory.timeline).keyframes) ? (readRecord(visionaryTrajectory.timeline).keyframes as unknown[]).length : 0} 个相机关键帧`,
      progress: 1,
      stage: 'camera_trajectory_generation',
      statusId: 'done',
      pipelineStageStatuses: buildCameraPipelineStageStatuses('camera_trajectory_generation', 'done', {
        skipEvalRender: true,
      }),
      directorIntentText,
      initialViewImages,
      artifacts: directorIntentText ? [{
        kind: 'text',
        title: '导演意图',
        text: directorIntentText,
        targetStage: 'camera_director_analysis',
      }] : [],
      trajectory: {
        relativePath: toRelative(input.projectRoot, visionaryTrajectoryPath),
        data: visionaryTrajectory,
      },
      files,
      images: [],
      dependencyTree: {
        relativePath: toRelative(input.projectRoot, manifestPath),
        data: tree,
      },
      warnings: Array.isArray(prepared.warnings) ? prepared.warnings.map(String) : [],
    },
    warnings: Array.isArray(prepared.warnings) ? prepared.warnings.map(String) : [],
  };
}

export async function continueCameraTrajectoryAfterEvalRender(input: {
  projectRoot: string;
  projectId: string;
  preparedPath: string;
}): Promise<JsonRecord> {
  const title = '相机轨迹评估优化';
  const root = path.resolve(input.projectRoot);
  const resolvedPreparedPath = path.resolve(root, input.preparedPath);
  if (!isPathInside(root, resolvedPreparedPath)) {
    throw new Error('Resolved prepared path escapes project root.');
  }
  const prepared = readRecord(await readJsonFile(resolvedPreparedPath));
  const runId = String(prepared.runId || nowRunId());
  const outputRoot = path.resolve(root, String(prepared.outputRoot || ''));
  if (!isPathInside(root, outputRoot)) {
    throw new Error('Resolved output path escapes project root.');
  }
  const configPath = path.resolve(root, String(prepared.configPath || ''));
  const projectSceneInfoDir = path.resolve(root, String(prepared.sceneInfoDir || ''));
  const projectCameraInitDir = path.dirname(path.resolve(root, String(prepared.cameraInitPath || '')));
  const projectTrajectoryDir = path.resolve(root, String(prepared.trajectoryDir || ''));
  const debugDir = path.resolve(root, String(prepared.debugDir || path.join(String(prepared.outputRoot || ''), 'vlm_debug')));
  const rawTrajectoryPath = path.resolve(root, String(prepared.rawTrajectoryPath || ''));
  const rawTrajectoryTextPath = path.resolve(root, String(prepared.rawTrajectoryTextPath || ''));
  const cameraInitPath = path.resolve(root, String(prepared.cameraInitPath || ''));
  const sceneAnalysisPath = path.join(projectCameraInitDir, 'all_scene_analysis.json');
  const visionaryTrajectoryPath = path.join(outputRoot, 'visionary_camera_trajectory.json');
  const vlmDebugManifestPath = path.join(debugDir, 'manifest.json');
  const roundIndex = normalizePositiveInt(prepared.optimizationRound, 1, 1, 10);
  const config = normalizeTrajectoryLlmConfig(readRecord(await readJsonFile(configPath)));
  assertTrajectoryLlmConfig(config);
  await writeJsonFile(configPath, config);
  const env = {
    HUMAN_TEXT: String(config.human_text || ''),
    SEGMENT_COUNT: String(config.segment_count || 1),
    SEGMENT_DURATION: String(config.segment_duration || 3),
    FPS: String(config.fps || 30),
    KEYFRAME_INTERVAL: String(config.keyframe_interval || 5),
    FIRST_FRAME_ONLY: config.first_frame_only ? 'true' : 'false',
    MAX_OPTIMIZATION_ROUNDS: String(config.max_optimization_rounds || 0),
    LLM_API_PROVIDER: String(config.api_provider || ''),
    LLM_MODEL_NAME: String(config.model_name || ''),
    GENAI_API_BASE: String(config.api_base || ''),
  };
  const pythonRuns = Array.isArray(prepared.pythonRuns) ? prepared.pythonRuns.map(readRecord) : [];

  emitProgress(title, '评估 Visionary 渲染关键帧并优化轨迹', 0.86, 'camera_trajectory_eval_render', 'rendering');
  const optimizationWrapperPath = await writeTrajectoryOptimizationRoundWrapper(outputRoot);
  const optimizationArgs = [optimizationWrapperPath, configPath, String(roundIndex)];
  const optimizationRun = await runPythonScript(optimizationArgs, TRAJECTORY_GEN_ROOT, env);
  pythonRuns.push(await writePythonRunDebug({
    projectRoot: input.projectRoot,
    debugDir,
    label: `04_trajectory_optimization_round_${String(roundIndex).padStart(2, '0')}`,
    args: optimizationArgs,
    cwd: TRAJECTORY_GEN_ROOT,
    env,
    result: optimizationRun,
  }));

  emitProgress(title, '转换优化后的 Visionary 相机轨迹格式', 0.94, 'camera_trajectory_generation', 'running', {
    evalRenderStatusId: 'done',
  });
  const cameraInit = await pathExists(cameraInitPath) ? await readJsonFile(cameraInitPath) : {};
  const rawTrajectory = await readTrajectoryPayload(rawTrajectoryPath);
  const visionaryTrajectory = normalizeCameraTrajectoryPayload(rawTrajectory, {
    runId,
    fps: Number(config.fps),
    segmentDuration: Number(config.segment_duration),
    segmentCount: Number(config.segment_count),
    keyframeInterval: Number(config.keyframe_interval),
    firstFrameOnly: Boolean(config.first_frame_only),
    cameraInit,
    sourcePath: toRelative(input.projectRoot, rawTrajectoryPath),
  });
  await writeJsonFile(visionaryTrajectoryPath, visionaryTrajectory);

  const tree = trajectoryDependencyTree({
    runId,
    projectRoot: input.projectRoot,
    sceneInfoDir: projectSceneInfoDir,
    configPath,
    cameraInitPath,
    sceneAnalysisPath,
    rawTrajectoryPath,
    rawTrajectoryTextPath,
    visionaryTrajectoryPath,
    vlmDebugManifestPath,
  });
  const manifestPath = path.join(outputRoot, 'dependency_tree.json');
  await writeJsonFile(manifestPath, tree);
  const expectedInitialViewPaths = Array.isArray(prepared.renderRequests)
    ? prepared.renderRequests.map((request) => path.resolve(root, String(readRecord(request).outputPath || '')))
    : [];
  const vlmDebug = await writeVlmDebugManifest({
    projectRoot: input.projectRoot,
    projectId: input.projectId,
    runId,
    outputRoot,
    debugDir,
    configPath,
    config,
    sceneInfoDir: projectSceneInfoDir,
    renderDir: path.resolve(root, String(prepared.renderDir || '')),
    cameraInitDir: projectCameraInitDir,
    trajectoryDir: projectTrajectoryDir,
    expectedInitialViewPaths,
    pythonRuns,
    warnings: Array.isArray(prepared.warnings) ? prepared.warnings.map(String) : [],
  });
  const directorIntentText = await readDirectorIntentText(sceneAnalysisPath);
  const initialViewImages = await existingInitialViewImages(input.projectRoot, expectedInitialViewPaths);
  const files = [
    await fileAsset(input.projectRoot, 'trajectory_config', configPath, 'application/json', { kind: 'trajectory_config' }),
    await fileAsset(input.projectRoot, 'camera_init', cameraInitPath, 'application/json', { kind: 'camera_init' }),
    await fileAsset(input.projectRoot, 'scene_analysis', sceneAnalysisPath, 'application/json', { kind: 'scene_analysis' }),
    await fileAsset(input.projectRoot, 'trajectory_raw_json', rawTrajectoryPath, 'application/json', { kind: 'trajectory_gen_raw_json' }),
    ...(await pathExists(rawTrajectoryTextPath)
      ? [await fileAsset(input.projectRoot, 'trajectory_raw_text', rawTrajectoryTextPath, 'text/plain', { kind: 'trajectory_gen_raw_text' })]
      : []),
    await fileAsset(input.projectRoot, 'visionary_camera_trajectory', visionaryTrajectoryPath, 'application/json', { kind: 'visionary_camera_trajectory' }),
    await fileAsset(input.projectRoot, 'camera_trajectory_vlm_debug_manifest', vlmDebug.manifestPath, 'application/json', { kind: 'camera_trajectory_vlm_debug_manifest' }),
    await fileAsset(input.projectRoot, 'camera_trajectory_vlm_debug_readme', vlmDebug.readmePath, 'text/markdown', { kind: 'camera_trajectory_vlm_debug_readme' }),
  ];
  emitProgress(title, '相机轨迹评估优化完成', 1, 'camera_trajectory_generation', 'done', {
    evalRenderStatusId: 'done',
  });
  return {
    ok: true,
    stage: 'camera_trajectory_generation',
    runId,
    batchOutput: {
      relativePath: toRelative(input.projectRoot, outputRoot),
    },
    trajectory: {
      relativePath: toRelative(input.projectRoot, visionaryTrajectoryPath),
      data: visionaryTrajectory,
    },
    files,
    images: [],
    dependencyTree: {
      relativePath: toRelative(input.projectRoot, manifestPath),
      data: tree,
    },
    vlmDebug: {
      relativePath: toRelative(input.projectRoot, vlmDebug.manifestPath),
      directory: toRelative(input.projectRoot, debugDir),
      data: vlmDebug.data,
    },
    visionaryTask: {
      title,
      message: `评估优化后生成 ${Array.isArray(readRecord(visionaryTrajectory.timeline).keyframes) ? (readRecord(visionaryTrajectory.timeline).keyframes as unknown[]).length : 0} 个相机关键帧`,
      progress: 1,
      stage: 'camera_trajectory_generation',
      statusId: 'done',
      pipelineStageStatuses: buildCameraPipelineStageStatuses('camera_trajectory_generation', 'done', {
        evalRenderStatusId: 'done',
      }),
      directorIntentText,
      initialViewImages,
      artifacts: directorIntentText ? [{
        kind: 'text',
        title: '导演意图',
        text: directorIntentText,
        targetStage: 'camera_director_analysis',
      }] : [],
      trajectory: {
        relativePath: toRelative(input.projectRoot, visionaryTrajectoryPath),
        data: visionaryTrajectory,
      },
      files,
      images: [],
      dependencyTree: {
        relativePath: toRelative(input.projectRoot, manifestPath),
        data: tree,
      },
      warnings: Array.isArray(prepared.warnings) ? prepared.warnings.map(String) : [],
    },
    warnings: Array.isArray(prepared.warnings) ? prepared.warnings.map(String) : [],
  };
}

async function toolResult(fn: () => Promise<JsonRecord>, title: string): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}> {
  try {
    const result = await fn();
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
        title,
        message,
        progress: 1,
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
}

async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: 'visionary-new-pipeline-camera-trajectory',
    version: '0.1.0',
  });

  server.registerTool(
    'export_scene_info',
    {
      title: 'Export scene info for camera trajectory',
      description: 'Read Visionary project scene.json and export Trajectory_gen-compatible scene_full_info.json, collections_info.json, and objects_info.json.',
      inputSchema: {
        projectId: z.string().min(1).optional().describe('Optional Visionary project id. Defaults to the project id injected by the host runtime.'),
        runLabel: z.string().default('camera-scene-info').describe('Optional safe label appended to the run output directory.'),
        sceneBoundsScale: z.number().min(0.1).max(20).default(3).describe('Scale used to expand the exported full-scene bounds around the center.'),
      },
    },
    async ({ projectId, runLabel, sceneBoundsScale }) => toolResult(async () => {
      const injectedProjectRoot = String(process.env.VISIONARY_PROJECT_ROOT || '').trim();
      if (!injectedProjectRoot) {
        throw new Error('VISIONARY_PROJECT_ROOT is not configured for this MCP server.');
      }
      return exportSceneInfo({
        projectId: projectId || String(process.env.VISIONARY_PROJECT_ID || 'project'),
        projectRoot: injectedProjectRoot,
        runLabel,
        sceneBoundsScale,
      });
    }, '相机场景信息导出'),
  );

  server.registerTool(
    'generate_camera_trajectory',
    {
      title: 'Generate camera trajectory',
      description: 'Run Trajectory_gen camera_view_exporter, director_trajectory_generator, and trajectory_generator against Visionary scene info, then emit a Visionary camera trajectory JSON.',
      inputSchema: {
        projectId: z.string().min(1).optional().describe('Optional Visionary project id. Defaults to the project id injected by the host runtime.'),
        sceneInfoPath: z.string().min(1).optional().describe('Project-relative path to a scene_info directory or scene_full_info.json produced by export_scene_info. If omitted, scene.json is exported first.'),
        humanText: z.string().default('').describe('Human camera direction or shot planning request.'),
        segmentCount: z.number().int().min(1).max(24).default(1).describe('Number of camera trajectory segments to generate.'),
        segmentDuration: z.number().int().min(1).max(120).default(3).describe('Duration in seconds for each segment.'),
        fps: z.number().int().min(1).max(240).default(30).describe('Timeline frames per second.'),
        keyframeInterval: z.number().int().min(1).max(1000).default(5).describe('Frame interval between generated keyframes.'),
        firstFrameOnly: z.boolean().default(false).describe('Generate one first-frame pose per segment instead of full segment trajectories.'),
        debugEvalOnly: z.boolean().default(false).describe('Hidden migration/debug switch matching Trajectory_gen --debug-eval-only. When true, runs the Visionary eval-render/optimization branch after initial trajectory generation.'),
        maxOptimizationRounds: z.number().int().min(1).max(10).default(1).describe('Hidden maximum optimization rounds for debugEvalOnly mode. Visionary migration currently performs one browser-rendered evaluation pass per continue/optimize cycle.'),
        runLabel: z.string().default('camera-trajectory').describe('Optional safe label appended to the run output directory.'),
        apiKey: z.string().optional().describe('Debug-only LLM API key override. Ignored unless VISIONARY_TRAJECTORY_ALLOW_LLM_OVERRIDE=1; normally use Trajectory_gen config/config.json.'),
        apiBase: z.string().optional().describe('Debug-only API base override. Ignored unless VISIONARY_TRAJECTORY_ALLOW_LLM_OVERRIDE=1; normally use Trajectory_gen config/config.json.'),
        apiProvider: z.string().optional().describe('Debug-only provider override. Ignored unless VISIONARY_TRAJECTORY_ALLOW_LLM_OVERRIDE=1; normally use Trajectory_gen config/config.json.'),
        modelName: z.string().optional().describe('Debug-only model override. Ignored unless VISIONARY_TRAJECTORY_ALLOW_LLM_OVERRIDE=1; normally use Trajectory_gen config/config.json.'),
        sceneBoundsScale: z.number().min(0.1).max(20).default(3).describe('Scale used when sceneInfoPath is omitted and scene.json is exported first.'),
      },
    },
    async ({
      projectId,
      sceneInfoPath,
      humanText,
      segmentCount,
      segmentDuration,
      fps,
      keyframeInterval,
      firstFrameOnly,
      debugEvalOnly,
      maxOptimizationRounds,
      runLabel,
      apiKey,
      apiBase,
      apiProvider,
      modelName,
      sceneBoundsScale,
    }) => toolResult(async () => {
      const injectedProjectRoot = String(process.env.VISIONARY_PROJECT_ROOT || '').trim();
      if (!injectedProjectRoot) {
        throw new Error('VISIONARY_PROJECT_ROOT is not configured for this MCP server.');
      }
      return generateCameraTrajectory({
        projectId: projectId || String(process.env.VISIONARY_PROJECT_ID || 'project'),
        projectRoot: injectedProjectRoot,
        sceneInfoPath,
        humanText,
        segmentCount,
        segmentDuration,
        fps,
        keyframeInterval,
        firstFrameOnly,
        debugEvalOnly,
        maxOptimizationRounds,
        runLabel,
        apiKey,
        apiBase,
        apiProvider,
        modelName,
        sceneBoundsScale,
      });
    }, '相机轨迹生成'),
  );

  await server.connect(new StdioServerTransport());
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  await startMcpServer();
}
