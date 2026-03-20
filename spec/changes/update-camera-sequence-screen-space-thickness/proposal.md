# Proposal: Update Camera Sequence Visualization to Screen-Space Constant Thickness

## Why

The current camera keyframe visualization uses world-space cylinder geometry for frustum edges and trajectory segments. This makes the helper appear too thick when the camera is close and too thin when the camera is far away, which hurts readability and makes precise framing harder.

**Current state**:
- Camera sequence frustums and path segments are built from world-space meshes.
- Apparent line thickness changes with distance, perspective, and scene scale.
- The helper can visually dominate nearby views even when the underlying camera poses are correct.

**Desired state**:
- Camera sequence edges and path segments should keep a stable apparent thickness on screen across near and far viewing distances.
- The change should preserve existing camera pose positions, selected-frame highlighting, visibility toggles, and timeline behavior.
- The implementation should remain inside Visionary and its existing Three.js usage without modifying Three.js itself.

## What Changes

- Add a dedicated editor-camera-visualization proposal for screen-space constant-thickness camera helpers.
- Replace or wrap the current world-space line helper generation with a screen-space-stable rendering approach for frustum edges and trajectory segments.
- Preserve the current geometry semantics, colors, selected-frame emphasis, and visibility toggles while changing only the thickness behavior.
- Add targeted validation for near-view, far-view, mixed-scene, and resize behavior.

## Impact

### Affected Specifications
- `spec/changes/update-camera-sequence-screen-space-thickness/specs/editor-camera-visualization/spec-delta.md`

### Affected Code
- `src/editor/editor-app.ts` camera-sequence helper construction and update logic
- Potentially one new helper module under `src/editor/` or `src/models/` if a reusable screen-space line primitive is introduced

### User Impact
- Camera frustums and camera-path lines remain visually readable at different viewing distances.
- Users can inspect camera sequences without nearby helpers becoming disproportionately thick.

### API Changes
- No public API break is required.
- Internal helper construction may change from world-space cylinders to a screen-space-stable primitive.

### Migration Required
- [ ] Database migration
- [ ] API version bump
- [ ] User communication needed
- [x] Documentation updates

## Timeline Estimate

Small to medium. The behavior is localized to editor visualization, but the implementation must be careful not to break selection, visibility, resize handling, or the current camera pose alignment.

## Risks

- A screen-space implementation may need extra per-frame updates or viewport-size awareness.
- If implemented with a different Three.js primitive, depth ordering and occlusion behavior must be checked carefully so helpers still feel anchored in the scene.
- The helper must preserve current spatial alignment; only apparent thickness should change.
