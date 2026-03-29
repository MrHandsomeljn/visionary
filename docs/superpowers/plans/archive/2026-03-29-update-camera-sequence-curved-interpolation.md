# 2026-03-29-update-camera-sequence-curved-interpolation 实施计划

> **面向 AI 代理的工作者：** 该文档由 `openspec/` 迁移而来，用于在 `docs/superpowers/plans/` 下继续维护。步骤使用复选框（`- [ ]` / `- [x]`）语法跟踪状态。

**目标：** 见下方「提案」章节。

**架构：** 见下方「规格增量」和「任务」章节。

**技术栈：** Visionary Editor、`public/editor.js`、`src/editor/editor-app.ts`、Three.js / WebGPU。

---

## 状态

- 迁移来源：`openspec/changes/archive/2026-03-29-update-camera-sequence-curved-interpolation`
- 当前状态：已归档
- 迁移日期：2026-03-29

## 提案

# Proposal: Add Camera Interpolation Mode Selector With Initial Squad Support

## Why

The current camera timeline preview has no interpolation-mode selector and always uses the built-in linear path: position and FOV are interpolated linearly and rotation uses direct quaternion slerp between adjacent keyframes. This produces motion that is technically correct but visually rigid, and it gives users no way to opt into smoother alternatives.

**Current state**:
- The timeline offers only one implicit interpolation behavior.
- Position and FOV use straight linear interpolation per segment.
- Rotation uses direct slerp between adjacent keyframes.
- Scene save/load does not persist a camera interpolation mode because no mode is exposed.

**Desired state**:
- Users should be able to choose a camera interpolation mode directly from the timeline header.
- The first shipped nonlinear option should be `squad`, while preserving `linear` as the baseline mode.
- The UI should leave room for future interpolation modes without forcing those future modes to be implemented now.
- Timeline playback, scrubbing, visualization sampling, export, and scene save/load should all respect the chosen mode.

## What Changes

- Add an interpolation-mode selector beside the existing camera-sequence visibility control.
- Expose `linear` and `squad` as working options and reserve UI space for future modes.
- Implement initial `squad`-based camera interpolation while keeping `linear` as the default and fallback behavior.
- Route camera playback, scrubbing, sampled path generation, and scene persistence through the active interpolation mode.

## Initial Mode Design

The initial implementation scope is:

- **`linear` mode**: preserve the current behavior as the deterministic baseline.
- **`squad` mode**: use spherical quadrangle interpolation for quaternion rotation, while keeping the rest of the timeline evaluation path mode-aware and deterministic.
- **Future-ready selector**: structure the mode list so additional methods such as Bezier or Catmull-Rom variants can be added later without redesigning the timeline header.

This keeps the first release of interpolation choice small enough to verify, while still shipping a real nonlinear option that users can compare against the baseline.

## Impact

### Affected Specifications
- `openspec/changes/update-camera-sequence-curved-interpolation/specs/editor-camera-timeline/spec-delta.md`

### Affected Code
- `public/editor.html` timeline header controls
- `public/editor.css` timeline header control styling
- `public/editor.js` interpolation mode state, timeline interpolation, sampled path generation, and scene save/load state

### User Impact
- Users can explicitly switch between the original linear interpolation and a smoother squad-based mode.
- Existing workflows remain stable because `linear` remains available and can stay the default.
- Future interpolation methods can be added to the same selector without moving controls again.

### API Changes
- No external API break is required.
- Scene timeline serialization will gain an interpolation-mode field.

### Migration Required
- [ ] Database migration
- [ ] API version bump
- [ ] User communication needed
- [x] Documentation updates

## Timeline Estimate

Small to medium. The change is localized to the editor camera timeline and header UI, but it touches playback, scrubbing, sampled path generation, export behavior, and persistence.

## Risks

- Squad control-point generation must remain numerically stable for short or nearly identical quaternion segments.
- Two-keyframe or degenerate segments must fall back cleanly to linear behavior.
- The selected interpolation mode must be applied consistently in playback, scrubbing, trajectory sampling, export, and save/load paths.

## 任务

# Implementation Tasks

1. [x] Add a timeline-header interpolation selector beside the camera-sequence visibility control and wire it to editor state with `linear` as the default mode.
Validation: the user can see and change the interpolation mode from the timeline header, and the current mode is stored in runtime state.

2. [x] Refactor camera timeline evaluation into a mode-aware interpolation entry point that preserves the existing `linear` behavior exactly.
Validation: when `linear` is selected, playback and scrubbing match the previous interpolation behavior.

3. [x] Implement initial `squad` camera interpolation with safe fallback for degenerate or two-keyframe cases.
Validation: when `squad` is selected, camera rotation is evaluated through squad where valid, and the editor falls back to linear behavior in cases that cannot support stable squad evaluation.

4. [x] Apply the active interpolation mode consistently to sampled camera trajectory generation, export-time camera evaluation, and scene save/load state.
Validation: visualization sampling, preview playback, and restored scenes all use the same interpolation mode.

5. [x] Run focused regression verification for linear mode, squad mode, single-keyframe, two-keyframe, multi-keyframe, scrub, loop playback, and manual interruption cases.
Validation: the selector works, the new mode is deterministic, and existing timeline controls remain functional.

## 规格增量

### editor-camera-timeline

## MODIFIED Requirements

### Requirement: Timeline Playback Controls
WHEN a user previews camera motion,
the system SHALL play back interpolated camera movement across the timeline using the active camera interpolation mode.

#### Scenario: Play or pause camera preview
GIVEN at least one camera keyframe exists
WHEN the user starts timeline playback
THEN the system interpolates camera position, rotation, and FOV between keyframes
AND the system updates the current timeline frame and time display during playback

#### Scenario: Loop camera preview
GIVEN timeline playback reaches the end of the active duration
WHEN looping is enabled
THEN the system restarts playback from the beginning

#### Scenario: Manual camera interaction interrupts preview
GIVEN timeline playback is active
WHEN the user manually drags, scrolls, or uses camera keyboard controls
THEN the system pauses timeline playback

#### Scenario: Squad mode changes camera interpolation behavior
GIVEN the camera timeline interpolation mode is set to `squad`
WHEN the user previews the timeline
THEN the system evaluates camera motion with squad-based nonlinear rotation where valid
AND the system preserves deterministic playback for the selected timeline time

#### Scenario: Scrubbing remains deterministic under alternate interpolation
GIVEN the camera timeline uses a non-default interpolation mode
WHEN the user scrubs repeatedly to the same timeline time
THEN the system returns the same camera pose each time
AND playback uses the same evaluated pose for that timeline time

### Requirement: Camera Sequence Visualization
WHEN a scene contains camera keyframes,
the system SHALL visualize the camera sequence inside the 3D scene using the active camera interpolation evaluation path.

#### Scenario: Show camera sequence helpers
GIVEN one or more camera keyframes exist
WHEN the camera sequence visualization is enabled
THEN the system renders keyframe frustums, a trajectory path, and a current camera marker in the scene
AND the helper visibility can be toggled from the model list area

#### Scenario: Sampled helper path follows the active interpolation mode
GIVEN the active camera interpolation mode changes camera evaluation between keyframes
WHEN the camera sequence helper path is rendered
THEN the rendered path follows the same interpolation model used for camera playback
AND the helper path does not misrepresent the actual previewed trajectory

## ADDED Requirements

### Requirement: Camera Interpolation Mode Selector
WHEN the editor evaluates camera motion between keyframes,
the system SHALL expose a selectable interpolation mode to the user from the camera timeline header.

#### Scenario: User chooses a working interpolation mode
GIVEN the camera timeline header is visible
WHEN the user opens the interpolation selector
THEN the selector includes `linear`
AND the selector includes at least one nonlinear working mode

#### Scenario: Linear remains available as the baseline mode
GIVEN the user selects `linear`
WHEN the editor evaluates timeline camera motion
THEN the system uses the baseline linear interpolation behavior
AND the baseline mode remains available even after nonlinear modes are added

### Requirement: Initial Squad Interpolation Support
WHEN the user selects `squad` as the camera interpolation mode,
the system SHALL evaluate camera motion using squad where valid and safely fall back to linear behavior where squad is not stable or not applicable.

#### Scenario: Multi-keyframe squad interpolation is used when valid
GIVEN the timeline contains enough keyframe context to evaluate squad safely
WHEN the user selects `squad`
THEN the editor uses squad-based camera interpolation between keyframes
AND the resulting camera motion differs from the baseline linear mode

#### Scenario: Degenerate segments fall back safely
GIVEN the active segment does not provide stable squad evaluation
WHEN the user selects `squad`
THEN the editor falls back to the baseline linear interpolation for that segment
AND the camera preview remains valid instead of producing invalid rotation output

### Requirement: Camera Interpolation Scene Persistence
WHEN a scene using a selected camera interpolation mode is saved and later reloaded,
the system SHALL preserve the interpolation mode needed to reproduce the same camera motion.

#### Scenario: Reload preserves interpolation mode
GIVEN a scene has a non-default camera interpolation mode enabled
WHEN the scene is saved and later reloaded
THEN the timeline playback reproduces the same interpolation mode
AND the camera sequence helper visualization matches the restored interpolation state

