import test from "node:test";
import assert from "node:assert/strict";
import { quat, vec3 } from "gl-matrix";

import {
  coreCameraW2CToTimelineW2C,
  timelineW2CToCoreCameraW2C,
} from "../src/camera/camera-pose-conventions.ts";
import { lookAtW2C, WORLD_UP } from "../src/controls/orbit.ts";

function cameraLocalAxisInWorld(rotationW2C: quat, axis: vec3): vec3 {
  const cameraToWorld = quat.invert(quat.create(), rotationW2C);
  const out = vec3.transformQuat(vec3.create(), axis, cameraToWorld);
  return vec3.normalize(out, out);
}

function assertSameDirection(actual: vec3, expected: vec3, message: string): void {
  const dot = vec3.dot(actual, expected);
  assert.ok(dot > 0.999999, `${message}: dot=${dot}`);
}

test("camera pose convention conversion preserves world forward and up", () => {
  const worldForward = vec3.normalize(vec3.create(), vec3.fromValues(1, -0.2, -2));
  const coreW2C = lookAtW2C(worldForward, WORLD_UP);
  const timelineW2C = coreCameraW2CToTimelineW2C(coreW2C);

  assertSameDirection(
    cameraLocalAxisInWorld(coreW2C, vec3.fromValues(0, 0, 1)),
    worldForward,
    "core local +Z should face the requested forward direction",
  );
  assertSameDirection(
    cameraLocalAxisInWorld(timelineW2C, vec3.fromValues(0, 0, -1)),
    worldForward,
    "timeline local -Z should face the same requested forward direction",
  );
  assertSameDirection(
    cameraLocalAxisInWorld(timelineW2C, vec3.fromValues(0, 1, 0)),
    cameraLocalAxisInWorld(coreW2C, vec3.fromValues(0, 1, 0)),
    "conversion should preserve visual up",
  );

  const roundTripped = timelineW2CToCoreCameraW2C(timelineW2C);
  assert.ok(Math.abs(quat.dot(coreW2C, roundTripped)) > 0.999999);
});
