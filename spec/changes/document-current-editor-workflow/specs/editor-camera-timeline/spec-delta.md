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
