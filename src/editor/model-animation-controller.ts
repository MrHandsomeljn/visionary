import * as THREE from "three/webgpu";

import { FBXModelWrapper } from "../models/fbx-model-wrapper";
import { GLTFModelWrapper } from "../models/gltf-model-wrapper";

export interface EditorMeshAnimationController {
  supportsAnimation(): boolean;
  getDuration(): number;
  isAnimationRunning(): boolean;
  isAnimationPaused(): boolean;
  getAnimationIsLoop(): boolean;
  setLoop(enabled: boolean): void;
  setAnimationSpeed(speed: number): void;
  getAnimationSpeed(): number;
  setAnimationTime(time: number): void;
  startAnimation(speed?: number): void;
  pauseAnimation(): void;
  resumeAnimation(): void;
  dispose(): void;
}

type EditorMeshAnimationModelLike = {
  gltfAnimation?: EditorMeshAnimationController;
  fbxAnimation?: EditorMeshAnimationController;
};

type CreateEditorMeshAnimationControllerOptions = {
  fileName: string;
  object3D: THREE.Object3D;
  animationClips?: THREE.AnimationClip[];
};

export function createEditorMeshAnimationController({
  fileName,
  object3D,
  animationClips = [],
}: CreateEditorMeshAnimationControllerOptions): EditorMeshAnimationController | null {
  if (!Array.isArray(animationClips) || animationClips.length === 0) return null;

  const lowerName = String(fileName || "").toLowerCase();
  if (lowerName.endsWith(".glb") || lowerName.endsWith(".gltf")) {
    return new GLTFModelWrapper(object3D, animationClips, {
      autoPlay: false,
      defaultSpeed: 1.0,
      loop: true,
    });
  }

  if (lowerName.endsWith(".fbx")) {
    return new FBXModelWrapper(object3D as THREE.Group, animationClips, {
      autoPlay: false,
      defaultSpeed: 1.0,
      loop: true,
    });
  }

  return null;
}

export function getEditorModelAnimationController(
  model: EditorMeshAnimationModelLike | null | undefined
): EditorMeshAnimationController | null {
  if (!model) return null;
  return model.gltfAnimation || model.fbxAnimation || null;
}
