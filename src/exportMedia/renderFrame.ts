import * as THREE from "three/webgpu";
import { GaussianModel } from "../app/GaussianModel";
import { RecordingCamera } from "./RecordingCamera";

export type VisionaryRenderMode = "color" | "normal" | "depth";
export type VisionaryMatrixLayout = "row-major" | "column-major";
export type VisionaryExtrinsicConvention = "camera-to-world" | "world-to-camera";
export type VisionaryCameraCoordinateSystem = "three" | "opencv";
export type VisionaryRenderOutput = "canvas" | "blob" | "imageData" | "bitmap";

export interface VisionaryRenderResolution {
    width: number;
    height: number;
}

export interface VisionaryVector3Like {
    x: number;
    y: number;
    z: number;
}

export interface VisionaryQuaternionLike {
    x: number;
    y: number;
    z: number;
    w: number;
}

export interface VisionaryCameraIntrinsics {
    fx: number;
    fy?: number;
    cx?: number;
    cy?: number;
    width?: number;
    height?: number;
    near?: number;
    far?: number;
}

export interface VisionaryCameraExtrinsics {
    matrix: ArrayLike<number>;
    convention?: VisionaryExtrinsicConvention;
    layout?: VisionaryMatrixLayout;
    coordinateSystem?: VisionaryCameraCoordinateSystem;
}

export interface VisionaryCameraPose {
    position: VisionaryVector3Like;
    quaternion: VisionaryQuaternionLike;
    near?: number;
    far?: number;
}

export interface VisionaryLookAtCameraPose {
    position: VisionaryVector3Like;
    target: VisionaryVector3Like;
    up?: VisionaryVector3Like;
    near?: number;
    far?: number;
}

export interface VisionaryRenderCameraParameters {
    intrinsics?: VisionaryCameraIntrinsics;
    extrinsics?: VisionaryCameraExtrinsics;
    pose?: VisionaryCameraPose;
    lookAt?: VisionaryLookAtCameraPose;
    fovDegrees?: number;
    near?: number;
    far?: number;
}

export interface VisionaryRenderFrameContext {
    renderer: THREE.WebGPURenderer;
    scene: THREE.Scene;
    gaussianModels?: GaussianModel[];
    originalTexture?: THREE.DataTexture | null;
}

export interface VisionaryRenderFrameOptions {
    resolution: VisionaryRenderResolution;
    camera: VisionaryRenderCameraParameters;
    mode?: VisionaryRenderMode;
    depthRangeScale?: number;
    outputs?: VisionaryRenderOutput[];
    mimeType?: string;
    quality?: number;
    id?: string;
}

export interface VisionaryRenderFrameResult {
    width: number;
    height: number;
    canvas: HTMLCanvasElement;
    blob?: Blob;
    imageData?: ImageData;
    bitmap?: ImageBitmap;
}

const DEFAULT_FOV_DEGREES = 45;
const DEFAULT_NEAR = 0.01;
const DEFAULT_FAR = 2000;
const THREE_FROM_OPENCV_CAMERA = new THREE.Matrix4().set(
    1, 0, 0, 0,
    0, -1, 0, 0,
    0, 0, -1, 0,
    0, 0, 0, 1
);

function clampPositiveInteger(value: number, fallback: number): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(1, Math.round(numeric));
}

function finiteNumber(value: unknown, fallback: number): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function readVector3(value: VisionaryVector3Like, fallback = new THREE.Vector3()): THREE.Vector3 {
    return new THREE.Vector3(
        finiteNumber(value?.x, fallback.x),
        finiteNumber(value?.y, fallback.y),
        finiteNumber(value?.z, fallback.z)
    );
}

function createMatrixFromArray(values: ArrayLike<number>, layout: VisionaryMatrixLayout = "column-major"): THREE.Matrix4 {
    if (!values || values.length < 16) {
        throw new Error("camera extrinsics matrix must contain 16 numbers");
    }
    const m = Array.from({ length: 16 }, (_, index) => finiteNumber(values[index], index % 5 === 0 ? 1 : 0));
    const matrix = new THREE.Matrix4();
    if (layout === "row-major") {
        matrix.set(
            m[0], m[1], m[2], m[3],
            m[4], m[5], m[6], m[7],
            m[8], m[9], m[10], m[11],
            m[12], m[13], m[14], m[15]
        );
    } else {
        matrix.fromArray(m);
    }
    return matrix;
}

function applyExtrinsics(camera: THREE.PerspectiveCamera, extrinsics: VisionaryCameraExtrinsics): void {
    let cameraToWorld = createMatrixFromArray(extrinsics.matrix, extrinsics.layout);
    if ((extrinsics.convention || "camera-to-world") === "world-to-camera") {
        cameraToWorld = cameraToWorld.clone().invert();
    }
    if ((extrinsics.coordinateSystem || "three") === "opencv") {
        cameraToWorld = cameraToWorld.clone().multiply(THREE_FROM_OPENCV_CAMERA);
    }

    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    cameraToWorld.decompose(position, quaternion, scale);
    camera.position.copy(position);
    camera.quaternion.copy(quaternion);
}

function applyPose(camera: THREE.PerspectiveCamera, pose: VisionaryCameraPose): void {
    camera.position.copy(readVector3(pose.position));
    camera.quaternion.set(
        finiteNumber(pose.quaternion?.x, 0),
        finiteNumber(pose.quaternion?.y, 0),
        finiteNumber(pose.quaternion?.z, 0),
        finiteNumber(pose.quaternion?.w, 1)
    ).normalize();
}

function applyLookAt(camera: THREE.PerspectiveCamera, pose: VisionaryLookAtCameraPose): void {
    camera.position.copy(readVector3(pose.position));
    camera.up.copy(readVector3(pose.up || { x: 0, y: 1, z: 0 }, new THREE.Vector3(0, 1, 0))).normalize();
    camera.lookAt(readVector3(pose.target));
}

function resolveFovDegrees(camera: VisionaryRenderCameraParameters, resolution: VisionaryRenderResolution): number {
    const fy = Number(camera.intrinsics?.fy ?? camera.intrinsics?.fx);
    const height = Number(camera.intrinsics?.height || resolution.height);
    if (Number.isFinite(fy) && fy > 0 && Number.isFinite(height) && height > 0) {
        return THREE.MathUtils.radToDeg(2 * Math.atan(height / (2 * fy)));
    }
    const fov = Number(camera.fovDegrees);
    return Number.isFinite(fov) && fov > 0 ? fov : DEFAULT_FOV_DEGREES;
}

function applyIntrinsicsProjection(
    camera: THREE.PerspectiveCamera,
    intrinsics: VisionaryCameraIntrinsics,
    resolution: VisionaryRenderResolution
): void {
    const width = clampPositiveInteger(intrinsics.width || resolution.width, resolution.width);
    const height = clampPositiveInteger(intrinsics.height || resolution.height, resolution.height);
    const fx = finiteNumber(intrinsics.fx, 0);
    const fy = finiteNumber(intrinsics.fy ?? intrinsics.fx, 0);
    if (fx <= 0 || fy <= 0) {
        throw new Error("camera intrinsics require positive fx and fy");
    }

    const cx = finiteNumber(intrinsics.cx, width / 2);
    const cy = finiteNumber(intrinsics.cy, height / 2);
    const near = Math.max(1e-6, finiteNumber(intrinsics.near ?? camera.near, DEFAULT_NEAR));
    const far = Math.max(near + 1e-6, finiteNumber(intrinsics.far ?? camera.far, DEFAULT_FAR));

    camera.near = near;
    camera.far = far;
    camera.aspect = width / height;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(height / (2 * fy)));
    camera.projectionMatrix.set(
        (2 * fx) / width, 0, 1 - (2 * cx) / width, 0,
        0, (2 * fy) / height, (2 * cy) / height - 1, 0,
        0, 0, -(far + near) / (far - near), (-2 * far * near) / (far - near),
        0, 0, -1, 0
    );
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}

export function applyVisionaryCameraParameters(
    camera: THREE.PerspectiveCamera,
    parameters: VisionaryRenderCameraParameters,
    resolution: VisionaryRenderResolution
): { preserveCameraProjection: boolean } {
    if (!parameters) {
        throw new Error("camera parameters are required");
    }

    camera.near = Math.max(1e-6, finiteNumber(parameters.near, DEFAULT_NEAR));
    camera.far = Math.max(camera.near + 1e-6, finiteNumber(parameters.far, DEFAULT_FAR));

    if (parameters.extrinsics) {
        applyExtrinsics(camera, parameters.extrinsics);
    } else if (parameters.pose) {
        applyPose(camera, parameters.pose);
    } else if (parameters.lookAt) {
        applyLookAt(camera, parameters.lookAt);
    }

    let preserveCameraProjection = false;
    if (parameters.intrinsics) {
        applyIntrinsicsProjection(camera, parameters.intrinsics, resolution);
        preserveCameraProjection = true;
    } else {
        camera.aspect = resolution.width / resolution.height;
        camera.fov = resolveFovDegrees(parameters, resolution);
        camera.updateProjectionMatrix();
    }

    camera.updateMatrixWorld(true);
    return { preserveCameraProjection };
}

async function canvasToBlob(canvas: HTMLCanvasElement, mimeType = "image/png", quality?: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
                return;
            }
            reject(new Error("failed to encode render canvas"));
        }, mimeType, quality);
    });
}

function readCanvasImageData(canvas: HTMLCanvasElement): ImageData {
    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("failed to read render canvas 2D context");
    }
    return context.getImageData(0, 0, canvas.width, canvas.height);
}

export class VisionaryFrameRenderer {
    private context: VisionaryRenderFrameContext;
    private recordingCamera: RecordingCamera | null = null;
    private initialized = false;
    private readonly id: string;

    constructor(context: VisionaryRenderFrameContext, id = `visionary_frame_${Date.now().toString(36)}`) {
        this.context = context;
        this.id = id;
    }

    private async ensureRecordingCamera(options: VisionaryRenderFrameOptions): Promise<RecordingCamera> {
        const width = clampPositiveInteger(options.resolution.width, 1);
        const height = clampPositiveInteger(options.resolution.height, 1);
        const fov = resolveFovDegrees(options.camera, { width, height });

        if (!this.recordingCamera) {
            this.recordingCamera = new RecordingCamera(options.id || this.id, width, height, fov, false, "VisionaryFrameRenderer");
        }

        this.recordingCamera.canvas.width = width;
        this.recordingCamera.canvas.height = height;
        this.recordingCamera.canvas.style.width = `${width}px`;
        this.recordingCamera.canvas.style.height = `${height}px`;

        if (!this.initialized) {
            const ok = await this.recordingCamera.initializeRenderer(
                this.context.renderer,
                this.context.scene,
                this.context.gaussianModels || [],
                this.context.originalTexture || undefined
            );
            if (!ok) {
                throw new Error("failed to initialize Visionary frame renderer");
            }
            this.initialized = true;
        }

        return this.recordingCamera;
    }

    async render(options: VisionaryRenderFrameOptions): Promise<VisionaryRenderFrameResult> {
        const resolution = {
            width: clampPositiveInteger(options.resolution.width, 1),
            height: clampPositiveInteger(options.resolution.height, 1),
        };
        const recordingCamera = await this.ensureRecordingCamera({ ...options, resolution });
        recordingCamera.setScenePreviewMode(options.mode || "color");
        if (Number.isFinite(Number(options.depthRangeScale))) {
            recordingCamera.setSceneDepthRangeScale(Number(options.depthRangeScale));
        }

        const { preserveCameraProjection } = applyVisionaryCameraParameters(recordingCamera.camera, options.camera, resolution);
        const canvas = await recordingCamera.renderToCanvas(this.context.scene, { preserveCameraProjection });
        const outputs = new Set(options.outputs || ["canvas"]);
        const result: VisionaryRenderFrameResult = {
            width: resolution.width,
            height: resolution.height,
            canvas,
        };

        if (outputs.has("blob")) {
            result.blob = await canvasToBlob(canvas, options.mimeType, options.quality);
        }
        if (outputs.has("imageData")) {
            result.imageData = readCanvasImageData(canvas);
        }
        if (outputs.has("bitmap")) {
            result.bitmap = await createImageBitmap(canvas);
        }

        return result;
    }

    dispose(): void {
        this.recordingCamera?.dispose();
        this.recordingCamera = null;
        this.initialized = false;
    }
}

export async function renderVisionaryFrame(
    context: VisionaryRenderFrameContext,
    options: VisionaryRenderFrameOptions
): Promise<VisionaryRenderFrameResult> {
    const renderer = new VisionaryFrameRenderer(context, options.id);
    try {
        return await renderer.render(options);
    } finally {
        renderer.dispose();
    }
}
