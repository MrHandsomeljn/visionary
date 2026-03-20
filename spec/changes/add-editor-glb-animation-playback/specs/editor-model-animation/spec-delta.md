## ADDED Requirements

### Requirement: GLB Animation Clip Preservation
WHEN the editor loads a GLB or glTF asset that contains animation clips,
the system SHALL preserve the parsed clip data so the runtime can identify and drive animated mesh assets.

#### Scenario: Animated GLB preserves clip data
GIVEN a GLB asset contains one or more glTF animation clips
WHEN the editor loader finishes parsing the asset
THEN the loaded mesh data includes the scene graph
AND the loaded mesh data includes the parsed animation clips

#### Scenario: Static GLB remains valid without clips
GIVEN a GLB asset contains no animation clips
WHEN the editor loader finishes parsing the asset
THEN the loaded mesh data includes the scene graph
AND the loaded mesh data records that no animation clips are available

### Requirement: Minimal GLB Animation Playback
WHEN the editor loads an animated GLB asset,
the system SHALL be able to play the asset's default animation clip using Three.js-native animation playback without requiring changes to Three.js itself.

#### Scenario: Default clip plays after load
GIVEN an animated GLB asset has been loaded into the editor
AND the asset exposes at least one animation clip
WHEN the runtime starts or resumes animated mesh updates
THEN the first available GLB animation clip plays on the loaded mesh asset
AND the animated mesh remains renderable in the viewport

#### Scenario: Static GLB does not enter animation playback
GIVEN a GLB asset has no animation clips
WHEN the asset is loaded into the editor
THEN the asset renders as a static mesh
AND the editor does not attempt to create active animation playback state for that asset

### Requirement: GLB Animation Runtime Update
WHILE an animated GLB asset is playing in the editor,
the system SHALL advance the asset's animation state from the existing editor frame loop.

#### Scenario: Frame loop updates animated GLB
GIVEN an animated GLB asset is loaded and playback is active
WHEN the editor advances one or more render frames
THEN the system updates the GLB animation mixer using elapsed frame time
AND the viewport reflects the updated animated pose

#### Scenario: Mixed scenes remain renderable
GIVEN an animated GLB asset and one or more Gaussian assets are visible in the same scene
WHEN the editor render loop advances
THEN the GLB animation state updates
AND the mesh-plus-Gaussian fused render path continues to draw the scene

### Requirement: Editor GLB Animation Controls
WHEN a selected GLB asset exposes animation clips,
the system SHALL expose editor-facing state for clip selection and playback control independent of the initial Stage 1 autoplay behavior.

#### Scenario: Editor exposes clip metadata
GIVEN a selected GLB asset has multiple animation clips
WHEN the editor inspects the selected model state
THEN the editor can access each clip's name and duration
AND the editor can identify the currently selected clip

#### Scenario: Playback controls affect the selected GLB asset
GIVEN a selected GLB asset exposes animation clips
WHEN the user changes the selected clip, playback state, or playback speed
THEN the system applies those changes only to the selected GLB asset
AND the viewport reflects the updated playback state

### Requirement: Timeline-Synchronized GLB Animation
WHEN timeline synchronization is enabled for an animated GLB asset,
the system SHALL drive the asset animation from timeline time instead of free-running mixer delta-time updates.

#### Scenario: Timeline scrub sets GLB animation time
GIVEN an animated GLB asset has timeline synchronization enabled
WHEN the user scrubs the editor timeline to a specific time
THEN the system applies the corresponding GLB animation time deterministically
AND repeated scrubs to the same timeline time produce the same animated pose

#### Scenario: Free-running playback remains available
GIVEN an animated GLB asset has timeline synchronization disabled
WHEN the editor render loop advances during playback
THEN the system updates the GLB animation using frame delta time
AND the GLB asset does not require timeline interaction to animate

### Requirement: GLB Animation Scene Persistence
WHEN the editor saves or reloads a scene that contains animated GLB assets,
the system SHALL preserve the GLB animation configuration introduced by the editor.

#### Scenario: Save and reload GLB animation settings
GIVEN a scene contains an animated GLB asset
AND the user has configured clip selection, playback speed, loop mode, or timeline sync state
WHEN the scene is saved and later reloaded
THEN the GLB asset is restored with the same animation configuration
AND the restored configuration can be used immediately without manual re-entry
