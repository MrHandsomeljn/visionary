## ADDED Requirements

### Requirement: Screen-Space Constant Camera Sequence Thickness
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
WHEN the editor changes camera-sequence helper rendering to a screen-space-stable representation,
the system SHALL preserve the current world-space pose, orientation, and timing alignment of the helper.

#### Scenario: Frustum corners remain aligned to keyframe pose
GIVEN a keyframe pose is already visualized by the editor
WHEN the screen-space-stable helper is rendered
THEN the helper still represents the same keyframe position and orientation
AND changing thickness behavior does not move the represented camera pose

#### Scenario: Timeline updates keep helper tracking intact
GIVEN the timeline updates the current camera-sequence visualization
WHEN the helper is refreshed after timeline or selection changes
THEN the helper remains aligned with the same keyframe data as before
AND only its thickness behavior changes

### Requirement: Camera Sequence Visualization Compatibility
WHEN the editor uses the screen-space-stable camera helper,
the system SHALL preserve existing camera-sequence visibility and emphasis behavior.

#### Scenario: Selected frame emphasis remains visible
GIVEN one keyframe is currently selected in the editor
WHEN the camera sequence helper is rendered
THEN the selected frame remains visually distinguishable from unselected frames
AND the distinction remains visible with the new thickness implementation

#### Scenario: Visibility toggle still controls helper rendering
GIVEN camera-sequence visualization is currently hidden
WHEN the user re-enables camera-sequence visualization
THEN the helper reappears using the screen-space-stable thickness behavior
AND hiding the helper still suppresses its rendering
