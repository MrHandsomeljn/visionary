function buildQuery(params = {}) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        search.set(key, String(value));
    });
    const text = search.toString();
    return text ? `?${text}` : '';
}

async function parseApiResponse(response) {
    const contentType = String(response.headers.get('content-type') || '');
    const isJson = contentType.includes('application/json');
    const payload = isJson ? await response.json().catch(() => null) : null;

    if (!response.ok) {
        const message = payload?.error?.message || `${response.status} ${response.statusText}`.trim();
        const error = new Error(message || 'Project API request failed');
        error.status = response.status;
        error.code = payload?.error?.code || 'API_ERROR';
        throw error;
    }

    return payload?.data;
}

function parseSseMessage(rawMessage) {
    const message = { event: 'message', data: '' };
    const dataLines = [];
    String(rawMessage || '').split(/\r?\n/).forEach((line) => {
        if (line.startsWith('event:')) {
            message.event = line.slice('event:'.length).trim() || 'message';
        } else if (line.startsWith('data:')) {
            dataLines.push(line.slice('data:'.length).replace(/^ /, ''));
        }
    });
    message.data = dataLines.join('\n');
    return message;
}

function dispatchSseMessage(rawMessage, handlers = {}) {
    if (!String(rawMessage || '').trim()) return undefined;
    const message = parseSseMessage(rawMessage);
    const payload = message.data ? JSON.parse(message.data) : null;
    handlers.onMessage?.({ event: message.event, data: payload });
    if (message.event === 'error') {
        const error = new Error(payload?.message || 'Streaming request failed');
        error.code = payload?.code || 'STREAM_ERROR';
        throw error;
    }
    if (message.event === 'codex-event') {
        handlers.onEvent?.(payload);
    } else if (message.event === 'task') {
        handlers.onTask?.(payload);
    } else if (message.event === 'result') {
        return payload;
    }
    return undefined;
}

async function parseSseResponse(response, handlers = {}) {
    if (!response.ok) {
        await parseApiResponse(response);
    }
    if (!response.body || !window.TextDecoder) {
        throw new Error('Streaming responses are not supported by this browser');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result;
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split(/\r?\n\r?\n/);
        buffer = parts.pop() || '';
        for (const part of parts) {
            const maybeResult = dispatchSseMessage(part, handlers);
            if (maybeResult !== undefined) {
                result = maybeResult;
            }
        }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
        const maybeResult = dispatchSseMessage(buffer, handlers);
        if (maybeResult !== undefined) {
            result = maybeResult;
        }
    }
    if (!result) {
        throw new Error('Streaming request finished without a result');
    }
    return result;
}

export class ProjectApiClient {
    constructor(options = {}) {
        this.baseUrl = String(options.baseUrl || '/api/projects').replace(/\/+$/, '');
    }

    async listProjects(user) {
        const response = await fetch(`${this.baseUrl}${buildQuery({ user })}`);
        return parseApiResponse(response);
    }

    async createProject({ user, name, scene, agentHistory }) {
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                user,
                name,
                scene,
                agentHistory,
            }),
        });
        return parseApiResponse(response);
    }

    async getProject(user, projectId) {
        const response = await fetch(`${this.baseUrl}/${encodeURIComponent(projectId)}${buildQuery({ user })}`);
        return parseApiResponse(response);
    }

    async deleteProject(user, projectId) {
        const response = await fetch(`${this.baseUrl}/${encodeURIComponent(projectId)}${buildQuery({ user })}`, {
            method: 'DELETE',
        });
        return parseApiResponse(response);
    }

    async renameProject({ user, projectId, name }) {
        const response = await fetch(`${this.baseUrl}/${encodeURIComponent(projectId)}`, {
            method: 'PATCH',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                user,
                name,
            }),
        });
        return parseApiResponse(response);
    }

    async loadScene(user, projectId) {
        const response = await fetch(`${this.baseUrl}/${encodeURIComponent(projectId)}/scene${buildQuery({ user })}`);
        return parseApiResponse(response);
    }

    async saveScene({ user, projectId, scene }) {
        const response = await fetch(`${this.baseUrl}/${encodeURIComponent(projectId)}/scene`, {
            method: 'PUT',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                user,
                scene,
            }),
        });
        return parseApiResponse(response);
    }

    async loadAgentHistory(user, projectId) {
        const response = await fetch(`${this.baseUrl}/${encodeURIComponent(projectId)}/agent-history${buildQuery({ user })}`);
        return parseApiResponse(response);
    }

    async loadAssetIndex(user, projectId) {
        const response = await fetch(`${this.baseUrl}/${encodeURIComponent(projectId)}/asset-index${buildQuery({ user })}`);
        return parseApiResponse(response);
    }

    async saveAgentHistory({ user, projectId, agentHistory }) {
        const response = await fetch(`${this.baseUrl}/${encodeURIComponent(projectId)}/agent-history`, {
            method: 'PUT',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                user,
                agentHistory,
            }),
        });
        return parseApiResponse(response);
    }

    getAssetUrl(user, projectId, relativePath) {
        return `${this.baseUrl}/${encodeURIComponent(projectId)}/files/${relativePath.split('/').map((part) => encodeURIComponent(part)).join('/')}${buildQuery({ user })}`;
    }

    async writeAsset({ user, projectId, relativePath, content }) {
        const response = await fetch(this.getAssetUrl(user, projectId, relativePath), {
            method: 'PUT',
            headers: {
                'content-type': 'application/octet-stream',
            },
            body: content,
        });
        return parseApiResponse(response);
    }

    async prepareCameraTrajectory({
        user,
        projectId,
        sceneInfoPath,
        humanText,
        segmentCount,
        segmentDuration,
        fps,
        keyframeInterval,
        firstFrameOnly,
        debugEvalOnly,
        maxOptimizationRounds,
        runLabel,
        sceneBoundsScale,
    }) {
        const response = await fetch(`${this.baseUrl}/${encodeURIComponent(projectId)}/camera-trajectory/prepare`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                user,
                sceneInfoPath,
                humanText,
                segmentCount,
                segmentDuration,
                fps,
                keyframeInterval,
                firstFrameOnly,
                debugEvalOnly,
                maxOptimizationRounds,
                runLabel,
                sceneBoundsScale,
            }),
        });
        return parseApiResponse(response);
    }

    async continueCameraTrajectory({
        user,
        projectId,
        preparedPath,
    }) {
        const response = await fetch(`${this.baseUrl}/${encodeURIComponent(projectId)}/camera-trajectory/continue`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                user,
                preparedPath,
            }),
        });
        return parseApiResponse(response);
    }

    async optimizeCameraTrajectory({
        user,
        projectId,
        preparedPath,
    }) {
        const response = await fetch(`${this.baseUrl}/${encodeURIComponent(projectId)}/camera-trajectory/optimize`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                user,
                preparedPath,
            }),
        });
        return parseApiResponse(response);
    }

    async sendCodexAgentMessage({
        user,
        projectId,
        conversationId,
        threadId,
        prompt,
        workflow,
    }) {
        const response = await fetch('/api/codex-agent/messages', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                user,
                projectId,
                conversationId,
                threadId,
                prompt,
                workflow,
            }),
        });
        return parseApiResponse(response);
    }

    async sendCodexAgentMessageStream({
        user,
        projectId,
        conversationId,
        threadId,
        prompt,
        workflow,
        onEvent,
        onTask,
        onMessage,
    }) {
        const response = await fetch('/api/codex-agent/messages/stream', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                accept: 'text/event-stream',
            },
            body: JSON.stringify({
                user,
                projectId,
                conversationId,
                threadId,
                prompt,
                workflow,
            }),
        });
        return parseSseResponse(response, { onEvent, onTask, onMessage });
    }

    async sendCodexAgentStepAction({
        user,
        projectId,
        sessionId,
        stepKey,
        action,
        prompt,
        selectedIndex,
        images,
        sourceImages,
    }) {
        const response = await fetch('/api/agent/step-action', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                user,
                projectId,
                sessionId,
                stepKey,
                action,
                prompt,
                selectedIndex,
                images,
                sourceImages,
            }),
        });
        return parseApiResponse(response);
    }

    async getCodexAuthStatus(user) {
        const response = await fetch(`/api/codex-auth${buildQuery({ user })}`);
        return parseApiResponse(response);
    }

    async saveCodexAuth({ user, apiKey }) {
        const response = await fetch('/api/codex-auth', {
            method: 'PUT',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                user,
                apiKey,
            }),
        });
        return parseApiResponse(response);
    }

    async listUsers() {
        const response = await fetch('/api/project-admin/users');
        return parseApiResponse(response);
    }

    async adminDeleteProject(user, projectId) {
        const response = await fetch(`/api/project-admin/users/${encodeURIComponent(user)}/projects/${encodeURIComponent(projectId)}`, {
            method: 'DELETE',
        });
        return parseApiResponse(response);
    }

    async deleteUser(user) {
        const response = await fetch(`/api/project-admin/users/${encodeURIComponent(user)}`, {
            method: 'DELETE',
        });
        return parseApiResponse(response);
    }
}
