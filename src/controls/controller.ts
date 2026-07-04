// Camera controller extracted from controller.ts

import { vec2, vec3, quat } from "gl-matrix";
import { PerspectiveCamera } from '../camera/perspective.ts';
import type { IController } from './base-controller.ts';
import { processKeyboardInput, processMouseInput, processScrollInput } from './input.ts';
import { 
  lookAtW2C, 
  calculateOrbitBasis, 
  applyDistanceScaling, 
  applyPanning, 
  applyRotation, 
  applyDecay,
  projectOntoPlaneNormed,
  WORLD_UP 
} from './orbit.ts';

type CamDebug = {
  pos: [number, number, number];
  center: [number, number, number];
  dist: number;
  forward_to_center: [number, number, number];
  forward_from_rot: [number, number, number];
  dot: number;
};

export class CameraController implements IController {
  center = vec3.fromValues(0, 0, 0);
  /** If provided, use as "global up reference"; otherwise use internal orbit up state */
  up: vec3 | null = null;

  amount = vec3.fromValues(0, 0, 0);   // Keyboard move vector: [strafe, lift, forward]
  shift  = vec2.fromValues(0, 0);      // Right-click pan (x=dy, y=-dx)
  rotation = vec3.fromValues(0, 0, 0); // yaw(x), pitch(y), roll(z)
  scroll = 0;
  speed: number;
  sensitivity: number;
  keyMoveSpeed: number;
  keyVerticalSpeed: number;
  keyYawSpeed: number;
  keyRollSpeed: number;

  leftMousePressed = false;
  rightMousePressed = false;
  altPressed = false;
  userInput = false;

  // --- Key: stable orbit up state ---
  private orbitUp = vec3.clone(WORLD_UP);
  private explicitRoll = 0;
  private keyYawLeftPressed = false;
  private keyYawRightPressed = false;
  private keyRollPressed = false;
  private shiftPressed = false;

  // Debug
  private debug = false;
  private debugEvery = 1 / 30;
  private _acc = 0;

  constructor(speed = 0.2, sensitivity = 0.1) {
    this.speed = speed; 
    this.sensitivity = sensitivity;
    // Keep keyboard navigation responsive in editor mode.
    this.keyMoveSpeed = 3.0;
    this.keyVerticalSpeed = 3.0;
    this.keyYawSpeed = 1.8;
    this.keyRollSpeed = 1.6;
  }

  private normalizeAngle(angle: number): number {
    if (!Number.isFinite(angle)) return 0;
    let normalized = angle;
    while (normalized <= -Math.PI) normalized += Math.PI * 2;
    while (normalized > Math.PI) normalized -= Math.PI * 2;
    return normalized;
  }

  private clearTransientInputState(): void {
    vec3.set(this.rotation, 0, 0, 0);
    vec2.set(this.shift, 0, 0);
    this.scroll = 0;
    this.leftMousePressed = false;
    this.rightMousePressed = false;
  }

  // Allow external reset of orbit up (e.g., when switching views)
  resetUp(u?: vec3) {
    this.orbitUp = vec3.normalize(vec3.create(), u ?? WORLD_UP);
    this.explicitRoll = 0;
    this.clearTransientInputState();
  }

  syncExternalPose(center: vec3, forward: vec3, visualUp: vec3, upReference: vec3 = WORLD_UP): void {
    const normalizedForward = vec3.length(forward) > 1e-6
      ? vec3.normalize(vec3.create(), forward)
      : vec3.fromValues(0, 0, -1);
    const normalizedUpReference = vec3.length(upReference) > 1e-6
      ? vec3.normalize(vec3.create(), upReference)
      : vec3.clone(WORLD_UP);
    const normalizedVisualUp = vec3.length(visualUp) > 1e-6
      ? vec3.normalize(vec3.create(), visualUp)
      : vec3.clone(normalizedUpReference);
    const fallbackUp = projectOntoPlaneNormed(
      normalizedVisualUp,
      normalizedForward,
      Math.abs(normalizedForward[1]) < 0.99 ? WORLD_UP : vec3.fromValues(1, 0, 0),
    );
    const stableUp = projectOntoPlaneNormed(normalizedUpReference, normalizedForward, fallbackUp);
    const projectedVisualUp = projectOntoPlaneNormed(normalizedVisualUp, normalizedForward, stableUp);
    const cross = vec3.cross(vec3.create(), stableUp, projectedVisualUp);
    const dot = Math.max(-1, Math.min(1, vec3.dot(stableUp, projectedVisualUp)));

    vec3.copy(this.center, center);
    vec3.copy(this.orbitUp, normalizedUpReference);
    this.explicitRoll = this.normalizeAngle(Math.atan2(vec3.dot(cross, normalizedForward), dot));
    this.clearTransientInputState();
  }

  processKeyboard(code: string, pressed: boolean): boolean {
    switch (code) {
      case "KeyQ":
        this.keyYawLeftPressed = pressed;
        this.userInput = true;
        return true;
      case "KeyE":
        this.keyYawRightPressed = pressed;
        this.userInput = true;
        return true;
      case "KeyR":
        this.keyRollPressed = pressed;
        this.userInput = true;
        return true;
      case "ShiftLeft":
      case "ShiftRight":
        this.shiftPressed = pressed;
        this.userInput = true;
        return true;
      case "AltLeft":
      case "AltRight":
        this.altPressed = pressed;
        this.userInput = true;
        return true;
      default:
        break;
    }

    const handled = processKeyboardInput(
      code,
      pressed,
      this.amount as unknown as Float32Array,
      this.rotation as unknown as Float32Array,
      this.sensitivity
    );
    this.userInput = handled;
    return handled;
  }

  processMouse(dx: number, dy: number) {
    const handled = processMouseInput(
      dx,
      dy,
      this.leftMousePressed,
      this.rightMousePressed,
      this.rotation as unknown as Float32Array,
      this.shift as unknown as Float32Array
    );
    this.userInput = handled;
  }

  processScroll(delta: number) { 
    this.scroll += processScrollInput(delta); 
    this.userInput = true; 
  }

  /** Equivalent to Rust's update_camera, but with stable orbitUp maintenance and pole/twist protection */
  update(cam: PerspectiveCamera, dt: number) {
    const dtSec = dt;

    // === 1) Orbit basis (from pos/center), and stabilize orbitUp ===
    // Use persistent orbit-up as default to avoid singular flips near poles.
    const upRef = this.up
      ? vec3.normalize(vec3.create(), this.up)
      : vec3.normalize(vec3.create(), this.orbitUp);
    if (this.up) {
      vec3.copy(this.orbitUp, upRef);
    }
    let { forward, right, yawAxis } = calculateOrbitBasis(cam.positionV, this.center, upRef);

    // === 2) Logarithmic scaling (along view line) ===
    const dist1 = applyDistanceScaling(cam.positionV, this.center, this.scroll, dtSec, this.speed);

    // === 3) Right-click panning ===
    const dist0 = Math.max(vec3.distance(cam.positionV, this.center), 1e-6);
    applyPanning(this.center, this.shift, right, yawAxis, dtSec, this.speed, dist0);
    
    // Update position along forward to new radius
    const pos = vec3.scale(vec3.create(), forward, -dist1); // pos = center - forward * dist
    vec3.add(cam.positionV, this.center, pos);

    // === 4) Rotation (yaw around current visual up, pitch around current visual right) ===
    let yaw   =  this.rotation[0] * dtSec * this.sensitivity;
    let pitch = -this.rotation[1] * dtSec * this.sensitivity;
    let rollDelta = 0;

    // Keyboard yaw: Q/E controls look-left/look-right.
    const keyYawInput = (this.keyYawRightPressed ? 1 : 0) - (this.keyYawLeftPressed ? 1 : 0);
    if (keyYawInput !== 0) {
      yaw += keyYawInput * this.keyYawSpeed * dtSec;
    }

    // Keyboard roll: R and Shift+R.
    if (this.keyRollPressed) {
      const rollDir = this.shiftPressed ? -1 : 1;
      rollDelta += rollDir * this.keyRollSpeed * dtSec;
    }

    const rotationResult = applyRotation(forward, right, yawAxis, upRef, yaw, pitch, 0);
    forward = rotationResult.forward;
    yawAxis = projectOntoPlaneNormed(upRef, forward, rotationResult.yawAxis);
    right = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), forward, yawAxis));
    this.explicitRoll = this.normalizeAngle(this.explicitRoll + rollDelta);

    // Keyboard translation (FPS-like): move camera and center together.
    if (this.amount[0] !== 0 || this.amount[1] !== 0 || this.amount[2] !== 0) {
      const move = vec3.create();
      vec3.scaleAndAdd(move, move, right, this.amount[0]);
      vec3.scaleAndAdd(move, move, WORLD_UP, this.amount[1]);
      vec3.scaleAndAdd(move, move, forward, this.amount[2]);

      const len = vec3.length(move);
      if (len > 1e-6) {
        vec3.scale(move, move, 1 / len);
        const base = this.amount[1] !== 0 ? this.keyVerticalSpeed : this.keyMoveSpeed;
        vec3.scale(move, move, base * dtSec);
        vec3.add(this.center, this.center, move);
      }
    }

    // Update position: pos = center - forward * dist1
    vec3.add(cam.positionV, this.center, vec3.scale(vec3.create(), forward, -dist1));

    // === 5) Rebuild world->camera from stable orbit-up plus explicit keyboard roll ===
    let visualUp = vec3.clone(yawAxis);
    if (Math.abs(this.explicitRoll) > 1e-6) {
      const qRoll = quat.setAxisAngle(quat.create(), forward, this.explicitRoll);
      visualUp = vec3.transformQuat(vec3.create(), visualUp, qRoll);
    }
    cam.rotationQ = lookAtW2C(forward, visualUp);

    // === 6) Decay (consistent with Rust) ===
    const rotationForDecay = vec3.clone(this.rotation);
    if (this.leftMousePressed) {
      // Mouse orbit should follow the current drag directly instead of accumulating
      // cross-frame pitch/yaw momentum. Near the top pole that stale momentum can turn
      // a tiny horizontal drag into a sudden multi-degree spin.
      rotationForDecay[0] = 0;
      rotationForDecay[1] = 0;
    }
    if (rotationResult.pitchAppliedRatio < 0.999) {
      // Pole protection clipped this frame's pitch. Drop the blocked pitch residue so it
      // cannot accumulate and explode into a sudden spin on the next small drag.
      rotationForDecay[1] = 0;
    }
    const decayResult = applyDecay(rotationForDecay, this.shift, this.scroll, dtSec);
    vec3.copy(this.rotation, decayResult.rotation);
    vec2.copy(this.shift, decayResult.shift);
    this.scroll = decayResult.scroll;
    this.userInput = false;

    // === 7) Debug (should be close to 1) ===
    this._acc += dtSec;
    if (this.debug && this._acc >= this.debugEvery) {
      this._acc = 0;
      // Use rotationQ to derive +Z as forward_from_rot
      const cw = quat.invert(quat.create(), cam.rotationQ);
      const fFromRot = vec3.transformQuat(vec3.create(), vec3.fromValues(0,0,1), cw);
      console.log("[CameraDebug]", {
        pos: [cam.positionV[0], cam.positionV[1], cam.positionV[2]],
        center: [this.center[0], this.center[1], this.center[2]],
        dist: vec3.distance(cam.positionV, this.center),
        forward_to_center: [forward[0], forward[1], forward[2]],
        forward_from_rot: [fFromRot[0], fFromRot[1], fFromRot[2]],
        dot: vec3.dot(fFromRot, forward),
      } as CamDebug);
    }
  }

  // Implement interface methods
  getControllerType(): 'orbit' | 'fps' {
    return 'orbit';
  }

  getExplicitRollDegrees(): number {
    return this.explicitRoll * 180 / Math.PI;
  }

  // Optional: Add resetOrientation for compatibility
  resetOrientation(): void {
    // Reset to default view for orbit controller
    this.center = vec3.fromValues(0, 0, 0);
    this.rotation = vec3.fromValues(0, 0, 0);
    this.shift = vec2.fromValues(0, 0);
    this.scroll = 0;
    this.amount = vec3.fromValues(0, 0, 0);
    this.orbitUp = vec3.clone(WORLD_UP);
    this.explicitRoll = 0;
    this.keyYawLeftPressed = false;
    this.keyYawRightPressed = false;
    this.keyRollPressed = false;
    this.shiftPressed = false;
    this.altPressed = false;
  }
}
