export function resolveAgentPreviewInstanceAction({
  hasInstance = false,
  hostChanged = false,
} = {}) {
  if (!hasInstance) return 'create';
  return hostChanged ? 'reattach' : 'reuse';
}
