import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PluginOption, ViteDevServer } from 'vite';

export const CLIENT_MODULE_LOAD_ERROR_ENDPOINT = '/api/client-errors/module-load';

const REPORT_BODY_LIMIT_BYTES = 32 * 1024;

export interface ClientModuleLoadErrorReport {
  message: string;
  source: string;
  line: number | null;
  column: number | null;
  pageUrl: string;
  userAgent: string;
}

function normalizeSingleLine(value: unknown, maxLength: number): string {
  return String(value ?? '')
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizePosition(value: unknown): number | null {
  if (typeof value !== 'number') return null;
  const position = value;
  return Number.isInteger(position) && position >= 0 ? position : null;
}

export function normalizeClientModuleLoadErrorReport(
  value: unknown,
): ClientModuleLoadErrorReport | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const payload = value as Record<string, unknown>;
  const message = normalizeSingleLine(payload.message, 1000);
  if (!message) return null;

  return {
    message,
    source: normalizeSingleLine(payload.source, 500),
    line: normalizePosition(payload.line),
    column: normalizePosition(payload.column),
    pageUrl: normalizeSingleLine(payload.pageUrl, 500),
    userAgent: normalizeSingleLine(payload.userAgent, 300),
  };
}

export function formatClientModuleLoadErrorLog(report: ClientModuleLoadErrorReport): string {
  const location = report.source
    ? ` (${report.source}${report.line === null ? '' : `:${report.line}`}${report.column === null ? '' : `:${report.column}`})`
    : '';
  return `[visionary] Frontend module load failed: ${report.message}${location}`;
}

async function readReportBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > REPORT_BODY_LIMIT_BYTES) {
      throw new Error('report body is too large');
    }
    chunks.push(buffer);
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function endResponse(res: ServerResponse, statusCode: number): void {
  res.statusCode = statusCode;
  res.end();
}

export function createClientModuleLoadErrorPlugin(): PluginOption {
  return {
    name: 'visionary-client-module-load-error',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url || '/', 'http://localhost').pathname;
        if (pathname !== CLIENT_MODULE_LOAD_ERROR_ENDPOINT) {
          next();
          return;
        }
        if (req.method !== 'POST') {
          endResponse(res, 405);
          return;
        }

        try {
          const report = normalizeClientModuleLoadErrorReport(await readReportBody(req));
          if (!report) {
            endResponse(res, 400);
            return;
          }
          server.config.logger.error(formatClientModuleLoadErrorLog(report), { timestamp: true });
          endResponse(res, 204);
        } catch {
          endResponse(res, 400);
        }
      });
    },
  };
}
