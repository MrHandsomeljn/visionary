# Implementation Tasks

1. [x] Review the existing editor selection and transform-update flow in `src/editor/editor-app.ts` and map it to the reusable gizmo lifecycle in `src/gizmo/*`.
2. [x] Add an editor-owned gizmo integration layer that can target the currently selected scene model and render the gizmo through the existing overlay path.
3. [x] Add viewport-facing gizmo mode controls for translate, rotate, and scale, with a clear disabled or hidden state when no model is selected.
4. [x] Ensure gizmo drags update the selected model's canonical editor transform state and keep the right-side transform inputs synchronized.
5. [x] Ensure camera controls are suppressed during gizmo drags and restored afterward, without regressing existing double-click look-at or general viewport navigation.
6. [x] Limit the first release to stable selected-model manipulation behavior, using the existing default pivot behavior and avoiding extra exposed controls unless required.
7. [ ] Validate the workflow with at least one mesh model and one gaussian-backed model, confirming translate, rotate, scale, reset, selection changes, and scene save/load compatibility.
