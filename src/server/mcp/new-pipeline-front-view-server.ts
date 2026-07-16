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
  const safeLabel = safeSegment(runLabel, 'front-view');
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

async function readBatchImages(projectRoot: string, batchDir: string): Promise<GeneratedAsset[]> {
  const indexRaw = await readFile(path.join(batchDir, 'index.json'), 'utf8');
  const index = JSON.parse(indexRaw) as { pairs?: Array<{ index?: number; image?: string }> };
  const pairs = Array.isArray(index.pairs) ? index.pairs : [];
  const assets: GeneratedAsset[] = [];
  for (const pair of pairs) {
    if (typeof pair.image !== 'string') continue;
    const imagePath = path.join(batchDir, pair.image);
    assets.push(await fileAsset(projectRoot, `front_view_${String(pair.index ?? assets.length + 1).padStart(3, '0')}`, imagePath, 'image/png'));
  }
  return assets;
}

function dependencyTree(input: {
  runId: string;
  sourceMainImagePath: string;
  promptPath: string;
  batchDir: string;
  images: GeneratedAsset[];
  projectRoot: string;
}): JsonRecord {
  const mainImageId = 'source_main_image';
  const promptId = 'front_view_prompt';
  const batchId = 'front_view_batch';
  return {
    schema: 'visionary.new_pipeline.dependency_tree',
    version: 1,
    runId: input.runId,
    stage: 'front_view_generation',
    nodes: [
      {
        id: mainImageId,
        kind: 'main_image',
        relativePath: input.sourceMainImagePath,
      },
      {
        id: promptId,
        kind: 'front_view_prompt',
        relativePath: toRelative(input.projectRoot, input.promptPath),
      },
      {
        id: batchId,
        kind: 'front_view_batch',
        relativePath: toRelative(input.projectRoot, input.batchDir),
      },
      ...input.images.map((asset) => ({
        id: asset.id,
        kind: 'front_view',
        relativePath: asset.relativePath,
        mimeType: asset.mimeType,
        bytes: asset.bytes,
      })),
    ],
    edges: [
      {
        from: mainImageId,
        to: promptId,
        relation: 'referenced_by',
      },
      {
        from: promptId,
        to: batchId,
        relation: 'used_to_generate',
      },
      ...input.images.map((asset) => ({
        from: batchId,
        to: asset.id,
        relation: 'contains',
      })),
    ],
  };
}

function buildFrontViewPrompt(input: {
  mainImagePath: string;
  objectDescriptions: string;
}): string {
  return [
    'Generate clean orthographic front-view component images for the scene.',
    'The front-view images should isolate the important visible objects as production-ready component references.',
    'Use the attached source main image as the visual reference. Keep proportions and visual style consistent with it.',
    '',
    `Source main image asset path for traceability: ${input.mainImagePath}`,
    '',
    'Object / scene description:',
    input.objectDescriptions.trim(),
  ].join('\n');
}

export async function generateFrontView(input: {
  projectRoot: string;
  projectId: string;
  mainImagePath: string;
  objectDescriptions: string;
  draws: number;
  runLabel: string;
}): Promise<JsonRecord> {
  const title = '正视图生成';
  const runId = nowRunId();
  const outputRoot = projectOutputRoot(input.projectRoot, input.projectId, input.runLabel, runId);
  const promptPath = path.join(outputRoot, 'front_view_prompt.txt');
  const batchOutputDir = path.join(outputRoot, 'front_views');
  const root = path.resolve(input.projectRoot);
  const sourceMainImagePath = path.resolve(root, input.mainImagePath);
  if (!isPathInside(root, sourceMainImagePath)) {
    throw new Error('Resolved main image path escapes project root.');
  }

  emitProgress(title, '准备正视图 prompt', 0.01);
  await mkdir(batchOutputDir, { recursive: true });
  await writeFile(promptPath, buildFrontViewPrompt({
    mainImagePath: input.mainImagePath,
    objectDescriptions: input.objectDescriptions,
  }), 'utf8');

  emitProgress(title, '调用图片生成服务', 0.35);
  await runPythonScript([
    'batch_generate.py',
    promptPath,
    '--draws',
    String(input.draws),
    '--workers',
    '1',
    '--input-image',
    sourceMainImagePath,
    '--output',
    batchOutputDir,
  ], NEW_PIPELINE_ROOT);

  emitProgress(title, '记录输出依赖树', 0.9);
  const images = await readBatchImages(input.projectRoot, batchOutputDir);
  const tree = dependencyTree({
    runId,
    sourceMainImagePath: input.mainImagePath,
    promptPath,
    batchDir: batchOutputDir,
    images,
    projectRoot: input.projectRoot,
  });
  const manifestPath = path.join(outputRoot, 'dependency_tree.json');
  await writeFile(manifestPath, `${JSON.stringify(tree, null, 2)}\n`, 'utf8');

  emitProgress(title, '正视图生成完成', 1);
  return {
    ok: true,
    stage: 'front_view_generation',
    runId,
    promptOutput: {
      relativePath: toRelative(input.projectRoot, promptPath),
    },
    batchOutput: {
      relativePath: toRelative(input.projectRoot, batchOutputDir),
    },
    images,
    dependencyTree: {
      relativePath: toRelative(input.projectRoot, manifestPath),
      data: tree,
    },
    visionaryTask: {
      title,
      message: `生成 ${images.length} 张正视图`,
      progress: 1,
    },
    warnings: [],
  };
}

async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: 'visionary-new-pipeline-front-view',
    version: '0.1.0',
  });

  server.registerTool(
    'generate_front_view',
    {
      title: 'Generate front view',
      description: 'Generate front-view component reference images through third-party/new_pipeline batch_generate.py using the applied main image as Gemini image input.',
      inputSchema: {
        projectId: z.string().min(1).optional().describe('Optional Visionary project id. Defaults to the project id injected by the host runtime.'),
        mainImagePath: z.string().min(1).describe('Project-relative agent_history path of the applied main image. The image is passed to batch_generate.py as --input-image.'),
        objectDescriptions: z.string().min(1).describe('Object and scene description used to generate front-view component references.'),
        draws: z.number().int().min(1).max(3).default(1).describe('How many front-view images to generate.'),
        runLabel: z.string().default('front-view').describe('Optional safe label appended to the run output directory.'),
      },
    },
    async ({ projectId, mainImagePath, objectDescriptions, draws, runLabel }) => {
      try {
        const injectedProjectRoot = String(process.env.VISIONARY_PROJECT_ROOT || '').trim();
        if (!injectedProjectRoot) {
          throw new Error('VISIONARY_PROJECT_ROOT is not configured for this MCP server.');
        }
        const result = await generateFrontView({
          projectId: projectId || String(process.env.VISIONARY_PROJECT_ID || 'project'),
          projectRoot: injectedProjectRoot,
          mainImagePath,
          objectDescriptions,
          draws,
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
            title: '正视图生成',
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
