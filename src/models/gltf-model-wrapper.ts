import * as THREE from "three/webgpu";

export interface GLTFLoadOptions {
  autoPlay?: boolean;
  defaultSpeed?: number;
  loop?: boolean;
}

/**
 * Lightweight runtime wrapper for glTF/GLB animation playback in the editor.
 * Reuses Three.js AnimationMixer directly and keeps Stage 1 scoped to native clip playback.
 */
export class GLTFModelWrapper {
  public readonly object3D: THREE.Object3D;
  public readonly mixer: THREE.AnimationMixer;
  public readonly clips: THREE.AnimationClip[];

  private currentAction: THREE.AnimationAction | null = null;
  private isPlaying = false;
  private isPaused = false;
  private animationSpeed = 1.0;
  private isLooping = true;

  constructor(object3D: THREE.Object3D, clips: THREE.AnimationClip[], options: GLTFLoadOptions = {}) {
    this.object3D = object3D;
    this.clips = Array.isArray(clips) ? [...clips] : [];
    this.mixer = new THREE.AnimationMixer(object3D);

    if (this.clips.length > 0) {
      this.currentAction = this.mixer.clipAction(this.clips[0]);
      this.ensureActionBound();
      this.setLoop(options.loop !== false);
      if (options.autoPlay !== false) {
        this.startAnimation(options.defaultSpeed ?? 1.0);
      }
    }
  }

  private ensureActionBound(): void {
    if (!this.currentAction) return;
    this.currentAction.enabled = true;
    this.currentAction.clampWhenFinished = !this.isLooping;
    this.currentAction.play();
  }

  getClipInfo(): Array<{ name: string; duration: number }> {
    return this.clips.map((clip) => ({
      name: clip.name,
      duration: clip.duration,
    }));
  }

  getDuration(): number {
    return this.clips.reduce((max, clip) => Math.max(max, Number(clip.duration) || 0), 0);
  }

  isAnimationRunning(): boolean {
    return this.isPlaying;
  }

  isAnimationPaused(): boolean {
    return this.isPaused;
  }

  getAnimationIsLoop(): boolean {
    return this.isLooping;
  }

  supportsAnimation(): boolean {
    return this.clips.length > 0;
  }

  setAnimationTime(time: number): void {
    if (!this.currentAction) return;
    this.ensureActionBound();
    const safeTime = Math.max(0, Number(time) || 0);
    const duration = this.getDuration();
    const normalizedTime = this.isLooping && duration > 0
      ? safeTime % duration
      : Math.min(safeTime, duration || safeTime);
    this.currentAction.time = normalizedTime;
    this.mixer.update(0);
  }

  setAnimationSpeed(speed: number): void {
    this.animationSpeed = Number.isFinite(speed) ? speed : 1.0;
    if (this.currentAction) {
      this.currentAction.timeScale = this.animationSpeed;
    }
  }

  getAnimationSpeed(): number {
    return this.animationSpeed;
  }

  setLoop(enabled: boolean): void {
    this.isLooping = !!enabled;
    if (this.currentAction) {
      this.currentAction.setLoop(THREE.LoopRepeat, this.isLooping ? Infinity : 1);
      this.currentAction.clampWhenFinished = !this.isLooping;
    }
  }

  startAnimation(speed?: number): void {
    if (speed !== undefined) {
      this.setAnimationSpeed(speed);
    }
    if (!this.currentAction) return;
    this.ensureActionBound();
    this.currentAction.reset();
    this.currentAction.paused = false;
    this.currentAction.timeScale = this.animationSpeed;
    this.isPlaying = true;
    this.isPaused = false;
  }

  pauseAnimation(): void {
    if (!this.currentAction) return;
    this.currentAction.paused = true;
    this.isPaused = true;
  }

  resumeAnimation(): void {
    if (!this.currentAction) return;
    this.ensureActionBound();
    this.currentAction.paused = false;
    this.isPaused = false;
    this.isPlaying = true;
  }

  stopAnimation(): void {
    if (!this.currentAction) return;
    this.currentAction.stop();
    this.isPlaying = false;
    this.isPaused = false;
  }

  update(deltaTime: number): void {
    if (!this.currentAction || !this.isPlaying || this.isPaused) return;
    const safeDelta = Math.max(0, Number(deltaTime) || 0);
    if (safeDelta <= 0) return;
    this.mixer.update(safeDelta);
  }

  dispose(): void {
    this.mixer.stopAllAction();
  }
}
