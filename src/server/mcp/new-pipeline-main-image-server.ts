#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  MAIN_IMAGE_PROMPT_DESCRIPTION,
  MAIN_IMAGE_TOOL_DESCRIPTION,
} from './new-pipeline-main-image-contract.ts';

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
  const safeLabel = safeSegment(runLabel, 'main-image');
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
  // Codex JSONL task extraction can recognize these shapes when surfaced in MCP events/results.
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

async function latestTxtFile(folder: string): Promise<string> {
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(folder, { withFileTypes: true });
  const txtFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.txt'))
    .map((entry) => path.join(folder, entry.name));
  if (!txtFiles.length) {
    throw new Error(`No prompt txt file generated in ${folder}`);
  }
  const stats = await Promise.all(txtFiles.map(async (filePath) => ({ filePath, info: await stat(filePath) })));
  stats.sort((a, b) => b.info.mtimeMs - a.info.mtimeMs || a.filePath.localeCompare(b.filePath));
  return stats[0].filePath;
}

async function readBatchImages(projectRoot: string, batchDir: string): Promise<GeneratedAsset[]> {
  const indexRaw = await readFile(path.join(batchDir, 'index.json'), 'utf8');
  const index = JSON.parse(indexRaw) as { pairs?: Array<{ index?: number; image?: string }> };
  const pairs = Array.isArray(index.pairs) ? index.pairs : [];
  const assets: GeneratedAsset[] = [];
  for (const pair of pairs) {
    if (typeof pair.image !== 'string') continue;
    const imagePath = path.join(batchDir, pair.image);
    assets.push(await fileAsset(projectRoot, `main_image_${String(pair.index ?? assets.length + 1).padStart(3, '0')}`, imagePath, 'image/png'));
  }
  return assets;
}

function dependencyTree(input: {
  runId: string;
  stage: string;
  sourcePromptPath: string;
  generatedPromptPath: string;
  batchDir: string;
  images: GeneratedAsset[];
  projectRoot: string;
}): JsonRecord {
  const sourcePromptId = 'source_prompt';
  const generatedPromptId = 'generated_prompt';
  const batchId = 'main_image_batch';
  return {
    schema: 'visionary.new_pipeline.dependency_tree',
    version: 1,
    runId: input.runId,
    stage: input.stage,
    nodes: [
      {
        id: sourcePromptId,
        kind: 'text_prompt',
        relativePath: toRelative(input.projectRoot, input.sourcePromptPath),
      },
      {
        id: generatedPromptId,
        kind: 'image_generation_prompt',
        relativePath: toRelative(input.projectRoot, input.generatedPromptPath),
      },
      {
        id: batchId,
        kind: 'main_image_batch',
        relativePath: toRelative(input.projectRoot, input.batchDir),
      },
      ...input.images.map((asset) => ({
        id: asset.id,
        kind: 'main_image',
        relativePath: asset.relativePath,
        mimeType: asset.mimeType,
        bytes: asset.bytes,
      })),
    ],
    edges: [
      {
        from: sourcePromptId,
        to: generatedPromptId,
        relation: 'expanded_into',
      },
      {
        from: generatedPromptId,
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

export async function generateMainImage(input: {
  projectRoot: string;
  projectId: string;
  prompt: string;
  draws: number;
  runLabel: string;
}): Promise<JsonRecord> {
  const title = '主图生成';
  const runId = nowRunId();
  const outputRoot = projectOutputRoot(input.projectRoot, input.projectId, input.runLabel, runId);
  const promptSourcePath = path.join(outputRoot, 'source_prompt.txt');
  const promptOutputDir = path.join(outputRoot, 'prompt_outputs');
  const batchOutputDir = path.join(outputRoot, 'main_images');

  emitProgress(title, '准备输出目录', 0.01);
  await mkdir(promptOutputDir, { recursive: true });
  await mkdir(batchOutputDir, { recursive: true });
  await writeFile(promptSourcePath, input.prompt.trim(), 'utf8');

  emitProgress(title, '生成主图 prompt', 0.18);
  await runPythonScript([
    'prompt_image.py',
    '--prompt-file',
    promptSourcePath,
    '--output',
    promptOutputDir,
  ], NEW_PIPELINE_ROOT);
  const generatedPromptPath = await latestTxtFile(promptOutputDir);

  emitProgress(title, '调用图片生成服务', 0.45);
  await runPythonScript([
    'batch_generate.py',
    generatedPromptPath,
    '--draws',
    String(input.draws),
    '--workers',
    '1',
    '--output',
    batchOutputDir,
  ], NEW_PIPELINE_ROOT);

  emitProgress(title, '记录输出依赖树', 0.9);
  const images = await readBatchImages(input.projectRoot, batchOutputDir);
  const tree = dependencyTree({
    runId,
    stage: 'main_image_generation',
    sourcePromptPath: promptSourcePath,
    generatedPromptPath,
    batchDir: batchOutputDir,
    images,
    projectRoot: input.projectRoot,
  });
  const manifestPath = path.join(outputRoot, 'dependency_tree.json');
  await writeFile(manifestPath, `${JSON.stringify(tree, null, 2)}\n`, 'utf8');

  emitProgress(title, '主图生成完成', 1);
  return {
    ok: true,
    stage: 'main_image_generation',
    runId,
    promptOutput: {
      relativePath: toRelative(input.projectRoot, generatedPromptPath),
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
      message: `生成 ${images.length} 张主图`,
      progress: 1,
    },
    warnings: [],
  };
}

async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: 'visionary-new-pipeline-main-image',
    version: '0.1.0',
  });

  server.registerTool(
    'generate_main_image',
    {
      title: 'Generate main image',
      description: MAIN_IMAGE_TOOL_DESCRIPTION,
      inputSchema: {
        projectId: z.string().min(1).optional().describe('Optional Visionary project id. Defaults to the project id injected by the host runtime.'),
        prompt: z.string().min(1).describe(MAIN_IMAGE_PROMPT_DESCRIPTION),
        draws: z.number().int().min(1).max(3).default(1).describe('How many main images to generate. Keep low for interactive use.'),
        runLabel: z.string().default('main-image').describe('Optional safe label appended to the run output directory.'),
      },
    },
    async ({ projectId, prompt, draws, runLabel }) => {
      try {
        const injectedProjectRoot = String(process.env.VISIONARY_PROJECT_ROOT || '').trim();
        if (!injectedProjectRoot) {
          throw new Error('VISIONARY_PROJECT_ROOT is not configured for this MCP server.');
        }
        const result = await generateMainImage({
          projectId: projectId || String(process.env.VISIONARY_PROJECT_ID || 'project'),
          projectRoot: injectedProjectRoot,
          prompt,
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
            title: '主图生成',
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
