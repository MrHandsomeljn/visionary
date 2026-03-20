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
