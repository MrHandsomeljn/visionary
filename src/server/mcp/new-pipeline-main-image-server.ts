#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, stat, writeFile } from 'node:fs/promises';
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

export interface MainImageApiConfigInput {
  url?: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: string | number;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VISIONARY_ROOT = path.resolve(__dirname, '../../..');
const REPO_ROOT = path.resolve(VISIONARY_ROOT, '..');
const NEW_PIPELINE_ROOT = path.resolve(process.env.VISIONARY_NEW_PIPELINE_ROOT || path.join(REPO_ROOT, 'third-party', 'new_pipeline'));
const DEFAULT_IMAGE_GEN_TIMEOUT_MS = 300_000;

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

async function fileAsset(projectRoot: string, id: string, filePath: string, mimeType: string, metadata: JsonRecord = {}): Promise<GeneratedAsset> {
  const info = await stat(filePath);
  return {
    id,
    relativePath: toRelative(projectRoot, filePath),
    mimeType,
    bytes: info.size,
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
}

async function writeCanonicalProjectAsset(input: {
  projectRoot: string;
  buffer: Buffer;
  mimeType: string;
  sourcePath: string;
  kind: string;
}): Promise<CanonicalAssetReference> {
  const root = path.resolve(input.projectRoot);
  const hash = createHash('sha256').update(input.buffer).digest('hex');
  const relativePath = `assets/${hash}${extensionForMimeType(input.mimeType)}`;
  const targetPath = path.join(root, ...relativePath.split('/'));
  if (!isPathInside(root, targetPath)) {
    throw new Error('Resolved canonical asset path escapes project root.');
  }
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, input.buffer);
  return {
    assetId: `sha256:${hash}`,
    hash,
    path: relativePath,
    mimeType: input.mimeType,
    bytes: input.buffer.byteLength,
    kind: input.kind,
    provenance: {
      sourcePath: input.sourcePath,
      stage: 'main-image',
    },
  };
}

function emitProgress(title: string, message: string, progress: number): void {
  const statusId = progress >= 1 ? 'done' : 'running';
  // Codex JSONL task extraction can recognize these shapes when surfaced in MCP events/results.
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

function dependencyTree(input: {
  runId: string;
  stage: string;
  finalPromptPath: string;
  batchDir: string;
  images: GeneratedAsset[];
  projectRoot: string;
  provider: JsonRecord;
}): JsonRecord {
  const finalPromptId = 'final_image_prompt';
  const batchId = 'main_image_batch';
  const providerId = 'image_generation_provider';
  return {
    schema: 'visionary.new_pipeline.dependency_tree',
    version: 1,
    runId: input.runId,
    stage: input.stage,
    nodes: [
      {
        id: finalPromptId,
        kind: 'image_generation_prompt',
        relativePath: toRelative(input.projectRoot, input.finalPromptPath),
      },
      {
        id: providerId,
        kind: 'image_generation_provider',
        metadata: input.provider,
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
        ...(asset.metadata ? { metadata: asset.metadata } : {}),
      })),
    ],
    edges: [
      {
        from: finalPromptId,
        to: batchId,
        relation: 'used_to_generate',
      },
      {
        from: providerId,
        to: batchId,
        relation: 'served_generation',
      },
      ...input.images.map((asset) => ({
        from: batchId,
        to: asset.id,
        relation: 'contains',
      })),
    ],
  };
}

function resolveImageApiConfig(overrides: MainImageApiConfigInput = {}): {
  url: string;
  apiKey: string;
  timeoutMs: number;
  provider: JsonRecord;
} {
  const url = String(overrides.url || process.env.GEMINI_IMAGE_URL || process.env.VISIONARY_GEMINI_IMAGE_URL || '').trim();
  if (!url) {
    throw new Error('GEMINI_IMAGE_URL or VISIONARY_GEMINI_IMAGE_URL is required for main-image generation.');
  }
  const apiKey = String(overrides.apiKey || process.env.GENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('GENAI_API_KEY or GEMINI_API_KEY is required for main-image generation.');
  }
  const timeoutMs = Math.max(1000, Number(overrides.timeoutMs || process.env.VISIONARY_IMAGE_GEN_TIMEOUT_MS || process.env.IMAGE_GEN_TIMEOUT_MS || DEFAULT_IMAGE_GEN_TIMEOUT_MS) || DEFAULT_IMAGE_GEN_TIMEOUT_MS);
  const modelFromUrl = url.match(/\/models\/([^:/?]+)/)?.[1] || '';
  const model = String(overrides.model || process.env.GEMINI_IMAGE_MODEL || modelFromUrl || 'gemini-image').trim();
  return {
    url,
    apiKey,
    timeoutMs,
    provider: {
      provider: 'apiyi',
      family: 'gemini-image',
      model,
      endpoint: url,
      responseModalities: ['IMAGE'],
    },
  };
}

function extensionForMimeType(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return '.jpg';
  if (normalized.includes('webp')) return '.webp';
  return '.png';
}

function findInlineImagePart(value: unknown): { data: string; mimeType: string } | null {
  const response = value && typeof value === 'object' ? value as JsonRecord : {};
  const candidates = Array.isArray(response.candidates) ? response.candidates : [];
  for (const candidateValue of candidates) {
    const candidate = candidateValue && typeof candidateValue === 'object' ? candidateValue as JsonRecord : {};
    const content = candidate.content && typeof candidate.content === 'object' ? candidate.content as JsonRecord : {};
    const parts = Array.isArray(content.parts) ? content.parts : [];
    for (const partValue of parts) {
      const part = partValue && typeof partValue === 'object' ? partValue as JsonRecord : {};
      const inlineData = part.inlineData && typeof part.inlineData === 'object'
        ? part.inlineData as JsonRecord
        : part.inline_data && typeof part.inline_data === 'object'
          ? part.inline_data as JsonRecord
          : {};
      const data = typeof inlineData.data === 'string' ? inlineData.data : '';
      if (!data) continue;
      return {
        data,
        mimeType: typeof inlineData.mimeType === 'string'
          ? inlineData.mimeType
          : typeof inlineData.mime_type === 'string'
            ? inlineData.mime_type
            : 'image/png',
      };
    }
  }
  return null;
}

async function requestGeminiImage(input: {
  prompt: string;
  config: ReturnType<typeof resolveImageApiConfig>;
  signal: AbortSignal;
}): Promise<{ buffer: Buffer; mimeType: string }> {
  const response = await fetch(input.config.url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${input.config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: input.prompt,
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: '16:9',
          imageSize: '1K',
        },
      },
    }),
    signal: input.signal,
  });
  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const message = typeof (data as JsonRecord).error === 'object'
      ? JSON.stringify((data as JsonRecord).error)
      : text || response.statusText;
    throw new Error(`Image API request failed (${response.status}): ${message}`);
  }
  const image = findInlineImagePart(data);
  if (!image) {
    throw new Error('Image API response did not include inline image data.');
  }
  return {
    buffer: Buffer.from(image.data, 'base64'),
    mimeType: image.mimeType,
  };
}

async function writeGeneratedImages(input: {
  projectRoot: string;
  prompt: string;
  batchOutputDir: string;
  draws: number;
  config: ReturnType<typeof resolveImageApiConfig>;
  signal?: AbortSignal;
}): Promise<GeneratedAsset[]> {
  const assets: GeneratedAsset[] = [];
  const pairs: Array<{ index: number; image: string; prompt: string; mimeType: string; canonicalAssetPath: string }> = [];
  for (let index = 1; index <= input.draws; index += 1) {
    const controller = new AbortController();
    const abortFromParent = () => controller.abort();
    if (input.signal?.aborted) controller.abort();
    input.signal?.addEventListener('abort', abortFromParent, { once: true });
    const timer = setTimeout(() => controller.abort(), input.config.timeoutMs);
    try {
      const image = await requestGeminiImage({
        prompt: input.prompt,
        config: input.config,
        signal: controller.signal,
      });
      const stem = `image_${String(index).padStart(3, '0')}`;
      const imageName = `${stem}${extensionForMimeType(image.mimeType)}`;
      const imagePath = path.join(input.batchOutputDir, imageName);
      await writeFile(imagePath, image.buffer);
      await writeFile(path.join(input.batchOutputDir, `${stem}_prompt.txt`), input.prompt, 'utf8');
      await writeFile(path.join(input.batchOutputDir, `${stem}.txt`), input.prompt, 'utf8');
      const runLocalPath = toRelative(input.projectRoot, imagePath);
      const canonicalAssetReference = await writeCanonicalProjectAsset({
        projectRoot: input.projectRoot,
        buffer: image.buffer,
        mimeType: image.mimeType,
        sourcePath: runLocalPath,
        kind: 'image',
      });
      assets.push(await fileAsset(input.projectRoot, `main_image_${String(index).padStart(3, '0')}`, imagePath, image.mimeType, {
        canonicalAssetReference,
        assetReferences: [canonicalAssetReference],
      }));
      pairs.push({
        index,
        image: imageName,
        prompt: `${stem}_prompt.txt`,
        mimeType: image.mimeType,
        canonicalAssetPath: canonicalAssetReference.path,
      });
    } finally {
      input.signal?.removeEventListener('abort', abortFromParent);
      clearTimeout(timer);
    }
  }
  await writeFile(path.join(input.batchOutputDir, 'index.json'), `${JSON.stringify({
    schema: 'visionary.main_image_batch',
    version: 1,
    provider: input.config.provider,
    pairs,
  }, null, 2)}\n`, 'utf8');
  return assets;
}

export async function generateMainImage(input: {
  projectRoot: string;
  projectId: string;
  prompt: string;
  draws: number;
  runLabel: string;
  apiConfig?: MainImageApiConfigInput;
  signal?: AbortSignal;
}): Promise<JsonRecord> {
  const title = '主图生成';
  const runId = nowRunId();
  const outputRoot = projectOutputRoot(input.projectRoot, input.projectId, input.runLabel, runId);
  const finalPromptPath = path.join(outputRoot, 'final_image_prompt.txt');
  const batchOutputDir = path.join(outputRoot, 'main_images');
  const finalPrompt = input.prompt.trim();
  const config = resolveImageApiConfig(input.apiConfig);

  emitProgress(title, '准备输出目录', 0.01);
  await mkdir(batchOutputDir, { recursive: true });
  await writeFile(finalPromptPath, finalPrompt, 'utf8');

  emitProgress(title, '调用 apiyi Gemini Image / Nano Banana 生图服务', 0.45);
  const images = await writeGeneratedImages({
    projectRoot: input.projectRoot,
    prompt: finalPrompt,
    batchOutputDir,
    draws: input.draws,
    config,
    signal: input.signal,
  });

  emitProgress(title, '记录输出依赖树', 0.9);
  const tree = dependencyTree({
    runId,
    stage: 'main_image_generation',
    finalPromptPath,
    batchDir: batchOutputDir,
    images,
    projectRoot: input.projectRoot,
    provider: config.provider,
  });
  const manifestPath = path.join(outputRoot, 'dependency_tree.json');
  await writeFile(manifestPath, `${JSON.stringify(tree, null, 2)}\n`, 'utf8');

  emitProgress(title, '主图生成完成', 1);
  return {
    ok: true,
    stage: 'main_image_generation',
    runId,
    provider: config.provider,
    promptOutput: {
      relativePath: toRelative(input.projectRoot, finalPromptPath),
      kind: 'final_image_prompt',
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
      statusId: 'done',
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
