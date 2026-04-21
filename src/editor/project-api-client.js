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
