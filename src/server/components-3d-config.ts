export type Components3DGenerationProvider = 'mocked' | 'hunyuan' | 'trellis.2';

export interface Components3DEndpointConfig {
  host: string;
  port: string;
  baseUrl: string;
  secretId: string;
  secretKey: string;
  hasSecretKey?: boolean;
  region: string;
  version: string;
  model: string;
  pollIntervalSeconds: number;
  maxWaitSeconds: number;
  callbackUrl: string;
  downloadBaseUrl: string;
}

export interface Components3DGenerationConfig {
  provider: Components3DGenerationProvider;
  hunyuan: Components3DEndpointConfig;
  trellis2: Components3DEndpointConfig;
}

export interface CodexApiConfig {
  apiKey: string;
  hasApiKey?: boolean;
}

export interface PipelineApiConfig {
  apiKey: string;
  hasApiKey?: boolean;
  apiBase: string;
  apiProvider: string;
  modelName: string;
  imageUrl: string;
  imageModel: string;
  imageTimeoutMs: number;
}

export interface UserApiConfig {
  schema: 'visionary.user_api_config';
  version: 1;
  user: string;
  userId: string;
  codex: CodexApiConfig;
  pipelineApi: PipelineApiConfig;
  components3D: Components3DGenerationConfig;
}

export type ClientUserApiConfig = Omit<UserApiConfig, 'codex' | 'pipelineApi'> & {
  codex: CodexApiConfig & { hasApiKey: boolean };
  pipelineApi: PipelineApiConfig & { hasApiKey: boolean };
};

export class UserApiConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserApiConfigValidationError';
  }
}

const USER_API_CONFIG_SCHEMA = 'visionary.user_api_config';
const USER_API_CONFIG_VERSION = 1;
const MAX_CONFIG_STRING_LENGTH = 2048;
const MAX_SECRET_STRING_LENGTH = 4096;
const DEFAULT_PIPELINE_API_BASE = 'https://api.apiyi.com';
const DEFAULT_PIPELINE_IMAGE_MODEL = 'gemini-3.1-flash-image-preview';

const DEFAULT_HUNYUAN_ENDPOINT: Components3DEndpointConfig = {
  host: 'ai3d.tencentcloudapi.com',
  port: '',
  baseUrl: 'https://ai3d.tencentcloudapi.com',
  secretId: '',
  secretKey: '',
  region: 'ap-guangzhou',
  version: '2025-05-13',
  model: '3.1',
  pollIntervalSeconds: 15,
  maxWaitSeconds: 600,
  callbackUrl: '',
  downloadBaseUrl: '',
};

const DEFAULT_TRELLIS2_ENDPOINT: Components3DEndpointConfig = {
  host: '127.0.0.1',
  port: '25367',
  baseUrl: '',
  secretId: '',
  secretKey: '',
  region: '',
  version: '',
  model: 'TRELLIS.2-1024',
  pollIntervalSeconds: 5,
  maxWaitSeconds: 1800,
  callbackUrl: '',
  downloadBaseUrl: '',
};

const DEFAULT_PIPELINE_API_CONFIG: PipelineApiConfig = {
  apiKey: '',
  apiBase: DEFAULT_PIPELINE_API_BASE,
  apiProvider: 'gemini',
  modelName: 'gemini-3.1-pro-preview',
  imageUrl: `${DEFAULT_PIPELINE_API_BASE}/v1beta/models/${DEFAULT_PIPELINE_IMAGE_MODEL}:generateContent`,
  imageModel: DEFAULT_PIPELINE_IMAGE_MODEL,
  imageTimeoutMs: 300_000,
};

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function hasOwnRecordValue(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function stringValue(value: unknown, fallback = ''): string {
  const normalized = String(value ?? fallback).trim();
  if (normalized.length > MAX_CONFIG_STRING_LENGTH || /[\u0000-\u001f]/.test(normalized)) {
    throw new UserApiConfigValidationError('api config contains an invalid string value');
  }
  return normalized;
}

function secretStringValue(value: unknown, fallback = ''): string {
  const normalized = String(value ?? fallback).trim();
  if (normalized.length > MAX_SECRET_STRING_LENGTH || /[\u0000-\u001f]/.test(normalized)) {
    throw new UserApiConfigValidationError('api config contains an invalid secret value');
  }
  return normalized;
}

function preservedSecretValue(value: unknown, previousValue = '', fallback = ''): string {
  const next = secretStringValue(value ?? '');
  if (next) return next;
  return secretStringValue(previousValue || fallback);
}

function optionalHttpUrl(value: unknown, fieldName: string): string {
  const normalized = stringValue(value);
  if (!normalized) return '';
  try {
    const url = new URL(normalized);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('unsupported protocol');
    }
    return normalized.replace(/\/+$/, '');
  } catch {
    throw new UserApiConfigValidationError(`${fieldName} must be an http(s) URL`);
  }
}

function normalizeRequiredHttpUrl(value: unknown, fallback: string, fieldName: string): string {
  return optionalHttpUrl(value ?? fallback, fieldName) || fallback;
}

function normalizeApiBaseUrl(value: unknown, fallback: string, fieldName: string): string {
  return normalizeRequiredHttpUrl(value, fallback, fieldName).replace(/\/v1\/?$/, '');
}

function normalizePort(value: unknown, fallback: string): string {
  const normalized = stringValue(value, fallback);
  if (!normalized) return '';
  const numeric = Number(normalized);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 65535) {
    throw new UserApiConfigValidationError('api config port must be between 1 and 65535');
  }
  return String(numeric);
}

function normalizeSeconds(value: unknown, fallback: number, min: number, max: number, fieldName: string): number {
  const numeric = Number(value ?? fallback);
  if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
    throw new UserApiConfigValidationError(`${fieldName} is out of range`);
  }
  return numeric;
}

export function normalizeComponents3DGenerationProvider(value: unknown): Components3DGenerationProvider {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'mock' || normalized === 'mocked' || normalized === 'demo') return 'mocked';
  if (normalized === 'hunyuan' || normalized === 'hunyuan-api' || normalized === 'hunyuan_api') return 'hunyuan';
  if (
    normalized === 'trellis.2'
    || normalized === 'trellis2'
    || normalized === 'trellis-2'
    || normalized === 'trellis-api'
    || normalized === 'trellis_api'
  ) {
    return 'trellis.2';
  }
  if (!normalized) return 'mocked';
  throw new UserApiConfigValidationError('unsupported 3d generation provider');
}

export function defaultComponents3DGenerationConfig(): Components3DGenerationConfig {
  return {
    provider: 'mocked',
    hunyuan: { ...DEFAULT_HUNYUAN_ENDPOINT },
    trellis2: { ...DEFAULT_TRELLIS2_ENDPOINT },
  };
}

export function defaultCodexApiConfig(): CodexApiConfig {
  return {
    apiKey: '',
  };
}

export function defaultPipelineApiConfig(): PipelineApiConfig {
  return {
    ...DEFAULT_PIPELINE_API_CONFIG,
  };
}

function recordValueOrFallback(
  record: Record<string, unknown>,
  keys: string[],
  fallback: unknown,
): unknown {
  for (const key of keys) {
    if (hasOwnRecordValue(record, key)) return record[key];
  }
  return fallback;
}

function normalizeEndpointConfig(
  value: unknown,
  defaults: Components3DEndpointConfig,
  previous?: Components3DEndpointConfig,
): Components3DEndpointConfig {
  const record = readRecord(value);
  const secretKey = preservedSecretValue(
    recordValueOrFallback(record, ['secretKey', 'TENCENT_SECRET_KEY'], ''),
    previous?.secretKey,
    defaults.secretKey,
  );
  return {
    host: stringValue(record.host, previous?.host || defaults.host),
    port: normalizePort(record.port, previous?.port || defaults.port),
    baseUrl: optionalHttpUrl(
      recordValueOrFallback(record, ['baseUrl', 'baseURL'], previous?.baseUrl || defaults.baseUrl),
      'baseUrl',
    ),
    secretId: stringValue(
      recordValueOrFallback(record, ['secretId', 'TENCENT_SECRET_ID'], previous?.secretId || defaults.secretId),
      previous?.secretId || defaults.secretId,
    ),
    secretKey,
    hasSecretKey: Boolean(secretKey),
    region: stringValue(
      recordValueOrFallback(record, ['region', 'HUNYUAN_REGION'], previous?.region || defaults.region),
      previous?.region || defaults.region,
    ) || defaults.region,
    version: stringValue(
      recordValueOrFallback(record, ['version', 'HUNYUAN_VERSION'], previous?.version || defaults.version),
      previous?.version || defaults.version,
    ) || defaults.version,
    model: stringValue(record.model, previous?.model || defaults.model) || defaults.model,
    pollIntervalSeconds: normalizeSeconds(
      record.pollIntervalSeconds ?? record.pollInterval,
      previous?.pollIntervalSeconds || defaults.pollIntervalSeconds,
      0.2,
      3600,
      'pollIntervalSeconds',
    ),
    maxWaitSeconds: normalizeSeconds(
      record.maxWaitSeconds ?? record.maxWait,
      previous?.maxWaitSeconds || defaults.maxWaitSeconds,
      1,
      86400,
      'maxWaitSeconds',
    ),
    callbackUrl: optionalHttpUrl(
      recordValueOrFallback(record, ['callbackUrl', 'callbackURL'], previous?.callbackUrl || defaults.callbackUrl),
      'callbackUrl',
    ),
    downloadBaseUrl: optionalHttpUrl(
      recordValueOrFallback(record, ['downloadBaseUrl', 'downloadBaseURL'], previous?.downloadBaseUrl || defaults.downloadBaseUrl),
      'downloadBaseUrl',
    ),
  };
}

export function normalizeComponents3DGenerationConfig(
  value: unknown,
  previous?: Components3DGenerationConfig,
): Components3DGenerationConfig {
  const defaults = defaultComponents3DGenerationConfig();
  const record = readRecord(value);
  return {
    provider: normalizeComponents3DGenerationProvider(record.provider ?? previous?.provider ?? defaults.provider),
    hunyuan: normalizeEndpointConfig(record.hunyuan, defaults.hunyuan, previous?.hunyuan),
    trellis2: normalizeEndpointConfig(record.trellis2 ?? record.trellis, defaults.trellis2, previous?.trellis2),
  };
}

export function normalizeCodexApiConfig(value: unknown, previous?: CodexApiConfig): CodexApiConfig {
  const defaults = defaultCodexApiConfig();
  const record = readRecord(value);
  return {
    apiKey: preservedSecretValue(record.apiKey ?? record.key ?? record.CODEX_API_KEY, previous?.apiKey, defaults.apiKey),
  };
}

export function normalizePipelineApiConfig(value: unknown, previous?: PipelineApiConfig): PipelineApiConfig {
  const defaults = defaultPipelineApiConfig();
  const record = readRecord(value);
  const imageTimeoutMsValue = record.imageTimeoutMs
    ?? record.timeoutMs
    ?? (record.imageTimeoutSeconds == null ? undefined : Number(record.imageTimeoutSeconds) * 1000);
  return {
    apiKey: preservedSecretValue(
      record.apiKey ?? record.key ?? record.GENAI_API_KEY ?? record.GEMINI_API_KEY,
      previous?.apiKey,
      defaults.apiKey,
    ),
    apiBase: normalizeApiBaseUrl(
      record.apiBase ?? record.baseUrl ?? record.GENAI_API_BASE ?? record.GEMINI_BASE_URL,
      previous?.apiBase || defaults.apiBase,
      'pipeline apiBase',
    ),
    apiProvider: stringValue(
      record.apiProvider ?? record.provider ?? record.LLM_API_PROVIDER,
      previous?.apiProvider || defaults.apiProvider,
    ) || defaults.apiProvider,
    modelName: stringValue(
      record.modelName ?? record.model ?? record.LLM_MODEL_NAME ?? record.GEMINI_MODEL,
      previous?.modelName || defaults.modelName,
    ) || defaults.modelName,
    imageUrl: normalizeRequiredHttpUrl(
      record.imageUrl ?? record.GEMINI_IMAGE_URL ?? record.VISIONARY_GEMINI_IMAGE_URL,
      previous?.imageUrl || defaults.imageUrl,
      'pipeline imageUrl',
    ),
    imageModel: stringValue(
      record.imageModel ?? record.GEMINI_IMAGE_MODEL,
      previous?.imageModel || defaults.imageModel,
    ) || defaults.imageModel,
    imageTimeoutMs: normalizeSeconds(
      imageTimeoutMsValue,
      previous?.imageTimeoutMs || defaults.imageTimeoutMs,
      1,
      86_400_000,
      'pipeline imageTimeoutMs',
    ),
  };
}

export function defaultUserApiConfig(user: string, userId: string): UserApiConfig {
  return {
    schema: USER_API_CONFIG_SCHEMA,
    version: USER_API_CONFIG_VERSION,
    user,
    userId,
    codex: defaultCodexApiConfig(),
    pipelineApi: defaultPipelineApiConfig(),
    components3D: defaultComponents3DGenerationConfig(),
  };
}

export function normalizeUserApiConfig(
  value: unknown,
  user: string,
  userId: string,
  previous?: UserApiConfig,
): UserApiConfig {
  const defaults = defaultUserApiConfig(user, userId);
  const record = readRecord(value);
  return {
    schema: USER_API_CONFIG_SCHEMA,
    version: USER_API_CONFIG_VERSION,
    user,
    userId,
    codex: normalizeCodexApiConfig(record.codex ?? record.codexAuth, previous?.codex ?? defaults.codex),
    pipelineApi: normalizePipelineApiConfig(record.pipelineApi ?? record.pipeline ?? record.apiyi, previous?.pipelineApi ?? defaults.pipelineApi),
    components3D: normalizeComponents3DGenerationConfig(
      record.components3D ?? previous?.components3D ?? defaults.components3D,
      previous?.components3D ?? defaults.components3D,
    ),
  };
}

function redactEndpointConfigForClient(config: Components3DEndpointConfig): Components3DEndpointConfig {
  return {
    ...config,
    secretKey: '',
    hasSecretKey: Boolean(config.secretKey),
  };
}

export function redactUserApiConfigForClient(config: UserApiConfig): ClientUserApiConfig {
  return {
    ...config,
    codex: {
      ...config.codex,
      apiKey: '',
      hasApiKey: Boolean(config.codex.apiKey),
    },
    pipelineApi: {
      ...config.pipelineApi,
      apiKey: '',
      hasApiKey: Boolean(config.pipelineApi.apiKey),
    },
    components3D: {
      ...config.components3D,
      hunyuan: redactEndpointConfigForClient(config.components3D.hunyuan),
      trellis2: redactEndpointConfigForClient(config.components3D.trellis2),
    },
  };
}

function envString(env: Record<string, string | undefined>, key: string): string {
  return String(env[key] || '').trim();
}

export function resolveComponents3DGenerationConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): Components3DGenerationConfig {
  const defaults = defaultComponents3DGenerationConfig();
  return normalizeComponents3DGenerationConfig({
    provider: envString(env, 'VISIONARY_COMPONENTS_3D_PROVIDER') || defaults.provider,
    hunyuan: {
      host: envString(env, 'VISIONARY_COMPONENTS_3D_HUNYUAN_HOST') || defaults.hunyuan.host,
      port: envString(env, 'VISIONARY_COMPONENTS_3D_HUNYUAN_PORT') || defaults.hunyuan.port,
      baseUrl: envString(env, 'VISIONARY_COMPONENTS_3D_HUNYUAN_BASE_URL') || defaults.hunyuan.baseUrl,
      secretId: envString(env, 'VISIONARY_COMPONENTS_3D_HUNYUAN_SECRET_ID') || envString(env, 'TENCENT_SECRET_ID') || defaults.hunyuan.secretId,
      secretKey: envString(env, 'VISIONARY_COMPONENTS_3D_HUNYUAN_SECRET_KEY') || envString(env, 'TENCENT_SECRET_KEY') || defaults.hunyuan.secretKey,
      region: envString(env, 'VISIONARY_COMPONENTS_3D_HUNYUAN_REGION') || envString(env, 'HUNYUAN_REGION') || defaults.hunyuan.region,
      version: envString(env, 'VISIONARY_COMPONENTS_3D_HUNYUAN_VERSION') || envString(env, 'HUNYUAN_VERSION') || defaults.hunyuan.version,
      model: envString(env, 'VISIONARY_COMPONENTS_3D_HUNYUAN_MODEL') || defaults.hunyuan.model,
      pollIntervalSeconds: envString(env, 'VISIONARY_COMPONENTS_3D_HUNYUAN_POLL_INTERVAL_SECONDS') || defaults.hunyuan.pollIntervalSeconds,
      maxWaitSeconds: envString(env, 'VISIONARY_COMPONENTS_3D_HUNYUAN_MAX_WAIT_SECONDS') || defaults.hunyuan.maxWaitSeconds,
      callbackUrl: envString(env, 'VISIONARY_COMPONENTS_3D_HUNYUAN_CALLBACK_URL') || defaults.hunyuan.callbackUrl,
      downloadBaseUrl: envString(env, 'VISIONARY_COMPONENTS_3D_HUNYUAN_DOWNLOAD_BASE_URL') || defaults.hunyuan.downloadBaseUrl,
    },
    trellis2: {
      host: envString(env, 'VISIONARY_COMPONENTS_3D_TRELLIS_HOST') || defaults.trellis2.host,
      port: envString(env, 'VISIONARY_COMPONENTS_3D_TRELLIS_PORT') || defaults.trellis2.port,
      baseUrl: envString(env, 'VISIONARY_COMPONENTS_3D_TRELLIS_BASE_URL') || defaults.trellis2.baseUrl,
      secretId: envString(env, 'VISIONARY_COMPONENTS_3D_TRELLIS_SECRET_ID') || defaults.trellis2.secretId,
      secretKey: envString(env, 'VISIONARY_COMPONENTS_3D_TRELLIS_SECRET_KEY') || defaults.trellis2.secretKey,
      region: envString(env, 'VISIONARY_COMPONENTS_3D_TRELLIS_REGION') || defaults.trellis2.region,
      version: envString(env, 'VISIONARY_COMPONENTS_3D_TRELLIS_VERSION') || defaults.trellis2.version,
      model: envString(env, 'VISIONARY_COMPONENTS_3D_TRELLIS_MODEL') || defaults.trellis2.model,
      pollIntervalSeconds: envString(env, 'VISIONARY_COMPONENTS_3D_TRELLIS_POLL_INTERVAL_SECONDS') || defaults.trellis2.pollIntervalSeconds,
      maxWaitSeconds: envString(env, 'VISIONARY_COMPONENTS_3D_TRELLIS_MAX_WAIT_SECONDS') || defaults.trellis2.maxWaitSeconds,
      callbackUrl: envString(env, 'VISIONARY_COMPONENTS_3D_TRELLIS_CALLBACK_URL') || defaults.trellis2.callbackUrl,
      downloadBaseUrl: envString(env, 'VISIONARY_COMPONENTS_3D_TRELLIS_DOWNLOAD_BASE_URL') || defaults.trellis2.downloadBaseUrl,
    },
  });
}

export function activeComponents3DEndpointConfig(config: Components3DGenerationConfig): Components3DEndpointConfig | null {
  if (config.provider === 'hunyuan') return config.hunyuan;
  if (config.provider === 'trellis.2') return config.trellis2;
  return null;
}

export function components3DEndpointBaseUrl(config: Components3DEndpointConfig): string {
  if (config.baseUrl) return config.baseUrl.replace(/\/+$/, '');
  if (!config.host) {
    throw new UserApiConfigValidationError('3d generation api host or baseUrl is required');
  }
  if (config.host.startsWith('http://') || config.host.startsWith('https://')) {
    return config.host.replace(/\/+$/, '');
  }
  if (!config.port) {
    throw new UserApiConfigValidationError('3d generation api port is required when baseUrl is empty');
  }
  return `http://${config.host}:${config.port}`;
}

export function components3DGenerationConfigToEnv(config: Components3DGenerationConfig): Record<string, string> {
  return {
    VISIONARY_COMPONENTS_3D_PROVIDER: config.provider,
    VISIONARY_COMPONENTS_3D_HUNYUAN_HOST: config.hunyuan.host,
    VISIONARY_COMPONENTS_3D_HUNYUAN_PORT: config.hunyuan.port,
    VISIONARY_COMPONENTS_3D_HUNYUAN_BASE_URL: config.hunyuan.baseUrl,
    VISIONARY_COMPONENTS_3D_HUNYUAN_SECRET_ID: config.hunyuan.secretId,
    VISIONARY_COMPONENTS_3D_HUNYUAN_SECRET_KEY: config.hunyuan.secretKey,
    VISIONARY_COMPONENTS_3D_HUNYUAN_REGION: config.hunyuan.region,
    VISIONARY_COMPONENTS_3D_HUNYUAN_VERSION: config.hunyuan.version,
    VISIONARY_COMPONENTS_3D_HUNYUAN_MODEL: config.hunyuan.model,
    VISIONARY_COMPONENTS_3D_HUNYUAN_POLL_INTERVAL_SECONDS: String(config.hunyuan.pollIntervalSeconds),
    VISIONARY_COMPONENTS_3D_HUNYUAN_MAX_WAIT_SECONDS: String(config.hunyuan.maxWaitSeconds),
    VISIONARY_COMPONENTS_3D_HUNYUAN_CALLBACK_URL: config.hunyuan.callbackUrl,
    VISIONARY_COMPONENTS_3D_HUNYUAN_DOWNLOAD_BASE_URL: config.hunyuan.downloadBaseUrl,
    VISIONARY_COMPONENTS_3D_TRELLIS_HOST: config.trellis2.host,
    VISIONARY_COMPONENTS_3D_TRELLIS_PORT: config.trellis2.port,
    VISIONARY_COMPONENTS_3D_TRELLIS_BASE_URL: config.trellis2.baseUrl,
    VISIONARY_COMPONENTS_3D_TRELLIS_SECRET_ID: config.trellis2.secretId,
    VISIONARY_COMPONENTS_3D_TRELLIS_SECRET_KEY: config.trellis2.secretKey,
    VISIONARY_COMPONENTS_3D_TRELLIS_REGION: config.trellis2.region,
    VISIONARY_COMPONENTS_3D_TRELLIS_VERSION: config.trellis2.version,
    VISIONARY_COMPONENTS_3D_TRELLIS_MODEL: config.trellis2.model,
    VISIONARY_COMPONENTS_3D_TRELLIS_POLL_INTERVAL_SECONDS: String(config.trellis2.pollIntervalSeconds),
    VISIONARY_COMPONENTS_3D_TRELLIS_MAX_WAIT_SECONDS: String(config.trellis2.maxWaitSeconds),
    VISIONARY_COMPONENTS_3D_TRELLIS_CALLBACK_URL: config.trellis2.callbackUrl,
    VISIONARY_COMPONENTS_3D_TRELLIS_DOWNLOAD_BASE_URL: config.trellis2.downloadBaseUrl,
  };
}
