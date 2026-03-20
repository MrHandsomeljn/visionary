# Implementation Tasks

1. [x] Audit the current camera sequence helper path in `src/editor/editor-app.ts` and isolate the frustum-edge and trajectory-segment creation points that currently depend on world-space cylinder radius.
Validation: the implementation notes identify the exact helper builders and the state they must preserve.

2. [x] Introduce a screen-space constant-thickness rendering path for camera frustum edges and trajectory segments without changing camera pose placement or visibility semantics.
Validation: the camera helper still appears at the same world positions, but its visible thickness no longer scales with distance.

3. [x] Keep the existing color semantics, selected-frame emphasis, and camera-sequence visibility toggle behavior compatible with the new rendering path.
Validation: selected and unselected helpers remain distinguishable, and hiding/showing the camera sequence still works.

4. [x] Ensure the new helper remains visually stable across viewport resize, sidebar resize, and camera movement.
Validation: resizing the viewport or moving the editor camera does not cause helper thickness drift or misalignment.

5. [x] Run focused regression verification for near-view, far-view, mixed-scene, and timeline-driven camera-sequence cases.
Validation: the helper remains readable near and far, coexists with scene content, and still tracks the same keyframe poses.
