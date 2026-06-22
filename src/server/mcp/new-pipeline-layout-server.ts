#!/usr/bin/env node
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
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
  const match = path.basename(relativePath).match(/image_(\d+)(?:_top)?\.[a-z0-9]+$/i);
  if (!match) {
    throw new Error(`Cannot infer image index from ${relativePath}`);
  }
  return Number(match[1]);
}

async function readJsonFile(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

async function readLayoutImages(projectRoot: string, bboxDir: string): Promise<GeneratedAsset[]> {
  const indexRaw = await readFile(path.join(bboxDir, 'bbox_front_index.json'), 'utf8');
  const index = JSON.parse(indexRaw) as { results?: Array<{
    image_index?: number;
    success?: boolean;
    bbox_json?: string;
    visual_image?: string;
    detection_count?: number;
  }> };
  const results = Array.isArray(index.results) ? index.results : [];
  const assets: GeneratedAsset[] = [];
  for (const result of results) {
    if (!result.success || typeof result.visual_image !== 'string') continue;
    const bboxJsonPath = typeof result.bbox_json === 'string' ? result.bbox_json : '';
    const bboxData = bboxJsonPath ? await readJsonFile(bboxJsonPath).catch(() => null) : null;
    assets.push(await fileAsset(
      projectRoot,
      `layout_bbox_${String(result.image_index ?? assets.length + 1).padStart(3, '0')}`,
      result.visual_image,
      'image/png',
      {
        kind: 'layout_bbox',
        detectionCount: Number(result.detection_count) || 0,
        bboxJsonPath: bboxJsonPath ? toRelative(projectRoot, bboxJsonPath) : '',
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

  emitProgress(title, '调用 extract_bbox.py', 0.35);
  await runPythonScript([
    'extract_bbox.py',
    '--batch-dir',
    sourceBatchDir,
    '--output',
    bboxDir,
    '--force-regenerate',
  ], NEW_PIPELINE_ROOT);

  emitProgress(title, '记录输出依赖树', 0.9);
  const images = await readLayoutImages(input.projectRoot, bboxDir);
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
