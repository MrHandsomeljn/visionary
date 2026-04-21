export interface WorkspaceSnapshot {
  revision: number;
  reason?: string;
  createdAt: number;
}

export interface CreateWorkspaceSnapshotInput {
  revision: number;
  reason?: string;
  createdAt?: number;
}

export function createWorkspaceSnapshot(
  input: CreateWorkspaceSnapshotInput,
): WorkspaceSnapshot {
  return {
    revision: input.revision,
    reason: input.reason,
    createdAt: input.createdAt ?? Date.now(),
  };
}

