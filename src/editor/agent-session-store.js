import { buildAgentAssetPath } from './agent-session-model.js';

const AGENT_SESSION_ROOT_DIR = 'visionary-agent-sessions';
const AGENT_HISTORY_JSON_FILE = 'agent_history.json';
const AGENT_HISTORY_ASSET_DIR = 'agent_history';

const OPENAI_CONVERSATION_REFERENCE_LINKS = [
    'https://platform.openai.com/docs/api-reference/responses/create',
    'https://platform.openai.com/docs/api-reference/responses/retrieve',
    'https://platform.openai.com/docs/guides/images-vision',
];

const CANONICAL_ASSET_PATH_RE = /^assets\/([a-f0-9]{64})\.[^/]+$/i;

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

async function readBlobBytes(blob) {
    return new Uint8Array(await blob.arrayBuffer());
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
    if (block?.type === 'progress' && Array.isArray(block.images)) {
        base.images = block.images.map((image) => {
            const nextImage = { ...image };
            delete nextImage.src;
            if (!nextImage.assetPath && nextImage.relativePath) {
                nextImage.assetPath = nextImage.relativePath;
            }
            if (!nextImage.relativePath && nextImage.assetPath) {
                nextImage.relativePath = nextImage.assetPath;
            }
            return nextImage;
        });
    }
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

function getAttemptStepBlocks(attempt) {
    if (Array.isArray(attempt?.steps) && attempt.steps.length > 0) {
        return attempt.steps;
    }
    return Array.isArray(attempt?.blocks) ? attempt.blocks : [];
}

function toUnixSeconds(isoString) {
    const timestamp = Date.parse(String(isoString || ''));
    if (!Number.isFinite(timestamp)) return null;
    return Math.floor(timestamp / 1000);
}

function mapMessageRole(role) {
    if (role === 'assistant' || role === 'system' || role === 'developer') return role;
    return 'user';
}

function deriveOutputTextType(role) {
    return role === 'assistant' ? 'output_text' : 'input_text';
}

function cloneArray(items = []) {
    return Array.isArray(items) ? items.map((item) => ({ ...item })) : [];
}

function readRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeProjectRelativePath(value = '') {
    const normalized = String(value || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized || normalized.includes('\0')) return '';
    if (normalized.startsWith('/') || /^[a-z]:\//i.test(normalized)) return '';
    if (normalized.split('/').some((part) => part === '' || part === '..')) return '';
    return normalized;
}

function hashFromCanonicalAssetPath(value = '') {
    const match = normalizeProjectRelativePath(value).match(CANONICAL_ASSET_PATH_RE);
    return match?.[1]?.toLowerCase() || '';
}

function normalizeCanonicalAssetReference(value) {
    const outer = readRecord(value);
    const record = Object.keys(readRecord(outer.assetReference)).length > 0
        ? readRecord(outer.assetReference)
        : (Object.keys(readRecord(outer.canonicalAssetReference)).length > 0
            ? readRecord(outer.canonicalAssetReference)
            : outer);
    const relativePath = normalizeProjectRelativePath(
        record.path
        || record.canonicalPath
        || record.relativePath
        || record.assetPath
        || record.modelPath
    );
    const hash = hashFromCanonicalAssetPath(relativePath);
    if (!hash) return null;
    const explicitHash = String(record.hash || '').trim().toLowerCase();
    if (explicitHash && explicitHash !== hash) return null;
    const assetId = String(record.assetId || '').trim() || `sha256:${hash}`;
    if (assetId.startsWith('sha256:') && assetId.slice('sha256:'.length).toLowerCase() !== hash) return null;
    const bytes = Number(record.bytes);
    return {
        assetId,
        hash,
        path: relativePath,
        ...(record.mimeType || record.mime_type ? { mimeType: String(record.mimeType || record.mime_type) } : {}),
        ...(Number.isFinite(bytes) && bytes >= 0 ? { bytes } : {}),
        ...(record.kind ? { kind: String(record.kind) } : {}),
        ...(Object.keys(readRecord(record.provenance)).length > 0 ? { provenance: readRecord(record.provenance) } : {}),
    };
}

function collectCanonicalAssetReferences(value, output = new Map(), seen = new WeakSet()) {
    const normalized = normalizeCanonicalAssetReference(value);
    if (normalized) {
        output.set(normalized.assetId, normalized);
    }
    if (!value || typeof value !== 'object') return output;
    if (seen.has(value)) return output;
    seen.add(value);
    if (Array.isArray(value)) {
        value.forEach((item) => collectCanonicalAssetReferences(item, output, seen));
        return output;
    }
    const record = readRecord(value);
    [
        'assetReference',
        'canonicalAssetReference',
        'assetReferences',
        'canonicalAssetReferences',
        'metadata',
        'images',
        'items',
        'blocks',
        'steps',
        'attempts',
        'workflows',
        'sceneInsertPlan',
    ].forEach((key) => {
        collectCanonicalAssetReferences(record[key], output, seen);
    });
    return output;
}

function withAgentHistoryRoot(relativePath = '') {
    const normalized = String(relativePath || '').replace(/^assets\//i, '');
    return `${AGENT_HISTORY_ASSET_DIR}/${normalized}`.replace(/\/{2,}/g, '/');
}

function createConversationItem({
    id = '',
    workflowId = '',
    workflowLabel = '',
    role = 'user',
    createdAt = new Date().toISOString(),
    content = [],
    metadata = {},
} = {}) {
    const safeContent = Array.isArray(content) ? content.filter(Boolean) : [];
    return {
        id: id || '',
        type: 'message',
        role: mapMessageRole(role),
        workflow_id: workflowId || '',
        workflow_label: workflowLabel || workflowId || '',
        created_at: createdAt,
        created_at_unix: toUnixSeconds(createdAt),
        content: safeContent,
        metadata: { ...metadata },
    };
}

export class AgentSessionStore {
    constructor() {
        this.rootHandle = null;
        this.storageHandle = null;
        this.storageMode = null;
        this.lastSavedAt = null;
        this.lastError = null;
    }

    debugLog(message, details) {
        if (details !== undefined) {
            console.debug(`[AgentSessionStore] ${message}`, details);
            return;
        }
        console.debug(`[AgentSessionStore] ${message}`);
    }

    getStatus() {
        return {
            enabled: Boolean(this.storageHandle),
            rootName: this.rootHandle?.name || null,
            storageName: this.storageHandle?.name || null,
            storageMode: this.storageMode,
            lastSavedAt: this.lastSavedAt,
            lastError: this.lastError,
        };
    }

    bindWorkspaceRoot(rootHandle) {
        this.rootHandle = rootHandle || null;
        this.storageHandle = rootHandle || null;
        this.storageMode = rootHandle ? 'workspace' : null;
        this.lastError = null;
        return this.getStatus();
    }

    async pickStorageFolder() {
        if (typeof window === 'undefined' || typeof window.showDirectoryPicker !== 'function') {
            throw new Error('当前环境不支持 File System Access API');
        }
        const rootHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        const storageHandle = await rootHandle.getDirectoryHandle(AGENT_SESSION_ROOT_DIR, { create: true });
        await ensureDirectoryHandle(storageHandle, [AGENT_HISTORY_ASSET_DIR]);
        this.rootHandle = rootHandle;
        this.storageHandle = storageHandle;
        this.storageMode = 'standalone';
        this.lastError = null;
        return this.getStatus();
    }

    async persistSnapshot(snapshot) {
        if (!this.storageHandle) {
            return this.getStatus();
        }
        try {
            this.debugLog('persistSnapshot:start', {
                storageMode: this.storageMode,
                storageName: this.storageHandle?.name || null,
            });
            const serialized = await this.serializeSnapshot(snapshot);
            this.debugLog('persistSnapshot:file:start', {
                file: AGENT_HISTORY_JSON_FILE,
            });
            await writeJsonFile(this.storageHandle, AGENT_HISTORY_JSON_FILE, serialized);
            this.debugLog('persistSnapshot:file:complete', {
                file: AGENT_HISTORY_JSON_FILE,
            });
            this.lastSavedAt = new Date().toISOString();
            this.lastError = null;
            this.debugLog('persistSnapshot:complete', {
                savedAt: this.lastSavedAt,
            });
            return this.getStatus();
        } catch (error) {
            this.lastError = error instanceof Error ? error.message : String(error);
            this.debugLog('persistSnapshot:error', {
                error: this.lastError,
            });
            throw error;
        }
    }

    async exportSnapshot(snapshot, options = {}) {
        const includeAssets = options.includeAssets !== false;
        const context = {
            includeAssets,
            assetIndex: new Map(),
            assetPayloads: options.includeAssetPayloads ? new Map() : null,
        };
        return {
            version: 2,
            exportedAt: new Date().toISOString(),
            includeAssets,
            snapshot: await this.serializeSnapshot(snapshot, {
                includeAssets,
                context,
            }),
            ...(context.assetPayloads instanceof Map
                ? {
                    assetPayloads: Array.from(context.assetPayloads.values()),
                }
                : {}),
        };
    }

    async serializeSnapshot(snapshot, options = {}) {
        const workflows = Array.isArray(snapshot?.workflows) ? snapshot.workflows : [];
        const context = options.context || {
            includeAssets: options.includeAssets !== false,
            assetIndex: new Map(),
            assetPayloads: null,
        };
        const serializedWorkflows = [];
        const openaiMessages = [];

        for (const workflowSnapshot of workflows) {
            const serialized = await this.serializeWorkflowSnapshot(workflowSnapshot, context);
            serializedWorkflows.push(serialized);
            openaiMessages.push(...serialized.openaiMessages);
        }
        this.recordCanonicalAssetReferences(snapshot?.stepStates, context, {
            kind: 'step-state',
        });
        this.recordCanonicalAssetReferences(snapshot?.pipelineStates, context, {
            kind: 'pipeline-state',
        });

        return {
            schema: 'visionary.agent_history',
            version: 2,
            savedAt: new Date().toISOString(),
            storageMode: this.storageMode || 'detached',
            assetRoot: AGENT_HISTORY_ASSET_DIR,
            stepStates: snapshot?.stepStates && typeof snapshot.stepStates === 'object'
                ? JSON.parse(JSON.stringify(snapshot.stepStates))
                : {},
            pipelineStates: snapshot?.pipelineStates && typeof snapshot.pipelineStates === 'object'
                ? JSON.parse(JSON.stringify(snapshot.pipelineStates))
                : {},
            references: {
                style: 'openai-responses-message-envelope-with-visionary-content-extensions',
                links: [...OPENAI_CONVERSATION_REFERENCE_LINKS],
            },
            workflows: serializedWorkflows.map((workflow) => ({
                workflow: workflow.workflow,
                label: workflow.label,
                savedAt: workflow.savedAt,
                items: workflow.items,
                openai_messages: workflow.openaiMessages,
            })),
            openai_conversation: {
                object: 'list',
                data: openaiMessages,
                first_id: openaiMessages[0]?.id || null,
                last_id: openaiMessages[openaiMessages.length - 1]?.id || null,
                has_more: false,
            },
            asset_index: Array.from(context.assetIndex.values()),
        };
    }

    recordCanonicalAssetReferences(value, context, metadata = {}) {
        if (!(context?.assetIndex instanceof Map)) return;
        for (const reference of collectCanonicalAssetReferences(value).values()) {
            context.assetIndex.set(`canonical:${reference.assetId}`, {
                hash: reference.hash,
                path: reference.path,
                assetId: reference.assetId,
                canonical: true,
                mime_type: reference.mimeType || '',
                bytes: Number.isFinite(Number(reference.bytes)) ? Number(reference.bytes) : 0,
                kind: reference.kind || metadata.kind || 'canonical-asset-reference',
                ...(Object.keys(readRecord(reference.provenance)).length > 0 ? { provenance: reference.provenance } : {}),
                ...metadata,
            });
        }
    }

    async serializeWorkflowSnapshot(workflowSnapshot, context) {
        const items = Array.isArray(workflowSnapshot?.items) ? workflowSnapshot.items : [];
        const serializedItems = [];
        const openaiMessages = [];
        for (const item of items) {
            this.recordCanonicalAssetReferences(item, context, {
                workflow: workflowSnapshot?.workflow || '',
            });
            const serialized = await this.serializeItem(item, workflowSnapshot, context);
            serializedItems.push(serialized.item);
            openaiMessages.push(...serialized.openaiMessages);
        }
        return {
            version: 1,
            workflow: workflowSnapshot.workflow,
            label: workflowSnapshot.label || '',
            savedAt: new Date().toISOString(),
            items: serializedItems,
            openaiMessages,
        };
    }

    async serializeItem(item, workflowSnapshot, context) {
        if (!item || typeof item !== 'object') {
            return { item: null, openaiMessages: [] };
        }
        if (item.kind === 'session') {
            return this.serializeSessionItem(item, workflowSnapshot, context);
        }
        return this.serializeMessageItem(item, workflowSnapshot, context);
    }

    async serializeMessageItem(item, workflowSnapshot, context) {
        const attachments = [];
        for (const attachment of item.attachments || []) {
            const assetPath = await this.persistAttachmentAsset(attachment, context);
            attachments.push(createPersistableAttachment(attachment, assetPath));
        }
        const serializedItem = {
            ...item,
            attachments,
            blocks: Array.isArray(item.blocks) ? item.blocks.map((block) => ({ ...block })) : [],
        };
        return {
            item: serializedItem,
            openaiMessages: [
                createConversationItem({
                    id: item.id,
                    workflowId: workflowSnapshot?.workflow,
                    workflowLabel: workflowSnapshot?.label,
                    role: item.role,
                    createdAt: item.createdAt,
                    content: this.buildMessageContentParts(serializedItem, mapMessageRole(item.role)),
                    metadata: {
                        source_kind: item.kind || 'message',
                    },
                }),
            ],
        };
    }

    async serializeSessionItem(item, workflowSnapshot, context) {
        const attachments = [];
        for (const attachment of item.attachments || []) {
            const assetPath = await this.persistAttachmentAsset(attachment, context);
            attachments.push(createPersistableAttachment(attachment, assetPath));
        }

        const attempts = [];
        const openaiMessages = [];
        for (const attempt of item.attempts || []) {
            const blocks = [];
            for (const block of attempt.blocks || []) {
                const assetPath = await this.persistBlockAsset(block, context);
                blocks.push(clonePersistableBlock(block, assetPath));
            }
            const steps = [];
            for (const block of attempt.steps || []) {
                const assetPath = await this.persistBlockAsset(block, context);
                steps.push(clonePersistableBlock(block, assetPath));
            }
            const serializedAttempt = {
                ...attempt,
                blocks,
                ...(Array.isArray(attempt.steps) ? { steps } : {}),
            };
            attempts.push(serializedAttempt);
            openaiMessages.push(
                createConversationItem({
                    id: attempt.id,
                    workflowId: workflowSnapshot?.workflow,
                    workflowLabel: workflowSnapshot?.label,
                    role: 'assistant',
                    createdAt: attempt.createdAt,
                    content: this.buildAttemptContentParts(serializedAttempt),
                    metadata: {
                        source_kind: 'session-attempt',
                        session_id: item.id,
                        archive_state: item.archiveState || 'active',
                        attempt_status: attempt.status || 'running',
                        attempt_index: attempts.length - 1,
                    },
                })
            );
        }

        return {
            item: {
            ...item,
            attachments,
            attempts,
            },
            openaiMessages,
        };
    }

    async persistAttachmentAsset(attachment, context) {
        const normalized = await normalizeAssetSource({
            file: attachment?.file,
            blob: attachment?.blob,
            dataUrl: attachment?.dataUrl,
            fileName: attachment?.name,
            mimeType: attachment?.type,
        });
        if (!normalized) return attachment?.assetPath || '';
        return this.persistNormalizedAsset(normalized, context, {
            kind: 'attachment',
            sourceId: attachment?.id || '',
            title: attachment?.name || '',
        });
    }

    async persistBlockAsset(block, context) {
        if (block?.type === 'image' && typeof block.src === 'string' && block.src.startsWith('data:')) {
            return this.persistNormalizedAsset({
                blob: await blobFromDataUrl(block.src),
                fileName: block.alt || block.title || 'agent-image.png',
                mimeType: '',
            }, context, {
                kind: 'block-image',
                sourceId: block?.id || '',
                title: block?.title || '',
            });
        }
        if (block?.type === 'viewer3d' && typeof block.assetUrl === 'string' && block.assetUrl.startsWith('data:')) {
            return this.persistNormalizedAsset({
                blob: await blobFromDataUrl(block.assetUrl),
                fileName: `${block.title || 'agent-model'}.${block.format === 'glb' ? 'glb' : 'gltf'}`,
                mimeType: block.format === 'glb' ? 'model/gltf-binary' : 'model/gltf+json',
            }, context, {
                kind: 'block-3d',
                sourceId: block?.id || '',
                title: block?.title || '',
            });
        }
        return block?.assetPath || '';
    }

    async persistNormalizedAsset(normalized, context, metadata = {}) {
        if (!normalized?.blob) return '';
        const hashHex = await computeHashHex(normalized.blob);
        const fallbackExtension = inferExtensionFromMimeType(normalized.mimeType) || '.bin';
        const relativeAssetPath = buildAgentAssetPath({
            hashHex,
            originalName: normalized.fileName,
            fallbackExtension,
        });
        const assetPath = withAgentHistoryRoot(relativeAssetPath);
        const bytes = await readBlobBytes(normalized.blob);
        if (context?.includeAssets !== false && this.storageHandle) {
            this.debugLog('persistNormalizedAsset:file:start', {
                file: assetPath,
                bytes: bytes.byteLength,
                mimeType: normalized.mimeType || normalized.blob?.type || '',
            });
            await writeBlobFile(this.storageHandle, assetPath, normalized.blob);
            this.debugLog('persistNormalizedAsset:file:complete', {
                file: assetPath,
                bytes: bytes.byteLength,
            });
        }
        if (context?.assetIndex instanceof Map) {
            context.assetIndex.set(hashHex, {
                hash: hashHex,
                path: assetPath,
                original_name: normalized.fileName || '',
                mime_type: normalized.mimeType || normalized.blob?.type || '',
                bytes: bytes.byteLength,
                ...metadata,
            });
        }
        if (context?.assetPayloads instanceof Map) {
            context.assetPayloads.set(assetPath, {
                path: assetPath,
                content: bytes,
                fileName: normalized.fileName || '',
                mimeType: normalized.mimeType || normalized.blob?.type || '',
            });
        }
        return assetPath;
    }

    buildMessageContentParts(item, role = 'user') {
        const content = [];
        if (typeof item?.text === 'string' && item.text.length > 0) {
            content.push({
                type: deriveOutputTextType(role),
                text: item.text,
            });
        }
        for (const attachment of item?.attachments || []) {
            if (!attachment?.assetPath) continue;
            content.push({
                type: 'input_image',
                image_asset_path: attachment.assetPath,
                mime_type: attachment.type || '',
                name: attachment.name || '',
            });
        }
        return content;
    }

    buildAttemptContentParts(attempt) {
        const content = [];
        if (typeof attempt?.text === 'string' && attempt.text.length > 0) {
            content.push({
                type: 'output_text',
                text: attempt.text,
            });
        }
        for (const block of cloneArray(getAttemptStepBlocks(attempt))) {
            if (block.type === 'progress') {
                content.push({
                    type: 'visionary_progress',
                    block_id: block.id || '',
                    title: block.title || '',
                    status: block.status || '',
                    status_text: block.statusText || '',
                    value: Number(block.value || 0),
                });
                for (const [index, image] of cloneArray(block.images).entries()) {
                    content.push({
                        type: 'visionary_output_image',
                        block_id: block.id || '',
                        title: image.title || image.id || block.title || '',
                        status: block.applied ? 'applied' : 'ready',
                        asset_path: image.assetPath || image.relativePath || '',
                        alt: image.alt || block.title || '',
                        gallery_index: index,
                        selected: index === (Number(block.selectedIndex) || 0),
                    });
                }
                continue;
            }
            if (block.type === 'image') {
                content.push({
                    type: 'visionary_output_image',
                    block_id: block.id || '',
                    title: block.title || '',
                    status: block.status || '',
                    asset_path: block.assetPath || '',
                    alt: block.alt || '',
                });
                continue;
            }
            if (block.type === 'viewer3d') {
                content.push({
                    type: 'visionary_output_3d',
                    block_id: block.id || '',
                    title: block.title || '',
                    status: block.status || '',
                    asset_path: block.assetPath || '',
                    format: block.format || '',
                });
            }
        }
        return content;
    }
}

/**
 * 预留给未来真实后端/导出链路的接口约定：
 * 1. `bindWorkspaceRoot(rootHandle)` 把 agent 历史直接落到当前工作区根目录。
 * 2. `persistSnapshot(snapshot)` 接收前端四条 workflow 的快照，输出 `agent_history.json` 与 `agent_history/`。
 * 3. 顶层结构复用 OpenAI Responses 风格的 `message/role/content` 外壳，便于未来接真实模型响应；
 *    Visionary 自定义内容块使用 `visionary_*` 命名空间扩展。
 * 4. `exportSnapshot(snapshot, options)` 目前只保留接口形状，后续可以替换成 zip/服务端上传/项目内导出命令。
 */
