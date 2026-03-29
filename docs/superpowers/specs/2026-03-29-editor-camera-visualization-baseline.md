## ADDED Requirements

### Requirement: Camera Sequence Visualization
WHEN a scene contains camera keyframes,
the system SHALL visualize the camera sequence inside the 3D scene using the active camera interpolation evaluation path and parameter state.

#### Scenario: Show camera sequence helpers
GIVEN one or more camera keyframes exist
WHEN the camera sequence visualization is enabled
THEN the system renders keyframe frustums, a trajectory path, and a current camera marker in the scene
AND the helper visibility can be toggled from the editor UI

#### Scenario: Helper path follows the active mode and parameter
GIVEN the active interpolation mode or parameter changes path behavior
WHEN the camera sequence helper path is rendered
THEN the helper path reflects the same evaluated camera positions used during playback
AND the helper path updates when the user changes the mode or parameter

### Requirement: Screen-space Constant Camera Sequence Thickness
WHEN the editor renders camera sequence frustums or trajectory lines,
the system SHALL keep their apparent line thickness approximately constant in screen space across normal viewing distances.

#### Scenario: Near and far views keep similar apparent thickness
GIVEN the editor camera views the same camera-sequence helper from a near position and from a far position
WHEN the helper remains visible in both views
THEN the helper edges and path lines retain approximately the same apparent pixel thickness
AND the helper does not become disproportionately thick only because the view is closer

#### Scenario: Scene scale does not control helper thickness
GIVEN two scenes contain the same camera-sequence helper at different world scales
WHEN the editor renders each scene in the viewport
THEN the helper thickness is determined primarily by screen-space rendering behavior
AND not by the scene's world-space scale alone

### Requirement: Camera Sequence Spatial Alignment Preservation
WHEN the editor changes camera-sequence helper rendering or interpolation behavior,
the system SHALL preserve the current world-space pose, orientation, and timing alignment of the helper.

#### Scenario: Frustum corners remain aligned to keyframe pose
GIVEN a keyframe pose is already visualized by the editor
WHEN the helper is rendered
THEN the helper still represents the same keyframe position and orientation
AND changing thickness or interpolation behavior does not move the represented camera pose

#### Scenario: Timeline updates keep helper tracking intact
GIVEN the timeline updates the current camera-sequence visualization
WHEN the helper is refreshed after timeline or selection changes
THEN the helper remains aligned with the same keyframe data as before
AND only its visualization behavior changes

### Requirement: Camera Sequence Visualization Compatibility
WHEN the editor visualizes the camera sequence,
the system SHALL preserve visibility control and selected-frame emphasis behavior.

#### Scenario: Selected frame emphasis remains visible
GIVEN one keyframe is currently selected in the editor
WHEN the camera sequence helper is rendered
THEN the selected frame remains visually distinguishable from unselected frames

#### Scenario: Visibility toggle still controls helper rendering
GIVEN camera-sequence visualization is currently hidden
WHEN the user re-enables camera-sequence visualization
THEN the helper reappears using the current visualization behavior
AND hiding the helper still suppresses its rendering
