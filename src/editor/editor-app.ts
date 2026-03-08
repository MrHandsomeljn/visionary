/**
 * Visionary Editor Application 0.0.6
 * Editor version of main app with UI controls
 */

import { vec3 } from "gl-matrix";
import { GaussianRenderer } from "../renderer/gaussian_renderer";
import { setHidden } from "../app/dom-elements";
import {
  ModelManager,
  FileLoader,
  ONNXManager,
  CameraManager,
  AnimationManager,
  RenderLoop,
  type ModelEntry,
  type LoadingCallbacks
} from "../app/managers";
import { defaultLoader, detectGaussianFormat, isGaussianFormat } from "../io";
import { initWebGPU_onnx, WebGPUContext, DEFAULT_DUMMY_MODEL_URL } from "../app/webgpu-context";
import { initOrtEnvironment, getDefaultOrtWasmPaths } from "../config/ort-config";
import { PointCloud, DynamicPointCloud } from "../point_cloud";
import { lookAtW2C } from "../controls/orbit";

const MAX_MODELS = 10000;
const CAMERA_KEY_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyQ",
  "KeyE",
  "KeyR",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "ShiftLeft",
  "ShiftRight",
  "PageUp",
  "PageDown",
  "AltLeft",
  "AltRight",
]);

type SceneSkyPreset = {
  id: string;
  name: string;
  colorHex: string;
};

const SCENE_SKY_PRESETS: SceneSkyPreset[] = [
    { id: "black", name: "纯黑", colorHex: "#000000" },
  { id: "white", name: "纯白", colorHex: "#FFFFFF" },
  { id: "clear_day", name: "晴空", colorHex: "#6EAEEA" },
  { id: "sunset", name: "日落", colorHex: "#E9875A" },
  { id: "dusk", name: "暮光", colorHex: "#4A5D86" },
  { id: "night", name: "夜空", colorHex: "#050814" },
];

type EditorRenderMode = "color" | "normal" | "depth";

const RENDER_MODE_INDEX: Record<EditorRenderMode, number> = {
  color: 0,
  normal: 1,
  depth: 2,
};

/**
 * Editor model data - tracks models with UI state
 */
interface EditorModel {
  id: string;
  name: string;
  pointCount: number;
  visible: boolean;
  isDynamic: boolean;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: number;
  modelType: string;
  modelEntry?: ModelEntry;
  sourceFile?: File;
  sourcePath?: string;
}

/**
 * Editor Application
 */
export class EditorApp {
  // DOM Elements
  private canvas: HTMLCanvasElement | null = null;
  private loadingOverlay: HTMLElement | null = null;
  private progressFill: HTMLElement | null = null;
  private progressText: HTMLElement | null = null;
  private noWebGPU: HTMLElement | null = null;

  // Core components
  private gpu: WebGPUContext | null = null;
  private renderer: GaussianRenderer | null = null;

  // Managers
  private modelManager: ModelManager;
  private fileLoader: FileLoader;
  private onnxManager: ONNXManager;
  private cameraManager: CameraManager;
  private animationManager: AnimationManager;
  private renderLoop: RenderLoop;

  // Editor state
  private editorModels: Map<string, EditorModel> = new Map();
  private onModelsChangedCallback: ((models: EditorModel[]) => void) | null = null;
  private sceneBackgroundColor: [number, number, number, number] = [0.02, 0.03, 0.08, 1.0];
  private sceneSkyPresetId: string = "night";
  private sceneDepthRangeScale: number = 1.0;
  private renderMode: EditorRenderMode = "color";

  // Mouse state for camera control
  private lastMouseX = 0;
  private lastMouseY = 0;
  private leftMouseDown = false;
  private rightMouseDown = false;
  private activeCameraKeys: Set<string> = new Set();

  // Version
  readonly VERSION = '0.0.6';

  constructor() {
    this.modelManager = new ModelManager(MAX_MODELS);
    this.cameraManager = new CameraManager('orbit');
    this.animationManager = new AnimationManager(this.modelManager);
    this.renderLoop = new RenderLoop(this.modelManager, this.animationManager, this.cameraManager);

    // Initialize managers with loading callbacks
    const loadingCallbacks: LoadingCallbacks = {
      onProgress: (show, text, pct) => this.showLoading(show, text, pct),
      onError: (msg) => this.showError(msg)
    };

    this.fileLoader = new FileLoader(this.modelManager, loadingCallbacks);
    this.onnxManager = new ONNXManager(this.modelManager);

    console.log(`[EditorApp ${this.VERSION}] Constructor called`);
  }

  /**
   * Initialize editor
   */
  async init(): Promise<boolean> {
    console.log(`[EditorApp ${this.VERSION}] Initializing...`);

    // Get DOM elements
    this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
    this.loadingOverlay = document.getElementById('loadingOverlay');
    this.progressFill = document.querySelector('#loadingOverlay .progress-fill') as HTMLElement;
    this.progressText = document.querySelector('#loadingOverlay .progress-text') as HTMLElement;
    this.noWebGPU = document.getElementById('noWebGPU');

    // Update version label
    const versionLabel = document.getElementById('versionLabel');
    if (versionLabel) {
      versionLabel.textContent = this.VERSION;
    }

    // Check canvas
    if (!this.canvas) {
      console.error('[EditorApp] Canvas element not found');
      alert('Canvas element not found');
      return false;
    }

    // Configure ORT environment
    const wasmPaths = getDefaultOrtWasmPaths();
    initOrtEnvironment(wasmPaths);
    console.log(`[EditorApp ${this.VERSION}] ORT environment initialized with paths: ${wasmPaths}`);

    // Initialize WebGPU - with fallback if ORT fails
    try {
      this.gpu = await initWebGPU_onnx(this.canvas, {
        dummyModelUrl: DEFAULT_DUMMY_MODEL_URL,
        adapterPowerPreference: 'high-performance',
        allowOwnDeviceWhenOrtPresent: true, // Allow fallback to own device if ORT fails
        preferShareWithOrt: true
      });

      if (this.gpu) {
        console.log('[EditorApp] WebGPU initialized successfully');
      } else {
        console.error('[EditorApp] Failed to initialize WebGPU');
        return false;
      }
    } catch (error) {
      console.error('[EditorApp] WebGPU initialization error:', error);
      alert(`Failed to initialize WebGPU: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }

    // Initialize renderer
    this.renderer = new GaussianRenderer(this.gpu.device, this.gpu.format, 3);
    await this.renderer.ensureSorter();

    // Initialize camera
    this.cameraManager.initCamera(this.canvas);

    // Setup resize handler
    window.addEventListener("resize", () => this.resize());
    this.resize();

    // Setup canvas event listeners (using same approach as demo/simple)
    this.setupCanvasEvents();

    // Initialize render loop
    this.renderLoop.init(this.gpu, this.renderer, this.canvas);
    this.renderLoop.setBackgroundColor(this.sceneBackgroundColor);
    this.renderLoop.setDepthRangeScale(this.sceneDepthRangeScale);

    // Start render loop
    this.renderLoop.start();

    console.log(`[EditorApp ${this.VERSION}] Initialized successfully!`);
    console.log(`[EditorApp ${this.VERSION}] Supported formats: ${defaultLoader.getAllSupportedExtensions().join(', ')}`);

    return true;
  }

  /**
   * Setup canvas event listeners - using same approach as demo/simple
   */
  private setupCanvasEvents(): void {
    if (!this.canvas) return;

    // Mouse events - directly set controller state like demo/simple
    this.canvas.addEventListener('mousedown', (e) => {
      const controller = this.cameraManager.getController();
      if (e.button === 0) {
        this.leftMouseDown = true;
        controller.leftMousePressed = true;
      }
      if (e.button === 1 || e.button === 2) {
        this.rightMouseDown = true;
        controller.rightMousePressed = true;
      }
      if (e.button === 1) {
        e.preventDefault();
      }
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    window.addEventListener('mouseup', (e) => {
      const controller = this.cameraManager.getController();
      if (e.button === 0) {
        this.leftMouseDown = false;
        controller.leftMousePressed = false;
      }
      if (e.button === 1 || e.button === 2) {
        this.rightMouseDown = false;
        controller.rightMousePressed = false;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.leftMouseDown || this.rightMouseDown) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        const controller = this.cameraManager.getController();
        controller.processMouse(dx, dy);
      }
    });

    // Wheel event
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const controller = this.cameraManager.getController();
      controller.processScroll(e.deltaY > 0 ? 0.05 : -0.05);
    }, { passive: false });

    // Keyboard events
    window.addEventListener('keydown', (e) => this.handleCameraKeyboard(e, true));
    window.addEventListener('keyup', (e) => this.handleCameraKeyboard(e, false));
    window.addEventListener('blur', () => this.releaseAllCameraKeys());

    // Prevent context menu
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    console.log('[EditorApp] Canvas event listeners setup');
  }

  private isEditingText(): boolean {
    const active = document.activeElement as HTMLElement | null;
    if (!active) return false;
    const tag = active.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || active.isContentEditable;
  }

  private setControllerAltPressed(pressed: boolean): void {
    const controller = this.cameraManager.getController() as { altPressed?: boolean };
    if (typeof controller.altPressed === "boolean") {
      controller.altPressed = pressed;
    }
  }

  private handleCameraKeyboard(event: KeyboardEvent, pressed: boolean): void {
    if (!CAMERA_KEY_CODES.has(event.code)) return;
    if (this.isEditingText()) return;
    if (pressed && event.repeat) return;

    const isAltKey = event.code === "AltLeft" || event.code === "AltRight";
    if (isAltKey) {
      this.setControllerAltPressed(pressed);
    }

    const controller = this.cameraManager.getController();
    if (pressed) {
      if (this.activeCameraKeys.has(event.code)) return;
      const handled = controller.processKeyboard(event.code, true);
      if (handled) {
        this.activeCameraKeys.add(event.code);
        event.preventDefault();
      }
      return;
    }

    if (!this.activeCameraKeys.has(event.code)) return;
    controller.processKeyboard(event.code, false);
    this.activeCameraKeys.delete(event.code);
    event.preventDefault();
  }

  private releaseAllCameraKeys(): void {
    this.leftMouseDown = false;
    this.rightMouseDown = false;
    const controller = this.cameraManager.getController();
    controller.leftMousePressed = false;
    controller.rightMousePressed = false;

    if (this.activeCameraKeys.size === 0) {
      this.setControllerAltPressed(false);
      return;
    }

    this.activeCameraKeys.forEach((code) => {
      controller.processKeyboard(code, false);
    });
    this.activeCameraKeys.clear();
    this.setControllerAltPressed(false);
  }

  /**
   * Load a model file
   */
  async loadModel(file: File, options: { sourcePath?: string } = {}): Promise<EditorModel | null> {
    console.log(`[EditorApp ${this.VERSION}] ===== loadModel START =====`);
    console.log(`[EditorApp ${this.VERSION}] File:`, file.name, file.size, 'bytes', file.type);

    if (!this.gpu) {
      console.error('[EditorApp] WebGPU not initialized');
      return null;
    }

    this.showLoading(true, `Loading ${file.name}...`, 0);

    try {
      const lowerName = file.name.toLowerCase();

      // Detect file type
      let modelEntry: ModelEntry | null = null;

      if (lowerName.endsWith('.onnx')) {
        // Load ONNX model
        const modelPath = URL.createObjectURL(file);
        modelEntry = await this.onnxManager.loadONNXModel(
          this.gpu.device,
          modelPath,
          this.cameraManager.getCameraMatrix() as Float32Array,
          this.cameraManager.getProjectionMatrix() as Float32Array,
          file.name,
          { staticInference: false, debugLogging: false }
        );
      } else if (isGaussianFormat(lowerName)) {
        // Load Gaussian model (PLY, SPZ, KSplat, SPLAT, SOG, etc.)
        modelEntry = await this.fileLoader.loadFile(file, this.gpu.device);
      } else {
        throw new Error(`Unsupported file type: ${file.name}. Supported: ${defaultLoader.getAllSupportedExtensions().join(', ')}`);
      }

      if (!modelEntry) {
        throw new Error('Failed to create model entry');
      }

      this.applyRenderModeToModelEntry(modelEntry, this.renderMode);

      // Get point count from model entry (fallback to point cloud numPoints)
      let pointCount = Number(modelEntry.pointCount ?? 0);
      if ((!Number.isFinite(pointCount) || pointCount <= 0) && modelEntry.pointCloud) {
        const pcWithNumPoints = modelEntry.pointCloud as { numPoints?: number };
        pointCount = Number(pcWithNumPoints.numPoints ?? 0);
      }
      if (!Number.isFinite(pointCount) || pointCount < 0) {
        pointCount = 0;
      }

      console.log(`[EditorApp] Model point count: ${pointCount}`);

      // Create editor model record
      const editorModel: EditorModel = {
        id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
        name: file.name,
        pointCount: pointCount, // Ensure it's always a number
        visible: true,
        isDynamic: Boolean(modelEntry.isDynamic),
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: 1,
        modelType: lowerName.endsWith('.onnx') ? 'onnx' : (detectGaussianFormat(lowerName) || 'unknown'),
        modelEntry: modelEntry,
        sourceFile: file,
        sourcePath: options.sourcePath || file.name
      };

      this.editorModels.set(editorModel.id, editorModel);

      // Setup camera for first model
      if (this.editorModels.size === 1 && modelEntry.pointCloud instanceof PointCloud) {
        this.setupCameraForFirstModel(modelEntry.pointCloud);
      }

      this.showLoading(false);
      this.notifyModelsChanged();

      console.log(`[EditorApp ${this.VERSION}] ===== loadModel END =====`);
      console.log(`[EditorApp ${this.VERSION}] Model loaded:`, editorModel.name, 'points:', pointCount);

      return editorModel;

    } catch (error) {
      this.showLoading(false);
      console.error(`[EditorApp ${this.VERSION}] ===== loadModel FAILED =====`);
      console.error(`[EditorApp ${this.VERSION}] Error:`, error);
      alert(`Failed to load model: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Setup camera for first model
   */
  private setupCameraForFirstModel(pointCloud: PointCloud): void {
    if (!pointCloud) return;

    const aabb = pointCloud.bbox;
    const center = aabb.center();
    const radius = aabb.radius();

    const centerText = Array.from(center).map((v) => Number(v).toFixed(2)).join(",");
    console.log(`[EditorApp] Model bounds: center=[${centerText}], radius=${radius.toFixed(2)}`);

    // Position camera based on model size
    const distance = Math.max(radius * 2, 2);
    const pos = vec3.fromValues(
      center[0] - distance * 0.5,
      center[1] - distance * 0.5,
      center[2] - distance * 0.5
    );

    const camera = this.cameraManager.getCamera();
    if (camera) {
      vec3.copy(camera.positionV, pos);
      const controller = this.cameraManager.getController();
      if ('center' in controller) {
        const centerVec = (controller as any).center;
        if (centerVec) {
          vec3.copy(centerVec, center);
        }
      }
    }
  }

  /**
   * Remove a model
   */
  removeModel(id: string): boolean {
    const model = this.editorModels.get(id);
    if (!model) {
      console.warn('[EditorApp] Model not found:', id);
      return false;
    }

    if (model.modelEntry) {
      this.modelManager.removeModel(model.modelEntry.id);
      this.onnxManager.disposeModel(model.modelEntry.id);
    }

    this.editorModels.delete(id);
    this.notifyModelsChanged();

    console.log(`[EditorApp] Model removed:`, model.name);
    return true;
  }

  /**
   * Set model visibility
   */
  setModelVisibility(id: string, visible: boolean): boolean {
    const model = this.editorModels.get(id);
    if (!model) return false;

    model.visible = visible;

    if (model.modelEntry) {
      this.modelManager.setModelVisibility(model.modelEntry.id, visible);
    }

    this.notifyModelsChanged();
    return true;
  }

  /**
   * Set model position
   */
  setModelPosition(id: string, x: number, y: number, z: number): boolean {
    const model = this.editorModels.get(id);
    if (!model) return false;

    model.position = { x, y, z };

    if (model.modelEntry) {
      this.modelManager.setModelPosition(model.modelEntry.id, x, y, z);
    }

    return true;
  }

  /**
   * Set model rotation
   */
  setModelRotation(id: string, rx: number, ry: number, rz: number): boolean {
    const model = this.editorModels.get(id);
    if (!model) return false;

    model.rotation = { x: rx, y: ry, z: rz };

    if (model.modelEntry) {
      this.modelManager.setModelRotation(model.modelEntry.id, rx, ry, rz);
    }

    return true;
  }

  /**
   * Set model scale
   */
  setModelScale(id: string, scale: number): boolean {
    const model = this.editorModels.get(id);
    if (!model) return false;

    model.scale = scale;

    if (model.modelEntry) {
      this.modelManager.setModelScale(model.modelEntry.id, scale);
    }

    return true;
  }

  /**
   * Reset model transform
   */
  resetModelTransform(id: string): boolean {
    const model = this.editorModels.get(id);
    if (!model) return false;

    model.position = { x: 0, y: 0, z: 0 };
    model.rotation = { x: 0, y: 0, z: 0 };
    model.scale = 1;

    if (model.modelEntry) {
      this.modelManager.setModelTransform(model.modelEntry.id, [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]);
    }

    return true;
  }

  /**
   * Clear all models
   */
  clearAllModels(): void {
    this.editorModels.forEach((model) => {
      if (model.modelEntry) {
        this.modelManager.removeModel(model.modelEntry.id);
        this.onnxManager.disposeModel(model.modelEntry.id);
      }
    });
    this.editorModels.clear();
    this.notifyModelsChanged();
    console.log('[EditorApp] All models cleared');
  }

  /**
   * Get all editor models
   */
  getModels(): EditorModel[] {
    return Array.from(this.editorModels.values());
  }

  /**
   * Get a specific editor model
   */
  getModel(id: string): EditorModel | null {
    return this.editorModels.get(id) || null;
  }

  /**
   * Set camera mode
   */
  setCameraMode(mode: 'orbit' | 'fps'): void {
    this.releaseAllCameraKeys();
    this.cameraManager.switchController(mode);
    console.log('[EditorApp] Camera mode:', mode);
  }

  /**
   * Set renderer output mode for all loaded models.
   * Uses existing PointCloud.setRenderMode (0=color, 1=normal, 2=depth).
   */
  setRenderMode(mode: EditorRenderMode): boolean {
    if (mode !== "color" && mode !== "normal" && mode !== "depth") {
      return false;
    }

    this.renderMode = mode;
    let updated = 0;
    this.editorModels.forEach((model) => {
      if (this.applyRenderModeToModelEntry(model.modelEntry, mode)) {
        updated += 1;
      }
    });

    // Fallback: ensure all models managed by ModelManager are updated too.
    const managedModels = this.modelManager.getFullModels();
    managedModels.forEach((modelEntry) => {
      if (this.applyRenderModeToModelEntry(modelEntry, mode)) {
        updated += 1;
      }
    });

    console.log(`[EditorApp] Render mode set to: ${mode} (${updated} model(s) updated)`);
    return true;
  }

  getRenderMode(): EditorRenderMode {
    return this.renderMode;
  }

  /**
   * Focus camera on the selected model.
   */
  focusModel(id: string): boolean {
    const model = this.editorModels.get(id);
    if (!model) return false;

    const camera = this.cameraManager.getCamera();
    if (!camera) return false;

    const target = this.getModelFocusPoint(model);
    if (!target) return false;

    const worldUp = vec3.fromValues(0, 1, 0);
    const nearPoleDot = 0.995;
    const poleBiasRatio = 0.01;
    const poleBiasMin = 0.02;

    // Keep current camera distance, but ensure it's not too close.
    const toCam = vec3.subtract(vec3.create(), camera.positionV, target);
    let dist = vec3.length(toCam);
    if (!Number.isFinite(dist) || dist < 1e-4) {
      vec3.set(toCam, -1, -1, -1);
      vec3.normalize(toCam, toCam);
      dist = 3.0;
    } else {
      vec3.scale(toCam, toCam, 1 / dist);
      dist = Math.max(dist, 0.5);
    }

    vec3.scale(toCam, toCam, dist);
    const forward = vec3.scale(vec3.create(), toCam, -1 / Math.max(dist, 1e-6));

    // Pole-safe bias: near ±Y view, add a tiny horizontal offset so world-up projection is well-defined.
    if (Math.abs(vec3.dot(forward, worldUp)) > nearPoleDot) {
      const horizontal = vec3.fromValues(toCam[0], 0, toCam[2]);
      if (vec3.length(horizontal) < 1e-6) {
        vec3.set(horizontal, 1, 0, 0);
      } else {
        vec3.normalize(horizontal, horizontal);
      }
      const poleBias = Math.max(dist * poleBiasRatio, poleBiasMin);
      vec3.scaleAndAdd(toCam, toCam, horizontal, poleBias);
      vec3.normalize(toCam, toCam);
      vec3.scale(toCam, toCam, dist);
    }

    vec3.add(camera.positionV, target, toCam);

    // Force upright look-at: screen-up aligns with world +Y projection.
    const correctedForward = vec3.subtract(vec3.create(), target, camera.positionV);
    if (vec3.length(correctedForward) > 1e-6) {
      vec3.normalize(correctedForward, correctedForward);
      camera.rotationQ = lookAtW2C(correctedForward, worldUp);
    }

    // Sync orbit internals so the next frame won't undo this upright pose.
    this.cameraManager.syncOrbitAfterExternalLookAt(target, worldUp);
    console.log(`[EditorApp] Focused model: ${model.name}`);
    return true;
  }

  /**
   * Keep current view direction and remove camera roll (upright to world +Y).
   */
  uprightCamera(): boolean {
    const ok = this.cameraManager.uprightCurrentView(vec3.fromValues(0, 1, 0));
    if (ok) {
      console.log("[EditorApp] Camera upright");
    }
    return ok;
  }

  /**
   * Get animation state for a specific model.
   */
  getModelAnimationState(id: string): {
    supported: boolean;
    isPlaying: boolean;
    isPaused: boolean;
    isLooping: boolean;
    speed: number;
  } {
    const model = this.editorModels.get(id);
    if (!model || !model.modelEntry) {
      return { supported: false, isPlaying: false, isPaused: false, isLooping: true, speed: 1.0 };
    }

    const dynamicPC = this.getDynamicPointCloudForModel(model);
    if (!dynamicPC) {
      return { supported: false, isPlaying: false, isPaused: false, isLooping: true, speed: 1.0 };
    }

    return {
      supported: true,
      isPlaying: dynamicPC.isAnimationRunning,
      isPaused: dynamicPC.isAnimationPaused,
      isLooping: dynamicPC.getAnimationIsLoop(),
      speed: dynamicPC.getAnimationSpeed(),
    };
  }

  /**
   * Play or pause animation for a specific model.
   */
  setModelAnimationPlaying(id: string, playing: boolean): boolean {
    const model = this.editorModels.get(id);
    if (!model) return false;

    const dynamicPC = this.getDynamicPointCloudForModel(model);
    if (!dynamicPC) return false;

    if (playing) {
      if (dynamicPC.isAnimationPaused) {
        dynamicPC.resumeAnimation();
      } else if (!dynamicPC.isAnimationRunning) {
        dynamicPC.startAnimation(dynamicPC.getAnimationSpeed());
      }
    } else if (dynamicPC.isAnimationRunning) {
      dynamicPC.pauseAnimation();
    }

    return true;
  }

  /**
   * Enable/disable loop for a specific model.
   */
  setModelAnimationLoop(id: string, enabled: boolean): boolean {
    const model = this.editorModels.get(id);
    if (!model) return false;

    const dynamicPC = this.getDynamicPointCloudForModel(model);
    if (!dynamicPC) return false;

    dynamicPC.setAnimationIsLoop(enabled);
    return true;
  }

  /**
   * Set animation playback speed for a specific model.
   */
  setModelAnimationSpeed(id: string, speed: number): boolean {
    const model = this.editorModels.get(id);
    if (!model) return false;

    const dynamicPC = this.getDynamicPointCloudForModel(model);
    if (!dynamicPC) return false;

    const safeSpeed = Math.max(0.001, speed);
    dynamicPC.setAnimationSpeed(safeSpeed);
    return true;
  }

  private getDynamicPointCloudForModel(model: EditorModel): DynamicPointCloud | null {
    if (!model.modelEntry || model.modelType !== 'onnx' || !model.isDynamic) {
      return null;
    }
    if (!(model.modelEntry.pointCloud instanceof DynamicPointCloud)) {
      return null;
    }
    return model.modelEntry.pointCloud;
  }

  private applyRenderModeToModelEntry(modelEntry: ModelEntry | undefined | null, mode: EditorRenderMode): boolean {
    if (!modelEntry || !modelEntry.pointCloud) return false;

    const pointCloud = modelEntry.pointCloud as { setRenderMode?: (modeValue: number) => void };
    if (typeof pointCloud.setRenderMode !== "function") return false;

    pointCloud.setRenderMode(RENDER_MODE_INDEX[mode]);
    return true;
  }

  private getModelFocusPoint(model: EditorModel): vec3 | null {
    const fallback = vec3.fromValues(model.position.x, model.position.y, model.position.z);
    if (!model.modelEntry) return fallback;

    const pc = model.modelEntry.pointCloud as any;
    const centerFn = pc?.bbox?.center;
    if (typeof centerFn !== "function") return fallback;

    const local = centerFn.call(pc?.bbox);
    if (!local || local.length < 3) return fallback;

    const localCenter = vec3.fromValues(local[0], local[1], local[2]);
    if (pc?.transform && pc.transform.length >= 16) {
      const world = vec3.transformMat4(vec3.create(), localCenter, pc.transform as Float32Array);
      return world;
    }
    return localCenter;
  }

  /**
   * Get camera info
   */
  getCamera(): { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number; w: number } } | null {
    const camera = this.cameraManager.getCamera();
    if (!camera) return null;

    const pos = camera.positionV;
    const rot = camera.rotationQ;

    return {
      position: { x: pos[0], y: pos[1], z: pos[2] },
      rotation: { x: rot[0], y: rot[1], z: rot[2], w: rot[3] }
    };
  }

  /**
   * Reset camera
   */
  resetCamera(): void {
    this.cameraManager.resetCamera();
    console.log('[EditorApp] Camera reset');
  }

  /**
   * Get current scene background color in #RRGGBB format.
   */
  getSceneBackgroundColorHex(): string {
    return this.rgbaToHex(this.sceneBackgroundColor);
  }

  /**
   * Set scene background color using #RRGGBB.
   */
  setSceneBackgroundColorHex(hex: string): boolean {
    const parsed = this.hexToRgb(hex);
    if (!parsed) return false;
    this.sceneBackgroundColor = [parsed[0], parsed[1], parsed[2], 1.0];
    this.sceneSkyPresetId = "custom";
    this.renderLoop.setBackgroundColor(this.sceneBackgroundColor);
    return true;
  }

  /**
   * Get current selected sky preset id.
   */
  getSceneSkyPresetId(): string {
    return this.sceneSkyPresetId;
  }

  /**
   * List available sky presets.
   */
  getSceneSkyPresets(): SceneSkyPreset[] {
    return SCENE_SKY_PRESETS.map((preset) => ({ ...preset }));
  }

  /**
   * Apply one predefined sky preset.
   */
  applySceneSkyPreset(id: string): SceneSkyPreset | null {
    const preset = SCENE_SKY_PRESETS.find((item) => item.id === id);
    if (!preset) return null;
    const ok = this.setSceneBackgroundColorHex(preset.colorHex);
    if (!ok) return null;
    this.sceneSkyPresetId = preset.id;
    return { ...preset };
  }

  /**
   * Get depth visualization range scale.
   */
  getSceneDepthRangeScale(): number {
    return this.sceneDepthRangeScale;
  }

  /**
   * Set depth visualization range scale (0.01 - 100.0).
   */
  setSceneDepthRangeScale(scale: number): boolean {
    if (!Number.isFinite(scale)) return false;
    const safe = Math.max(0.01, Math.min(100, scale));
    this.sceneDepthRangeScale = safe;
    this.renderLoop.setDepthRangeScale(safe);
    return true;
  }

  private hexToRgb(hex: string): [number, number, number] | null {
    const normalized = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
    if (!normalized) return null;
    const raw = normalized[1];
    const r = Number.parseInt(raw.slice(0, 2), 16) / 255;
    const g = Number.parseInt(raw.slice(2, 4), 16) / 255;
    const b = Number.parseInt(raw.slice(4, 6), 16) / 255;
    return [r, g, b];
  }

  private rgbaToHex(color: [number, number, number, number]): string {
    const toHex = (v: number) => {
      const clamped = Math.max(0, Math.min(255, Math.round(v * 255)));
      return clamped.toString(16).padStart(2, "0");
    };
    return `#${toHex(color[0])}${toHex(color[1])}${toHex(color[2])}`;
  }

  /**
   * Handle canvas resize
   */
  private resize(): void {
    if (!this.canvas) return;
    this.cameraManager.resize(this.canvas);

    if (this.renderer) {
      // Render loop handles renderer resize
    }
  }

  /**
   * Show loading overlay
   */
  private showLoading(show: boolean, text?: string, pct?: number): void {
    if (!this.loadingOverlay) return;

    setHidden(this.loadingOverlay, !show);

    if (text) {
      const loadingText = this.loadingOverlay.querySelector('.loading-text');
      if (loadingText) loadingText.textContent = text;
    }

    if (typeof pct === "number" && this.progressFill) {
      this.progressFill.style.width = `${Math.min(pct, 100)}%`;
    }

    if (this.progressText) {
      this.progressText.textContent = pct !== undefined ? `${Math.round(Math.min(pct, 100))}%` : '';
    }
  }

  /**
   * Show error message
   */
  private showError(msg: string): void {
    console.error('[EditorApp] Error:', msg);
    alert(msg);
  }

  /**
   * Register models changed callback
   */
  onModelsChanged(callback: (models: EditorModel[]) => void): void {
    this.onModelsChangedCallback = callback;
  }

  /**
   * Notify models changed
   */
  private notifyModelsChanged(): void {
    if (this.onModelsChangedCallback) {
      this.onModelsChangedCallback(this.getModels());
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.renderLoop.stop();
    this.clearAllModels();

    if (this.renderer) {
      const rendererWithDispose = this.renderer as unknown as { dispose?: () => void };
      rendererWithDispose.dispose?.();
    }

    this.gpu = null;
    this.renderer = null;

    console.log('[EditorApp] Disposed');
  }
}

// Create global editor instance
export const editorApp = new EditorApp();
