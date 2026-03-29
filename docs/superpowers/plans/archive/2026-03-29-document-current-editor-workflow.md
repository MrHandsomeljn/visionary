# 2026-03-29-document-current-editor-workflow 实施计划

> **面向 AI 代理的工作者：** 该文档由 `openspec/` 迁移而来，用于在 `docs/superpowers/plans/` 下继续维护。步骤使用复选框（`- [ ]` / `- [x]`）语法跟踪状态。

**目标：** 见下方「提案」章节。

**架构：** 见下方「规格增量」和「任务」章节。

**技术栈：** Visionary Editor、`public/editor.js`、`src/editor/editor-app.ts`、Three.js / WebGPU。

---

## 状态

- 迁移来源：`openspec/changes/archive/2026-03-29-document-current-editor-workflow`
- 当前状态：已归档
- 迁移日期：2026-03-29

## 提案

# Proposal: Document Current Editor Workflow

## Why

The current repository has no tracked OpenSpec baseline for the editor, even though `MrHandsomeljn` and `10086mea` have already shipped a substantial subset of the intended filmmaking workflow. The shipped code now supports scene assembly, model transforms, ONNX animation controls, camera keyframing, timeline playback, and rough-cut image/video export, but these behaviors only exist in code and release notes.

Without a formal spec baseline, future work on AI generation, scene refinement, and handoff into later pipeline stages will drift against the current editor behavior.

## What Changes

- Add baseline specs for the implemented editor subset.
- Capture the scene authoring workflow already present in the editor UI and `EditorApp` API.
- Capture the per-model animation and timeline behaviors delivered across `v0.05` to `v0.0.9`.
- Capture the rough-cut export workflow for image/video, including render modes and timeline-driven playback.

## Impact

- Affected areas: editor UI, `public/editor.js`, `src/editor/editor-app.ts`, export pipeline.
- Affected users: contributors extending the editor toward the larger filmmaking workflow.
- This proposal documents existing shipped behavior; it does not require product behavior changes.

## 任务

# Implementation Tasks

1. Inventory the implemented editor behaviors from the commits by `MrHandsomeljn` and `10086mea`.
2. Create baseline spec deltas for scene authoring and scene persistence.
3. Create baseline spec deltas for model transforms and per-model ONNX animation control.
4. Create baseline spec deltas for camera keyframes, timeline playback, and timeline speed/FPS control.
5. Create baseline spec deltas for rough-cut image and video export.
6. Review the resulting capability split to ensure it reflects the current codebase without adding unimplemented behavior.

## 规格增量

### editor-camera-timeline

## ADDED Requirements

### Requirement: Camera Keyframe Timeline
WHEN a user authors camera motion in the editor,
the system SHALL support frame-based camera keyframes on a shared timeline.

#### Scenario: Add or overwrite a camera keyframe
GIVEN the editor timeline is available
WHEN the user adds a keyframe at the current frame
THEN the system stores the current camera pose and FOV at that frame
AND the keyframe appears on the timeline

#### Scenario: Remove a camera keyframe
GIVEN at least one keyframe exists
WHEN the user removes the selected keyframe
THEN the system deletes that keyframe from the timeline
AND the timeline updates its visible markers

### Requirement: Timeline Playback Controls
WHEN a user previews camera motion,
the system SHALL play back interpolated camera movement across the timeline.

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

### Requirement: Timeline Rate and Extent Controls
WHEN a user edits timeline playback settings,
the system SHALL support global FPS selection, global playback speed selection, and automatic duration extension for dynamic content.

#### Scenario: Change timeline FPS or global speed
GIVEN the timeline is visible
WHEN the user changes FPS or playback speed
THEN the system uses the updated FPS for frame-domain timeline behavior
AND the system uses the updated speed multiplier during timeline playback

#### Scenario: Dynamic ONNX content extends timeline duration
GIVEN the scene contains dynamic ONNX models with longer animation windows
WHEN those model durations exceed the default timeline length
THEN the system extends the editable timeline duration to cover the longest active animation window

### Requirement: Camera Sequence Visualization
WHEN a scene contains camera keyframes,
the system SHALL visualize the camera sequence inside the 3D scene.

#### Scenario: Show camera sequence helpers
GIVEN one or more camera keyframes exist
WHEN the camera sequence visualization is enabled
THEN the system renders keyframe frustums, a trajectory path, and a current camera marker in the scene
AND the helper visibility can be toggled from the model list area

### editor-model-animation

## ADDED Requirements

### Requirement: Editable Model Transform Controls
WHEN a user selects a model in the editor,
the system SHALL provide direct transform controls for position, rotation, and scale.

#### Scenario: Edit selected model transform
GIVEN a model is selected in the editor
WHEN the user updates position, rotation, or scale values
THEN the system updates the selected model transform in the viewport
AND the system keeps the model settings panel synchronized with the active model state

#### Scenario: Reset selected model transform
GIVEN a model is selected in the editor
WHEN the user runs the reset transform action
THEN the system restores the model transform to its default editable state

### Requirement: Per-model Visibility Management
WHEN a scene contains editor models,
the system SHALL allow each model's visibility to be toggled from the model list.

#### Scenario: Toggle model visibility
GIVEN one or more models are listed in the scene
WHEN the user toggles a model visibility control
THEN the system updates the model visibility in the viewport
AND the model list reflects the new visible state

### Requirement: Per-model ONNX Animation Controls
WHEN a selected model supports ONNX animation playback,
the system SHALL provide play or pause, loop, speed, and time-bound controls for that model.

#### Scenario: Control ONNX animation playback
GIVEN a selected model supports ONNX animation
WHEN the user changes playback state, loop state, or playback speed
THEN the system applies those controls only to the selected model
AND the editor keeps the animation control UI synchronized with the model state

#### Scenario: Adjust animation time bounds from the timeline
GIVEN a selected dynamic ONNX model appears on the timeline
WHEN the user adjusts the model track bounds
THEN the system updates the model's animation start and end times
AND the global scene playback uses the updated time window

### editor-rough-cut-export

## ADDED Requirements

### Requirement: Rough-cut Render Mode Preview
WHEN a user previews or exports the scene,
the system SHALL support color, depth, and normal render modes.

#### Scenario: Change preview render mode
GIVEN the editor scene is active
WHEN the user selects color, depth, or normal mode
THEN the viewport updates to the chosen render mode
AND subsequent export actions default to the selected preview mode unless overridden in the export dialog

### Requirement: Image Export Workflow
WHEN a user requests a still render,
the system SHALL export a scene image using the selected resolution, render mode, and FOV.

#### Scenario: Export image rough cut
GIVEN the export dialog is open in image mode
WHEN the user confirms the export
THEN the system captures the current editor scene with the selected export settings
AND the system downloads or returns the generated image artifact

### Requirement: Video Export Workflow
WHEN a user requests a rough-cut video render,
the system SHALL export a video driven by the editor timeline.

#### Scenario: Export timeline-based video
GIVEN the export dialog is open in video mode
AND the scene contains camera timeline data
WHEN the user confirms the export
THEN the system renders frames using the current timeline state and export settings
AND the system records the rendered frames into a downloadable video artifact

#### Scenario: Export dialog communicates timeline context
GIVEN the export dialog is open
WHEN the requested export type depends on the timeline
THEN the system shows timeline-related guidance in the export dialog

### editor-scene-authoring

## ADDED Requirements

### Requirement: Scene Authoring Workspace
WHEN the editor workspace loads successfully,
the system SHALL present a scene authoring interface with a scene panel, a model list, a model settings panel, and a timeline area.

#### Scenario: Editor initializes the workspace
GIVEN the browser supports the required WebGPU runtime
WHEN the editor application initializes
THEN the system shows the editor canvas
AND the system exposes scene controls for background, preset sky color, depth scale, and FOV
AND the system exposes model list and transform controls
AND the system exposes a bottom timeline for camera keyframes

### Requirement: Multi-format Scene Asset Loading
WHEN a user imports supported scene assets,
the system SHALL load each model into the current editor scene.

#### Scenario: Add models from picker or drag-and-drop
GIVEN the editor is open
WHEN the user selects or drops files with supported extensions
THEN the system loads each file into the current scene
AND the system lists each loaded model in the model list
AND the system preserves the active preview mode across loaded models

#### Scenario: Unsupported or failed asset load
GIVEN the editor is open
WHEN a selected file cannot be loaded
THEN the system reports the load failure
AND the system keeps the remaining scene state usable

### Requirement: Scene Appearance Controls
WHEN a user edits scene-level appearance settings,
the system SHALL apply them immediately to the active viewport.

#### Scenario: Update scene appearance
GIVEN the editor scene is loaded
WHEN the user changes background color, sky preset, depth scale, or camera FOV
THEN the system updates the active scene rendering immediately
AND the system keeps the controls synchronized to the applied values

### Requirement: Scene Persistence Workflow
WHEN a user saves, loads, or clears a scene,
the system SHALL preserve or reset the editable scene state through explicit scene actions.

#### Scenario: Save current scene
GIVEN the current scene contains loaded models and scene settings
WHEN the user runs the save scene action
THEN the system serializes the scene configuration
AND the system includes the model asset references needed to reopen the scene later

#### Scenario: Load a saved scene
GIVEN the user selects a previously saved scene package
WHEN the user runs the load scene action
THEN the system restores the scene settings
AND the system restores the scene models into the editor workspace

#### Scenario: Clear the scene
GIVEN the editor scene contains one or more models
WHEN the user runs the clear scene action
THEN the system removes all models from the scene
AND the system returns the workspace to an empty scene state

