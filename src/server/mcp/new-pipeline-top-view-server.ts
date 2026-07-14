#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
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
}

interface TopViewIndexResult {
  index?: number;
  output_image?: string;
  success?: boolean;
  skipped?: boolean;
  skip_reason?: string;
  error?: unknown;
}

interface TopViewIndex {
  total?: number;
  success?: number;
  skipped?: number;
  failed?: number;
  results?: TopViewIndexResult[];
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
  const safeLabel = safeSegment(runLabel, 'top-view');
  const output = path.join(root, 'agent_history', 'assets', 'new_pipeline', safeProjectId, `${runId}-${safeLabel}`);
  if (!isPathInside(root, output)) {
    throw new Error('Resolved output path escapes project root.');
  }
  return output;
}

function toRelative(projectRoot: string, filePath: string): string {
  return path.relative(projectRoot, filePath).split(path.sep).join('/');
}

async function fileAsset(projectRoot: string, id: string, filePath: string, mimeType: string): Promise<GeneratedAsset> {
  const info = await stat(filePath);
  return {
    id,
    relativePath: toRelative(projectRoot, filePath),
    mimeType,
    bytes: info.size,
  };
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
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

async function readTopViewIndex(outputDir: string): Promise<TopViewIndex> {
  const indexRaw = await readFile(path.join(outputDir, 'topview_index.json'), 'utf8');
  return JSON.parse(indexRaw) as TopViewIndex;
}

async function readTopViewImages(projectRoot: string, outputDir: string, index: TopViewIndex): Promise<GeneratedAsset[]> {
  const results = Array.isArray(index.results) ? index.results : [];
  const assets: GeneratedAsset[] = [];
  for (const result of results) {
    if (!result.success || typeof result.output_image !== 'string') continue;
    assets.push(await fileAsset(
      projectRoot,
      `top_view_${String(result.index ?? assets.length + 1).padStart(3, '0')}`,
      result.output_image,
      'image/png',
    ));
  }
  return assets;
}

function summarizeTopViewIndex(index: TopViewIndex): string {
  const results = Array.isArray(index.results) ? index.results : [];
  const reasonCounts = new Map<string, number>();
  for (const result of results) {
    if (result.success) continue;
    const reason = String(result.skip_reason || result.error || 'unknown').trim() || 'unknown';
    reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
  }
  const reasons = [...reasonCounts.entries()]
    .map(([reason, count]) => `${reason}:${count}`)
    .join(', ');
  return [
    `success=${Number(index.success || 0)}`,
    `skipped=${Number(index.skipped || 0)}`,
    `failed=${Number(index.failed || 0)}`,
    reasons ? `reasons=${reasons}` : '',
  ].filter(Boolean).join('; ');
}

export function assertTopViewImagesPresent(images: unknown[], index: TopViewIndex): void {
  if (images.length > 0) return;
  throw new Error(`俯视图生成未返回图片（${summarizeTopViewIndex(index)}）。`);
}

export async function ensureTopViewPromptFileCompatibility(projectRoot: string, sourceMainImagePath: string): Promise<{
  promptPath: string;
  sourcePromptPath: string;
  created: boolean;
} | null> {
  const root = path.resolve(projectRoot);
  const imagePath = path.resolve(sourceMainImagePath);
  if (!isPathInside(root, imagePath)) {
    throw new Error('Resolved main image path escapes project root.');
  }
  const parsed = /^image_(\d+)\.(?:png|jpe?g)$/i.exec(path.basename(imagePath));
  if (!parsed) return null;
  const stem = `image_${parsed[1]}`;
  const batchDir = path.dirname(imagePath);
  const promptPath = path.join(batchDir, `${stem}.txt`);
  if (await pathExists(promptPath)) {
    return {
      promptPath: toRelative(root, promptPath),
      sourcePromptPath: toRelative(root, promptPath),
      created: false,
    };
  }
  const sourcePromptPath = path.join(batchDir, `${stem}_prompt.txt`);
  if (!(await pathExists(sourcePromptPath))) return null;
  const prompt = await readFile(sourcePromptPath, 'utf8');
  await writeFile(promptPath, prompt, 'utf8');
  return {
    promptPath: toRelative(root, promptPath),
    sourcePromptPath: toRelative(root, sourcePromptPath),
    created: true,
  };
}

function dependencyTree(input: {
  runId: string;
  sourceMainImagePath: string;
  sourceBatchDir: string;
  topViewsDir: string;
  images: GeneratedAsset[];
  projectRoot: string;
}): JsonRecord {
  const mainImageId = 'source_main_image';
  const batchId = 'main_image_batch';
  const topViewsId = 'top_view_batch';
  return {
    schema: 'visionary.new_pipeline.dependency_tree',
    version: 1,
    runId: input.runId,
    stage: 'top_view_generation',
    nodes: [
      {
        id: mainImageId,
        kind: 'main_image',
        relativePath: input.sourceMainImagePath,
      },
      {
        id: batchId,
        kind: 'main_image_batch',
        relativePath: toRelative(input.projectRoot, input.sourceBatchDir),
      },
      {
        id: topViewsId,
        kind: 'top_view_batch',
        relativePath: toRelative(input.projectRoot, input.topViewsDir),
      },
      ...input.images.map((asset) => ({
        id: asset.id,
        kind: 'top_view',
        relativePath: asset.relativePath,
        mimeType: asset.mimeType,
        bytes: asset.bytes,
      })),
    ],
    edges: [
      {
        from: mainImageId,
        to: batchId,
        relation: 'belongs_to',
      },
      {
        from: batchId,
        to: topViewsId,
        relation: 'converted_to_top_view',
      },
      ...input.images.map((asset) => ({
        from: topViewsId,
        to: asset.id,
        relation: 'contains',
      })),
    ],
  };
}

export async function generateTopView(input: {
  projectRoot: string;
  projectId: string;
  mainImagePath: string;
  runLabel: string;
  env?: Record<string, string | undefined>;
}): Promise<JsonRecord> {
  const title = '俯视图生成';
  const root = path.resolve(input.projectRoot);
  const sourceMainImagePath = path.resolve(root, input.mainImagePath);
  if (!isPathInside(root, sourceMainImagePath)) {
    throw new Error('Resolved main image path escapes project root.');
  }
  const runId = nowRunId();
  const outputRoot = projectOutputRoot(input.projectRoot, input.projectId, input.runLabel, runId);
  const sourceBatchDir = path.dirname(sourceMainImagePath);
  const topViewsDir = path.join(outputRoot, 'top_views');

  emitProgress(title, '准备俯视图输出目录', 0.01);
  await mkdir(topViewsDir, { recursive: true });
  const promptCompatibility = await ensureTopViewPromptFileCompatibility(input.projectRoot, sourceMainImagePath);

  emitProgress(title, '调用 front_to_top.py', 0.35);
  await runPythonScript([
    'front_to_top.py',
    '--batch-dir',
    sourceBatchDir,
    '--output',
    topViewsDir,
    '--workers',
    '1',
    '--force-regenerate',
  ], NEW_PIPELINE_ROOT, input.env);

  emitProgress(title, '记录输出依赖树', 0.9);
  const topViewIndex = await readTopViewIndex(topViewsDir);
  const images = await readTopViewImages(input.projectRoot, topViewsDir, topViewIndex);
  assertTopViewImagesPresent(images, topViewIndex);
  const tree = dependencyTree({
    runId,
    sourceMainImagePath: input.mainImagePath,
    sourceBatchDir,
    topViewsDir,
    images,
    projectRoot: input.projectRoot,
  });
  const manifestPath = path.join(outputRoot, 'dependency_tree.json');
  await writeFile(manifestPath, `${JSON.stringify(tree, null, 2)}\n`, 'utf8');

  emitProgress(title, '俯视图生成完成', 1);
  return {
    ok: true,
    stage: 'top_view_generation',
    runId,
    batchOutput: {
      relativePath: toRelative(input.projectRoot, topViewsDir),
    },
    images,
    dependencyTree: {
      relativePath: toRelative(input.projectRoot, manifestPath),
      data: tree,
    },
    visionaryTask: {
      title,
      message: `生成 ${images.length} 张俯视图`,
      progress: 1,
      statusId: 'done',
    },
    warnings: promptCompatibility?.created
      ? [`Created compatible prompt file ${promptCompatibility.promptPath} from ${promptCompatibility.sourcePromptPath}.`]
      : [],
  };
}

async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: 'visionary-new-pipeline-top-view',
    version: '0.1.0',
  });

  server.registerTool(
    'generate_top_view',
    {
      title: 'Generate top view',
      description: 'Generate 90-degree top-view images through third-party/new_pipeline front_to_top.py.',
      inputSchema: {
        projectId: z.string().min(1).optional().describe('Optional Visionary project id. Defaults to the project id injected by the host runtime.'),
        mainImagePath: z.string().min(1).describe('Project-relative agent_history path of the applied main image.'),
        runLabel: z.string().default('top-view').describe('Optional safe label appended to the run output directory.'),
      },
    },
    async ({ projectId, mainImagePath, runLabel }) => {
      try {
        const injectedProjectRoot = String(process.env.VISIONARY_PROJECT_ROOT || '').trim();
        if (!injectedProjectRoot) {
          throw new Error('VISIONARY_PROJECT_ROOT is not configured for this MCP server.');
        }
        const result = await generateTopView({
          projectId: projectId || String(process.env.VISIONARY_PROJECT_ID || 'project'),
          projectRoot: injectedProjectRoot,
          mainImagePath,
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
            title: '俯视图生成',
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
