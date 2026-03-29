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
GIVEN at least one camera keyframe exists
WHEN the user removes the selected keyframe
THEN the system deletes that keyframe from the timeline
AND the timeline updates its visible markers

### Requirement: Timeline Playback Controls
WHEN a user previews camera motion,
the system SHALL play back interpolated camera movement across the timeline using the active camera interpolation mode and parameter state.

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

### Requirement: Timeline Rate and Extent Controls
WHEN a user edits timeline playback settings,
the system SHALL support global FPS selection, global playback speed selection, and automatic duration extension for dynamic content.

#### Scenario: Change timeline FPS or global speed
GIVEN the timeline is visible
WHEN the user changes FPS or playback speed
THEN the system uses the updated FPS for frame-domain timeline behavior
AND the system uses the updated speed multiplier during timeline playback

#### Scenario: Dynamic animated content extends timeline duration
GIVEN the scene contains animated models with longer active animation windows
WHEN those model durations exceed the default timeline length
THEN the system extends the editable timeline duration to cover the longest active animation window

### Requirement: Camera Interpolation Mode Selector
WHEN the editor evaluates camera motion between keyframes,
the system SHALL expose a selectable interpolation mode to the user from the camera timeline header.

#### Scenario: User chooses a working interpolation mode
GIVEN the camera timeline header is visible
WHEN the user opens the interpolation selector
THEN the selector includes `linear`
AND the selector includes at least one nonlinear working mode

#### Scenario: Linear remains available as the baseline mode
GIVEN the user selects `linear`
WHEN the editor evaluates timeline camera motion
THEN the system uses the baseline linear interpolation behavior
AND the baseline mode remains available even after nonlinear modes are added

### Requirement: Expanded Camera Interpolation Modes
WHEN the camera timeline header is visible,
the system SHALL expose multiple working camera interpolation modes suited to different camera-authoring intents.

#### Scenario: Multiple working modes are available
GIVEN the user opens the interpolation selector
WHEN the selector options are displayed
THEN the selector includes `linear`
AND the selector includes `squad`
AND the selector includes at least one additional working interpolation mode

#### Scenario: Degenerate segments fall back safely
GIVEN the active segment does not provide stable nonlinear evaluation
WHEN the selected interpolation mode cannot be applied safely
THEN the editor falls back to stable baseline interpolation for that segment
AND the camera preview remains valid

### Requirement: Interpolation Parameter Control
WHEN the selected interpolation mode supports tuning,
the system SHALL expose a compact parameter control beside the interpolation selector.

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
AND playback matches the restored state
