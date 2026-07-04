import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chmod, copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProjectStorage, ProjectStorageError } from './project-storage.ts';
import { generateMainImage, type MainImageApiConfigInput } from './mcp/new-pipeline-main-image-server.ts';
import { generateTopView } from './mcp/new-pipeline-top-view-server.ts';
import { generateLayout } from './mcp/new-pipeline-layout-server.ts';
import { generateComponents3D } from './mcp/new-pipeline-components-3d-server.ts';
import { generateInsertScene } from './mcp/new-pipeline-insert-scene-server.ts';
import { SCENE_BUILD_STEP_KEYS, type SceneBuildStepKey } from './scene-build-contract.ts';

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
    statusId?: string;
    value?: number;
    indeterminate?: boolean;
    isCurrent?: boolean;
    expanded?: boolean;
    sceneInsertPlan?: Record<string, unknown>;
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
  statusId?: string;
  events: CodexAgentEvent[];
  images?: CodexGeneratedImage[];
  stage?: string;
  trajectory?: unknown;
  sceneTimelineUpdated?: boolean;
  files?: unknown[];
  dependencyTree?: unknown;
  warnings?: unknown[];
  artifacts?: unknown[];
  directorIntentText?: string;
  initialViewImages?: CodexGeneratedImage[];
  pipelineStages?: unknown[];
  pipelineStageStatuses?: unknown[];
  prepared?: unknown;
  preparedPath?: string;
  renderRequests?: unknown[];
  evalRenderRequests?: unknown[];
  needsRender?: boolean;
  needsEvalRender?: boolean;
  renderStage?: string;
}

export interface CodexAgentMessageStreamCallbacks {
  onEvent?: (event: CodexAgentEvent) => void | Promise<void>;
  onTask?: (task: CodexAgentTaskState) => void | Promise<void>;
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
const NEW_PIPELINE_TOP_VIEW_MCP_NAME = 'visionary_new_pipeline_top_view';
const NEW_PIPELINE_LAYOUT_MCP_NAME = 'visionary_new_pipeline_layout';
const NEW_PIPELINE_COMPONENTS_3D_MCP_NAME = 'visionary_new_pipeline_components_3d';
const NEW_PIPELINE_INSERT_SCENE_MCP_NAME = 'visionary_new_pipeline_insert_scene';
const NEW_PIPELINE_CAMERA_TRAJECTORY_MCP_NAME = 'visionary_new_pipeline_camera_trajectory';
const VISIONARY_SCENE_SKILL_NAME = 'scene-skill';
const VISIONARY_CAMERA_SKILL_NAME = 'camera-skill';
const SUPPORTED_STEP_KEYS = SCENE_BUILD_STEP_KEYS;

function codexStepLabel(stepKey: string): string {
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

function organizeSceneImagePrompt(prompt: string): string {
  const request = String(prompt || '').trim();
  return [
    'Create a high-quality 16:9 main concept image for a Visionary 3D scene-building pipeline.',
    `Scene request: ${request}`,
    'Show the complete environment in a clear wide composition with readable object silhouettes and spatial layout.',
    'Use coherent materials, believable lighting, stable perspective, and enough object detail for later top-view, layout, and 3D component extraction stages.',
    'Avoid text overlays, watermarks, UI panels, labels, split-screen layouts, and cropped key objects.',
  ].join('\n');
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

function resolveNewPipelineRoot(): string {
  return path.resolve(process.env.VISIONARY_NEW_PIPELINE_ROOT || path.resolve(projectRootDir(), '..', 'third-party', 'new_pipeline'));
}

function resolveTrajectoryGenRoot(): string {
  return path.resolve(process.env.VISIONARY_TRAJECTORY_GEN_ROOT || path.resolve(projectRootDir(), '..', 'third-party', 'Trajectory_gen'));
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

function readCameraTrajectoryLlmConfig(input: {
  newPipelineRoot: string;
  trajectoryGenRoot: string;
}): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    const config = JSON.parse(readFileSync(path.join(input.trajectoryGenRoot, 'config', 'config.json'), 'utf8')) as Record<string, unknown>;
    if (typeof config.api_key === 'string' && config.api_key.trim()) result.GENAI_API_KEY = config.api_key.trim();
    if (typeof config.api_base === 'string' && config.api_base.trim()) result.GENAI_API_BASE = config.api_base.trim();
    if (typeof config.api_provider === 'string' && config.api_provider.trim()) result.LLM_API_PROVIDER = config.api_provider.trim();
    if (typeof config.model_name === 'string' && config.model_name.trim()) result.LLM_MODEL_NAME = config.model_name.trim();
  } catch {
    // Fall back to new_pipeline/config.py below.
  }
  try {
    const source = readFileSync(path.join(input.newPipelineRoot, 'config.py'), 'utf8');
    const extract = (name: string): string => (
      source.match(new RegExp(`^${name}\\s*=\\s*["']([^"']+)`, 'm'))?.[1]?.trim() || ''
    );
    result.GENAI_API_KEY ||= extract('GEMINI_API_KEY');
    result.GENAI_API_BASE ||= extract('GEMINI_BASE_URL').replace(/\/v1\/?$/, '');
    result.LLM_MODEL_NAME ||= extract('GEMINI_MODEL');
    result.LLM_API_PROVIDER ||= 'gemini';
  } catch {
    // Missing local config is allowed; users can still provide env vars manually.
  }
  return Object.fromEntries(Object.entries(result).filter(([, value]) => value));
}

function readMainImageApiConfig(input: {
  newPipelineRoot: string;
}): MainImageApiConfigInput {
  const result: MainImageApiConfigInput = {};
  let configSource = '';
  try {
    configSource = readFileSync(path.join(input.newPipelineRoot, 'config.py'), 'utf8');
  } catch {
    configSource = '';
  }
  const extract = (name: string): string => (
    configSource.match(new RegExp(`^${name}\\s*=\\s*["']([^"']+)`, 'm'))?.[1]?.trim() || ''
  );
  const imageUrl = String(process.env.GEMINI_IMAGE_URL || process.env.VISIONARY_GEMINI_IMAGE_URL || '').trim();
  if (imageUrl) {
    result.url = imageUrl;
  } else {
    const configuredUrl = extract('GEMINI_IMAGE_URL') || extract('VISIONARY_GEMINI_IMAGE_URL');
    if (configuredUrl) result.url = configuredUrl;
  }
  const apiKey = String(process.env.GENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (apiKey) {
    result.apiKey = apiKey;
  } else {
    const configuredKey = extract('GENAI_API_KEY') || extract('GEMINI_API_KEY') || extract('GOOGLE_API_KEY');
    if (configuredKey) result.apiKey = configuredKey;
  }
  const model = String(process.env.GEMINI_IMAGE_MODEL || '').trim();
  if (model) result.model = model;
  const timeoutMs = String(process.env.VISIONARY_IMAGE_GEN_TIMEOUT_MS || process.env.IMAGE_GEN_TIMEOUT_MS || '').trim();
  if (timeoutMs) result.timeoutMs = timeoutMs;
  return Object.fromEntries(Object.entries(result).filter(([, value]) => value)) as MainImageApiConfigInput;
}

function mainImageApiConfigToEnv(config: MainImageApiConfigInput): Record<string, string> {
  const result: Record<string, string> = {};
  if (config.url) result.GEMINI_IMAGE_URL = String(config.url);
  if (config.apiKey) result.GENAI_API_KEY = String(config.apiKey);
  if (config.model) result.GEMINI_IMAGE_MODEL = String(config.model);
  if (config.timeoutMs) result.VISIONARY_IMAGE_GEN_TIMEOUT_MS = String(config.timeoutMs);
  return result;
}

function resolveMainImageApiConfig(): MainImageApiConfigInput {
  return readMainImageApiConfig({ newPipelineRoot: resolveNewPipelineRoot() });
}

function buildNewPipelineMcpServerConfig(input: {
  serverName: string;
  serverPath: string;
  projectId: string;
  projectDir: string;
}): string {
  const rootDir = projectRootDir();
  const newPipelineRoot = resolveNewPipelineRoot();
  const trajectoryGenRoot = resolveTrajectoryGenRoot();
  const cameraLlmEnv = input.serverName === NEW_PIPELINE_CAMERA_TRAJECTORY_MCP_NAME
    ? readCameraTrajectoryLlmConfig({ newPipelineRoot, trajectoryGenRoot })
    : {};
  const mainImageEnv = input.serverName === NEW_PIPELINE_MAIN_IMAGE_MCP_NAME
    ? mainImageApiConfigToEnv(readMainImageApiConfig({ newPipelineRoot }))
    : {};
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
    `VISIONARY_NEW_PIPELINE_PYTHON = "${escapeTomlBasicString(path.join(newPipelineRoot, '.venv', 'bin', 'python'))}"`,
    `VISIONARY_TRAJECTORY_GEN_ROOT = "${escapeTomlBasicString(trajectoryGenRoot)}"`,
    ...Object.entries(mainImageEnv).map(([key, value]) => `${key} = "${escapeTomlBasicString(value)}"`),
    ...Object.entries(cameraLlmEnv).map(([key, value]) => `${key} = "${escapeTomlBasicString(value)}"`),
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
    {
      name: NEW_PIPELINE_CAMERA_TRAJECTORY_MCP_NAME,
      serverPath: path.join(rootDir, 'src', 'server', 'mcp', 'new-pipeline-camera-trajectory-server.ts'),
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

function ensureMcpServerEnvLines(config: string, serverName: string, desiredSection: string): string {
  const envHeader = `[mcp_servers.${serverName}.env]`;
  const desiredStart = desiredSection.indexOf(envHeader);
  if (desiredStart < 0) return config;
  const desiredEnv = desiredSection.slice(desiredStart + envHeader.length);
  const desiredLines = desiredEnv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[A-Z0-9_]+\s*=/.test(line));
  if (desiredLines.length <= 0) return config;

  const currentStart = config.indexOf(envHeader);
  if (currentStart < 0) return config;
  const nextSection = config.indexOf('\n[', currentStart + envHeader.length);
  const currentEnd = nextSection < 0 ? config.length : nextSection;
  const currentSection = config.slice(currentStart, currentEnd);
  let nextSectionBody = currentSection;
  let changed = false;
  const appendLines: string[] = [];
  for (const line of desiredLines) {
    const key = line.split('=')[0]?.trim() || '';
    if (!key) continue;
    const pattern = new RegExp(`^${key}\\s*=.*$`, 'm');
    if (pattern.test(nextSectionBody)) {
      nextSectionBody = nextSectionBody.replace(pattern, line);
      changed = true;
      continue;
    }
    appendLines.push(line);
  }
  if (appendLines.length > 0) {
    nextSectionBody = `${nextSectionBody}${nextSectionBody.endsWith('\n') ? '' : '\n'}${appendLines.join('\n')}\n`;
    changed = true;
  }
  if (!changed) return config;
  return `${config.slice(0, currentStart)}${nextSectionBody}${config.slice(currentEnd)}`;
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
    const desiredServerConfig = buildNewPipelineMcpServerConfig({
      serverName: server.name,
      serverPath: server.serverPath,
      projectId: input.projectId,
      projectDir: input.projectDir,
    });
    if (next.includes(`[mcp_servers.${server.name}]`)) {
      next = ensureNewPipelineMcpApprovalMode(next, server.name);
      next = ensureMcpServerEnvLines(next, server.name, desiredServerConfig);
      continue;
    }
    next = `${next.replace(/\s*$/, '')}\n\n${desiredServerConfig}`;
  }
  if (next !== current) {
    await writeFile(configPath, next, 'utf8');
  }
}

function buildVisionarySceneSkillMarkdown(): string {
  return [
    '---',
    `name: ${VISIONARY_SCENE_SKILL_NAME}`,
    'description: Start a staged Visionary scene-build pipeline from user scene requests. Use when the prompt contains `$scene-skill`, asks to generate/build/create a scene, or requests a full environment, location, set, workshop, room, landscape, or production scene in Visionary.',
    '---',
    '',
    '# Visionary Scene Build',
    '',
    'Use this skill to start Visionary\'s project-scoped staged scene pipeline: main-image -> top-view -> layout -> components-3d -> insert-scene.',
    '',
    '## Workflow',
    '',
    '1. Remove the `$scene-skill` routing token from the user request before passing text to tools.',
    '2. Organize the remaining user request into a final image-generation prompt for the main scene image. Keep the user intent and language, but add concise visual details needed for image generation such as composition, lighting, materials, spatial layout, and negative constraints.',
    '3. Call the available MCP tool `mcp__visionary_new_pipeline_main_image__generate_main_image`.',
    '4. Pass the organized final image-generation prompt as the `prompt` argument.',
    '5. Use `draws: 1` unless the user explicitly asks for multiple images.',
    '6. Use a short lowercase kebab-case `runLabel` that describes the scene.',
    '7. After the tool returns, stop. Tell the user the main-image stage is ready and the Visionary editor will wait for `应用`, `重试`, or `取消` before advancing to the next stage.',
    '',
    'If the MCP tool is unavailable or fails, explain the failure briefly and do not invent generated images.',
    '',
  ].join('\n');
}

function buildVisionaryCameraSkillMarkdown(): string {
  return [
    '---',
    `name: ${VISIONARY_CAMERA_SKILL_NAME}`,
    'description: Generate Visionary camera trajectories for the current project and hand them to the editor for preview. Use when the prompt contains `$camera-skill`, asks for camera paths, shot planning, trajectory keyframes, cinematic camera movement, or wants Trajectory_gen-style camera generation in Visionary.',
    '---',
    '',
    '# Visionary Camera Trajectory',
    '',
    'Use this skill to route camera trajectory requests to Visionary\'s project-scoped Trajectory_gen bridge.',
    '',
    '## Workflow',
    '',
    '1. Remove the `$camera-skill` routing token from the user request before passing text to tools.',
    '2. Call `mcp__visionary_new_pipeline_camera_trajectory__export_scene_info` to export the current `scene.json` into Trajectory_gen-compatible scene info.',
    '3. Call `mcp__visionary_new_pipeline_camera_trajectory__generate_camera_trajectory`.',
    '4. Pass the user camera request as `humanText` and pass the exported scene info path as `sceneInfoPath`.',
    '5. Parse structured trajectory parameters from the user request only when the user explicitly provides them. Do not hide numeric control values inside `humanText`; pass them as MCP arguments.',
    '',
    '## Structured parameters',
    '',
    '- `segmentCount`: number of camera trajectory segments. Default `1`. Use explicit phrases like "3 segments", "三段", "分 4 段".',
    '- `segmentDuration`: duration in seconds for each segment. Default `3`. Use explicit duration phrases like "8 seconds", "8 秒", "每段 5 秒". If the user gives only a total duration and segmentCount is known, divide total duration by segmentCount and round to an integer second.',
    '- `fps`: timeline frames per second. Default `30`. Use explicit phrases like "24 fps", "30 帧每秒".',
    '- `keyframeInterval`: frame interval between generated keyframes. Default `5`. Use explicit phrases like "every 10 frames", "每 10 帧一个关键帧", "keyframe interval 12".',
    '- `firstFrameOnly`: generate one first-frame pose per segment instead of full trajectories. Default `false`. Set `true` only for explicit quick first-frame/first pose/首帧/首个机位 requests.',
    '- `sceneBoundsScale`: scene bounds scale when scene info is exported from `scene.json`. Default `3`. Use only when explicitly requested.',
    '- `debugEvalOnly`: default `false`; `maxOptimizationRounds`: default `1`. Use only for explicit evaluation/optimization debug requests.',
    '',
    'When a parameter is not explicitly present, omit it or pass the documented default. Keep all remaining shot intent, subject, motion, mood, and composition instructions in `humanText`.',
    '',
    '6. Use conservative defaults for any omitted structured parameter.',
    '7. After `generate_camera_trajectory` returns, stop tool work. If it returns render requests or a prepared path, do not call continuation or apply tools; the host editor will render the requested views, continue optimization, and place the final trajectory on the timeline as a reversible preview.',
    '8. Do not call `mcp__visionary_new_pipeline_camera_trajectory__apply_camera_trajectory`. The editor owns final timeline preview and confirmation.',
    '9. Tell the user: "已开始渲染相机参考图，完成后会继续生成相机轨迹并放到时间轴预览；点击“应用”将确认保留当前预览轨迹并清理备份，点击“重试”将重新生成，点击“取消”将放弃并恢复旧轨迹。"',
    '10. Include the generated trajectory path and any warnings only when they are useful for debugging.',
    '',
    'Do not use Blender tools for this workflow. The MCP server exports Visionary scene metadata, runs the JSON-producing Trajectory_gen pipeline, and saves the resulting Visionary timeline data.',
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
  const cameraSkillDir = path.join(input.codexHome, 'skills', VISIONARY_CAMERA_SKILL_NAME);
  await mkdir(cameraSkillDir, { recursive: true });
  await writeFile(
    path.join(cameraSkillDir, 'SKILL.md'),
    buildVisionaryCameraSkillMarkdown(),
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

function findVisionaryTaskPayloadFromValue(value: unknown, depth = 0): Record<string, unknown> {
  if (depth > 8 || value === null || value === undefined) return {};
  const parsed = parseMaybeJsonValue(value);
  if (parsed !== value) {
    return findVisionaryTaskPayloadFromValue(parsed, depth + 1);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const payload = findVisionaryTaskPayloadFromValue(item, depth + 1);
      if (Object.keys(payload).length > 0) return payload;
    }
    return {};
  }
  if (typeof value !== 'object') return {};
  const record = readRecord(value);
  const visionaryTask = readRecord(record.visionaryTask);
  if (Object.keys(visionaryTask).length > 0) {
    return {
      ...record,
      ...visionaryTask,
    };
  }
  for (const nested of Object.values(record)) {
    const payload = findVisionaryTaskPayloadFromValue(nested, depth + 1);
    if (Object.keys(payload).length > 0) return payload;
  }
  return {};
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
  const nestedVisionaryTask = findVisionaryTaskPayloadFromValue(event);
  return {
    ...directPayload,
    ...itemArguments,
    ...itemResult,
    ...resultJson,
    ...resultVisionaryTask,
    ...nestedVisionaryTask,
  };
}

function normalizeTaskStatusId(value: unknown): string {
  const statusId = String(value || '').trim();
  if (!statusId) return '';
  if (['running', 'rendering', 'done', 'skipped', 'canceled', 'pending', 'failed'].includes(statusId)) return statusId;
  if (statusId === 'complete') return 'done';
  if (statusId === 'cancelled' || statusId === 'cancel') return 'canceled';
  if (statusId === 'fail' || statusId === 'error') return 'failed';
  return '';
}

function inferTaskStatusId(payload: Record<string, unknown>): string {
  const explicit = normalizeTaskStatusId(payload.statusId || payload.statusKey || payload.state);
  if (explicit) return explicit;
  const stage = String(payload.stage || '').trim();
  if (stage === 'camera_scene_info_export') return 'done';
  if (stage === 'camera_initial_view_prepare') return 'rendering';
  if (stage === 'camera_director_analysis') return 'done';
  if (stage === 'camera_trajectory_generation') return 'done';
  if (stage === 'camera_trajectory_eval_render') return 'rendering';
  const text = String(payload.statusText || payload.message || payload.status || '').trim();
  if (/^(运行中|Running|生成中|Processing|当前步骤|Current step)/i.test(text)) return 'running';
  if (/^(渲染中|Rendering)/i.test(text)) return 'rendering';
  if (/^(已完成|Completed)/i.test(text)) return 'done';
  if (/^(已跳过|Skipped)/i.test(text)) return 'skipped';
  if (/^(已取消|Canceled|Cancelled)/i.test(text)) return 'canceled';
  if (/^(失败|Failed|Error)/i.test(text)) return 'failed';
  if (/^(等待|Waiting|Pending)/i.test(text)) return 'pending';
  return '';
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
  return Object.keys(findVisionaryTaskPayloadFromValue(event)).length > 0;
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
    const statusId = inferTaskStatusId(payload);
    if (statusId) {
      task.statusId = statusId;
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
    if (Array.isArray(payload.images)) {
      const images = payload.images
        .map((image) => normalizeCodexGeneratedImage(image))
        .filter((image): image is CodexGeneratedImage => Boolean(image));
      if (images.length > 0) {
        task.images = images;
      }
    }
    if (Array.isArray(payload.initialViewImages)) {
      const initialViewImages = payload.initialViewImages
        .map((image) => normalizeCodexGeneratedImage(image))
        .filter((image): image is CodexGeneratedImage => Boolean(image));
      if (initialViewImages.length > 0) {
        task.initialViewImages = initialViewImages;
      }
    }
    if (Array.isArray(payload.artifacts)) {
      task.artifacts = payload.artifacts;
    }
    if (Array.isArray(payload.pipelineStages)) {
      task.pipelineStages = payload.pipelineStages;
    }
    if (Array.isArray(payload.pipelineStageStatuses)) {
      task.pipelineStageStatuses = payload.pipelineStageStatuses;
    }
    if (typeof payload.directorIntentText === 'string' && payload.directorIntentText.trim()) {
      task.directorIntentText = payload.directorIntentText.trim();
    }
    if (payload.prepared && typeof payload.prepared === 'object') {
      task.prepared = payload.prepared;
    }
    if (typeof payload.preparedPath === 'string' && payload.preparedPath.trim()) {
      task.preparedPath = payload.preparedPath.trim();
    }
    if (Array.isArray(payload.renderRequests)) {
      task.renderRequests = payload.renderRequests;
    }
    if (Array.isArray(payload.evalRenderRequests)) {
      task.evalRenderRequests = payload.evalRenderRequests;
    }
    if (typeof payload.needsRender === 'boolean') {
      task.needsRender = payload.needsRender;
    }
    if (typeof payload.needsEvalRender === 'boolean') {
      task.needsEvalRender = payload.needsEvalRender;
    }
    if (typeof payload.renderStage === 'string' && payload.renderStage.trim()) {
      task.renderStage = payload.renderStage.trim();
    }
    if (typeof payload.stage === 'string' && payload.stage.trim()) {
      task.stage = payload.stage.trim();
    }
    if (payload.trajectory && typeof payload.trajectory === 'object') {
      task.trajectory = payload.trajectory;
    }
    if (typeof payload.sceneTimelineUpdated === 'boolean') {
      task.sceneTimelineUpdated = payload.sceneTimelineUpdated;
    }
    if (Array.isArray(payload.files)) {
      task.files = payload.files;
    }
    if (payload.dependencyTree && typeof payload.dependencyTree === 'object') {
      task.dependencyTree = payload.dependencyTree;
    }
    if (Array.isArray(payload.warnings)) {
      task.warnings = payload.warnings;
    }
  }

  if (!task.statusId) {
    task.statusId = inferTaskStatusId({
      stage: task.stage,
      progress: task.progress,
      statusText: task.statusText,
      message: task.statusText,
    }) || (task.progress >= 1 ? 'done' : task.started ? 'running' : '');
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
  onEvent?: (event: CodexAgentEvent) => void;
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
    let pendingStdoutLine = '';
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      reject(new ProjectStorageError('BAD_REQUEST', 'Codex timed out'));
    }, input.timeoutMs ?? DEFAULT_CODEX_TIMEOUT_MS);

    const emitStdoutEvents = (text: string, flush = false) => {
      pendingStdoutLine += text;
      const lines = pendingStdoutLine.split(/\r?\n/);
      pendingStdoutLine = flush ? '' : lines.pop() || '';
      const completeLines = flush ? lines.filter((line) => line.trim()) : lines;
      for (const line of completeLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          input.onEvent?.(JSON.parse(trimmed) as CodexAgentEvent);
        } catch {
          // Non-JSON stdout is still retained for final parsing.
        }
      }
    };

    child.stdout.on('data', (chunk) => {
      const text = String(chunk);
      stdout += text;
      if (input.onEvent) {
        emitStdoutEvents(text);
      }
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
      if (input.onEvent && pendingStdoutLine.trim()) {
        emitStdoutEvents('\n', true);
      }
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
    if (!SUPPORTED_STEP_KEYS.includes(stepKey as SceneBuildStepKey)) {
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
          statusText: '',
          statusId: 'done',
          value: 1,
          indeterminate: false,
          isCurrent: false,
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
        actions: ['retry'],
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
          statusId: 'canceled',
          value: 0,
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
    } else if (stepKey === 'top-view' || stepKey === 'layout' || stepKey === 'components-3d') {
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
        throw new ProjectStorageError('BAD_REQUEST', `unsupported step: ${stepKey}`);
      }
    } else {
      result = await generateMainImage({
        projectRoot: env.projectDir,
        projectId: input.projectId,
        prompt,
        draws: 1,
        runLabel: sceneRunLabel(prompt),
        apiConfig: resolveMainImageApiConfig(),
      });
    }
    const nextImages = Array.isArray(result.images)
      ? result.images.map((image) => normalizeCodexGeneratedImage(image)).filter((image): image is CodexGeneratedImage => Boolean(image))
      : [];
    const images = nextImages;
    const sceneInsertPlan = readRecord(result.sceneInsertPlan);
    const hasSceneInsertPlan = stepKey === 'insert-scene' && Object.keys(sceneInsertPlan).length > 0;
    const taskPayload = readRecord(result.visionaryTask);
    const taskStatusText = typeof taskPayload.message === 'string' && taskPayload.message.trim()
      ? taskPayload.message.trim()
      : '';
    const taskStatusId = normalizeTaskStatusId(taskPayload.statusId || taskPayload.statusKey || taskPayload.state);
    if (taskStatusId === 'failed') {
      throw new ProjectStorageError('BAD_REQUEST', taskStatusText || `${stepLabel}生成失败`);
    }
    if (stepKey !== 'insert-scene' && images.length <= 0) {
      throw new ProjectStorageError('BAD_REQUEST', taskStatusText
        ? `${stepLabel}生成未返回可展示结果：${taskStatusText}`
        : `${stepLabel}生成未返回可展示结果`);
    }
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
        statusText: hasSceneInsertPlan
          ? `已准备插入 ${Array.isArray(sceneInsertPlan.items) ? sceneInsertPlan.items.length : 0} 个场景对象，请确认后应用`
          : taskStatusText
            ? taskStatusText
            : nextImages.length > 0
            ? `已生成 ${nextImages.length} 张${stepLabel}`
            : '重试完成，未返回新图片',
        statusId: 'done',
        value: 1,
        indeterminate: false,
        ...(hasSceneInsertPlan ? { sceneInsertPlan } : {}),
      },
      stepState,
    };
  }

  async sendMessageStream(
    input: CodexAgentMessageInput,
    callbacks: CodexAgentMessageStreamCallbacks = {},
  ): Promise<CodexAgentMessageResult> {
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
      const imagePrompt = organizeSceneImagePrompt(scenePrompt);
      let result: Record<string, unknown>;
      try {
        result = await generateMainImage({
          projectRoot: env.projectDir,
          projectId: input.projectId,
          prompt: imagePrompt,
          draws: 1,
          runLabel: sceneRunLabel(scenePrompt),
          apiConfig: resolveMainImageApiConfig(),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const task: CodexAgentTaskState = {
          started: true,
          title: '主图生成',
          progress: 1,
          statusText: message,
          statusId: 'failed',
          events: [],
        };
        await callbacks.onTask?.(task);
        return {
          conversationId,
          threadId: `direct:${conversationId}:scene`,
          finalText: `场景构建主图阶段失败：${message}。请检查配置后重试或取消。`,
          events: [],
          task,
          images: [],
        };
      }
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
        title: typeof taskPayload.title === 'string' ? taskPayload.title : '场景构建',
        progress: clampProgress(taskPayload.progress ?? 1),
        statusText: typeof taskPayload.message === 'string' ? `${taskPayload.message}，请检查主图并选择应用、重试或取消` : `已生成 ${images.length} 张主图，请检查并选择应用、重试或取消`,
        statusId: 'done',
        events: [],
      };
      await callbacks.onTask?.(task);
      return {
        conversationId,
        threadId: `direct:${conversationId}:scene`,
        finalText: images.length > 0
          ? `场景构建已完成主图阶段。请检查当前结果，并选择应用进入下一阶段、重试当前阶段或取消。`
          : '场景构建主图阶段完成，但没有返回图片。请重试或取消。',
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

    const streamedEvents: CodexAgentEvent[] = [];
    const { stdout } = await runCodexExec({
      projectDir: env.projectDir,
      codexHome: env.codexHome,
      childEnv: env.childEnv,
      prompt,
      threadId: previousThreadId || undefined,
      sandbox,
      onEvent: (event) => {
        streamedEvents.push(event);
        void callbacks.onEvent?.(event);
        const task = extractCodexTaskState(streamedEvents);
        if (task.started) {
          void callbacks.onTask?.(task);
        }
      },
    });
    const parsed = parseCodexExecJsonl(stdout);
    const task = extractCodexTaskState(parsed.events);
    if (!task.statusId) {
      task.statusId = 'done';
    }
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

  async sendMessage(input: CodexAgentMessageInput): Promise<CodexAgentMessageResult> {
    return this.sendMessageStream(input);
  }
}
