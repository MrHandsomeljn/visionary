# add-editor-glb-animation-playback 实施计划

> **面向 AI 代理的工作者：** 该文档由 `openspec/` 迁移而来，用于在 `docs/superpowers/plans/` 下继续维护。步骤使用复选框（`- [ ]` / `- [x]`）语法跟踪状态。

**目标：** 见下方「提案」章节。

**架构：** 见下方「规格增量」和「任务」章节。

**技术栈：** Visionary Editor、`public/editor.js`、`src/editor/editor-app.ts`、Three.js / WebGPU。

---

## 状态

- 迁移来源：`openspec/changes/add-editor-glb-animation-playback`
- 当前状态：进行中
- 迁移日期：2026-03-29

## 提案

# Proposal: Add Editor GLB Animation Playback

## Why

The editor can already load `.glb` and `.gltf` meshes, but it currently discards glTF animation clips during loading. As a result, animated GLB assets render as static meshes even though Three.js already provides native glTF animation support through `GLTFLoader` and `AnimationMixer`.

**Context**:
- The current editor render path already supports real-time Three.js mesh rendering and per-frame updates.
- The repository already contains an `FBXModelWrapper` that demonstrates a compatible pattern for driving mesh animation through a wrapper plus per-frame update loop.

**Current state**: GLB files load as `Object3D` scene graphs only; animation clips are not preserved, exposed, or updated in the editor runtime.

**Desired state**: The editor should incrementally gain GLB animation support through small, independently verifiable steps, starting with native playback of the first clip and later integrating editor controls, timeline sync, and persistence.

## What Changes

- Add a staged implementation plan for GLB animation support in the editor.
- Define a minimal Stage 1 that preserves glTF clips, instantiates a wrapper around Three.js `AnimationMixer`, and updates animated GLB models in the existing editor frame loop.
- Define a Stage 2 that exposes clip selection and playback controls, enables optional timeline synchronization, and persists GLB animation state in saved scenes.

## Impact

### Affected Specifications
- `openspec/changes/add-editor-glb-animation-playback/specs/editor-model-animation/spec-delta.md` - adds GLB animation playback requirements and staged editor integration behavior

### Affected Code
- `src/io/threejs_adapters.ts` - preserve glTF animation clips during load
- `src/editor/editor-app.ts` - create GLB animation runtime state and update it per frame
- `src/models/*` - add or generalize a mesh animation wrapper around `AnimationMixer`
- `public/editor.js` and editor UI only in Stage 2
- scene save/load code only in Stage 2

### User Impact
- Stage 1 allows animated GLB assets to play in the editor with minimal behavior change.
- Stage 2 allows users to inspect and control GLB animation playback consistently with other editor animation workflows.

### API Changes
- No external API break is required.
- Internal loader and editor model structures will expand to retain glTF animation clips.

### Migration Required
- [ ] Database migration
- [ ] API version bump
- [ ] User communication needed
- [x] Documentation updates

## Timeline Estimate

Medium. Stage 1 is small-to-medium. Stage 2 is medium because it adds UI, timeline, and persistence integration.

## Risks

- Some GLB files may rely on optional glTF compression or texture extensions not currently configured in the loader path; this proposal only targets animation playback for already-loadable GLB assets.
- Timeline synchronization can create ambiguity between free-running playback and absolute-time control; Stage 2 separates those concerns into explicit tasks to keep each step testable.

## 任务

# Implementation Tasks

## Phase 1: Minimal Native Playback

1. [x] Preserve `gltf.animations` in the GLB loader result so the editor can distinguish static and animated GLB assets.
Validation: loading an animated GLB exposes one or more clip objects in the returned mesh data structure.

2. [x] Introduce a GLB-compatible animation wrapper around Three.js `AnimationMixer`, reusing the existing FBX wrapper pattern where practical.
Validation: a unit-level or debug-level check can instantiate the wrapper with clips, query clip metadata, and call `play`, `pause`, `setTime`, and `update` without editor UI changes.

3. [x] Attach the wrapper to animated GLB models during `EditorApp.loadModel()` and mark those models as dynamic with a computed animation duration.
Validation: after loading an animated GLB, the editor model record reports that animation is available and exposes duration metadata.

4. [x] Update animated GLB wrappers from the existing editor render loop using frame delta time, without changing static GLB behavior.
Validation: an animated GLB visibly moves in the viewport during playback, and a static GLB remains unchanged.

5. [x] Add a focused verification path for Stage 1 covering: static GLB load, animated GLB load, first-clip playback, pause/resume behavior, and coexistence with Gaussian rendering.
Validation: each listed scenario is checked manually or by targeted test harness notes.

## Phase 2: Editor Integration

6. Expose GLB clip metadata and selected-clip state in the editor model layer without changing Stage 1 default playback behavior.
Validation: loading an animated GLB exposes clip name and duration data to the editor state, even before control UI is used.

7. Add editor controls for GLB animation playback state, speed, and clip selection as a separate UI change.
Validation: the selected GLB clip can be changed and its playback can be started, paused, resumed, or speed-adjusted from the editor UI.

8. Add optional timeline-driven GLB animation time control as a dedicated integration step, keeping free-running playback as a fallback mode.
Validation: when timeline sync is enabled, scrubbing or playback drives GLB animation time deterministically; when disabled, GLB playback continues to use mixer delta-time updates.

9. Persist GLB animation state in scene save/load, including selected clip, playback speed, loop mode, and any timeline sync flags introduced by Stage 2.
Validation: saving and reloading a scene restores GLB animation configuration without requiring the user to reconfigure the asset.

10. Add final regression verification covering render modes, mixed GLB-plus-Gaussian scenes, scene reload, and timeline interaction.
Validation: animated GLB playback remains correct in color, depth, and normal preview modes and does not break mixed-scene rendering.

## 验证

# Stage 1 Verification

## Scope

This checklist validates the minimal GLB animation playback implementation introduced in Stage 1.

## Manual Checks

1. Static GLB load
- Load a GLB or glTF asset with no animation clips.
- Confirm the asset appears in the viewport as a static mesh.
- Confirm no runtime errors are emitted during load.

2. Animated GLB load
- Load a GLB or glTF asset with at least one animation clip.
- Confirm the asset appears in the viewport.
- Confirm the asset is recorded as dynamic in editor debug/model state.

3. First-clip playback
- After loading an animated GLB, observe the viewport for motion.
- Confirm the first clip starts without requiring editor UI controls.

4. Pause and resume behavior
- Use browser devtools to pause and resume the wrapper if a debug hook is added later, or temporarily instrument the wrapper methods during development.
- Confirm pausing stops visible motion.
- Confirm resuming continues motion from the same animated asset.

5. Coexistence with Gaussian rendering
- Load at least one Gaussian asset and one animated GLB asset in the same scene.
- Confirm the animated GLB continues updating while the fused render path remains visible.
- Confirm color, depth, and normal preview modes still render the scene without runtime errors.

## Build Validation

- Run `npm run build`.
- Confirm the build completes successfully with the Stage 1 code changes.

## 规格增量

### editor-model-animation

## ADDED Requirements

### Requirement: GLB Animation Clip Preservation
WHEN the editor loads a GLB or glTF asset that contains animation clips,
the system SHALL preserve the parsed clip data so the runtime can identify and drive animated mesh assets.

#### Scenario: Animated GLB preserves clip data
GIVEN a GLB asset contains one or more glTF animation clips
WHEN the editor loader finishes parsing the asset
THEN the loaded mesh data includes the scene graph
AND the loaded mesh data includes the parsed animation clips

#### Scenario: Static GLB remains valid without clips
GIVEN a GLB asset contains no animation clips
WHEN the editor loader finishes parsing the asset
THEN the loaded mesh data includes the scene graph
AND the loaded mesh data records that no animation clips are available

### Requirement: Minimal GLB Animation Playback
WHEN the editor loads an animated GLB asset,
the system SHALL be able to play the asset's default animation clip using Three.js-native animation playback without requiring changes to Three.js itself.

#### Scenario: Default clip plays after load
GIVEN an animated GLB asset has been loaded into the editor
AND the asset exposes at least one animation clip
WHEN the runtime starts or resumes animated mesh updates
THEN the first available GLB animation clip plays on the loaded mesh asset
AND the animated mesh remains renderable in the viewport

#### Scenario: Static GLB does not enter animation playback
GIVEN a GLB asset has no animation clips
WHEN the asset is loaded into the editor
THEN the asset renders as a static mesh
AND the editor does not attempt to create active animation playback state for that asset

### Requirement: GLB Animation Runtime Update
WHILE an animated GLB asset is playing in the editor,
the system SHALL advance the asset's animation state from the existing editor frame loop.

#### Scenario: Frame loop updates animated GLB
GIVEN an animated GLB asset is loaded and playback is active
WHEN the editor advances one or more render frames
THEN the system updates the GLB animation mixer using elapsed frame time
AND the viewport reflects the updated animated pose

#### Scenario: Mixed scenes remain renderable
GIVEN an animated GLB asset and one or more Gaussian assets are visible in the same scene
WHEN the editor render loop advances
THEN the GLB animation state updates
AND the mesh-plus-Gaussian fused render path continues to draw the scene

### Requirement: Editor GLB Animation Controls
WHEN a selected GLB asset exposes animation clips,
the system SHALL expose editor-facing state for clip selection and playback control independent of the initial Stage 1 autoplay behavior.

#### Scenario: Editor exposes clip metadata
GIVEN a selected GLB asset has multiple animation clips
WHEN the editor inspects the selected model state
THEN the editor can access each clip's name and duration
AND the editor can identify the currently selected clip

#### Scenario: Playback controls affect the selected GLB asset
GIVEN a selected GLB asset exposes animation clips
WHEN the user changes the selected clip, playback state, or playback speed
THEN the system applies those changes only to the selected GLB asset
AND the viewport reflects the updated playback state

### Requirement: Timeline-Synchronized GLB Animation
WHEN timeline synchronization is enabled for an animated GLB asset,
the system SHALL drive the asset animation from timeline time instead of free-running mixer delta-time updates.

#### Scenario: Timeline scrub sets GLB animation time
GIVEN an animated GLB asset has timeline synchronization enabled
WHEN the user scrubs the editor timeline to a specific time
THEN the system applies the corresponding GLB animation time deterministically
AND repeated scrubs to the same timeline time produce the same animated pose

#### Scenario: Free-running playback remains available
GIVEN an animated GLB asset has timeline synchronization disabled
WHEN the editor render loop advances during playback
THEN the system updates the GLB animation using frame delta time
AND the GLB asset does not require timeline interaction to animate

### Requirement: GLB Animation Scene Persistence
WHEN the editor saves or reloads a scene that contains animated GLB assets,
the system SHALL preserve the GLB animation configuration introduced by the editor.

#### Scenario: Save and reload GLB animation settings
GIVEN a scene contains an animated GLB asset
AND the user has configured clip selection, playback speed, loop mode, or timeline sync state
WHEN the scene is saved and later reloaded
THEN the GLB asset is restored with the same animation configuration
AND the restored configuration can be used immediately without manual re-entry

