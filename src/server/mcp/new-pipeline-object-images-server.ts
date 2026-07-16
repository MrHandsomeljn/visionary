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

interface ObjectImageItem {
  id: string;
  label: string;
  imagePath: string;
  objectId?: string;
  bbox?: JsonRecord;
}

interface ObjectImageReference {
  id: string;
  label: string;
  path: string;
  sourcePath: string;
  mimeType: string;
  bytes: number;
}

interface ObjectImageFailure {
  objectId: string;
  label: string;
  error: string;
}

interface ObjectImageExtraction {
  items: ObjectImageItem[];
  expectedCount: number;
  failedObjects: ObjectImageFailure[];
  indexed: boolean;
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
  const safeLabel = safeSegment(runLabel, 'object-images');
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

function emitProgress(title: string, message: string, progress: number, terminalStatusId: 'done' | 'failed' = 'done'): void {
  const statusId = progress >= 1 ? terminalStatusId : 'running';
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
    const overrideEntries = Object.entries(extraEnv)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '');
    const env = {
      ...process.env,
      ...Object.fromEntries(overrideEntries),
    };
    let finalArgs = args;
    if (overrideEntries.length > 0) {
      env.VISIONARY_NEW_PIPELINE_CONFIG_OVERRIDES = JSON.stringify(Object.fromEntries(overrideEntries));
      finalArgs = ['-c', CONFIG_OVERRIDE_BOOTSTRAP, ...args];
    }
    const child = spawn(PYTHON_BIN, finalArgs, {
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

async function readLayoutAnnotations(bboxJsonPath: string): Promise<JsonRecord[]> {
  const data = await readJsonFile(bboxJsonPath);
  if (!Array.isArray(data)) return [];
  return data.map(readRecord).filter((annotation) => numberTuple(annotation.box_2d, 4));
}

function imageMimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  return 'image/png';
}

function objectLabelFromImagePath(filePath: string, fallback: string): string {
  const stem = path.basename(filePath, path.extname(filePath));
  const withoutPrefix = stem.replace(/^object_\d+_/i, '').replace(/_concept$/i, '').trim();
  return withoutPrefix || fallback;
}

function matchBboxAnnotation(label: string, annotations: JsonRecord[], fallbackIndex: number): JsonRecord {
  const key = label.toLowerCase();
  const matched = annotations.find((annotation) => {
    const annotationLabel = String(annotation.label || annotation.object || '').trim().toLowerCase();
    return annotationLabel && (annotationLabel.includes(key) || key.includes(annotationLabel));
  });
  return matched || annotations[Math.min(fallbackIndex, Math.max(0, annotations.length - 1))] || {};
}

async function collectObjectPreviewImages(rootDir: string): Promise<string[]> {
  if (!await pathExists(rootDir)) return [];
  const entries = await readdir(rootDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.(png|jpe?g|webp)$/i.test(entry.name))
    .map((entry) => path.join(rootDir, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

function resolveScriptPath(baseDir: string, value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  return path.isAbsolute(raw) ? raw : path.resolve(baseDir, raw);
}

async function readExtractedObjectItems(input: {
  projectRoot: string;
  singleObjectsRootDir: string;
  singleObjectsDir: string;
  imageIndex: number;
  annotations: JsonRecord[];
}): Promise<ObjectImageExtraction> {
  const root = path.resolve(input.projectRoot);
  const extractionIndexPath = path.join(input.singleObjectsRootDir, 'extraction_index.json');
  const index = await pathExists(extractionIndexPath)
    ? readRecord(await readJsonFile(extractionIndexPath))
    : {};
  const results = Array.isArray(index.results) ? index.results.map(readRecord) : [];
  const result = results.find((item) => Number(item.image_index ?? item.index) === input.imageIndex);
  if (!result) {
    const fallbackImages = await collectObjectPreviewImages(input.singleObjectsDir);
    return {
      items: fallbackImages.map((imagePath, index) => {
        const label = objectLabelFromImagePath(imagePath, `object_${index + 1}`);
        return {
          id: `object_image_${String(index + 1).padStart(3, '0')}`,
          label,
          imagePath,
          bbox: matchBboxAnnotation(label, input.annotations, index),
        };
      }),
      expectedCount: fallbackImages.length,
      failedObjects: [],
      indexed: false,
    };
  }
  const objects = Array.isArray(result.objects_extracted) ? result.objects_extracted.map(readRecord) : [];
  const indexedItems: ObjectImageItem[] = [];
  const failedObjects: ObjectImageFailure[] = [];
  for (const [index, object] of objects.entries()) {
    const label = String(object.object_name || `object_${index + 1}`);
    const objectId = String(object.object_id || `obj_${String(index + 1).padStart(2, '0')}`);
    if (!object.success) {
      failedObjects.push({ objectId, label, error: String(object.error || '提取失败') });
      continue;
    }
    const imagePath = resolveScriptPath(input.singleObjectsRootDir, object.output_path);
    if (!imagePath || !isPathInside(root, path.resolve(imagePath)) || !await pathExists(imagePath)) {
      failedObjects.push({ objectId, label, error: '提取结果文件缺失' });
      continue;
    }
    indexedItems.push({
      id: `object_image_${String(index + 1).padStart(3, '0')}`,
      label,
      imagePath,
      objectId,
      bbox: matchBboxAnnotation(label, input.annotations, index),
    });
  }
  const declaredFailedObjects = Array.isArray(result.failed_objects)
    ? result.failed_objects.map(readRecord)
    : [];
  for (const [index, failure] of declaredFailedObjects.entries()) {
    const label = String(failure.object_name || failure.label || `object_${index + 1}`);
    const objectId = String(failure.object_id || '');
    if (failedObjects.some((item) => item.objectId === objectId && item.label === label)) continue;
    failedObjects.push({ objectId, label, error: String(failure.error || '提取失败') });
  }
  const declaredExpectedCount = Number(result.expected_object_count);
  const expectedCount = Number.isFinite(declaredExpectedCount) && declaredExpectedCount >= 0
    ? declaredExpectedCount
    : objects.length;
  const missingCount = Math.max(0, expectedCount - indexedItems.length - failedObjects.length);
  for (let index = 0; index < missingCount; index += 1) {
    failedObjects.push({ objectId: '', label: `object_${objects.length + index + 1}`, error: '提取结果缺失' });
  }
  return { items: indexedItems, expectedCount, failedObjects, indexed: true };
}

async function copyObjectImages(input: {
  projectRoot: string;
  outputRoot: string;
  sourceBatchDir: string;
  layoutBboxJsonPath: string;
  singleObjectsDir: string;
  items: ObjectImageItem[];
  expectedCount: number;
  failedObjects: ObjectImageFailure[];
}): Promise<GeneratedAsset[]> {
  const targetDir = path.join(input.outputRoot, 'object_images');
  await mkdir(targetDir, { recursive: true });
  const references: ObjectImageReference[] = [];
  const copied = [];
  for (const [index, item] of input.items.entries()) {
    const extension = path.extname(item.imagePath) || '.png';
    const targetPath = path.join(
      targetDir,
      `${safeSegment(`${String(index + 1).padStart(3, '0')}-${item.label}`, `object-${index + 1}`)}${extension}`,
    );
    await copyFile(item.imagePath, targetPath);
    const info = await stat(targetPath);
    const reference: ObjectImageReference = {
      id: item.id,
      label: item.label,
      path: toRelative(input.projectRoot, targetPath),
      sourcePath: toRelative(input.projectRoot, item.imagePath),
      mimeType: imageMimeType(targetPath),
      bytes: info.size,
    };
    references.push(reference);
    copied.push({ item, targetPath, reference });
  }

  return Promise.all(copied.map(({ item, targetPath, reference }) => fileAsset(
    input.projectRoot,
    item.id,
    targetPath,
    reference.mimeType,
    {
      kind: 'object_image',
      assetType: 'image',
      label: item.label,
      objectName: item.label,
      objectId: item.objectId || item.id,
      bbox: item.bbox || {},
      bboxJsonPath: input.layoutBboxJsonPath,
      layoutBboxJsonPath: input.layoutBboxJsonPath,
      sourceObjectImagePath: reference.sourcePath,
      objectImagesDir: toRelative(input.projectRoot, input.singleObjectsDir),
      objectImagesOutputDir: toRelative(input.projectRoot, path.dirname(targetPath)),
      objectImageReferences: references,
      objectImageCount: references.length,
      objectImageExpectedCount: input.expectedCount,
      objectImageFailedCount: input.failedObjects.length,
      objectImageFailedObjects: input.failedObjects,
      objectImageIncomplete: input.failedObjects.length > 0 || references.length !== input.expectedCount,
    },
  )));
}

function dependencyTree(input: {
  runId: string;
  sourceMainImagePath: string;
  sourceLayoutBboxPath: string;
  sourceBatchDir: string;
  singleObjectsDir: string;
  outputRoot: string;
  images: GeneratedAsset[];
  projectRoot: string;
}): JsonRecord {
  const mainImageId = 'source_main_image';
  const layoutId = 'source_layout_bbox';
  const batchId = 'main_image_batch';
  const objectImagesId = 'pipeline_object_images';
  const outputId = 'visionary_object_images';
  return {
    schema: 'visionary.dependency_tree',
    version: 1,
    runId: input.runId,
    stage: 'object_image_extraction',
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
        kind: 'source_batch_dir',
        relativePath: toRelative(input.projectRoot, input.sourceBatchDir),
      },
      {
        id: objectImagesId,
        kind: 'pipeline_single_objects_dir',
        relativePath: toRelative(input.projectRoot, input.singleObjectsDir),
      },
      {
        id: outputId,
        kind: 'object_image_gallery',
        relativePath: toRelative(input.projectRoot, input.outputRoot),
      },
      ...input.images.map((asset) => ({
        id: asset.id,
        kind: 'object_image',
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
        to: objectImagesId,
        relation: 'guides_object_extraction',
      },
      {
        from: batchId,
        to: objectImagesId,
        relation: 'used_to_extract',
      },
      {
        from: objectImagesId,
        to: outputId,
        relation: 'copied_as_gallery',
      },
      ...input.images.map((asset) => ({
        from: outputId,
        to: asset.id,
        relation: 'contains',
      })),
    ],
  };
}

export async function generateObjectImages(input: {
  projectRoot: string;
  projectId: string;
  mainImagePath: string;
  layoutBboxJsonPath: string;
  runLabel: string;
  env?: Record<string, string | undefined>;
  forceRegenerate?: boolean;
}): Promise<JsonRecord> {
  const title = '物体图片获取';
  const root = path.resolve(input.projectRoot);
  const sourceMainImagePath = path.resolve(root, input.mainImagePath);
  const sourceLayoutBboxPath = path.resolve(root, input.layoutBboxJsonPath);
  if (!isPathInside(root, sourceMainImagePath) || !isPathInside(root, sourceLayoutBboxPath)) {
    throw new Error('Resolved source path escapes project root.');
  }
  const imageIndex = parseImageIndex(input.mainImagePath);
  const stem = imageStem(imageIndex);
  const runId = nowRunId();
  const outputRoot = projectOutputRoot(input.projectRoot, input.projectId, input.runLabel, runId);
  const sourceBatchDir = path.dirname(sourceMainImagePath);
  const objectListDir = path.join(sourceBatchDir, 'pipeline_output', 'object_lists');
  const objectListPath = path.join(objectListDir, `object_list_${String(imageIndex).padStart(3, '0')}.json`);
  const singleObjectsRootDir = path.join(sourceBatchDir, 'pipeline_output', 'single_objects');
  const singleObjectsDir = path.join(singleObjectsRootDir, stem);

  emitProgress(title, '准备物体图片输入', 0.01);
  await mkdir(outputRoot, { recursive: true });
  const annotations = await readLayoutAnnotations(sourceLayoutBboxPath);

  if (!await pathExists(objectListPath)) {
    emitProgress(title, '补全物体列表', 0.18);
    await runPythonScript([
      'extract_object_list.py',
      '--image',
      sourceMainImagePath,
      '--workers',
      '1',
    ], NEW_PIPELINE_ROOT, input.env);
  }

  emitProgress(title, '从主图提取单物体图片', 0.45);
  await runPythonScript([
    'extract_single_object.py',
    '--image',
    sourceMainImagePath,
    '--object-list-dir',
    objectListDir,
    '--output',
    singleObjectsRootDir,
    ...(input.forceRegenerate ? ['--force-regenerate'] : []),
  ], NEW_PIPELINE_ROOT, input.env);

  emitProgress(title, '整理物体图片 gallery', 0.82);
  const extraction = await readExtractedObjectItems({
    projectRoot: input.projectRoot,
    singleObjectsRootDir,
    singleObjectsDir,
    imageIndex,
    annotations,
  });
  const images = extraction.items.length > 0
    ? await copyObjectImages({
      projectRoot: input.projectRoot,
      outputRoot,
      sourceBatchDir,
      layoutBboxJsonPath: input.layoutBboxJsonPath,
      singleObjectsDir,
      items: extraction.items,
      expectedCount: extraction.expectedCount,
      failedObjects: extraction.failedObjects,
    })
    : [];
  const successfulCount = images.length;
  const failedCount = extraction.failedObjects.length;
  const incomplete = failedCount > 0 || successfulCount !== extraction.expectedCount;
  if (!incomplete && images.length <= 0) {
    throw new Error(`物体图片获取未返回可展示结果: ${singleObjectsDir}`);
  }

  const tree = dependencyTree({
    runId,
    sourceMainImagePath: input.mainImagePath,
    sourceLayoutBboxPath: input.layoutBboxJsonPath,
    sourceBatchDir,
    singleObjectsDir,
    outputRoot,
    images,
    projectRoot: input.projectRoot,
  });
  const manifestPath = path.join(outputRoot, 'dependency_tree.json');
  await writeFile(manifestPath, `${JSON.stringify(tree, null, 2)}\n`, 'utf8');

  const mismatchWarning = annotations.length > 0 && annotations.length !== images.length
    ? [`Layout detected ${annotations.length} objects, object-image extraction returned ${images.length}.`]
    : [];
  const incompleteWarning = incomplete
    ? [`Object-image extraction incomplete: ${successfulCount}/${extraction.expectedCount} succeeded.`]
    : [];
  emitProgress(title, incomplete ? '物体图片获取不完整' : '物体图片获取完成', 1, incomplete ? 'failed' : 'done');
  return {
    ok: !incomplete,
    incomplete,
    stage: 'object_image_extraction',
    runId,
    batchOutput: {
      relativePath: toRelative(input.projectRoot, outputRoot),
    },
    images,
    dependencyTree: {
      relativePath: toRelative(input.projectRoot, manifestPath),
      data: tree,
    },
    visionaryTask: {
      title,
      message: incomplete
        ? `物体图片获取不完整：${successfulCount}/${extraction.expectedCount} 张成功`
        : `获取 ${images.length} 张物体图片`,
      progress: 1,
      statusId: incomplete ? 'failed' : 'done',
      incomplete,
      expectedObjectCount: extraction.expectedCount,
      successfulObjectCount: successfulCount,
      failedObjectCount: failedCount,
      failedObjects: extraction.failedObjects,
    },
    extraction: {
      indexed: extraction.indexed,
      expectedObjectCount: extraction.expectedCount,
      successfulObjectCount: successfulCount,
      failedObjectCount: failedCount,
      failedObjects: extraction.failedObjects,
    },
    warnings: [...mismatchWarning, ...incompleteWarning],
  };
}

async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: 'visionary-new-pipeline-object-images',
    version: '0.1.0',
  });

  server.registerTool(
    'generate_object_images',
    {
      title: 'Generate object images',
      description: 'Extract per-object image gallery from the main scene image using the applied layout result.',
      inputSchema: {
        projectId: z.string().min(1).describe('Visionary project id.'),
        mainImagePath: z.string().min(1).describe('Project-relative path of the applied main image.'),
        layoutBboxJsonPath: z.string().min(1).describe('Project-relative path of the applied layout bbox JSON.'),
        runLabel: z.string().default('object-images').describe('Optional safe label appended to the run output directory.'),
      },
    },
    async ({ projectId, mainImagePath, layoutBboxJsonPath, runLabel }) => {
      try {
        const projectRoot = process.env.VISIONARY_PROJECT_ROOT;
        if (!projectRoot) {
          throw new Error('VISIONARY_PROJECT_ROOT is required');
        }
        const result = await generateObjectImages({
          projectRoot,
          projectId,
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
            title: '物体图片获取',
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startMcpServer().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exit(1);
  });
}
