import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

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

const PROJECT_METADATA_FILE = 'project.json';
const SCENE_FILE = 'scene.json';
const AGENT_HISTORY_FILE = 'agent_history.json';
const PROJECT_SCHEMA = 'visionary.project';
const MAX_NAME_LENGTH = 96;
const MAX_USER_LENGTH = 64;

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

async function writeJsonStaged(projectDir: string, fileName: string, payload: unknown): Promise<void> {
  const tmpPath = path.join(projectDir, `${fileName}.tmp`);
  const finalPath = path.join(projectDir, fileName);
  debugStorage('writeJsonStaged:start', { tmpPath, finalPath });
  await writeJsonFile(tmpPath, payload);
  await copyFile(tmpPath, finalPath);
  debugStorage('writeJsonStaged:complete', { tmpPath, finalPath });
}

export class ProjectStorage {
  readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  async ensureRoot(): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
  }

  async createProject(input: CreateProjectInput): Promise<ProjectMetadata> {
    const { user, userId } = normalizeUserIdentity(input.user);
    const { name, projectId } = normalizeProjectName(input.name);
    const userDir = this.getUserDir(userId);
    const projectDir = this.getProjectDir(userId, projectId);

    await this.ensureRoot();
    await mkdir(userDir, { recursive: true });
    await this.assertProjectNameAvailable(userId, name);

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
    };

    await mkdir(path.join(projectDir, 'assets'), { recursive: true });
    await mkdir(path.join(projectDir, 'agent_history'), { recursive: true });
    await writeJsonFile(path.join(projectDir, PROJECT_METADATA_FILE), metadata);

    if (input.scene !== undefined) {
      await this.saveScene({ user, projectId, payload: input.scene });
    }
    if (input.agentHistory !== undefined) {
      await this.saveAgentHistory({ user, projectId, payload: input.agentHistory });
    }

    return this.readProjectMetadata(userId, projectId);
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
    const metadata = await this.readProjectMetadata(userId, projectId);
    const projectDir = this.getProjectDir(userId, projectId);
    return {
      ...metadata,
      hasScene: await pathExists(path.join(projectDir, SCENE_FILE)),
      hasAgentHistory: await pathExists(path.join(projectDir, AGENT_HISTORY_FILE)),
    };
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
    await this.assertProjectExists(userId, projectId);

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
      await this.touchProject(userId, projectId);
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
    await this.assertProjectExists(userId, projectId);

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
    await this.assertProjectExists(userId, projectId);

    const projectDir = this.getProjectDir(userId, projectId);
    return {
      scene: await this.listRelativeFiles(path.join(projectDir, 'assets'), 'assets'),
      agent: await this.listRelativeFiles(path.join(projectDir, 'agent_history'), 'agent_history'),
    };
  }

  async deleteProject(userInput: string, projectIdInput: string): Promise<{ userId: string; projectId: string }> {
    const { userId } = normalizeUserIdentity(userInput);
    const projectId = assertSafeSegment(projectIdInput, 'project id');
    await this.assertProjectExists(userId, projectId);

    await rm(this.getProjectDir(userId, projectId), { recursive: true, force: true });
    return {
      userId,
      projectId,
    };
  }

  async deleteUser(userInput: string): Promise<{ userId: string }> {
    const { userId } = normalizeUserIdentity(userInput);
    const userDir = this.getUserDir(userId);
    if (!(await pathExists(userDir))) {
      throw new ProjectStorageError('NOT_FOUND', 'user not found');
    }

    await rm(userDir, { recursive: true, force: true });
    return {
      userId,
    };
  }

  private async saveProjectJson(input: SaveProjectJsonInput, fileName: string): Promise<ProjectMetadata> {
    const { userId } = normalizeUserIdentity(input.user);
    const projectId = assertSafeSegment(input.projectId, 'project id');
    await this.assertProjectExists(userId, projectId);

    const projectDir = this.getProjectDir(userId, projectId);
    debugStorage('saveProjectJson:start', {
      userId,
      projectId,
      fileName,
    });
    await writeJsonStaged(projectDir, fileName, input.payload);
    debugStorage('saveProjectJson:complete', {
      userId,
      projectId,
      fileName,
    });
    return this.touchProject(userId, projectId);
  }

  private async readProjectJson(userInput: string, projectIdInput: string, fileName: string): Promise<unknown> {
    const { userId } = normalizeUserIdentity(userInput);
    const projectId = assertSafeSegment(projectIdInput, 'project id');
    await this.assertProjectExists(userId, projectId);

    const targetPath = path.join(this.getProjectDir(userId, projectId), fileName);
    if (!(await pathExists(targetPath))) {
      throw new ProjectStorageError('NOT_FOUND', `${fileName} not found`);
    }
    return readJsonFile(targetPath);
  }

  private async assertProjectNameAvailable(userId: string, name: string): Promise<void> {
    const existingProjects = await this.listProjectsByUserId(userId);
    const normalizedName = name.toLocaleLowerCase();
    if (existingProjects.some((project) => project.name.toLocaleLowerCase() === normalizedName)) {
      throw new ProjectStorageError('CONFLICT', 'project name already exists for this user');
    }
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
        projects.push(await this.readProjectMetadata(userId, entry.name));
      } catch {
        continue;
      }
    }
    return projects;
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

  private async assertProjectExists(userId: string, projectId: string): Promise<void> {
    const metadataPath = path.join(this.getProjectDir(userId, projectId), PROJECT_METADATA_FILE);
    if (!(await pathExists(metadataPath))) {
      throw new ProjectStorageError('NOT_FOUND', 'project not found');
    }
  }

  private async readProjectMetadata(userId: string, projectIdInput: string): Promise<ProjectMetadata> {
    const projectId = assertSafeSegment(projectIdInput, 'project id');
    const metadataPath = path.join(this.getProjectDir(userId, projectId), PROJECT_METADATA_FILE);
    if (!(await pathExists(metadataPath))) {
      throw new ProjectStorageError('NOT_FOUND', 'project not found');
    }
    const metadata = await readJsonFile<ProjectMetadata>(metadataPath);
    if (metadata.schema !== PROJECT_SCHEMA || metadata.version !== 1 || metadata.id !== projectId) {
      throw new ProjectStorageError('BAD_REQUEST', 'project metadata is invalid');
    }
    return metadata;
  }

  private async touchProject(userId: string, projectId: string): Promise<ProjectMetadata> {
    const metadata = await this.readProjectMetadata(userId, projectId);
    const nextMetadata = {
      ...metadata,
      updatedAt: nowIso(),
    };
    await writeJsonFile(path.join(this.getProjectDir(userId, projectId), PROJECT_METADATA_FILE), nextMetadata);
    return nextMetadata;
  }

  private getUserDir(userId: string): string {
    return path.join(this.rootDir, assertSafeSegment(userId, 'user id'));
  }

  private getProjectDir(userId: string, projectId: string): string {
    return path.join(this.getUserDir(userId), assertSafeSegment(projectId, 'project id'));
  }
}

export function resolveProjectStorageRoot(env: Record<string, string | undefined> = process.env): string {
  return path.resolve(env.VISIONARY_PROJECT_STORAGE_DIR || '.visionary-projects');
}
