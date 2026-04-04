import { buildAgentAssetPath } from './agent-session-model.js';

const AGENT_SESSION_ROOT_DIR = 'visionary-agent-sessions';
const AGENT_SESSION_WORKFLOW_DIR = 'workflows';
const AGENT_SESSION_ASSET_DIR = 'assets';

function sanitizeWorkflowId(workflowId) {
    return String(workflowId || 'unknown')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'unknown';
}

function inferExtensionFromMimeType(type = '') {
    const normalized = String(type || '').trim().toLowerCase();
    if (normalized === 'image/png') return '.png';
    if (normalized === 'image/jpeg') return '.jpg';
    if (normalized === 'image/webp') return '.webp';
    if (normalized === 'image/gif') return '.gif';
    if (normalized === 'model/gltf+json') return '.gltf';
    if (normalized === 'model/gltf-binary') return '.glb';
    if (normalized === 'application/octet-stream') return '.bin';
    return '';
}

function isBlobLike(value) {
    return typeof Blob !== 'undefined' && value instanceof Blob;
}

async function blobFromDataUrl(dataUrl) {
    const response = await fetch(dataUrl);
    if (!response.ok) {
        throw new Error(`Failed to read data URL asset: ${response.status}`);
    }
    return response.blob();
}

async function normalizeAssetSource(source) {
    if (!source) return null;
    if (isBlobLike(source.blob)) {
        return {
            blob: source.blob,
            fileName: source.fileName || '',
            mimeType: source.blob.type || source.mimeType || '',
        };
    }
    if (isBlobLike(source.file)) {
        return {
            blob: source.file,
            fileName: source.file.name || source.fileName || '',
            mimeType: source.file.type || source.mimeType || '',
        };
    }
    if (typeof source.dataUrl === 'string' && source.dataUrl.startsWith('data:')) {
        const blob = await blobFromDataUrl(source.dataUrl);
        return {
            blob,
            fileName: source.fileName || '',
            mimeType: blob.type || source.mimeType || '',
        };
    }
    return null;
}

async function computeHashHex(blob) {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const bytes = new Uint8Array(hashBuffer);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function ensureDirectoryHandle(rootHandle, parts) {
    let currentHandle = rootHandle;
    for (const part of parts) {
        currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
    }
    return currentHandle;
}

async function writeJsonFile(rootHandle, relativePath, payload) {
    const parts = relativePath.split('/').filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) throw new Error('Invalid file path');
    const parent = await ensureDirectoryHandle(rootHandle, parts);
    const fileHandle = await parent.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(payload, null, 2));
    await writable.close();
}

async function writeBlobFile(rootHandle, relativePath, blob) {
    const parts = relativePath.split('/').filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) throw new Error('Invalid file path');
    const parent = await ensureDirectoryHandle(rootHandle, parts);
    const fileHandle = await parent.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
}

function createPersistableAttachment(attachment, assetPath = '') {
    return {
        id: attachment?.id || '',
        name: attachment?.name || '',
        type: attachment?.type || '',
        assetPath,
    };
}

function clonePersistableBlock(block, assetPath = '') {
    const base = { ...block };
    if (block?.type === 'image') {
        delete base.src;
        if (assetPath) base.assetPath = assetPath;
    }
    if (block?.type === 'viewer3d') {
        delete base.assetUrl;
        if (assetPath) base.assetPath = assetPath;
    }
    return base;
}

export class AgentSessionStore {
    constructor() {
        this.rootHandle = null;
        this.storageHandle = null;
        this.lastSavedAt = null;
        this.lastError = null;
    }

    getStatus() {
        return {
            enabled: Boolean(this.storageHandle),
            rootName: this.rootHandle?.name || null,
            storageName: this.storageHandle?.name || null,
            lastSavedAt: this.lastSavedAt,
            lastError: this.lastError,
        };
    }

    async pickStorageFolder() {
        if (typeof window === 'undefined' || typeof window.showDirectoryPicker !== 'function') {
            throw new Error('当前环境不支持 File System Access API');
        }
        const rootHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        const storageHandle = await rootHandle.getDirectoryHandle(AGENT_SESSION_ROOT_DIR, { create: true });
        await ensureDirectoryHandle(storageHandle, [AGENT_SESSION_WORKFLOW_DIR]);
        await ensureDirectoryHandle(storageHandle, [AGENT_SESSION_ASSET_DIR]);
        this.rootHandle = rootHandle;
        this.storageHandle = storageHandle;
        this.lastError = null;
        return this.getStatus();
    }

    async persistSnapshot(snapshot) {
        if (!this.storageHandle) {
            return this.getStatus();
        }
        try {
            const workflows = Array.isArray(snapshot?.workflows) ? snapshot.workflows : [];
            for (const workflowSnapshot of workflows) {
                const serialized = await this.serializeWorkflowSnapshot(workflowSnapshot);
                const fileName = `${sanitizeWorkflowId(workflowSnapshot.workflow)}.json`;
                await writeJsonFile(
                    this.storageHandle,
                    `${AGENT_SESSION_WORKFLOW_DIR}/${fileName}`,
                    serialized
                );
            }
            this.lastSavedAt = new Date().toISOString();
            this.lastError = null;
            return this.getStatus();
        } catch (error) {
            this.lastError = error instanceof Error ? error.message : String(error);
            throw error;
        }
    }

    async exportSnapshot(snapshot, options = {}) {
        const includeAssets = options.includeAssets !== false;
        return {
            version: 1,
            exportedAt: new Date().toISOString(),
            includeAssets,
            snapshot,
        };
    }

    async serializeWorkflowSnapshot(workflowSnapshot) {
        const items = Array.isArray(workflowSnapshot?.items) ? workflowSnapshot.items : [];
        const serializedItems = [];
        for (const item of items) {
            serializedItems.push(await this.serializeItem(item));
        }
        return {
            version: 1,
            workflow: workflowSnapshot.workflow,
            label: workflowSnapshot.label || '',
            savedAt: new Date().toISOString(),
            items: serializedItems,
        };
    }

    async serializeItem(item) {
        if (!item || typeof item !== 'object') return null;
        if (item.kind === 'session') {
            return this.serializeSessionItem(item);
        }
        return this.serializeMessageItem(item);
    }

    async serializeMessageItem(item) {
        const attachments = [];
        for (const attachment of item.attachments || []) {
            const assetPath = await this.persistAttachmentAsset(attachment);
            attachments.push(createPersistableAttachment(attachment, assetPath));
        }
        return {
            ...item,
            attachments,
            blocks: Array.isArray(item.blocks) ? item.blocks.map((block) => ({ ...block })) : [],
        };
    }

    async serializeSessionItem(item) {
        const attachments = [];
        for (const attachment of item.attachments || []) {
            const assetPath = await this.persistAttachmentAsset(attachment);
            attachments.push(createPersistableAttachment(attachment, assetPath));
        }

        const attempts = [];
        for (const attempt of item.attempts || []) {
            const blocks = [];
            for (const block of attempt.blocks || []) {
                const assetPath = await this.persistBlockAsset(block);
                blocks.push(clonePersistableBlock(block, assetPath));
            }
            attempts.push({
                ...attempt,
                blocks,
            });
        }

        return {
            ...item,
            attachments,
            attempts,
        };
    }

    async persistAttachmentAsset(attachment) {
        const normalized = await normalizeAssetSource({
            file: attachment?.file,
            blob: attachment?.blob,
            dataUrl: attachment?.dataUrl,
            fileName: attachment?.name,
            mimeType: attachment?.type,
        });
        if (!normalized) return attachment?.assetPath || '';
        return this.persistNormalizedAsset(normalized);
    }

    async persistBlockAsset(block) {
        if (block?.type === 'image' && typeof block.src === 'string' && block.src.startsWith('data:')) {
            return this.persistNormalizedAsset({
                blob: await blobFromDataUrl(block.src),
                fileName: block.alt || block.title || 'agent-image.png',
                mimeType: '',
            });
        }
        if (block?.type === 'viewer3d' && typeof block.assetUrl === 'string' && block.assetUrl.startsWith('data:')) {
            return this.persistNormalizedAsset({
                blob: await blobFromDataUrl(block.assetUrl),
                fileName: `${block.title || 'agent-model'}.${block.format === 'glb' ? 'glb' : 'gltf'}`,
                mimeType: block.format === 'glb' ? 'model/gltf-binary' : 'model/gltf+json',
            });
        }
        return block?.assetPath || '';
    }

    async persistNormalizedAsset(normalized) {
        if (!this.storageHandle || !normalized?.blob) return '';
        const hashHex = await computeHashHex(normalized.blob);
        const fallbackExtension = inferExtensionFromMimeType(normalized.mimeType) || '.bin';
        const assetPath = buildAgentAssetPath({
            hashHex,
            originalName: normalized.fileName,
            fallbackExtension,
        });
        await writeBlobFile(this.storageHandle, assetPath, normalized.blob);
        return assetPath;
    }
}

/**
 * 预留给未来真实后端/导出链路的接口约定：
 * 1. `pickStorageFolder()` 负责让用户授予单独的 agent 会话目录权限。
 * 2. `persistSnapshot(snapshot)` 接收前端当前四条 workflow 时间线的快照，并把 JSON 与资产写入同一目录。
 * 3. `exportSnapshot(snapshot, options)` 目前只保留接口形状，后续可以替换成 zip/服务端上传/项目内导出命令。
 */
