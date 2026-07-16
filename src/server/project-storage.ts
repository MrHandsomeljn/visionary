import { createHash } from 'node:crypto';
import { chmod, copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  defaultUserApiConfig,
  normalizeUserApiConfig,
  type UserApiConfig,
  UserApiConfigValidationError,
} from './components-3d-config.ts';

export type ProjectStorageErrorCode =
  | 'BAD_REQUEST'
  | 'CONFLICT'
  | 'NOT_FOUND'
  | 'FORBIDDEN';

export class ProjectStorageError extends Error {
  readonly code: ProjectStorageErrorCode;
  readonly status: number;

  constructor(code: ProjectStorageErrorCode, message: string) {
    super(message);
    this.name = 'ProjectStorageError';
    this.code = code;
    this.status = code === 'BAD_REQUEST'
      ? 400
      : code === 'CONFLICT'
        ? 409
        : code === 'NOT_FOUND'
          ? 404
          : 403;
  }
}

export interface ProjectMetadata {
  schema: 'visionary.project';
  version: 1;
  id: string;
  name: string;
  user: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  sizeBytes: number;
  lifecycleState?: ProjectLifecycleState;
  trashedAt?: string;
  purgeAfter?: string;
  deletingAt?: string;
}

export interface ProjectSummary extends ProjectMetadata {
  hasScene: boolean;
  hasAgentHistory: boolean;
}

export interface UserSummary {
  user: string;
  userId: string;
  projectCount: number;
  updatedAt: string;
}

export interface CreateProjectInput {
  user: string;
  name: string;
  scene?: unknown;
  agentHistory?: unknown;
}

export interface ValidateProjectNameInput {
  user: string;
  name: string;
}

export interface ProjectNameValidationResult {
  user: string;
  userId: string;
  name: string;
  projectId: string;
  available: true;
  hasTrashedBackup: boolean;
}

export interface RenameProjectInput {
  user: string;
  projectId: string;
  name: string;
}

export interface SaveProjectJsonInput {
  user: string;
  projectId: string;
  payload: unknown;
}

export interface ProjectAssetInput {
  user: string;
  projectId: string;
  relativePath: string;
  content: Uint8Array | Buffer;
}

export interface ProjectAssetWriteResult {
  path: string;
  bytes: number;
  skipped: boolean;
}

export interface ProjectAssetIndex {
  scene: string[];
  agent: string[];
}

export interface SaveUserCodexAuthInput {
  user: string;
  apiKey: string;
}

export interface UserCodexAuthStatus {
  user: string;
  userId: string;
  hasAuth: boolean;
  projectCount: number;
}

export interface SaveUserApiConfigInput {
  user: string;
  config: unknown;
}

export type ProjectLifecycleState = 'active' | 'trashed' | 'deleting';
export type ProjectDeletionQueueState = 'trashed' | 'deleting';

export interface ProjectDeletionQueueEntry {
  schema: 'visionary.project.deletion';
  version: 1;
  userId: string;
  projectId: string;
  trashedDirName: string;
  requestedAt: string;
  trashedAt: string;
  purgeAfter: string;
  state: ProjectDeletionQueueState;
  deletingAt?: string;
  lastError?: string;
  retryCount?: number;
  updatedAt: string;
}

export interface ProjectDeleteResult {
  userId: string;
  projectId: string;
  lifecycleState: ProjectLifecycleState;
  purgeAfter: string;
}

export interface ProjectDeletionSweepResult {
  scanned: number;
  skipped: number;
  deleted: number;
  failed: number;
}

export interface ProjectStorageOptions {
  deletionRetentionMs?: number;
  deletionSweepIntervalMs?: number;
}

const PROJECT_METADATA_FILE = 'project.json';
const SCENE_FILE = 'scene.json';
const AGENT_HISTORY_FILE = 'agent_history.json';
const USER_CODEX_AUTH_FILE = 'codex_auth.json';
const USER_API_CONFIG_FILE = 'api_config.json';
const CODEX_HOME_DIR = 'codex_home';
const CODEX_AUTH_FILE = 'auth.json';
const PROJECT_SCHEMA = 'visionary.project';
const PROJECT_DELETION_SCHEMA = 'visionary.project.deletion';
const PROJECT_DELETION_QUEUE_DIR = '.deletion-queue';
const PROJECT_TRASH_SUFFIX = '.bak';
const DEFAULT_PROJECT_DELETION_RETENTION_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PROJECT_DELETION_SWEEP_INTERVAL_MS = 60 * 1000;
const MAX_NAME_LENGTH = 96;
const MAX_USER_LENGTH = 64;
const MAX_CODEX_API_KEY_LENGTH = 4096;

function debugStorage(message: string, details?: unknown): void {
  if (details !== undefined) {
    console.debug(`[ProjectStorage] ${message}`, details);
    return;
  }
  console.debug(`[ProjectStorage] ${message}`);
}

function nowIso(): string {
  return new Date().toISOString();
}

function addMillisecondsIso(base: Date, milliseconds: number): string {
  return new Date(base.getTime() + milliseconds).toISOString();
}

function normalizeNonNegativeMilliseconds(value: unknown, fallback: number): number {
  const milliseconds = Number(value);
  return Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : fallback;
}

function normalizePositiveMilliseconds(value: unknown, fallback: number): number {
  const milliseconds = Number(value);
  return Number.isFinite(milliseconds) ? Math.max(1000, milliseconds) : fallback;
}

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 10);
}

function toSlug(value: string, fallback: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || fallback;
}

function validateDisplayValue(value: string, field: string, maxLength: number): string {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new ProjectStorageError('BAD_REQUEST', `${field} is required`);
  }
  if (normalized.length > maxLength) {
    throw new ProjectStorageError('BAD_REQUEST', `${field} must be ${maxLength} characters or less`);
  }
  if (/[\u0000-\u001f<>:"|?*\\]/.test(normalized) || normalized.includes('/')) {
    throw new ProjectStorageError('BAD_REQUEST', `${field} contains unsupported characters`);
  }
  return normalized;
}

export function normalizeUserIdentity(user: string): { user: string; userId: string } {
  const normalizedUser = validateDisplayValue(user, 'user', MAX_USER_LENGTH);
  return {
    user: normalizedUser,
    userId: `${toSlug(normalizedUser, 'user')}-${shortHash(normalizedUser)}`,
  };
}

export function normalizeProjectName(name: string): { name: string; projectId: string } {
  const normalizedName = validateDisplayValue(name, 'project name', MAX_NAME_LENGTH);
  return {
    name: normalizedName,
    projectId: `${toSlug(normalizedName, 'project')}-${shortHash(normalizedName)}`,
  };
}

function assertSafeSegment(value: string, field: string): string {
  const normalized = String(value || '').trim();
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(normalized)) {
    throw new ProjectStorageError('BAD_REQUEST', `${field} is invalid`);
  }
  return normalized;
}

function isSafeSegment(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(String(value || '').trim());
}

function buildDefaultTrashedProjectDirName(projectId: string): string {
  return `${assertSafeSegment(projectId, 'project id')}${PROJECT_TRASH_SUFFIX}`;
}

function buildTimestampedTrashedProjectDirName(projectId: string, timestamp: Date, attempt = 0): string {
  const suffix = timestamp.getTime().toString(36);
  return `${assertSafeSegment(projectId, 'project id')}-${suffix}${attempt > 0 ? `-${attempt}` : ''}${PROJECT_TRASH_SUFFIX}`;
}

function isTrashedProjectDirName(value: string): boolean {
  const normalized = String(value || '').trim();
  return normalized.endsWith(PROJECT_TRASH_SUFFIX)
    && !normalized.includes('/')
    && !normalized.includes('\\')
    && !normalized.includes('\0')
    && normalized.length > PROJECT_TRASH_SUFFIX.length;
}

function normalizeProjectLifecycleState(value: unknown): ProjectLifecycleState {
  if (value === undefined || value === null || value === '') return 'active';
  if (value === 'active' || value === 'trashed' || value === 'deleting') return value;
  throw new ProjectStorageError('BAD_REQUEST', 'project lifecycle state is invalid');
}

function isProjectMetadataActive(metadata: ProjectMetadata): boolean {
  return normalizeProjectLifecycleState(metadata.lifecycleState) === 'active';
}

function parseIsoTime(value: string | undefined): number {
  const time = Date.parse(String(value || ''));
  return Number.isFinite(time) ? time : 0;
}

function normalizeDeletionQueueState(value: unknown): ProjectDeletionQueueState {
  if (value === 'trashed' || value === 'deleting') return value;
  throw new ProjectStorageError('BAD_REQUEST', 'project deletion queue state is invalid');
}

function normalizeRelativeFilePath(relativePath: string): string {
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('\0')) {
    throw new ProjectStorageError('BAD_REQUEST', 'relative file path is required');
  }
  if (path.posix.isAbsolute(normalized) || normalized.split('/').some((part) => part === '..' || part === '')) {
    throw new ProjectStorageError('FORBIDDEN', 'relative file path must stay inside the project');
  }
  if (!normalized.startsWith('assets/') && !normalized.startsWith('agent_history/')) {
    throw new ProjectStorageError('BAD_REQUEST', 'relative file path must start with assets/ or agent_history/');
  }
  return normalized;
}

function normalizeCodexApiKey(apiKey: string): string {
  const normalized = String(apiKey || '').trim();
  if (!normalized) {
    throw new ProjectStorageError('BAD_REQUEST', 'codex api key is required');
  }
  if (normalized.length > MAX_CODEX_API_KEY_LENGTH || /[\u0000-\u001f]/.test(normalized)) {
    throw new ProjectStorageError('BAD_REQUEST', 'codex api key is invalid');
  }
  return normalized;
}

function buildCodexAuthPayload(apiKey: string): Record<string, string> {
  return {
    OPENAI_API_KEY: normalizeCodexApiKey(apiKey),
  };
}

function normalizeCodexAuthPayload(payload: Record<string, unknown>): Record<string, string> {
  const openAiApiKey = payload.OPENAI_API_KEY;
  if (typeof openAiApiKey === 'string' && openAiApiKey.trim()) {
    return buildCodexAuthPayload(openAiApiKey);
  }
  const codexApiKey = payload.CODEX_API_KEY;
  if (typeof codexApiKey === 'string' && codexApiKey.trim()) {
    return buildCodexAuthPayload(codexApiKey);
  }
  throw new ProjectStorageError('BAD_REQUEST', 'codex auth payload is invalid');
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(targetPath: string): Promise<T> {
  const raw = await readFile(targetPath, 'utf8');
  return JSON.parse(raw) as T;
}

async function writeJsonFile(targetPath: string, payload: unknown): Promise<void> {
  debugStorage('writeJsonFile:start', { targetPath });
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  debugStorage('writeJsonFile:complete', { targetPath });
}

function getJsonPayloadByteLength(payload: unknown): number {
  return Buffer.byteLength(`${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function getFileSize(targetPath: string): Promise<number> {
  try {
    const info = await stat(targetPath);
    return info.isFile() ? info.size : 0;
  } catch {
    return 0;
  }
}

async function writeJsonStaged(projectDir: string, fileName: string, payload: unknown): Promise<number> {
  const tmpPath = path.join(projectDir, `${fileName}.tmp`);
  const finalPath = path.join(projectDir, fileName);
  debugStorage('writeJsonStaged:start', { tmpPath, finalPath });
  await writeJsonFile(tmpPath, payload);
  await copyFile(tmpPath, finalPath);
  debugStorage('writeJsonStaged:complete', { tmpPath, finalPath });
  return getJsonPayloadByteLength(payload);
}

export class ProjectStorage {
  readonly rootDir: string;
  readonly deletionRetentionMs: number;
  readonly deletionSweepIntervalMs: number;
  private readonly deletingProjectKeys = new Set<string>();

  constructor(rootDir: string, options: ProjectStorageOptions = {}) {
    this.rootDir = path.resolve(rootDir);
    this.deletionRetentionMs = normalizeNonNegativeMilliseconds(
      options.deletionRetentionMs,
      DEFAULT_PROJECT_DELETION_RETENTION_MS,
    );
    this.deletionSweepIntervalMs = normalizePositiveMilliseconds(
      options.deletionSweepIntervalMs,
      DEFAULT_PROJECT_DELETION_SWEEP_INTERVAL_MS,
    );
  }

  async ensureRoot(): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
  }

  async createProject(input: CreateProjectInput): Promise<ProjectMetadata> {
    const validation = await this.validateProjectNameAvailability({
      user: input.user,
      name: input.name,
    });
    const { user, userId, name, projectId } = validation;
    const userDir = this.getUserDir(userId);
    const projectDir = this.getProjectDir(userId, projectId);

    await this.ensureRoot();
    await mkdir(userDir, { recursive: true });

    if (await pathExists(projectDir)) {
      throw new ProjectStorageError('CONFLICT', 'project already exists');
    }

    const timestamp = nowIso();
    const metadata: ProjectMetadata = {
      schema: PROJECT_SCHEMA,
      version: 1,
      id: projectId,
      name,
      user,
      userId,
      createdAt: timestamp,
      updatedAt: timestamp,
      sizeBytes: 0,
      lifecycleState: 'active',
    };

    await mkdir(path.join(projectDir, 'assets'), { recursive: true });
    await mkdir(path.join(projectDir, 'agent_history'), { recursive: true });
    await writeJsonFile(path.join(projectDir, PROJECT_METADATA_FILE), metadata);
    await this.syncProjectCodexAuthFromUser(userId, projectId);

    if (input.scene !== undefined) {
      await this.saveScene({ user, projectId, payload: input.scene });
    }
    if (input.agentHistory !== undefined) {
      await this.saveAgentHistory({ user, projectId, payload: input.agentHistory });
    }

    return this.readProjectMetadata(userId, projectId);
  }

  async validateProjectNameAvailability(input: ValidateProjectNameInput): Promise<ProjectNameValidationResult> {
    const { user, userId } = normalizeUserIdentity(input.user);
    const { name, projectId } = normalizeProjectName(input.name);
    await this.ensureRoot();
    await this.assertProjectNameAvailable(userId, name);
    const projectDir = this.getProjectDir(userId, projectId);
    if (await pathExists(projectDir)) {
      throw new ProjectStorageError('CONFLICT', 'project already exists');
    }
    return {
      user,
      userId,
      name,
      projectId,
      available: true,
      hasTrashedBackup: await this.hasTrashedProjectBackup(userId, projectId),
    };
  }

  async listProjects(userInput: string): Promise<ProjectSummary[]> {
    const { userId } = normalizeUserIdentity(userInput);
    const userDir = this.getUserDir(userId);
    if (!(await pathExists(userDir))) {
      return [];
    }

    const entries = await readdir(userDir, { withFileTypes: true });
    const projects: ProjectSummary[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      try {
        const metadata = await this.readProjectMetadata(userId, entry.name);
        if (!isProjectMetadataActive(metadata)) {
          continue;
        }
        projects.push({
          ...metadata,
          hasScene: await pathExists(path.join(this.getProjectDir(userId, entry.name), SCENE_FILE)),
          hasAgentHistory: await pathExists(path.join(this.getProjectDir(userId, entry.name), AGENT_HISTORY_FILE)),
        });
      } catch {
        continue;
      }
    }

    return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async listUsers(): Promise<UserSummary[]> {
    await this.ensureRoot();
    const entries = await readdir(this.rootDir, { withFileTypes: true });
    const users: UserSummary[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (entry.name === PROJECT_DELETION_QUEUE_DIR || !isSafeSegment(entry.name)) {
        continue;
      }
      const userId = entry.name;
      const projects = await this.listProjectsByUserId(userId);
      if (projects.length === 0) {
        continue;
      }
      const latestUpdatedAt = projects
        .map((project) => project.updatedAt)
        .sort((a, b) => b.localeCompare(a))[0] || nowIso();
      users.push({
        user: projects[0]?.user || userId,
        userId,
        projectCount: projects.length,
        updatedAt: latestUpdatedAt,
      });
    }

    return users.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getProject(userInput: string, projectIdInput: string): Promise<ProjectSummary> {
    const { userId } = normalizeUserIdentity(userInput);
    const projectId = assertSafeSegment(projectIdInput, 'project id');
    const metadata = await this.readActiveProjectMetadata(userId, projectId);
    const projectDir = this.getProjectDir(userId, projectId);
    return {
      ...metadata,
      hasScene: await pathExists(path.join(projectDir, SCENE_FILE)),
      hasAgentHistory: await pathExists(path.join(projectDir, AGENT_HISTORY_FILE)),
    };
  }

  async resolveProjectDir(userInput: string, projectIdInput: string): Promise<string> {
    const { userId } = normalizeUserIdentity(userInput);
    const projectId = assertSafeSegment(projectIdInput, 'project id');
    await this.assertActiveProjectExists(userId, projectId);
    return this.getProjectDir(userId, projectId);
  }

  async readProjectCodexApiKey(userInput: string, projectIdInput: string): Promise<string> {
    const { userId } = normalizeUserIdentity(userInput);
    const projectId = assertSafeSegment(projectIdInput, 'project id');
    await this.assertActiveProjectExists(userId, projectId);
    const authPath = path.join(this.getProjectDir(userId, projectId), CODEX_HOME_DIR, CODEX_AUTH_FILE);
    if (!(await pathExists(authPath))) return '';
    const payload = normalizeCodexAuthPayload(await readJsonFile<Record<string, unknown>>(authPath));
    return payload.OPENAI_API_KEY || payload.CODEX_API_KEY || '';
  }

  async saveScene(input: SaveProjectJsonInput): Promise<ProjectMetadata> {
    return this.saveProjectJson(input, SCENE_FILE);
  }

  async readScene(userInput: string, projectIdInput: string): Promise<unknown> {
    return this.readProjectJson(userInput, projectIdInput, SCENE_FILE);
  }

  async saveAgentHistory(input: SaveProjectJsonInput): Promise<ProjectMetadata> {
    return this.saveProjectJson(input, AGENT_HISTORY_FILE);
  }

  async readAgentHistory(userInput: string, projectIdInput: string): Promise<unknown> {
    return this.readProjectJson(userInput, projectIdInput, AGENT_HISTORY_FILE);
  }

  async writeAsset(input: ProjectAssetInput): Promise<ProjectAssetWriteResult> {
    const { userId } = normalizeUserIdentity(input.user);
    const projectId = assertSafeSegment(input.projectId, 'project id');
    await this.assertActiveProjectExists(userId, projectId);

    const relativePath = normalizeRelativeFilePath(input.relativePath);
    const targetPath = path.join(this.getProjectDir(userId, projectId), ...relativePath.split('/'));
    const skipped = await pathExists(targetPath);
    debugStorage('writeAsset:start', {
      userId,
      projectId,
      relativePath,
      targetPath,
      bytes: input.content.byteLength,
      skipped,
    });
    await mkdir(path.dirname(targetPath), { recursive: true });
    if (!skipped) {
      await writeFile(targetPath, input.content);
      await this.touchProject(userId, projectId, { sizeDeltaBytes: input.content.byteLength });
    }
    debugStorage('writeAsset:complete', {
      userId,
      projectId,
      relativePath,
      targetPath,
      bytes: input.content.byteLength,
      skipped,
    });

    return {
      path: relativePath,
      bytes: input.content.byteLength,
      skipped,
    };
  }

  async readAsset(userInput: string, projectIdInput: string, relativePathInput: string): Promise<Buffer> {
    const { userId } = normalizeUserIdentity(userInput);
    const projectId = assertSafeSegment(projectIdInput, 'project id');
    await this.assertActiveProjectExists(userId, projectId);

    const relativePath = normalizeRelativeFilePath(relativePathInput);
    const targetPath = path.join(this.getProjectDir(userId, projectId), ...relativePath.split('/'));
    if (!(await pathExists(targetPath))) {
      throw new ProjectStorageError('NOT_FOUND', 'asset not found');
    }
    return readFile(targetPath);
  }

  async listAssetIndex(userInput: string, projectIdInput: string): Promise<ProjectAssetIndex> {
    const { userId } = normalizeUserIdentity(userInput);
    const projectId = assertSafeSegment(projectIdInput, 'project id');
    await this.assertActiveProjectExists(userId, projectId);

    const projectDir = this.getProjectDir(userId, projectId);
    return {
      scene: await this.listRelativeFiles(path.join(projectDir, 'assets'), 'assets'),
      agent: await this.listRelativeFiles(path.join(projectDir, 'agent_history'), 'agent_history'),
    };
  }

  async getUserCodexAuthStatus(userInput: string): Promise<UserCodexAuthStatus> {
    const { user, userId } = normalizeUserIdentity(userInput);
    const projects = await this.listProjectsByUserId(userId);
    return {
      user,
      userId,
      hasAuth: Boolean(await this.readUserCodexAuthPayload(userId)),
      projectCount: projects.length,
    };
  }

  async saveUserCodexAuth(input: SaveUserCodexAuthInput): Promise<UserCodexAuthStatus> {
    const { user, userId } = normalizeUserIdentity(input.user);
    const authPayload = buildCodexAuthPayload(input.apiKey);
    const userDir = this.getUserDir(userId);
    await this.ensureRoot();
    await mkdir(userDir, { recursive: true });

    const previousConfig = await this.getUserApiConfig(user).catch(() => defaultUserApiConfig(user, userId));
    const nextConfig = normalizeUserApiConfig(
      {
        ...previousConfig,
        codex: {
          apiKey: authPayload.OPENAI_API_KEY,
        },
      },
      user,
      userId,
      previousConfig,
    );
    await writeJsonFile(this.getUserApiConfigPath(userId), nextConfig);
    await chmod(this.getUserApiConfigPath(userId), 0o600);

    await writeJsonFile(this.getUserCodexAuthPath(userId), authPayload);
    await chmod(this.getUserCodexAuthPath(userId), 0o600);

    const projects = await this.listProjectsByUserId(userId);
    for (const project of projects) {
      await this.writeProjectCodexAuth(userId, project.id, authPayload);
    }

    return {
      user,
      userId,
      hasAuth: true,
      projectCount: projects.length,
    };
  }

  async getUserApiConfig(userInput: string): Promise<UserApiConfig> {
    const { user, userId } = normalizeUserIdentity(userInput);
    const configPath = this.getUserApiConfigPath(userId);
    const legacyCodexAuth = await this.readLegacyUserCodexAuthPayload(userId);
    const previous = legacyCodexAuth
      ? {
        ...defaultUserApiConfig(user, userId),
        codex: {
          apiKey: legacyCodexAuth.OPENAI_API_KEY,
        },
      }
      : undefined;
    if (!(await pathExists(configPath))) {
      return previous || defaultUserApiConfig(user, userId);
    }
    try {
      return normalizeUserApiConfig(await readJsonFile<unknown>(configPath), user, userId, previous);
    } catch (error) {
      if (error instanceof UserApiConfigValidationError) {
        throw new ProjectStorageError('BAD_REQUEST', error.message);
      }
      throw error;
    }
  }

  async saveUserApiConfig(input: SaveUserApiConfigInput): Promise<UserApiConfig> {
    const { user, userId } = normalizeUserIdentity(input.user);
    let config: UserApiConfig;
    try {
      const previousConfig = await this.getUserApiConfig(user).catch(() => defaultUserApiConfig(user, userId));
      config = normalizeUserApiConfig(input.config, user, userId, previousConfig);
    } catch (error) {
      if (error instanceof UserApiConfigValidationError) {
        throw new ProjectStorageError('BAD_REQUEST', error.message);
      }
      throw error;
    }
    const userDir = this.getUserDir(userId);
    await this.ensureRoot();
    await mkdir(userDir, { recursive: true });
    await writeJsonFile(this.getUserApiConfigPath(userId), config);
    await chmod(this.getUserApiConfigPath(userId), 0o600);
    if (config.codex.apiKey) {
      const authPayload = buildCodexAuthPayload(config.codex.apiKey);
      await writeJsonFile(this.getUserCodexAuthPath(userId), authPayload);
      await chmod(this.getUserCodexAuthPath(userId), 0o600);
      const projects = await this.listProjectsByUserId(userId);
      for (const project of projects) {
        await this.writeProjectCodexAuth(userId, project.id, authPayload);
      }
    }
    return config;
  }

  async deleteProject(userInput: string, projectIdInput: string): Promise<ProjectDeleteResult> {
    const { userId } = normalizeUserIdentity(userInput);
    const projectId = assertSafeSegment(projectIdInput, 'project id');
    let metadata: ProjectMetadata;
    try {
      metadata = await this.readProjectMetadata(userId, projectId);
    } catch (error) {
      if (error instanceof ProjectStorageError && error.code === 'NOT_FOUND') {
        const existingEntry = await this.findLatestDeletionQueueEntry(userId, projectId);
        if (existingEntry) {
          return {
            userId,
            projectId,
            lifecycleState: existingEntry.state === 'deleting' ? 'deleting' : 'trashed',
            purgeAfter: existingEntry.purgeAfter,
          };
        }
      }
      throw error;
    }
    const lifecycleState = normalizeProjectLifecycleState(metadata.lifecycleState);
    const timestamp = new Date();
    const timestampIso = timestamp.toISOString();
    const trashedAt = metadata.trashedAt || timestampIso;
    const purgeAfter = metadata.purgeAfter || addMillisecondsIso(timestamp, this.deletionRetentionMs);
    const nextLifecycleState: ProjectLifecycleState = lifecycleState === 'deleting' ? 'deleting' : 'trashed';
    const trashedDirName = await this.resolveAvailableTrashedProjectDirName(userId, projectId, timestamp);
    const activeProjectDir = this.getProjectDir(userId, projectId);
    const trashedProjectDir = this.getTrashedProjectDir(userId, trashedDirName);

    const nextMetadata: ProjectMetadata = {
      ...metadata,
      lifecycleState: nextLifecycleState,
      trashedAt,
      purgeAfter,
      updatedAt: timestampIso,
      ...(nextLifecycleState === 'deleting' && metadata.deletingAt ? { deletingAt: metadata.deletingAt } : {}),
    };
    await rename(activeProjectDir, trashedProjectDir);
    await writeJsonFile(path.join(trashedProjectDir, PROJECT_METADATA_FILE), nextMetadata);
    await this.writeDeletionQueueEntry({
      schema: PROJECT_DELETION_SCHEMA,
      version: 1,
      userId,
      projectId,
      trashedDirName,
      requestedAt: timestampIso,
      trashedAt,
      purgeAfter,
      state: nextLifecycleState === 'deleting' ? 'deleting' : 'trashed',
      ...(metadata.deletingAt ? { deletingAt: metadata.deletingAt } : {}),
      updatedAt: timestampIso,
    });
    return {
      userId,
      projectId,
      lifecycleState: nextLifecycleState,
      purgeAfter,
    };
  }

  async renameProject(input: RenameProjectInput): Promise<ProjectMetadata> {
    const { user, userId } = normalizeUserIdentity(input.user);
    const currentProjectId = assertSafeSegment(input.projectId, 'project id');
    const currentMetadata = await this.readActiveProjectMetadata(userId, currentProjectId);
    const { name, projectId: nextProjectId } = normalizeProjectName(input.name);

    if (name === currentMetadata.name && nextProjectId === currentProjectId) {
      return currentMetadata;
    }

    await this.assertProjectNameAvailable(userId, name, currentProjectId);

    const currentProjectDir = this.getProjectDir(userId, currentProjectId);
    const nextProjectDir = this.getProjectDir(userId, nextProjectId);
    if (nextProjectId !== currentProjectId && await pathExists(nextProjectDir)) {
      throw new ProjectStorageError('CONFLICT', 'project already exists');
    }

    const nextMetadata: ProjectMetadata = {
      ...currentMetadata,
      id: nextProjectId,
      name,
      user,
      userId,
      updatedAt: nowIso(),
    };

    if (nextProjectId !== currentProjectId) {
      await rename(currentProjectDir, nextProjectDir);
    }
    await writeJsonFile(path.join(nextProjectDir, PROJECT_METADATA_FILE), nextMetadata);
    return this.readProjectMetadata(userId, nextProjectId);
  }

  async deleteUser(userInput: string): Promise<{ userId: string }> {
    const { userId } = normalizeUserIdentity(userInput);
    const userDir = this.getUserDir(userId);
    if (!(await pathExists(userDir))) {
      throw new ProjectStorageError('NOT_FOUND', 'user not found');
    }

    await rm(userDir, { recursive: true, force: true });
    await rm(this.getDeletionQueueUserDir(userId), { recursive: true, force: true });
    return {
      userId,
    };
  }

  startProjectDeletionSweeper(intervalMs = this.deletionSweepIntervalMs): () => void {
    const normalizedIntervalMs = normalizePositiveMilliseconds(intervalMs, this.deletionSweepIntervalMs);
    const timer = setInterval(() => {
      void this.sweepDeletedProjects().catch((error) => {
        console.warn('[ProjectStorage] project deletion sweep failed:', error);
      });
    }, normalizedIntervalMs);
    timer.unref?.();
    return () => clearInterval(timer);
  }

  async sweepDeletedProjects(now = new Date()): Promise<ProjectDeletionSweepResult> {
    const entries = await this.listDeletionQueueEntries();
    const result: ProjectDeletionSweepResult = {
      scanned: entries.length,
      skipped: 0,
      deleted: 0,
      failed: 0,
    };
    const nowTime = now.getTime();

    for (const entry of entries) {
      const purgeAfterTime = parseIsoTime(entry.purgeAfter);
      if (purgeAfterTime > nowTime) {
        result.skipped += 1;
        continue;
      }
      const key = this.getProjectDeletionKey(entry.userId, entry.trashedDirName);
      if (this.deletingProjectKeys.has(key)) {
        result.skipped += 1;
        continue;
      }
      this.deletingProjectKeys.add(key);
      try {
        await this.deleteQueuedProject(entry, now);
        result.deleted += 1;
      } catch (error) {
        result.failed += 1;
        const message = error instanceof Error ? error.message : String(error ?? 'Unknown deletion error');
        await this.writeDeletionQueueEntry({
          ...entry,
          state: 'deleting',
          deletingAt: entry.deletingAt || now.toISOString(),
          lastError: message,
          retryCount: Math.max(0, Number(entry.retryCount || 0)) + 1,
          updatedAt: now.toISOString(),
        });
      } finally {
        this.deletingProjectKeys.delete(key);
      }
    }

    return result;
  }

  private async saveProjectJson(input: SaveProjectJsonInput, fileName: string): Promise<ProjectMetadata> {
    const { userId } = normalizeUserIdentity(input.user);
    const projectId = assertSafeSegment(input.projectId, 'project id');
    await this.assertActiveProjectExists(userId, projectId);

    const projectDir = this.getProjectDir(userId, projectId);
    debugStorage('saveProjectJson:start', {
      userId,
      projectId,
      fileName,
    });
    const previousSizeBytes = await this.getProjectJsonTrackedSize(projectDir, fileName);
    const writtenSizeBytes = await writeJsonStaged(projectDir, fileName, input.payload);
    debugStorage('saveProjectJson:complete', {
      userId,
      projectId,
      fileName,
    });
    return this.touchProject(userId, projectId, {
      sizeDeltaBytes: (writtenSizeBytes * 2) - previousSizeBytes,
    });
  }

  private async readProjectJson(userInput: string, projectIdInput: string, fileName: string): Promise<unknown> {
    const { userId } = normalizeUserIdentity(userInput);
    const projectId = assertSafeSegment(projectIdInput, 'project id');
    await this.assertActiveProjectExists(userId, projectId);

    const targetPath = path.join(this.getProjectDir(userId, projectId), fileName);
    if (!(await pathExists(targetPath))) {
      throw new ProjectStorageError('NOT_FOUND', `${fileName} not found`);
    }
    return readJsonFile(targetPath);
  }

  private async assertProjectNameAvailable(userId: string, name: string, excludeProjectId = ''): Promise<void> {
    const existingProjects = await this.listProjectsByUserId(userId);
    const normalizedName = name.toLocaleLowerCase();
    if (existingProjects.some((project) => (
      project.id !== excludeProjectId
      && project.name.toLocaleLowerCase() === normalizedName
    ))) {
      throw new ProjectStorageError('CONFLICT', 'project name already exists for this user');
    }
  }

  private async hasTrashedProjectBackup(userId: string, projectId: string): Promise<boolean> {
    const userDir = this.getUserDir(userId);
    if (!(await pathExists(userDir))) {
      return false;
    }
    const defaultBackupName = buildDefaultTrashedProjectDirName(projectId);
    if (await pathExists(this.getTrashedProjectDir(userId, defaultBackupName))) {
      return true;
    }
    const entries = await this.listDeletionQueueEntries();
    return entries.some((entry) => entry.userId === userId && entry.projectId === projectId);
  }

  private async resolveAvailableTrashedProjectDirName(
    userId: string,
    projectId: string,
    timestamp: Date,
  ): Promise<string> {
    const defaultName = buildDefaultTrashedProjectDirName(projectId);
    if (!(await pathExists(this.getTrashedProjectDir(userId, defaultName)))) {
      return defaultName;
    }
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidate = buildTimestampedTrashedProjectDirName(projectId, timestamp, attempt);
      if (!(await pathExists(this.getTrashedProjectDir(userId, candidate)))) {
        return candidate;
      }
    }
    throw new ProjectStorageError('CONFLICT', 'project backup already exists');
  }

  private async listProjectsByUserId(userId: string): Promise<ProjectMetadata[]> {
    const userDir = this.getUserDir(userId);
    if (!(await pathExists(userDir))) {
      return [];
    }
    const entries = await readdir(userDir, { withFileTypes: true });
    const projects: ProjectMetadata[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      try {
        const metadata = await this.readProjectMetadata(userId, entry.name);
        if (isProjectMetadataActive(metadata)) {
          projects.push(metadata);
        }
      } catch {
        continue;
      }
    }
    return projects;
  }

  private async syncProjectCodexAuthFromUser(userId: string, projectId: string): Promise<boolean> {
    const authPayload = await this.readUserCodexAuthPayload(userId);
    if (!authPayload) {
      return false;
    }
    await this.writeProjectCodexAuth(userId, projectId, authPayload);
    return true;
  }

  private async readUserCodexAuthPayload(userId: string): Promise<Record<string, string> | null> {
    const apiConfigPath = this.getUserApiConfigPath(userId);
    if (await pathExists(apiConfigPath)) {
      try {
        const config = await readJsonFile<Record<string, unknown>>(apiConfigPath);
        const codex = config.codex && typeof config.codex === 'object' && !Array.isArray(config.codex)
          ? config.codex as Record<string, unknown>
          : {};
        const apiKey = typeof codex.apiKey === 'string' && codex.apiKey.trim()
          ? codex.apiKey
          : typeof codex.CODEX_API_KEY === 'string' && codex.CODEX_API_KEY.trim()
            ? codex.CODEX_API_KEY
            : '';
        if (apiKey) {
          return buildCodexAuthPayload(apiKey);
        }
      } catch {
        // Fall back to the legacy file so old project homes can still sync.
      }
    }
    return this.readLegacyUserCodexAuthPayload(userId);
  }

  private async readLegacyUserCodexAuthPayload(userId: string): Promise<Record<string, string> | null> {
    const authPath = this.getUserCodexAuthPath(userId);
    if (!(await pathExists(authPath))) {
      return null;
    }
    return normalizeCodexAuthPayload(await readJsonFile<Record<string, unknown>>(authPath));
  }

  private async writeProjectCodexAuth(
    userId: string,
    projectId: string,
    authPayload: Record<string, string>,
  ): Promise<void> {
    const authPath = path.join(this.getProjectDir(userId, projectId), CODEX_HOME_DIR, CODEX_AUTH_FILE);
    await writeJsonFile(authPath, authPayload);
    await chmod(authPath, 0o600);
  }

  private async listRelativeFiles(targetDir: string, prefix: string): Promise<string[]> {
    if (!(await pathExists(targetDir))) {
      return [];
    }

    const entries = await readdir(targetDir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const relativePath = path.posix.join(prefix, entry.name);
      const absolutePath = path.join(targetDir, entry.name);
      if (entry.isDirectory()) {
        files.push(...await this.listRelativeFiles(absolutePath, relativePath));
        continue;
      }
      if (entry.isFile()) {
        files.push(relativePath);
      }
    }
    return files.sort();
  }

  private async assertActiveProjectExists(userId: string, projectId: string): Promise<void> {
    await this.readActiveProjectMetadata(userId, projectId);
  }

  private async readActiveProjectMetadata(userId: string, projectId: string): Promise<ProjectMetadata> {
    const metadata = await this.readProjectMetadata(userId, projectId);
    if (!isProjectMetadataActive(metadata)) {
      throw new ProjectStorageError('NOT_FOUND', 'project not found');
    }
    return metadata;
  }

  private async readProjectMetadata(userId: string, projectIdInput: string): Promise<ProjectMetadata> {
    const projectId = assertSafeSegment(projectIdInput, 'project id');
    return this.readProjectMetadataFromDir(userId, projectId, this.getProjectDir(userId, projectId));
  }

  private async readProjectMetadataFromDir(
    userId: string,
    projectIdInput: string,
    projectDir: string,
  ): Promise<ProjectMetadata> {
    assertSafeSegment(userId, 'user id');
    const projectId = assertSafeSegment(projectIdInput, 'project id');
    const metadataPath = path.join(projectDir, PROJECT_METADATA_FILE);
    if (!(await pathExists(metadataPath))) {
      throw new ProjectStorageError('NOT_FOUND', 'project not found');
    }
    const metadata = await readJsonFile<ProjectMetadata>(metadataPath);
    if (metadata.schema !== PROJECT_SCHEMA || metadata.version !== 1 || metadata.id !== projectId) {
      throw new ProjectStorageError('BAD_REQUEST', 'project metadata is invalid');
    }
    const lifecycleState = normalizeProjectLifecycleState(metadata.lifecycleState);
    return {
      ...metadata,
      lifecycleState,
      sizeBytes: Number.isFinite(metadata.sizeBytes) && metadata.sizeBytes > 0
        ? metadata.sizeBytes
        : 0,
    };
  }

  private async touchProject(
    userId: string,
    projectId: string,
    options: { sizeDeltaBytes?: number } = {},
  ): Promise<ProjectMetadata> {
    const metadata = await this.readProjectMetadata(userId, projectId);
    const sizeDeltaBytes = Number(options.sizeDeltaBytes || 0);
    const nextMetadata = {
      ...metadata,
      updatedAt: nowIso(),
      sizeBytes: Math.max(0, Math.round((metadata.sizeBytes || 0) + sizeDeltaBytes)),
    };
    await writeJsonFile(path.join(this.getProjectDir(userId, projectId), PROJECT_METADATA_FILE), nextMetadata);
    return nextMetadata;
  }

  private async deleteQueuedProject(entry: ProjectDeletionQueueEntry, now: Date): Promise<void> {
    const deletingAt = entry.deletingAt || now.toISOString();
    const deletingEntry: ProjectDeletionQueueEntry = {
      ...entry,
      state: 'deleting',
      deletingAt,
      updatedAt: now.toISOString(),
    };
    await this.writeDeletionQueueEntry(deletingEntry);
    await this.markProjectDeleting(entry.userId, entry.projectId, entry.trashedDirName, deletingAt).catch(() => undefined);
    await rm(this.getTrashedProjectDir(entry.userId, entry.trashedDirName), { recursive: true, force: true });
    await this.removeDeletionQueueEntry(entry);
  }

  private async markProjectDeleting(
    userId: string,
    projectId: string,
    trashedDirName: string,
    deletingAt: string,
  ): Promise<void> {
    const projectDir = this.getTrashedProjectDir(userId, trashedDirName);
    const metadata = await this.readProjectMetadataFromDir(userId, projectId, projectDir);
    const nextMetadata: ProjectMetadata = {
      ...metadata,
      lifecycleState: 'deleting',
      deletingAt,
      updatedAt: deletingAt,
    };
    await writeJsonFile(path.join(projectDir, PROJECT_METADATA_FILE), nextMetadata);
  }

  private async listDeletionQueueEntries(): Promise<ProjectDeletionQueueEntry[]> {
    const queueRoot = this.getDeletionQueueDir();
    if (!(await pathExists(queueRoot))) {
      return [];
    }
    const userEntries = await readdir(queueRoot, { withFileTypes: true });
    const entries: ProjectDeletionQueueEntry[] = [];
    for (const userEntry of userEntries) {
      if (!userEntry.isDirectory() || !isSafeSegment(userEntry.name)) {
        continue;
      }
      const userQueueDir = path.join(queueRoot, userEntry.name);
      const queueEntries = await readdir(userQueueDir, { withFileTypes: true });
      for (const queueEntry of queueEntries) {
        if (!queueEntry.isFile() || !queueEntry.name.endsWith('.json')) {
          continue;
        }
        try {
          entries.push(await this.readDeletionQueueEntryFromPath(
            path.join(userQueueDir, queueEntry.name),
            userEntry.name,
          ));
        } catch {
          continue;
        }
      }
    }
    return entries;
  }

  private async findLatestDeletionQueueEntry(userId: string, projectId: string): Promise<ProjectDeletionQueueEntry | null> {
    const entries = (await this.listDeletionQueueEntries())
      .filter((entry) => entry.userId === userId && entry.projectId === projectId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return entries[0] || null;
  }

  private async readDeletionQueueEntryFromPath(
    entryPath: string,
    expectedUserId: string,
  ): Promise<ProjectDeletionQueueEntry> {
    const entry = await readJsonFile<ProjectDeletionQueueEntry>(entryPath);
    const projectId = assertSafeSegment(entry.projectId, 'project id');
    if (
      entry.schema !== PROJECT_DELETION_SCHEMA ||
      entry.version !== 1 ||
      entry.userId !== expectedUserId ||
      !isTrashedProjectDirName(entry.trashedDirName)
    ) {
      throw new ProjectStorageError('BAD_REQUEST', 'project deletion queue entry is invalid');
    }
    return {
      ...entry,
      projectId,
      trashedDirName: entry.trashedDirName,
      state: normalizeDeletionQueueState(entry.state),
      requestedAt: String(entry.requestedAt || entry.trashedAt || nowIso()),
      trashedAt: String(entry.trashedAt || entry.requestedAt || nowIso()),
      purgeAfter: String(entry.purgeAfter || nowIso()),
      updatedAt: String(entry.updatedAt || entry.requestedAt || nowIso()),
      retryCount: Math.max(0, Number(entry.retryCount || 0)),
    };
  }

  private async writeDeletionQueueEntry(entry: ProjectDeletionQueueEntry): Promise<void> {
    assertSafeSegment(entry.userId, 'user id');
    assertSafeSegment(entry.projectId, 'project id');
    if (!isTrashedProjectDirName(entry.trashedDirName)) {
      throw new ProjectStorageError('BAD_REQUEST', 'project trash directory is invalid');
    }
    await writeJsonFile(this.getDeletionQueueEntryPath(entry), entry);
  }

  private async removeDeletionQueueEntry(entry: ProjectDeletionQueueEntry): Promise<void> {
    await rm(this.getDeletionQueueEntryPath(entry), { force: true });
  }

  private getProjectDeletionKey(userId: string, trashedDirName: string): string {
    return `${userId}/${trashedDirName}`;
  }

  private async getProjectJsonTrackedSize(projectDir: string, fileName: string): Promise<number> {
    return (await getFileSize(path.join(projectDir, fileName)))
      + (await getFileSize(path.join(projectDir, `${fileName}.tmp`)));
  }

  private getUserDir(userId: string): string {
    return path.join(this.rootDir, assertSafeSegment(userId, 'user id'));
  }

  private getProjectDir(userId: string, projectId: string): string {
    return path.join(this.getUserDir(userId), assertSafeSegment(projectId, 'project id'));
  }

  private getTrashedProjectDir(userId: string, trashedDirName: string): string {
    if (!isTrashedProjectDirName(trashedDirName)) {
      throw new ProjectStorageError('BAD_REQUEST', 'project trash directory is invalid');
    }
    return path.join(this.getUserDir(userId), trashedDirName);
  }

  private getUserCodexAuthPath(userId: string): string {
    return path.join(this.getUserDir(userId), USER_CODEX_AUTH_FILE);
  }

  private getUserApiConfigPath(userId: string): string {
    return path.join(this.getUserDir(userId), USER_API_CONFIG_FILE);
  }

  private getDeletionQueueDir(): string {
    return path.join(this.rootDir, PROJECT_DELETION_QUEUE_DIR);
  }

  private getDeletionQueueUserDir(userId: string): string {
    return path.join(this.getDeletionQueueDir(), assertSafeSegment(userId, 'user id'));
  }

  private getDeletionQueueEntryPath(entry: ProjectDeletionQueueEntry): string {
    const projectId = assertSafeSegment(entry.projectId, 'project id');
    if (!isTrashedProjectDirName(entry.trashedDirName)) {
      throw new ProjectStorageError('BAD_REQUEST', 'project trash directory is invalid');
    }
    const entryName = `${projectId}-${shortHash(entry.trashedDirName)}`;
    return path.join(this.getDeletionQueueUserDir(entry.userId), `${entryName}.json`);
  }
}

export function resolveProjectStorageRoot(env: Record<string, string | undefined> = process.env): string {
  return path.resolve(env.VISIONARY_PROJECT_STORAGE_DIR || '.visionary-projects');
}
