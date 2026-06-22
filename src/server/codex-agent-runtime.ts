import { spawn } from 'node:child_process';
import { chmod, copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProjectStorage, ProjectStorageError } from './project-storage.ts';
import { generateMainImage } from './mcp/new-pipeline-main-image-server.ts';
import { generateFrontView } from './mcp/new-pipeline-front-view-server.ts';
import { generateTopView } from './mcp/new-pipeline-top-view-server.ts';
import { generateLayout } from './mcp/new-pipeline-layout-server.ts';
import { generateComponents3D } from './mcp/new-pipeline-components-3d-server.ts';
import { generateInsertScene } from './mcp/new-pipeline-insert-scene-server.ts';

export interface CodexAgentMessageInput {
  user: string;
  projectId: string;
  conversationId?: string;
  threadId?: string;
  prompt: string;
  workflow?: string;
}

export interface CodexAgentStepActionInput {
  user: string;
  projectId: string;
  sessionId: string;
  stepKey: string;
  action: string;
  prompt?: string;
  selectedIndex?: number;
  images?: unknown[];
  sourceImages?: unknown[];
}

export interface CodexAgentStepActionResult {
  sessionId: string;
  stepKey: string;
  action: string;
  blockPatch: {
    images: CodexGeneratedImage[];
    selectedIndex: number;
    applied: boolean;
    actions: string[];
    statusText?: string;
    value?: number;
    indeterminate?: boolean;
  };
  stepState: CodexAgentStepState;
}

export interface CodexAgentStepState {
  sessionId: string;
  stepKey: string;
  images: CodexGeneratedImage[];
  selectedIndex: number;
  applied: boolean;
  actions: string[];
}

export interface CodexAgentEvent {
  type: string;
  [key: string]: unknown;
}

export interface CodexAgentMessageResult {
  conversationId: string;
  threadId: string;
  finalText: string;
  events: CodexAgentEvent[];
  task: CodexAgentTaskState;
  images?: CodexGeneratedImage[];
}

export interface CodexGeneratedImage {
  id: string;
  relativePath: string;
  mimeType: string;
  bytes: number;
  metadata?: Record<string, unknown>;
}

export interface CodexAgentTaskState {
  started: boolean;
  title: string;
  progress: number;
  statusText: string;
  events: CodexAgentEvent[];
}

interface CodexSessionIndex {
  schema: 'visionary.codex_sessions';
  version: 1;
  conversations: Record<string, {
    threadId: string;
    updatedAt: string;
    sandbox?: string;
  }>;
}

interface CodexProjectEnvironment {
  projectDir: string;
  codexHome: string;
  sessionIndexPath: string;
  childEnv: Record<string, string>;
}

const CODEX_SESSION_INDEX_FILE = 'visionary_codex_sessions.json';
const CODEX_CONFIG_FILE = 'config.toml';
const CODEX_AUTH_FILE = 'auth.json';
const DEFAULT_CODEX_TIMEOUT_MS = 10 * 60 * 1000;
const NEW_PIPELINE_MAIN_IMAGE_MCP_NAME = 'visionary_new_pipeline_main_image';
const NEW_PIPELINE_FRONT_VIEW_MCP_NAME = 'visionary_new_pipeline_front_view';
const NEW_PIPELINE_TOP_VIEW_MCP_NAME = 'visionary_new_pipeline_top_view';
const NEW_PIPELINE_LAYOUT_MCP_NAME = 'visionary_new_pipeline_layout';
const NEW_PIPELINE_COMPONENTS_3D_MCP_NAME = 'visionary_new_pipeline_components_3d';
const NEW_PIPELINE_INSERT_SCENE_MCP_NAME = 'visionary_new_pipeline_insert_scene';
const VISIONARY_SCENE_SKILL_NAME = 'scene-skill';
const SUPPORTED_STEP_KEYS = ['main-image', 'front-view', 'top-view', 'layout', 'components-3d', 'insert-scene'] as const;

function codexStepLabel(stepKey: string): string {
  if (stepKey === 'front-view') return '正视图';
  if (stepKey === 'top-view') return '俯视图';
  if (stepKey === 'layout') return 'layout';
  if (stepKey === 'components-3d') return '组件 3D 资产';
  if (stepKey === 'insert-scene') return '最终场景';
  return '主图';
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeConversationId(value: string | undefined, projectId: string): string {
  const normalized = String(value || '').trim();
  return normalized || `project:${projectId}`;
}

function normalizeCodexSandbox(value: string | undefined): string {
  const normalized = String(value || '').trim();
  if (['read-only', 'workspace-write', 'danger-full-access'].includes(normalized)) {
    return normalized;
  }
  return 'workspace-write';
}

function extractSceneSkillPrompt(prompt: string): string {
  return String(prompt || '')
    .replace(/(^|\s)\$scene-skill(?=\s|$)/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSceneSkillPrompt(prompt: string): boolean {
  return /(^|\s)\$scene-skill(?=\s|$)/i.test(String(prompt || ''));
}

function sceneRunLabel(prompt: string): string {
  const text = String(prompt || '').toLowerCase();
  if (/车间|流水线|assembly|workshop|factory|production/.test(text)) {
    return 'workshop-assembly-line';
  }
  return 'scene-generation';
}

function resolveSourceCodexHome(env: Record<string, string | undefined> = process.env): string {
  return path.resolve(env.VISIONARY_CODEX_SOURCE_HOME || env.CODEX_HOME || path.join(homedir(), '.codex'));
}

async function tryReadText(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

function projectRootDir(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
}

function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function escapeTomlBasicString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
}

function buildNewPipelineMcpServerConfig(input: {
  serverName: string;
  serverPath: string;
  projectId: string;
  projectDir: string;
}): string {
  const rootDir = projectRootDir();
  const newPipelineRoot = path.resolve(rootDir, '..', 'third-party', 'new_pipeline');
  return [
    `[mcp_servers.${input.serverName}]`,
    'command = "npx"',
    `args = ["tsx", "${escapeTomlBasicString(input.serverPath)}"]`,
    `cwd = "${escapeTomlBasicString(rootDir)}"`,
    'default_tools_approval_mode = "approve"',
    'startup_timeout_sec = 60',
    'tool_timeout_sec = 900',
    '',
    `[mcp_servers.${input.serverName}.env]`,
    `VISIONARY_PROJECT_ID = "${escapeTomlBasicString(input.projectId)}"`,
    `VISIONARY_PROJECT_ROOT = "${escapeTomlBasicString(input.projectDir)}"`,
    `VISIONARY_NEW_PIPELINE_ROOT = "${escapeTomlBasicString(newPipelineRoot)}"`,
    '',
  ].join('\n');
}

function newPipelineMcpServers(): Array<{ name: string; serverPath: string }> {
  const rootDir = projectRootDir();
  return [
    {
      name: NEW_PIPELINE_MAIN_IMAGE_MCP_NAME,
      serverPath: path.join(rootDir, 'src', 'server', 'mcp', 'new-pipeline-main-image-server.ts'),
    },
    {
      name: NEW_PIPELINE_FRONT_VIEW_MCP_NAME,
      serverPath: path.join(rootDir, 'src', 'server', 'mcp', 'new-pipeline-front-view-server.ts'),
    },
    {
      name: NEW_PIPELINE_TOP_VIEW_MCP_NAME,
      serverPath: path.join(rootDir, 'src', 'server', 'mcp', 'new-pipeline-top-view-server.ts'),
    },
    {
      name: NEW_PIPELINE_LAYOUT_MCP_NAME,
      serverPath: path.join(rootDir, 'src', 'server', 'mcp', 'new-pipeline-layout-server.ts'),
    },
    {
      name: NEW_PIPELINE_COMPONENTS_3D_MCP_NAME,
      serverPath: path.join(rootDir, 'src', 'server', 'mcp', 'new-pipeline-components-3d-server.ts'),
    },
    {
      name: NEW_PIPELINE_INSERT_SCENE_MCP_NAME,
      serverPath: path.join(rootDir, 'src', 'server', 'mcp', 'new-pipeline-insert-scene-server.ts'),
    },
  ];
}

function buildNewPipelineMcpConfig(input: {
  projectId: string;
  projectDir: string;
}): string {
  const lines = [
    '',
    '# Visionary project-scoped MCP servers.',
  ];
  for (const server of newPipelineMcpServers()) {
    lines.push(buildNewPipelineMcpServerConfig({
      serverName: server.name,
      serverPath: server.serverPath,
      projectId: input.projectId,
      projectDir: input.projectDir,
    }));
  }
  return lines.join('\n');
}

function ensureNewPipelineMcpApprovalMode(config: string, serverName = NEW_PIPELINE_MAIN_IMAGE_MCP_NAME): string {
  const header = `[mcp_servers.${serverName}]`;
  const start = config.indexOf(header);
  if (start < 0) return config;
  const nextSection = config.indexOf('\n[', start + header.length);
  const end = nextSection < 0 ? config.length : nextSection + 1;
  const section = config.slice(start, end);
  const cleanedSection = section.replace(/^approval_mode\s*=.*\n?/m, '');
  if (/^default_tools_approval_mode\s*=/m.test(section)) {
    return `${config.slice(0, start)}${cleanedSection}${config.slice(end)}`;
  }
  const nextSectionBody = `${cleanedSection.slice(0, header.length)}\ndefault_tools_approval_mode = "approve"${cleanedSection.slice(header.length)}`;
  return `${config.slice(0, start)}${nextSectionBody}${config.slice(end)}`;
}

async function appendVisionaryMcpServers(input: {
  codexHome: string;
  projectId: string;
  projectDir: string;
}): Promise<void> {
  if (process.env.VISIONARY_NEW_PIPELINE_MCP_ENABLED === '0') {
    return;
  }
  const configPath = path.join(input.codexHome, CODEX_CONFIG_FILE);
  const current = await tryReadText(configPath);
  let next = current;
  for (const server of newPipelineMcpServers()) {
    if (next.includes(`[mcp_servers.${server.name}]`)) {
      next = ensureNewPipelineMcpApprovalMode(next, server.name);
      continue;
    }
    next = `${next.replace(/\s*$/, '')}\n\n${buildNewPipelineMcpServerConfig({
      serverName: server.name,
      serverPath: server.serverPath,
      projectId: input.projectId,
      projectDir: input.projectDir,
    })}`;
  }
  if (next !== current) {
    await writeFile(configPath, next, 'utf8');
  }
}

function buildVisionarySceneSkillMarkdown(): string {
  return [
    '---',
    `name: ${VISIONARY_SCENE_SKILL_NAME}`,
    'description: Generate Visionary main scene images from user scene requests. Use when the prompt contains `$scene-skill`, asks to generate/build/create a scene, or requests a main image/concept image for an environment, location, set, workshop, room, landscape, or production scene in Visionary.',
    '---',
    '',
    '# Visionary Scene Generation',
    '',
    'Use this skill to route scene-generation requests to Visionary\'s project-scoped main-image pipeline.',
    '',
    '## Workflow',
    '',
    '1. Remove the `$scene-skill` routing token from the user request before passing text to tools.',
    '2. Preserve the remaining user scene request verbatim in its original language. Do not translate, rewrite, summarize, expand, or optimize it.',
    '3. Call the available MCP tool `mcp__visionary_new_pipeline_main_image__generate_main_image`.',
    '4. Pass the preserved scene request as the `prompt` argument.',
    '5. Use `draws: 1` unless the user explicitly asks for multiple images.',
    '6. Use a short lowercase kebab-case `runLabel` that describes the scene.',
    '7. After the tool returns, summarize the generated asset paths and completion state for the user.',
    '',
    'If the MCP tool is unavailable or fails, explain the failure briefly and do not invent generated images.',
    '',
  ].join('\n');
}

async function syncVisionaryProjectSkills(input: {
  codexHome: string;
}): Promise<void> {
  const skillDir = path.join(input.codexHome, 'skills', VISIONARY_SCENE_SKILL_NAME);
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    path.join(skillDir, 'SKILL.md'),
    buildVisionarySceneSkillMarkdown(),
    'utf8',
  );
}

async function copyFileIfAvailable(sourcePath: string, targetPath: string): Promise<boolean> {
  if (path.resolve(sourcePath) === path.resolve(targetPath)) {
    return false;
  }
  try {
    await copyFile(sourcePath, targetPath);
    return true;
  } catch {
    return false;
  }
}

function readApiKeyFromAuthJson(raw: string): string {
  if (!raw.trim()) return '';
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const codexApiKey = parsed.CODEX_API_KEY;
    if (typeof codexApiKey === 'string' && codexApiKey.trim()) {
      return codexApiKey.trim();
    }
    const openAiApiKey = parsed.OPENAI_API_KEY;
    if (typeof openAiApiKey === 'string' && openAiApiKey.trim()) {
      return openAiApiKey.trim();
    }
  } catch {
    // Invalid source auth files are ignored; Codex will report the auth failure.
  }
  return '';
}

export async function prepareCodexHomeFromSource(input: {
  codexHome: string;
  sourceCodexHome?: string;
  env?: Record<string, string | undefined>;
}): Promise<Record<string, string>> {
  const env = input.env ?? process.env;
  const sourceCodexHome = path.resolve(input.sourceCodexHome || resolveSourceCodexHome(env));
  const childEnv: Record<string, string> = {};

  if (env.VISIONARY_CODEX_IMPORT_CONFIG !== '0') {
    await copyFileIfAvailable(
      path.join(sourceCodexHome, CODEX_CONFIG_FILE),
      path.join(input.codexHome, CODEX_CONFIG_FILE),
    );
  }

  const sourceAuthPath = path.join(sourceCodexHome, CODEX_AUTH_FILE);
  const targetAuthPath = path.join(input.codexHome, CODEX_AUTH_FILE);
  if (env.VISIONARY_CODEX_COPY_AUTH === '1') {
    const copied = await copyFileIfAvailable(sourceAuthPath, targetAuthPath);
    if (copied) {
      await chmod(targetAuthPath, 0o600);
    }
  }

  const apiKey = env.CODEX_API_KEY
    || env.OPENAI_API_KEY
    || readApiKeyFromAuthJson(await tryReadText(targetAuthPath))
    || readApiKeyFromAuthJson(await tryReadText(sourceAuthPath));
  if (apiKey) {
    childEnv.CODEX_API_KEY = apiKey;
  }

  return childEnv;
}

function buildInitialSessionIndex(): CodexSessionIndex {
  return {
    schema: 'visionary.codex_sessions',
    version: 1,
    conversations: {},
  };
}

async function readSessionIndex(sessionIndexPath: string): Promise<CodexSessionIndex> {
  try {
    const parsed = JSON.parse(await readFile(sessionIndexPath, 'utf8')) as Partial<CodexSessionIndex>;
    if (parsed.schema === 'visionary.codex_sessions' && parsed.version === 1 && parsed.conversations) {
      return {
        schema: 'visionary.codex_sessions',
        version: 1,
        conversations: { ...parsed.conversations },
      };
    }
  } catch {
    // Missing or invalid indexes are rebuilt; Codex's own thread transcript remains authoritative.
  }
  return buildInitialSessionIndex();
}

async function writeSessionIndex(sessionIndexPath: string, index: CodexSessionIndex): Promise<void> {
  await writeFile(sessionIndexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
}

export async function resolveCodexProjectEnvironment(
  storage: ProjectStorage,
  user: string,
  projectId: string,
): Promise<CodexProjectEnvironment> {
  const project = await storage.getProject(user, projectId);
  const projectDir = path.join(storage.rootDir, project.userId, project.id);
  const codexHome = path.join(projectDir, 'codex_home');
  await mkdir(codexHome, { recursive: true });
  const childEnv = await prepareCodexHomeFromSource({ codexHome });
  await appendVisionaryMcpServers({
    codexHome,
    projectId: project.id,
    projectDir,
  });
  await syncVisionaryProjectSkills({ codexHome });
  return {
    projectDir,
    codexHome,
    sessionIndexPath: path.join(codexHome, CODEX_SESSION_INDEX_FILE),
    childEnv,
  };
}

function readNestedText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  if (typeof record.text === 'string') return record.text;
  if (typeof record.message === 'string') return record.message;
  if (Array.isArray(record.content)) {
    return record.content
      .map((item) => readNestedText(item))
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function clampProgress(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric > 1 && numeric <= 100) {
    return Math.max(0, Math.min(1, numeric / 100));
  }
  return Math.max(0, Math.min(1, numeric));
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function parseMaybeJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return readRecord(parsed);
  } catch {
    return {};
  }
}

function parseMaybeJsonValue(value: unknown): unknown {
  if (typeof value !== 'string' || !value.trim()) return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    const outputMatch = value.match(/(?:^|\n)Output:\s*\n([\s\S]+)$/);
    if (outputMatch?.[1]) {
      try {
        return JSON.parse(outputMatch[1].trim()) as unknown;
      } catch {
        return value;
      }
    }
    return value;
  }
}

function normalizeCodexGeneratedImage(value: unknown): CodexGeneratedImage | null {
  const record = readRecord(value);
  const relativePath = typeof record.relativePath === 'string' ? record.relativePath.trim() : '';
  if (!relativePath || !relativePath.startsWith('agent_history/')) return null;
  return {
    id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : path.basename(relativePath),
    relativePath,
    mimeType: typeof record.mimeType === 'string' && record.mimeType.trim() ? record.mimeType.trim() : 'image/png',
    bytes: Number.isFinite(Number(record.bytes)) ? Number(record.bytes) : 0,
    ...(record.metadata && typeof record.metadata === 'object' ? { metadata: record.metadata as Record<string, unknown> } : {}),
  };
}

function findSourceImageByStep(sourceImages: unknown[], stepKey: string): CodexGeneratedImage | null {
  for (const value of sourceImages) {
    const record = readRecord(value);
    if (record.sourceStepKey !== stepKey) continue;
    const image = normalizeCodexGeneratedImage(value);
    if (image) return image;
  }
  return null;
}

function layoutBboxJsonPathFromImage(image: CodexGeneratedImage): string {
  const bboxJsonPath = typeof image.metadata?.bboxJsonPath === 'string' ? image.metadata.bboxJsonPath.trim() : '';
  if (!bboxJsonPath) {
    throw new ProjectStorageError('BAD_REQUEST', 'layout bbox json is required for components-3d');
  }
  return bboxJsonPath;
}

function frontOrientationPathFromComponents3D(image: CodexGeneratedImage): string {
  const frontOrientationPath = typeof image.metadata?.frontOrientationPath === 'string' ? image.metadata.frontOrientationPath.trim() : '';
  if (!frontOrientationPath) {
    throw new ProjectStorageError('BAD_REQUEST', 'components-3d front orientation is required for insert-scene');
  }
  return frontOrientationPath;
}

function createCodexAgentStepState({
  sessionId,
  stepKey,
  images,
  selectedIndex,
  applied,
  actions,
}: {
  sessionId: string;
  stepKey: string;
  images: CodexGeneratedImage[];
  selectedIndex: number;
  applied: boolean;
  actions: string[];
}): CodexAgentStepState {
  return {
    sessionId,
    stepKey,
    images,
    selectedIndex,
    applied,
    actions,
  };
}

function sanitizeCodexFinalText(text: string): string {
  const lines = String(text || '').split(/\r?\n/);
  const kept: string[] = [];
  let skippingAssetSection = false;
  for (const line of lines) {
    const trimmed = line.trim();
    const isAssetHeading = /^(图片路径|依赖树|image paths?|dependency tree)\s*[:：]?$/i.test(trimmed);
    const hasInternalAssetPath = /`?agent_history\/[^\s`]+?\.(?:png|jpe?g|webp|json|txt)`?/i.test(trimmed);
    if (isAssetHeading) {
      skippingAssetSection = true;
      continue;
    }
    if (hasInternalAssetPath) {
      continue;
    }
    if (skippingAssetSection && trimmed === '') {
      continue;
    }
    skippingAssetSection = false;
    kept.push(line);
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function collectCodexGeneratedImagesFromValue(value: unknown, images: CodexGeneratedImage[], depth = 0): void {
  if (depth > 8 || value === null || value === undefined) return;
  const parsed = parseMaybeJsonValue(value);
  if (parsed !== value) {
    collectCodexGeneratedImagesFromValue(parsed, images, depth + 1);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectCodexGeneratedImagesFromValue(item, images, depth + 1);
    }
    return;
  }
  if (typeof value !== 'object') return;
  const record = readRecord(value);
  if (Array.isArray(record.images)) {
    for (const image of record.images) {
      const normalized = normalizeCodexGeneratedImage(image);
      if (normalized) images.push(normalized);
    }
  }
  for (const nested of Object.values(record)) {
    collectCodexGeneratedImagesFromValue(nested, images, depth + 1);
  }
}

function extractCodexGeneratedImages(events: CodexAgentEvent[]): CodexGeneratedImage[] {
  const images: CodexGeneratedImage[] = [];
  const seen = new Set<string>();
  for (const event of events || []) {
    collectCodexGeneratedImagesFromValue(event, images);
  }
  return images.filter((image) => {
    if (seen.has(image.relativePath)) return false;
    seen.add(image.relativePath);
    return true;
  });
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function materializeCodexGeneratedImages(projectDir: string, images: CodexGeneratedImage[]): Promise<CodexGeneratedImage[]> {
  const projectRoot = path.resolve(projectDir);
  const repoRoot = projectRootDir();
  const materialized: CodexGeneratedImage[] = [];
  for (const image of images) {
    const relativePath = image.relativePath;
    const targetPath = path.resolve(projectRoot, relativePath);
    if (!isPathInside(projectRoot, targetPath)) continue;
    if (await pathExists(targetPath)) {
      materialized.push(image);
      continue;
    }
    const sourcePath = path.resolve(repoRoot, relativePath);
    if (!isPathInside(repoRoot, sourcePath) || !(await pathExists(sourcePath))) continue;
    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(sourcePath, targetPath);
    materialized.push(image);
  }
  return materialized;
}

function getTaskSignalPayload(event: CodexAgentEvent): Record<string, unknown> {
  const item = readRecord(event.item);
  const directPayload = readRecord(event.payload);
  const itemArguments = parseMaybeJsonObject(item.arguments);
  const itemResult = parseMaybeJsonObject(item.result);
  const resultText = readNestedText(item.result || item);
  const resultJson = parseMaybeJsonObject(resultText);
  const resultVisionaryTask = readRecord(resultJson.visionaryTask);
  return {
    ...directPayload,
    ...itemArguments,
    ...itemResult,
    ...resultVisionaryTask,
  };
}

function getTaskSignalName(event: CodexAgentEvent): string {
  const item = readRecord(event.item);
  return [
    event.type,
    event.name,
    event.tool,
    item.type,
    item.name,
    item.tool,
  ]
    .filter((value) => typeof value === 'string' && value.trim())
    .join(' ')
    .toLowerCase();
}

function isTaskStartSignal(name: string): boolean {
  return /(?:visionary|codex|agent|mcp)[_.:-]?task[_.:-]?(?:start|started)/.test(name)
    || /(?:task|generation)[_.:-]?(?:start|started)/.test(name);
}

function isTaskProgressSignal(name: string): boolean {
  return /(?:visionary|codex|agent|mcp)[_.:-]?task[_.:-]?progress/.test(name)
    || /(?:task|generation)[_.:-]?progress/.test(name);
}

function hasVisionaryTaskPayload(event: CodexAgentEvent): boolean {
  const item = readRecord(event.item);
  const resultText = readNestedText(item.result || item);
  const resultJson = parseMaybeJsonObject(resultText);
  const visionaryTask = readRecord(resultJson.visionaryTask);
  return Object.keys(visionaryTask).length > 0;
}

export function extractCodexTaskState(events: CodexAgentEvent[]): CodexAgentTaskState {
  const task: CodexAgentTaskState = {
    started: false,
    title: '',
    progress: 0,
    statusText: '',
    events: [],
  };

  for (const event of events || []) {
    const name = getTaskSignalName(event);
    const isStart = isTaskStartSignal(name);
    const isProgress = isTaskProgressSignal(name);
    const hasVisionaryTask = hasVisionaryTaskPayload(event);
    if (!isStart && !isProgress && !hasVisionaryTask) continue;

    const payload = getTaskSignalPayload(event);
    task.started = true;
    task.events.push(event);
    if (typeof payload.title === 'string' && payload.title.trim()) {
      task.title = payload.title.trim();
    }
    if (typeof payload.statusText === 'string' && payload.statusText.trim()) {
      task.statusText = payload.statusText.trim();
    } else if (typeof payload.status === 'string' && payload.status.trim()) {
      task.statusText = payload.status.trim();
    } else if (typeof payload.message === 'string' && payload.message.trim()) {
      task.statusText = payload.message.trim();
    }
    if (
      Object.prototype.hasOwnProperty.call(payload, 'progress')
      || Object.prototype.hasOwnProperty.call(payload, 'value')
      || Object.prototype.hasOwnProperty.call(payload, 'percent')
    ) {
      task.progress = clampProgress(payload.progress ?? payload.value ?? payload.percent);
    } else if (isStart && task.progress === 0) {
      task.progress = 0.01;
    }
  }

  return task;
}

export function parseCodexExecJsonl(stdout: string): {
  events: CodexAgentEvent[];
  threadId: string;
  finalText: string;
  errorText: string;
  images: CodexGeneratedImage[];
} {
  const events: CodexAgentEvent[] = [];
  let threadId = '';
  let finalText = '';
  let errorText = '';

  for (const line of String(stdout || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const event = JSON.parse(trimmed) as CodexAgentEvent;
      events.push(event);
      if (typeof event.thread_id === 'string') {
        threadId = event.thread_id;
      }
      if (event.type === 'thread.started' && typeof event.thread_id === 'string') {
        threadId = event.thread_id;
      }
      if (event.type === 'item.completed') {
        const item = event.item as Record<string, unknown> | undefined;
        if (item?.type === 'agent_message') {
          finalText = readNestedText(item) || finalText;
        }
      }
      if (event.type === 'response_item') {
        const payload = readRecord(event.payload);
        if (payload.type === 'message' && payload.role === 'assistant') {
          finalText = readNestedText(payload) || finalText;
        }
      }
      if (event.type === 'event_msg') {
        const payload = readRecord(event.payload);
        if (payload.type === 'agent_message') {
          finalText = readNestedText(payload) || finalText;
        }
      }
      if (event.type === 'error') {
        errorText = readNestedText(event) || errorText;
      }
    } catch {
      finalText = trimmed;
    }
  }

  return {
    events,
    threadId,
    finalText,
    errorText,
    images: extractCodexGeneratedImages(events),
  };
}

export function buildCodexExecArgs(input: {
  prompt: string;
  threadId?: string;
  sandbox: string;
}): string[] {
  const args = [
    '-a',
    'never',
    'exec',
    '--json',
    '--sandbox',
    input.sandbox,
    '--skip-git-repo-check',
  ];
  if (input.threadId) {
    args.push('resume', input.threadId, input.prompt);
    return args;
  }
  args.push(input.prompt);
  return args;
}

function runCodexExec(input: {
  projectDir: string;
  codexHome: string;
  childEnv: Record<string, string>;
  prompt: string;
  threadId?: string;
  sandbox: string;
  timeoutMs?: number;
}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const args = buildCodexExecArgs({
      prompt: input.prompt,
      threadId: input.threadId,
      sandbox: input.sandbox,
    });
    const child = spawn('codex', args, {
      cwd: input.projectDir,
      env: {
        ...process.env,
        CODEX_HOME: input.codexHome,
        ...input.childEnv,
      },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      reject(new ProjectStorageError('BAD_REQUEST', 'Codex timed out'));
    }, input.timeoutMs ?? DEFAULT_CODEX_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new ProjectStorageError('BAD_REQUEST', `Failed to start Codex CLI: ${error.message}`));
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const parsed = parseCodexExecJsonl(stdout);
      const message = parsed.errorText || stderr.trim() || `Codex exited with code ${code}`;
      reject(new ProjectStorageError('BAD_REQUEST', message));
    });
  });
}

export class CodexAgentRuntime {
  readonly storage: ProjectStorage;

  constructor(storage: ProjectStorage) {
    this.storage = storage;
  }

  async handleStepAction(input: CodexAgentStepActionInput): Promise<CodexAgentStepActionResult> {
    const stepKey = String(input.stepKey || '').trim();
    const action = String(input.action || '').trim();
    if (!SUPPORTED_STEP_KEYS.includes(stepKey as typeof SUPPORTED_STEP_KEYS[number])) {
      throw new ProjectStorageError('BAD_REQUEST', 'unsupported step key');
    }
    if (!['retry', 'apply', 'cancel'].includes(action)) {
      throw new ProjectStorageError('BAD_REQUEST', 'unsupported step action');
    }

    const env = await resolveCodexProjectEnvironment(this.storage, input.user, input.projectId);
    const currentImages = Array.isArray(input.images)
      ? input.images.map((image) => normalizeCodexGeneratedImage(image)).filter((image): image is CodexGeneratedImage => Boolean(image))
      : [];
    const rawSourceImages = Array.isArray(input.sourceImages) ? input.sourceImages : [];
    const sourceImages = rawSourceImages
      .map((image) => normalizeCodexGeneratedImage(image))
      .filter((image): image is CodexGeneratedImage => Boolean(image));
    const selectedIndex = Math.max(0, Math.min(currentImages.length - 1, Number(input.selectedIndex) || 0));
    const stepLabel = codexStepLabel(stepKey);

    if (action === 'apply') {
      const stepState = createCodexAgentStepState({
        sessionId: input.sessionId,
        stepKey,
        images: currentImages,
        selectedIndex,
        applied: true,
        actions: [],
      });
      return {
        sessionId: input.sessionId,
        stepKey,
        action,
        blockPatch: {
          images: stepState.images,
          selectedIndex: stepState.selectedIndex,
          applied: stepState.applied,
          actions: stepState.actions,
          statusText: currentImages.length > 0 ? `已应用${stepLabel}` : '已应用',
          value: 1,
          indeterminate: false,
        },
        stepState,
      };
    }

    if (action === 'cancel') {
      const stepState = createCodexAgentStepState({
        sessionId: input.sessionId,
        stepKey,
        images: currentImages,
        selectedIndex,
        applied: false,
        actions: ['cancel', 'retry', 'apply'],
      });
      return {
        sessionId: input.sessionId,
        stepKey,
        action,
        blockPatch: {
          images: stepState.images,
          selectedIndex: stepState.selectedIndex,
          applied: stepState.applied,
          actions: stepState.actions,
          statusText: `已取消${stepLabel}生成步骤`,
          value: 1,
          indeterminate: false,
        },
        stepState,
      };
    }

    const prompt = String(input.prompt || '').trim();
    if (!prompt) {
      throw new ProjectStorageError('BAD_REQUEST', 'prompt is required for retry');
    }
    let result: Record<string, unknown>;
    if (stepKey === 'insert-scene') {
      const components3DImage = findSourceImageByStep(rawSourceImages, 'components-3d');
      if (!components3DImage) {
        throw new ProjectStorageError('BAD_REQUEST', 'components-3d is required for insert-scene');
      }
      result = await generateInsertScene({
        projectRoot: env.projectDir,
        projectId: input.projectId,
        components3DFrontOrientationPath: frontOrientationPathFromComponents3D(components3DImage),
        runLabel: sceneRunLabel(prompt),
      });
    } else if (stepKey === 'front-view' || stepKey === 'top-view' || stepKey === 'layout' || stepKey === 'components-3d') {
      const sourceImage = findSourceImageByStep(rawSourceImages, 'main-image') || sourceImages[0];
      if (!sourceImage) {
        throw new ProjectStorageError('BAD_REQUEST', `main image is required for ${stepKey}`);
      }
      if (stepKey === 'components-3d') {
        const layoutImage = findSourceImageByStep(rawSourceImages, 'layout');
        if (!layoutImage) {
          throw new ProjectStorageError('BAD_REQUEST', 'layout is required for components-3d');
        }
        result = await generateComponents3D({
          projectRoot: env.projectDir,
          projectId: input.projectId,
          mainImagePath: sourceImage.relativePath,
          layoutBboxJsonPath: layoutBboxJsonPathFromImage(layoutImage),
          runLabel: sceneRunLabel(prompt),
        });
      } else if (stepKey === 'layout') {
        const topViewImage = findSourceImageByStep(rawSourceImages, 'top-view');
        if (!topViewImage) {
          throw new ProjectStorageError('BAD_REQUEST', 'top view is required for layout');
        }
        result = await generateLayout({
          projectRoot: env.projectDir,
          projectId: input.projectId,
          mainImagePath: sourceImage.relativePath,
          topViewPath: topViewImage.relativePath,
          runLabel: sceneRunLabel(prompt),
        });
      } else if (stepKey === 'top-view') {
        result = await generateTopView({
          projectRoot: env.projectDir,
          projectId: input.projectId,
          mainImagePath: sourceImage.relativePath,
          runLabel: sceneRunLabel(prompt),
        });
      } else {
        result = await generateFrontView({
          projectRoot: env.projectDir,
          projectId: input.projectId,
          mainImagePath: sourceImage.relativePath,
          objectDescriptions: prompt,
          draws: 1,
          runLabel: sceneRunLabel(prompt),
        });
      }
    } else {
      result = await generateMainImage({
        projectRoot: env.projectDir,
        projectId: input.projectId,
        prompt,
        draws: 1,
        runLabel: sceneRunLabel(prompt),
      });
    }
    const nextImages = Array.isArray(result.images)
      ? result.images.map((image) => normalizeCodexGeneratedImage(image)).filter((image): image is CodexGeneratedImage => Boolean(image))
      : [];
    const images = [...currentImages, ...nextImages];
    const stepState = createCodexAgentStepState({
      sessionId: input.sessionId,
      stepKey,
      images,
      selectedIndex: Math.max(0, images.length - 1),
      applied: false,
      actions: ['cancel', 'retry', 'apply'],
    });
    return {
      sessionId: input.sessionId,
      stepKey,
      action,
      blockPatch: {
        images: stepState.images,
        selectedIndex: stepState.selectedIndex,
        applied: stepState.applied,
        actions: stepState.actions,
        statusText: nextImages.length > 0
          ? `已生成 ${images.length} 张${stepLabel}`
          : '重试完成，未返回新图片',
        value: 1,
        indeterminate: false,
      },
      stepState,
    };
  }

  async sendMessage(input: CodexAgentMessageInput): Promise<CodexAgentMessageResult> {
    const prompt = String(input.prompt || '').trim();
    if (!prompt) {
      throw new ProjectStorageError('BAD_REQUEST', 'prompt is required');
    }

    const env = await resolveCodexProjectEnvironment(this.storage, input.user, input.projectId);
    const conversationId = normalizeConversationId(input.conversationId, input.projectId);
    if (isSceneSkillPrompt(prompt)) {
      const scenePrompt = extractSceneSkillPrompt(prompt);
      if (!scenePrompt) {
        throw new ProjectStorageError('BAD_REQUEST', 'scene prompt is required');
      }
      const result = await generateMainImage({
        projectRoot: env.projectDir,
        projectId: input.projectId,
        prompt: scenePrompt,
        draws: 1,
        runLabel: sceneRunLabel(scenePrompt),
      });
      const images = Array.isArray(result.images)
        ? result.images.filter((image): image is {
          id: string;
          relativePath: string;
          mimeType: string;
          bytes: number;
        } => (
          image
          && typeof image === 'object'
          && typeof image.id === 'string'
          && typeof image.relativePath === 'string'
          && typeof image.mimeType === 'string'
          && typeof image.bytes === 'number'
        ))
        : [];
      const taskPayload = readRecord(result.visionaryTask);
      const task: CodexAgentTaskState = {
        started: true,
        title: typeof taskPayload.title === 'string' ? taskPayload.title : '主图生成',
        progress: clampProgress(taskPayload.progress ?? 1),
        statusText: typeof taskPayload.message === 'string' ? taskPayload.message : `生成 ${images.length} 张主图`,
        events: [],
      };
      return {
        conversationId,
        threadId: `direct:${conversationId}:scene`,
        finalText: images.length > 0 ? `主图生成完成。已生成 ${images.length} 张主图。` : '主图生成完成。',
        events: [],
        task,
        images,
      };
    }
    const index = await readSessionIndex(env.sessionIndexPath);
    const sandbox = normalizeCodexSandbox(process.env.VISIONARY_CODEX_SANDBOX);
    const indexedConversation = index.conversations[conversationId];
    const indexedThreadId = indexedConversation?.sandbox === sandbox ? indexedConversation.threadId : '';
    const requestedThreadId = String(input.threadId || '').trim();
    const previousThreadId = requestedThreadId && requestedThreadId === indexedThreadId
      ? requestedThreadId
      : indexedThreadId;

    const { stdout } = await runCodexExec({
      projectDir: env.projectDir,
      codexHome: env.codexHome,
      childEnv: env.childEnv,
      prompt,
      threadId: previousThreadId || undefined,
      sandbox,
    });
    const parsed = parseCodexExecJsonl(stdout);
    const task = extractCodexTaskState(parsed.events);
    const images = await materializeCodexGeneratedImages(env.projectDir, parsed.images);
    const threadId = parsed.threadId || previousThreadId;

    if (!threadId) {
      throw new ProjectStorageError('BAD_REQUEST', 'Codex did not return a thread id');
    }

    index.conversations[conversationId] = {
      threadId,
      updatedAt: nowIso(),
      sandbox,
    };
    await writeSessionIndex(env.sessionIndexPath, index);

    return {
      conversationId,
      threadId,
      finalText: sanitizeCodexFinalText(parsed.finalText || ''),
      events: parsed.events,
      task,
      images,
    };
  }
}
