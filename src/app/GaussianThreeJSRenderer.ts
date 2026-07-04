import * as THREE from "three/webgpu";
import {GaussianModel} from "./GaussianModel.ts";
import {PerspectiveCamera} from "../camera";
import {GaussianRenderer} from "../renderer";
import {PointCloud, DynamicPointCloud} from "../point_cloud";
import { CameraAdapter } from "../camera/CameraAdapter";
import { FBXModelWrapper } from "../models/fbx-model-wrapper";
import { readTextureR32Float, readTextureR32FloatPixel } from "../utils/gpu";

type ScenePreviewMode = "color" | "normal" | "depth";
type RawDepthSource = "mesh" | "gaussian" | "combined";
const EDITOR_DEPTH_BASE_EXTENT_KEY = "__editorDepthBaseExtent";

type RawDepthFrameDebug = {
    source: RawDepthSource;
    width: number;
    height: number;
    minDepth: number | null;
    maxDepth: number | null;
    data: Float32Array;
};

type SceneDepthPickResult = {
    pixelX: number;
    pixelY: number;
    source: RawDepthSource | null;
    meshDepth: number | null;
    gaussianDepth: number | null;
    depth: number | null;
    world: { x: number; y: number; z: number } | null;
};

/**
 * Fused Three.js + Gaussian renderer used by the editor.
 *
 * The per-frame render flow is intentionally split into three stages:
 *
 * 1. `onBeforeRender(...)`
 *    Updates visible gaussian models, uploads preprocess inputs, and runs the
 *    gaussian preprocess/sort stage through `GaussianRenderer.prepareMulti(...)`.
 *    At this point, gaussian raw view-space depth already exists logically as
 *    per-splat data (`z_view`), but it is not yet persisted per pixel.
 *
 * 2. `renderThreeScene(...)`
 *    Renders the regular Three.js scene into an offscreen render target.
 *    This captures mesh color plus mesh depth (`D1`). The mesh depth texture is then
 *    converted into a mesh raw-depth texture (`sceneRawDepthTexture`), which is the
 *    earliest point where mesh raw depth can be sampled/read back.
 *    If preview mode is `depth`, this stage also blits a mesh depth visualization to canvas.
 *
 * 3. `drawSplats(...)`
 *    Draws gaussian splats over the Three.js result, optionally using the mesh depth
 *    attachment for visibility testing. When raw depth output is enabled, the gaussian
 *    fragment pass writes visible gaussian raw depth into `gaussianRawDepthTexture`.
 *    This is the earliest point where gaussian per-pixel raw depth can be sampled/read back.
 *
 * Preview modes:
 * - `color`: Three color + gaussian color to screen; raw depth still available offscreen
 * - `normal`: Three color + gaussian normal visualization to screen; raw depth still available offscreen
 * - `depth`: screen shows depth visualization, but raw depth remains available via the
 *   offscreen raw-depth textures rather than the displayed grayscale image
 *
 * Raw depth access summary:
 * - mesh raw depth: after `renderThreeScene(...)`
 * - gaussian raw depth: after `drawSplats(...)`
 * - combined scene raw depth for picking: by reading both raw-depth textures and resolving
 *   visibility in `pickScenePoint(...)` / `getRawDepthFrame(...)`
 */
export class GaussianThreeJSRenderer extends THREE.Mesh {
    private renderer: GaussianRenderer;
    private gaussianModels: GaussianModel[];
    private pcs: (PointCloud | DynamicPointCloud)[] | null = null;
    
    // Three.js integration
    private threeRenderer: THREE.WebGPURenderer;
    private threeScene: THREE.Scene;
    private device: GPUDevice;
    private canvasFormat: GPUTextureFormat;
    
    // Depth capture from full scene (new architecture)
    private sceneDepthRT: THREE.RenderTarget | null = null;  // Three.js scene renders here for depth
    private sceneDepthTexture: THREE.DepthTexture | null = null;
    private autoDepthMode: boolean = true; // Auto capture depth from full scene
    private sceneDepthRangeScale: number = 1.0;
    private scenePreviewMode: ScenePreviewMode = "color";
    private unifiedSceneExtent: number = 1.0;
    
    // Legacy occluder support (kept for compatibility)
    private occluderMeshes: THREE.Mesh[] = [];
    private occluderScene: THREE.Scene = new THREE.Scene();

    // Gizmo overlay support
    private gizmoOverlayRT: THREE.RenderTarget | null = null;
    private overlaySampler: GPUSampler | null = null;
    private overlayBindGroupLayout: GPUBindGroupLayout | null = null;
    private overlayPipeline: GPURenderPipeline | null = null;
    private overlayRenderedThisFrame = false;

    // Raw depth buffers for picking/debug.
    // `sceneRawDepthTexture`: mesh/Three raw view-space depth after renderThreeScene().
    // `gaussianRawDepthTexture`: gaussian raw view-space depth after drawSplats().
    private sceneRawDepthTexture: GPUTexture | null = null;
    private gaussianRawDepthTexture: GPUTexture | null = null;
    private rawDepthWidth = 0;
    private rawDepthHeight = 0;
    private rawSceneDepthPipeline: GPURenderPipeline | null = null;
    private rawSceneDepthBindGroupLayout: GPUBindGroupLayout | null = null;

    public constructor(renderer: THREE.WebGPURenderer, scene: THREE.Scene, gaussianModels: GaussianModel[]) {
        super();

        // Important: ensure this helper mesh is never frustum-culled by Three.js.
        // If it's culled (common because it has no geometry bounds), onBeforeRender
        // won't fire when the camera is very close, making GS appear "frozen".
        this.frustumCulled = false;

        this.threeRenderer = renderer;
        this.threeScene = scene;
        this.device = (renderer.backend as any).device as GPUDevice;
        const format = navigator.gpu.getPreferredCanvasFormat();
        this.renderer = new GaussianRenderer(this.device, format, 3);
        this.gaussianModels = gaussianModels;
        this.canvasFormat = format;
    }

    public onResize(width: number, height: number, _forceUpdate?: boolean): void {
        return; // editor在window.resize时调用会有深度问题，猜测在其他地方有冲突，暂时关闭,需要优化 by helen 2025-11-28
    }
    
    /**
     * Render Three.js scene internally to capture depth
     * This replaces the manual renderer.render(scene, camera) in demo
     */
    public renderThreeScene(camera: THREE.Camera): void {
        if (!this.autoDepthMode) return;
        
        // Get actual drawing buffer size (matches GPU context)
        const dbSize = new THREE.Vector2();
        (this.threeRenderer as any).getDrawingBufferSize?.(dbSize);
        const width = dbSize.x || this.threeRenderer.domElement.width || 1;
        const height = dbSize.y || this.threeRenderer.domElement.height || 1;
        this.ensureRawDepthTextures(width, height);
        
        // Ensure scene depth RT is created with correct size
        if (!this.sceneDepthRT || this.sceneDepthRT.width !== width || this.sceneDepthRT.height !== height) {
            // Dispose old RT if exists
            if (this.sceneDepthRT) {
                this.sceneDepthRT.dispose();
            }
            
            // 关键修复：使用HalfFloatType（16位浮点）平衡精度和性能
            // FloatType（32位）不支持可过滤采样（UnfilterableFloat），会导致WebGPU验证错误
            // HalfFloatType（16位）支持过滤，精度通常足够，且性能更好
            // 使用LinearSRGBColorSpace，让Three.js保持线性空间，避免环境贴图被错误转换
            this.sceneDepthRT = new THREE.RenderTarget(width, height, {
                format: THREE.RGBAFormat,
                type: THREE.HalfFloatType, // 16位浮点，支持可过滤采样，精度通常足够
                samples: 1,
                depthBuffer: true,
            });
            // 使用LinearSRGBColorSpace，Three.js不会进行颜色空间转换
            // RT中存储的是线性值，环境贴图（HDR，线性空间）不会被错误转换
            // 在blit时再进行线性到sRGB的转换
            this.sceneDepthRT.texture.colorSpace = THREE.LinearSRGBColorSpace;
            this.sceneDepthTexture = new THREE.DepthTexture(width, height, THREE.FloatType);
            this.sceneDepthRT.depthTexture = this.sceneDepthTexture;
            
            if ((globalThis as any).GS_DEPTH_DEBUG) {
                //console.log(`[Depth] Created scene depth RT: ${width}x${height} (drawing buffer size)`);
            }
        }
        
        // Single render pass: Scene → RT (captures both color and depth)
        this.threeRenderer.setRenderTarget(this.sceneDepthRT);
        this.threeRenderer.clear(true, true, false);
        this.threeRenderer.render(this.threeScene, camera);
        this.threeRenderer.setRenderTarget(null);
        this.updateSceneRawDepthTexture(camera);
        
        if ((globalThis as any).GS_DEPTH_DEBUG) {
            //console.log('[Depth] Rendered Three scene to RT (color + depth captured)');
        }
        
        if (this.scenePreviewMode === "depth") {
            this.blitDepthTextureToCanvas(camera);
        } else {
            // Blit RT color to canvas (no need to re-render scene)
            this.blitRenderTargetToCanvas(camera);
        }
    }

    /**
     * Blit RenderTarget color buffer to canvas using render pass
     * Uses a fullscreen quad shader to handle format conversion
     */
    private blitRenderTargetToCanvas(camera: THREE.Camera): void {
        if (!this.sceneDepthRT) return;

        try {
            // Get the GPU device
            const device = (this.threeRenderer as any).backend?.device as GPUDevice;
            if (!device) {
                console.warn('[Depth] No GPU device available for blit');
                this.threeRenderer.render(this.threeScene, camera);
                return;
            }

            // Get canvas context
            const canvas = this.threeRenderer.domElement;
            const context = canvas.getContext('webgpu');
            if (!context) {
                console.warn('[Depth] No WebGPU context available for blit');
                this.threeRenderer.render(this.threeScene, camera);
                return;
            }

            // Get current texture view (canvas)
            const currentTexture = context.getCurrentTexture();
            const canvasView = currentTexture.createView();

            // Get RT color texture
            const backend = (this.threeRenderer as any).backend;
            const rtColorInfo = backend?.get?.(this.sceneDepthRT.texture);
            const rtColorTexture = rtColorInfo?.texture as GPUTexture;
            
            if (!rtColorTexture) {
                console.warn('[Depth] Could not access RT color texture for blit');
                this.threeRenderer.render(this.threeScene, camera);
                return;
            }

            // Check format compatibility
            const rtFormat = rtColorInfo?.format;
            const canvasFormat = currentTexture.format;
            
            if ((globalThis as any).GS_DEPTH_DEBUG) {
                //console.log('[Depth] RT format:', rtFormat, 'Canvas format:', canvasFormat);
            }

            // Use render pass for format conversion (more reliable than copy)
            this.blitWithRenderPass(device, rtColorTexture, canvasView, this.sceneDepthRT.width, this.sceneDepthRT.height);

            if ((globalThis as any).GS_DEPTH_DEBUG) {
                //console.log('[Depth] ✅ Blitted RT to canvas via render pass (format conversion)');
            }

        } catch (error) {
            console.warn('[Depth] Blit with render pass failed, falling back to re-render:', error);
            // Fallback: re-render scene to canvas
            this.threeRenderer.render(this.threeScene, camera);
        }
    }

    private blitDepthTextureToCanvas(camera: THREE.Camera): void {
        if (!this.sceneDepthRT || !this.sceneDepthTexture) return;

        try {
            const device = (this.threeRenderer as any).backend?.device as GPUDevice;
            if (!device) {
                this.threeRenderer.render(this.threeScene, camera);
                return;
            }

            const canvas = this.threeRenderer.domElement;
            const context = canvas.getContext('webgpu');
            if (!context) {
                this.threeRenderer.render(this.threeScene, camera);
                return;
            }

            const currentTexture = context.getCurrentTexture();
            const canvasView = currentTexture.createView();

            const backend = (this.threeRenderer as any).backend;
            const depthInfo = backend?.get?.(this.sceneDepthTexture);
            const depthTexture = depthInfo?.texture as GPUTexture;
            const colorInfo = backend?.get?.(this.sceneDepthRT.texture);
            const colorTexture = colorInfo?.texture as GPUTexture;
            if (!depthTexture || !colorTexture) {
                this.blitRenderTargetToCanvas(camera);
                return;
            }

            const near = Math.max(0.0001, (camera as any).near ?? 0.01);
            const far = Math.max(near + 0.0001, (camera as any).far ?? 1000.0);
            // Match Gaussian depth visualization mapping:
            // scene_extend = sceneSize * scale; vis_far = min(zfar, znear + scene_extend * 3.0)
            const sceneExtent = this.computeDepthExtentForPreview(camera);
            const sceneExtend = Math.max(0.001, sceneExtent * this.sceneDepthRangeScale);
            const localFar = near + Math.max(0.001, sceneExtend * 3.0);
            const visFar = Math.min(far, localFar);
            this.blitDepthWithRenderPass(device, depthTexture, colorTexture, canvasView, near, far, visFar);
        } catch (_error) {
            this.threeRenderer.render(this.threeScene, camera);
        }
    }

    /**
     * Allocates the persistent raw-depth textures used by picking/debug.
     * These textures are not shown directly on screen:
     * - sceneRawDepthTexture receives mesh raw depth after renderThreeScene()
     * - gaussianRawDepthTexture receives gaussian raw depth during drawSplats()
     */
    private ensureRawDepthTextures(width: number, height: number): void {
        const w = Math.max(1, Math.floor(width));
        const h = Math.max(1, Math.floor(height));
        if (
            this.sceneRawDepthTexture &&
            this.gaussianRawDepthTexture &&
            this.rawDepthWidth === w &&
            this.rawDepthHeight === h
        ) {
            return;
        }

        this.sceneRawDepthTexture?.destroy();
        this.gaussianRawDepthTexture?.destroy();
        this.sceneRawDepthTexture = this.device.createTexture({
            label: "Scene Raw Depth",
            size: { width: w, height: h, depthOrArrayLayers: 1 },
            format: "r32float",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
        });
        this.gaussianRawDepthTexture = this.device.createTexture({
            label: "Gaussian Raw Depth",
            size: { width: w, height: h, depthOrArrayLayers: 1 },
            format: "r32float",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        });
        this.rawDepthWidth = w;
        this.rawDepthHeight = h;
    }

    private ensureSceneRawDepthPipeline(): void {
        if (this.rawSceneDepthPipeline && this.rawSceneDepthBindGroupLayout) {
            return;
        }

        this.rawSceneDepthBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: "depth", viewDimension: "2d" },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: "uniform" },
                },
            ],
        });

        const shaderModule = this.device.createShaderModule({
            code: `
                struct DepthParams {
                    near: f32,
                    far: f32,
                };

                @group(0) @binding(0) var depthTex: texture_depth_2d;
                @group(0) @binding(1) var<uniform> params: DepthParams;

                fn depthToViewZ(depth: f32, near: f32, far: f32) -> f32 {
                    let denom = min((far - near) * depth - far, -0.000001);
                    return abs((near * far) / denom);
                }

                @vertex
                fn vs_main(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
                    var pos = array<vec2f, 6>(
                        vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
                        vec2f(-1.0, 1.0),  vec2f(1.0, -1.0), vec2f(1.0, 1.0)
                    );
                    return vec4f(pos[i], 0.0, 1.0);
                }

                @fragment
                fn fs_main(@builtin(position) fragCoord: vec4f) -> @location(0) f32 {
                    let xy = vec2<i32>(i32(fragCoord.x), i32(fragCoord.y));
                    let depth = textureLoad(depthTex, xy, 0);
                    if (depth >= 0.999999) {
                        return -1.0;
                    }
                    return depthToViewZ(depth, params.near, params.far);
                }
            `,
        });

        this.rawSceneDepthPipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.rawSceneDepthBindGroupLayout] }),
            vertex: {
                module: shaderModule,
                entryPoint: "vs_main",
            },
            fragment: {
                module: shaderModule,
                entryPoint: "fs_main",
                targets: [{ format: "r32float" }],
            },
            primitive: { topology: "triangle-list" },
        });
    }

    private updateSceneRawDepthTexture(camera: THREE.Camera): void {
        if (!this.sceneDepthTexture || !this.sceneRawDepthTexture) return;

        const backend = (this.threeRenderer as any).backend;
        const depthInfo = backend?.get?.(this.sceneDepthTexture);
        const depthTexture = depthInfo?.texture as GPUTexture | undefined;
        if (!depthTexture) return;

        this.ensureSceneRawDepthPipeline();
        if (!this.rawSceneDepthPipeline || !this.rawSceneDepthBindGroupLayout) return;

        const near = Math.max(0.0001, (camera as any).near ?? 0.01);
        const far = Math.max(near + 0.0001, (camera as any).far ?? 1000.0);
        const paramsBuffer = this.device.createBuffer({
            size: 8,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(paramsBuffer, 0, new Float32Array([near, far]));

        const bindGroup = this.device.createBindGroup({
            layout: this.rawSceneDepthBindGroupLayout,
            entries: [
                { binding: 0, resource: depthTexture.createView() },
                { binding: 1, resource: { buffer: paramsBuffer } },
            ],
        });

        const encoder = this.device.createCommandEncoder({ label: "Scene Raw Depth" });
        const pass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: this.sceneRawDepthTexture.createView(),
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: { r: -1, g: 0, b: 0, a: 0 },
                },
            ],
        });
        pass.setPipeline(this.rawSceneDepthPipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(6, 1, 0, 0);
        pass.end();
        this.device.queue.submit([encoder.finish()]);
        paramsBuffer.destroy();
    }

    private computeGaussianSceneExtent(visibleGaussianModels?: GaussianModel[]): number {
        let maxExtent = 0;
        const gaussians = visibleGaussianModels ?? this.gaussianModels;
        for (const gm of gaussians) {
            const aabb = (gm as any).getLocalAABB?.() ?? gm.getWorldAABB();
            if (!aabb) continue;
            const min = (aabb as any).min as [number, number, number];
            const max = (aabb as any).max as [number, number, number];
            if (!min || !max) continue;
            if (!Number.isFinite(min[0]) || !Number.isFinite(max[0])) continue;
            const extent = Math.max(
                Math.abs(max[0] - min[0]),
                Math.abs(max[1] - min[1]),
                Math.abs(max[2] - min[2]),
            );
            if (Number.isFinite(extent) && extent > maxExtent) maxExtent = extent;
        }
        return maxExtent > 0 ? Math.max(0.001, maxExtent) : 0;
    }

    private computeMeshSceneExtent(): number {
        let maxExtent = 0;
        this.threeScene.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (!mesh || !(mesh as any).isMesh || !mesh.visible) return;
            if (mesh === this) return;
            const cachedExtent = Number((mesh.userData as any)?.[EDITOR_DEPTH_BASE_EXTENT_KEY]);
            if (Number.isFinite(cachedExtent) && cachedExtent > 0) {
                if (cachedExtent > maxExtent) maxExtent = cachedExtent;
                return;
            }
            const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
            const position = geometry?.attributes?.position;
            if (!geometry || !position || position.count <= 0) return;
            if (!geometry.boundingBox) geometry.computeBoundingBox();
            if (!geometry.boundingBox) return;
            const size = geometry.boundingBox.getSize(new THREE.Vector3());
            const extent = Math.max(size.x, size.y, size.z);
            if (Number.isFinite(extent) && extent > maxExtent) {
                maxExtent = extent;
            }
        });
        return maxExtent > 0 ? Math.max(0.001, maxExtent) : 1.0;
    }

    private computeReferenceSceneExtent(camera?: THREE.Camera, visibleGaussianModels?: GaussianModel[]): number {
        const visibleGaussians = visibleGaussianModels
            ?? (camera ? this.gaussianModels.filter((model) => model.isVisible(camera)) : this.gaussianModels);
        const gaussianExtent = this.computeGaussianSceneExtent(visibleGaussians);
        const meshExtent = this.computeMeshSceneExtent();
        const reference = Math.max(gaussianExtent, meshExtent, 1.0);
        this.unifiedSceneExtent = reference;
        return reference;
    }

    private computeDepthExtentForPreview(camera?: THREE.Camera): number {
        return this.computeReferenceSceneExtent(camera);
    }

    private blitDepthWithRenderPass(
        device: GPUDevice,
        sourceDepthTexture: GPUTexture,
        sourceColorTexture: GPUTexture,
        targetView: GPUTextureView,
        near: number,
        far: number,
        visFar: number
    ): void {
        const paramsBuffer = device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(paramsBuffer, 0, new Float32Array([near, far, visFar, 0]));

        const bindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: "depth", viewDimension: "2d" },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: "float", viewDimension: "2d" },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: "uniform" },
                },
            ],
        });

        const bindGroup = device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: sourceDepthTexture.createView(),
                },
                {
                    binding: 1,
                    resource: sourceColorTexture.createView(),
                },
                {
                    binding: 2,
                    resource: { buffer: paramsBuffer },
                },
            ],
        });

        const pipeline = device.createRenderPipeline({
            layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
            vertex: {
                module: device.createShaderModule({
                    code: `
                        @vertex
                        fn vs_main(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
                            var pos = array<vec2f, 6>(
                                vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
                                vec2f(-1.0, 1.0),  vec2f(1.0, -1.0), vec2f(1.0, 1.0)
                            );
                            return vec4f(pos[i], 0.0, 1.0);
                        }
                    `,
                }),
                entryPoint: "vs_main",
            },
            fragment: {
                module: device.createShaderModule({
                    code: `
                        struct DepthParams {
                            near: f32,
                            far: f32,
                            visFar: f32,
                            pad: f32,
                        };
                        @group(0) @binding(0) var depthTex: texture_depth_2d;
                        @group(0) @binding(1) var colorTex: texture_2d<f32>;
                        @group(0) @binding(2) var<uniform> params: DepthParams;

                        fn depthToViewZ(depth: f32, near: f32, far: f32) -> f32 {
                            // Perspective denominator is negative in-range; clamp away from 0 without flipping sign.
                            let denom = min((far - near) * depth - far, -0.000001);
                            return abs((near * far) / denom);
                        }

                        fn linearToSRGB(linear: vec3<f32>) -> vec3<f32> {
                            return select(
                                linear * 12.92,
                                pow(max(linear, vec3<f32>(0.0)), vec3<f32>(1.0 / 2.4)) * 1.055 - 0.055,
                                linear > vec3<f32>(0.0031308)
                            );
                        }

                        @fragment
                        fn fs_main(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
                            let xy = vec2<i32>(i32(fragCoord.x), i32(fragCoord.y));
                            let depth = textureLoad(depthTex, xy, 0);
                            // Preserve the current scene background for non-geometry pixels.
                            if (depth >= 0.999999) {
                                let bgLinear = textureLoad(colorTex, xy, 0).rgb;
                                return vec4f(linearToSRGB(bgLinear), 1.0);
                            }
                            let viewZ = depthToViewZ(depth, params.near, params.far);
                            let depthLinear = clamp((viewZ - params.near) / max(params.visFar - params.near, 0.000001), 0.0, 1.0);
                            let depthVis = pow(1.0 - depthLinear, 0.9);
                            return vec4f(vec3f(depthVis), 1.0);
                        }
                    `,
                }),
                entryPoint: "fs_main",
                targets: [{ format: "bgra8unorm" }],
            },
            primitive: { topology: "triangle-list" },
        });

        const encoder = device.createCommandEncoder({ label: "Depth-to-Canvas render pass" });
        const pass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: targetView,
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                },
            ],
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(6, 1, 0, 0);
        pass.end();
        device.queue.submit([encoder.finish()]);

        paramsBuffer.destroy();
    }

    /**
     * Blit using render pass with fullscreen quad shader
     * This handles format conversion reliably
     */
    private blitWithRenderPass(device: GPUDevice, sourceTexture: GPUTexture, targetView: GPUTextureView, width: number, height: number): void {
        // 关键修复：改进采样器配置，使用更好的过滤方式以保持高光细节
        // 对于高动态范围内容（如环境贴图反射），使用linear过滤保持细节
        const sampler = device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            mipmapFilter: 'linear', // 如果纹理有mipmap，使用线性过滤
            // 不使用anisotropic filtering，因为这是全屏blit，不需要
        });

        // Create bind group layout
        const bindGroupLayout = device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                texture: { viewDimension: '2d' }
            }, {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {}
            }]
        });

        // Create bind group
        // 使用FloatType（32位浮点）格式的纹理视图，WebGPU会自动处理高精度采样
        // FloatType提供足够精度保持高动态范围内容（如环境贴图反射）的细节
        const bindGroup = device.createBindGroup({
            layout: bindGroupLayout,
            entries: [{
                binding: 0,
                resource: sourceTexture.createView() // FloatType格式，提供高精度
            }, {
                binding: 1,
                resource: sampler
            }]
        });

        // Create render pipeline
        const pipeline = device.createRenderPipeline({
            layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
            vertex: {
                module: device.createShaderModule({
                    code: `
                        @vertex
                        fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
                            var pos = array<vec2f, 6>(
                                vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
                                vec2f(-1.0, 1.0),  vec2f(1.0, -1.0), vec2f(1.0, 1.0)
                            );
                            return vec4f(pos[vertexIndex], 0.0, 1.0);
                        }
                    `
                }),
                entryPoint: 'vs_main'
            },
            fragment: {
                module: device.createShaderModule({
                    code: `
                        @group(0) @binding(0) var sourceTexture: texture_2d<f32>;
                        @group(0) @binding(1) var sourceSampler: sampler;

                        // 线性空间到sRGB空间的转换函数（标准sRGB gamma校正）
                        fn linearToSRGB(linear: vec3<f32>) -> vec3<f32> {
                            return select(
                                linear * 12.92,
                                pow(max(linear, vec3<f32>(0.0)), vec3<f32>(1.0 / 2.4)) * 1.055 - 0.055,
                                linear > vec3<f32>(0.0031308)
                            );
                        }

                        @fragment
                        fn fs_main(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
                            let texCoord = fragCoord.xy / vec2f(${width}.0, ${height}.0);
                            // RT使用HalfFloatType（16位浮点），存储的是线性空间的值
                            // HalfFloatType支持可过滤采样，精度通常足够保持高动态范围内容
                            let linearColor = textureSample(sourceTexture, sourceSampler, texCoord);
                            
                            // 关键修复：将线性空间的值转换为sRGB空间输出到canvas
                            // 使用HalfFloatType（16位浮点）支持WebGPU的过滤采样，避免验证错误
                            // 在输出时进行线性到sRGB的转换，确保颜色正确显示
                            let srgbColor = linearToSRGB(linearColor.rgb);
                            
                            return vec4<f32>(srgbColor, linearColor.a);
                        }
                    `
                }),
                entryPoint: 'fs_main',
                targets: [{
                    format: this.canvasFormat // Canvas format (sRGB显示)
                }]
            },
            primitive: {
                topology: 'triangle-list'
            }
        });

        // Create command encoder and render pass
        const encoder = device.createCommandEncoder({ label: 'RT-to-Canvas render pass' });
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: targetView,
                loadOp: 'clear',
                storeOp: 'store',
                clearValue: { r: 0, g: 0, b: 0, a: 1 }
            }]
        });

        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(6, 1, 0, 0);
        pass.end();

        device.queue.submit([encoder.finish()]);
    }

    public onBeforeRender(renderer: any, scene: THREE.Scene, camera: THREE.Camera, _geometry?: any, _material?: any, _group?: any) {
        // 检查相机类型，兼容不同的Three.js导入方式
        if (!(camera instanceof THREE.PerspectiveCamera) && camera.type !== 'PerspectiveCamera') {
            console.log("Only THREE.PerspectiveCamera is supported!", camera);
            return;
        }


        
        const cam = this.convertCamera(camera as any, renderer as any);
        const visibleModels = this.gaussianModels.filter(model => model.isVisible(camera));
        // 只过滤高斯模型（PointCloud/DynamicPointCloud），FBX模型不参与高斯渲染
        // 注意：使用鸭子类型检查而不是instanceof，因为构建后的类名会被minify
        this.pcs = visibleModels.map(m => m.getPointCloud()).filter(
            (pc): pc is PointCloud | DynamicPointCloud => {
                // 检查是否有PointCloud的特征方法/属性
                return pc && typeof pc === 'object' && 
                       ('numPoints' in pc || 'countBuffer' in pc) && 
                       !('skeletalAnimation' in pc || 'fbxMesh' in pc); // 排除FBX模型
            }
        );
        if (!this.pcs || this.pcs.length === 0) {
            if ((globalThis as any).GS_VIDEO_EXPORT_DEBUG) {
                console.warn('[GaussianThreeJSRenderer] onBeforeRender: 没有可见的高斯点云');
                console.log('[GaussianThreeJSRenderer] - gaussianModels数量:', this.gaussianModels.length);
                console.log('[GaussianThreeJSRenderer] - visibleModels数量:', visibleModels.length);
                visibleModels.forEach((model, index) => {
                    const pc = model.getPointCloud();
                    console.log(`[GaussianThreeJSRenderer] - 模型${index} getPointCloud返回类型:`, 
                        pc.constructor.name, 
                        'is PointCloud:', pc instanceof PointCloud,
                        'is DynamicPointCloud:', pc instanceof DynamicPointCloud,
                        'is FBXModelWrapper:', pc instanceof FBXModelWrapper
                    );
                });
            }
            return;
        }

        // 同步每个可见模型的变换矩阵到GPU
        visibleModels.forEach((model, index) => {
            model.syncTransformToGPU();
            if ((globalThis as any).GS_DEBUG_FLAG) {
                //console.log(`[GaussianThreeJSRenderer] Synced transform for model ${index}: ${model.name}`);
            }
        });

        const device = (renderer.backend as any).device as GPUDevice;
        const encoder = device.createCommandEncoder({label: "frame"});
        // Use drawing buffer size for viewport in pixels
        const db = new THREE.Vector2();
        (renderer as any).getDrawingBufferSize?.(db);
        const vw = db.x || (renderer.getSize(new THREE.Vector2()).x);
        const vh = db.y || (renderer.getSize(new THREE.Vector2()).y);
        // 单次调用，利用全局批处理优化
        // 每个模型的 gaussianScaling 参数现在存储在各自的 ModelParams 中
        const referenceExtent = this.computeReferenceSceneExtent(camera, visibleModels);
        const unifiedSceneExtend = Math.max(0.001, referenceExtent * this.sceneDepthRangeScale);
        this.renderer.prepareMulti(encoder, device.queue, this.pcs, {
            camera: cam,
            viewport: [vw, vh],
            // Use one shared sceneExtend reference for Gaussian and mesh depth preview.
            sceneExtend: unifiedSceneExtend,
        } as any);
        device.queue.submit([encoder.finish()]);

        // Note: In auto depth mode, scene rendering is done via renderThreeScene()
        if (this.autoDepthMode && (globalThis as any).GS_DEPTH_DEBUG) {
            //console.log('[Depth] Pass A: Skipped (auto depth mode - depth captured in renderThreeScene)');
        }
    }

    public drawSplats(renderer: any, scene: THREE.Scene, camera: THREE.Camera, _geometry?: any, _material?: any, _group?: any) {
        if (this.pcs == null || this.pcs.length === 0) {
            if ((globalThis as any).GS_VIDEO_EXPORT_DEBUG) {
                console.warn('[GaussianThreeJSRenderer] drawSplats: pcs为空或长度为0');
            }
            const [viewportWidth, viewportHeight] = this.getViewport();
            this.ensureRawDepthTextures(viewportWidth, viewportHeight);
            this.clearGaussianRawDepthTexture();
            return false;
        }
        
        // 确保相机是PerspectiveCamera类型
        if (!(camera instanceof THREE.PerspectiveCamera) && camera.type !== 'PerspectiveCamera') {
            console.warn("drawSplats: Only THREE.PerspectiveCamera is supported!", camera);
            return false;
        }

        const device = (renderer.backend as any).device as GPUDevice;
        const context = (renderer.backend as any).context as GPUCanvasContext;
        const [viewportWidth, viewportHeight] = this.getViewport();
        this.ensureRawDepthTextures(viewportWidth, viewportHeight);
        const colorView = context.getCurrentTexture().createView();
        const encoder = device.createCommandEncoder({label: "GS-render"});
        
        // Pass B: Try to get depth view from Three.js RenderTarget
        let depthView: GPUTextureView | undefined;
        
        // Use scene depth texture from renderThreeScene
        if (this.sceneDepthTexture) {
            // Get viewport size
            const db = new THREE.Vector2();
            (renderer as any).getDrawingBufferSize?.(db);
            const vw = db.x || (renderer.getSize(new THREE.Vector2()).x);
            const vh = db.y || (renderer.getSize(new THREE.Vector2()).y);
            
            if ((globalThis as any).GS_DEPTH_DEBUG) {
                //console.log('[Depth] Pass B: Attempting to get depth view');
                //console.log('[Depth] - Mode: auto (full scene)');
                //console.log('[Depth] - Viewport size:', vw, 'x', vh);
                //console.log('[Depth] - Scene depth RT size:', this.sceneDepthRT?.width, 'x', this.sceneDepthRT?.height);
                //console.log('[Depth] - Scene depth texture exists:', !!this.sceneDepthTexture);
            }
            
            try {
                // Try to access via renderer.backend
                const backend = (this.threeRenderer as any).backend;
                const backendInfo = backend?.get?.(this.sceneDepthTexture);
                
                if ((globalThis as any).GS_DEPTH_DEBUG) {
                    //console.log('[Depth] - Backend info:', backendInfo);
                }
                
                const depthGpuTexture = backendInfo?.texture as GPUTexture;
                const threeDepthFormat = backendInfo?.format as GPUTextureFormat;
                
                if (depthGpuTexture && threeDepthFormat) {
                    // Set GaussianRenderer to use the same depth format as Three.js
                    this.renderer.setDepthFormat(threeDepthFormat);
                    
                    depthView = depthGpuTexture.createView();
                    
                    if ((globalThis as any).GS_DEPTH_DEBUG) {
                        //console.log('[Depth] ✅ Pass B: Successfully got depth view from Three.js RT');
                        //console.log('[Depth] - Depth Format:', threeDepthFormat);
                        //console.log('[Depth] - Source: Full scene (auto depth mode)');
                    }
                } else {
                    if ((globalThis as any).GS_DEPTH_DEBUG) {
                        console.warn('[Depth] ⚠️ Could not access depth GPU texture from Three.js backend');
                    }
                }
                
                // Enable depth testing when we have depth texture
                if (depthView) {
                    this.renderer.setDepthEnabled(true);
                    
                    if ((globalThis as any).GS_DEPTH_DEBUG) {
                        //console.log('[Depth] - Depth testing enabled');
                    }
                }
                
            } catch (e) {
                if ((globalThis as any).GS_DEPTH_DEBUG) {
                    console.error('[Depth] ❌ Error accessing depth texture:', e);
                }
            }
        } else {
            // No depth source, disable depth testing
            this.renderer.setDepthEnabled(false);
            if ((globalThis as any).GS_DEPTH_DEBUG) {
                //console.log('[Depth] Pass B: No depth source, depth testing disabled');
            }
        }

        // Build render pass descriptor
        const passDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view: colorView,
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                    loadOp: "load",
                    storeOp: "store",
                },
                {
                    // Attachment 1 stores gaussian raw view-space depth.
                    // This is available for all preview modes; only the visible screen output changes.
                    view: this.gaussianRawDepthTexture!.createView(),
                    clearValue: { r: -1, g: 0, b: 0, a: 0 },
                    loadOp: "clear",
                    storeOp: "store",
                },
            ]
        };

        // Add depth attachment if available
        if (depthView) {
            (passDescriptor as any).depthStencilAttachment = {
                view: depthView,
                depthLoadOp: 'load', // Always load depth from RT
                depthStoreOp: 'store',
                depthClearValue: 1.0,
            };
            
            if ((globalThis as any).GS_DEPTH_DEBUG) {
                //console.log('[Depth] ✅ Depth attachment added to render pass');
                //console.log('[Depth] - depthLoadOp: load');
                //console.log('[Depth] - depthStoreOp: store');
            }
        } else {
            if ((globalThis as any).GS_DEPTH_DEBUG) {
                console.warn('[Depth] ⚠️ No depth view available - render pass has no depth attachment');
            }
        }

        const pass = encoder.beginRenderPass(passDescriptor);
        this.renderer.renderMulti(pass, this.pcs);
        pass.end();
        this.compositeOverlayToCanvas(device, encoder, colorView);
        device.queue.submit([encoder.finish()]);

        return true;
    }

    private clearGaussianRawDepthTexture(): void {
        if (!this.gaussianRawDepthTexture) return;
        const encoder = this.device.createCommandEncoder({ label: "Gaussian Raw Depth Clear" });
        const pass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: this.gaussianRawDepthTexture.createView(),
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: { r: -1, g: 0, b: 0, a: 0 },
                },
            ],
        });
        pass.end();
        this.device.queue.submit([encoder.finish()]);
    }

    public renderOverlayScene(scene: THREE.Scene, camera: THREE.Camera): void {
        const [width, height] = this.getViewport();
        this.ensureGizmoOverlayRenderTarget(width, height);
        if (!this.gizmoOverlayRT) return;

        const prevRenderTarget = this.threeRenderer.getRenderTarget();
        const prevClearColor = new THREE.Color();
        (this.threeRenderer as any).getClearColor?.(prevClearColor);
        const prevClearAlpha = (this.threeRenderer as any).getClearAlpha?.() ?? 1;
        const prevAutoClear = (this.threeRenderer as any).autoClear;

        this.threeRenderer.setRenderTarget(this.gizmoOverlayRT);
        (this.threeRenderer as any).setClearColor?.(new THREE.Color(0x00000000), 0);
        if (typeof prevAutoClear === "boolean") {
            (this.threeRenderer as any).autoClear = false;
        }
        try {
            if (!this.overlayRenderedThisFrame) {
                this.threeRenderer.clear(true, false, false);
            }
            this.threeRenderer.render(scene, camera);
            this.overlayRenderedThisFrame = true;
        } finally {
            if (typeof prevAutoClear === "boolean") {
                (this.threeRenderer as any).autoClear = prevAutoClear;
            }
            (this.threeRenderer as any).setClearColor?.(prevClearColor, prevClearAlpha);
            this.threeRenderer.setRenderTarget(prevRenderTarget);
        }
    }

    private ensureGizmoOverlayRenderTarget(width: number, height: number): void {
        const w = Math.max(1, Math.floor(width));
        const h = Math.max(1, Math.floor(height));

        if (this.gizmoOverlayRT && this.gizmoOverlayRT.width === w && this.gizmoOverlayRT.height === h) {
            return;
        }

        if (this.gizmoOverlayRT) {
            this.gizmoOverlayRT.dispose();
        }
        this.overlayRenderedThisFrame = false;

        const RenderTargetClass =
            (THREE as any).WebGPURenderTarget ??
            (THREE as any).WebGLRenderTarget ??
            THREE.RenderTarget;

        this.gizmoOverlayRT = new RenderTargetClass(w, h, {
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType,
            samples: 1,
            depthBuffer: false,
        });
        if (this.gizmoOverlayRT && this.gizmoOverlayRT.texture) {
            this.gizmoOverlayRT.texture.colorSpace = THREE.LinearSRGBColorSpace;
        }
    }

    private compositeOverlayToCanvas(device: GPUDevice, encoder: GPUCommandEncoder, targetView: GPUTextureView): void {
        if (!this.overlayRenderedThisFrame || !this.gizmoOverlayRT) {
            return;
        }

        const backend = (this.threeRenderer as any).backend;
        const overlayInfo = backend?.get?.(this.gizmoOverlayRT.texture);
        const overlayTexture = overlayInfo?.texture as GPUTexture | undefined;

        if (!overlayTexture) {
            this.overlayRenderedThisFrame = false;
            return;
        }

        if (!this.overlaySampler) {
            this.overlaySampler = device.createSampler({
                magFilter: 'linear',
                minFilter: 'linear',
            });
        }

        if (!this.overlayBindGroupLayout) {
            this.overlayBindGroupLayout = device.createBindGroupLayout({
                entries: [
                    {
                        binding: 0,
                        visibility: GPUShaderStage.FRAGMENT,
                        texture: { viewDimension: '2d' },
                    },
                    {
                        binding: 1,
                        visibility: GPUShaderStage.FRAGMENT,
                        sampler: {},
                    },
                ],
            });
        }

        const bindGroup = device.createBindGroup({
            layout: this.overlayBindGroupLayout,
            entries: [
                { binding: 0, resource: overlayTexture.createView() },
                { binding: 1, resource: this.overlaySampler! },
            ],
        });

        if (!this.overlayPipeline) {
            const shaderModule = device.createShaderModule({
                code: `
                    struct VertexOutput {
                        @builtin(position) position : vec4f,
                        @location(0) uv : vec2f,
                    };

                    @vertex
                    fn vs_main(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
                        var positions = array<vec2f, 6>(
                            vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
                            vec2f(-1.0, 1.0),  vec2f(1.0, -1.0), vec2f(1.0, 1.0)
                        );
                        var uvs = array<vec2f, 6>(
                            vec2f(0.0, 1.0), vec2f(1.0, 1.0), vec2f(0.0, 0.0),
                            vec2f(0.0, 0.0), vec2f(1.0, 1.0), vec2f(1.0, 0.0)
                        );

                        var output : VertexOutput;
                        output.position = vec4f(positions[vertexIndex], 0.0, 1.0);
                        output.uv = uvs[vertexIndex];
                        return output;
                    }

                    @group(0) @binding(0) var overlayTexture : texture_2d<f32>;
                    @group(0) @binding(1) var overlaySampler : sampler;

                    @fragment
                    fn fs_main(@location(0) uv : vec2f) -> @location(0) vec4f {
                        return textureSample(overlayTexture, overlaySampler, uv);
                    }
                `,
            });

            const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [this.overlayBindGroupLayout] });
            this.overlayPipeline = device.createRenderPipeline({
                layout: pipelineLayout,
                vertex: {
                    module: shaderModule,
                    entryPoint: 'vs_main',
                },
                fragment: {
                    module: shaderModule,
                    entryPoint: 'fs_main',
                    targets: [
                        {
                            format: this.canvasFormat,
                            blend: {
                                color: {
                                    srcFactor: 'one',
                                    dstFactor: 'one-minus-src-alpha',
                                    operation: 'add',
                                },
                                alpha: {
                                    srcFactor: 'one',
                                    dstFactor: 'one-minus-src-alpha',
                                    operation: 'add',
                                },
                            },
                        },
                    ],
                },
                primitive: {
                    topology: 'triangle-list',
                },
            });
        }

        const pass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: targetView,
                    loadOp: 'load',
                    storeOp: 'store',
                },
            ],
        });

        pass.setPipeline(this.overlayPipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(6, 1, 0, 0);
        pass.end();

        this.overlayRenderedThisFrame = false;
    }

    public compositeOverlayToCurrentCanvas(): boolean {
        if (!this.overlayRenderedThisFrame || !this.gizmoOverlayRT) {
            return false;
        }

        const backend = (this.threeRenderer as any).backend;
        const device = backend?.device as GPUDevice | undefined;
        const context = backend?.context as GPUCanvasContext | undefined;
        if (!device || !context) {
            return false;
        }

        const encoder = device.createCommandEncoder({ label: "Overlay-to-Canvas render pass" });
        const targetView = context.getCurrentTexture().createView();
        this.compositeOverlayToCanvas(device, encoder, targetView);
        device.queue.submit([encoder.finish()]);
        return true;
    }

    public async init() {
        await this.renderer.ensureSorter();
        this.renderer.setRawDepthEnabled(true);
        console.log("GaussianThreeJSRenderer.init() Done!");
    }


    /**
     * Set occluder meshes for depth rendering (DEPRECATED - use auto depth mode instead)
     * Calling this will disable auto depth mode
     */
    public setOccluderMeshes(meshes: THREE.Mesh[]): void {
        console.warn('[GaussianThreeJSRenderer] setOccluderMeshes is deprecated. Auto depth mode captures the full scene automatically.');
        console.warn('[GaussianThreeJSRenderer] To use manual occluders, set autoDepthMode = false');
        this.autoDepthMode = false; // Disable auto mode when using manual occluders
        this.occluderMeshes = meshes;
        this.occluderScene.clear();
        meshes.forEach(m => this.occluderScene.add(m));
    }

    /**
     * Enable or disable auto depth mode
     * Auto mode: Captures depth from full scene automatically
     * Manual mode: Requires setOccluderMeshes()
     */
    public setAutoDepthMode(enabled: boolean): void {
        this.autoDepthMode = enabled;
        if ((globalThis as any).GS_DEPTH_DEBUG) {
            //console.log(`[Depth] Auto depth mode: ${enabled ? 'enabled (full scene)' : 'disabled (manual occluders)'}`);
        }
    }

    public setDepthRangeScale(scale: number): void {
        const safe = Number.isFinite(scale) ? Math.max(0.01, Math.min(100, scale)) : 1.0;
        this.sceneDepthRangeScale = safe;
    }

    public setPreviewMode(mode: ScenePreviewMode): void {
        this.scenePreviewMode = mode;
    }

    public getPreviewMode(): ScenePreviewMode {
        return this.scenePreviewMode;
    }

    public getDepthRangeScale(): number {
        return this.sceneDepthRangeScale;
    }

    public getRawDepthSize(): { width: number; height: number } {
        return {
            width: this.rawDepthWidth,
            height: this.rawDepthHeight,
        };
    }

    public async pickScenePoint(camera: THREE.Camera, pixelX: number, pixelY: number): Promise<SceneDepthPickResult | null> {
        if (!this.sceneRawDepthTexture || !this.gaussianRawDepthTexture) return null;
        const x = Math.max(0, Math.min(this.rawDepthWidth - 1, Math.floor(pixelX)));
        const y = Math.max(0, Math.min(this.rawDepthHeight - 1, Math.floor(pixelY)));
        const [meshDepthValue, gaussianDepthValue] = await Promise.all([
            readTextureR32FloatPixel(this.device, this.sceneRawDepthTexture, x, y),
            readTextureR32FloatPixel(this.device, this.gaussianRawDepthTexture, x, y),
        ]);
        const meshDepth = meshDepthValue > 0 ? meshDepthValue : null;
        const gaussianDepth = gaussianDepthValue > 0 ? gaussianDepthValue : null;
        const depth = gaussianDepth ?? meshDepth;
        const source: RawDepthSource | null = gaussianDepth ? "gaussian" : (meshDepth ? "mesh" : null);
        const world = depth ? this.unprojectPixelToWorld(camera, x, y, depth) : null;
        return {
            pixelX: x,
            pixelY: y,
            source,
            meshDepth,
            gaussianDepth,
            depth,
            world,
        };
    }

    /**
     * Reads back one of the persisted raw-depth sources for debugging/export.
     * `combined` does not come from a dedicated GPU buffer; it is resolved on CPU as:
     * visible gaussian raw depth if present, otherwise mesh raw depth.
     */
    public async getRawDepthFrame(camera: THREE.Camera, source: RawDepthSource = "combined"): Promise<RawDepthFrameDebug | null> {
        if (!this.sceneRawDepthTexture || !this.gaussianRawDepthTexture) return null;
        const width = this.rawDepthWidth;
        const height = this.rawDepthHeight;
        const [meshData, gaussianData] = await Promise.all([
            readTextureR32Float(this.device, this.sceneRawDepthTexture, width, height),
            readTextureR32Float(this.device, this.gaussianRawDepthTexture, width, height),
        ]);

        let data: Float32Array;
        if (source === "mesh") {
            data = meshData;
        } else if (source === "gaussian") {
            data = gaussianData;
        } else {
            data = new Float32Array(width * height);
            for (let i = 0; i < data.length; i += 1) {
                data[i] = gaussianData[i] > 0 ? gaussianData[i] : meshData[i];
            }
        }

        const depthRange = this.computeRawDepthRange(data);
        return {
            source,
            width,
            height,
            minDepth: depthRange.minDepth,
            maxDepth: depthRange.maxDepth,
            data,
        };
    }

    private computeRawDepthRange(data: Float32Array): { minDepth: number | null; maxDepth: number | null } {
        let minDepth = Number.POSITIVE_INFINITY;
        let maxDepth = Number.NEGATIVE_INFINITY;
        for (let i = 0; i < data.length; i += 1) {
            const value = data[i];
            if (!(value > 0) || !Number.isFinite(value)) continue;
            if (value < minDepth) minDepth = value;
            if (value > maxDepth) maxDepth = value;
        }
        if (!Number.isFinite(minDepth) || !Number.isFinite(maxDepth)) {
            return { minDepth: null, maxDepth: null };
        }
        return { minDepth, maxDepth };
    }

    private unprojectPixelToWorld(camera: THREE.Camera, pixelX: number, pixelY: number, viewDepth: number): { x: number; y: number; z: number } | null {
        if (!(camera instanceof THREE.PerspectiveCamera) && camera.type !== "PerspectiveCamera") {
            return null;
        }
        const width = Math.max(1, this.rawDepthWidth);
        const height = Math.max(1, this.rawDepthHeight);
        const ndcX = ((pixelX + 0.5) / width) * 2 - 1;
        const ndcY = 1 - ((pixelY + 0.5) / height) * 2;
        const clip = new THREE.Vector4(ndcX, ndcY, 1, 1).applyMatrix4((camera as any).projectionMatrixInverse);
        if (Math.abs(clip.w) < 1e-6) {
            return null;
        }
        clip.divideScalar(clip.w);
        const scale = viewDepth / Math.max(1e-6, Math.abs(clip.z));
        const cameraSpacePoint = new THREE.Vector3(clip.x * scale, clip.y * scale, clip.z * scale);
        const worldPoint = cameraSpacePoint.applyMatrix4(camera.matrixWorld);
        return { x: worldPoint.x, y: worldPoint.y, z: worldPoint.z };
    }

    /**
     * Diagnostic: Check if depth is properly configured
     */
    public diagnoseDepth(): void {
        console.group('[Depth Diagnostic]');
        console.log('Auto depth mode:', this.autoDepthMode);
        console.log('Scene depth RT exists:', !!this.sceneDepthRT);
        console.log('Scene depth texture exists:', !!this.sceneDepthTexture);
        console.log('Scene raw depth texture exists:', !!this.sceneRawDepthTexture);
        console.log('Gaussian raw depth texture exists:', !!this.gaussianRawDepthTexture);
        
        if (this.sceneDepthRT) {
            console.log('Scene depth RT size:', this.sceneDepthRT.width, 'x', this.sceneDepthRT.height);
            console.log('Scene depth RT format:', this.sceneDepthRT.texture.format);
        }
        
        if (this.renderer) {
            console.log('GaussianRenderer depth enabled:', (this.renderer as any).useDepth);
            console.log('GaussianRenderer depth format:', (this.renderer as any).depthFormat);
        }
        
        console.groupEnd();
    }

    /**
     * Clean up depth resources
     */
    public disposeDepthResources(): void {
        if (this.sceneDepthRT) {
            this.sceneDepthRT.dispose();
            this.sceneDepthRT = null;
        }
        
        this.sceneDepthTexture = null;
        this.sceneRawDepthTexture?.destroy();
        this.sceneRawDepthTexture = null;
        this.gaussianRawDepthTexture?.destroy();
        this.gaussianRawDepthTexture = null;
        this.rawDepthWidth = 0;
        this.rawDepthHeight = 0;
        this.rawSceneDepthPipeline = null;
        this.rawSceneDepthBindGroupLayout = null;
        
        if ((globalThis as any).GS_DEPTH_DEBUG) {
            console.log('[Depth] Cleaned up depth resources');
        }

        if (this.gizmoOverlayRT) {
            this.gizmoOverlayRT.dispose();
            this.gizmoOverlayRT = null;
        }
        this.overlayPipeline = null;
        this.overlayBindGroupLayout = null;
        this.overlaySampler = null;
        this.overlayRenderedThisFrame = false;
    }

    private getViewport(): [number, number] {
        const dbSize = new THREE.Vector2();
        (this.threeRenderer as any).getDrawingBufferSize?.(dbSize);
        const width = dbSize.x || (this.threeRenderer.domElement?.width ?? 0) || (this.threeRenderer.getSize(new THREE.Vector2()).x);
        const height = dbSize.y || (this.threeRenderer.domElement?.height ?? 0) || (this.threeRenderer.getSize(new THREE.Vector2()).y);
        return [width, height];
    }

    private convertCamera(camera: THREE.Camera, renderer: THREE.WebGPURenderer): PerspectiveCamera {
        const viewport = this.getViewport();
        const adapter = new CameraAdapter();
        // Use unified adapter API (mirrors DirectCameraAdapter)
        adapter.update(camera as any, viewport);
        return adapter as unknown as PerspectiveCamera;
    }

        /** 
     * Update all dynamic models with current camera and time
     */
        public async updateDynamicModels(camera: THREE.Camera, time?: number): Promise<void> {
            // 使用 CameraAdapter 获取转换后的矩阵（与渲染管线一致）
            const adapter = new CameraAdapter();
            const viewport = this.getViewport();
            adapter.update(camera as any, viewport);
            
            const viewMatrix = adapter.viewMatrix();
            const projMatrix = adapter.projMatrix();
    
            // Update each model with transformed matrices
            // 串行更新，确保每个模型的推理完成后再更新下一个
            for (const model of this.gaussianModels) {
                try {
                    await model.update(viewMatrix as any, time, projMatrix as any);
                } catch (error) {
                    console.warn(`Failed to update model:`, error);
                }
            }
        }

    // ==================== 3DGS Parameters Management ====================
    
    /**
     * Set Gaussian scaling for a specific model
     */
    public setModelGaussianScale(modelId: string, scale: number): void {
        const modelIndex = parseInt(modelId.replace('model_', ''));
        if (modelIndex >= 0 && modelIndex < this.gaussianModels.length) {
            this.gaussianModels[modelIndex].setGaussianScale(scale);
            console.log(`[GaussianThreeJSRenderer] Model ${modelId} Gaussian scale set to: ${scale}`);
        } else {
            console.warn(`[GaussianThreeJSRenderer] Model ${modelId} not found`);
        }
    }
    
    /**
     * Get Gaussian scale for a specific model
     */
    public getModelGaussianScale(modelId: string): number {
        const modelIndex = parseInt(modelId.replace('model_', ''));
        if (modelIndex >= 0 && modelIndex < this.gaussianModels.length) {
            return this.gaussianModels[modelIndex].getGaussianScale();
        }
        return 1.0; // default value
    }

    /** Get model visibility */
    public getModelVisible(modelId: string): boolean {
        const modelIndex = parseInt(modelId.replace('model_', ''));
        if (modelIndex >= 0 && modelIndex < this.gaussianModels.length) {
            return this.gaussianModels[modelIndex].getModelVisible();
        }
        return false;
    }

    /**
     * Set maximum spherical harmonics degree for a specific model
     */
    public setModelMaxShDeg(modelId: string, deg: number): void {
        const modelIndex = parseInt(modelId.replace('model_', ''));
        if (modelIndex >= 0 && modelIndex < this.gaussianModels.length) {
            this.gaussianModels[modelIndex].setMaxShDeg(deg);
            console.log(`[GaussianThreeJSRenderer] Model ${modelId} Max SH degree set to: ${deg}`);
        } else {
            console.warn(`[GaussianThreeJSRenderer] Model ${modelId} not found`);
        }
    }

    /** Get max SH degree for a specific model */
    public getModelMaxShDeg(modelId: string): number {
        const modelIndex = parseInt(modelId.replace('model_', ''));
        if (modelIndex >= 0 && modelIndex < this.gaussianModels.length) {
            return this.gaussianModels[modelIndex].getMaxShDeg();
        }
        return 0;
    }

    /**
     * Set kernel size for a specific model
     */
    public setModelKernelSize(modelId: string, size: number): void {
        const modelIndex = parseInt(modelId.replace('model_', ''));
        if (modelIndex >= 0 && modelIndex < this.gaussianModels.length) {
            this.gaussianModels[modelIndex].setKernelSize(size);
            console.log(`[GaussianThreeJSRenderer] Model ${modelId} Kernel size set to: ${size}`);
        } else {
            console.warn(`[GaussianThreeJSRenderer] Model ${modelId} not found`);
        }
    }

    /** Get kernel size for a specific model */
    public getModelKernelSize(modelId: string): number {
        const modelIndex = parseInt(modelId.replace('model_', ''));
        if (modelIndex >= 0 && modelIndex < this.gaussianModels.length) {
            return this.gaussianModels[modelIndex].getKernelSize();
        }
        return 0;
    }

    /**
     * Set opacity scale for a specific model
     */
    public setModelOpacityScale(modelId: string, scale: number): void {
        const modelIndex = parseInt(modelId.replace('model_', ''));
        if (modelIndex >= 0 && modelIndex < this.gaussianModels.length) {
            this.gaussianModels[modelIndex].setOpacityScale(scale);
            console.log(`[GaussianThreeJSRenderer] Model ${modelId} Opacity scale set to: ${scale}`);
        } else {
            console.warn(`[GaussianThreeJSRenderer] Model ${modelId} not found`);
        }
    }

    /** Get opacity scale for a specific model */
    public getModelOpacityScale(modelId: string): number {
        const modelIndex = parseInt(modelId.replace('model_', ''));
        if (modelIndex >= 0 && modelIndex < this.gaussianModels.length) {
            return this.gaussianModels[modelIndex].getOpacityScale();
        }
        return 1.0;
    }

    /**
     * Set cutoff scale for a specific model
     */
    public setModelCutoffScale(modelId: string, scale: number): void {
        const modelIndex = parseInt(modelId.replace('model_', ''));
        if (modelIndex >= 0 && modelIndex < this.gaussianModels.length) {
            this.gaussianModels[modelIndex].setCutoffScale(scale);
            console.log(`[GaussianThreeJSRenderer] Model ${modelId} Cutoff scale set to: ${scale}`);
        } else {
            console.warn(`[GaussianThreeJSRenderer] Model ${modelId} not found`);
        }
    }

    /** Get cutoff scale for a specific model */
    public getModelCutoffScale(modelId: string): number {
        const modelIndex = parseInt(modelId.replace('model_', ''));
        if (modelIndex >= 0 && modelIndex < this.gaussianModels.length) {
            return this.gaussianModels[modelIndex].getCutoffScale();
        }
        return 1.0;
    }

    /**
     * Set time scale for a specific model
     */
    public setModelTimeScale(modelId: string, scale: number): void {
        const modelIndex = parseInt(modelId.replace('model_', ''));
        if (modelIndex >= 0 && modelIndex < this.gaussianModels.length) {
            this.gaussianModels[modelIndex].setTimeScale(scale);
            console.log(`[GaussianThreeJSRenderer] Model ${modelId} Time scale set to: ${scale}`);
        } else {
            console.warn(`[GaussianThreeJSRenderer] Model ${modelId} not found`);
        }
    }

    /**
     * Set time offset for a specific model
     */
    public setModelTimeOffset(modelId: string, offset: number): void {
        const modelIndex = parseInt(modelId.replace('model_', ''));
        if (modelIndex >= 0 && modelIndex < this.gaussianModels.length) {
            this.gaussianModels[modelIndex].setTimeOffset(offset);
            console.log(`[GaussianThreeJSRenderer] Model ${modelId} Time offset set to: ${offset}`);
        } else {
            console.warn(`[GaussianThreeJSRenderer] Model ${modelId} not found`);
        }
    }

    /**
     * Set time offset for a specific model
     */
    public setModelAnimationIsLoop(modelId: string, is_loop: boolean): void {
        const modelIndex = parseInt(modelId.replace('model_', ''));
        if (modelIndex >= 0 && modelIndex < this.gaussianModels.length) {
            this.gaussianModels[modelIndex].setAnimationIsLoop(is_loop);
            console.log(`[GaussianThreeJSRenderer] Model ${modelId} Animation is loop set to: ${is_loop}`);
        } else {
            console.warn(`[GaussianThreeJSRenderer] Model ${modelId} not found`);
        }
    }


    /**
     * Set time update mode for a specific model
     */
    public setModelTimeUpdateMode(modelId: string, mode: any): void {
        const modelIndex = parseInt(modelId.replace('model_', ''));
        if (modelIndex >= 0 && modelIndex < this.gaussianModels.length) {
            this.gaussianModels[modelIndex].setTimeUpdateMode(mode);
            console.log(`[GaussianThreeJSRenderer] Model ${modelId} Time update mode set to: ${mode}`);
        } else {
            console.warn(`[GaussianThreeJSRenderer] Model ${modelId} not found`);
        }
    }

    /**
     * Set render mode for a specific model
     */
    public setModelRenderMode(modelId: string, mode: number): void {
        const modelIndex = parseInt(modelId.replace('model_', ''));
        if (modelIndex >= 0 && modelIndex < this.gaussianModels.length) {
            this.gaussianModels[modelIndex].setRenderMode(mode);
            console.log(`[GaussianThreeJSRenderer] Model ${modelId} Render mode set to: ${mode}`);
        } else {
            console.warn(`[GaussianThreeJSRenderer] Model ${modelId} not found`);
        }
    }

    /** Get render mode for a specific model */
    public getModelRenderMode(modelId: string): number {
        const modelIndex = parseInt(modelId.replace('model_', ''));
        if (modelIndex >= 0 && modelIndex < this.gaussianModels.length) {
            return this.gaussianModels[modelIndex].getRenderMode();
        }
        return 0;
    }

    /**
     * Start animation for a specific model
     */
    public startModelAnimation(modelId: string, speed: number = 1.0): void {
        const modelIndex = parseInt(modelId.replace('model_', ''));
        if (modelIndex >= 0 && modelIndex < this.gaussianModels.length) {
            this.gaussianModels[modelIndex].startAnimation(speed);
            console.log(`[GaussianThreeJSRenderer] Model ${modelId} Animation started at ${speed}x speed`);
        } else {
            console.warn(`[GaussianThreeJSRenderer] Model ${modelId} not found`);
        }
    }

    /**
     * Pause animation for a specific model
     */
    public pauseModelAnimation(modelId: string): void {
        const modelIndex = parseInt(modelId.replace('model_', ''));
        if (modelIndex >= 0 && modelIndex < this.gaussianModels.length) {
            this.gaussianModels[modelIndex].pauseAnimation();
            console.log(`[GaussianThreeJSRenderer] Model ${modelId} Animation paused`);
        } else {
            console.warn(`[GaussianThreeJSRenderer] Model ${modelId} not found`);
        }
    }

    /**
     * Resume animation for a specific model
     */
    public resumeModelAnimation(modelId: string): void {
        const modelIndex = parseInt(modelId.replace('model_', ''));
        if (modelIndex >= 0 && modelIndex < this.gaussianModels.length) {
            this.gaussianModels[modelIndex].resumeAnimation();
            console.log(`[GaussianThreeJSRenderer] Model ${modelId} Animation resumed`);
        } else {
            console.warn(`[GaussianThreeJSRenderer] Model ${modelId} not found`);
        }
    }

    /**
     * Stop animation for a specific model
     */
    public stopModelAnimation(modelId: string): void {
        const modelIndex = parseInt(modelId.replace('model_', ''));
        if (modelIndex >= 0 && modelIndex < this.gaussianModels.length) {
            this.gaussianModels[modelIndex].stopAnimation();
            console.log(`[GaussianThreeJSRenderer] Model ${modelId} Animation stopped`);
        } else {
            console.warn(`[GaussianThreeJSRenderer] Model ${modelId} not found`);
        }
    }

    /**
     * Set animation time for a specific model
     */
    public setModelAnimationTime(modelId: string, time: number): void {
        const modelIndex = parseInt(modelId.replace('model_', ''));
        if (modelIndex >= 0 && modelIndex < this.gaussianModels.length) {
            this.gaussianModels[modelIndex].setAnimationTime(time);
            console.log(`[GaussianThreeJSRenderer] Model ${modelId} Animation time set to: ${time.toFixed(3)}s`);
        } else {
            console.warn(`[GaussianThreeJSRenderer] Model ${modelId} not found`);
        }
    }

    /**
     * Set animation speed for a specific model
     */
    public setModelAnimationSpeed(modelId: string, speed: number): void {
        const modelIndex = parseInt(modelId.replace('model_', ''));
        if (modelIndex >= 0 && modelIndex < this.gaussianModels.length) {
            this.gaussianModels[modelIndex].setAnimationSpeed(speed);
            console.log(`[GaussianThreeJSRenderer] Model ${modelId} Animation speed set to: ${speed}x`);
        } else {
            console.warn(`[GaussianThreeJSRenderer] Model ${modelId} not found`);
        }
    }
    
    /**
     * Get all model parameters
     */
    public getModelParams(): any {
        const result: any = {
            models: {}
        };
        
        this.gaussianModels.forEach((model, index) => {
            const modelId = `model_${index}`;
            result.models[modelId] = {
                id: modelId,
                name: model.name,
                visible: model.getModelVisible(),
                gaussianScale: model.getGaussianScale(),
                maxShDeg: model.getMaxShDeg(),
                kernelSize: model.getKernelSize(),
                opacityScale: model.getOpacityScale(),
                cutoffScale: model.getCutoffScale(),
                timeScale: model.getTimeScale(),
                timeOffset: model.getTimeOffset(),
                timeUpdateMode: model.getTimeUpdateMode(),
                animationSpeed: model.getAnimationSpeed(),
                isAnimationRunning: model.isAnimationRunning(),
                isAnimationPaused: model.isAnimationPaused()
            };
        });
        
        return result;
    }
    
    /**
     * 获取所有高斯模型
     * @returns 高斯模型数组的副本
     */
    public getGaussianModels(): GaussianModel[] {
        return [...this.gaussianModels]; // 返回副本以防止外部修改
    }

    /**
     * Append a GaussianModel at runtime
     */
    public appendGaussianModel(model: GaussianModel): void {
        this.gaussianModels.push(model);
    }

    /**
     * Remove a GaussianModel by id (e.g., 'model_2')
     * Returns true if removed
     */
    public removeModelById(modelId: string): boolean {
        const modelIndex = parseInt(modelId.replace('model_', ''));
        if (isNaN(modelIndex) || modelIndex < 0 || modelIndex >= this.gaussianModels.length) {
            console.warn(`[GaussianThreeJSRenderer] removeModelById: invalid id ${modelId}`);
            return false;
        }
        const model = this.gaussianModels[modelIndex];
        try {
            // Remove from scene graph
            this.threeScene.remove(model);
            // Optional: dispose hooks
            model.dispose?.();
        } catch (e) {
            console.warn('[GaussianThreeJSRenderer] Error removing model from scene:', e);
        }
        // Remove from internal list
        this.gaussianModels.splice(modelIndex, 1);
        console.log(`[GaussianThreeJSRenderer] Removed ${modelId} (${model.name})`);
        return true;
    }

    /**
     * Set visibility for a specific model
     */
    public setModelVisible(modelId: string, visible: boolean): void {
        const modelIndex = parseInt(modelId.replace('model_', ''));
        if (modelIndex >= 0 && modelIndex < this.gaussianModels.length) {
            this.gaussianModels[modelIndex].setModelVisible(visible);
            console.log(`[GaussianThreeJSRenderer] Model ${modelId} visible: ${visible}`);
        } else {
            console.warn(`[GaussianThreeJSRenderer] Model ${modelId} not found`);
        }
    }

    /**
     * Reset all parameters to defaults
     */
    public resetParameters(): void {
        this.gaussianModels.forEach(model => {
            model.setGaussianScale(1.0);
            model.setMaxShDeg(3);
            model.setKernelSize(0.1);
            model.setOpacityScale(1.0);
            model.setCutoffScale(1.0);
            model.setTimeScale(1.0);
            model.setTimeOffset(0.0);
            model.setTimeUpdateMode('fixed_delta');
        });
        console.log('[GaussianThreeJSRenderer] All parameters reset to defaults');
    }

    // ==================== Global Animation Controls ====================

    /** Set time scale for all models */
    public setGlobalTimeScale(scale: number): void {
        this.gaussianModels.forEach(model => model.setTimeScale(scale));
        console.log(`[GaussianThreeJSRenderer] Global time scale set: ${scale}`);
    }

    /** Set time offset for all models */
    public setGlobalTimeOffset(offset: number): void {
        this.gaussianModels.forEach(model => model.setTimeOffset(offset));
        console.log(`[GaussianThreeJSRenderer] Global time offset set: ${offset}`);
    }

    /** Set time update mode for all models */
    public setGlobalTimeUpdateMode(mode: any): void {
        this.gaussianModels.forEach(model => model.setTimeUpdateMode(mode));
        console.log(`[GaussianThreeJSRenderer] Global time update mode: ${mode}`);
    }

    /** Start animation on all models */
    public startAllAnimations(speed: number = 1.0): void {
        this.gaussianModels.forEach(model => model.startAnimation(speed));
        console.log(`[GaussianThreeJSRenderer] All animations started at ${speed}x`);
    }

    /** Pause animation on all models */
    public pauseAllAnimations(): void {
        this.gaussianModels.forEach(model => model.pauseAnimation());
        console.log(`[GaussianThreeJSRenderer] All animations paused`);
    }

    /** Resume animation on all models */
    public resumeAllAnimations(): void {
        this.gaussianModels.forEach(model => model.resumeAnimation());
        console.log(`[GaussianThreeJSRenderer] All animations resumed`);
    }

    /** Stop animation on all models */
    public stopAllAnimations(): void {
        this.gaussianModels.forEach(model => model.stopAnimation());
        console.log(`[GaussianThreeJSRenderer] All animations stopped`);
    }

    /** Set animation time for all models */
    public setAllAnimationTime(time: number): void {
        this.gaussianModels.forEach(model => model.setAnimationTime(time));
        console.log(`[GaussianThreeJSRenderer] Global animation time set: ${time.toFixed(3)}s`);
    }

    /** Set animation speed for all models */
    public setAllAnimationSpeed(speed: number): void {
        this.gaussianModels.forEach(model => model.setAnimationSpeed(speed));
        console.log(`[GaussianThreeJSRenderer] Global animation speed set: ${speed}x`);
    }
}
