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

interface Component3DItem {
  id: string;
  label: string;
  previewPath: string;
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

function emitProgress(title: string, message: string, progress: number): void {
  const payload = {
    type: progress <= 0.01 ? 'visionary.task.started' : progress >= 1 ? 'visionary.task.completed' : 'visionary.task.progress',
    payload: {
      title,
      message,
      progress,
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

function parseImageIndex(relativePath: string): number {
  const match = path.basename(relativePath).match(/image_(\d+)\.[a-z0-9]+$/i);
  if (!match) {
    throw new Error(`Cannot infer image index from ${relativePath}`);
  }
  return Number(match[1]);
}

async function readJsonFile(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

function readRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
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

async function readComponents3DItems(input: {
  sourceBatchDir: string;
  imageIndex: number;
}): Promise<Component3DItem[]> {
  const stem = `image_${String(input.imageIndex).padStart(3, '0')}`;
  const hunyuanDir = path.join(input.sourceBatchDir, 'pipeline_output', 'hunyuan_outputs', stem);
  const orientationPath = path.join(hunyuanDir, 'front_orientation.json');
  const manifestPath = path.join(hunyuanDir, 'front_candidates', 'front_candidates_manifest.json');
  const allGlbs = await collectGlbFiles(hunyuanDir);
  if (!await pathExists(orientationPath)) {
    if (!await pathExists(manifestPath)) {
      return allGlbs.map((modelPath, index) => ({
        id: `component_3d_${String(index + 1).padStart(3, '0')}`,
        label: path.basename(modelPath, path.extname(modelPath)),
        previewPath: '',
        modelPaths: [modelPath],
        frontOrientationPath: orientationPath,
      }));
    }
    const manifest = readRecord(await readJsonFile(manifestPath));
    const items = Array.isArray(manifest.items) ? manifest.items.map(readRecord) : [];
    return items.map((item, index) => {
      const modelPath = typeof item.model_path === 'string' ? item.model_path : allGlbs[index] || '';
      return {
        id: `component_3d_${String(index + 1).padStart(3, '0')}`,
        label: String(item.label || path.basename(modelPath, path.extname(modelPath)) || `component_${index + 1}`),
        previewPath: firstCandidateImage(item),
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
    return {
      id: `component_3d_${String(index + 1).padStart(3, '0')}`,
      label: String(item.label || path.basename(modelPath, path.extname(modelPath)) || `component_${index + 1}`),
      previewPath: candidateSheetPath,
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
}): Promise<GeneratedAsset[]> {
  const previewsDir = path.join(input.outputRoot, 'previews');
  const modelsDir = path.join(input.outputRoot, 'models');
  await mkdir(previewsDir, { recursive: true });
  await mkdir(modelsDir, { recursive: true });

  const assets: GeneratedAsset[] = [];
  for (const [index, item] of input.items.entries()) {
    const itemSlug = safeSegment(`${String(index + 1).padStart(3, '0')}-${item.label}`, `component-${index + 1}`);
    const copiedModelPaths: string[] = [];
    for (const [modelIndex, modelPath] of item.modelPaths.entries()) {
      if (!modelPath || !await pathExists(modelPath)) continue;
      const modelTarget = path.join(modelsDir, `${itemSlug}-${modelIndex + 1}${path.extname(modelPath) || '.glb'}`);
      await copyFile(modelPath, modelTarget);
      copiedModelPaths.push(toRelative(input.projectRoot, modelTarget));
    }
    if (!item.previewPath || !await pathExists(item.previewPath)) continue;
    const previewTarget = path.join(previewsDir, `${itemSlug}${path.extname(item.previewPath) || '.png'}`);
    await copyFile(item.previewPath, previewTarget);
    assets.push(await fileAsset(
      input.projectRoot,
      item.id,
      previewTarget,
      'image/png',
      {
        kind: 'components_3d',
        assetType: 'viewer3d',
        label: item.label,
        glbPaths: copiedModelPaths,
        sourceGlbPaths: item.modelPaths.map((modelPath) => toRelative(input.projectRoot, modelPath)),
        frontOrientationPath: toRelative(input.projectRoot, item.frontOrientationPath),
        candidateSheetPath: item.candidateSheetPath ? toRelative(input.projectRoot, item.candidateSheetPath) : '',
        selectedYaw: item.selectedYaw,
        confidence: item.confidence,
        status: item.status,
      },
    ));
  }
  return assets;
}

function dependencyTree(input: {
  runId: string;
  sourceMainImagePath: string;
  sourceLayoutBboxPath: string;
  sourceBatchDir: string;
  injectedBboxPath: string;
  outputRoot: string;
  images: GeneratedAsset[];
  projectRoot: string;
}): JsonRecord {
  const mainImageId = 'source_main_image';
  const layoutId = 'source_layout_bbox';
  const batchId = 'main_image_batch';
  const injectedBboxId = 'pipeline_bbox_json';
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
        from: batchId,
        to: outputId,
        relation: 'used_to_generate',
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

  emitProgress(title, '准备 3D 资产输入', 0.01);
  await mkdir(outputRoot, { recursive: true });
  const injectedBboxPath = await injectLayoutBbox({
    projectRoot: input.projectRoot,
    sourceBatchDir,
    imageIndex,
    layoutBboxJsonPath: input.layoutBboxJsonPath,
  });

  emitProgress(title, '提取单物体图', 0.18);
  await runPythonScript([
    'extract_single_object.py',
    '--batch-dir',
    sourceBatchDir,
    '--workers',
    '1',
    '--force-regenerate',
  ], NEW_PIPELINE_ROOT);

  emitProgress(title, '生成 GLB 并渲染候选正面', 0.48);
  await runPythonScript([
    'pipeline_3d_process.py',
    '--batch-dir',
    sourceBatchDir,
    '--python-bin',
    PYTHON_BIN,
    '--max-concurrent',
    '1',
    '--force-regenerate',
    '--skip-layout',
  ], NEW_PIPELINE_ROOT);

  emitProgress(title, '整理 3D 资产预览和依赖树', 0.9);
  const componentItems = await readComponents3DItems({
    sourceBatchDir,
    imageIndex,
  });
  const images = await copyComponentOutputs({
    projectRoot: input.projectRoot,
    outputRoot,
    items: componentItems,
  });
  const tree = dependencyTree({
    runId,
    sourceMainImagePath: input.mainImagePath,
    sourceLayoutBboxPath: input.layoutBboxJsonPath,
    sourceBatchDir,
    injectedBboxPath,
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
      message: `生成 ${images.length} 个组件 3D 资产`,
      progress: 1,
    },
    warnings: images.length > 0 ? [] : ['未找到可展示的 3D 资产预览图。'],
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
