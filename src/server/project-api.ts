import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PluginOption, ViteDevServer } from 'vite';
import { CodexAgentRuntime } from './codex-agent-runtime.ts';
import { ProjectStorage, ProjectStorageError, resolveProjectStorageRoot } from './project-storage.ts';

interface ProjectApiResponse {
  ok: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

const API_PREFIX = '/api/projects';
const AGENT_STEP_ACTION_PREFIX = '/api/agent/step-action';
const CODEX_AGENT_PREFIX = '/api/codex-agent';
const CODEX_AUTH_PREFIX = '/api/codex-auth';
const ADMIN_USERS_PREFIX = '/api/project-admin/users';
const JSON_BODY_LIMIT_BYTES = 50 * 1024 * 1024;
const BINARY_BODY_LIMIT_BYTES = 512 * 1024 * 1024;

function sendJson(res: ServerResponse, status: number, payload: ProjectApiResponse): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function sendOk(res: ServerResponse, data: unknown, status = 200): void {
  sendJson(res, status, { ok: true, data });
}

function sendError(res: ServerResponse, error: unknown): void {
  if (error instanceof ProjectStorageError) {
    sendJson(res, error.status, {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  sendJson(res, 500, {
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message,
    },
  });
}

function getQueryString(url: URL, key: string): string {
  return String(url.searchParams.get(key) || '').trim();
}

function decodePathPart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function readRequestBuffer(req: IncomingMessage, limitBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > limitBytes) {
      throw new ProjectStorageError('BAD_REQUEST', 'request body is too large');
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const body = await readRequestBuffer(req, JSON_BODY_LIMIT_BYTES);
  if (body.byteLength === 0) {
    return {};
  }
  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    throw new ProjectStorageError('BAD_REQUEST', 'request body must be valid JSON');
  }
}

function readBodyObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ProjectStorageError('BAD_REQUEST', 'request body must be an object');
  }
  return body as Record<string, unknown>;
}

function getBodyString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== 'string') {
    throw new ProjectStorageError('BAD_REQUEST', `${key} is required`);
  }
  return value;
}

function resolveUser(url: URL, body?: Record<string, unknown>): string {
  const bodyUser = body?.user;
  if (typeof bodyUser === 'string' && bodyUser.trim()) {
    return bodyUser;
  }
  return getQueryString(url, 'user');
}

function parseProjectPath(url: URL): { projectId: string | null; action: string | null; filePath: string | null } {
  const suffix = url.pathname.slice(API_PREFIX.length).replace(/^\/+/, '');
  if (!suffix) {
    return {
      projectId: null,
      action: null,
      filePath: null,
    };
  }

  const parts = suffix.split('/');
  const projectId = decodePathPart(parts[0] || '');
  const action = parts[1] ? decodePathPart(parts[1]) : null;
  const filePath = parts.length > 2 ? parts.slice(2).map(decodePathPart).join('/') : null;

  return {
    projectId,
    action,
    filePath,
  };
}

async function handleProjectsRequest(
  storage: ProjectStorage,
  codexAgent: CodexAgentRuntime,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  if (!req.url) {
    return false;
  }

  const url = new URL(req.url, 'http://visionary.local');
  if (url.pathname === CODEX_AUTH_PREFIX) {
    try {
      if ((req.method || 'GET') === 'GET') {
        sendOk(res, await storage.getUserCodexAuthStatus(getQueryString(url, 'user')));
        return true;
      }
      if ((req.method || 'GET') === 'PUT') {
        const body = readBodyObject(await readJsonBody(req));
        sendOk(res, await storage.saveUserCodexAuth({
          user: getBodyString(body, 'user'),
          apiKey: getBodyString(body, 'apiKey'),
        }));
        return true;
      }
    } catch (error) {
      sendError(res, error);
      return true;
    }
  }

  if (url.pathname === `${CODEX_AGENT_PREFIX}/messages` && (req.method || 'GET') === 'POST') {
    try {
      const body = readBodyObject(await readJsonBody(req));
      sendOk(
        res,
        await codexAgent.sendMessage({
          user: getBodyString(body, 'user'),
          projectId: getBodyString(body, 'projectId'),
          conversationId: typeof body.conversationId === 'string' ? body.conversationId : undefined,
          threadId: typeof body.threadId === 'string' ? body.threadId : undefined,
          prompt: getBodyString(body, 'prompt'),
          workflow: typeof body.workflow === 'string' ? body.workflow : undefined,
        }),
      );
      return true;
    } catch (error) {
      sendError(res, error);
      return true;
    }
  }

  if (
    (url.pathname === AGENT_STEP_ACTION_PREFIX || url.pathname === `${CODEX_AGENT_PREFIX}/step-actions`)
    && (req.method || 'GET') === 'POST'
  ) {
    try {
      const body = readBodyObject(await readJsonBody(req));
      sendOk(
        res,
        await codexAgent.handleStepAction({
          user: getBodyString(body, 'user'),
          projectId: getBodyString(body, 'projectId'),
          sessionId: getBodyString(body, 'sessionId'),
          stepKey: getBodyString(body, 'stepKey'),
          action: getBodyString(body, 'action'),
          prompt: typeof body.prompt === 'string' ? body.prompt : undefined,
          selectedIndex: typeof body.selectedIndex === 'number' ? body.selectedIndex : undefined,
          images: Array.isArray(body.images) ? body.images : undefined,
          sourceImages: Array.isArray(body.sourceImages) ? body.sourceImages : undefined,
        }),
      );
      return true;
    } catch (error) {
      sendError(res, error);
      return true;
    }
  }

  if (url.pathname === ADMIN_USERS_PREFIX && (req.method || 'GET') === 'GET') {
    try {
      sendOk(res, await storage.listUsers());
      return true;
    } catch (error) {
      sendError(res, error);
      return true;
    }
  }

  if (url.pathname.startsWith(`${ADMIN_USERS_PREFIX}/`)) {
    const suffix = url.pathname.slice(ADMIN_USERS_PREFIX.length).replace(/^\/+/, '');
    const parts = suffix.split('/').map(decodePathPart);
    const method = req.method || 'GET';

    try {
      if (parts.length === 1 && method === 'DELETE') {
        sendOk(res, await storage.deleteUser(parts[0] || ''));
        return true;
      }

      if (parts.length === 3 && parts[1] === 'projects' && method === 'DELETE') {
        sendOk(res, await storage.deleteProject(parts[0] || '', parts[2] || ''));
        return true;
      }
    } catch (error) {
      sendError(res, error);
      return true;
    }
  }

  if (!url.pathname.startsWith(API_PREFIX)) {
    return false;
  }

  const method = req.method || 'GET';
  const { projectId, action, filePath } = parseProjectPath(url);

  try {
    if (!projectId && !action && method === 'GET') {
      const user = getQueryString(url, 'user');
      sendOk(res, await storage.listProjects(user));
      return true;
    }

    if (!projectId && !action && method === 'POST') {
      const body = readBodyObject(await readJsonBody(req));
      const user = getBodyString(body, 'user');
      const name = getBodyString(body, 'name');
      sendOk(
        res,
        await storage.createProject({
          user,
          name,
          scene: body.scene,
          agentHistory: body.agentHistory,
        }),
        201,
      );
      return true;
    }

    if (!projectId) {
      throw new ProjectStorageError('BAD_REQUEST', 'project id is required');
    }

    if (!action && method === 'GET') {
      const user = getQueryString(url, 'user');
      sendOk(res, await storage.getProject(user, projectId));
      return true;
    }

    if (!action && method === 'DELETE') {
      const user = getQueryString(url, 'user');
      sendOk(res, await storage.deleteProject(user, projectId));
      return true;
    }

    if (!action && method === 'PATCH') {
      const body = readBodyObject(await readJsonBody(req));
      sendOk(res, await storage.renameProject({
        user: resolveUser(url, body),
        projectId,
        name: getBodyString(body, 'name'),
      }));
      return true;
    }

    if (action === 'scene' && method === 'GET') {
      const user = getQueryString(url, 'user');
      sendOk(res, await storage.readScene(user, projectId));
      return true;
    }

    if (action === 'scene' && method === 'PUT') {
      const body = readBodyObject(await readJsonBody(req));
      const user = resolveUser(url, body);
      const payload = Object.prototype.hasOwnProperty.call(body, 'scene') ? body.scene : body;
      sendOk(res, await storage.saveScene({ user, projectId, payload }));
      return true;
    }

    if (action === 'agent-history' && method === 'GET') {
      const user = getQueryString(url, 'user');
      sendOk(res, await storage.readAgentHistory(user, projectId));
      return true;
    }

    if (action === 'asset-index' && method === 'GET') {
      const user = getQueryString(url, 'user');
      sendOk(res, await storage.listAssetIndex(user, projectId));
      return true;
    }

    if (action === 'agent-history' && method === 'PUT') {
      const body = readBodyObject(await readJsonBody(req));
      const user = resolveUser(url, body);
      const payload = Object.prototype.hasOwnProperty.call(body, 'agentHistory') ? body.agentHistory : body;
      sendOk(res, await storage.saveAgentHistory({ user, projectId, payload }));
      return true;
    }

    if (action === 'files' && filePath && method === 'GET') {
      const user = getQueryString(url, 'user');
      const file = await storage.readAsset(user, projectId, filePath);
      res.statusCode = 200;
      res.setHeader('content-type', 'application/octet-stream');
      res.end(file);
      return true;
    }

    if (action === 'files' && filePath && method === 'PUT') {
      const user = getQueryString(url, 'user');
      const content = await readRequestBuffer(req, BINARY_BODY_LIMIT_BYTES);
      sendOk(res, await storage.writeAsset({ user, projectId, relativePath: filePath, content }));
      return true;
    }

    sendJson(res, 404, {
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: 'project API route not found',
      },
    });
    return true;
  } catch (error) {
    sendError(res, error);
    return true;
  }
}

export function createProjectApiPlugin(options?: { storage?: ProjectStorage }): PluginOption {
  return {
    name: 'visionary-project-api',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      const storage = options?.storage ?? new ProjectStorage(resolveProjectStorageRoot());
      const codexAgent = new CodexAgentRuntime(storage);
      server.middlewares.use(async (req, res, next) => {
        const handled = await handleProjectsRequest(storage, codexAgent, req, res);
        if (!handled) {
          next();
        }
      });
    },
  };
}
