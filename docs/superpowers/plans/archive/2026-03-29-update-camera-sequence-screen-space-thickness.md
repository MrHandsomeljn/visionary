# 2026-03-29-update-camera-sequence-screen-space-thickness 实施计划

> **面向 AI 代理的工作者：** 该文档由 `openspec/` 迁移而来，用于在 `docs/superpowers/plans/` 下继续维护。步骤使用复选框（`- [ ]` / `- [x]`）语法跟踪状态。

**目标：** 见下方「提案」章节。

**架构：** 见下方「规格增量」和「任务」章节。

**技术栈：** Visionary Editor、`public/editor.js`、`src/editor/editor-app.ts`、Three.js / WebGPU。

---

## 状态

- 迁移来源：`openspec/changes/archive/2026-03-29-update-camera-sequence-screen-space-thickness`
- 当前状态：已归档
- 迁移日期：2026-03-29

## 提案

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
- `openspec/changes/update-camera-sequence-screen-space-thickness/specs/editor-camera-visualization/spec-delta.md`

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

## 任务

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

## 规格增量

### editor-camera-visualization

## ADDED Requirements

### Requirement: Screen-Space Constant Camera Sequence Thickness
WHEN the editor renders camera sequence frustums or trajectory lines,
the system SHALL keep their apparent line thickness approximately constant in screen space across normal viewing distances.

#### Scenario: Near and far views keep similar apparent thickness
GIVEN the editor camera views the same camera-sequence helper from a near position and from a far position
WHEN the helper remains visible in both views
THEN the helper edges and path lines retain approximately the same apparent pixel thickness
AND the helper does not become disproportionately thick only because the view is closer

#### Scenario: Scene scale does not control helper thickness
GIVEN two scenes contain the same camera-sequence helper at different world scales
WHEN the editor renders each scene in the viewport
THEN the helper thickness is determined primarily by screen-space rendering behavior
AND not by the scene's world-space scale alone

### Requirement: Camera Sequence Spatial Alignment Preservation
WHEN the editor changes camera-sequence helper rendering to a screen-space-stable representation,
the system SHALL preserve the current world-space pose, orientation, and timing alignment of the helper.

#### Scenario: Frustum corners remain aligned to keyframe pose
GIVEN a keyframe pose is already visualized by the editor
WHEN the screen-space-stable helper is rendered
THEN the helper still represents the same keyframe position and orientation
AND changing thickness behavior does not move the represented camera pose

#### Scenario: Timeline updates keep helper tracking intact
GIVEN the timeline updates the current camera-sequence visualization
WHEN the helper is refreshed after timeline or selection changes
THEN the helper remains aligned with the same keyframe data as before
AND only its thickness behavior changes

### Requirement: Camera Sequence Visualization Compatibility
WHEN the editor uses the screen-space-stable camera helper,
the system SHALL preserve existing camera-sequence visibility and emphasis behavior.

#### Scenario: Selected frame emphasis remains visible
GIVEN one keyframe is currently selected in the editor
WHEN the camera sequence helper is rendered
THEN the selected frame remains visually distinguishable from unselected frames
AND the distinction remains visible with the new thickness implementation

#### Scenario: Visibility toggle still controls helper rendering
GIVEN camera-sequence visualization is currently hidden
WHEN the user re-enables camera-sequence visualization
THEN the helper reappears using the screen-space-stable thickness behavior
AND hiding the helper still suppresses its rendering

