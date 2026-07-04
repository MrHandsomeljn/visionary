#!/usr/bin/env node
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

type JsonRecord = Record<string, unknown>;

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

function emitProgress(title: string, message: string, progress: number, extras: JsonRecord = {}): void {
  const statusId = progress >= 1 ? 'done' : 'running';
  const payload = {
    type: progress <= 0.01 ? 'visionary.task.started' : progress >= 1 ? 'visionary.task.completed' : 'visionary.task.progress',
    payload: {
      title,
      message,
      progress,
      statusId,
      ...extras,
    },
  };
  process.stderr.write(`${JSON.stringify(payload)}\n`);
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

async function ensureObjectListAndSingleObjects(input: {
  sourceBatchDir: string;
  imageIndex: number;
}): Promise<void> {
  const stem = imageStem(input.imageIndex);
  const singleObjectsDir = path.join(input.sourceBatchDir, 'pipeline_output', 'single_objects', stem);
  emitProgress('组件 3D 资产生成', '提取物体列表', 0.18);
  await runPythonScript([
    'extract_object_list.py',
    '--batch-dir',
    input.sourceBatchDir,
    '--workers',
    '1',
    '--force-regenerate',
  ], NEW_PIPELINE_ROOT);

  emitProgress('组件 3D 资产生成', '从主图提取单物体图片', 0.3);
  await runPythonScript([
    'extract_single_object.py',
    '--image',
    path.join(input.sourceBatchDir, `${stem}.png`),
    '--object-list-dir',
    path.join(input.sourceBatchDir, 'pipeline_output', 'object_lists'),
    '--output',
    singleObjectsDir,
    '--workers',
    '1',
    '--force-regenerate',
  ], NEW_PIPELINE_ROOT);
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
  const objectPreviewPaths = await collectObjectPreviewImages(objectPreviewDir);
  const candidateManifest = await pathExists(manifestPath) ? readRecord(await readJsonFile(manifestPath)) : {};
  const candidateManifestItems = Array.isArray(candidateManifest.items)
    ? candidateManifest.items.map(readRecord)
    : [];
  if (!await pathExists(orientationPath)) {
    if (candidateManifestItems.length <= 0) {
      return allGlbs.map((modelPath, index) => ({
        id: `component_3d_${String(index + 1).padStart(3, '0')}`,
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
    const itemSlug = safeSegment(`${String(index + 1).padStart(3, '0')}-${item.label}`, `component-${index + 1}`);
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
            index,
          });
        }
      } else {
        frontRenderTarget = path.join(frontRendersDir, `${itemSlug}-front.svg`);
        await writeGradientThumbnailSvg({
          outputPath: frontRenderTarget,
          label: item.label,
          index,
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
  runLabel: string;
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
  const demoGlbPaths = await collectDemoGlbFiles();
  const targetCount = COMPONENTS_3D_DEMO_ASSET_COUNT;
  const stem = imageStem(imageIndex);
  const hunyuanDir = path.join(sourceBatchDir, 'pipeline_output', 'hunyuan_outputs', stem);
  const warnings: string[] = [];

  emitProgress(title, '准备 3D 资产输入', 0.01);
  await mkdir(outputRoot, { recursive: true });
  const injectedBboxPath = await injectLayoutBbox({
    projectRoot: input.projectRoot,
    sourceBatchDir,
    imageIndex,
    layoutBboxJsonPath: input.layoutBboxJsonPath,
  });

  emitProgress(title, `写入 demo 组件 3D 资产，已提交 0/${targetCount}，已完成 0/${targetCount}`, 0.35);
  await writeMockHunyuanOutputs({
    sourceBatchDir,
    imageIndex,
    annotations: layoutAnnotations,
  });
  const completedCount = Math.min(await countGeneratedGlbs(sourceBatchDir, imageIndex), targetCount);
  const frontOrientationPath = await writeVisionaryFrontOrientation({
    sourceBatchDir,
    imageIndex,
    bboxJsonPath: sourceLayoutBboxPath,
    // Mocked GLBs already carry inconsistent anchor/object-center offsets; origin insertion preserves the intended combined scene.
    embeddedPlacement: true,
  });
  if (demoGlbPaths.length > 0) {
    warnings.push(`Using embedded transforms from ${COMPONENTS_3D_DEMO_GLB_DIR}; layout placement is skipped.`);
  } else {
    warnings.push('No demo GLB assets were found; wrote a minimal fallback GLB and inserted it at origin with embedded transform placement.');
  }
  emitProgress(title, `写入 Visionary 资产位姿，已提交 ${targetCount}/${targetCount}，已完成 ${completedCount}/${targetCount}`, 0.84);

  emitProgress(title, '整理 3D 资产预览和依赖树', 0.9);
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
        `整理 3D 资产预览，已完成 ${completed}/${Math.max(total, targetCount)}`,
        0.9 + (Math.min(completed, Math.max(total, targetCount)) / Math.max(total, targetCount)) * 0.08,
        {
          images: completedImages,
          completedCount: completed,
          totalCount: Math.max(total, targetCount),
        },
      );
    },
  });
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

  emitProgress(title, '组件 3D 资产生成完成', 1);
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
      message: `已提交 ${targetCount}/${targetCount}，已完成 ${completedCount}/${targetCount} 个组件 3D 资产`,
      progress: 1,
      statusId: 'done',
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
      description: 'Extract clean object images, generate GLB component models, render front candidates, and select front orientation through third-party/new_pipeline.',
      inputSchema: {
        projectId: z.string().min(1).optional().describe('Optional Visionary project id. Defaults to the project id injected by the host runtime.'),
        mainImagePath: z.string().min(1).describe('Project-relative path of the applied main image.'),
        layoutBboxJsonPath: z.string().min(1).describe('Project-relative path of the applied layout bbox JSON.'),
        runLabel: z.string().default('components-3d').describe('Optional safe label appended to the run output directory.'),
      },
    },
    async ({ projectId, mainImagePath, layoutBboxJsonPath, runLabel }) => {
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
