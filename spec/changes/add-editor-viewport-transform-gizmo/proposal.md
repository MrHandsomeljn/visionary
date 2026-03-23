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
