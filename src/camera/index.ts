// Camera module re-exports

export type { Camera } from './perspective';
export { 
  PerspectiveCamera, 
  PerspectiveProjection, 
  world2view, 
  buildProj 
} from './perspective';
export {
  coreCameraW2CToTimelineW2C,
  timelineW2CToCoreCameraW2C,
} from './camera-pose-conventions';

// Re-export utilities for backward compatibility
export { deg2rad, focal2fov, fov2focal, Aabb, VIEWPORT_Y_FLIP } from '../utils';
