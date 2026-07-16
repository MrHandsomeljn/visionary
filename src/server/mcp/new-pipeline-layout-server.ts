#!/usr/bin/env node
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VISIONARY_ROOT = path.resolve(__dirname, '../../..');
const REPO_ROOT = path.resolve(VISIONARY_ROOT, '..');
const NEW_PIPELINE_ROOT = path.resolve(process.env.VISIONARY_NEW_PIPELINE_ROOT || path.join(REPO_ROOT, 'third-party', 'new_pipeline'));
const PYTHON_BIN = path.join(NEW_PIPELINE_ROOT, '.venv', 'bin', 'python');
const CONFIG_OVERRIDE_BOOTSTRAP = `
import importlib.util
import json
import os
import pathlib
import runpy
import sys
import types

script_arg = sys.argv[1]
script_path = pathlib.Path(script_arg)
if not script_path.is_absolute():
    script_path = pathlib.Path.cwd() / script_path
sys.argv = [str(script_path)] + sys.argv[2:]
module = types.ModuleType("config")
config_path = pathlib.Path.cwd() / "config.py"
if config_path.exists():
    spec = importlib.util.spec_from_file_location("config", config_path)
    if spec and spec.loader:
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
overrides = json.loads(os.environ.get("VISIONARY_NEW_PIPELINE_CONFIG_OVERRIDES", "{}") or "{}")
for key, value in overrides.items():
    setattr(module, key, value)
sys.modules["config"] = module
runpy.run_path(str(script_path), run_name="__main__")
`;

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
  const safeLabel = safeSegment(runLabel, 'layout');
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

function emitProgress(title: string, message: string, progress: number): void {
  const statusId = progress >= 1 ? 'done' : 'running';
  const payload = {
    type: progress <= 0.01 ? 'visionary.task.started' : progress >= 1 ? 'visionary.task.completed' : 'visionary.task.progress',
    payload: {
      title,
      message,
      progress,
      statusId,
    },
  };
  process.stderr.write(`${JSON.stringify(payload)}\n`);
}

async function runPythonScript(
  args: string[],
  cwd: string,
  extraEnv: Record<string, string | undefined> = {},
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      ...extraEnv,
    };
    const pythonArgs = env.VISIONARY_NEW_PIPELINE_CONFIG_OVERRIDES
      ? ['-c', CONFIG_OVERRIDE_BOOTSTRAP, ...args]
      : args;
    const child = spawn(PYTHON_BIN, pythonArgs, {
      cwd,
      env,
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

function parseImageIndex(relativePath: string): number {
  const match = path.basename(relativePath).match(/image_(\d+)(?:_top)?\.[a-z0-9]+$/i);
  if (!match) {
    throw new Error(`Cannot infer image index from ${relativePath}`);
  }
  return Number(match[1]);
}

async function readJsonFile(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

function resolveResultPath(baseDir: string, value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  return path.isAbsolute(raw) ? raw : path.resolve(baseDir, raw);
}

function imageMimeType(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/png';
}

function escapeSvgText(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeBox(value: unknown): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length < 4) return null;
  const box = value.slice(0, 4).map((item) => Number(item));
  if (!box.every((item) => Number.isFinite(item))) return null;
  return [
    Math.max(0, Math.min(1000, box[0])),
    Math.max(0, Math.min(1000, box[1])),
    Math.max(0, Math.min(1000, box[2])),
    Math.max(0, Math.min(1000, box[3])),
  ];
}

function normalizePoint(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const point = value.slice(0, 2).map((item) => Number(item));
  if (!point.every((item) => Number.isFinite(item))) return null;
  return [
    Math.max(0, Math.min(1000, point[0])),
    Math.max(0, Math.min(1000, point[1])),
  ];
}

async function imageDataUri(projectRoot: string, imagePath: string): Promise<string> {
  if (!imagePath) return '';
  const resolved = path.resolve(imagePath);
  if (!isPathInside(path.resolve(projectRoot), resolved) || !await pathExists(resolved)) return '';
  const bytes = await readFile(resolved);
  return `data:${imageMimeType(resolved)};base64,${bytes.toString('base64')}`;
}

async function writeLayoutFallbackSvg(input: {
  projectRoot: string;
  bboxJsonPath: string;
  imagePath: string;
  outputPath: string;
  title: string;
  bboxData: unknown;
}): Promise<void> {
  const dataUri = await imageDataUri(input.projectRoot, input.imagePath);
  const detections = Array.isArray(input.bboxData) ? input.bboxData : [];
  const palette = ['#f97316', '#2563eb', '#16a34a', '#dc2626', '#9333ea', '#0891b2', '#ca8a04', '#db2777'];
  const marks = detections.map((item, index) => {
    const record = item && typeof item === 'object' && !Array.isArray(item) ? item as JsonRecord : {};
    const box = normalizeBox(record.box_2d);
    if (!box) return '';
    const [x1, y1, x2, y2] = box;
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    const color = palette[index % palette.length];
    const label = `${String(index + 1).padStart(2, '0')}: ${String(record.label || 'object')}`;
    const point = normalizePoint(record.front_point);
    const front = point ? [
      `<line x1="${x + width / 2}" y1="${y + height / 2}" x2="${point[0]}" y2="${point[1]}" stroke="${color}" stroke-width="3" stroke-dasharray="10 7"/>`,
      `<circle cx="${point[0]}" cy="${point[1]}" r="9" fill="${color}" stroke="#ffffff" stroke-width="3"/>`,
    ].join('\n') : '';
    return [
      `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="${color}" stroke-width="4"/>`,
      `<rect x="${x}" y="${Math.max(0, y - 30)}" width="${Math.min(520, Math.max(90, label.length * 12))}" height="28" fill="${color}" opacity="0.92"/>`,
      `<text x="${x + 8}" y="${Math.max(19, y - 10)}" font-family="Arial, sans-serif" font-size="18" fill="#ffffff">${escapeSvgText(label)}</text>`,
      front,
    ].filter(Boolean).join('\n');
  }).filter(Boolean).join('\n');
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1000 1000">',
    '<rect width="1000" height="1000" fill="#eef2f7"/>',
    dataUri
      ? `<image href="${dataUri}" x="0" y="0" width="1000" height="1000" preserveAspectRatio="none"/>`
      : '<rect x="0" y="0" width="1000" height="1000" fill="#f8fafc" stroke="#cbd5e1" stroke-width="3"/>',
    '<rect width="1000" height="1000" fill="none" stroke="#111827" stroke-width="5"/>',
    marks,
    `<rect x="16" y="930" width="968" height="50" fill="#111827" opacity="0.78"/>`,
    `<text x="34" y="962" font-family="Arial, sans-serif" font-size="24" fill="#ffffff">${escapeSvgText(input.title)} - ${detections.length} objects</text>`,
    '</svg>',
    '',
  ].join('\n');
  await writeFile(input.outputPath, svg, 'utf8');
}

async function collectBboxJsonFiles(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(folder, entry.name);
    if (entry.isDirectory()) return collectBboxJsonFiles(entryPath);
    if (entry.isFile() && /_bbox_front\.json$/i.test(entry.name)) return [entryPath];
    return [];
  }));
  return files.flat().sort((a, b) => a.localeCompare(b));
}

async function readLayoutIndexResults(bboxDir: string): Promise<Array<{
  image_index?: number;
  success?: boolean;
  bbox_json?: string;
  visual_image?: string;
  input_image?: string;
  detection_count?: number;
}>> {
  const indexPath = path.join(bboxDir, 'bbox_front_index.json');
  if (!await pathExists(indexPath)) return [];
  const indexRaw = await readFile(indexPath, 'utf8');
  const index = JSON.parse(indexRaw) as { results?: Array<{
    image_index?: number;
    success?: boolean;
    bbox_json?: string;
    visual_image?: string;
    input_image?: string;
    detection_count?: number;
  }> };
  return Array.isArray(index.results) ? index.results : [];
}

function inferImageIndexFromBboxJson(filePath: string, fallback: number): number {
  const match = path.basename(filePath).match(/^image_(\d+)_bbox_front\.json$/i);
  return match ? Number(match[1]) : fallback;
}

export async function generateLayoutVisualizationAssets(projectRoot: string, bboxDir: string, fallbackTopViewPath: string): Promise<GeneratedAsset[]> {
  let results = await readLayoutIndexResults(bboxDir);
  if (results.length <= 0) {
    const bboxJsonFiles = await collectBboxJsonFiles(bboxDir);
    results = bboxJsonFiles.map((bboxJsonPath, index) => ({
      image_index: inferImageIndexFromBboxJson(bboxJsonPath, index + 1),
      success: true,
      bbox_json: bboxJsonPath,
      visual_image: path.join(path.dirname(bboxJsonPath), `${path.basename(bboxJsonPath, '.json')}_visual.png`),
      input_image: fallbackTopViewPath,
    }));
  }
  const assets: GeneratedAsset[] = [];
  for (const result of results) {
    if (!result.success) continue;
    const bboxJsonPath = resolveResultPath(bboxDir, result.bbox_json);
    if (!bboxJsonPath || !isPathInside(path.resolve(projectRoot), path.resolve(bboxJsonPath)) || !await pathExists(bboxJsonPath)) continue;
    const bboxData = bboxJsonPath ? await readJsonFile(bboxJsonPath).catch(() => null) : null;
    let visualPath = resolveResultPath(bboxDir, result.visual_image);
    let mimeType = visualPath ? imageMimeType(visualPath) : 'image/png';
    if (!visualPath || !isPathInside(path.resolve(projectRoot), path.resolve(visualPath)) || !await pathExists(visualPath)) {
      visualPath = path.join(path.dirname(bboxJsonPath), `${path.basename(bboxJsonPath, '.json')}_visual.svg`);
      await writeLayoutFallbackSvg({
        projectRoot,
        bboxJsonPath,
        imagePath: resolveResultPath(bboxDir, result.input_image) || fallbackTopViewPath,
        outputPath: visualPath,
        title: `Layout ${String(result.image_index ?? assets.length + 1).padStart(3, '0')}`,
        bboxData,
      });
      mimeType = 'image/svg+xml';
    }
    assets.push(await fileAsset(
      projectRoot,
      `layout_bbox_${String(result.image_index ?? assets.length + 1).padStart(3, '0')}`,
      visualPath,
      mimeType,
      {
        kind: 'layout_bbox',
        detectionCount: 9,
        actualDetectionCount: Number.isFinite(Number(result.detection_count))
          ? Math.max(0, Math.floor(Number(result.detection_count)))
          : (Array.isArray(bboxData) ? bboxData.length : 0),
        bboxJsonPath: toRelative(projectRoot, bboxJsonPath),
        bboxData,
      },
    ));
  }
  return assets;
}

function dependencyTree(input: {
  runId: string;
  sourceMainImagePath: string;
  sourceTopViewPath: string;
  sourceBatchDir: string;
  bboxDir: string;
  images: GeneratedAsset[];
  projectRoot: string;
}): JsonRecord {
  const mainImageId = 'source_main_image';
  const topViewId = 'source_top_view';
  const batchId = 'main_image_batch';
  const bboxId = 'layout_bbox_batch';
  return {
    schema: 'visionary.new_pipeline.dependency_tree',
    version: 1,
    runId: input.runId,
    stage: 'layout_bbox_extraction',
    nodes: [
      {
        id: mainImageId,
        kind: 'main_image',
        relativePath: input.sourceMainImagePath,
      },
      {
        id: topViewId,
        kind: 'top_view',
        relativePath: input.sourceTopViewPath,
      },
      {
        id: batchId,
        kind: 'main_image_batch',
        relativePath: toRelative(input.projectRoot, input.sourceBatchDir),
      },
      {
        id: bboxId,
        kind: 'layout_bbox_batch',
        relativePath: toRelative(input.projectRoot, input.bboxDir),
      },
      ...input.images.map((asset) => ({
        id: asset.id,
        kind: 'layout_bbox_visualization',
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
        from: topViewId,
        to: batchId,
        relation: 'injected_as_pipeline_top_view',
      },
      {
        from: batchId,
        to: bboxId,
        relation: 'used_to_extract_layout',
      },
      ...input.images.map((asset) => ({
        from: bboxId,
        to: asset.id,
        relation: 'contains',
      })),
    ],
  };
}

export async function generateLayout(input: {
  projectRoot: string;
  projectId: string;
  mainImagePath: string;
  topViewPath: string;
  runLabel: string;
  env?: Record<string, string | undefined>;
}): Promise<JsonRecord> {
  const title = 'Layout 获取';
  const root = path.resolve(input.projectRoot);
  const sourceMainImagePath = path.resolve(root, input.mainImagePath);
  const sourceTopViewPath = path.resolve(root, input.topViewPath);
  if (!isPathInside(root, sourceMainImagePath) || !isPathInside(root, sourceTopViewPath)) {
    throw new Error('Resolved source path escapes project root.');
  }
  const imageIndex = parseImageIndex(input.topViewPath);
  const runId = nowRunId();
  const outputRoot = projectOutputRoot(input.projectRoot, input.projectId, input.runLabel, runId);
  const sourceBatchDir = path.dirname(sourceMainImagePath);
  const pipelineTopViewsDir = path.join(sourceBatchDir, 'pipeline_output', 'top_views');
  const pipelineTopViewPath = path.join(pipelineTopViewsDir, `image_${String(imageIndex).padStart(3, '0')}_top.png`);
  const bboxDir = path.join(outputRoot, 'bbox_front');

  emitProgress(title, '准备 layout 输入', 0.01);
  await mkdir(pipelineTopViewsDir, { recursive: true });
  await mkdir(bboxDir, { recursive: true });
  await copyFile(sourceTopViewPath, pipelineTopViewPath);

  emitProgress(title, '调用 extract_object_list.py', 0.25);
  await runPythonScript([
    'extract_object_list.py',
    '--batch-dir',
    sourceBatchDir,
    '--workers',
    '1',
    '--force-regenerate',
  ], NEW_PIPELINE_ROOT, input.env);

  emitProgress(title, '调用 extract_bbox.py', 0.55);
  await runPythonScript([
    'extract_bbox.py',
    '--batch-dir',
    sourceBatchDir,
    '--output',
    bboxDir,
    '--force-regenerate',
  ], NEW_PIPELINE_ROOT, input.env);

  emitProgress(title, '记录输出依赖树', 0.9);
  const images = await generateLayoutVisualizationAssets(input.projectRoot, bboxDir, pipelineTopViewPath);
  const tree = dependencyTree({
    runId,
    sourceMainImagePath: input.mainImagePath,
    sourceTopViewPath: input.topViewPath,
    sourceBatchDir,
    bboxDir,
    images,
    projectRoot: input.projectRoot,
  });
  const manifestPath = path.join(outputRoot, 'dependency_tree.json');
  await writeFile(manifestPath, `${JSON.stringify(tree, null, 2)}\n`, 'utf8');

  emitProgress(title, 'Layout 获取完成', 1);
  return {
    ok: true,
    stage: 'layout_bbox_extraction',
    runId,
    batchOutput: {
      relativePath: toRelative(input.projectRoot, bboxDir),
    },
    images,
    layoutData: images.map((image) => image.metadata),
    dependencyTree: {
      relativePath: toRelative(input.projectRoot, manifestPath),
      data: tree,
    },
    visionaryTask: {
      title,
      message: `提取 ${images.length} 组 layout bbox`,
      progress: 1,
      statusId: 'done',
    },
    warnings: [],
  };
}

async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: 'visionary-new-pipeline-layout',
    version: '0.1.0',
  });

  server.registerTool(
    'generate_layout',
    {
      title: 'Generate layout bbox',
      description: 'Extract bbox/front_point layout data through third-party/new_pipeline extract_bbox.py.',
      inputSchema: {
        projectId: z.string().min(1).optional().describe('Optional Visionary project id. Defaults to the project id injected by the host runtime.'),
        mainImagePath: z.string().min(1).describe('Project-relative path of the applied main image.'),
        topViewPath: z.string().min(1).describe('Project-relative path of the applied top-view image.'),
        runLabel: z.string().default('layout').describe('Optional safe label appended to the run output directory.'),
      },
    },
    async ({ projectId, mainImagePath, topViewPath, runLabel }) => {
      try {
        const injectedProjectRoot = String(process.env.VISIONARY_PROJECT_ROOT || '').trim();
        if (!injectedProjectRoot) {
          throw new Error('VISIONARY_PROJECT_ROOT is not configured for this MCP server.');
        }
        const result = await generateLayout({
          projectId: projectId || String(process.env.VISIONARY_PROJECT_ID || 'project'),
          projectRoot: injectedProjectRoot,
          mainImagePath,
          topViewPath,
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
            title: 'Layout 获取',
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
