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
