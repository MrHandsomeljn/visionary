// Renderer interfaces and contracts
//
// Render flow overview used by Visionary editor / fused renderer:
//
// 1. `prepareMulti(...)`
//    CPU-side caller has already chosen the active render mode for each model
//    (`color`, `normal`, or `depth`).
//    This stage runs gaussian preprocess + sorting, and writes per-splat data into
//    the shared `points_2d` buffer. When raw scene depth is enabled, preprocess also
//    stores each splat's raw view-space depth (`z_view`) alongside color data.
//
// 2. Mesh / Three scene render
//    The fused renderer may render the regular Three.js scene first to capture mesh
//    depth and color. This produces the mesh-only depth source often called `D1`.
//    In the editor path, that depth is additionally transformed into a raw view-space
//    depth texture so mesh raw depth can be read back later.
//
// 3. `render(...)` / `renderMulti(...)`
//    This stage records gaussian draw calls into the current render pass.
//    In `color` and `normal` modes, attachment 0 is the visible color target.
//    In `depth` mode, attachment 0 is still the visible target, but contains
//    depth visualization rather than albedo/normal output.
//    When raw depth is enabled by the caller, attachment 1 stores gaussian raw
//    view-space depth for the visible splat at each pixel.
//
// Raw depth availability:
// - `color`: available after gaussian preprocess and persisted during gaussian draw
// - `normal`: available after gaussian preprocess and persisted during gaussian draw
// - `depth`: available after gaussian preprocess and persisted during gaussian draw;
//   the on-screen depth image is only a visualization, not the raw buffer itself
//
// Important distinction:
// - "depth preview" / "depth visualization" means a mapped grayscale display value
// - "raw depth" means the underlying view-space depth that can be used for picking,
//   reprojection, or debugging

import { PerspectiveCamera } from '../camera';
import { PointCloud } from '../point_cloud';

/**
 * Arguments for rendering operations
 */
export interface RenderArgs {
  /** Camera for view/projection transforms */
  camera: PerspectiveCamera;
  /** Viewport dimensions [width, height] */
  viewport: [number, number];
  /** Optional clipping box for culling */
  clippingBox?: { min: [number,number,number], max: [number,number,number] };
  /** Maximum spherical harmonics degree */
  maxSHDegree?: number;
  /** Show environment map */
  showEnvMap?: boolean;
  /** Enable mip-splatting */
  mipSplatting?: boolean;
  /** Kernel size for splatting */
  kernelSize?: number;
  /** Animation time */
  walltime?: number;
  /** Scene extent for LOD */
  sceneExtend?: number;
  /** Multiplier applied to auto scene extent (useful for depth visualization range tuning) */
  sceneExtendScale?: number;
  /** Scene center for culling */
  sceneCenter?: [number,number,number];
}

/**
 * Generic interface for Gaussian splatting renderers
 */
export interface IRenderer {
  /**
   * Initialize GPU resources asynchronously
   */
  initialize(): Promise<void>;
  
  /**
   * Prepare rendering resources for multiple point clouds in a frame
   * This handles preprocessing, sorting, and resource setup using global sorting
   */
  prepareMulti(encoder: GPUCommandEncoder, queue: GPUQueue, pointClouds: PointCloud[], args: RenderArgs): void;
  
  /**
   * Record rendering commands to a render pass
   */
  render(pass: GPURenderPassEncoder, pointCloud: PointCloud): void;
  
  /**
   * Record rendering commands for multiple point clouds to a render pass
   */
  renderMulti(pass: GPURenderPassEncoder, pointClouds: PointCloud[]): void;
  
  /**
   * Get pipeline information for external integrations
   */
  getPipelineInfo(): {
    format: GPUTextureFormat;
    bindGroupLayouts: GPUBindGroupLayout[];
  };
}

/**
 * Render statistics for profiling and debugging
 */
export interface RenderStats {
  /** Number of Gaussians rendered */
  gaussianCount: number;
  /** Number of visible splats after culling */
  visibleSplats: number;
  /** GPU memory usage in bytes */
  memoryUsage: number;
}

/**
 * Configuration options for renderer creation
 */
export interface RendererConfig {
  /** WebGPU device */
  device: GPUDevice;
  /** Target texture format */
  format: GPUTextureFormat;
  /** Maximum spherical harmonics degree */
  shDegree: number;
  /** Use compressed data formats */
  compressed?: boolean;
  /** Enable debug features */
  debug?: boolean;
}

// Export concrete implementations
export { GaussianRenderer, DEFAULT_KERNEL_SIZE } from './gaussian_renderer';
// Re-export for compatibility with old imports
export type { RenderArgs as SplattingArgs } from './index';
