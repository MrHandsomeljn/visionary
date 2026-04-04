import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { resolveAgentPreviewInstanceAction } from './agent-preview-sync-policy.js';

type AgentViewer3DBlock = {
  id: string;
  type: 'viewer3d';
  status: 'placeholder' | 'ready' | 'error';
  assetUrl?: string;
  format?: 'glb' | 'gltf';
  interaction?: {
    rotate?: boolean;
    zoom?: boolean;
    pan?: boolean;
    reset?: boolean;
  };
};

type SyncEntry = {
  block: AgentViewer3DBlock;
  host: HTMLElement;
};

type ViewerInstance = {
  host: HTMLElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  resizeObserver: ResizeObserver;
  frameHandle: number;
  object: THREE.Object3D | null;
  grid: THREE.Object3D | null;
  currentAssetUrl: string | null;
  homePosition: THREE.Vector3;
  homeTarget: THREE.Vector3;
};

function fitCameraToObject(camera: THREE.PerspectiveCamera, controls: OrbitControls, object: THREE.Object3D): {
  position: THREE.Vector3;
  target: THREE.Vector3;
} {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 0.25);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const distance = Math.max(radius / Math.tan(fov / 2), radius * 1.9);
  const position = center.clone().add(new THREE.Vector3(distance * 0.65, distance * 0.45, distance));

  camera.near = Math.max(0.01, distance / 100);
  camera.far = Math.max(20, distance * 10);
  camera.updateProjectionMatrix();
  controls.target.copy(center);

  return {
    position,
    target: center,
  };
}

export class AgentPreviewManager {
  private readonly loader = new GLTFLoader();
  private readonly instances = new Map<string, ViewerInstance>();

  sync(entries: SyncEntry[]): void {
    const nextIds = new Set(entries.map((entry) => entry.block.id));
    for (const [id, instance] of this.instances) {
      if (!nextIds.has(id)) {
        this.disposeInstance(id, instance);
      }
    }

    for (const entry of entries) {
      this.ensureInstance(entry);
    }
  }

  resetViewer(blockId: string): void {
    const instance = this.instances.get(blockId);
    if (!instance) return;
    instance.controls.reset();
    instance.controls.update();
  }

  disposeAll(): void {
    for (const [id, instance] of this.instances) {
      this.disposeInstance(id, instance);
    }
  }

  private ensureInstance(entry: SyncEntry): void {
    const existing = this.instances.get(entry.block.id);
    const action = resolveAgentPreviewInstanceAction({
      hasInstance: Boolean(existing),
      hostChanged: Boolean(existing && existing.host !== entry.host),
    });

    let instance: ViewerInstance;
    if (action === 'create') {
      instance = this.createInstance(entry.host, entry.block.id);
    } else if (action === 'reattach' && existing) {
      instance = existing;
      this.reattachInstanceHost(instance, entry.host);
    } else {
      instance = existing!;
    }

    this.updateInstance(instance, entry.block);
    this.instances.set(entry.block.id, instance);
  }

  private createInstance(host: HTMLElement, blockId: string): ViewerInstance {
    host.replaceChildren();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = 'agent-block-viewer-canvas';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    camera.position.set(1.5, 1.1, 2.4);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.4));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
    keyLight.position.set(3, 5, 4);
    scene.add(keyLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.target.set(0, 0.3, 0);
    controls.update();
    controls.saveState();

    const grid = new THREE.GridHelper(4, 8, 0x64748b, 0x334155);
    grid.position.y = -0.6;
    grid.visible = false;
    scene.add(grid);

    const renderFrame = () => {
      const instance = this.instances.get(blockId);
      if (!instance) return;
      instance.controls.update();
      instance.renderer.render(instance.scene, instance.camera);
      instance.frameHandle = requestAnimationFrame(renderFrame);
    };

    let instance!: ViewerInstance;
    const resizeObserver = new ResizeObserver(() => {
      this.resizeInstance(instance);
    });

    instance = {
      host,
      renderer,
      scene,
      camera,
      controls,
      resizeObserver,
      frameHandle: requestAnimationFrame(renderFrame),
      object: null,
      grid,
      currentAssetUrl: null,
      homePosition: camera.position.clone(),
      homeTarget: controls.target.clone(),
    };

    resizeObserver.observe(host);
    this.resizeInstance(instance);

    return instance;
  }

  private reattachInstanceHost(instance: ViewerInstance, nextHost: HTMLElement): void {
    if (instance.host === nextHost) return;
    instance.resizeObserver.disconnect();
    nextHost.replaceChildren(instance.renderer.domElement);
    instance.host = nextHost;
    instance.resizeObserver.observe(nextHost);
    this.resizeInstance(instance);
  }

  private resizeInstance(instance: ViewerInstance): void {
    const width = Math.max(1, instance.host.clientWidth);
    const height = Math.max(1, instance.host.clientHeight);
    instance.camera.aspect = width / height;
    instance.camera.updateProjectionMatrix();
    instance.renderer.setSize(width, height, false);
  }

  private updateInstance(instance: ViewerInstance, block: AgentViewer3DBlock): void {
    const interaction = block.interaction ?? {};
    instance.controls.enableRotate = interaction.rotate !== false;
    instance.controls.enableZoom = interaction.zoom !== false;
    instance.controls.enablePan = interaction.pan === true;

    if (block.status !== 'ready' || !block.assetUrl || (block.format !== 'glb' && block.format !== 'gltf')) {
      this.clearLoadedObject(instance);
      if (instance.grid) {
        instance.grid.visible = false;
      }
      instance.currentAssetUrl = null;
      return;
    }

    if (instance.currentAssetUrl === block.assetUrl) {
      return;
    }

    instance.currentAssetUrl = block.assetUrl;
    if (instance.grid) {
      instance.grid.visible = false;
    }

    this.loader.load(
      block.assetUrl,
      (gltf) => {
        if (instance.currentAssetUrl !== block.assetUrl) return;
        this.clearLoadedObject(instance);
        const object = gltf.scene;
        instance.scene.add(object);
        instance.object = object;
        if (instance.grid) {
          instance.grid.visible = true;
        }
        const home = fitCameraToObject(instance.camera, instance.controls, object);
        instance.camera.position.copy(home.position);
        instance.controls.target.copy(home.target);
        instance.controls.update();
        instance.homePosition.copy(home.position);
        instance.homeTarget.copy(home.target);
        instance.controls.saveState();
      },
      undefined,
      () => {
        if (instance.currentAssetUrl !== block.assetUrl) return;
        this.clearLoadedObject(instance);
        if (instance.grid) {
          instance.grid.visible = false;
        }
      }
    );
  }

  private clearLoadedObject(instance: ViewerInstance): void {
    if (!instance.object) return;
    instance.scene.remove(instance.object);
    instance.object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose?.();
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose?.());
        } else {
          child.material?.dispose?.();
        }
      }
    });
    instance.object = null;
  }

  private disposeInstance(id: string, instance: ViewerInstance): void {
    cancelAnimationFrame(instance.frameHandle);
    instance.resizeObserver.disconnect();
    this.clearLoadedObject(instance);
    if (instance.grid) {
      instance.scene.remove(instance.grid);
    }
    instance.controls.dispose();
    instance.renderer.dispose();
    instance.host.replaceChildren();
    this.instances.delete(id);
  }
}
