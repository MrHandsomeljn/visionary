#!/usr/bin/env node
import { mkdir, open, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { buildComponents3DObjectName } from '../components-3d-model-naming.ts';
import type { Components3DGenerationProvider } from '../components-3d-config.ts';

type JsonRecord = Record<string, unknown>;

interface ImageSize {
  width: number;
  height: number;
}

interface LayoutObject {
  id: string;
  label: string;
  bboxIndex: number;
  frontPoint: unknown;
  hasFront: boolean;
  anchorPosition: [number, number, number];
  referenceSize: [number, number, number];
  targetYawDeg: number;
}

interface FrontOrientationIndex {
  byFile: Map<string, JsonRecord>;
  byKey: Map<string, JsonRecord>;
  byBbox: Map<number, JsonRecord>;
}

interface ComponentModelPathReference {
  path: string;
  sourcePath: string;
  pathKey: string;
  sourcePathKey: string;
  sourceNameKey: string;
}

const __filename = fileURLToPath(import.meta.url);
const SCENE_SCALE = 0.01;
const MIN_SCALE = 0.05;
const MAX_SCALE = 50.0;

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

function normalizeProjectRelativeInput(projectRoot: string, value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const resolved = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(projectRoot, raw);
  if (!isPathInside(projectRoot, resolved)) return '';
  return toRelative(projectRoot, resolved);
}

function pathKey(value: string): string {
  return String(value || '').trim().replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

function normalizeComponents3DModelPathReferences(projectRoot: string, value: unknown): ComponentModelPathReference[] {
  const entries = Array.isArray(value) ? value : [];
  const references: ComponentModelPathReference[] = [];
  for (const entry of entries) {
    const record = readRecord(entry);
    const canonicalCandidate = typeof entry === 'string'
      ? entry
      : record.path ?? record.canonicalPath ?? record.relativePath ?? record.modelPath;
    const canonicalPath = normalizeProjectRelativeInput(projectRoot, canonicalCandidate);
    if (!canonicalPath) continue;
    const sourcePath = normalizeProjectRelativeInput(
      projectRoot,
      record.sourcePath ?? record.sourceGlbPath ?? record.originalPath ?? '',
    );
    references.push({
      path: canonicalPath,
      sourcePath,
      pathKey: pathKey(canonicalPath),
      sourcePathKey: pathKey(sourcePath),
      sourceNameKey: sourcePath ? normalizeModelKey(path.basename(sourcePath)) : '',
    });
  }
  return references;
}

function resolvePlanModelPath(input: {
  projectRoot: string;
  sourceGlbPath: string;
  index: number;
  references: ComponentModelPathReference[];
}): { path: string; sourcePath: string; canonicalPath?: string } {
  const sourcePath = toRelative(input.projectRoot, input.sourceGlbPath);
  const sourcePathKey = pathKey(sourcePath);
  const sourceNameKey = normalizeModelKey(path.basename(sourcePath));
  const hasSourceMappings = input.references.some((reference) => reference.sourcePath);
  const reference = input.references.find((item) => item.sourcePathKey && item.sourcePathKey === sourcePathKey)
    ?? input.references.find((item) => item.sourceNameKey && item.sourceNameKey === sourceNameKey)
    ?? (!hasSourceMappings ? input.references[input.index] : undefined);
  if (!reference?.path) {
    return { path: sourcePath, sourcePath };
  }
  return {
    path: reference.path,
    sourcePath,
    ...(reference.pathKey !== sourcePathKey ? { canonicalPath: reference.path } : {}),
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

function usesEmbeddedGlbPlacement(frontOrientation: JsonRecord): boolean {
  if (String(frontOrientation.placement_mode || '') === 'glb_embedded_transform') return true;
  const items = Array.isArray(frontOrientation.items) ? frontOrientation.items.map(readRecord) : [];
  return items.some((item) => String(item.placement_mode || '') === 'glb_embedded_transform');
}

function components3DProvider(value: unknown): Components3DGenerationProvider {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'hunyuan') return 'hunyuan';
  if (normalized === 'trellis.2' || normalized === 'trellis2' || normalized === 'trellis-2') return 'trellis.2';
  return 'mocked';
}

async function loadComponents3DGenerationIdentity(
  hunyuanDir: string,
  frontOrientation: JsonRecord,
): Promise<{ provider: Components3DGenerationProvider; model: string }> {
  const modelIndexPath = path.join(hunyuanDir, 'model_index.json');
  const modelIndex = await pathExists(modelIndexPath)
    ? readRecord(await readJsonFile(modelIndexPath))
    : {};
  return {
    provider: components3DProvider(frontOrientation.provider || modelIndex.provider),
    model: String(frontOrientation.model || modelIndex.model || ''),
  };
}

function parseImageDirIndex(filePath: string): number {
  const match = path.basename(path.normalize(filePath)).match(/^image_(\d+)$/i);
  if (!match) {
    throw new Error(`Cannot infer image index from ${filePath}`);
  }
  return Number(match[1]);
}

function imageStem(index: number): string {
  return `image_${String(index).padStart(3, '0')}`;
}

function inferBatchFromHunyuanDir(hunyuanDir: string): { batchDir: string; imageIndex: number } {
  const absPath = path.resolve(hunyuanDir);
  const parts = absPath.split(path.sep);
  for (let idx = 0; idx < parts.length - 2; idx += 1) {
    if (parts[idx] !== 'pipeline_output' || parts[idx + 1] !== 'hunyuan_outputs') continue;
    const imageIndex = parseImageDirIndex(parts[idx + 2]);
    const batchParts = parts.slice(0, idx);
    const batchDir = batchParts.length === 1 && batchParts[0] === ''
      ? path.sep
      : batchParts.join(path.sep) || path.sep;
    return {
      batchDir: path.resolve(batchDir),
      imageIndex,
    };
  }
  throw new Error(`Cannot infer batch_dir from ${hunyuanDir}`);
}

function bboxJsonPath(batchDir: string, imageIndex: number): string {
  const stem = imageStem(imageIndex);
  return path.join(batchDir, 'pipeline_output', 'bbox_front', stem, `${stem}_bbox_front.json`);
}

function topViewImagePath(batchDir: string, imageIndex: number): string {
  const stem = imageStem(imageIndex);
  return path.join(batchDir, 'pipeline_output', 'top_views', `${stem}_top.png`);
}

function imageSizeFromBuffer(buffer: Buffer): ImageSize | null {
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 <= buffer.length) {
      while (offset < buffer.length && buffer[offset] !== 0xff) offset += 1;
      while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
      if (offset >= buffer.length) break;
      const marker = buffer[offset];
      offset += 1;
      if (marker === 0xd9 || marker === 0xda) break;
      if (offset + 2 > buffer.length) break;
      const segmentLength = buffer.readUInt16BE(offset);
      if (segmentLength < 2 || offset + segmentLength > buffer.length) break;
      if (marker === 0xc0 || marker === 0xc2) {
        return {
          height: buffer.readUInt16BE(offset + 3),
          width: buffer.readUInt16BE(offset + 5),
        };
      }
      offset += segmentLength;
    }
  }
  return null;
}

async function readImageSize(imagePath: string): Promise<ImageSize | null> {
  if (!await pathExists(imagePath)) return null;
  try {
    return imageSizeFromBuffer(await readFile(imagePath));
  } catch {
    return null;
  }
}

function numberTuple(value: unknown, length: number): number[] | null {
  if (!Array.isArray(value) || value.length < length) return null;
  const values = value.slice(0, length).map((item) => Number(item));
  return values.every((item) => Number.isFinite(item)) ? values : null;
}

function normalizeAngle(angle: number): number {
  const normalized = ((((angle + 180) % 360) + 360) % 360) - 180;
  return normalized === -180 ? 180 : normalized;
}

function annotationHasFront(annotation: JsonRecord): boolean {
  return Boolean(numberTuple(annotation.front_point, 2));
}

function loadLayoutObjects(data: unknown, imageSize: ImageSize, sceneScale: number): LayoutObject[] {
  if (Array.isArray(data)) {
    return data.map((value, index): LayoutObject | null => {
      const annotation = readRecord(value);
      const box = numberTuple(annotation.box_2d, 4);
      if (!box) return null;
      const [x1n, y1n, x2n, y2n] = box;
      const x1 = x1n / 1000 * imageSize.width;
      const y1 = y1n / 1000 * imageSize.height;
      const x2 = x2n / 1000 * imageSize.width;
      const y2 = y2n / 1000 * imageSize.height;
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      const width = Math.abs(x2 - x1);
      const height = Math.abs(y2 - y1);
      let targetYawDeg = 0;
      const frontPoint = numberTuple(annotation.front_point, 2);
      if (frontPoint) {
        const fx = frontPoint[0] / 1000 * imageSize.width;
        const fy = frontPoint[1] / 1000 * imageSize.height;
        targetYawDeg = Math.atan2(-(fy - cy), fx - cx) * 180 / Math.PI;
      }
      const label = String(annotation.label || `object_${index}`);
      const sizeX = width * sceneScale;
      const sizeY = height * sceneScale;
      return {
        id: label,
        label,
        bboxIndex: index,
        frontPoint: annotation.front_point ?? null,
        hasFront: annotationHasFront(annotation),
        anchorPosition: [
          (cx - imageSize.width / 2) * sceneScale,
          0,
          (imageSize.height / 2 - cy) * sceneScale,
        ],
        referenceSize: [sizeX, Math.min(sizeX, sizeY), sizeY],
        targetYawDeg,
      };
    }).filter((item): item is LayoutObject => Boolean(item));
  }

  const record = readRecord(data);
  const objects = Array.isArray(record.objects) ? record.objects : [];
  return objects.map((value, index) => {
    const object = readRecord(value);
    const position = numberTuple(object.anchor_position, 3) || [0, 0, 0];
    const referenceSize = numberTuple(object.reference_size, 3) || [1, 1, 1];
    return {
      id: String(object.id || object.label || `object_${index}`),
      label: String(object.label || object.id || `object_${index}`),
      bboxIndex: Number.isFinite(Number(object.bbox_index)) ? Number(object.bbox_index) : index,
      frontPoint: object.front_point ?? null,
      hasFront: object.has_front !== false,
      anchorPosition: [position[0], position[1], position[2]],
      referenceSize: [referenceSize[0], referenceSize[1], referenceSize[2]],
      targetYawDeg: Number.isFinite(Number(object.target_yaw_deg ?? object.rotation_euler_z))
        ? Number(object.target_yaw_deg ?? object.rotation_euler_z)
        : 0,
    };
  });
}

function normalizeModelKey(name: string): string {
  let key = path.basename(name, path.extname(name)).toLowerCase();
  if (key.includes('_model')) {
    key = key.split('_model')[0];
  }
  return key;
}

function matchGlbToLayoutObjects(glbPaths: string[], layoutObjects: LayoutObject[]): Array<{ glbPath: string; layoutObject: LayoutObject }> {
  const normalizedGlbs = glbPaths.map((glbPath) => ({
    glbPath,
    key: normalizeModelKey(path.basename(glbPath)),
  }));
  const matches: Array<{ glbPath: string; layoutObject: LayoutObject }> = [];
  for (const [index, layoutObject] of layoutObjects.entries()) {
    const objectId = String(layoutObject.id || '').toLowerCase();
    let chosen = normalizedGlbs.find(({ key }) => objectId && (objectId.includes(key) || key.includes(objectId)));
    if (!chosen && normalizedGlbs.length > 0) {
      chosen = normalizedGlbs[Math.min(index, normalizedGlbs.length - 1)];
    }
    if (chosen) {
      matches.push({
        glbPath: chosen.glbPath,
        layoutObject,
      });
    }
  }
  return matches;
}

async function loadFrontOrientation(frontOrientationPath: string): Promise<FrontOrientationIndex> {
  const byFile = new Map<string, JsonRecord>();
  const byKey = new Map<string, JsonRecord>();
  const byBbox = new Map<number, JsonRecord>();
  if (!await pathExists(frontOrientationPath)) {
    return { byFile, byKey, byBbox };
  }
  const data = readRecord(await readJsonFile(frontOrientationPath));
  const items = Array.isArray(data.items) ? data.items.map(readRecord) : [];
  for (const item of items) {
    const modelFile = typeof item.model_file === 'string' ? item.model_file : '';
    if (modelFile) {
      byFile.set(modelFile, item);
      byKey.set(normalizeModelKey(modelFile), item);
    }
    if (item.bbox_index !== undefined && Number.isFinite(Number(item.bbox_index))) {
      byBbox.set(Number(item.bbox_index), item);
    }
  }
  return { byFile, byKey, byBbox };
}

function correctionForModel(glbPath: string, layoutObject: LayoutObject, frontOrientation: FrontOrientationIndex): {
  correctionYawDeg: number;
  correctionStatus: string;
  warning?: string;
} {
  let item = frontOrientation.byFile.get(path.basename(glbPath));
  if (!item) {
    item = frontOrientation.byKey.get(normalizeModelKey(path.basename(glbPath)));
  }
  if (!item) {
    item = frontOrientation.byBbox.get(layoutObject.bboxIndex);
  }
  if (!item) {
    return {
      correctionYawDeg: 0,
      correctionStatus: frontOrientation.byFile.size > 0 || frontOrientation.byBbox.size > 0 ? 'missing_model_correction' : 'missing_front_orientation',
    };
  }
  const correctionYawDeg = Number(item.correction_yaw_deg);
  return {
    correctionYawDeg: Number.isFinite(correctionYawDeg) ? correctionYawDeg : 0,
    correctionStatus: String(item.status || 'unknown'),
    ...(typeof item.warning === 'string' && item.warning ? { warning: item.warning } : {}),
  };
}

async function verifyGlbFile(filePath: string): Promise<{ ok: boolean; message: string }> {
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    const info = await stat(filePath);
    handle = await open(filePath, 'r');
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, 12, 0);
    if (bytesRead < 12) return { ok: false, message: 'file is too small to be a valid GLB' };
    if (header.subarray(0, 4).toString('ascii') !== 'glTF') return { ok: false, message: 'file header is not GLB' };
    const declaredLength = header.readUInt32LE(8);
    if (declaredLength !== info.size) {
      return { ok: false, message: `GLB length mismatch (${declaredLength} declared, ${info.size} actual)` };
    }
    return { ok: true, message: 'OK' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function dependencyTree(input: {
  runId: string;
  hunyuanDir: string;
  frontOrientationPath: string;
  bboxJsonPath: string;
  topViewPath: string;
  sceneInsertPlanPath: string;
  glbPaths: string[];
  projectRoot: string;
}): JsonRecord {
  const hunyuanId = 'hunyuan_output_dir';
  const frontOrientationId = 'front_orientation';
  const bboxId = 'layout_bbox_json';
  const topViewId = 'layout_top_view';
  const planId = 'scene_insert_plan';
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
      {
        id: bboxId,
        kind: 'layout_bbox_json',
        relativePath: toRelative(input.projectRoot, input.bboxJsonPath),
      },
      {
        id: topViewId,
        kind: 'top_view',
        relativePath: toRelative(input.projectRoot, input.topViewPath),
      },
      ...input.glbPaths.map((glbPath, index) => ({
        id: `glb_${String(index + 1).padStart(3, '0')}`,
        kind: 'component_glb',
        relativePath: toRelative(input.projectRoot, glbPath),
      })),
      {
        id: planId,
        kind: 'visionary_scene_insert_plan',
        relativePath: toRelative(input.projectRoot, input.sceneInsertPlanPath),
      },
    ],
    edges: [
      {
        from: bboxId,
        to: planId,
        relation: 'positions_objects',
      },
      {
        from: frontOrientationId,
        to: planId,
        relation: 'orients_objects',
      },
      {
        from: topViewId,
        to: planId,
        relation: 'defines_layout_scale',
      },
      ...input.glbPaths.map((_glbPath, index) => ({
        from: `glb_${String(index + 1).padStart(3, '0')}`,
        to: planId,
        relation: 'loaded_by_visionary',
      })),
    ],
  };
}

export async function generateInsertScene(input: {
  projectRoot: string;
  projectId: string;
  components3DFrontOrientationPath: string;
  components3DModelPaths?: unknown[];
  runLabel: string;
}): Promise<JsonRecord> {
  const title = '最终插入场景';
  const root = path.resolve(input.projectRoot);
  const frontOrientationPath = path.resolve(root, input.components3DFrontOrientationPath);
  if (!isPathInside(root, frontOrientationPath)) {
    throw new Error('Resolved front orientation path escapes project root.');
  }
  const hunyuanDir = path.dirname(frontOrientationPath);
  if (!isPathInside(root, hunyuanDir)) {
    throw new Error('Resolved Hunyuan output path escapes project root.');
  }
  const { batchDir, imageIndex } = inferBatchFromHunyuanDir(hunyuanDir);
  const sourceBboxJsonPath = bboxJsonPath(batchDir, imageIndex);
  const sourceTopViewPath = topViewImagePath(batchDir, imageIndex);
  const runId = nowRunId();
  const outputRoot = projectOutputRoot(input.projectRoot, input.projectId, input.runLabel, runId);
  const sceneInsertPlanPath = path.join(outputRoot, 'scene_insert_plan.json');

  emitProgress(title, '准备 Visionary 场景插入计划', 0.01);
  await mkdir(outputRoot, { recursive: true });
  const glbPaths = await collectGlbFiles(hunyuanDir);
  if (glbPaths.length <= 0) {
    throw new Error(`No GLB files found in ${hunyuanDir}`);
  }
  const componentModelPathReferences = normalizeComponents3DModelPathReferences(root, input.components3DModelPaths);

  emitProgress(title, '读取组件 3D 资产位姿', 0.35);
  const rawFrontOrientation = readRecord(await readJsonFile(frontOrientationPath));
  const generationIdentity = await loadComponents3DGenerationIdentity(hunyuanDir, rawFrontOrientation);
  const warnings: string[] = [];
  const items = [];
  let imageSize: ImageSize = { width: 1000, height: 1000 };
  let sourceMode = 'layout_bbox';
  if (usesEmbeddedGlbPlacement(rawFrontOrientation)) {
    sourceMode = 'glb_embedded_transform';
    for (const [index, glbPath] of glbPaths.entries()) {
      const verification = await verifyGlbFile(glbPath);
      if (!verification.ok) {
        warnings.push(`${path.basename(glbPath)} skipped: ${verification.message}`);
        continue;
      }
      const modelPath = resolvePlanModelPath({
        projectRoot: input.projectRoot,
        sourceGlbPath: glbPath,
        index,
        references: componentModelPathReferences,
      });
      const relativeModelPath = modelPath.path;
      const modelExtension = path.extname(glbPath) || '.glb';
      const label = path.basename(glbPath, modelExtension);
      items.push({
        id: `scene_object_${String(index + 1).padStart(3, '0')}`,
        type: 'glb',
        name: `${String(index + 1).padStart(2, '0')}-${safeSegment(label, `component-${index + 1}`)}${modelExtension}`,
        label,
        path: relativeModelPath,
        modelPath: relativeModelPath,
        relativePath: relativeModelPath,
        source: {
          glbPath: modelPath.sourcePath,
          ...(modelPath.canonicalPath ? { canonicalGlbPath: modelPath.canonicalPath } : {}),
          placementMode: 'glb_embedded_transform',
        },
        transform: {
          position: [0, 0, 0],
          rotationEulerRad: [0, 0, 0],
          scale: [1, 1, 1],
          scaleMode: 'embedded',
        },
        orientation: {
          correctionStatus: 'embedded_transform',
          finalYawDeg: 0,
        },
      });
    }
  } else {
    if (!await pathExists(sourceBboxJsonPath)) {
      throw new Error(`Layout bbox JSON does not exist: ${sourceBboxJsonPath}`);
    }
    imageSize = await readImageSize(sourceTopViewPath) || imageSize;
    const layoutObjects = loadLayoutObjects(await readJsonFile(sourceBboxJsonPath), imageSize, SCENE_SCALE);
    if (layoutObjects.length <= 0) {
      throw new Error(`Layout bbox JSON has no usable objects: ${sourceBboxJsonPath}`);
    }
    const frontOrientation = await loadFrontOrientation(frontOrientationPath);
    const matches = matchGlbToLayoutObjects(glbPaths, layoutObjects);
    for (const [index, match] of matches.entries()) {
      const verification = await verifyGlbFile(match.glbPath);
      if (!verification.ok) {
        warnings.push(`${path.basename(match.glbPath)} skipped: ${verification.message}`);
        continue;
      }
      const correction = match.layoutObject.hasFront
        ? correctionForModel(match.glbPath, match.layoutObject, frontOrientation)
        : { correctionYawDeg: 0, correctionStatus: 'front_point_null' };
      if (correction.warning) {
        warnings.push(`${path.basename(match.glbPath)}: ${correction.warning}`);
      }
      const finalYawDeg = normalizeAngle(match.layoutObject.targetYawDeg + correction.correctionYawDeg);
      const modelPath = resolvePlanModelPath({
        projectRoot: input.projectRoot,
        sourceGlbPath: match.glbPath,
        index,
        references: componentModelPathReferences,
      });
      const relativeModelPath = modelPath.path;
      const modelExtension = path.extname(match.glbPath) || '.glb';
      const name = `${buildComponents3DObjectName({
        ordinal: index + 1,
        label: match.layoutObject.label,
        provider: generationIdentity.provider,
        model: generationIdentity.model,
      })}${modelExtension}`;
      items.push({
        id: `scene_object_${String(index + 1).padStart(3, '0')}`,
        type: 'glb',
        name,
        label: match.layoutObject.label,
        path: relativeModelPath,
        modelPath: relativeModelPath,
        relativePath: relativeModelPath,
        source: {
          bboxIndex: match.layoutObject.bboxIndex,
          glbPath: modelPath.sourcePath,
          ...(modelPath.canonicalPath ? { canonicalGlbPath: modelPath.canonicalPath } : {}),
          frontPoint: match.layoutObject.frontPoint,
          hasFront: match.layoutObject.hasFront,
        },
        transform: {
          position: match.layoutObject.anchorPosition,
          rotationEulerRad: [0, finalYawDeg * Math.PI / 180, 0],
          scale: [1, 1, 1],
          referenceSize: match.layoutObject.referenceSize,
          scaleMode: 'xyz_min',
          minScale: MIN_SCALE,
          maxScale: MAX_SCALE,
        },
        referenceSize: match.layoutObject.referenceSize,
        orientation: {
          targetYawDeg: match.layoutObject.targetYawDeg,
          correctionYawDeg: correction.correctionYawDeg,
          correctionStatus: correction.correctionStatus,
          finalYawDeg,
        },
      });
    }
  }
  if (items.length <= 0) {
    throw new Error('No valid GLB files could be added to the Visionary scene insert plan.');
  }

  emitProgress(title, '记录 Visionary 场景插入计划', 0.9);
  const plan = {
    schema: 'visionary.scene_insert_plan',
    version: 1,
    runId,
    stage: 'insert_scene',
    coordinateSystem: 'visionary_y_up_xz_ground',
    placementMode: sourceMode,
    scaleMode: sourceMode === 'glb_embedded_transform' ? 'embedded' : 'xyz_min',
    manifestPath: toRelative(input.projectRoot, sceneInsertPlanPath),
    source: {
      hunyuanDir: toRelative(input.projectRoot, hunyuanDir),
      frontOrientationPath: input.components3DFrontOrientationPath,
      placementMode: sourceMode,
      bboxJsonPath: toRelative(input.projectRoot, sourceBboxJsonPath),
      topViewPath: toRelative(input.projectRoot, sourceTopViewPath),
      imageIndex,
      imageSize,
      sceneScale: SCENE_SCALE,
    },
    items,
  };
  await writeFile(sceneInsertPlanPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  const tree = dependencyTree({
    runId,
    hunyuanDir,
    frontOrientationPath: input.components3DFrontOrientationPath,
    bboxJsonPath: sourceBboxJsonPath,
    topViewPath: sourceTopViewPath,
    sceneInsertPlanPath,
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
    images: [],
    sceneInsertPlan: plan,
    dependencyTree: {
      relativePath: toRelative(input.projectRoot, manifestPath),
      data: tree,
    },
    visionaryTask: {
      title,
      message: `准备插入 ${items.length} 个 Visionary 场景对象`,
      progress: 1,
      statusId: 'done',
    },
    warnings,
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
      description: 'Create a Visionary scene insertion plan from layout bbox, front orientation, and GLB assets without generating a Blender .blend file.',
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
          components3DModelPaths: [],
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
