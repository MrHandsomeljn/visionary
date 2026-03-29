# 2026-03-29-expand-camera-interpolation-modes 实施计划

> **面向 AI 代理的工作者：** 该文档由 `openspec/` 迁移而来，用于在 `docs/superpowers/plans/` 下继续维护。步骤使用复选框（`- [ ]` / `- [x]`）语法跟踪状态。

**目标：** 见下方「提案」章节。

**架构：** 见下方「规格增量」和「任务」章节。

**技术栈：** Visionary Editor、`public/editor.js`、`src/editor/editor-app.ts`、Three.js / WebGPU。

---

## 状态

- 迁移来源：`openspec/changes/archive/2026-03-29-expand-camera-interpolation-modes`
- 当前状态：已归档
- 迁移日期：2026-03-29

## 提案

# Proposal: Expand Camera Interpolation Modes With Parameter Control

## Why

The initial camera interpolation selector proved that mode-based interpolation switching is useful, but the first nonlinear option is not sufficient for real camera work by itself. In practice, different shots need different behavior: some only need smoother rotation, while others need controllable path curvature or eased motion timing. A single nonlinear mode cannot cover these distinct needs cleanly.

**Current state**:
- The timeline exposes `linear` and `squad` only.
- `Squad` is not a complete answer for camera path design because quaternion smoothing is most suitable for orientation, not arbitrary path shaping.
- There is no per-mode parameter control in the header, so users cannot tune curvature or easing strength.

**Desired state**:
- The timeline should offer multiple interpolation modes suited to different camera authoring intents.
- Modes that support tuning should expose a compact parameter control immediately to the right of the interpolation selector.
- The runtime, path visualization, export evaluation, and scene persistence must all remain mode-consistent.

## What Changes

- Add one or two additional working interpolation modes beyond `linear` and the initial `squad` option.
- Re-scope `squad` to the use case it fits best: smoothing rotation while keeping positional motion stable.
- Add at least one path-oriented interpolation mode with a user-adjustable curve parameter, such as Catmull-Rom/Hermite tension.
- Add an optional eased-timing style mode if it can be implemented cleanly within the same interpolation entry point.
- Place a compact parameter control directly to the right of the interpolation selector and update it dynamically based on the active mode.

## Initial Expanded Mode Design

The implementation target is:

- **`linear`**: exact baseline behavior.
- **`squad`**: smooth quaternion rotation with stable linear position.
- **`catmull`**: smooth camera path interpolation for position with a tension parameter that controls how strongly the curve bends between keyframes.
- **`ease`**: linear spatial path with nonlinear time remapping controlled by a strength parameter.

Parameter control behavior:
- Hidden or disabled for modes that do not use an extra parameter.
- Visible for modes that need tuning.
- Mode-specific label and range, while reusing one compact UI slot.

## Impact

### Affected Specifications
- `openspec/changes/expand-camera-interpolation-modes/specs/editor-camera-timeline/spec-delta.md`

### Affected Code
- `public/editor.html` timeline header controls
- `public/editor.css` interpolation control styling
- `public/editor.js` interpolation mode registry, parameter state, evaluation logic, trajectory sampling, and scene persistence

### User Impact
- Users can choose a mode that matches the shot: strict linear, rotation smoothing, path smoothing, or eased motion.
- Users can tune curve behavior from the header without opening a separate settings panel.
- Camera helper paths better reflect what playback will actually do.

### API Changes
- Scene timeline serialization will add interpolation parameter metadata in addition to interpolation mode.

### Migration Required
- [ ] Database migration
- [ ] API version bump
- [ ] User communication needed
- [x] Documentation updates

## Risks

- More modes increase the chance of inconsistency unless all evaluation paths share the same interpolation entry point.
- Path-smoothing modes can still overshoot if their parameterization is not constrained.
- Dynamic parameter UI must remain understandable and not appear active for modes that ignore it.

## 任务

# Implementation Tasks

1. [x] Add a new OpenSpec-backed interpolation expansion change and define the supported working modes plus parameter-control behavior.
Validation: proposal, tasks, and spec delta describe mode selection and parameter control clearly.

2. [x] Extend the timeline header UI with a reusable parameter control placed to the right of the interpolation selector.
Validation: the header shows the control in the requested location, and the control updates its label/range/visibility according to the selected mode.

3. [x] Refactor interpolation evaluation so each mode is implemented through one shared mode-aware camera interpolation entry point.
Validation: playback, scrubbing, export-time evaluation, and helper sampling all use the same mode dispatch.

4. [x] Re-scope `squad` to smooth rotation while keeping position stable, and add at least one path-oriented mode plus one timing-oriented or additional path mode.
Validation: users can switch between multiple distinct behaviors, and each mode produces visibly different but stable motion.

5. [x] Persist interpolation mode and parameter values in scene save/load.
Validation: saving and reloading restores the same interpolation mode and parameter setting.

6. [x] Run focused regression verification for all shipped modes, parameter changes, single-keyframe, two-keyframe, multi-keyframe, scrub, loop playback, and manual interruption cases.
Validation: controls remain deterministic and mode/parameter changes do not break timeline behavior.

## 规格增量

### editor-camera-timeline

## MODIFIED Requirements

### Requirement: Timeline Playback Controls
WHEN a user previews camera motion,
the system SHALL play back interpolated camera movement across the timeline using the active camera interpolation mode and its active parameter state.

#### Scenario: Mode-specific playback changes camera behavior
GIVEN the timeline offers multiple interpolation modes
WHEN the user changes from one working mode to another
THEN the playback behavior changes according to the selected mode
AND repeated playback at the same timeline time remains deterministic within that mode

#### Scenario: Parameter changes affect tunable modes
GIVEN the selected interpolation mode exposes a tuning parameter
WHEN the user changes the interpolation parameter
THEN the timeline playback updates to reflect the new parameter
AND the resulting helper path matches the updated evaluation behavior

### Requirement: Camera Sequence Visualization
WHEN a scene contains camera keyframes,
the system SHALL visualize the camera sequence inside the 3D scene using the active camera interpolation evaluation path and parameter state.

#### Scenario: Helper path follows the active mode and parameter
GIVEN the active interpolation mode or parameter changes path behavior
WHEN the camera sequence helper path is rendered
THEN the helper path reflects the same evaluated camera positions used during playback
AND the helper path updates when the user changes the mode or parameter

## ADDED Requirements

### Requirement: Expanded Camera Interpolation Mode Selector
WHEN the camera timeline header is visible,
the system SHALL expose multiple working camera interpolation modes suitable for different camera-authoring intents.

#### Scenario: Multiple working modes are available
GIVEN the user opens the interpolation selector
WHEN the selector options are displayed
THEN the selector includes `linear`
AND the selector includes `squad`
AND the selector includes at least one additional working interpolation mode

### Requirement: Interpolation Parameter Control
WHEN the selected interpolation mode supports tuning,
the system SHALL expose a compact parameter control immediately to the right of the interpolation selector.

#### Scenario: Tunable mode shows parameter control
GIVEN the selected interpolation mode uses a tuning parameter
WHEN the mode becomes active
THEN the parameter control is visible
AND the control label and range match that mode's parameter semantics

#### Scenario: Non-tunable mode hides or disables parameter control
GIVEN the selected interpolation mode does not use a tuning parameter
WHEN the mode becomes active
THEN the parameter control does not appear active for that mode
AND changing to that mode does not require the user to manage an irrelevant parameter

### Requirement: Camera Interpolation Scene Persistence
WHEN a scene using a selected camera interpolation mode is saved and later reloaded,
the system SHALL preserve both the interpolation mode and any active interpolation parameter needed to reproduce the same motion.

#### Scenario: Reload preserves mode and parameter
GIVEN a scene uses a tunable interpolation mode
WHEN the scene is saved and later reloaded
THEN the selected mode is restored
AND the saved interpolation parameter is restored
AND playback and helper visualization match the restored state

