export const DEV_BOOT_PROGRESS_EVENT = 'visionary:boot-progress';

export function normalizeDevBootProgressDetail(value: unknown): string {
  return String(value ?? '')
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

export function reportDevBootProgress(detail: unknown): void {
  const normalizedDetail = normalizeDevBootProgressDetail(detail);
  if (!normalizedDetail) return;

  import.meta.hot?.send(DEV_BOOT_PROGRESS_EVENT, {
    detail: normalizedDetail,
  });
}
