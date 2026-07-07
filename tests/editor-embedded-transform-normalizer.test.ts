import test from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from 'three/webgpu';

import { normalizeEmbeddedMeshTranslation } from '../src/editor/embedded-transform-normalizer.ts';

const EPSILON = 1e-6;

function boxCenter(object: THREE.Object3D): THREE.Vector3 {
  object.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
}

function assertVectorClose(actual: THREE.Vector3, expected: THREE.Vector3, message: string): void {
  assert.ok(actual.distanceTo(expected) <= EPSILON, `${message}: actual=${actual.toArray()} expected=${expected.toArray()}`);
}

test('normalizes vertex-embedded GLB translation into the root object position', () => {
  const root = new THREE.Group();
  const geometry = new THREE.BoxGeometry(2, 2, 2);
  geometry.translate(4, 2, -3);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  root.add(mesh);

  const initialCenter = boxCenter(root);
  assertVectorClose(initialCenter, new THREE.Vector3(4, 2, -3), 'precondition center');

  const result = normalizeEmbeddedMeshTranslation(root);

  assert.equal(result.applied, true);
  assert.equal(result.meshCount, 1);
  assertVectorClose(root.position, new THREE.Vector3(4, 2, -3), 'root position should contain extracted translation');
  assertVectorClose(boxCenter(root), initialCenter, 'world-space visual center should remain stable after normalization');

  root.position.set(0, 0, 0);
  assertVectorClose(boxCenter(root), new THREE.Vector3(0, 0, 0), 'resetting position should move the object to the origin');
});

test('normalizes child-transform-embedded GLB translation into the root object position', () => {
  const root = new THREE.Group();
  const child = new THREE.Group();
  child.position.set(-2.5, 1.25, 6);
  child.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
  root.add(child);

  const initialCenter = boxCenter(root);
  assertVectorClose(initialCenter, new THREE.Vector3(-2.5, 1.25, 6), 'precondition embedded child center');

  const result = normalizeEmbeddedMeshTranslation(root);

  assert.equal(result.applied, true);
  assertVectorClose(root.position, new THREE.Vector3(-2.5, 1.25, 6), 'root position should contain extracted child transform');
  assertVectorClose(boxCenter(root), initialCenter, 'world-space bounds should stay stable after child-transform normalization');

  root.position.set(0, 0, 0);
  assertVectorClose(boxCenter(root), new THREE.Vector3(0, 0, 0), 'resetting normalized child-transform object should move it to the origin');
});
