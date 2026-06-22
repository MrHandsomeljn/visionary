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
  const safeLabel = safeSegment(runLabel, 'insert-scene');
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

async function readJsonFile(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

function readRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

async function collectGlbFiles(folder: string): Promise<string[]> {
  if (!await pathExists(folder)) return [];
  const entries = await readdir(folder, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.glb'))
    .map((entry) => path.join(folder, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

async function readFrontOrientationItemCount(frontOrientationPath: string): Promise<number> {
  if (!await pathExists(frontOrientationPath)) return 0;
  const frontOrientation = readRecord(await readJsonFile(frontOrientationPath));
  return Array.isArray(frontOrientation.items) ? frontOrientation.items.length : 0;
}

function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function writeBlendPreviewSvg(input: {
  outputPath: string;
  title: string;
  blendPath: string;
  objectCount: number;
}): Promise<void> {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760">',
    '<rect width="1200" height="760" fill="#f5f2ec"/>',
    '<rect x="72" y="72" width="1056" height="616" rx="18" fill="#ffffff" stroke="#2f3b45" stroke-width="3"/>',
    '<rect x="116" y="116" width="968" height="360" rx="10" fill="#dfe8eb" stroke="#7f8b90" stroke-width="2"/>',
    '<path d="M210 432 L410 245 L580 360 L725 220 L990 432 Z" fill="#97adb5"/>',
    '<path d="M230 432 L230 528 L990 528 L990 432 Z" fill="#c7d4d8"/>',
    '<circle cx="880" cy="198" r="42" fill="#f0b35a"/>',
    `<text x="116" y="592" font-family="Arial, sans-serif" font-size="42" fill="#24313a">${escapeSvgText(input.title)}</text>`,
    `<text x="116" y="642" font-family="Arial, sans-serif" font-size="24" fill="#5f6b73">layout.blend - ${input.objectCount} objects</text>`,
    `<text x="116" y="676" font-family="Arial, sans-serif" font-size="20" fill="#7a858b">${escapeSvgText(input.blendPath)}</text>`,
    '</svg>',
    '',
  ].join('\n');
  await writeFile(input.outputPath, svg, 'utf8');
}

function dependencyTree(input: {
  runId: string;
  hunyuanDir: string;
  frontOrientationPath: string;
  sourceBlendPath: string;
  blendPath: string;
  preview: GeneratedAsset;
  glbPaths: string[];
  projectRoot: string;
}): JsonRecord {
  const hunyuanId = 'hunyuan_output_dir';
  const frontOrientationId = 'front_orientation';
  const sourceBlendId = 'source_layout_blend';
  const blendId = 'final_layout_blend';
  return {
    schema: 'visionary.new_pipeline.dependency_tree',
    version: 1,
    runId: input.runId,
    stage: 'insert_scene',
    nodes: [
      {
        id: hunyuanId,
        kind: 'hunyuan_output_dir',
        relativePath: toRelative(input.projectRoot, input.hunyuanDir),
      },
      {
        id: frontOrientationId,
        kind: 'front_orientation',
        relativePath: input.frontOrientationPath,
      },
      ...input.glbPaths.map((glbPath, index) => ({
        id: `glb_${String(index + 1).padStart(3, '0')}`,
        kind: 'component_glb',
        relativePath: toRelative(input.projectRoot, glbPath),
      })),
      {
        id: sourceBlendId,
        kind: 'source_layout_blend',
        relativePath: toRelative(input.projectRoot, input.sourceBlendPath),
      },
      {
        id: blendId,
        kind: 'final_layout_blend',
        relativePath: input.blendPath,
      },
      {
        id: input.preview.id,
        kind: 'insert_scene_preview',
        relativePath: input.preview.relativePath,
        mimeType: input.preview.mimeType,
        bytes: input.preview.bytes,
        metadata: input.preview.metadata,
      },
    ],
    edges: [
      {
        from: hunyuanId,
        to: sourceBlendId,
        relation: 'used_to_layout',
      },
      {
        from: frontOrientationId,
        to: sourceBlendId,
        relation: 'used_to_orient',
      },
      ...input.glbPaths.map((_glbPath, index) => ({
        from: `glb_${String(index + 1).padStart(3, '0')}`,
        to: sourceBlendId,
        relation: 'inserted_into',
      })),
      {
        from: sourceBlendId,
        to: blendId,
        relation: 'copied_to_agent_history',
      },
      {
        from: blendId,
        to: input.preview.id,
        relation: 'previewed_by',
      },
    ],
  };
}

export async function generateInsertScene(input: {
  projectRoot: string;
  projectId: string;
  components3DFrontOrientationPath: string;
  runLabel: string;
}): Promise<JsonRecord> {
  const title = '最终插入场景';
  const root = path.resolve(input.projectRoot);
  const frontOrientationPath = path.resolve(root, input.components3DFrontOrientationPath);
  if (!isPathInside(root, frontOrientationPath)) {
    throw new Error('Resolved front orientation path escapes project root.');
  }
  const hunyuanDir = path.dirname(frontOrientationPath);
  const sourceBlendPath = path.join(hunyuanDir, 'layout.blend');
  const runId = nowRunId();
  const outputRoot = projectOutputRoot(input.projectRoot, input.projectId, input.runLabel, runId);
  const outputBlendPath = path.join(outputRoot, 'layout.blend');
  const previewPath = path.join(outputRoot, 'layout-preview.svg');

  emitProgress(title, '准备 Blender 布局输入', 0.01);
  await mkdir(outputRoot, { recursive: true });
  const glbPaths = await collectGlbFiles(hunyuanDir);
  const orientationItemCount = await readFrontOrientationItemCount(frontOrientationPath);

  emitProgress(title, '调用 blender_frontpoint_layout.py', 0.35);
  await runPythonScript([
    'blender_frontpoint_layout.py',
    '--hunyuan-dir',
    hunyuanDir,
  ], NEW_PIPELINE_ROOT);
  if (!await pathExists(sourceBlendPath)) {
    throw new Error(`blender_frontpoint_layout.py did not create ${sourceBlendPath}`);
  }

  emitProgress(title, '记录最终 Blender 工程', 0.9);
  await copyFile(sourceBlendPath, outputBlendPath);
  const blendRelativePath = toRelative(input.projectRoot, outputBlendPath);
  const objectCount = Math.max(glbPaths.length, orientationItemCount);
  await writeBlendPreviewSvg({
    outputPath: previewPath,
    title,
    blendPath: blendRelativePath,
    objectCount,
  });
  const preview = await fileAsset(
    input.projectRoot,
    'insert_scene_blend',
    previewPath,
    'image/svg+xml',
    {
      kind: 'insert_scene',
      blendPath: blendRelativePath,
      sourceBlendPath: toRelative(input.projectRoot, sourceBlendPath),
      hunyuanDir: toRelative(input.projectRoot, hunyuanDir),
      frontOrientationPath: input.components3DFrontOrientationPath,
      objectCount,
      glbPaths: glbPaths.map((glbPath) => toRelative(input.projectRoot, glbPath)),
    },
  );
  const tree = dependencyTree({
    runId,
    hunyuanDir,
    frontOrientationPath: input.components3DFrontOrientationPath,
    sourceBlendPath,
    blendPath: blendRelativePath,
    preview,
    glbPaths,
    projectRoot: input.projectRoot,
  });
  const manifestPath = path.join(outputRoot, 'dependency_tree.json');
  await writeFile(manifestPath, `${JSON.stringify(tree, null, 2)}\n`, 'utf8');

  emitProgress(title, '最终插入场景完成', 1);
  return {
    ok: true,
    stage: 'insert_scene',
    runId,
    batchOutput: {
      relativePath: toRelative(input.projectRoot, outputRoot),
    },
    images: [preview],
    blendAsset: {
      relativePath: blendRelativePath,
      mimeType: 'application/x-blender',
    },
    dependencyTree: {
      relativePath: toRelative(input.projectRoot, manifestPath),
      data: tree,
    },
    visionaryTask: {
      title,
      message: `生成 layout.blend，包含 ${objectCount} 个对象`,
      progress: 1,
    },
    warnings: [],
  };
}

async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: 'visionary-new-pipeline-insert-scene',
    version: '0.1.0',
  });

  server.registerTool(
    'insert_scene',
    {
      title: 'Insert generated assets into scene',
      description: 'Create the final layout.blend through third-party/new_pipeline blender_frontpoint_layout.py.',
      inputSchema: {
        projectId: z.string().min(1).optional().describe('Optional Visionary project id. Defaults to the project id injected by the host runtime.'),
        components3DFrontOrientationPath: z.string().min(1).describe('Project-relative path of the applied components-3d front_orientation.json.'),
        runLabel: z.string().default('insert-scene').describe('Optional safe label appended to the run output directory.'),
      },
    },
    async ({ projectId, components3DFrontOrientationPath, runLabel }) => {
      try {
        const injectedProjectRoot = String(process.env.VISIONARY_PROJECT_ROOT || '').trim();
        if (!injectedProjectRoot) {
          throw new Error('VISIONARY_PROJECT_ROOT is not configured for this MCP server.');
        }
        const result = await generateInsertScene({
          projectId: projectId || String(process.env.VISIONARY_PROJECT_ID || 'project'),
          projectRoot: injectedProjectRoot,
          components3DFrontOrientationPath,
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
            title: '最终插入场景',
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
