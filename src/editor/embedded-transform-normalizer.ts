import * as THREE from "three/webgpu";

const DEFAULT_EPSILON = 1e-6;

export type EmbeddedTransformNormalizationVector = {
  x: number;
  y: number;
  z: number;
};

export type EmbeddedTransformNormalizationResult = {
  applied: boolean;
  offset: EmbeddedTransformNormalizationVector;
  position: EmbeddedTransformNormalizationVector;
  center: EmbeddedTransformNormalizationVector;
  meshCount: number;
};

function vectorToRecord(vector: THREE.Vector3): EmbeddedTransformNormalizationVector {
  return { x: vector.x, y: vector.y, z: vector.z };
}

function zeroResult(meshCount = 0): EmbeddedTransformNormalizationResult {
  const zero = { x: 0, y: 0, z: 0 };
  return { applied: false, offset: zero, position: zero, center: zero, meshCount };
}

function isFiniteVector3(vector: THREE.Vector3): boolean {
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}

function isMeshWithPositionGeometry(object: THREE.Object3D): object is THREE.Mesh {
  const mesh = object as THREE.Mesh;
  const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
  return Boolean(
    mesh &&
    (mesh as any).isMesh &&
    geometry?.attributes?.position &&
    typeof geometry.clone === "function"
  );
}

function worldVectorToLocalVector(object: THREE.Object3D, vectorWorld: THREE.Vector3): THREE.Vector3 {
  const localOrigin = object.worldToLocal(new THREE.Vector3(0, 0, 0));
  const localTarget = object.worldToLocal(vectorWorld.clone());
  return localTarget.sub(localOrigin);
}

function translateClonedGeometry(mesh: THREE.Mesh, deltaLocal: THREE.Vector3): boolean {
  const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
  if (!geometry?.attributes?.position) return false;
  const nextGeometry = geometry.clone();
  nextGeometry.translate(deltaLocal.x, deltaLocal.y, deltaLocal.z);
  nextGeometry.computeBoundingBox();
  nextGeometry.computeBoundingSphere();
  mesh.geometry = nextGeometry;
  return true;
}

/**
 * Extracts a root-level translation from meshes whose placement is baked into
 * vertices or child transforms. The rendered world-space bounds stay unchanged,
 * but resetting root.position to zero moves the object back to the origin.
 */
export function normalizeEmbeddedMeshTranslation(
  root: THREE.Object3D,
  options: { epsilon?: number } = {}
): EmbeddedTransformNormalizationResult {
  if (!root) return zeroResult();

  const epsilon = Math.max(0, Number(options.epsilon ?? DEFAULT_EPSILON) || DEFAULT_EPSILON);
  root.updateWorldMatrix(true, true);

  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (isMeshWithPositionGeometry(object)) {
      meshes.push(object);
    }
  });
  if (meshes.length <= 0) return zeroResult();

  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return zeroResult(meshes.length);

  const centerWorld = box.getCenter(new THREE.Vector3());
  if (!isFiniteVector3(centerWorld)) return zeroResult(meshes.length);

  const oldRootWorldPosition = root.getWorldPosition(new THREE.Vector3());
  const offsetWorld = centerWorld.clone().sub(oldRootWorldPosition);
  if (!isFiniteVector3(offsetWorld) || offsetWorld.length() <= epsilon) {
    return {
      applied: false,
      offset: vectorToRecord(offsetWorld),
      position: vectorToRecord(root.position),
      center: vectorToRecord(centerWorld),
      meshCount: meshes.length,
    };
  }

  const oldRootPosition = root.position.clone();
  const nextRootPosition = root.parent
    ? root.parent.worldToLocal(centerWorld.clone())
    : centerWorld.clone();
  if (!isFiniteVector3(nextRootPosition)) return zeroResult(meshes.length);

  root.position.copy(nextRootPosition);
  root.updateMatrix();
  root.updateWorldMatrix(true, true);

  const inverseOffsetWorld = offsetWorld.clone().negate();
  let adjustedMeshes = 0;
  for (const mesh of meshes) {
    const deltaLocal = worldVectorToLocalVector(mesh, inverseOffsetWorld);
    if (!isFiniteVector3(deltaLocal)) continue;
    if (translateClonedGeometry(mesh, deltaLocal)) {
      adjustedMeshes++;
    }
  }

  if (adjustedMeshes <= 0) {
    root.position.copy(oldRootPosition);
    root.updateMatrix();
    root.updateWorldMatrix(true, true);
    return zeroResult(meshes.length);
  }

  root.updateWorldMatrix(true, true);
  return {
    applied: true,
    offset: vectorToRecord(offsetWorld),
    position: vectorToRecord(root.position),
    center: vectorToRecord(centerWorld),
    meshCount: adjustedMeshes,
  };
}
