export const SCENE_BUILD_WORKFLOW = 'scene-build' as const;

export const SCENE_BUILD_STEP_KEYS = [
  'main-image',
  'top-view',
  'layout',
  'components-3d',
  'insert-scene',
] as const;

export const SCENE_BUILD_STATUS_IDS = [
  'pending',
  'running',
  'done',
  'failed',
  'canceled',
] as const;

export const SCENE_BUILD_ACTION_IDS = [
  'cancel',
  'retry',
  'apply',
] as const;

export type SceneBuildStepKey = typeof SCENE_BUILD_STEP_KEYS[number];
export type SceneBuildStatusId = typeof SCENE_BUILD_STATUS_IDS[number];
export type SceneBuildActionId = typeof SCENE_BUILD_ACTION_IDS[number];

export interface SceneBuildAssetReference {
  assetId: string;
  hash: string;
  path: string;
  mimeType?: string;
  bytes?: number;
  kind?: string;
  provenance?: Record<string, unknown>;
}

export interface SceneBuildStageError {
  message: string;
  details?: unknown;
}

export interface SceneBuildStagePayload {
  workflow: typeof SCENE_BUILD_WORKFLOW;
  stepKey: SceneBuildStepKey;
  statusId: SceneBuildStatusId;
  actions: SceneBuildActionId[];
  assetReferences: SceneBuildAssetReference[];
  sessionId?: string;
  attemptId?: string;
  sourcePrompt?: string;
  sceneInsertPlan?: Record<string, unknown>;
  error?: SceneBuildStageError;
  metadata?: Record<string, unknown>;
}

const SHA256_HEX_RE = /^[0-9a-f]{64}$/i;
const CANONICAL_ASSET_PATH_RE = /^assets\/([0-9a-f]{64})\.([^/]+)$/i;

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeNonEmptyString(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function normalizeProjectRelativePath(value: unknown): string {
  const normalized = normalizeNonEmptyString(value).replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('\0')) return '';
  if (normalized.startsWith('/') || /^[a-z]:\//i.test(normalized)) return '';
  if (normalized.split('/').some((part) => part === '' || part === '..')) return '';
  return normalized;
}

function uniqueArray<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function isSceneBuildStepKey(value: unknown): value is SceneBuildStepKey {
  return SCENE_BUILD_STEP_KEYS.includes(value as SceneBuildStepKey);
}

export function normalizeSceneBuildStepKey(value: unknown): SceneBuildStepKey | '' {
  const normalized = normalizeNonEmptyString(value).replace(/_/g, '-');
  return isSceneBuildStepKey(normalized) ? normalized : '';
}

export function normalizeSceneBuildStatusId(value: unknown): SceneBuildStatusId | '' {
  const normalized = normalizeNonEmptyString(value).toLowerCase();
  if (SCENE_BUILD_STATUS_IDS.includes(normalized as SceneBuildStatusId)) {
    return normalized as SceneBuildStatusId;
  }
  if (normalized === 'complete' || normalized === 'completed') return 'done';
  if (normalized === 'cancel' || normalized === 'cancelled') return 'canceled';
  if (normalized === 'fail' || normalized === 'error') return 'failed';
  return '';
}

export function normalizeSceneBuildActionId(value: unknown): SceneBuildActionId | '' {
  const normalized = normalizeNonEmptyString(value).toLowerCase();
  return SCENE_BUILD_ACTION_IDS.includes(normalized as SceneBuildActionId)
    ? normalized as SceneBuildActionId
    : '';
}

export function isCanonicalAssetPath(value: unknown): value is string {
  return CANONICAL_ASSET_PATH_RE.test(normalizeProjectRelativePath(value));
}

export function hashFromCanonicalAssetPath(value: unknown): string {
  const match = normalizeProjectRelativePath(value).match(CANONICAL_ASSET_PATH_RE);
  return match?.[1]?.toLowerCase() || '';
}

export function normalizeSceneBuildAssetReference(value: unknown): SceneBuildAssetReference | null {
  const outer = readRecord(value);
  const record = Object.keys(readRecord(outer.assetReference)).length > 0
    ? readRecord(outer.assetReference)
    : (Object.keys(readRecord(outer.assetRef)).length > 0 ? readRecord(outer.assetRef) : outer);
  const assetPath = normalizeProjectRelativePath(
    record.path
      ?? record.canonicalPath
      ?? record.relativePath
      ?? record.assetPath
      ?? record.modelPath
  );
  const pathHash = hashFromCanonicalAssetPath(assetPath);
  if (!pathHash) return null;

  const explicitHash = normalizeNonEmptyString(record.hash).toLowerCase();
  if (explicitHash && (!SHA256_HEX_RE.test(explicitHash) || explicitHash !== pathHash)) {
    return null;
  }

  const explicitAssetId = normalizeNonEmptyString(record.assetId);
  if (explicitAssetId.startsWith('sha256:') && explicitAssetId.slice('sha256:'.length).toLowerCase() !== pathHash) {
    return null;
  }

  const bytes = Number(record.bytes);
  const mimeType = normalizeNonEmptyString(record.mimeType);
  const kind = normalizeNonEmptyString(record.kind);
  const provenance = readRecord(record.provenance);

  return {
    assetId: explicitAssetId || `sha256:${pathHash}`,
    hash: pathHash,
    path: assetPath,
    ...(mimeType ? { mimeType } : {}),
    ...(Number.isFinite(bytes) && bytes >= 0 ? { bytes } : {}),
    ...(kind ? { kind } : {}),
    ...(Object.keys(provenance).length > 0 ? { provenance } : {}),
  };
}

function collectAssetReferences(value: unknown): SceneBuildAssetReference[] {
  const record = readRecord(value);
  const candidates = [
    record.assetReference,
    record.assetRef,
    record,
    ...(Array.isArray(record.assetReferences) ? record.assetReferences : []),
    ...(Array.isArray(record.assetRefs) ? record.assetRefs : []),
    ...(Array.isArray(record.assets) ? record.assets : []),
  ];
  const references = candidates
    .map((candidate) => normalizeSceneBuildAssetReference(candidate))
    .filter((candidate): candidate is SceneBuildAssetReference => Boolean(candidate));
  const seen = new Set<string>();
  return references.filter((reference) => {
    if (seen.has(reference.assetId)) return false;
    seen.add(reference.assetId);
    return true;
  });
}

function normalizeStageError(value: unknown): SceneBuildStageError | undefined {
  const record = readRecord(value);
  const message = normalizeNonEmptyString(record.message ?? value);
  if (!message) return undefined;
  return {
    message,
    ...(Object.prototype.hasOwnProperty.call(record, 'details') ? { details: record.details } : {}),
  };
}

export function normalizeSceneBuildStagePayload(value: unknown): SceneBuildStagePayload | null {
  const record = readRecord(value);
  const workflow = normalizeNonEmptyString(record.workflow);
  if (workflow && workflow !== SCENE_BUILD_WORKFLOW) return null;
  const stepKey = normalizeSceneBuildStepKey(record.stepKey ?? record.stageKey ?? record.stage);
  if (!stepKey) return null;
  const statusId = normalizeSceneBuildStatusId(record.statusId ?? record.statusKey ?? record.state ?? record.status) || 'pending';
  const actionValues = Array.isArray(record.actions) ? record.actions : [];
  const actions = uniqueArray(
    actionValues
      .map((action) => normalizeSceneBuildActionId(action))
      .filter((action): action is SceneBuildActionId => Boolean(action))
  );
  const sessionId = normalizeNonEmptyString(record.sessionId);
  const attemptId = normalizeNonEmptyString(record.attemptId);
  const sourcePrompt = normalizeNonEmptyString(record.sourcePrompt);
  const sceneInsertPlan = readRecord(record.sceneInsertPlan);
  const metadata = readRecord(record.metadata);
  const error = normalizeStageError(record.error);

  return {
    workflow: SCENE_BUILD_WORKFLOW,
    stepKey,
    statusId,
    actions,
    assetReferences: collectAssetReferences(record),
    ...(sessionId ? { sessionId } : {}),
    ...(attemptId ? { attemptId } : {}),
    ...(sourcePrompt ? { sourcePrompt } : {}),
    ...(Object.keys(sceneInsertPlan).length > 0 ? { sceneInsertPlan } : {}),
    ...(error ? { error } : {}),
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
}
