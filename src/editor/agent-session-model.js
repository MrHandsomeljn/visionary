const DEFAULT_ARCHIVE_STATE = 'active';

function createId(prefix = 'agent') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cloneAttachments(attachments = []) {
    return Array.isArray(attachments)
        ? attachments.map((attachment) => ({ ...attachment }))
        : [];
}

function cloneBlocks(blocks = []) {
    return Array.isArray(blocks)
        ? blocks.map((block) => ({ ...block }))
        : [];
}

function normalizeArchiveSummary(summary = {}, fallbackLabel = '') {
    return {
        label: String(summary.label || fallbackLabel || ''),
        thumbnailUrl: summary.thumbnailUrl || '',
        note: summary.note || '',
    };
}

export function createAgentThreadMessage({
    id = createId('agent-message'),
    role = 'assistant',
    workflow = 'scene-build',
    text = '',
    attachments = [],
    blocks = [],
    promptSuggestions = null,
    createdAt = new Date().toISOString(),
} = {}) {
    return {
        id,
        kind: 'message',
        role,
        workflow,
        text,
        attachments: cloneAttachments(attachments),
        blocks: cloneBlocks(blocks),
        promptSuggestions: Array.isArray(promptSuggestions) ? [...promptSuggestions] : null,
        createdAt,
        updatedAt: createdAt,
    };
}

export function createAgentGenerationAttempt({
    id = createId('agent-attempt'),
    workflow = 'scene-build',
    text = '',
    blocks = [],
    status = 'running',
    promptSuggestions = null,
    createdAt = new Date().toISOString(),
} = {}) {
    return {
        id,
        workflow,
        text,
        blocks: cloneBlocks(blocks),
        status,
        promptSuggestions: Array.isArray(promptSuggestions) ? [...promptSuggestions] : null,
        createdAt,
        updatedAt: createdAt,
    };
}

export function createAgentSession({
    id = createId('agent-session'),
    workflow = 'scene-build',
    prompt = '',
    attachments = [],
    attempt,
    archiveState = DEFAULT_ARCHIVE_STATE,
    collapsed = false,
    archiveSummary = null,
    createdAt = new Date().toISOString(),
} = {}) {
    const firstAttempt = attempt || createAgentGenerationAttempt({ workflow });
    return {
        id,
        kind: 'session',
        workflow,
        prompt: String(prompt || ''),
        attachments: cloneAttachments(attachments),
        attempts: [firstAttempt],
        activeAttemptIndex: 0,
        archiveState,
        collapsed: Boolean(collapsed),
        archiveSummary: archiveSummary
            ? normalizeArchiveSummary(archiveSummary)
            : normalizeArchiveSummary({ label: '' }),
        createdAt,
        updatedAt: createdAt,
    };
}

export function getAgentSessionActiveAttempt(session) {
    if (!session || !Array.isArray(session.attempts) || session.attempts.length === 0) return null;
    const index = Math.min(
        Math.max(0, Number(session.activeAttemptIndex) || 0),
        session.attempts.length - 1
    );
    return session.attempts[index] || null;
}

export function replaceAgentSessionActiveAttempt(session, nextAttempt) {
    if (!session || session.kind !== 'session' || !nextAttempt) return session;
    const index = Math.min(
        Math.max(0, Number(session.activeAttemptIndex) || 0),
        Math.max(0, session.attempts.length - 1)
    );
    const attempts = session.attempts.map((attempt, attemptIndex) => (
        attemptIndex === index ? { ...nextAttempt } : attempt
    ));
    return {
        ...session,
        attempts,
        updatedAt: new Date().toISOString(),
    };
}

export function appendAgentSessionRetryAttempt(session, attempt) {
    if (!session || session.kind !== 'session' || !attempt) return session;
    const attempts = [...(session.attempts || []), { ...attempt }];
    return {
        ...session,
        attempts,
        activeAttemptIndex: attempts.length - 1,
        archiveState: DEFAULT_ARCHIVE_STATE,
        collapsed: false,
        updatedAt: new Date().toISOString(),
    };
}

export function patchAgentSessionAttemptBlock(session, {
    attemptId,
    blockId,
    patch = {},
} = {}) {
    if (!session || session.kind !== 'session' || !attemptId || !blockId) return session;
    return {
        ...session,
        attempts: (session.attempts || []).map((attempt) => {
            if (attempt.id !== attemptId) return attempt;
            return {
                ...attempt,
                blocks: (attempt.blocks || []).map((block) => (
                    block.id === blockId ? { ...block, ...patch } : block
                )),
                updatedAt: new Date().toISOString(),
            };
        }),
        updatedAt: new Date().toISOString(),
    };
}

export function updateAgentSessionAttempt(session, {
    attemptId,
    text,
    status,
    blocks,
    promptSuggestions,
} = {}) {
    if (!session || session.kind !== 'session' || !attemptId) return session;
    return {
        ...session,
        attempts: (session.attempts || []).map((attempt) => {
            if (attempt.id !== attemptId) return attempt;
            return {
                ...attempt,
                ...(text !== undefined ? { text: String(text ?? '') } : {}),
                ...(status !== undefined ? { status } : {}),
                ...(blocks !== undefined ? { blocks: cloneBlocks(blocks) } : {}),
                ...(promptSuggestions !== undefined
                    ? {
                        promptSuggestions: Array.isArray(promptSuggestions)
                            ? [...promptSuggestions]
                            : null,
                    }
                    : {}),
                updatedAt: new Date().toISOString(),
            };
        }),
        updatedAt: new Date().toISOString(),
    };
}

export function setAgentSessionArchiveState(session, {
    archiveState = DEFAULT_ARCHIVE_STATE,
    summaryLabel = '',
    thumbnailUrl = '',
    note = '',
} = {}) {
    if (!session || session.kind !== 'session') return session;
    return {
        ...session,
        archiveState,
        collapsed: archiveState === DEFAULT_ARCHIVE_STATE ? Boolean(session.collapsed) : true,
        archiveSummary: normalizeArchiveSummary(
            {
                label: summaryLabel || session.archiveSummary?.label || '',
                thumbnailUrl: thumbnailUrl || session.archiveSummary?.thumbnailUrl || '',
                note: note || session.archiveSummary?.note || '',
            },
            summaryLabel
        ),
        updatedAt: new Date().toISOString(),
    };
}

export function toggleAgentSessionCollapsed(session, collapsed = !session?.collapsed) {
    if (!session || session.kind !== 'session') return session;
    return {
        ...session,
        collapsed: Boolean(collapsed),
        updatedAt: new Date().toISOString(),
    };
}

export function resolveAgentSessionPagerItems({
    total = 0,
    activeIndex = 0,
} = {}) {
    const safeTotal = Math.max(0, Number(total) || 0);
    if (safeTotal <= 1) return [];
    const safeActiveIndex = Math.min(
        Math.max(0, Number(activeIndex) || 0),
        Math.max(0, safeTotal - 1)
    );

    if (safeTotal <= 5) {
        return Array.from({ length: safeTotal }, (_, index) => ({
            type: 'page',
            page: index + 1,
            index,
            active: index === safeActiveIndex,
        }));
    }

    const items = [
        {
            type: 'nav',
            direction: 'prev',
            targetIndex: Math.max(0, safeActiveIndex - 1),
            disabled: safeActiveIndex <= 0,
        },
    ];

    if (safeActiveIndex <= 2) {
        for (let index = 0; index < 5; index += 1) {
            items.push({
                type: 'page',
                page: index + 1,
                index,
                active: index === safeActiveIndex,
            });
        }
    } else if (safeActiveIndex >= safeTotal - 3) {
        for (let index = safeTotal - 5; index < safeTotal; index += 1) {
            items.push({
                type: 'page',
                page: index + 1,
                index,
                active: index === safeActiveIndex,
            });
        }
    } else {
        for (let index = safeActiveIndex - 2; index <= safeActiveIndex + 2; index += 1) {
            items.push({
                type: 'page',
                page: index + 1,
                index,
                active: index === safeActiveIndex,
            });
        }
    }

    items.push({
        type: 'nav',
        direction: 'next',
        targetIndex: Math.min(safeTotal - 1, safeActiveIndex + 1),
        disabled: safeActiveIndex >= safeTotal - 1,
    });

    return items;
}

export function resolveAgentSessionActionAvailability({
    archiveState = DEFAULT_ARCHIVE_STATE,
    attemptStatus = 'running',
} = {}) {
    if (archiveState !== DEFAULT_ARCHIVE_STATE) {
        return {
            canCancel: false,
            canRetry: false,
            canApply: false,
        };
    }

    const isRunning = attemptStatus === 'running';
    const isComplete = attemptStatus === 'complete';
    const isFailed = attemptStatus === 'failed';

    return {
        canCancel: true,
        canRetry: !isRunning,
        canApply: isComplete && !isFailed,
    };
}

function sanitizeExtension(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return '';
    const normalized = raw.startsWith('.') ? raw : `.${raw}`;
    return /^[.][a-z0-9]+$/.test(normalized) ? normalized : '';
}

function extensionFromFileName(fileName) {
    const matched = String(fileName || '').trim().match(/(\.[a-z0-9]+)$/i);
    return sanitizeExtension(matched?.[1] || '');
}

export function buildAgentAssetPath({
    hashHex,
    originalName = '',
    fallbackExtension = '.bin',
} = {}) {
    const normalizedHash = String(hashHex || '').trim().toLowerCase();
    if (!/^[a-f0-9]{32,}$/i.test(normalizedHash)) {
        throw new Error('Invalid asset hash');
    }
    const extension = extensionFromFileName(originalName) || sanitizeExtension(fallbackExtension) || '.bin';
    const shard = normalizedHash.slice(0, 2);
    return `assets/${shard}/${normalizedHash}${extension}`;
}
