## ADDED Requirements

### Requirement: Editable Model Transform Controls
WHEN a user selects a model in the editor,
the system SHALL provide direct transform controls for position, rotation, and scale through both the settings panel and the viewport gizmo workflow.

#### Scenario: Edit selected model transform from the settings panel
GIVEN a model is selected in the editor
WHEN the user updates position, rotation, or scale values in the settings panel
THEN the system updates the selected model transform in the viewport
AND the system keeps the model settings panel synchronized with the active model state
AND the viewport gizmo target, when visible, stays aligned with the updated transform

#### Scenario: Edit selected model transform from the viewport gizmo
GIVEN a model is selected in the editor
AND the viewport gizmo is enabled for that selection
WHEN the user drags the gizmo to translate, rotate, or scale the selected model
THEN the system updates the selected model transform in the viewport
AND the system keeps the settings panel inputs synchronized with the updated transform state

#### Scenario: Reset selected model transform
GIVEN a model is selected in the editor
WHEN the user runs the reset transform action
THEN the system restores the model transform to its default editable state
AND the viewport gizmo, when visible, resets to the restored model transform

### Requirement: Selected-model Viewport Transform Gizmo
WHEN the editor has an active selected model that supports editor transforms,
the system SHALL allow that model to be manipulated directly in the viewport with a transform gizmo.

#### Scenario: Show gizmo for the selected model only
GIVEN one or more models exist in the editor
WHEN the user selects a model that supports editor transforms
THEN the system shows a transform gizmo for the selected model in the viewport
AND the system hides or disables the gizmo for all non-selected models

#### Scenario: Switch viewport transform mode
GIVEN a transform gizmo is visible for the selected model
WHEN the user switches the gizmo mode between translate, rotate, and scale
THEN the system applies the requested transform mode to subsequent gizmo drags
AND the selected model remains the active gizmo target

#### Scenario: Prevent camera-control conflicts during gizmo drags
GIVEN a transform gizmo is visible for the selected model
WHEN the user begins dragging the gizmo
THEN the system suppresses viewport camera manipulation for the duration of the drag
AND WHEN the drag ends
THEN the system restores normal viewport camera controls

### Requirement: Per-model Visibility Management
WHEN a scene contains editor models,
the system SHALL allow each model's visibility to be toggled from the model list.

#### Scenario: Toggle model visibility
GIVEN one or more models are listed in the scene
WHEN the user toggles a model visibility control
THEN the system updates the model visibility in the viewport
AND the model list reflects the new visible state

### Requirement: Per-model ONNX Animation Controls
WHEN a selected model supports ONNX animation playback,
the system SHALL provide play or pause, loop, speed, and time-bound controls for that model.

#### Scenario: Control ONNX animation playback
GIVEN a selected model supports ONNX animation
WHEN the user changes playback state, loop state, or playback speed
THEN the system applies those controls only to the selected model
AND the editor keeps the animation control UI synchronized with the model state

#### Scenario: Adjust animation time bounds from the timeline
GIVEN a selected dynamic ONNX model appears on the timeline
WHEN the user adjusts the model track bounds
THEN the system updates the model's animation start and end times
AND the global scene playback uses the updated time window

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

### Requirement: GLB Animation Playback and Runtime Update
WHEN the editor loads an animated GLB asset,
the system SHALL be able to play the asset's animation in the viewport and advance it from editor runtime updates.

#### Scenario: Default clip plays after load
GIVEN an animated GLB asset has been loaded into the editor
AND the asset exposes at least one animation clip
WHEN the runtime starts or resumes animated mesh updates
THEN the first available GLB animation clip plays on the loaded mesh asset
AND the animated mesh remains renderable in the viewport

#### Scenario: Mixed scenes remain renderable
GIVEN an animated GLB asset and one or more Gaussian assets are visible in the same scene
WHEN the editor render loop advances
THEN the GLB animation state updates
AND the mesh-plus-Gaussian fused render path continues to draw the scene

### Requirement: Editor GLB Animation Controls
WHEN a selected GLB asset exposes animation clips,
the system SHALL expose editor-facing state for clip selection and playback control.

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

### Requirement: Timeline-synchronized GLB Animation
WHEN timeline synchronization is enabled for an animated GLB asset,
the system SHALL drive the asset animation from timeline time instead of free-running updates.

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
