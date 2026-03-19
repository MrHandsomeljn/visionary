/**
 * Visionary Editor Application 0.1.0
 * Editor version of main app with UI controls
 */

import * as THREE from "three/webgpu";
import { vec3, quat } from "gl-matrix";
import { GaussianRenderer } from "../renderer/gaussian_renderer";
import { GaussianModel } from "../app/GaussianModel";
import { GaussianThreeJSRenderer } from "../app/GaussianThreeJSRenderer";
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
import {
  defaultLoader,
  detectGaussianFormat,
  isGaussianFormat,
  isThreeJSDataSource
} from "../io";
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

const MESH_EXTENSIONS = new Set(["glb", "gltf", "obj", "fbx", "stl"]);
const EDITOR_ORIGINAL_MATERIAL_KEY = "__editorOriginalMaterial";
const EDITOR_OVERRIDE_MATERIAL_KEY = "__editorOverrideMaterial";
const EDITOR_DEPTH_RANGE_UNIFORM_KEY = "__editorDepthRangeUniform";
const EDITOR_DEPTH_RANGE_VALUE_KEY = "__editorDepthRangeValue";
const EDITOR_DEPTH_RANGE_UNIFORM_NAME = "uEditorDepthRange";
const EDITOR_DEPTH_BASE_EXTENT_KEY = "__editorDepthBaseExtent";
const EDITOR_CAMERA_SEQUENCE_HELPER_KEY = "__visionaryEditorHelper";
const CAMERA_SEQUENCE_FRUSTUM_COLOR = 0x22c55e;
const CAMERA_SEQUENCE_PATH_COLOR = 0x4a90d9;
const CAMERA_SEQUENCE_CURRENT_COLOR = 0xf59e0b;
const CAMERA_SEQUENCE_FRUSTUM_RADIUS_FACTOR = 0.022;
const CAMERA_SEQUENCE_PATH_RADIUS_FACTOR = 0.026;

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
  object3D?: THREE.Object3D;
  gaussianModel?: GaussianModel;
  sourceFile?: File;
  sourcePath?: string;
  animDuration?: number;
  animStartTime?: number;
  animEndTime?: number;
}

interface EditorCameraPose {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  fovDegrees: number;
}

interface EditorRenderCameraSnapshot {
  position: { x: number; y: number; z: number };
  quaternion: { x: number; y: number; z: number; w: number };
  fovDegrees: number;
  near: number;
  far: number;
  aspect: number;
}

interface EditorTimelineCameraKeyframe {
  frame: number;
  time: number;
  camera: EditorCameraPose;
}

interface EditorCameraTrajectoryPoint {
  x: number;
  y: number;
  z: number;
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
  private meshCanvas: HTMLCanvasElement | null = null;
  private meshRenderer: THREE.WebGPURenderer | null = null;
  private meshScene: THREE.Scene | null = null;
  private meshCamera: THREE.PerspectiveCamera | null = null;
  private fusedRenderer: GaussianThreeJSRenderer | null = null;
  private meshRenderAnimationId = 0;
  private fusionLastTime = performance.now();
  private fusionFrameRunning = false;
  private fusionStartTime = performance.now();

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
  private cameraSequenceVisible: boolean = true;
  private cameraSequenceGroup: THREE.Group | null = null;
  private cameraSequenceCurrentMarker: THREE.Mesh | null = null;
  private onCameraInteractionCallback: ((kind: "drag" | "wheel" | "keyboard") => void) | null = null;

  // Mouse state for camera control
  private lastMouseX = 0;
  private lastMouseY = 0;
  private leftMouseDown = false;
  private rightMouseDown = false;
  private activeCameraKeys: Set<string> = new Set();

  // Version
  readonly VERSION = "0.1.0";

  private globalTimelineTime: number = 0;

  public setGlobalTimelineTime(timeSec: number): void {
    this.globalTimelineTime = timeSec;
  }

  public setModelAnimTimeBounds(id: string, start: number, end: number): void {
    const model = this.editorModels.get(id);
    if (model && model.modelEntry) {
      model.modelEntry.animStartTime = start;
      model.modelEntry.animEndTime = end;
      if (this.onModelsChangedCallback) {
        this.onModelsChangedCallback(Array.from(this.editorModels.values()));
      }
    }
  }

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

    // Initialize mesh overlay renderer (for GLB/GLTF/OBJ/FBX/STL)
    await this.initMeshViewport();

    // Setup resize handler
    window.addEventListener("resize", () => this.resize());
    this.resize();

    // Setup canvas event listeners (using same approach as demo/simple)
    this.setupCanvasEvents();

    // Keep legacy render loop state in sync for backward compatibility, but use fused loop for rendering.
    this.renderLoop.init(this.gpu, this.renderer, this.canvas);
    this.renderLoop.setBackgroundColor(this.sceneBackgroundColor);
    this.renderLoop.setDepthRangeScale(this.sceneDepthRangeScale);
    this.startMeshRenderLoop();

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
        if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
          this.notifyCameraInteraction("drag");
        }
        const controller = this.cameraManager.getController();
        controller.processMouse(-dx, -dy);
      }
    });

    // Wheel event
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.notifyCameraInteraction("wheel");
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

  private async initMeshViewport(): Promise<void> {
    if (!this.canvas || !this.gpu) return;
    this.meshCanvas = this.canvas;

    this.meshScene = new THREE.Scene();
    this.meshCamera = new THREE.PerspectiveCamera(45, 1, 0.01, 2000);
    this.meshCamera.matrixAutoUpdate = true;

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.meshScene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 0.8);
    key.position.set(5, 8, 6);
    this.meshScene.add(key);

    try {
      this.meshRenderer = new THREE.WebGPURenderer({
        canvas: this.canvas,
        antialias: true,
        forceWebGL: false,
        context: this.gpu.context,
        device: this.gpu.device
      });
      await this.meshRenderer.init();
      this.meshRenderer.setClearColor(
        new THREE.Color(this.sceneBackgroundColor[0], this.sceneBackgroundColor[1], this.sceneBackgroundColor[2]),
        this.sceneBackgroundColor[3]
      );
      this.meshRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      const rect = this.canvas.getBoundingClientRect();
      this.meshRenderer.setSize(rect.width || 1, rect.height || 1, false);

      // Always keep fused renderer alive (even with 0 Gaussian models) so mesh-only depth preview works.
      if (!this.fusedRenderer && this.meshScene) {
        this.fusedRenderer = new GaussianThreeJSRenderer(this.meshRenderer, this.meshScene, []);
        await this.fusedRenderer.init();
        this.fusedRenderer.setDepthRangeScale(this.sceneDepthRangeScale);
        this.fusedRenderer.setPreviewMode(this.renderMode);
      }
    } catch (error) {
      console.warn("[EditorApp] Fused renderer initialization failed:", error);
      this.meshRenderer = null;
    }
  }

  private startMeshRenderLoop(): void {
    if (this.meshRenderAnimationId !== 0) return;
    this.fusionLastTime = performance.now();
    this.fusionStartTime = this.fusionLastTime;
    const tick = async () => {
      this.meshRenderAnimationId = requestAnimationFrame(tick);
      if (this.fusionFrameRunning) return;
      if (!this.meshRenderer || !this.meshScene || !this.meshCamera) return;

      this.fusionFrameRunning = true;
      try {
        const now = performance.now();
        const dt = Math.min(0.05, (now - this.fusionLastTime) / 1000);
        this.fusionLastTime = now;

        this.cameraManager.update(dt);
        this.syncMeshCameraFromCoreCamera();
        this.updateCameraSequenceCurrentMarkerFromMeshCamera();

        if (this.fusedRenderer) {
          let modelIndex = 0;
          for (const model of this.editorModels.values()) {
            if (model.gaussianModel) {
              const rendererId = `model_${modelIndex}`;
              if (model.isDynamic && model.modelEntry) {
                const start = model.modelEntry.animStartTime ?? 0;
                const end = model.modelEntry.animEndTime ?? 10;
                
                if (this.globalTimelineTime >= start && this.globalTimelineTime <= end) {
                  this.fusedRenderer.setModelVisible(rendererId, model.visible);
                  const localTime = (this.globalTimelineTime - start) * (model.modelEntry.animSpeed ?? 1.0);
                  this.fusedRenderer.setModelAnimationTime(rendererId, localTime);
                } else {
                  this.fusedRenderer.setModelVisible(rendererId, false);
                }
              }
              modelIndex++;
            }
          }

          await this.fusedRenderer.updateDynamicModels(this.meshCamera, (now - this.fusionStartTime) / 500.0);
          this.fusedRenderer.onBeforeRender(this.meshRenderer, this.meshScene, this.meshCamera);
          this.fusedRenderer.renderThreeScene(this.meshCamera);
          const drew = this.fusedRenderer.drawSplats(this.meshRenderer, this.meshScene, this.meshCamera);
          if (!drew && this.renderMode !== "depth") {
            this.meshRenderer.render(this.meshScene, this.meshCamera);
          }
        } else {
          this.meshRenderer.render(this.meshScene, this.meshCamera);
        }
      } finally {
        this.fusionFrameRunning = false;
      }
    };
    this.meshRenderAnimationId = requestAnimationFrame(tick);
  }

  private stopMeshRenderLoop(): void {
    if (this.meshRenderAnimationId !== 0) {
      cancelAnimationFrame(this.meshRenderAnimationId);
      this.meshRenderAnimationId = 0;
    }
  }

  private syncMeshCameraFromCoreCamera(): void {
    if (!this.meshCamera) return;
    const src = this.cameraManager.getCamera();
    if (!src) return;

    const c2w = quat.create();
    quat.invert(c2w, src.rotationQ);
    const forward = vec3.transformQuat(vec3.create(), vec3.fromValues(0, 0, 1), c2w);
    const up = vec3.transformQuat(vec3.create(), vec3.fromValues(0, 1, 0), c2w);

    this.meshCamera.position.set(src.positionV[0], src.positionV[1], src.positionV[2]);
    this.meshCamera.up.set(up[0], up[1], up[2]);
    this.meshCamera.lookAt(
      src.positionV[0] + forward[0],
      src.positionV[1] + forward[1],
      src.positionV[2] + forward[2]
    );

    const aspect = this.canvas && this.canvas.height > 0 ? this.canvas.width / this.canvas.height : 1;
    this.meshCamera.aspect = aspect;
    this.meshCamera.fov = Math.max(1e-3, src.projection.fovy) * 180 / Math.PI;
    this.meshCamera.near = Math.max(1e-4, src.projection.znear);
    this.meshCamera.far = Math.max(this.meshCamera.near + 1e-3, src.projection.zfar);
    this.meshCamera.updateProjectionMatrix();
    this.meshCamera.updateMatrixWorld(true);
  }

  private isMeshFilename(fileName: string): boolean {
    const lower = fileName.toLowerCase();
    const ext = lower.includes(".") ? lower.split(".").pop() : "";
    return MESH_EXTENSIONS.has(ext || "");
  }

  private detectModelTypeFromFileName(fileName: string): string {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".onnx")) return "onnx";
    const gaussian = detectGaussianFormat(lower);
    if (gaussian) return gaussian;
    const ext = lower.includes(".") ? lower.split(".").pop() : "";
    if (MESH_EXTENSIONS.has(ext || "")) return ext || "mesh";
    return "unknown";
  }

  private addMeshObjectToScene(root: THREE.Object3D): void {
    if (!this.meshScene) return;
    const baseBox = new THREE.Box3().setFromObject(root);
    let baseExtent = 1.0;
    if (!baseBox.isEmpty()) {
      const size = baseBox.getSize(new THREE.Vector3());
      baseExtent = Math.max(0.001, size.x, size.y, size.z);
    }
    (root.userData ??= {})[EDITOR_DEPTH_BASE_EXTENT_KEY] = baseExtent;
    root.visible = true;
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh || !("isMesh" in mesh) || !(mesh as any).isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      (mesh.userData ??= {})[EDITOR_DEPTH_BASE_EXTENT_KEY] = baseExtent;
    });
    this.applyRenderModeToMeshObject(root, this.renderMode);
    this.meshScene.add(root);
  }

  private countMeshVertices(root: THREE.Object3D): number {
    let count = 0;
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh || !("isMesh" in mesh) || !(mesh as any).isMesh) return;
      const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
      const positionAttr = geometry?.attributes?.position;
      if (positionAttr && typeof positionAttr.count === "number") {
        count += positionAttr.count;
      }
    });
    return count;
  }

  private removeMeshObject(model: EditorModel): void {
    const object3D = model.object3D;
    if (!object3D || !this.meshScene) return;
    this.applyRenderModeToMeshObject(object3D, "color");
    this.meshScene.remove(object3D);
    object3D.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh || !("isMesh" in mesh) || !(mesh as any).isMesh) return;
      (mesh.geometry as THREE.BufferGeometry | undefined)?.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) {
        material.forEach((m) => m?.dispose?.());
      } else {
        material?.dispose?.();
      }
    });
  }

  private createMeshDepthPreviewMaterial(userData: Record<string, unknown>): THREE.MeshDepthMaterial {
    const override = new THREE.MeshDepthMaterial({ depthPacking: THREE.BasicDepthPacking });
    userData[EDITOR_DEPTH_RANGE_VALUE_KEY] = this.sceneDepthRangeScale;
    override.onBeforeCompile = (shader) => {
      const rangeValue = userData[EDITOR_DEPTH_RANGE_VALUE_KEY];
      const initialRange = typeof rangeValue === "number" && Number.isFinite(rangeValue)
        ? Math.max(0.000001, rangeValue)
        : this.sceneDepthRangeScale;
      const depthRangeUniform = { value: initialRange };
      shader.uniforms[EDITOR_DEPTH_RANGE_UNIFORM_NAME] = depthRangeUniform;
      userData[EDITOR_DEPTH_RANGE_UNIFORM_KEY] = depthRangeUniform;
      let fragment = shader.fragmentShader.replace(
        "#include <packing>",
        `#include <packing>
uniform float ${EDITOR_DEPTH_RANGE_UNIFORM_NAME};`
      );
      const outputExpr = `float viewZ = -perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
float depthRange = max(${EDITOR_DEPTH_RANGE_UNIFORM_NAME}, 0.000001);
float depth01 = clamp(viewZ / depthRange, 0.0, 1.0);
gl_FragColor = vec4(vec3(1.0 - depth01), opacity);`;
      fragment = fragment.replace(
        /gl_FragColor\s*=\s*vec4\s*\(\s*vec3\s*\(\s*1\.0\s*-\s*fragCoordZ\s*\)\s*,\s*opacity\s*\)\s*;/,
        outputExpr
      );
      fragment = fragment.replace(
        /gl_FragColor\s*=\s*packDepthToRGBA\s*\(\s*fragCoordZ\s*\)\s*;/,
        outputExpr
      );
      shader.fragmentShader = fragment;
    };
    override.needsUpdate = true;
    return override;
  }

  private syncMeshDepthRangeUniform(root: THREE.Object3D): void {
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh || !("isMesh" in mesh) || !(mesh as any).isMesh) return;
      const userData = (mesh.userData ??= {}) as Record<string, unknown>;
      userData[EDITOR_DEPTH_RANGE_VALUE_KEY] = this.sceneDepthRangeScale;
      const depthRangeUniform = userData[EDITOR_DEPTH_RANGE_UNIFORM_KEY] as { value: number } | undefined;
      if (depthRangeUniform && typeof depthRangeUniform.value === "number") {
        depthRangeUniform.value = Math.max(0.000001, this.sceneDepthRangeScale);
      }
    });
  }

  private applyRenderModeToMeshObject(root: THREE.Object3D, mode: EditorRenderMode): boolean {
    let updated = false;
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh || !("isMesh" in mesh) || !(mesh as any).isMesh) return;

      const userData = (mesh.userData ??= {}) as Record<string, unknown>;
      const original = userData[EDITOR_ORIGINAL_MATERIAL_KEY] as THREE.Material | THREE.Material[] | undefined;
      if (!original) {
        userData[EDITOR_ORIGINAL_MATERIAL_KEY] = mesh.material as THREE.Material | THREE.Material[];
      }

      const activeOverride = userData[EDITOR_OVERRIDE_MATERIAL_KEY] as THREE.Material | THREE.Material[] | undefined;
      const disposeMaterial = (mat: THREE.Material | THREE.Material[] | undefined) => {
        if (!mat) return;
        if (Array.isArray(mat)) {
          mat.forEach((m) => m?.dispose?.());
        } else {
          mat.dispose?.();
        }
      };

      if (mode === "color" || mode === "depth") {
        if (activeOverride) {
          disposeMaterial(activeOverride);
          delete userData[EDITOR_OVERRIDE_MATERIAL_KEY];
          delete userData[EDITOR_DEPTH_RANGE_UNIFORM_KEY];
          delete userData[EDITOR_DEPTH_RANGE_VALUE_KEY];
        }
        const restore = userData[EDITOR_ORIGINAL_MATERIAL_KEY] as THREE.Material | THREE.Material[] | undefined;
        if (restore) {
          mesh.material = restore;
          updated = true;
        }
        return;
      }

      if (activeOverride) {
        disposeMaterial(activeOverride);
        delete userData[EDITOR_OVERRIDE_MATERIAL_KEY];
      }

      const override = new THREE.MeshNormalMaterial();
      mesh.material = override;
      userData[EDITOR_OVERRIDE_MATERIAL_KEY] = override;
      updated = true;
    });
    return updated;
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

  private remapCameraCode(code: string): string {
    if (code === "KeyA") return "KeyD";
    if (code === "KeyD") return "KeyA";
    return code;
  }

  private handleCameraKeyboard(event: KeyboardEvent, pressed: boolean): void {
    if (!CAMERA_KEY_CODES.has(event.code)) return;
    if (this.isEditingText()) return;
    if (pressed && event.repeat) return;
    const mappedCode = this.remapCameraCode(event.code);

    const isAltKey = event.code === "AltLeft" || event.code === "AltRight";
    if (isAltKey) {
      this.setControllerAltPressed(pressed);
    }

    const controller = this.cameraManager.getController();
    if (pressed) {
      if (this.activeCameraKeys.has(mappedCode)) return;
      const handled = controller.processKeyboard(mappedCode, true);
      if (handled) {
        this.activeCameraKeys.add(mappedCode);
        this.notifyCameraInteraction("keyboard");
        event.preventDefault();
      }
      return;
    }

    if (!this.activeCameraKeys.has(mappedCode)) return;
    controller.processKeyboard(mappedCode, false);
    this.activeCameraKeys.delete(mappedCode);
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
      const modelType = this.detectModelTypeFromFileName(lowerName);

      let modelEntry: ModelEntry | null = null;
      let meshObject: THREE.Object3D | null = null;
      let gaussianModel: GaussianModel | null = null;
      let isDynamic = false;
      let pointCount = 0;
      let position = { x: 0, y: 0, z: 0 };
      let rotation = { x: 0, y: 0, z: 0 };
      let scale = 1;

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
        if (!modelEntry) {
          throw new Error('Failed to create ONNX model entry');
        }
        isDynamic = Boolean(modelEntry.isDynamic);
        pointCount = Number(modelEntry.pointCount ?? 0);
      } else if (isGaussianFormat(lowerName)) {
        // Load Gaussian model (PLY, SPZ, KSplat, SPLAT, SOG, etc.)
        modelEntry = await this.fileLoader.loadFile(file, this.gpu.device);
        if (!modelEntry) {
          throw new Error('Failed to create Gaussian model entry');
        }
        isDynamic = Boolean(modelEntry.isDynamic);
        pointCount = Number(modelEntry.pointCount ?? 0);
      } else if (this.isMeshFilename(lowerName)) {
        const loaded = await defaultLoader.loadFile(file, {
          isGaussian: false,
          onProgress: (progress) => {
            this.showLoading(true, progress.stage, Math.round(progress.progress * 100));
          }
        });
        if (!isThreeJSDataSource(loaded)) {
          throw new Error(`File loaded but not recognized as mesh: ${file.name}`);
        }
        meshObject = loaded.object3D() as THREE.Object3D;
        this.addMeshObjectToScene(meshObject);
        pointCount = this.countMeshVertices(meshObject);
        position = { x: meshObject.position.x, y: meshObject.position.y, z: meshObject.position.z };
        rotation = { x: meshObject.rotation.x, y: meshObject.rotation.y, z: meshObject.rotation.z };
        scale = Number(meshObject.scale.x || 1);
      } else {
        throw new Error(`Unsupported file type: ${file.name}. Supported: ${defaultLoader.getAllSupportedExtensions().join(', ')}`);
      }

      if (modelEntry) {
        if (isDynamic) {
          modelEntry.animStartTime = 0;
          modelEntry.animEndTime = modelEntry.animDuration ?? 10;
        }
        if (!this.meshScene || !this.meshRenderer) {
          throw new Error("Fusion renderer not initialized");
        }
        gaussianModel = new GaussianModel(modelEntry);
        this.meshScene.add(gaussianModel);
        if (!this.fusedRenderer) {
          this.fusedRenderer = new GaussianThreeJSRenderer(this.meshRenderer, this.meshScene, [gaussianModel]);
          await this.fusedRenderer.init();
          this.fusedRenderer.setDepthRangeScale(this.sceneDepthRangeScale);
          this.fusedRenderer.setPreviewMode(this.renderMode);
        } else {
          this.fusedRenderer.appendGaussianModel(gaussianModel);
        }
        this.applyRenderModeToModelEntry(modelEntry, this.renderMode);
      }

      if ((!Number.isFinite(pointCount) || pointCount <= 0) && modelEntry?.pointCloud) {
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
        pointCount,
        visible: true,
        isDynamic,
        position,
        rotation,
        scale,
        modelType,
        modelEntry: modelEntry || undefined,
        object3D: meshObject || undefined,
        gaussianModel: gaussianModel || undefined,
        sourceFile: file,
        sourcePath: options.sourcePath || file.name,
        animDuration: Number.isFinite(Number(modelEntry?.animDuration)) ? Number(modelEntry?.animDuration) : undefined
      };

      this.editorModels.set(editorModel.id, editorModel);

      // Setup camera for first model
      if (this.editorModels.size === 1) {
        if (modelEntry?.pointCloud instanceof PointCloud) {
          this.setupCameraForFirstModel(modelEntry.pointCloud);
        } else if (meshObject) {
          this.setupCameraForFirstMesh(meshObject);
        }
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

  private setupCameraForFirstMesh(object3D: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(object3D);
    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.length() * 0.5, 1e-3);

    console.log(
      `[EditorApp] Mesh bounds: center=[${center.x.toFixed(2)},${center.y.toFixed(2)},${center.z.toFixed(2)}], radius=${radius.toFixed(2)}`
    );

    const distance = Math.max(radius * 2.2, 2.0);
    const pos = vec3.fromValues(
      center.x - distance * 0.5,
      center.y - distance * 0.5,
      center.z - distance * 0.5
    );

    const camera = this.cameraManager.getCamera();
    if (camera) {
      vec3.copy(camera.positionV, pos);
      const focus = vec3.fromValues(center.x, center.y, center.z);
      const forward = vec3.subtract(vec3.create(), focus, pos);
      if (vec3.length(forward) > 1e-6) {
        vec3.normalize(forward, forward);
        camera.rotationQ = lookAtW2C(forward, vec3.fromValues(0, 1, 0));
      }
      this.cameraManager.syncOrbitAfterExternalLookAt(focus, vec3.fromValues(0, 1, 0));
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
    if (model.gaussianModel && this.fusedRenderer) {
      const models = this.fusedRenderer.getGaussianModels();
      const index = models.indexOf(model.gaussianModel);
      if (index >= 0) {
        this.fusedRenderer.removeModelById(`model_${index}`);
      } else if (this.meshScene) {
        this.meshScene.remove(model.gaussianModel);
      }
    }
    this.removeMeshObject(model);

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
    if (model.gaussianModel) {
      model.gaussianModel.setModelVisible(visible);
    }
    if (model.object3D) {
      model.object3D.visible = visible;
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
    if (model.gaussianModel) {
      model.gaussianModel.position.set(x, y, z);
    } else if (model.object3D) {
      model.object3D.position.set(x, y, z);
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
    if (model.gaussianModel) {
      model.gaussianModel.rotation.set(rx, ry, rz);
    } else if (model.object3D) {
      model.object3D.rotation.set(rx, ry, rz);
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
    if (model.gaussianModel) {
      model.gaussianModel.scale.set(scale, scale, scale);
    } else if (model.object3D) {
      model.object3D.scale.set(scale, scale, scale);
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
    if (model.gaussianModel) {
      model.gaussianModel.position.set(0, 0, 0);
      model.gaussianModel.rotation.set(0, 0, 0);
      model.gaussianModel.scale.set(1, 1, 1);
    } else if (model.object3D) {
      model.object3D.position.set(0, 0, 0);
      model.object3D.rotation.set(0, 0, 0);
      model.object3D.scale.set(1, 1, 1);
    }

    return true;
  }

  /**
   * Clear all models
   */
  clearAllModels(): void {
    const ids = Array.from(this.editorModels.keys());
    ids.forEach((id) => {
      this.removeModel(id);
    });
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
    this.fusedRenderer?.setPreviewMode(mode);
    let updated = 0;
    this.editorModels.forEach((model) => {
      if (this.applyRenderModeToModelEntry(model.modelEntry, mode)) {
        updated += 1;
      }
      if (model.object3D && this.applyRenderModeToMeshObject(model.object3D, mode)) {
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

    const safeSpeed = Number.isFinite(speed) ? speed : 1.0;
    dynamicPC.setAnimationSpeed(safeSpeed);
    if (model.modelEntry) {
      model.modelEntry.animSpeed = safeSpeed;
      this.notifyModelsChanged();
    }
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
    if (model.gaussianModel) {
      const worldAabb = model.gaussianModel.getWorldAABB();
      if (worldAabb) {
        const c = worldAabb.center();
        return vec3.fromValues(c[0], c[1], c[2]);
      }
    }
    if (model.object3D) {
      const box = new THREE.Box3().setFromObject(model.object3D);
      if (!box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3());
        return vec3.fromValues(center.x, center.y, center.z);
      }
    }
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
   * Get camera pose used by timeline keyframes.
   */
  getCameraPose(): EditorCameraPose | null {
    const camera = this.getCamera();
    if (!camera) return null;
    return {
      ...camera,
      fovDegrees: this.getSceneCameraFovDegrees(),
    };
  }

  /**
   * Set camera pose from timeline keyframe.
   */
  setCameraPose(pose: Partial<EditorCameraPose> | null | undefined): boolean {
    if (!pose?.position || !pose?.rotation) return false;

    const px = Number(pose.position.x);
    const py = Number(pose.position.y);
    const pz = Number(pose.position.z);
    const qx = Number(pose.rotation.x);
    const qy = Number(pose.rotation.y);
    const qz = Number(pose.rotation.z);
    const qw = Number(pose.rotation.w);

    if (![px, py, pz, qx, qy, qz, qw].every((v) => Number.isFinite(v))) {
      return false;
    }

    const pos = vec3.fromValues(px, py, pz);
    const rot = quat.fromValues(qx, qy, qz, qw);
    const ok = this.cameraManager.setCameraPose(pos, rot);
    if (!ok) return false;

    if (Number.isFinite(Number(pose.fovDegrees))) {
      this.setSceneCameraFovDegrees(Number(pose.fovDegrees));
    }

    return true;
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
    if (this.meshRenderer) {
      this.meshRenderer.setClearColor(
        new THREE.Color(this.sceneBackgroundColor[0], this.sceneBackgroundColor[1], this.sceneBackgroundColor[2]),
        this.sceneBackgroundColor[3]
      );
    }
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
   * Get Three.js renderer used by editor viewport.
   */
  getMeshRenderer(): THREE.WebGPURenderer | null {
    return this.meshRenderer;
  }

  /**
   * Get Three.js scene used by editor viewport.
   */
  getMeshScene(): THREE.Scene | null {
    return this.meshScene;
  }

  /**
   * Get fused renderer used by editor viewport.
   */
  getFusedRenderer(): GaussianThreeJSRenderer | null {
    return this.fusedRenderer;
  }

  /**
   * Get render camera snapshot (Three.js world-space pose).
   * This is used by export pipeline to keep captured frames aligned with current editor camera.
   */
  getRenderCameraSnapshot(): EditorRenderCameraSnapshot | null {
    if (!this.meshCamera) return null;
    this.syncMeshCameraFromCoreCamera();
    this.meshCamera.updateMatrixWorld(true);
    return {
      position: {
        x: this.meshCamera.position.x,
        y: this.meshCamera.position.y,
        z: this.meshCamera.position.z,
      },
      quaternion: {
        x: this.meshCamera.quaternion.x,
        y: this.meshCamera.quaternion.y,
        z: this.meshCamera.quaternion.z,
        w: this.meshCamera.quaternion.w,
      },
      fovDegrees: this.meshCamera.fov,
      near: this.meshCamera.near,
      far: this.meshCamera.far,
      aspect: this.meshCamera.aspect,
    };
  }

  /**
   * Visualize camera keyframes as frustums and center trajectory in 3D scene.
   * Reuses the same frustum geometry convention as RecordingCamera gizmo.
   */
  setCameraSequenceVisualization(
    keyframes: EditorTimelineCameraKeyframe[],
    selectedFrame?: number | null,
    sampledTrajectory?: EditorCameraTrajectoryPoint[]
  ): boolean {
    if (!this.meshScene) return false;
    const group = this.ensureCameraSequenceGroup();
    if (!group) return false;
    group.visible = this.cameraSequenceVisible;

    this.clearCameraSequenceGroupContents();

    const normalized = (Array.isArray(keyframes) ? keyframes : [])
      .filter((item) => item && item.camera && item.camera.position && item.camera.rotation)
      .map((item) => ({
        frame: Math.round(Number(item.frame) || 0),
        time: Number(item.time) || 0,
        camera: item.camera,
      }))
      .sort((a, b) => a.frame - b.frame);

    if (normalized.length === 0) {
      return true;
    }

    const centers = normalized.map((item) =>
      new THREE.Vector3(
        Number(item.camera.position.x) || 0,
        Number(item.camera.position.y) || 0,
        Number(item.camera.position.z) || 0
      )
    );
    const sampledCenters = (Array.isArray(sampledTrajectory) ? sampledTrajectory : [])
      .map((p) => new THREE.Vector3(Number(p?.x) || 0, Number(p?.y) || 0, Number(p?.z) || 0))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));

    const aspect = this.meshCamera && Number.isFinite(this.meshCamera.aspect) && this.meshCamera.aspect > 0
      ? this.meshCamera.aspect
      : 16 / 9;
    const frustumLength = this.computeCameraSequenceFrustumLength();
    const selected = Number.isFinite(Number(selectedFrame)) ? Math.round(Number(selectedFrame)) : null;

    const frustumRadius = Math.max(0.003, frustumLength * CAMERA_SEQUENCE_FRUSTUM_RADIUS_FACTOR);
    const pathRadius = Math.max(0.003, frustumLength * CAMERA_SEQUENCE_PATH_RADIUS_FACTOR);

    for (const item of normalized) {
      const color = selected !== null && item.frame === selected
        ? CAMERA_SEQUENCE_CURRENT_COLOR
        : CAMERA_SEQUENCE_FRUSTUM_COLOR;
      const frustum = this.buildCameraFrustumWireframe(
        item.camera,
        aspect,
        frustumLength,
        frustumRadius,
        color
      );
      if (frustum) {
        group.add(frustum);
      }
    }

    const pathPoints = sampledCenters.length >= 2 ? sampledCenters : centers;
    if (pathPoints.length >= 2) {
      for (let i = 1; i < pathPoints.length; i++) {
        const segment = this.buildThickLineSegment(
          pathPoints[i - 1],
          pathPoints[i],
          pathRadius,
          CAMERA_SEQUENCE_PATH_COLOR,
          0.9
        );
        if (segment) {
          group.add(segment);
        }
      }
    }

    const markerRadius = Math.max(0.02, frustumLength * 0.08);
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(markerRadius, 12, 8),
      new THREE.MeshBasicMaterial({
        color: CAMERA_SEQUENCE_CURRENT_COLOR,
        transparent: false,
        depthTest: true,
        depthWrite: true,
      })
    );
    marker.renderOrder = 0;
    marker.userData[EDITOR_CAMERA_SEQUENCE_HELPER_KEY] = true;
    group.add(marker);
    this.cameraSequenceCurrentMarker = marker;
    this.updateCameraSequenceCurrentMarkerFromMeshCamera();

    return true;
  }

  clearCameraSequenceVisualization(): void {
    this.clearCameraSequenceGroupContents();
  }

  setCameraSequenceVisible(visible: boolean): boolean {
    this.cameraSequenceVisible = !!visible;
    if (this.cameraSequenceGroup) {
      this.cameraSequenceGroup.visible = this.cameraSequenceVisible;
      this.cameraSequenceGroup.updateMatrixWorld(true);
    }
    return true;
  }

  getCameraSequenceVisible(): boolean {
    return this.cameraSequenceVisible;
  }

  onCameraInteraction(callback: ((kind: "drag" | "wheel" | "keyboard") => void) | null): void {
    this.onCameraInteractionCallback = callback;
  }

  private ensureCameraSequenceGroup(): THREE.Group | null {
    if (!this.meshScene) return null;
    if (this.cameraSequenceGroup && this.cameraSequenceGroup.parent === this.meshScene) {
      return this.cameraSequenceGroup;
    }

    const group = new THREE.Group();
    group.name = "EditorCameraSequence";
    group.visible = this.cameraSequenceVisible;
    group.userData[EDITOR_CAMERA_SEQUENCE_HELPER_KEY] = true;
    this.meshScene.add(group);
    this.cameraSequenceGroup = group;
    return group;
  }

  private clearCameraSequenceGroupContents(): void {
    if (!this.cameraSequenceGroup) {
      this.cameraSequenceCurrentMarker = null;
      return;
    }

    while (this.cameraSequenceGroup.children.length > 0) {
      const child = this.cameraSequenceGroup.children.pop();
      if (!child) continue;
      this.disposeObject3DResources(child);
      this.cameraSequenceGroup.remove(child);
    }
    this.cameraSequenceCurrentMarker = null;
  }

  private disposeObject3DResources(object: THREE.Object3D): void {
    object.traverse((node) => {
      const asMesh = node as THREE.Mesh;
      const geometry = asMesh.geometry as THREE.BufferGeometry | undefined;
      if (geometry && typeof geometry.dispose === "function") {
        geometry.dispose();
      }

      const materialCandidate = asMesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(materialCandidate)) {
        materialCandidate.forEach((material) => material?.dispose?.());
      } else {
        materialCandidate?.dispose?.();
      }
    });
  }

  private computeCameraSequenceFrustumLength(): number {
    const sceneBounds = new THREE.Box3();
    let hasBounds = false;

    // Use current model bounds as the stable scale reference.
    // This avoids helper thickness/size changing when only keyframe count changes.
    for (const model of this.editorModels.values()) {
      if (!model?.visible) continue;

      if (model.object3D) {
        const meshBounds = new THREE.Box3().setFromObject(model.object3D);
        if (!meshBounds.isEmpty()) {
          sceneBounds.union(meshBounds);
          hasBounds = true;
        }
      }

      const gaussianAabb = (model.gaussianModel as any)?.getWorldAABB?.();
      const min = gaussianAabb?.min as [number, number, number] | undefined;
      const max = gaussianAabb?.max as [number, number, number] | undefined;
      if (
        min && max &&
        Number.isFinite(min[0]) && Number.isFinite(min[1]) && Number.isFinite(min[2]) &&
        Number.isFinite(max[0]) && Number.isFinite(max[1]) && Number.isFinite(max[2])
      ) {
        sceneBounds.expandByPoint(new THREE.Vector3(min[0], min[1], min[2]));
        sceneBounds.expandByPoint(new THREE.Vector3(max[0], max[1], max[2]));
        hasBounds = true;
      }
    }

    if (!hasBounds || sceneBounds.isEmpty()) {
      return 0.35;
    }

    const size = sceneBounds.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(span) || span <= 0) {
      return 0.35;
    }
    return Math.max(0.15, Math.min(3.0, span * 0.08));
  }

  private buildCameraFrustumWireframe(
    pose: EditorCameraPose,
    aspect: number,
    frustumLength: number,
    lineRadius: number,
    color: number
  ): THREE.Group | null {
    const px = Number(pose?.position?.x);
    const py = Number(pose?.position?.y);
    const pz = Number(pose?.position?.z);
    const qx = Number(pose?.rotation?.x);
    const qy = Number(pose?.rotation?.y);
    const qz = Number(pose?.rotation?.z);
    const qw = Number(pose?.rotation?.w);
    const fov = Number(pose?.fovDegrees);

    if (![px, py, pz, qx, qy, qz, qw].every((v) => Number.isFinite(v))) {
      return null;
    }

    const center = new THREE.Vector3(px, py, pz);
    const w2c = new THREE.Quaternion(qx, qy, qz, qw);
    const c2w = w2c.clone().invert();

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(c2w).normalize();
    let up = new THREE.Vector3(0, 1, 0).applyQuaternion(c2w).normalize();
    let right = new THREE.Vector3().crossVectors(forward, up);
    if (right.lengthSq() < 1e-8) {
      right = new THREE.Vector3(1, 0, 0);
      up = new THREE.Vector3(0, 1, 0);
    } else {
      right.normalize();
      up = new THREE.Vector3().crossVectors(right, forward).normalize();
    }

    const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 9;
    const safeLength = Math.max(0.05, frustumLength);
    const safeFov = Math.max(1, Math.min(179, Number.isFinite(fov) ? fov : 45));
    const halfHeight = Math.tan((safeFov * Math.PI / 180) * 0.5) * safeLength;
    const halfWidth = halfHeight * safeAspect;

    const baseCenter = center.clone().addScaledVector(forward, safeLength);
    const tl = baseCenter.clone().addScaledVector(up, halfHeight).addScaledVector(right, -halfWidth);
    const tr = baseCenter.clone().addScaledVector(up, halfHeight).addScaledVector(right, halfWidth);
    const bl = baseCenter.clone().addScaledVector(up, -halfHeight).addScaledVector(right, -halfWidth);
    const br = baseCenter.clone().addScaledVector(up, -halfHeight).addScaledVector(right, halfWidth);

    const edges: Array<[THREE.Vector3, THREE.Vector3]> = [
      [center, tl],
      [center, tr],
      [center, bl],
      [center, br],
      [tl, tr],
      [tr, br],
      [br, bl],
      [bl, tl],
    ];

    const group = new THREE.Group();
    group.userData[EDITOR_CAMERA_SEQUENCE_HELPER_KEY] = true;
    for (const [start, end] of edges) {
      const segment = this.buildThickLineSegment(start, end, lineRadius, color, 0.88);
      if (!segment) continue;
      group.add(segment);
    }
    return group;
  }

  private buildThickLineSegment(
    start: THREE.Vector3,
    end: THREE.Vector3,
    radius: number,
    color: number,
    opacity = 0.9
  ): THREE.Mesh | null {
    const delta = new THREE.Vector3().subVectors(end, start);
    const length = delta.length();
    if (!Number.isFinite(length) || length <= 1e-6) return null;

    const geometry = new THREE.CylinderGeometry(
      Math.max(1e-4, radius),
      Math.max(1e-4, radius),
      length,
      10,
      1,
      true
    );
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 0.999,
      opacity,
      depthTest: true,
      depthWrite: true,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    const direction = delta.multiplyScalar(1 / length);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction
    );
    mesh.quaternion.copy(quaternion);
    mesh.renderOrder = 0;
    mesh.userData[EDITOR_CAMERA_SEQUENCE_HELPER_KEY] = true;
    return mesh;
  }

  private updateCameraSequenceCurrentMarkerFromMeshCamera(): void {
    if (!this.cameraSequenceCurrentMarker || !this.meshCamera) return;
    this.cameraSequenceCurrentMarker.position.copy(this.meshCamera.position);
    this.cameraSequenceCurrentMarker.updateMatrixWorld(true);
  }

  private notifyCameraInteraction(kind: "drag" | "wheel" | "keyboard"): void {
    if (!this.onCameraInteractionCallback) return;
    try {
      this.onCameraInteractionCallback(kind);
    } catch (error) {
      console.warn("[EditorApp] camera interaction callback error:", error);
    }
  }

  /**
   * Get scene camera vertical FOV in degrees.
   */
  getSceneCameraFovDegrees(): number {
    return this.cameraManager.getFovDegrees() ?? 45;
  }

  /**
   * Set scene camera vertical FOV in degrees.
   */
  setSceneCameraFovDegrees(value: number): boolean {
    return this.cameraManager.setFovDegrees(value);
  }

  /**
   * Set depth visualization range scale (0.01 - 100.0).
   */
  setSceneDepthRangeScale(scale: number): boolean {
    if (!Number.isFinite(scale)) return false;
    const safe = Math.max(0.01, Math.min(100, scale));
    this.sceneDepthRangeScale = safe;
    this.renderLoop.setDepthRangeScale(safe);
    this.fusedRenderer?.setDepthRangeScale(safe);
    this.editorModels.forEach((model) => {
      if (model.object3D) {
        this.syncMeshDepthRangeUniform(model.object3D);
      }
    });
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

    if (this.meshCanvas && this.canvas) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = this.canvas.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      if (this.meshCanvas.width !== w) this.meshCanvas.width = w;
      if (this.meshCanvas.height !== h) this.meshCanvas.height = h;
      if (this.meshRenderer) {
        this.meshRenderer.setPixelRatio(dpr);
        this.meshRenderer.setSize(rect.width || 1, rect.height || 1, false);
      }
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
    this.stopMeshRenderLoop();
    this.clearAllModels();
    this.clearCameraSequenceGroupContents();
    if (this.cameraSequenceGroup && this.meshScene) {
      this.meshScene.remove(this.cameraSequenceGroup);
    }
    this.cameraSequenceGroup = null;
    this.cameraSequenceCurrentMarker = null;

    if (this.renderer) {
      const rendererWithDispose = this.renderer as unknown as { dispose?: () => void };
      rendererWithDispose.dispose?.();
    }
    if (this.meshRenderer) {
      this.meshRenderer.dispose();
    }
    if (this.meshCanvas && this.meshCanvas !== this.canvas && this.meshCanvas.parentElement) {
      this.meshCanvas.parentElement.removeChild(this.meshCanvas);
    }

    this.gpu = null;
    this.renderer = null;
    this.meshRenderer = null;
    this.meshScene = null;
    this.meshCamera = null;
    this.meshCanvas = null;

    console.log('[EditorApp] Disposed');
  }
}

// Create global editor instance
export const editorApp = new EditorApp();
