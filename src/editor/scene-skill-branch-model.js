export const SCENE_SKILL_BRANCH_VERSION = 1;

export const SCENE_SKILL_STEP_KEYS = Object.freeze([
    'main-image',
    'top-view',
    'layout',
    'object-images',
    'components-3d',
    'insert-scene',
]);

function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cloneSerializable(value, fallback) {
    if (value === undefined) return fallback;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return fallback;
    }
}

function normalizeStringList(values) {
    return Array.isArray(values)
        ? values.map((value) => String(value || '').trim()).filter(Boolean)
        : [];
}

function sameStringList(left, right) {
    const normalizedLeft = normalizeStringList(left);
    const normalizedRight = normalizeStringList(right);
    return normalizedLeft.length === normalizedRight.length
        && normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function stepIndex(stepKey) {
    return SCENE_SKILL_STEP_KEYS.indexOf(String(stepKey || ''));
}

export function createSceneSkillParentScopeKey(stepKey, parentCandidateIds = []) {
    return JSON.stringify([String(stepKey || ''), ...normalizeStringList(parentCandidateIds)]);
}

export function createEmptySceneSkillBranch() {
    return {
        version: SCENE_SKILL_BRANCH_VERSION,
        revision: 0,
        candidatesById: {},
        candidateIdsByStep: Object.fromEntries(SCENE_SKILL_STEP_KEYS.map((key) => [key, []])),
        activeCandidateByStep: {},
        preferredChildByCandidateAndStep: {},
        activeExecutionByStep: {},
        activeTaskExecution: null,
    };
}

export function normalizeSceneSkillBranch(value) {
    const source = value && typeof value === 'object' ? value : {};
    const empty = createEmptySceneSkillBranch();
    const candidatesById = {};
    Object.entries(source.candidatesById && typeof source.candidatesById === 'object'
        ? source.candidatesById
        : {}).forEach(([id, candidate]) => {
        const normalized = normalizeSceneSkillCandidate({ ...candidate, id });
        if (normalized) candidatesById[normalized.id] = normalized;
    });
    const candidateIdsByStep = Object.fromEntries(SCENE_SKILL_STEP_KEYS.map((key) => {
        const indexed = normalizeStringList(source.candidateIdsByStep?.[key])
            .filter((id) => candidatesById[id]?.stepKey === key);
        const discovered = Object.values(candidatesById)
            .filter((candidate) => candidate.stepKey === key && !indexed.includes(candidate.id))
            .map((candidate) => candidate.id);
        return [key, [...indexed, ...discovered]];
    }));
    const activeCandidateByStep = {};
    SCENE_SKILL_STEP_KEYS.forEach((key) => {
        const id = String(source.activeCandidateByStep?.[key] || '').trim();
        if (candidatesById[id]?.stepKey === key) activeCandidateByStep[key] = id;
    });
    return {
        ...empty,
        version: SCENE_SKILL_BRANCH_VERSION,
        revision: Math.max(0, Number(source.revision) || 0),
        candidatesById,
        candidateIdsByStep,
        activeCandidateByStep,
        preferredChildByCandidateAndStep: cloneSerializable(source.preferredChildByCandidateAndStep, {}),
        activeExecutionByStep: cloneSerializable(source.activeExecutionByStep, {}),
        activeTaskExecution: cloneSerializable(source.activeTaskExecution, null),
    };
}

export function getSceneSkillActiveParentCandidateIds(branch, stepKey) {
    const normalized = normalizeSceneSkillBranch(branch);
    const index = stepIndex(stepKey);
    if (index < 0) return [];
    return SCENE_SKILL_STEP_KEYS.slice(0, index)
        .map((key) => normalized.activeCandidateByStep[key])
        .filter(Boolean);
}

export function normalizeSceneSkillCandidate(candidate = {}) {
    const id = String(candidate.id || '').trim();
    const stepKey = String(candidate.stepKey || '').trim();
    if (!id || stepIndex(stepKey) < 0) return null;
    const parentCandidateIds = normalizeStringList(candidate.parentCandidateIds);
    return {
        id,
        stepKey,
        parentCandidateIds,
        parentScopeKey: createSceneSkillParentScopeKey(stepKey, parentCandidateIds),
        executionId: String(candidate.executionId || '').trim(),
        ...(candidate.runId ? { runId: String(candidate.runId) } : {}),
        status: 'ready',
        createdAt: candidate.createdAt || new Date().toISOString(),
        context: cloneSerializable(candidate.context, {}),
        display: cloneSerializable(candidate.display, {}),
    };
}

export function createSceneSkillCandidate({
    id = createId('scene-candidate'),
    stepKey,
    parentCandidateIds = [],
    executionId = '',
    runId = '',
    context = {},
    display = {},
    createdAt = new Date().toISOString(),
} = {}) {
    return normalizeSceneSkillCandidate({
        id,
        stepKey,
        parentCandidateIds,
        executionId,
        runId,
        context,
        display,
        createdAt,
    });
}

function validateCandidateParents(branch, candidate) {
    const expectedParentIds = getSceneSkillActiveParentCandidateIds(branch, candidate.stepKey);
    if (!sameStringList(expectedParentIds, candidate.parentCandidateIds)) {
        throw new Error(`Invalid parent candidates for ${candidate.stepKey}`);
    }
    candidate.parentCandidateIds.forEach((id, parentIndex) => {
        const parent = branch.candidatesById[id];
        if (!parent || stepIndex(parent.stepKey) !== parentIndex) {
            throw new Error(`Invalid parent candidate: ${id}`);
        }
    });
}

export function getSceneSkillSiblingCandidates(branch, stepKey, parentCandidateIds = null) {
    const normalized = normalizeSceneSkillBranch(branch);
    const parents = parentCandidateIds === null
        ? getSceneSkillActiveParentCandidateIds(normalized, stepKey)
        : normalizeStringList(parentCandidateIds);
    const scopeKey = createSceneSkillParentScopeKey(stepKey, parents);
    return (normalized.candidateIdsByStep[stepKey] || [])
        .map((id) => normalized.candidatesById[id])
        .filter((candidate) => candidate?.parentScopeKey === scopeKey);
}

function findPreferredChild(branch, parentCandidateId, stepKey, parentCandidateIds) {
    const key = `${parentCandidateId}:${stepKey}`;
    const preferredId = String(branch.preferredChildByCandidateAndStep[key] || '').trim();
    const siblings = getSceneSkillSiblingCandidates(branch, stepKey, parentCandidateIds);
    if (preferredId && siblings.some((candidate) => candidate.id === preferredId)) return preferredId;
    return siblings.length === 1 ? siblings[0].id : '';
}

export function activateSceneSkillCandidate(branch, candidateId) {
    const normalized = normalizeSceneSkillBranch(branch);
    const candidate = normalized.candidatesById[String(candidateId || '')];
    if (!candidate) throw new Error(`Unknown scene candidate: ${candidateId}`);
    candidate.parentCandidateIds.forEach((parentId, index) => {
        if (normalized.activeCandidateByStep[SCENE_SKILL_STEP_KEYS[index]] !== parentId) {
            throw new Error('Candidate belongs to a different parent branch');
        }
    });
    const selectedIndex = stepIndex(candidate.stepKey);
    const activeCandidateByStep = { ...normalized.activeCandidateByStep };
    activeCandidateByStep[candidate.stepKey] = candidate.id;
    SCENE_SKILL_STEP_KEYS.slice(selectedIndex + 1).forEach((key) => delete activeCandidateByStep[key]);

    let activeParentIds = SCENE_SKILL_STEP_KEYS.slice(0, selectedIndex + 1)
        .map((key) => activeCandidateByStep[key])
        .filter(Boolean);
    let parentId = candidate.id;
    for (const childStepKey of SCENE_SKILL_STEP_KEYS.slice(selectedIndex + 1)) {
        const childId = findPreferredChild(normalized, parentId, childStepKey, activeParentIds);
        if (!childId) break;
        activeCandidateByStep[childStepKey] = childId;
        activeParentIds = [...activeParentIds, childId];
        parentId = childId;
    }

    const preferredChildByCandidateAndStep = { ...normalized.preferredChildByCandidateAndStep };
    const parentStepKey = SCENE_SKILL_STEP_KEYS[selectedIndex - 1];
    const parentCandidateId = parentStepKey ? activeCandidateByStep[parentStepKey] : '__root__';
    preferredChildByCandidateAndStep[`${parentCandidateId}:${candidate.stepKey}`] = candidate.id;
    return {
        ...normalized,
        revision: normalized.revision + 1,
        activeCandidateByStep,
        preferredChildByCandidateAndStep,
        activeExecutionByStep: {},
    };
}

export function appendSceneSkillCandidate(branch, candidateInput, { activate = true } = {}) {
    const normalized = normalizeSceneSkillBranch(branch);
    const candidate = normalizeSceneSkillCandidate(candidateInput);
    if (!candidate) throw new Error('Invalid scene candidate');
    if (normalized.candidatesById[candidate.id]) throw new Error(`Duplicate scene candidate: ${candidate.id}`);
    validateCandidateParents(normalized, candidate);
    const next = {
        ...normalized,
        candidatesById: { ...normalized.candidatesById, [candidate.id]: candidate },
        candidateIdsByStep: {
            ...normalized.candidateIdsByStep,
            [candidate.stepKey]: [...(normalized.candidateIdsByStep[candidate.stepKey] || []), candidate.id],
        },
    };
    if (!activate) return { ...next, revision: next.revision + 1 };
    return activateSceneSkillCandidate(next, candidate.id);
}

export function getSceneSkillActiveCandidate(branch, stepKey) {
    const normalized = normalizeSceneSkillBranch(branch);
    return normalized.candidatesById[normalized.activeCandidateByStep[stepKey]] || null;
}

export function getSceneSkillCandidateGallery(branch, stepKey) {
    const normalized = normalizeSceneSkillBranch(branch);
    const candidate = getSceneSkillActiveCandidate(normalized, stepKey);
    if (!candidate) {
        return {
            candidate: null,
            images: [],
            selectedImageIndex: 0,
            candidateIds: [],
            candidateIndex: 0,
        };
    }
    const siblings = getSceneSkillSiblingCandidates(normalized, stepKey, candidate.parentCandidateIds);
    const images = Array.isArray(candidate.context?.images) ? candidate.context.images : [];
    return {
        candidate,
        images,
        selectedImageIndex: Math.max(0, Math.min(
            images.length - 1,
            Number(candidate.context?.selectedImageIndex) || 0,
        )),
        candidateIds: siblings.map((item) => item.id),
        candidateIndex: Math.max(0, siblings.findIndex((item) => item.id === candidate.id)),
    };
}

export function updateSceneSkillActiveCandidate(branch, stepKey, { context, display } = {}) {
    const normalized = normalizeSceneSkillBranch(branch);
    const candidateId = normalized.activeCandidateByStep[String(stepKey || '')];
    const candidate = normalized.candidatesById[candidateId];
    if (!candidate) return normalized;
    return {
        ...normalized,
        revision: normalized.revision + 1,
        candidatesById: {
            ...normalized.candidatesById,
            [candidateId]: {
                ...candidate,
                ...(context ? { context: { ...candidate.context, ...cloneSerializable(context, {}) } } : {}),
                ...(display ? { display: { ...candidate.display, ...cloneSerializable(display, {}) } } : {}),
            },
        },
    };
}

export function setSceneSkillStageExecution(branch, stepKey, executionRef = null) {
    const normalized = normalizeSceneSkillBranch(branch);
    const activeExecutionByStep = { ...normalized.activeExecutionByStep };
    if (executionRef) activeExecutionByStep[stepKey] = cloneSerializable(executionRef, null);
    else delete activeExecutionByStep[stepKey];
    return { ...normalized, activeExecutionByStep };
}

export function interruptSceneSkillBranchExecutions(branch) {
    const normalized = normalizeSceneSkillBranch(branch);
    const hadExecutions = Object.keys(normalized.activeExecutionByStep).length > 0
        || Boolean(normalized.activeTaskExecution);
    return {
        ...normalized,
        revision: normalized.revision + (hadExecutions ? 1 : 0),
        activeExecutionByStep: {},
        activeTaskExecution: null,
    };
}

export function resolveActiveSceneSkillContext(branch, targetStepKey = '') {
    const normalized = normalizeSceneSkillBranch(branch);
    const targetIndex = targetStepKey ? stepIndex(targetStepKey) : SCENE_SKILL_STEP_KEYS.length;
    const candidatesByStep = {};
    SCENE_SKILL_STEP_KEYS.forEach((key, index) => {
        if (targetIndex >= 0 && index >= targetIndex) return;
        const candidate = getSceneSkillActiveCandidate(normalized, key);
        if (candidate) candidatesByStep[key] = cloneSerializable(candidate.context, {});
    });
    return {
        revision: normalized.revision,
        parentCandidateIds: targetStepKey
            ? getSceneSkillActiveParentCandidateIds(normalized, targetStepKey)
            : Object.values(normalized.activeCandidateByStep),
        candidatesByStep,
    };
}

export function createSceneSkillExecutionRef({
    executionId = createId('scene-execution'),
    requestKind = 'stage',
    attemptId,
    stepKey = '',
    branch,
    parentCandidateIds = null,
    startedAt = new Date().toISOString(),
} = {}) {
    const normalized = normalizeSceneSkillBranch(branch);
    return {
        executionId,
        requestKind,
        attemptId: String(attemptId || ''),
        ...(stepKey ? { stepKey: String(stepKey) } : {}),
        baseRevision: normalized.revision,
        parentCandidateIds: parentCandidateIds === null
            ? getSceneSkillActiveParentCandidateIds(normalized, stepKey)
            : normalizeStringList(parentCandidateIds),
        startedAt,
    };
}

export function isSceneSkillExecutionCurrent(branch, executionRef, response = {}) {
    if (!executionRef?.executionId) return false;
    const normalized = normalizeSceneSkillBranch(branch);
    const activeExecution = executionRef.requestKind === 'task'
        ? normalized.activeTaskExecution
        : normalized.activeExecutionByStep[executionRef.stepKey];
    return activeExecution?.executionId === executionRef.executionId
        && normalized.revision === executionRef.baseRevision
        && String(response.executionId || executionRef.executionId) === executionRef.executionId
        && String(response.attemptId || executionRef.attemptId) === executionRef.attemptId
        && String(response.stepKey || executionRef.stepKey || '') === String(executionRef.stepKey || '')
        && sameStringList(response.parentCandidateIds ?? executionRef.parentCandidateIds, executionRef.parentCandidateIds);
}

function candidateContextFromBlock(block) {
    const images = cloneSerializable(Array.isArray(block?.images) ? block.images : [], []);
    return {
        ...cloneSerializable(block?.sceneCandidateContext, {}),
        images,
        selectedImageIndex: Math.max(0, Math.min(images.length - 1, Number(block?.selectedIndex) || 0)),
        artifacts: cloneSerializable(Array.isArray(block?.artifacts) ? block.artifacts : [], []),
        ...(block?.sceneInsertPlan && typeof block.sceneInsertPlan === 'object'
            ? { sceneInsertPlan: cloneSerializable(block.sceneInsertPlan, {}) }
            : {}),
    };
}

export function migrateLegacySceneSkillAttempt(attempt) {
    if (!attempt || attempt.workflow !== 'scene-build') return attempt;
    if (attempt.sceneBranch?.version === SCENE_SKILL_BRANCH_VERSION) {
        return { ...attempt, sceneBranch: normalizeSceneSkillBranch(attempt.sceneBranch) };
    }
    const blocks = Array.isArray(attempt.steps) && attempt.steps.length > 0
        ? attempt.steps
        : Array.isArray(attempt.blocks) ? attempt.blocks : [];
    let sceneBranch = createEmptySceneSkillBranch();
    for (const stepKey of SCENE_SKILL_STEP_KEYS) {
        const block = blocks.find((item) => item?.stepKey === stepKey);
        const hasResult = Array.isArray(block?.images) && block.images.length > 0
            || block?.sceneInsertPlan && typeof block.sceneInsertPlan === 'object';
        if (!hasResult) break;
        const candidate = createSceneSkillCandidate({
            id: `${attempt.id || 'legacy'}-${stepKey}-candidate-1`,
            stepKey,
            parentCandidateIds: getSceneSkillActiveParentCandidateIds(sceneBranch, stepKey),
            context: candidateContextFromBlock(block),
            display: {
                statusText: String(block.statusText || ''),
                statusId: String(block.statusId || 'done'),
                applied: Boolean(block.applied),
                actions: cloneSerializable(block.actions, []),
            },
            createdAt: attempt.createdAt,
        });
        sceneBranch = appendSceneSkillCandidate(sceneBranch, candidate);
    }
    return {
        ...attempt,
        sceneBranch: {
            ...sceneBranch,
            migratedFromLegacy: true,
        },
    };
}
