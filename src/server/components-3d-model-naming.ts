import type { Components3DGenerationProvider } from './components-3d-config.ts';

function modelNameSegment(value: unknown, fallback: string): string {
  const normalized = String(value || '').trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return normalized || fallback;
}

export function components3DModelTag(
  provider: Components3DGenerationProvider,
  model: unknown,
): string {
  if (provider === 'hunyuan') return 'hy';
  if (provider === 'trellis.2') {
    const resolutionMatches = Array.from(String(model || '').matchAll(/\d{3,5}/g));
    const resolution = resolutionMatches.at(-1)?.[0];
    return resolution ? `t${resolution}` : 't';
  }
  return 'mock';
}

export function buildComponents3DObjectName(input: {
  ordinal: number;
  label: unknown;
  provider: Components3DGenerationProvider;
  model: unknown;
}): string {
  const ordinal = Math.max(1, Math.floor(Number(input.ordinal) || 1));
  const number = String(ordinal).padStart(2, '0');
  const label = modelNameSegment(input.label, `object_${number}`);
  return `${number}-${label}-${components3DModelTag(input.provider, input.model)}`;
}
