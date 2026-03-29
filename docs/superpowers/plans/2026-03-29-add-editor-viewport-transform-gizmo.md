# add-editor-viewport-transform-gizmo 实施计划

> **面向 AI 代理的工作者：** 该文档由 `openspec/` 迁移而来，用于在 `docs/superpowers/plans/` 下继续维护。步骤使用复选框（`- [ ]` / `- [x]`）语法跟踪状态。

**目标：** 见下方「提案」章节。

**架构：** 见下方「规格增量」和「任务」章节。

**技术栈：** Visionary Editor、`public/editor.js`、`src/editor/editor-app.ts`、Three.js / WebGPU。

---

## 状态

- 迁移来源：`openspec/changes/add-editor-viewport-transform-gizmo`
- 当前状态：进行中
- 迁移日期：2026-03-29

## 提案

# Proposal: add-editor-viewport-transform-gizmo

## Why

The editor currently supports model transforms only through numeric inputs in the right-side settings panel. That is functional but slow for layout work, especially when the user needs to place, rotate, or scale a model while looking at the scene. Visionary already contains a reusable gizmo stack built on Three.js `TransformControls`, plus an overlay render path that can composite gizmos over the fused mesh + gaussian viewport. The missing work is editor integration.

## What Changes

- Add viewport transform gizmo support for the currently selected editor model.
- Reuse the existing `src/gizmo` implementation instead of introducing a second transform-control system.
- Wire the editor selection model to a gizmo target so the gizmo appears only for the active model.
- Support the three primary transform modes in the editor viewport: translate, rotate, and scale.
- Keep the right-side transform inputs synchronized with gizmo edits in real time.
- Disable camera manipulation while the gizmo is being dragged, then restore camera control after the drag completes.
- Limit the first implementation to the selected model workflow and stable default pivot behavior, rather than exposing all internal gizmo features at once.

## Impact

- Affected specs: `editor-model-animation`
- Affected code:
  - `src/editor/editor-app.ts`
  - `public/editor.js`
  - `public/editor.html`
  - `public/editor.css`
  - existing reusable gizmo modules under `src/gizmo/*`
- User impact:
  - users can place selected models directly in the viewport
  - numeric transform editing remains available and stays in sync
  - camera dragging and gizmo dragging no longer compete for the same pointer interaction
- Implementation risk:
  - Gaussian and mesh-backed models use different scene objects, so the editor must attach the gizmo to the correct runtime object while still updating the canonical editor model state.
  - The editor already owns pointer handling on the canvas, so event ordering between camera controls, selection, double-click look-at, and gizmo dragging must be handled carefully.

## 任务

# Implementation Tasks

1. [x] Review the existing editor selection and transform-update flow in `src/editor/editor-app.ts` and map it to the reusable gizmo lifecycle in `src/gizmo/*`.
2. [x] Add an editor-owned gizmo integration layer that can target the currently selected scene model and render the gizmo through the existing overlay path.
3. [x] Add viewport-facing gizmo mode controls for translate, rotate, and scale, with a clear disabled or hidden state when no model is selected.
4. [x] Ensure gizmo drags update the selected model's canonical editor transform state and keep the right-side transform inputs synchronized.
5. [x] Ensure camera controls are suppressed during gizmo drags and restored afterward, without regressing existing double-click look-at or general viewport navigation.
6. [x] Limit the first release to stable selected-model manipulation behavior, using the existing default pivot behavior and avoiding extra exposed controls unless required.
7. [ ] Validate the workflow with at least one mesh model and one gaussian-backed model, confirming translate, rotate, scale, reset, selection changes, and scene save/load compatibility.

## 规格增量

### editor-model-animation

## MODIFIED Requirements

### Requirement: Editable Model Transform Controls
WHEN a user selects a model in the editor,
the system SHALL provide direct transform controls for position, rotation, and scale through both the settings panel and the viewport gizmo workflow.

#### Scenario: Edit selected model transform from the settings panel
GIVEN a model is selected in the editor
WHEN the user updates position, rotation, or scale values in the settings panel
THEN the system updates the selected model transform in the viewport
AND the system keeps the model settings panel synchronized with the active model state
AND the viewport gizmo target, when visible, stays aligned with the updated transform.

#### Scenario: Edit selected model transform from the viewport gizmo
GIVEN a model is selected in the editor
AND the viewport gizmo is enabled for that selection
WHEN the user drags the gizmo to translate, rotate, or scale the selected model
THEN the system updates the selected model transform in the viewport
AND the system keeps the settings panel inputs synchronized with the updated transform state.

#### Scenario: Reset selected model transform
GIVEN a model is selected in the editor
WHEN the user runs the reset transform action
THEN the system restores the model transform to its default editable state
AND the viewport gizmo, when visible, resets to the restored model transform.

## ADDED Requirements

### Requirement: Selected-model Viewport Transform Gizmo
WHEN the editor has an active selected model that supports editor transforms,
the system SHALL allow that model to be manipulated directly in the viewport with a transform gizmo.

#### Scenario: Show gizmo for the selected model only
GIVEN one or more models exist in the editor
WHEN the user selects a model that supports editor transforms
THEN the system shows a transform gizmo for the selected model in the viewport
AND the system hides or disables the gizmo for all non-selected models.

#### Scenario: Switch viewport transform mode
GIVEN a transform gizmo is visible for the selected model
WHEN the user switches the gizmo mode between translate, rotate, and scale
THEN the system applies the requested transform mode to subsequent gizmo drags
AND the selected model remains the active gizmo target.

#### Scenario: Prevent camera-control conflicts during gizmo drags
GIVEN a transform gizmo is visible for the selected model
WHEN the user begins dragging the gizmo
THEN the system suppresses viewport camera manipulation for the duration of the drag
AND WHEN the drag ends
THEN the system restores normal viewport camera controls.

