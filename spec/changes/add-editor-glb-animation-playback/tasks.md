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
