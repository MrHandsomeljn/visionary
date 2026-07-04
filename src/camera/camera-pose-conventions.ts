import { quat, vec3 } from "gl-matrix";

const CAMERA_FORWARD_CONVENTION_FLIP_AXIS = vec3.fromValues(0, 1, 0);

/**
 * Visionary's core camera stores W2C rotations with camera-local +Z as forward.
 * Timeline, export, Three.js, Blender, and Trajectory_gen use camera-local -Z.
 *
 * The two spaces differ by a 180 degree local rotation around Y. Position and
 * world up stay unchanged; only the camera local forward/back axis is swapped.
 */
function flipCameraForwardConventionW2C(rotation: quat): quat {
  const normalized = quat.normalize(quat.create(), rotation);
  const cameraToWorld = quat.invert(quat.create(), normalized);
  const forwardConventionFlip = quat.setAxisAngle(
    quat.create(),
    CAMERA_FORWARD_CONVENTION_FLIP_AXIS,
    Math.PI,
  );
  const convertedCameraToWorld = quat.multiply(quat.create(), cameraToWorld, forwardConventionFlip);
  const convertedWorldToCamera = quat.invert(quat.create(), convertedCameraToWorld);
  return quat.normalize(convertedWorldToCamera, convertedWorldToCamera);
}

export function coreCameraW2CToTimelineW2C(rotation: quat): quat {
  return flipCameraForwardConventionW2C(rotation);
}

export function timelineW2CToCoreCameraW2C(rotation: quat): quat {
  return flipCameraForwardConventionW2C(rotation);
}
