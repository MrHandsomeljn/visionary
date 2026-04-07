import test from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from 'three/webgpu';

import { FBXModelWrapper } from '../src/models/fbx-model-wrapper';
import { GLTFModelWrapper } from '../src/models/gltf-model-wrapper';
import {
  createEditorMeshAnimationController,
  getEditorModelAnimationController,
} from '../src/editor/model-animation-controller';

function createAnimationClip(name: string, duration: number): THREE.AnimationClip {
  return new THREE.AnimationClip(name, duration, []);
}

function createPositionXClip(name: string): THREE.AnimationClip {
  return new THREE.AnimationClip(name, 1, [
    new THREE.NumberKeyframeTrack('.position[x]', [0, 1], [0, 10]),
  ]);
}

test('FBXModelWrapper exposes the editor mesh-animation controller contract', () => {
  const object = new THREE.Group();
  const clips = [createAnimationClip('walk', 2.5)];
  const wrapper = new FBXModelWrapper(object, clips, { autoPlay: false, loop: true });

  assert.equal(wrapper.supportsAnimation(), true);
  assert.equal(wrapper.getDuration(), 2.5);
  assert.equal(wrapper.getAnimationIsLoop(), true);
  assert.equal(wrapper.isAnimationRunning(), false);
  assert.equal(wrapper.isAnimationPaused(), false);

  wrapper.setLoop(false);
  assert.equal(wrapper.getAnimationIsLoop(), false);

  wrapper.startAnimation(1.25);
  assert.equal(wrapper.isAnimationRunning(), true);
  assert.equal(wrapper.getAnimationSpeed(), 1.25);

  wrapper.pauseAnimation();
  assert.equal(wrapper.isAnimationPaused(), true);

  wrapper.resumeAnimation();
  assert.equal(wrapper.isAnimationRunning(), true);
  assert.equal(wrapper.isAnimationPaused(), false);
});

test('createEditorMeshAnimationController builds FBX animation controllers for animated FBX files', () => {
  const controller = createEditorMeshAnimationController({
    fileName: 'character.fbx',
    object3D: new THREE.Group(),
    animationClips: [createAnimationClip('idle', 1.5)],
  });

  assert.ok(controller);
  assert.equal(controller?.supportsAnimation(), true);
  assert.equal(controller?.getDuration(), 1.5);
});

test('getEditorModelAnimationController prefers FBX when GLTF is absent', () => {
  const fbxController = new FBXModelWrapper(new THREE.Group(), [createAnimationClip('run', 3)], {
    autoPlay: false,
  });
  const controller = getEditorModelAnimationController({
    gltfAnimation: undefined,
    fbxAnimation: fbxController,
  });

  assert.equal(controller, fbxController);
});

test('FBX timeline scrubbing updates pose even when autoPlay is disabled', () => {
  const gltfObject = new THREE.Group();
  const fbxObject = new THREE.Group();
  const clip = createPositionXClip('move-x');

  const gltfWrapper = new GLTFModelWrapper(gltfObject, [clip], { autoPlay: false });
  const fbxWrapper = new FBXModelWrapper(fbxObject, [clip], { autoPlay: false });

  gltfWrapper.setAnimationTime(0.5);
  fbxWrapper.setAnimationTime(0.5);

  assert.equal(gltfObject.position.x, 5);
  assert.equal(fbxObject.position.x, 5);
});
