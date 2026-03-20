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
