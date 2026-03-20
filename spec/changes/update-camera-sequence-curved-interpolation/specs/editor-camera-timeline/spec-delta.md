## MODIFIED Requirements

### Requirement: Timeline Playback Controls
WHEN a user previews camera motion,
the system SHALL play back interpolated camera movement across the timeline using the active camera interpolation mode.

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

#### Scenario: Squad mode changes camera interpolation behavior
GIVEN the camera timeline interpolation mode is set to `squad`
WHEN the user previews the timeline
THEN the system evaluates camera motion with squad-based nonlinear rotation where valid
AND the system preserves deterministic playback for the selected timeline time

#### Scenario: Scrubbing remains deterministic under alternate interpolation
GIVEN the camera timeline uses a non-default interpolation mode
WHEN the user scrubs repeatedly to the same timeline time
THEN the system returns the same camera pose each time
AND playback uses the same evaluated pose for that timeline time

### Requirement: Camera Sequence Visualization
WHEN a scene contains camera keyframes,
the system SHALL visualize the camera sequence inside the 3D scene using the active camera interpolation evaluation path.

#### Scenario: Show camera sequence helpers
GIVEN one or more camera keyframes exist
WHEN the camera sequence visualization is enabled
THEN the system renders keyframe frustums, a trajectory path, and a current camera marker in the scene
AND the helper visibility can be toggled from the model list area

#### Scenario: Sampled helper path follows the active interpolation mode
GIVEN the active camera interpolation mode changes camera evaluation between keyframes
WHEN the camera sequence helper path is rendered
THEN the rendered path follows the same interpolation model used for camera playback
AND the helper path does not misrepresent the actual previewed trajectory

## ADDED Requirements

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

### Requirement: Initial Squad Interpolation Support
WHEN the user selects `squad` as the camera interpolation mode,
the system SHALL evaluate camera motion using squad where valid and safely fall back to linear behavior where squad is not stable or not applicable.

#### Scenario: Multi-keyframe squad interpolation is used when valid
GIVEN the timeline contains enough keyframe context to evaluate squad safely
WHEN the user selects `squad`
THEN the editor uses squad-based camera interpolation between keyframes
AND the resulting camera motion differs from the baseline linear mode

#### Scenario: Degenerate segments fall back safely
GIVEN the active segment does not provide stable squad evaluation
WHEN the user selects `squad`
THEN the editor falls back to the baseline linear interpolation for that segment
AND the camera preview remains valid instead of producing invalid rotation output

### Requirement: Camera Interpolation Scene Persistence
WHEN a scene using a selected camera interpolation mode is saved and later reloaded,
the system SHALL preserve the interpolation mode needed to reproduce the same camera motion.

#### Scenario: Reload preserves interpolation mode
GIVEN a scene has a non-default camera interpolation mode enabled
WHEN the scene is saved and later reloaded
THEN the timeline playback reproduces the same interpolation mode
AND the camera sequence helper visualization matches the restored interpolation state
