import test from "node:test";
import assert from "node:assert/strict";
import { vec3, quat } from "gl-matrix";

import { CameraController } from "../src/controls/controller.ts";
import { MIN_POLE_ANGLE, WORLD_UP, lookAtW2C } from "../src/controls/orbit.ts";
import { PerspectiveCamera, PerspectiveProjection } from "../src/camera/perspective.ts";

function projectOntoForwardPlane(vector: vec3, forward: vec3, fallback: vec3): vec3 {
  const projected = vec3.sub(
    vec3.create(),
    vector,
    vec3.scale(vec3.create(), forward, vec3.dot(vector, forward)),
  );
  if (vec3.length(projected) < 1e-6) {
    return vec3.normalize(vec3.create(), fallback);
  }
  return vec3.normalize(projected, projected);
}

function resolveOrbitRollDeg(rotationQ: quat): number {
  const c2w = quat.invert(quat.create(), rotationQ);
  const forward = vec3.transformQuat(vec3.create(), vec3.fromValues(0, 0, 1), c2w);
  const visualUp = vec3.transformQuat(vec3.create(), vec3.fromValues(0, 1, 0), c2w);
  const baseUp = projectOntoForwardPlane(WORLD_UP, forward, vec3.fromValues(1, 0, 0));
  const projectedVisualUp = projectOntoForwardPlane(visualUp, forward, baseUp);
  const cross = vec3.cross(vec3.create(), baseUp, projectedVisualUp);
  const dot = Math.max(-1, Math.min(1, vec3.dot(baseUp, projectedVisualUp)));
  return Math.atan2(vec3.dot(cross, forward), dot) * 180 / Math.PI;
}

function createOrbitCamera(): { controller: CameraController; camera: PerspectiveCamera } {
  const controller = new CameraController();
  const projection = new PerspectiveProjection([1280, 720], [Math.PI / 4, Math.PI / 6], 0.01, 1000);
  const position = vec3.fromValues(0, 0, 3);
  const forward = vec3.fromValues(0, 0, -1);
  const camera = new PerspectiveCamera(position, lookAtW2C(forward, WORLD_UP), projection);
  vec3.set(controller.center, 0, 0, 0);
  controller.resetUp(WORLD_UP);
  return { controller, camera };
}

function getOrbitForward(rotationQ: quat): vec3 {
  const c2w = quat.invert(quat.create(), rotationQ);
  return vec3.transformQuat(vec3.create(), vec3.fromValues(0, 0, 1), c2w);
}

test("orbit mouse drag keeps roll unchanged for an upright view", () => {
  const { controller, camera } = createOrbitCamera();
  const before = resolveOrbitRollDeg(camera.rotationQ);

  controller.leftMousePressed = true;
  controller.processMouse(180, 120);
  controller.update(camera, 1 / 60);

  const after = resolveOrbitRollDeg(camera.rotationQ);
  assert.ok(Math.abs(before) < 1e-4, `expected initial roll ~0, got ${before}`);
  assert.ok(Math.abs(after - before) < 1e-3, `expected mouse drag to preserve roll, got ${before} -> ${after}`);
});

test("orbit keyboard roll changes roll, then mouse drag preserves that roll", () => {
  const { controller, camera } = createOrbitCamera();

  controller.processKeyboard("KeyR", true);
  controller.update(camera, 0.25);
  controller.processKeyboard("KeyR", false);
  const rolled = resolveOrbitRollDeg(camera.rotationQ);

  controller.leftMousePressed = true;
  controller.processMouse(140, -90);
  controller.update(camera, 1 / 60);
  const afterDrag = resolveOrbitRollDeg(camera.rotationQ);

  assert.ok(Math.abs(rolled) > 1, `expected keyboard roll to change roll, got ${rolled}`);
  assert.ok(Math.abs(afterDrag - rolled) < 1e-3, `expected mouse drag to preserve keyboard roll, got ${rolled} -> ${afterDrag}`);
});

test("orbit pitch stays away from the world-up pole", () => {
  const { controller, camera } = createOrbitCamera();

  controller.leftMousePressed = true;
  for (let i = 0; i < 240; i += 1) {
    controller.processMouse(0, -40);
    controller.update(camera, 1 / 60);
  }

  const forward = vec3.normalize(vec3.create(), getOrbitForward(camera.rotationQ));
  const angleToNearestPole = Math.acos(Math.max(-1, Math.min(1, Math.abs(vec3.dot(forward, WORLD_UP)))));
  assert.ok(
    angleToNearestPole >= MIN_POLE_ANGLE - 1e-3,
    `expected orbit pitch to stay at least ${MIN_POLE_ANGLE}rad from the nearest pole, got ${angleToNearestPole}`,
  );
});

test("orbit near the top pole does not explode into a fast spin from residual pitch input", () => {
  const { controller, camera } = createOrbitCamera();

  controller.leftMousePressed = true;
  for (let i = 0; i < 220; i += 1) {
    controller.processMouse(0, -40);
    controller.update(camera, 1 / 60);
  }

  const before = vec3.normalize(vec3.create(), getOrbitForward(camera.rotationQ));
  controller.processMouse(2, 0);
  controller.update(camera, 1 / 60);
  const after = vec3.normalize(vec3.create(), getOrbitForward(camera.rotationQ));

  const angleDeltaDeg = Math.acos(Math.max(-1, Math.min(1, vec3.dot(before, after)))) * 180 / Math.PI;
  assert.ok(
    angleDeltaDeg < 1,
    `expected tiny horizontal drag near top pole to stay stable, got ${angleDeltaDeg}deg forward jump`,
  );
});

test("orbit near the top pole keeps roll at zero during horizontal drag", () => {
  const { controller, camera } = createOrbitCamera();

  controller.leftMousePressed = true;
  for (let i = 0; i < 220; i += 1) {
    controller.processMouse(0, -40);
    controller.update(camera, 1 / 60);
  }

  controller.processMouse(2, 0);
  controller.update(camera, 1 / 60);
  const rollDeg = resolveOrbitRollDeg(camera.rotationQ);

  assert.ok(
    Math.abs(rollDeg) < 0.5,
    `expected near-pole horizontal drag to stay upright, got ${rollDeg}deg roll`,
  );
});
