import type { WorkspaceSnapshot } from './workspace-snapshot.ts';

export interface WorkspaceSaveState {
  workspaceHandle: FileSystemDirectoryHandle | null;
  dirty: boolean;
  saving: boolean;
  saveQueued: boolean;
  error: string | null;
}

export interface EditorWorkspaceStoreOptions {
  buildSnapshot: (reason?: string) => WorkspaceSnapshot;
  persistSnapshot: (snapshot: WorkspaceSnapshot) => Promise<void>;
}

export class EditorWorkspaceStore {
  private readonly options: EditorWorkspaceStoreOptions;
  private state: WorkspaceSaveState = {
    workspaceHandle: null,
    dirty: false,
    saving: false,
    saveQueued: false,
    error: null,
  };

  private scheduled = false;
  private flushPromise: Promise<void> | null = null;
  private queuedSnapshot: WorkspaceSnapshot | null = null;
  private lastDirtyReason: string | undefined;

  constructor(options: EditorWorkspaceStoreOptions) {
    this.options = options;
  }

  getState(): WorkspaceSaveState {
    return { ...this.state };
  }

  setWorkspaceHandle(handle: FileSystemDirectoryHandle | null): void {
    this.state.workspaceHandle = handle;
  }

  markDirty(reason?: string): void {
    this.lastDirtyReason = reason;
    this.state.dirty = true;
    this.state.saveQueued = true;
    this.queuedSnapshot = this.options.buildSnapshot(reason);
    this.scheduleAutosave();
  }

  scheduleAutosave(): void {
    if (this.scheduled) {
      return;
    }
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      void this.requestSave();
    });
  }

  async requestSave(_options?: { immediate?: boolean }): Promise<void> {
    if (!this.state.dirty && !this.state.saveQueued) {
      return;
    }
    if (this.flushPromise) {
      return this.flushPromise;
    }

    this.flushPromise = this.flushQueue();
    try {
      await this.flushPromise;
    } finally {
      this.flushPromise = null;
      if (this.state.saveQueued && !this.state.saving && !this.state.error) {
        void this.requestSave();
      }
    }
  }

  async whenIdle(): Promise<void> {
    while (this.scheduled || this.flushPromise) {
      if (this.flushPromise) {
        await this.flushPromise;
      }
      if (this.scheduled) {
        await Promise.resolve();
      }
    }
  }

  private async flushQueue(): Promise<void> {
    if (this.state.saving) {
      return;
    }

    this.state.saving = true;
    try {
      while (this.state.saveQueued) {
        const snapshot =
          this.queuedSnapshot ?? this.options.buildSnapshot(this.lastDirtyReason);
        this.queuedSnapshot = null;
        this.state.saveQueued = false;
        this.state.error = null;

        try {
          await this.options.persistSnapshot(snapshot);
          if (!this.state.saveQueued) {
            this.state.dirty = false;
            this.lastDirtyReason = undefined;
          }
        } catch (error) {
          this.state.error =
            error instanceof Error ? error.message : String(error ?? 'Unknown save error');
          this.state.dirty = true;
          this.state.saveQueued = false;
          break;
        }
      }
    } finally {
      this.state.saving = false;
    }
  }
}

